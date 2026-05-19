import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Reservation, type IReservationExtra, type PaymentOption } from '../models/Reservation';
import { ReservationHold } from '../models/ReservationHold';
import { RoomBlock } from '../models/RoomBlock';
import { Room } from '../models/Room';
import { Venue } from '../models/Venue';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateConfirmationCode } from '../utils/confirmationCode';
import { generateQRDataURL } from '../utils/qr';
import {
  createHotelClientConfirmationTemplate,
  createHotelOwnerNewReservationTemplate,
  sendEmail,
} from '../services/email.service';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { logger } from '../config/logger';

const router = Router();

const HOLD_TTL_MINUTES = 15;
const TAX_RATE = 0.1;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Trop de tentatives. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.headers.authorization?.toString() ||
    ipKeyGenerator(req.ip || req.socket?.remoteAddress || '') ||
    req.ip ||
    'unknown',
});

function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

async function roomConflict(roomId: string, venueId: string, start: Date, end: Date, excludeHoldId?: string) {
  const reservation = await Reservation.findOne({
    roomId,
    status: { $in: ['pending', 'confirmed', 'checked_in', 'PENDING', 'CONFIRMED'] },
    startAt: { $lt: end },
    endAt: { $gt: start },
  }).lean();
  if (reservation) return { reason: 'reserved' as const };

  const holdFilter: Record<string, unknown> = {
    status: 'active',
    expiresAt: { $gt: new Date() },
    startsAt: { $lt: end },
    endsAt: { $gt: start },
    reservableUnitId: roomId,
  };
  if (excludeHoldId) holdFilter._id = { $ne: excludeHoldId };
  const hold = await ReservationHold.findOne(holdFilter).lean();
  if (hold) return { reason: 'held' as const };

  const block = await RoomBlock.findOne({
    isActive: true,
    startsAt: { $lt: end },
    endsAt: { $gt: start },
    $or: [
      { scope: 'room', roomId },
      { scope: 'venue', venueId },
    ],
  }).lean();
  if (block) return { reason: 'blocked' as const };

  return null;
}

/* ------------------------------------------------------------------ */
/* POST /hotel-checkout/hold — create a 15-min hold on a room          */
/* ------------------------------------------------------------------ */
router.post('/hold', authenticate, checkoutLimiter, async (req: AuthRequest, res) => {
  try {
    const { venueId, roomId, checkIn, checkOut, adults = 2, children = 0, rooms: roomsCount = 1 } = req.body ?? {};

    if (!venueId || !roomId || !checkIn || !checkOut) {
      return sendError(res, { message: 'Champs requis: venueId, roomId, checkIn, checkOut.', statusCode: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(venueId) || !mongoose.Types.ObjectId.isValid(roomId)) {
      return sendError(res, { message: 'Identifiants invalides.', statusCode: 400 });
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return sendError(res, { message: "Dates invalides. La date d'arrivée doit précéder la date de départ.", statusCode: 400 });
    }
    if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
      return sendError(res, { message: 'La date d\'arrivée est dans le passé.', statusCode: 400 });
    }

    const room = await Room.findOne({ _id: roomId, venueId, isActive: true, isReservable: true }).lean();
    if (!room) return sendError(res, { message: 'Chambre non trouvée ou non réservable.', statusCode: 404 });

    const totalGuests = Number(adults) + Number(children || 0);
    const capacity = room.capacityAdults ?? room.capacity ?? 2;
    if (totalGuests > capacity) {
      return sendError(res, {
        message: `Capacité dépassée. Cette chambre accueille ${capacity} personnes maximum.`,
        statusCode: 400,
      });
    }

    const conflict = await roomConflict(roomId, venueId, start, end);
    if (conflict) {
      const messages = {
        reserved: 'Cette chambre n\'est plus disponible pour ces dates.',
        held: 'Une autre réservation est en cours pour ces dates. Réessayez dans quelques minutes.',
        blocked: 'Cette chambre n\'est pas disponible pour ces dates (maintenance ou événement privé).',
      } as const;
      return sendError(res, { message: messages[conflict.reason], statusCode: 409 });
    }

    const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);
    const dateKey = start.toISOString().slice(0, 10);

    const hold = await ReservationHold.create({
      venueId,
      reservableUnitId: roomId,
      userId: req.userId,
      dateKey,
      startsAt: start,
      endsAt: end,
      peopleCount: totalGuests,
      status: 'active',
      expiresAt,
    });

    return sendSuccess(res, {
      data: {
        _id: hold._id,
        expiresAt: hold.expiresAt,
        ttlMinutes: HOLD_TTL_MINUTES,
        nights: nightsBetween(start, end),
        pricePerNight: room.pricePerNight,
      },
      statusCode: 201,
    });
  } catch (err) {
    logger.error('hotel-checkout/hold failed', err);
    return sendError(res, { message: 'Impossible de réserver temporairement la chambre.', statusCode: 500 });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /hotel-checkout/hold/:id — release hold                     */
/* ------------------------------------------------------------------ */
router.delete('/hold/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const hold = await ReservationHold.findById(req.params.id);
    if (!hold) return sendError(res, { message: 'Hold introuvable.', statusCode: 404 });
    if (hold.userId && req.userId && String(hold.userId) !== String(req.userId)) {
      return sendError(res, { message: 'Accès refusé.', statusCode: 403 });
    }
    if (hold.status === 'active') {
      hold.status = 'released';
      await hold.save();
    }
    return sendSuccess(res, { data: { released: true } });
  } catch (err) {
    return sendError(res, { message: 'Échec de la libération du hold.', statusCode: 500 });
  }
});

/* ------------------------------------------------------------------ */
/* POST /hotel-checkout/confirm — finalize reservation from hold       */
/* ------------------------------------------------------------------ */
router.post('/confirm', authenticate, checkoutLimiter, async (req: AuthRequest, res) => {
  try {
    const {
      holdId,
      paymentOption = 'pay_at_hotel',
      promoCode,
      guest = {},
      extras = [],
      arrivalTime,
      acceptedHotelPolicy,
      acceptedPlatformTerms,
      specialRequest,
      needBabyBed,
      needExtraBed,
      accessibilityRequest,
    } = req.body ?? {};

    if (!holdId) return sendError(res, { message: 'holdId requis.', statusCode: 400 });
    if (!acceptedHotelPolicy || !acceptedPlatformTerms) {
      return sendError(res, { message: 'Vous devez accepter les politiques et les conditions.', statusCode: 400 });
    }

    const allowedPaymentOptions: PaymentOption[] = ['online', 'deposit', 'pay_at_hotel'];
    if (!allowedPaymentOptions.includes(paymentOption)) {
      return sendError(res, { message: 'Option de paiement invalide.', statusCode: 400 });
    }

    const hold = await ReservationHold.findById(holdId);
    if (!hold) return sendError(res, { message: 'Réservation temporaire introuvable.', statusCode: 404 });
    if (hold.userId && req.userId && String(hold.userId) !== String(req.userId)) {
      return sendError(res, { message: 'Accès refusé.', statusCode: 403 });
    }
    if (hold.status !== 'active' || hold.expiresAt < new Date()) {
      return sendError(res, { message: 'Votre réservation temporaire a expiré. Veuillez recommencer.', statusCode: 410 });
    }

    const roomId = hold.reservableUnitId;
    if (!roomId) return sendError(res, { message: 'Hold sans chambre associée.', statusCode: 400 });

    const room = await Room.findById(roomId).lean();
    const venue = await Venue.findById(hold.venueId).lean();
    if (!room || !venue) return sendError(res, { message: 'Chambre ou hôtel introuvable.', statusCode: 404 });

    // Re-check conflict, excluding the current hold
    const conflict = await roomConflict(String(roomId), String(hold.venueId), hold.startsAt, hold.endsAt, String(hold._id));
    if (conflict) {
      return sendError(res, { message: 'Cette chambre n\'est plus disponible.', statusCode: 409 });
    }

    const nights = nightsBetween(hold.startsAt, hold.endsAt);
    const guestsTotal = hold.peopleCount || 1;
    const subtotal = room.pricePerNight * nights;
    const extrasArr: IReservationExtra[] = Array.isArray(extras)
      ? extras.filter((e) => e && typeof e.key === 'string' && typeof e.unitPrice === 'number').map((e: any) => ({
          key: String(e.key),
          name: String(e.name ?? e.key),
          unitPrice: Number(e.unitPrice),
          quantity: Math.max(1, Math.floor(Number(e.quantity ?? 1))),
          unit: ['once', 'per_night', 'per_person'].includes(e.unit) ? e.unit : 'once',
        }))
      : [];
    const extrasTotal = extrasArr.reduce((sum, e) => {
      const multiplier = e.unit === 'per_night' ? nights : e.unit === 'per_person' ? guestsTotal : 1;
      return sum + e.unitPrice * e.quantity * multiplier;
    }, 0);
    const discount = 0;
    const taxes = Math.round(subtotal * TAX_RATE);
    const total = subtotal + taxes + extrasTotal - discount;

    const amountPaid = paymentOption === 'online' ? total : paymentOption === 'deposit' ? Math.round(total * 0.3) : 0;
    const remainingAmount = total - amountPaid;
    const paymentStatus = paymentOption === 'online' ? 'paid' : paymentOption === 'deposit' ? 'pending' : 'unpaid';
    const cancellationDeadline = new Date(hold.startsAt.getTime() - 24 * 60 * 60 * 1000);

    const reservationCode = `MR-${new Date().getFullYear()}-${generateConfirmationCode(6)}`;
    const confirmationCode = generateConfirmationCode(8);

    // Get user info for fallbacks
    const dbUser = req.userId ? await User.findById(req.userId).lean() : null;
    const [fallbackFirst, ...fallbackRest] = (dbUser?.fullName ?? '').split(' ');
    const fallbackLast = fallbackRest.join(' ') || fallbackFirst || '';

    const reservation = await Reservation.create({
      reservationCode,
      confirmationCode,
      userId: req.userId,
      venueId: venue._id,
      roomId: room._id,
      bookingType: 'ROOM',
      reservableType: 'room',
      startAt: hold.startsAt,
      endAt: hold.endsAt,
      reservationDate: hold.startsAt,
      partySize: guestsTotal,
      peopleCount: guestsTotal,
      adults: guest.adults ?? guestsTotal,
      children: guest.children ?? 0,
      childrenAges: guest.childrenAges ?? [],
      roomsCount: 1,
      guestFirstName: guest.firstName ?? fallbackFirst ?? undefined,
      guestLastName: guest.lastName ?? fallbackLast ?? undefined,
      guestPhone: guest.phone ?? dbUser?.phone ?? undefined,
      customerFirstName: guest.bookerFirstName ?? fallbackFirst ?? undefined,
      customerLastName: guest.bookerLastName ?? fallbackLast ?? undefined,
      customerPhone: guest.bookerPhone ?? dbUser?.phone ?? undefined,
      customerEmail: guest.email ?? dbUser?.email ?? undefined,
      guestCountry: guest.country ?? undefined,
      guestCity: guest.city ?? undefined,
      idNumber: guest.idNumber ?? undefined,
      nationality: guest.nationality ?? undefined,
      dateOfBirth: guest.dateOfBirth ? new Date(guest.dateOfBirth) : undefined,
      arrivalTime,
      specialRequest,
      needBabyBed: !!needBabyBed,
      needExtraBed: !!needExtraBed,
      accessibilityRequest,
      acceptedHotelPolicy: true,
      acceptedPlatformTerms: true,
      nights,
      extras: extrasArr,
      extrasTotal,
      priceBreakdown: {
        subtotal,
        taxes,
        discount,
        extrasTotal,
        total,
        currency: 'TND',
      },
      totalPrice: total,
      paymentOption,
      paymentStatus,
      paymentMethod: paymentOption === 'pay_at_hotel' ? 'cash' : 'online',
      amountPaid,
      remainingAmount,
      cancellationDeadline,
      status: paymentOption === 'online' ? 'confirmed' : 'pending',
      checkInStatus: 'not_checked_in',
      source: 'web',
      holdId: hold._id,
    });

    // Build QR payload — verification URL with confirmation code
    const qrPayload = JSON.stringify({
      ref: reservation.reservationCode,
      code: reservation.confirmationCode,
      url: `${FRONTEND_URL}/reservation/${reservation._id}/verify?code=${reservation.confirmationCode}`,
    });
    try {
      const qrDataUrl = await generateQRDataURL(qrPayload, { width: 320, margin: 1 });
      reservation.qrCodeData = qrPayload;
      reservation.qrCodeImageUrl = qrDataUrl;
      await reservation.save();
    } catch (err) {
      logger.warn('QR generation failed; reservation still created');
    }

    // Convert hold
    hold.status = 'converted';
    await hold.save();

    // ── Fire-and-forget notifications ─────────────────────────────────
    const paymentLabelMap: Record<string, string> = {
      online: 'Payé en ligne',
      deposit: 'Acompte versé',
      pay_at_hotel: 'À régler à l\'hôtel',
    };
    const fmtDate = (d: Date) =>
      new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const money = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DT`;
    const guestName = `${reservation.guestFirstName ?? ''} ${reservation.guestLastName ?? ''}`.trim() || 'Client';
    const roomName = room.name ?? room.roomType ?? 'Chambre';
    const ticketUrl = `${FRONTEND_URL}/reservation/${reservation._id}/confirmation`;

    const params = {
      guestName,
      hotelName: venue.name ?? 'Hôtel',
      roomName,
      reservationCode: reservation.reservationCode ?? reservation.confirmationCode,
      checkIn: fmtDate(reservation.startAt),
      checkOut: fmtDate(reservation.endAt),
      nights,
      guests: guestsTotal,
      total: money(total),
      paid: money(amountPaid),
      remaining: money(remainingAmount),
      paymentLabel: paymentLabelMap[paymentOption] ?? paymentOption,
      ticketUrl,
      hotelAddress: [venue.address, venue.city].filter(Boolean).join(', ') || undefined,
      hotelPhone: venue.phone,
    };

    // Client confirmation
    const clientEmail = reservation.customerEmail ?? dbUser?.email;
    if (clientEmail) {
      const tpl = createHotelClientConfirmationTemplate(params);
      sendEmail({ to: clientEmail, subject: tpl.subject, html: tpl.html, text: tpl.text }).catch((err) =>
        logger.warn('client confirmation email failed: ' + (err instanceof Error ? err.message : String(err)))
      );
    }

    // Owner alert
    if (venue.ownerId) {
      const owner = await User.findById(venue.ownerId).lean();
      if (owner?.email) {
        const tpl = createHotelOwnerNewReservationTemplate({ ...params, ownerName: owner.fullName ?? 'Partenaire' });
        sendEmail({ to: owner.email, subject: tpl.subject, html: tpl.html, text: tpl.text }).catch((err) =>
          logger.warn('owner alert email failed: ' + (err instanceof Error ? err.message : String(err)))
        );
      }
    }

    return sendSuccess(res, {
      data: {
        _id: reservation._id,
        reservationCode: reservation.reservationCode,
        confirmationCode: reservation.confirmationCode,
        status: reservation.status,
        paymentStatus: reservation.paymentStatus,
      },
      statusCode: 201,
    });
  } catch (err) {
    logger.error('hotel-checkout/confirm failed', err);
    return sendError(res, { message: 'Échec de la confirmation de la réservation.', statusCode: 500 });
  }
});

/* ------------------------------------------------------------------ */
/* GET /hotel-checkout/ticket/:id — full ticket payload (auth)         */
/* ------------------------------------------------------------------ */
router.get('/ticket/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('venueId', 'name slug city address phone email coverImage')
      .populate('roomId', 'name roomNumber roomType pricePerNight coverImage gallery capacity capacityAdults bedType surface amenities')
      .lean();
    if (!reservation) return sendError(res, { message: 'Réservation introuvable.', statusCode: 404 });
    if (req.userId && String(reservation.userId) !== String(req.userId) && req.userRole !== 'ADMIN') {
      return sendError(res, { message: 'Accès refusé.', statusCode: 403 });
    }
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    return sendError(res, { message: 'Erreur de récupération du ticket.', statusCode: 500 });
  }
});

/* ------------------------------------------------------------------ */
/* GET /hotel-checkout/calendar/:id.ics — ICS calendar download        */
/* ------------------------------------------------------------------ */
router.get('/calendar/:id.ics', async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('venueId', 'name address city phone')
      .lean();
    if (!reservation) return res.status(404).send('Not found');

    const fmtICS = (d: Date) =>
      new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const venue = reservation.venueId as { name?: string; address?: string; city?: string; phone?: string } | undefined;
    const summary = `Séjour à ${venue?.name ?? 'l\'hôtel'} — ${reservation.reservationCode}`;
    const description = [
      `Réservation: ${reservation.reservationCode}`,
      `Code de confirmation: ${reservation.confirmationCode}`,
      `Statut: ${reservation.status}`,
      reservation.guestFirstName ? `Client: ${reservation.guestFirstName} ${reservation.guestLastName ?? ''}` : '',
      venue?.phone ? `Téléphone hôtel: ${venue.phone}` : '',
    ].filter(Boolean).join('\\n');

    const location = venue ? [venue.address, venue.city].filter(Boolean).join(', ') : '';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ma Reservation//Hotel Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${reservation._id}@mareservation`,
      `DTSTAMP:${fmtICS(new Date())}`,
      `DTSTART:${fmtICS(reservation.startAt)}`,
      `DTEND:${fmtICS(reservation.endAt)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      location && `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservation-${reservation.reservationCode}.ics"`);
    return res.send(ics);
  } catch (err) {
    return res.status(500).send('Erreur de génération du calendrier.');
  }
});

export default router;

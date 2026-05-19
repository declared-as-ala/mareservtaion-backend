import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest, requireEstablishmentOwner } from '../middleware/auth';
import { Venue } from '../models/Venue';
import { Room } from '../models/Room';
import { Reservation } from '../models/Reservation';
import { RoomBlock, type RoomBlockReason } from '../models/RoomBlock';
import { ReservationHold } from '../models/ReservationHold';
import { User } from '../models/User';
import { generateConfirmationCode } from '../utils/confirmationCode';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { logger } from '../config/logger';

const router = Router();

/* ─── helpers ──────────────────────────────────────────────────────── */

async function assertVenueOwnedBy(venueId: string, req: AuthRequest) {
  if (!mongoose.Types.ObjectId.isValid(venueId)) return null;
  const venue = await Venue.findById(venueId).lean();
  if (!venue) return null;
  if (req.userRole === 'ADMIN') return venue;
  if (String(venue.ownerId) !== String(req.userId)) return null;
  return venue;
}

function hasOverlap(startsAt: Date, endsAt: Date) {
  return {
    $or: [{ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }],
  };
}

const ACTIVE_RES_STATUSES = ['pending', 'confirmed', 'checked_in', 'PENDING', 'CONFIRMED'];

/* ─── BLOCKS ──────────────────────────────────────────────────────── */

// GET /owner-hotel/venues/:venueId/blocks?from=&to=&roomId=
router.get('/venues/:venueId/blocks', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  const venue = await assertVenueOwnedBy(req.params.venueId, req);
  if (!venue) return sendError(res, { message: 'Hôtel introuvable ou non autorisé.', statusCode: 404 });

  const { from, to, roomId } = req.query;
  const filter: Record<string, unknown> = { venueId: venue._id, isActive: true };
  if (roomId && mongoose.Types.ObjectId.isValid(String(roomId))) filter.roomId = roomId;
  if (from && to) {
    const start = new Date(String(from));
    const end = new Date(String(to));
    filter.startsAt = { $lt: end };
    filter.endsAt = { $gt: start };
  }
  const blocks = await RoomBlock.find(filter).sort({ startsAt: 1 }).lean();
  return sendSuccess(res, { data: blocks });
});

// POST /owner-hotel/venues/:venueId/blocks
router.post('/venues/:venueId/blocks', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venue = await assertVenueOwnedBy(req.params.venueId, req);
    if (!venue) return sendError(res, { message: 'Hôtel introuvable ou non autorisé.', statusCode: 404 });

    const {
      roomId,
      scope = 'room',
      startsAt,
      endsAt,
      reason = 'owner_hold',
      note,
      visibleToClient = false,
      autoReopen = true,
    } = req.body ?? {};

    if (!startsAt || !endsAt) {
      return sendError(res, { message: 'startsAt et endsAt requis.', statusCode: 400 });
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return sendError(res, { message: 'Plage de dates invalide.', statusCode: 400 });
    }
    if (scope === 'room') {
      if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
        return sendError(res, { message: 'roomId requis pour un blocage chambre.', statusCode: 400 });
      }
      const room = await Room.findOne({ _id: roomId, venueId: venue._id }).lean();
      if (!room) return sendError(res, { message: 'Chambre introuvable dans cet hôtel.', statusCode: 404 });
    }

    // Refuse if active reservations conflict
    const reservationFilter: Record<string, unknown> = {
      venueId: venue._id,
      status: { $in: ACTIVE_RES_STATUSES },
      ...hasOverlap(start, end),
    };
    if (scope === 'room') reservationFilter.roomId = roomId;
    const conflicting = await Reservation.findOne(reservationFilter).lean();
    if (conflicting) {
      return sendError(res, {
        message: 'Des réservations confirmées existent sur cette plage. Annulez-les d\'abord ou réduisez la plage.',
        statusCode: 409,
      });
    }

    const block = await RoomBlock.create({
      venueId: venue._id,
      roomId: scope === 'room' ? roomId : undefined,
      scope,
      startsAt: start,
      endsAt: end,
      reason: reason as RoomBlockReason,
      note,
      visibleToClient: !!visibleToClient,
      autoReopen: !!autoReopen,
      createdBy: req.userId,
      createdByRole: req.userRole === 'ADMIN' ? 'ADMIN' : 'OWNER',
      isActive: true,
    });

    return sendSuccess(res, { data: block, statusCode: 201 });
  } catch (err) {
    logger.error('owner-hotel/blocks create failed', err);
    return sendError(res, { message: 'Échec de la création du blocage.', statusCode: 500 });
  }
});

// PATCH /owner-hotel/blocks/:id
router.patch('/blocks/:id', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const block = await RoomBlock.findById(req.params.id);
    if (!block) return sendError(res, { message: 'Blocage introuvable.', statusCode: 404 });
    const venue = await assertVenueOwnedBy(String(block.venueId), req);
    if (!venue) return sendError(res, { message: 'Accès refusé.', statusCode: 403 });

    const updatable: Array<keyof typeof block> = ['startsAt', 'endsAt', 'reason', 'note', 'visibleToClient', 'autoReopen', 'isActive'];
    const before = block.toObject();
    for (const key of updatable) {
      if (req.body[key] !== undefined) {
        if (key === 'startsAt' || key === 'endsAt') {
          (block as any)[key] = new Date(req.body[key]);
        } else {
          (block as any)[key] = req.body[key];
        }
      }
    }
    if (block.startsAt >= block.endsAt) {
      return sendError(res, { message: 'Plage de dates invalide.', statusCode: 400 });
    }
    await block.save();
    void before;
    return sendSuccess(res, { data: block });
  } catch (err) {
    logger.error('owner-hotel/blocks update failed', err);
    return sendError(res, { message: 'Échec de la mise à jour du blocage.', statusCode: 500 });
  }
});

// DELETE /owner-hotel/blocks/:id
router.delete('/blocks/:id', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  const block = await RoomBlock.findById(req.params.id);
  if (!block) return sendError(res, { message: 'Blocage introuvable.', statusCode: 404 });
  const venue = await assertVenueOwnedBy(String(block.venueId), req);
  if (!venue) return sendError(res, { message: 'Accès refusé.', statusCode: 403 });
  block.isActive = false;
  await block.save();
  return sendSuccess(res, { data: { released: true } });
});

/* ─── MANUAL RESERVATION ──────────────────────────────────────────── */

// POST /owner-hotel/venues/:venueId/reservations/manual
router.post('/venues/:venueId/reservations/manual', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venue = await assertVenueOwnedBy(req.params.venueId, req);
    if (!venue) return sendError(res, { message: 'Hôtel introuvable ou non autorisé.', statusCode: 404 });

    const {
      roomId,
      checkIn,
      checkOut,
      adults = 2,
      children = 0,
      firstName,
      lastName,
      phone,
      email,
      price,
      paymentStatus = 'unpaid',
      depositAmount = 0,
      source = 'phone',
      notes,
    } = req.body ?? {};

    if (!roomId || !checkIn || !checkOut || !firstName || !lastName || !phone) {
      return sendError(res, { message: 'Champs requis: roomId, checkIn, checkOut, firstName, lastName, phone.', statusCode: 400 });
    }
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return sendError(res, { message: 'Dates invalides.', statusCode: 400 });
    }
    if (!['phone', 'walk_in', 'whatsapp', 'agency', 'other'].includes(source)) {
      return sendError(res, { message: 'Source invalide.', statusCode: 400 });
    }

    const room = await Room.findOne({ _id: roomId, venueId: venue._id }).lean();
    if (!room) return sendError(res, { message: 'Chambre introuvable.', statusCode: 404 });

    // Conflict check against reservations + holds + blocks
    const reservationConflict = await Reservation.findOne({
      roomId,
      status: { $in: ACTIVE_RES_STATUSES },
      ...hasOverlap(start, end),
    }).lean();
    if (reservationConflict) {
      return sendError(res, { message: 'Une réservation existe déjà sur cette plage.', statusCode: 409 });
    }
    const holdConflict = await ReservationHold.findOne({
      reservableUnitId: roomId,
      status: 'active',
      expiresAt: { $gt: new Date() },
      ...hasOverlap(start, end),
    }).lean();
    if (holdConflict) {
      return sendError(res, { message: 'Un client est en train de réserver cette chambre. Réessayez dans 15 min.', statusCode: 409 });
    }
    const blockConflict = await RoomBlock.findOne({
      isActive: true,
      ...hasOverlap(start, end),
      $or: [{ scope: 'room', roomId }, { scope: 'venue', venueId: venue._id }],
    }).lean();
    if (blockConflict) {
      return sendError(res, { message: 'La chambre est bloquée sur cette plage.', statusCode: 409 });
    }

    const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    const total = Number.isFinite(Number(price)) ? Number(price) : room.pricePerNight * nights;
    const amountPaid = Math.max(0, Math.min(total, Number(depositAmount) || 0));

    const reservationCode = `MR-${new Date().getFullYear()}-${generateConfirmationCode(6)}`;
    const confirmationCode = generateConfirmationCode(8);

    // Find or create a placeholder user for offline guests (uses owner as fallback userId)
    const placeholderUserId = req.userId;

    const reservation = await Reservation.create({
      reservationCode,
      confirmationCode,
      userId: placeholderUserId,
      venueId: venue._id,
      roomId,
      bookingType: 'ROOM',
      reservableType: 'room',
      startAt: start,
      endAt: end,
      reservationDate: start,
      nights,
      adults: Number(adults),
      children: Number(children || 0),
      partySize: Number(adults) + Number(children || 0),
      peopleCount: Number(adults) + Number(children || 0),
      guestFirstName: firstName,
      guestLastName: lastName,
      guestPhone: phone,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerPhone: phone,
      customerEmail: email,
      totalPrice: total,
      priceBreakdown: { subtotal: total, total, currency: 'TND' },
      paymentStatus,
      paymentMethod: 'cash',
      amountPaid,
      remainingAmount: total - amountPaid,
      status: 'confirmed',
      checkInStatus: 'not_checked_in',
      source,
      notes,
      acceptedHotelPolicy: true,
      acceptedPlatformTerms: true,
    });

    return sendSuccess(res, { data: reservation, statusCode: 201 });
  } catch (err) {
    logger.error('owner-hotel/manual-reservation failed', err);
    return sendError(res, { message: 'Échec de la création de la réservation.', statusCode: 500 });
  }
});

/* ─── ACCEPT / REJECT (manual approval mode) ──────────────────────── */

async function findOwnedReservation(id: string, req: AuthRequest) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const reservation = await Reservation.findById(id);
  if (!reservation) return null;
  const venue = await assertVenueOwnedBy(String(reservation.venueId), req);
  if (!venue) return null;
  return reservation;
}

// POST /owner-hotel/reservations/:id/accept
router.post('/reservations/:id/accept', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    const status = String(reservation.status).toLowerCase();
    if (status !== 'pending') {
      return sendError(res, { message: `Réservation déjà ${status}. Action impossible.`, statusCode: 409 });
    }
    reservation.status = 'confirmed';
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/accept failed', err);
    return sendError(res, { message: 'Échec de l\'acceptation.', statusCode: 500 });
  }
});

// POST /owner-hotel/reservations/:id/reject  body: { reason?: string }
router.post('/reservations/:id/reject', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    const status = String(reservation.status).toLowerCase();
    if (status !== 'pending') {
      return sendError(res, { message: `Réservation déjà ${status}. Action impossible.`, statusCode: 409 });
    }
    reservation.status = 'cancelled';
    reservation.paymentStatus = 'refunded';
    const note = typeof req.body?.reason === 'string' ? `Refusée par l'hôtel — ${req.body.reason}` : 'Refusée par l\'hôtel';
    reservation.notes = reservation.notes ? `${reservation.notes}\n${note}` : note;
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/reject failed', err);
    return sendError(res, { message: 'Échec du refus.', statusCode: 500 });
  }
});

// GET /owner-hotel/reservations/pending — pending requests across owner's venues
router.get('/reservations/pending', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venueFilter = req.userRole === 'ADMIN' ? {} : { ownerId: req.userId };
    const venues = await Venue.find(venueFilter).select('_id').lean();
    const venueIds = venues.map((v) => v._id);
    const reservations = await Reservation.find({
      venueId: { $in: venueIds },
      bookingType: 'ROOM',
      status: { $in: ['pending', 'PENDING'] },
    })
      .populate('venueId', 'name slug city')
      .populate('roomId', 'name roomNumber roomType')
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, { data: reservations });
  } catch (err) {
    logger.error('owner-hotel/pending list failed', err);
    return sendError(res, { message: 'Erreur de chargement.', statusCode: 500 });
  }
});

/* ─── RESERVATIONS LIST (filterable, populated) ───────────────────── */

// GET /owner-hotel/reservations?venueId&status&from&to&q&limit
router.get('/reservations', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venueFilter = req.userRole === 'ADMIN' ? {} : { ownerId: req.userId };
    const venues = await Venue.find(venueFilter).select('_id').lean();
    const venueIds = venues.map((v) => v._id);

    const filter: Record<string, unknown> = { venueId: { $in: venueIds }, bookingType: 'ROOM' };

    if (req.query.venueId && mongoose.Types.ObjectId.isValid(String(req.query.venueId))) {
      filter.venueId = req.query.venueId;
    }
    if (req.query.status && req.query.status !== 'all') {
      const s = String(req.query.status).toLowerCase();
      filter.status = { $in: [s, s.toUpperCase()] };
    }
    if (req.query.from || req.query.to) {
      const cond: Record<string, Date> = {};
      if (req.query.from) cond.$gte = new Date(String(req.query.from));
      if (req.query.to) cond.$lte = new Date(String(req.query.to));
      filter.startAt = cond;
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        (filter as any).$or = [
          { reservationCode: re },
          { confirmationCode: re },
          { guestFirstName: re },
          { guestLastName: re },
          { customerEmail: re },
          { customerPhone: re },
        ];
      }
    }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const reservations = await Reservation.find(filter)
      .populate('venueId', 'name slug city')
      .populate('roomId', 'name roomNumber roomType pricePerNight')
      .sort({ startAt: -1 })
      .limit(limit)
      .lean();
    return sendSuccess(res, { data: reservations });
  } catch (err) {
    logger.error('owner-hotel/reservations list failed', err);
    return sendError(res, { message: 'Erreur de chargement.', statusCode: 500 });
  }
});

/* ─── ACTIONS (check-in / check-out / cancel) ─────────────────────── */

router.post('/reservations/:id/check-in', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    if (reservation.checkInStatus === 'checked_in') {
      return sendError(res, { message: 'Client déjà enregistré.', statusCode: 409 });
    }
    reservation.checkInStatus = 'checked_in';
    reservation.checkedInAt = new Date();
    reservation.checkedInBy = req.userId as any;
    reservation.status = 'checked_in';
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/check-in failed', err);
    return sendError(res, { message: 'Échec de l\'enregistrement.', statusCode: 500 });
  }
});

router.post('/reservations/:id/check-out', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    if (String(reservation.status).toLowerCase() === 'completed') {
      return sendError(res, { message: 'Séjour déjà clôturé.', statusCode: 409 });
    }
    reservation.status = 'completed';
    if (reservation.remainingAmount && reservation.remainingAmount > 0) {
      reservation.amountPaid = (reservation.amountPaid ?? 0) + reservation.remainingAmount;
      reservation.remainingAmount = 0;
      reservation.paymentStatus = 'paid';
    }
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/check-out failed', err);
    return sendError(res, { message: 'Échec de la clôture du séjour.', statusCode: 500 });
  }
});

router.post('/reservations/:id/cancel', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    const status = String(reservation.status).toLowerCase();
    if (['cancelled', 'completed', 'no_show'].includes(status)) {
      return sendError(res, { message: `Réservation déjà ${status}.`, statusCode: 409 });
    }
    reservation.status = 'cancelled';
    const note = typeof req.body?.reason === 'string' ? `Annulée par l'hôtel — ${req.body.reason}` : 'Annulée par l\'hôtel';
    reservation.notes = reservation.notes ? `${reservation.notes}\n${note}` : note;
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/cancel failed', err);
    return sendError(res, { message: 'Échec de l\'annulation.', statusCode: 500 });
  }
});

router.post('/reservations/:id/no-show', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    reservation.status = 'no_show';
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/no-show failed', err);
    return sendError(res, { message: 'Échec.', statusCode: 500 });
  }
});

/* ─── MUTATIONS (change dates / reassign room / note) ─────────────── */

router.post('/reservations/:id/change-dates', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    const status = String(reservation.status).toLowerCase();
    if (['cancelled', 'completed', 'no_show'].includes(status)) {
      return sendError(res, { message: `Réservation ${status}, dates non modifiables.`, statusCode: 409 });
    }
    const { startAt, endAt } = req.body ?? {};
    if (!startAt || !endAt) return sendError(res, { message: 'startAt et endAt requis.', statusCode: 400 });
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return sendError(res, { message: 'Plage de dates invalide.', statusCode: 400 });
    }

    // Conflict check (excluding this reservation)
    const conflict = await Reservation.findOne({
      _id: { $ne: reservation._id },
      roomId: reservation.roomId,
      status: { $in: ACTIVE_RES_STATUSES },
      ...hasOverlap(start, end),
    }).lean();
    if (conflict) return sendError(res, { message: 'La chambre est déjà réservée sur cette nouvelle plage.', statusCode: 409 });

    const blockConflict = await RoomBlock.findOne({
      isActive: true,
      ...hasOverlap(start, end),
      $or: [{ scope: 'room', roomId: reservation.roomId }, { scope: 'venue', venueId: reservation.venueId }],
    }).lean();
    if (blockConflict) return sendError(res, { message: 'La chambre est bloquée sur cette nouvelle plage.', statusCode: 409 });

    reservation.startAt = start;
    reservation.endAt = end;
    reservation.reservationDate = start;
    reservation.nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/change-dates failed', err);
    return sendError(res, { message: 'Échec de la modification des dates.', statusCode: 500 });
  }
});

router.post('/reservations/:id/reassign-room', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    const { roomId } = req.body ?? {};
    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
      return sendError(res, { message: 'roomId requis.', statusCode: 400 });
    }
    const newRoom = await Room.findOne({ _id: roomId, venueId: reservation.venueId }).lean();
    if (!newRoom) return sendError(res, { message: 'Chambre introuvable dans cet hôtel.', statusCode: 404 });

    const conflict = await Reservation.findOne({
      _id: { $ne: reservation._id },
      roomId,
      status: { $in: ACTIVE_RES_STATUSES },
      ...hasOverlap(reservation.startAt, reservation.endAt),
    }).lean();
    if (conflict) return sendError(res, { message: 'La nouvelle chambre est déjà réservée.', statusCode: 409 });

    const blockConflict = await RoomBlock.findOne({
      isActive: true,
      ...hasOverlap(reservation.startAt, reservation.endAt),
      $or: [{ scope: 'room', roomId }, { scope: 'venue', venueId: reservation.venueId }],
    }).lean();
    if (blockConflict) return sendError(res, { message: 'La nouvelle chambre est bloquée sur cette plage.', statusCode: 409 });

    reservation.roomId = roomId;
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/reassign-room failed', err);
    return sendError(res, { message: 'Échec du changement de chambre.', statusCode: 500 });
  }
});

router.post('/reservations/:id/note', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const reservation = await findOwnedReservation(req.params.id, req);
    if (!reservation) return sendError(res, { message: 'Réservation introuvable ou non autorisée.', statusCode: 404 });
    const text = String(req.body?.text ?? '').trim();
    if (!text) return sendError(res, { message: 'Note vide.', statusCode: 400 });
    if (text.length > 1000) return sendError(res, { message: 'Note trop longue (max 1000 caractères).', statusCode: 400 });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const note = `[${stamp}] ${text}`;
    reservation.notes = reservation.notes ? `${reservation.notes}\n${note}` : note;
    await reservation.save();
    return sendSuccess(res, { data: reservation });
  } catch (err) {
    logger.error('owner-hotel/note failed', err);
    return sendError(res, { message: 'Échec de l\'ajout de la note.', statusCode: 500 });
  }
});

/* ─── DASHBOARD ────────────────────────────────────────────────────── */

router.get('/venues/:venueId/dashboard', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venue = await assertVenueOwnedBy(req.params.venueId, req);
    if (!venue) return sendError(res, { message: 'Hôtel introuvable ou non autorisé.', statusCode: 404 });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const next7 = new Date(todayStart.getTime() + 7 * 86_400_000);

    const [rooms, allReservations, monthReservations, pendingCount, activeBlocks] = await Promise.all([
      Room.find({ venueId: venue._id, isActive: true }).lean(),
      Reservation.find({ venueId: venue._id, bookingType: 'ROOM' })
        .populate('roomId', 'name roomNumber roomType')
        .sort({ startAt: 1 })
        .limit(500)
        .lean(),
      Reservation.find({
        venueId: venue._id,
        bookingType: 'ROOM',
        startAt: { $lt: monthEnd },
        endAt: { $gt: monthStart },
      }).lean(),
      Reservation.countDocuments({ venueId: venue._id, bookingType: 'ROOM', status: { $in: ['pending', 'PENDING'] } }),
      RoomBlock.find({ venueId: venue._id, isActive: true, endsAt: { $gt: now } }).lean(),
    ]);

    // Today buckets
    const isActive = (s: string) => ['confirmed', 'CONFIRMED', 'checked_in', 'completed'].includes(s);
    const checkinsToday = allReservations.filter(
      (r) => isActive(r.status) && new Date(r.startAt) >= todayStart && new Date(r.startAt) < todayEnd
    );
    const checkoutsToday = allReservations.filter(
      (r) => isActive(r.status) && new Date(r.endAt) >= todayStart && new Date(r.endAt) < todayEnd
    );
    const occupiedNow = allReservations.filter(
      (r) =>
        ['confirmed', 'CONFIRMED', 'checked_in'].includes(r.status) &&
        new Date(r.startAt) <= now &&
        new Date(r.endAt) > now
    );
    const upcomingNext7 = allReservations.filter(
      (r) => ['confirmed', 'CONFIRMED'].includes(r.status) && new Date(r.startAt) >= now && new Date(r.startAt) <= next7
    );

    // Monthly KPIs
    const monthlyConfirmed = monthReservations.filter((r) =>
      ['confirmed', 'CONFIRMED', 'checked_in', 'completed'].includes(r.status)
    );
    const monthlyRevenue = monthlyConfirmed.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
    const monthlyCount = monthReservations.length;
    const monthlyCancelled = monthReservations.filter((r) =>
      ['cancelled', 'CANCELLED', 'no_show', 'NO_SHOW'].includes(r.status)
    ).length;
    const cancellationRate = monthlyCount ? Math.round((monthlyCancelled / monthlyCount) * 100) : 0;

    // Occupancy = booked room-nights this month / (rooms × days in month)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const capacityNights = rooms.length * daysInMonth;
    const bookedNights = monthlyConfirmed.reduce((sum, r) => {
      const s = new Date(r.startAt).getTime();
      const e = new Date(r.endAt).getTime();
      const cs = Math.max(s, monthStart.getTime());
      const ce = Math.min(e, monthEnd.getTime());
      const nights = Math.max(0, Math.round((ce - cs) / 86_400_000));
      return sum + nights;
    }, 0);
    const occupancyRate = capacityNights ? Math.round((bookedNights / capacityNights) * 100) : 0;

    // Alerts
    const alerts: Array<{ severity: 'warning' | 'info' | 'critical'; code: string; message: string; href?: string; count?: number }> = [];
    const roomsMissingPhotos = rooms.filter((r) => !r.coverImage && !(r.gallery && r.gallery.length));
    if (roomsMissingPhotos.length) {
      alerts.push({
        severity: 'warning',
        code: 'rooms_missing_photos',
        message: `${roomsMissingPhotos.length} chambre${roomsMissingPhotos.length > 1 ? 's' : ''} sans photo`,
        count: roomsMissingPhotos.length,
        href: '/owner/my-establishment',
      });
    }
    const roomsMissingPrice = rooms.filter((r) => !r.pricePerNight || r.pricePerNight <= 0);
    if (roomsMissingPrice.length) {
      alerts.push({
        severity: 'critical',
        code: 'rooms_missing_price',
        message: `${roomsMissingPrice.length} chambre${roomsMissingPrice.length > 1 ? 's' : ''} sans tarif`,
        count: roomsMissingPrice.length,
        href: '/owner/my-establishment',
      });
    }
    if (pendingCount > 0) {
      alerts.push({
        severity: 'critical',
        code: 'pending_requests',
        message: `${pendingCount} demande${pendingCount > 1 ? 's' : ''} en attente d'acceptation`,
        count: pendingCount,
        href: '/owner/pending',
      });
    }
    if (checkinsToday.length > 0) {
      alerts.push({
        severity: 'info',
        code: 'checkins_today',
        message: `${checkinsToday.length} arrivée${checkinsToday.length > 1 ? 's' : ''} prévue${checkinsToday.length > 1 ? 's' : ''} aujourd'hui`,
        count: checkinsToday.length,
      });
    }

    return sendSuccess(res, {
      data: {
        venue: { _id: venue._id, name: venue.name, slug: venue.slug, city: venue.city, coverImage: venue.coverImage },
        kpis: {
          reservationsToday: checkinsToday.length + checkoutsToday.length,
          checkinsToday: checkinsToday.length,
          checkoutsToday: checkoutsToday.length,
          occupiedNow: occupiedNow.length,
          availableNow: Math.max(0, rooms.length - occupiedNow.length),
          totalRooms: rooms.length,
          pending: pendingCount,
          monthlyRevenue,
          monthlyCount,
          occupancyRate,
          cancellationRate,
          activeBlocks: activeBlocks.length,
        },
        checkinsToday,
        checkoutsToday,
        upcomingNext7,
        alerts,
      },
    });
  } catch (err) {
    logger.error('owner-hotel/dashboard failed', err);
    return sendError(res, { message: 'Erreur de chargement du tableau de bord.', statusCode: 500 });
  }
});

export default router;

import { Router } from 'express';
import { authenticate, AuthRequest, requireEstablishmentOwner } from '../middleware/auth';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';
import { logAudit } from '../utils/audit.util';

const router = Router();

async function resolveOwnedVenues(req: AuthRequest) {
  if (!req.userId) return [];
  if (req.userRole === 'ADMIN') return Venue.find({}).sort({ createdAt: -1 }).lean();
  return Venue.find({ ownerId: req.userId }).sort({ createdAt: -1 }).lean();
}

router.get('/dashboard', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venues = await resolveOwnedVenues(req);
    if (!venues.length) {
      return res.json({
        venues: [],
        stats: { totalVenues: 0, totalReservations: 0, upcomingReservations: 0, confirmedReservations: 0 },
      });
    }

    const venueIds = venues.map((venue: any) => venue._id);
    const reservations = await Reservation.find({ venueId: { $in: venueIds } })
      .populate('venueId', 'name city')
      .sort({ startAt: -1 })
      .limit(100)
      .lean();

    const now = new Date();
    res.json({
      venues,
      stats: {
        totalVenues: venues.length,
        totalReservations: reservations.length,
        upcomingReservations: reservations.filter((item: any) => new Date(item.startAt) >= now).length,
        confirmedReservations: reservations.filter((item: any) => ['confirmed', 'CONFIRMED'].includes(item.status)).length,
      },
      recentReservations: reservations.slice(0, 12),
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord proprietaire.' });
  }
});

router.get('/venues', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venues = await resolveOwnedVenues(req);
    res.json(venues);
  } catch (error) {
    console.error('Owner venues error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des lieux proprietaires.' });
  }
});

router.get('/reservations', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venues = await resolveOwnedVenues(req);
    const venueIds = venues.map((venue: any) => venue._id);
    if (!venueIds.length) return res.json([]);

    const reservations = await Reservation.find({ venueId: { $in: venueIds } })
      .populate('venueId', 'name city')
      .populate('userId', 'fullName email')
      .sort({ startAt: -1 })
      .lean();
    res.json(reservations);
  } catch (error) {
    console.error('Owner reservations error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des reservations proprietaire.' });
  }
});

router.patch('/reservations/:id/verify-qr', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifie.' });
    const reservation = await Reservation.findById(req.params.id).populate('venueId', 'ownerId');
    if (!reservation) return res.status(404).json({ error: 'Reservation introuvable.' });
    const ownerId = String((reservation.venueId as any)?.ownerId || '');
    if (req.userRole !== 'ADMIN' && ownerId !== req.userId) return res.status(403).json({ error: 'Acces refuse.' });
    if (reservation.checkInStatus === 'checked_in') return res.status(400).json({ error: 'Deja verifiee.' });
    reservation.checkInStatus = 'checked_in';
    reservation.checkedInAt = new Date();
    reservation.checkedInBy = req.userId as any;
    reservation.status = 'checked_in';
    await reservation.save();
    await logAudit(req, {
      action: 'RESERVATION_CHECKED_IN',
      userId: req.userId as any,
      entityType: 'reservation',
      entityId: reservation._id as any,
      details: { flow: 'owner_qr_verify' },
    });
    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Owner QR verify error:', error);
    res.status(500).json({ error: 'Erreur verification QR.' });
  }
});

export default router;

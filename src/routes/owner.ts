import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';

const router = Router();

function isOwnerRole(role?: string) {
  return role === 'VENUE_OWNER' || role === 'ORGANIZER' || role === 'ADMIN';
}

async function resolveOwnedVenues(req: AuthRequest) {
  if (!req.userId) return [];
  const user = await User.findById(req.userId).select('email role').lean();
  if (!user || !isOwnerRole(user.role)) return [];

  const filter =
    user.role === 'ADMIN'
      ? {}
      : {
          $or: [
            { createdBy: req.userId },
            { updatedBy: req.userId },
            ...(user.email ? [{ email: user.email }] : []),
          ],
        };

  return Venue.find(filter).sort({ createdAt: -1 }).lean();
}

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
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
        confirmedReservations: reservations.filter((item: any) => item.status === 'CONFIRMED').length,
      },
      recentReservations: reservations.slice(0, 12),
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord proprietaire.' });
  }
});

router.get('/venues', authenticate, async (req: AuthRequest, res) => {
  try {
    const venues = await resolveOwnedVenues(req);
    res.json(venues);
  } catch (error) {
    console.error('Owner venues error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des lieux proprietaires.' });
  }
});

router.get('/reservations', authenticate, async (req: AuthRequest, res) => {
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

export default router;

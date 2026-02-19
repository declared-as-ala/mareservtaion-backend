import { Router, Request } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';
import { Event } from '../models/Event';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

function parseDays(query: string): number {
  const d = parseInt(query || '30', 10);
  return Math.min(Math.max(d, 1), 90);
}

// GET /api/admin/overview?range=7d|30d|90d
router.get('/overview', async (req: Request<unknown, unknown, unknown, { range?: string }>, res) => {
  try {
    const range = req.query.range || '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalUsers,
      newUsers7d,
      totalVenues,
      totalReservations,
      reservationsToday,
      reservations7d,
      cancelledLast30,
      confirmedLast30,
      revenue30d,
      activeVenuesCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekStart } }),
      Venue.countDocuments(),
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: todayStart, $lt: todayEnd } }),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: weekStart } }),
      Reservation.countDocuments({ status: 'CANCELLED', createdAt: { $gte: start } }),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, createdAt: { $gte: start } }),
      Reservation.aggregate([{ $match: { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } } }, { $group: { _id: null, sum: { $sum: '$totalPrice' } } }]).then((r) => r[0]?.sum ?? 0),
      Reservation.distinct('venueId', { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } }).then((ids) => ids.length),
    ]);

    const totalLast30 = cancelledLast30 + confirmedLast30;
    const cancellationRate = totalLast30 > 0 ? Math.round((cancelledLast30 / totalLast30) * 100) : 0;

    res.json({
      totalUsers,
      newUsers7d,
      totalVenues,
      totalReservations,
      reservationsToday,
      reservations7d,
      cancellationRate30d: cancellationRate,
      revenue30d,
      activeVenues30d: activeVenuesCount,
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques.' });
  }
});

// GET /api/admin/charts/reservations-daily?days=30
router.get('/charts/reservations-daily', async (req, res) => {
  try {
    const days = parseDays(req.query.days as string);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await Reservation.aggregate([
      { $match: { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(result.map((r) => ({ date: r._id, count: r.count })));
  } catch (error) {
    console.error('Error fetching reservations-daily:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/charts/revenue-daily?days=30
router.get('/charts/revenue-daily', async (req, res) => {
  try {
    const days = parseDays(req.query.days as string);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await Reservation.aggregate([
      { $match: { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startAt' } }, revenue: { $sum: '$totalPrice' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(result.map((r) => ({ date: r._id, revenue: r.revenue })));
  } catch (error) {
    console.error('Error fetching revenue-daily:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/charts/reservations-by-type?days=30
router.get('/charts/reservations-by-type', async (req, res) => {
  try {
    const days = parseDays(req.query.days as string);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await Reservation.aggregate([
      { $match: { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } } },
      { $group: { _id: '$bookingType', count: { $sum: 1 } } },
    ]);
    const map: Record<string, number> = { TABLE: 0, ROOM: 0, SEAT: 0 };
    result.forEach((r) => { map[r._id] = r.count; });
    res.json([
      { type: 'TABLE', count: map.TABLE, label: 'Table' },
      { type: 'ROOM', count: map.ROOM, label: 'Chambre' },
      { type: 'SEAT', count: map.SEAT, label: 'Siège' },
    ]);
  } catch (error) {
    console.error('Error fetching reservations-by-type:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/charts/reservations-by-city?days=30
router.get('/charts/reservations-by-city', async (req, res) => {
  try {
    const days = parseDays(req.query.days as string);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await Reservation.aggregate([
      { $match: { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } } },
      { $lookup: { from: 'venues', localField: 'venueId', foreignField: '_id', as: 'venue' } },
      { $unwind: '$venue' },
      { $group: { _id: '$venue.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json(result.map((r) => ({ city: r._id, count: r.count })));
  } catch (error) {
    console.error('Error fetching reservations-by-city:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/charts/top-venues?days=30&limit=5
router.get('/charts/top-venues', async (req, res) => {
  try {
    const days = parseDays(req.query.days as string);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 5, 1), 20);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await Reservation.aggregate([
      { $match: { status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: start } } },
      { $group: { _id: '$venueId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $lookup: { from: 'venues', localField: '_id', foreignField: '_id', as: 'venue' } },
      { $unwind: '$venue' },
      { $project: { venueName: '$venue.name', city: '$venue.city', count: 1 } },
    ]);
    res.json(result.map((r) => ({ venueName: r.venueName, city: r.city, count: r.count })));
  } catch (error) {
    console.error('Error fetching top-venues:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/charts/users-signups?days=30 (optional)
router.get('/charts/users-signups', async (req, res) => {
  try {
    const days = parseDays(req.query.days as string);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(result.map((r) => ({ date: r._id, count: r.count })));
  } catch (error) {
    console.error('Error fetching users-signups:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/users?page=1&q=
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();

    const filter: Record<string, unknown> = {};
    if (q) filter.email = new RegExp(q, 'i');

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u: any) => u._id);
    const resCounts = await Reservation.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    resCounts.forEach((r) => { countMap[r._id.toString()] = r.count; });

    const usersWithCount = users.map((u: any) => ({
      ...u,
      reservationsCount: countMap[u._id.toString()] ?? 0,
    }));

    res.json({ users: usersWithCount, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des utilisateurs.' });
  }
});

// GET /api/admin/venues?page=1&type=&city=&q=
router.get('/venues', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const type = req.query.type as string;
    const city = req.query.city as string;
    const q = String(req.query.q || '').trim();

    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (city) filter.city = city;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }

    const [venues, total] = await Promise.all([
      Venue.find(filter).sort({ rating: -1 }).skip(skip).limit(limit).lean(),
      Venue.countDocuments(filter),
    ]);

    const venueIds = venues.map((v: any) => v._id);
    const resCounts = await Reservation.aggregate([
      { $match: { venueId: { $in: venueIds }, status: { $in: ['PENDING', 'CONFIRMED'] } } },
      { $group: { _id: '$venueId', count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    resCounts.forEach((r) => { countMap[r._id.toString()] = r.count; });

    const venuesWithCount = venues.map((v: any) => ({
      ...v,
      reservationsCount: countMap[v._id.toString()] ?? 0,
    }));

    res.json({ venues: venuesWithCount, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des lieux.' });
  }
});

// GET /api/admin/reservations?page=1&status=&type=&city=&venueId=&from=&to=
router.get('/reservations', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const city = req.query.city as string;
    const venueId = req.query.venueId as string;
    const from = req.query.from as string;
    const to = req.query.to as string;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (type) filter.bookingType = type;
    if (venueId && mongoose.Types.ObjectId.isValid(venueId)) filter.venueId = venueId;
    if (from || to) {
      filter.startAt = {};
      if (from) (filter.startAt as any).$gte = new Date(from);
      if (to) (filter.startAt as any).$lte = new Date(to);
    }
    if (city) {
      const venueIdsInCity = await Venue.find({ city }).distinct('_id');
      filter.venueId = { $in: venueIdsInCity };
    }

    const [list, total] = await Promise.all([
      Reservation.find(filter)
        .populate('userId', 'fullName email')
        .populate('venueId', 'name city type')
        .populate('tableId', 'tableNumber price')
        .populate('roomId', 'roomNumber pricePerNight')
        .populate('seatId', 'seatNumber price')
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    res.json({ reservations: list, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des réservations.' });
  }
});

// GET /api/admin/events
router.get('/events', async (req, res) => {
  try {
    const events = await Event.find().populate('venueId', 'name city').sort({ startAt: 1 }).limit(100).lean();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des événements.' });
  }
});

// PATCH /api/admin/reservations/:id/cancel
router.patch('/reservations/:id/cancel', async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Réservation introuvable.' });
    if (r.status === 'CANCELLED') return res.status(400).json({ error: 'Déjà annulée.' });
    r.status = 'CANCELLED';
    await r.save();
    res.json({ message: 'Réservation annulée.', reservation: r });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation.' });
  }
});

// Legacy /stats for backward compatibility
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [totalUsers, totalVenues, reservationsToday, reservationsWeek, upcomingEvents] = await Promise.all([
      User.countDocuments(),
      Venue.countDocuments(),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: todayStart, $lt: todayEnd } }),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: weekStart } }),
      Event.countDocuments({ startAt: { $gte: now } }),
    ]);

    res.json({
      totalUsers,
      totalVenues,
      reservationsToday,
      reservationsWeek,
      upcomingEvents,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

export default router;

import { Router, Request } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';
import { Event } from '../models/Event';
import { VirtualTour } from '../models/VirtualTour';
import { TourHotspot } from '../models/TourHotspot';
import { Table } from '../models/Table';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { Tag } from '../models/Tag';
import { Zone } from '../models/Zone';
import { ReservableUnit } from '../models/ReservableUnit';
import { BannerSlide } from '../models/BannerSlide';
import { SponsoredPlacement } from '../models/SponsoredPlacement';
import { AppSettings } from '../models/AppSettings';
import { TablePlacement } from '../models/TablePlacement';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

function parseDays(query: string): number {
  const d = parseInt(query || '30', 10);
  return Math.min(Math.max(d, 1), 90);
}

// GET /api/v1/admin/dashboard/stats — alias for overview
router.get('/dashboard/stats', async (req: Request<unknown, unknown, unknown, { range?: string }>, res) => {
  try {
    const range = req.query.range || '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const [totalUsers, totalVenues, totalEvents, totalReservations, confirmedReservations, pendingReservations, cancelledReservations, reservationsToday, reservations7d] = await Promise.all([
      User.countDocuments(),
      Venue.countDocuments(),
      Event.countDocuments(),
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: 'CONFIRMED' }),
      Reservation.countDocuments({ status: 'PENDING' }),
      Reservation.countDocuments({ status: 'CANCELLED' }),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, startAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);
    res.json({
      success: true,
      data: {
        totalUsers,
        totalVenues,
        totalEvents,
        totalReservations,
        confirmedReservations,
        pendingReservations,
        cancelledReservations,
        reservationsToday,
        reservations7d,
      },
    });
  } catch (error) {
    console.error('Error dashboard stats:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

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

// POST /api/admin/venues
router.post('/venues', async (req, res) => {
  try {
    const { name, type, city, address, description, shortDescription, coverImage, gallery, isPublished, isFeatured, isSponsored, startingPrice, phone, slug, immersiveType, immersiveSourceType, immersiveProvider, immersiveUrl, immersiveFile, immersiveMeta } = req.body;
    if (!name || !type || !city || !address) {
      return res.status(400).json({ error: 'name, type, city et address requis.' });
    }
    const iType = immersiveType || 'none';
    let iSourceType = immersiveSourceType || null;
    let iUrl = immersiveUrl || null;
    let iFile = immersiveFile || null;
    let iProvider = immersiveProvider || 'custom';
    let iMeta = immersiveMeta || null;
    if (iType === 'none') { iSourceType = null; iUrl = null; iFile = null; iProvider = 'custom'; iMeta = null; }
    if (iType !== 'none' && !iSourceType) {
      return res.status(400).json({ error: 'immersiveSourceType requis quand immersiveType n\'est pas "none".' });
    }
    if (iSourceType === 'url' && !iUrl) {
      return res.status(400).json({ error: 'immersiveUrl requis quand la source est "url".' });
    }
    if (iSourceType === 'upload' && !iFile) {
      return res.status(400).json({ error: 'immersiveFile requis quand la source est "upload".' });
    }
    const slugVal = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    const venue = await Venue.create({
      name,
      type: String(type).toUpperCase(),
      city,
      address: address || '',
      description: description || '',
      shortDescription: shortDescription || undefined,
      coverImage: coverImage || undefined,
      gallery: Array.isArray(gallery) ? gallery : [],
      isPublished: isPublished !== false,
      isFeatured: !!isFeatured,
      isSponsored: !!isSponsored,
      startingPrice: startingPrice != null ? Number(startingPrice) : undefined,
      phone: phone || undefined,
      slug: slugVal,
      immersiveType: iType,
      immersiveSourceType: iSourceType,
      immersiveProvider: iProvider,
      immersiveUrl: iUrl,
      immersiveFile: iFile,
      immersiveMeta: iMeta,
    });
    res.status(201).json(venue);
  } catch (error) {
    console.error('Error creating venue:', error);
    res.status(500).json({ error: 'Erreur lors de la création du lieu.' });
  }
});

// PATCH /api/admin/venues/:id
router.patch('/venues/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });
    const { name, type, city, address, description, shortDescription, coverImage, gallery, isPublished, isFeatured, isSponsored, sponsoredOrder, bannerImage, startingPrice, phone, slug, immersiveType, immersiveSourceType, immersiveProvider, immersiveUrl, immersiveFile, immersiveMeta } = req.body;
    const update: Record<string, unknown> = {};
    if (name != null) update.name = name;
    if (type != null) update.type = String(type).toUpperCase();
    if (city != null) update.city = city;
    if (address != null) update.address = address;
    if (description != null) update.description = description;
    if (shortDescription !== undefined) update.shortDescription = shortDescription;
    if (coverImage !== undefined) update.coverImage = coverImage;
    if (gallery !== undefined) update.gallery = Array.isArray(gallery) ? gallery : [];
    if (isPublished !== undefined) update.isPublished = !!isPublished;
    if (isFeatured !== undefined) update.isFeatured = !!isFeatured;
    if (isSponsored !== undefined) update.isSponsored = !!isSponsored;
    if (sponsoredOrder !== undefined) update.sponsoredOrder = Number(sponsoredOrder) || 0;
    if (bannerImage !== undefined) update.bannerImage = bannerImage || null;
    if (startingPrice !== undefined) update.startingPrice = startingPrice != null ? Number(startingPrice) : undefined;
    if (phone !== undefined) update.phone = phone;
    if (slug !== undefined) update.slug = slug;
    if (immersiveType !== undefined) {
      const iType = immersiveType || 'none';
      update.immersiveType = iType;
      if (iType === 'none') {
        update.immersiveSourceType = null;
        update.immersiveProvider = 'custom';
        update.immersiveUrl = null;
        update.immersiveFile = null;
        update.immersiveMeta = null;
      } else {
        if (immersiveSourceType !== undefined) update.immersiveSourceType = immersiveSourceType || null;
        if (immersiveProvider !== undefined) update.immersiveProvider = immersiveProvider || 'custom';
        if (immersiveUrl !== undefined) update.immersiveUrl = immersiveUrl || null;
        if (immersiveFile !== undefined) update.immersiveFile = immersiveFile || null;
        if (immersiveMeta !== undefined) update.immersiveMeta = immersiveMeta || null;
      }
    } else {
      if (immersiveSourceType !== undefined) update.immersiveSourceType = immersiveSourceType || null;
      if (immersiveProvider !== undefined) update.immersiveProvider = immersiveProvider || 'custom';
      if (immersiveUrl !== undefined) update.immersiveUrl = immersiveUrl || null;
      if (immersiveFile !== undefined) update.immersiveFile = immersiveFile || null;
      if (immersiveMeta !== undefined) update.immersiveMeta = immersiveMeta || null;
    }
    const venue = await Venue.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!venue) return res.status(404).json({ error: 'Lieu introuvable.' });
    res.json(venue);
  } catch (error) {
    console.error('Error updating venue:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du lieu.' });
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

// POST /api/admin/events
router.post('/events', async (req, res) => {
  try {
    const { venueId, title, type, description, startAt, endsAt, coverImage, afficheImageUrl, isPublished, isSponsored } = req.body;
    if (!venueId || !title || !startAt) {
      return res.status(400).json({ error: 'venueId, title et startAt requis.' });
    }
    const slug = (title as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    const event = await Event.create({
      venueId,
      title,
      type: type || 'other',
      description: description || '',
      startAt: new Date(startAt),
      endsAt: endsAt ? new Date(endsAt) : undefined,
      coverImage: coverImage || afficheImageUrl || undefined,
      afficheImageUrl: afficheImageUrl || coverImage || undefined,
      isPublished: isPublished !== false,
      isSponsored: !!isSponsored,
      slug,
    });
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'événement.' });
  }
});

// PATCH /api/admin/events/:id
router.patch('/events/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });
    const { venueId, title, type, description, startAt, endsAt, coverImage, afficheImageUrl, isPublished, isSponsored } = req.body;
    const update: Record<string, unknown> = {};
    if (venueId != null) update.venueId = venueId;
    if (title != null) update.title = title;
    if (type != null) update.type = type;
    if (description != null) update.description = description;
    if (startAt != null) update.startAt = new Date(startAt);
    if (endsAt !== undefined) update.endsAt = endsAt ? new Date(endsAt) : null;
    if (coverImage !== undefined) update.coverImage = coverImage;
    if (afficheImageUrl !== undefined) update.afficheImageUrl = afficheImageUrl;
    if (isPublished !== undefined) update.isPublished = !!isPublished;
    if (isSponsored !== undefined) update.isSponsored = !!isSponsored;
    const event = await Event.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!event) return res.status(404).json({ error: 'Événement introuvable.' });
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'événement.' });
  }
});

// PATCH /api/admin/reservations/:id/status
router.patch('/reservations/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }
    const r = await Reservation.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!r) return res.status(404).json({ error: 'Réservation introuvable.' });
    res.json({ success: true, message: 'Statut mis à jour.', data: r });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// PATCH /api/admin/reservations/:id/check-in
router.patch('/reservations/:id/check-in', async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Réservation introuvable.' });
    (r as any).checkInStatus = 'checked_in';
    (r as any).checkedInAt = new Date();
    (r as any).checkedInBy = (req as any).userId;
    await r.save();
    res.json({ success: true, message: 'Check-in enregistré.', data: r });
  } catch (error) {
    console.error('Error check-in:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// PATCH /api/admin/reservations/:id/payment-status
router.patch('/reservations/:id/payment-status', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!paymentStatus || !['unpaid', 'pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Statut de paiement invalide.' });
    }
    const r = await Reservation.findByIdAndUpdate(req.params.id, { $set: { paymentStatus } }, { new: true });
    if (!r) return res.status(404).json({ error: 'Réservation introuvable.' });
    res.json({ success: true, message: 'Statut de paiement mis à jour.', data: r });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Erreur.' });
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

// GET /api/admin/virtual-tours?venueId=
router.get('/virtual-tours', async (req, res) => {
  try {
    const venueId = req.query.venueId as string;
    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({ error: 'venueId requis.' });
    }
    const tours = await VirtualTour.find({ venueId }).sort({ createdAt: 1 }).lean();
    res.json(tours);
  } catch (error) {
    console.error('Error fetching virtual tours:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// POST /api/admin/virtual-tours
router.post('/virtual-tours', async (req, res) => {
  try {
    const { venueId, provider, embedUrl, videoUrl, previewImage, isActive } = req.body;
    if (!venueId) return res.status(400).json({ error: 'venueId requis.' });
    const tour = await VirtualTour.create({
      venueId,
      provider: provider || 'klapty',
      embedUrl: embedUrl || undefined,
      videoUrl: videoUrl || undefined,
      previewImage: previewImage || undefined,
      isActive: isActive !== false,
    });
    res.status(201).json(tour);
  } catch (error) {
    console.error('Error creating virtual tour:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// PATCH /api/admin/virtual-tours/:id
router.patch('/virtual-tours/:id', async (req, res) => {
  try {
    const tour = await VirtualTour.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!tour) return res.status(404).json({ error: 'Visite virtuelle introuvable.' });
    res.json(tour);
  } catch (error) {
    console.error('Error updating virtual tour:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/tour-hotspots?virtualTourId=
router.get('/tour-hotspots', async (req, res) => {
  try {
    const virtualTourId = req.query.virtualTourId as string;
    if (!virtualTourId || !mongoose.Types.ObjectId.isValid(virtualTourId)) {
      return res.status(400).json({ error: 'virtualTourId requis.' });
    }
    const hotspots = await TourHotspot.find({ virtualTourId }).lean();
    res.json(hotspots);
  } catch (error) {
    console.error('Error fetching tour hotspots:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// POST /api/admin/tour-hotspots
router.post('/tour-hotspots', async (req, res) => {
  try {
    const {
      virtualTourId,
      venueId: bodyVenueId,
      label,
      targetType,
      targetId,
      xPercent,
      yPercent,
      yaw,
      pitch,
      anchorPosition,
      stemVector,
      tooltipText,
      isActive,
    } = req.body;

    // For now we keep xPercent/yPercent required to avoid breaking existing flows.
    if (!virtualTourId || !label || targetType == null || !targetId || xPercent == null || yPercent == null) {
      return res.status(400).json({ error: 'virtualTourId, label, targetType, targetId, xPercent, yPercent requis.' });
    }

    const tour = await VirtualTour.findById(virtualTourId).select('venueId').lean();
    if (!tour) return res.status(404).json({ error: 'Visite virtuelle introuvable.' });
    const venueId = bodyVenueId || (tour as any).venueId;

    const payload: any = {
      venueId,
      virtualTourId,
      label,
      targetType,
      targetId,
      xPercent: Number(xPercent),
      yPercent: Number(yPercent),
      tooltipText: tooltipText || undefined,
      isActive: isActive !== false,
    };

    // Optional 360 / advanced positioning fields
    if (yaw != null) payload.yaw = Number(yaw);
    if (pitch != null) payload.pitch = Number(pitch);
    if (anchorPosition) payload.anchorPosition = anchorPosition;
    if (stemVector) payload.stemVector = stemVector;

    const hotspot = await TourHotspot.create(payload);
    res.status(201).json(hotspot);
  } catch (error) {
    console.error('Error creating tour hotspot:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// PATCH /api/admin/tour-hotspots/:id
router.patch('/tour-hotspots/:id', async (req, res) => {
  try {
    const hotspot = await TourHotspot.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!hotspot) return res.status(404).json({ error: 'Point d\'intérêt introuvable.' });
    res.json(hotspot);
  } catch (error) {
    console.error('Error updating tour hotspot:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// DELETE /api/admin/tour-hotspots/:id
router.delete('/tour-hotspots/:id', async (req, res) => {
  try {
    const result = await TourHotspot.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Point d\'intérêt introuvable.' });
    res.json({ message: 'Point d\'intérêt supprimé.' });
  } catch (error) {
    console.error('Error deleting tour hotspot:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// GET /api/admin/table-placements?venueId=&virtualTourId=&sceneId=
router.get('/table-placements', async (req, res) => {
  try {
    const venueId = req.query.venueId as string;
    const virtualTourId = req.query.virtualTourId as string;
    const sceneId = (req.query.sceneId as string) || undefined;

    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({ error: 'venueId requis.' });
    }

    const filter: Record<string, unknown> = { venueId };
    if (virtualTourId && mongoose.Types.ObjectId.isValid(virtualTourId)) {
      filter.virtualTourId = virtualTourId;
    }
    if (sceneId) filter.sceneId = sceneId;

    const placements = await TablePlacement.find(filter).lean();
    res.json({ success: true, data: placements });
  } catch (error) {
    console.error('Error fetching table placements:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des emplacements de tables.' });
  }
});

// POST /api/admin/table-placements
router.post('/table-placements', async (req, res) => {
  try {
    const { venueId, tableId, virtualTourId, sceneId, positionType, yaw, pitch, anchorPosition, stemVector, floorIndex } = req.body;

    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({ error: 'venueId requis.' });
    }
    if (!tableId || !mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({ error: 'tableId requis.' });
    }
    if (!sceneId) {
      return res.status(400).json({ error: 'sceneId requis.' });
    }

    const pType = positionType || 'yaw_pitch';
    if (pType === 'yaw_pitch' && (yaw == null || pitch == null)) {
      return res.status(400).json({ error: 'yaw et pitch requis pour positionType yaw_pitch.' });
    }
    if (pType === 'matterport_anchor' && !anchorPosition) {
      return res.status(400).json({ error: 'anchorPosition requis pour positionType matterport_anchor.' });
    }
    if (pType === 'matterport_anchor' && floorIndex == null) {
      return res.status(400).json({ error: 'floorIndex requis pour positionType matterport_anchor.' });
    }

    const table = await Table.findOne({ _id: tableId, venueId }).select('_id').lean();
    if (!table) {
      return res.status(404).json({ error: 'Table introuvable pour ce lieu.' });
    }

    const placementData: Record<string, unknown> = {
      venueId,
      tableId,
      sceneId,
      positionType: pType,
    };
    if (virtualTourId && mongoose.Types.ObjectId.isValid(virtualTourId)) {
      placementData.virtualTourId = virtualTourId;
    }
    if (pType === 'yaw_pitch') {
      placementData.yaw = Number(yaw);
      placementData.pitch = Number(pitch);
    }
    if (pType === 'matterport_anchor') {
      placementData.anchorPosition = anchorPosition;
      if (stemVector) placementData.stemVector = stemVector;
      placementData.floorIndex = Number(floorIndex);
    }

    const placement = await TablePlacement.create(placementData);
    res.status(201).json({ success: true, data: placement });
  } catch (error: any) {
    console.error('Error creating table placement:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Un emplacement pour cette table, scène et visite existe déjà.' });
    }
    res.status(500).json({ error: 'Erreur lors de la création de l\'emplacement de table.' });
  }
});

// PATCH /api/admin/table-placements/:id
router.patch('/table-placements/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID invalide.' });
    }

    const { sceneId, yaw, pitch, tableId, positionType, anchorPosition, stemVector, floorIndex } = req.body;

    const update: Record<string, unknown> = {};
    if (sceneId !== undefined) update.sceneId = sceneId;
    if (positionType !== undefined) update.positionType = positionType;
    if (yaw != null) update.yaw = Number(yaw);
    if (pitch != null) update.pitch = Number(pitch);
    if (anchorPosition !== undefined) update.anchorPosition = anchorPosition;
    if (stemVector !== undefined) update.stemVector = stemVector;
    if (floorIndex !== undefined) update.floorIndex = Number(floorIndex);

    if (tableId) {
      if (!mongoose.Types.ObjectId.isValid(tableId)) {
        return res.status(400).json({ error: 'tableId invalide.' });
      }
      update.tableId = tableId;
    }

    const placement = await TablePlacement.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
    if (!placement) {
      return res.status(404).json({ error: 'Emplacement de table introuvable.' });
    }

    res.json({ success: true, data: placement });
  } catch (error: any) {
    console.error('Error updating table placement:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Un emplacement pour cette table, scène et visite existe déjà.' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'emplacement de table.' });
  }
});

// DELETE /api/admin/table-placements/:id
router.delete('/table-placements/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID invalide.' });
    }

    const result = await TablePlacement.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'Emplacement de table introuvable.' });
    }

    res.json({ success: true, message: 'Emplacement de table supprimé.' });
  } catch (error) {
    console.error('Error deleting table placement:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'emplacement de table.' });
  }
});

// GET /api/v1/admin/venues/:venueId/tables
router.get('/venues/:venueId/tables', async (req, res) => {
  try {
    const { venueId } = req.params;
    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({ error: 'venueId requis.' });
    }
    const tables = await Table.find({ venueId }).sort({ displayOrder: 1, tableNumber: 1 }).lean();
    return res.json({ data: tables });
  } catch (error) {
    console.error('Error listing venue tables:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// POST /api/v1/admin/tables
router.post('/tables', async (req, res) => {
  try {
    const { venueId, tableNumber, name, code, capacity, capacityMax, locationLabel, price, minimumSpend, defaultStatus, isVip, isActive } = req.body;
    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({ error: 'venueId requis.' });
    }
    if (capacity != null && Number(capacity) < 1) {
      return res.status(400).json({ error: 'capacity doit être >= 1.' });
    }
    if (price != null && Number(price) < 0) {
      return res.status(400).json({ error: 'price doit être >= 0.' });
    }
    const num = Number(tableNumber);
    if (Number.isNaN(num)) return res.status(400).json({ error: 'tableNumber requis.' });
    const existing = await Table.findOne({ venueId, tableNumber: num });
    if (existing) return res.status(409).json({ error: 'Ce numéro de table existe déjà pour ce lieu.' });
    const table = await Table.create({
      venueId,
      tableNumber: num,
      name: name ?? `Table ${num}`,
      code: code ?? `T${num}`,
      capacity: Number(capacity) || 1,
      capacityMax: capacityMax != null ? Number(capacityMax) : undefined,
      locationLabel: locationLabel ?? '',
      price: Number(price) ?? 0,
      minimumSpend: minimumSpend != null ? Number(minimumSpend) : undefined,
      defaultStatus: defaultStatus || 'available',
      isVip: !!isVip,
      isActive: isActive !== false,
    });
    res.status(201).json(table);
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// PATCH /api/v1/admin/tables/:id
router.patch('/tables/:id', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table introuvable.' });
    const { tableNumber, name, code, capacity, capacityMax, locationLabel, price, minimumSpend, defaultStatus, isVip, isActive } = req.body;
    if (capacity != null && Number(capacity) < 1) {
      return res.status(400).json({ error: 'capacity doit être >= 1.' });
    }
    if (price != null && Number(price) < 0) {
      return res.status(400).json({ error: 'price doit être >= 0.' });
    }
    if (tableNumber != null) {
      const num = Number(tableNumber);
      if (Number.isNaN(num)) return res.status(400).json({ error: 'tableNumber invalide.' });
      const existing = await Table.findOne({ venueId: table.venueId, tableNumber: num, _id: { $ne: table._id } });
      if (existing) return res.status(409).json({ error: 'Ce numéro de table existe déjà pour ce lieu.' });
      table.tableNumber = num;
    }
    if (name !== undefined) table.name = name;
    if (code !== undefined) table.code = code;
    if (capacity !== undefined) table.capacity = Number(capacity);
    if (capacityMax !== undefined) table.capacityMax = capacityMax;
    if (locationLabel !== undefined) table.locationLabel = locationLabel;
    if (price !== undefined) table.price = Number(price);
    if (minimumSpend !== undefined) table.minimumSpend = minimumSpend != null ? Number(minimumSpend) : undefined;
    if (defaultStatus !== undefined) (table as any).defaultStatus = defaultStatus;
    if (isVip !== undefined) table.isVip = !!isVip;
    if (isActive !== undefined) table.isActive = !!isActive;
    await table.save();
    res.json(table);
  } catch (error) {
    console.error('Error updating table:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// DELETE /api/v1/admin/tables/:id
router.delete('/tables/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID invalide.' });
    }
    await TablePlacement.deleteMany({ tableId: id });
    const result = await Table.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: 'Table introuvable.' });
    res.json({ success: true, message: 'Table supprimée.' });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la table.' });
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

// --- Tags CRUD ---
router.get('/tags', async (_req, res) => {
  try {
    const list = await Tag.find().sort({ nameFr: 1 }).lean();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.post('/tags', async (req, res) => {
  try {
    const tag = await Tag.create(req.body);
    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.patch('/tags/:id', async (req, res) => {
  try {
    const tag = await Tag.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!tag) return res.status(404).json({ error: 'Tag introuvable.' });
    res.json({ success: true, data: tag });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.delete('/tags/:id', async (req, res) => {
  try {
    const r = await Tag.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Tag introuvable.' });
    res.json({ success: true, message: 'Tag supprimé.' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// --- Zones CRUD ---
router.get('/zones', async (req, res) => {
  try {
    const venueId = req.query.venueId as string;
    const filter = venueId && mongoose.Types.ObjectId.isValid(venueId) ? { venueId } : {};
    const list = await Zone.find(filter).sort({ sortOrder: 1 }).lean();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.post('/zones', async (req, res) => {
  try {
    const zone = await Zone.create(req.body);
    res.status(201).json({ success: true, data: zone });
  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.patch('/zones/:id', async (req, res) => {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!zone) return res.status(404).json({ error: 'Zone introuvable.' });
    res.json({ success: true, data: zone });
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.delete('/zones/:id', async (req, res) => {
  try {
    const r = await Zone.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Zone introuvable.' });
    res.json({ success: true, message: 'Zone supprimée.' });
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// --- Reservable units CRUD ---
router.get('/reservable-units', async (req, res) => {
  try {
    const venueId = req.query.venueId as string;
    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) return res.status(400).json({ error: 'venueId requis.' });
    const list = await ReservableUnit.find({ venueId }).sort({ displayOrder: 1 }).lean();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching reservable units:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.post('/reservable-units', async (req, res) => {
  try {
    const unit = await ReservableUnit.create(req.body);
    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    console.error('Error creating reservable unit:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.patch('/reservable-units/:id', async (req, res) => {
  try {
    const unit = await ReservableUnit.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!unit) return res.status(404).json({ error: 'Unité introuvable.' });
    res.json({ success: true, data: unit });
  } catch (error) {
    console.error('Error updating reservable unit:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.delete('/reservable-units/:id', async (req, res) => {
  try {
    const r = await ReservableUnit.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Unité introuvable.' });
    res.json({ success: true, message: 'Unité supprimée.' });
  } catch (error) {
    console.error('Error deleting reservable unit:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// --- Banner slides CRUD ---
router.get('/banner-slides', async (_req, res) => {
  try {
    const list = await BannerSlide.find().sort({ sortOrder: 1 }).lean();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching banner slides:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.post('/banner-slides', async (req, res) => {
  try {
    const slide = await BannerSlide.create(req.body);
    res.status(201).json({ success: true, data: slide });
  } catch (error) {
    console.error('Error creating banner slide:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.patch('/banner-slides/:id', async (req, res) => {
  try {
    const slide = await BannerSlide.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!slide) return res.status(404).json({ error: 'Slide introuvable.' });
    res.json({ success: true, data: slide });
  } catch (error) {
    console.error('Error updating banner slide:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.delete('/banner-slides/:id', async (req, res) => {
  try {
    const r = await BannerSlide.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Slide introuvable.' });
    res.json({ success: true, message: 'Slide supprimé.' });
  } catch (error) {
    console.error('Error deleting banner slide:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// --- Sponsored placements CRUD ---
router.get('/sponsored-placements', async (req, res) => {
  try {
    const key = req.query.placementKey as string;
    const filter = key ? { placementKey: key, isActive: true } : {};
    const list = await SponsoredPlacement.find(filter).sort({ priority: -1 }).lean();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching sponsored placements:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.post('/sponsored-placements', async (req, res) => {
  try {
    const placement = await SponsoredPlacement.create(req.body);
    res.status(201).json({ success: true, data: placement });
  } catch (error) {
    console.error('Error creating sponsored placement:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.patch('/sponsored-placements/:id', async (req, res) => {
  try {
    const placement = await SponsoredPlacement.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!placement) return res.status(404).json({ error: 'Placement introuvable.' });
    res.json({ success: true, data: placement });
  } catch (error) {
    console.error('Error updating sponsored placement:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.delete('/sponsored-placements/:id', async (req, res) => {
  try {
    const r = await SponsoredPlacement.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Placement introuvable.' });
    res.json({ success: true, message: 'Placement supprimé.' });
  } catch (error) {
    console.error('Error deleting sponsored placement:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// --- Settings (GET + PATCH singleton) ---
router.get('/settings', async (_req, res) => {
  try {
    const settings = await AppSettings.findOne().lean();
    res.json({ success: true, data: settings ?? {} });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});
router.patch('/settings', async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate({}, { $set: req.body }, { new: true, upsert: true });
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

export default router;

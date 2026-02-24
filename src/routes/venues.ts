import { Router } from 'express';
import mongoose from 'mongoose';
import { Venue } from '../models/Venue';
import { VenueMedia } from '../models/VenueMedia';
import { VirtualTour } from '../models/VirtualTour';
import { TourHotspot } from '../models/TourHotspot';
import { Table } from '../models/Table';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { TableHotspot } from '../models/TableHotspot';
import { Event } from '../models/Event';
import { Reservation } from '../models/Reservation';

const router = Router();

// GET /api/v1/venues/:id/virtual-tours — list virtual tours for a venue
router.get('/:id/virtual-tours', async (req, res) => {
  try {
    const venue = await Venue.findOne(
      mongoose.Types.ObjectId.isValid(req.params.id) && req.params.id.length === 24
        ? { _id: req.params.id }
        : { slug: req.params.id }
    ).lean();
    if (!venue) return res.status(404).json({ error: 'Lieu non trouvé' });
    const tours = await VirtualTour.find({ venueId: (venue as any)._id, isActive: true }).lean();
    res.json(tours);
  } catch (error) {
    console.error('Error fetching virtual tours:', error);
    res.status(500).json({ error: 'Échec du chargement des visites virtuelles.' });
  }
});

// GET /api/v1/venues/:id/hotspots — list tour hotspots for a venue (all active tours)
router.get('/:id/hotspots', async (req, res) => {
  try {
    const venue = await Venue.findOne(
      mongoose.Types.ObjectId.isValid(req.params.id) && req.params.id.length === 24
        ? { _id: req.params.id }
        : { slug: req.params.id }
    ).lean();
    if (!venue) return res.status(404).json({ error: 'Lieu non trouvé' });
    const tours = await VirtualTour.find({ venueId: (venue as any)._id, isActive: true }).select('_id').lean();
    const tourIds = (tours as any[]).map((t) => t._id);
    const hotspots = tourIds.length
      ? await TourHotspot.find({ virtualTourId: { $in: tourIds }, isActive: true }).lean()
      : [];
    res.json(hotspots);
  } catch (error) {
    console.error('Error fetching hotspots:', error);
    res.status(500).json({ error: 'Échec du chargement des points d\'intérêt.' });
  }
});

// GET /api/v1/venues — list venues (filters: type, city, categoryId, hasEvent, hasVirtualTour, priceRange, q)
router.get('/', async (req, res) => {
  try {
    const { type, city, categoryId, hasEvent, hasVirtualTour, priceMin, priceMax, q } = req.query;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = String(type).toUpperCase();
    if (city) filter.city = city;
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId as string)) {
      filter.categoryIds = new mongoose.Types.ObjectId(categoryId as string);
    }
    if (priceMin != null && priceMin !== '') filter.priceRangeMin = { $gte: Number(priceMin) };
    if (priceMax != null && priceMax !== '') filter.priceRangeMax = { $lte: Number(priceMax) };
    if (q && String(q).trim()) {
      filter.$text = { $search: String(q).trim() };
    }

    let venues = await Venue.find(filter).sort({ rating: -1, isFeatured: -1 }).lean();

    const venueIds = venues.map((v) => (v as any)._id);
    const [venuesWithEvents, venueIdsWithTours] = await Promise.all([
      Event.distinct('venueId', { venueId: { $in: venueIds } }),
      hasVirtualTour === 'true' ? VirtualTour.distinct('venueId', { venueId: { $in: venueIds }, isActive: true }) : Promise.resolve([]),
    ]);

    if (hasEvent === 'true') {
      venues = venues.filter((v) => venuesWithEvents.some((id: any) => id.toString() === (v as any)._id.toString()));
    }
    if (hasVirtualTour === 'true' && venueIdsWithTours.length) {
      const set = new Set(venueIdsWithTours.map((id: any) => id.toString()));
      venues = venues.filter((v) => set.has((v as any)._id.toString()));
    }

    const result = await Promise.all(
      venues.map(async (venue) => {
        const vid = (venue as any)._id;
        const tables = await Table.countDocuments({ venueId: vid });
        return {
          ...venue,
          availableTables: tables,
          hasEvent: venuesWithEvents.some((id: any) => id.toString() === vid.toString()),
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Échec du chargement des lieux.' });
  }
});

// GET /api/v1/venues/:idOrSlug — venue details with media, tables/rooms/seats, virtualTours, hotspots, events; optional startAt/endAt for availability
router.get('/:id', async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const venue = await (mongoose.Types.ObjectId.isValid(idOrSlug) && idOrSlug.length === 24
      ? Venue.findById(idOrSlug)
      : Venue.findOne({ slug: idOrSlug })
    ).lean();
    if (!venue) return res.status(404).json({ error: 'Lieu non trouvé' });

    const venueId = (venue as any)._id.toString();
    const venueType = (venue as any).type;
    const hasTables = venueType === 'CAFE' || venueType === 'RESTAURANT' || venueType === 'EVENT_SPACE';
    const hasRooms = venueType === 'HOTEL';
    const hasSeats = venueType === 'CINEMA';

    const [media, tables, rooms, seats, tableHotspots, virtualTours, events] = await Promise.all([
      VenueMedia.find({ venueId }).lean(),
      hasTables ? Table.find({ venueId }).sort({ displayOrder: 1, tableNumber: 1 }).lean() : [],
      hasRooms ? Room.find({ venueId }).sort({ roomNumber: 1 }).lean() : [],
      hasSeats ? Seat.find({ venueId }).sort({ seatNumber: 1 }).lean() : [],
      TableHotspot.find({ venueId }).populate('tableId').lean(),
      VirtualTour.find({ venueId, isActive: true }).lean(),
      Event.find({ venueId }).sort({ startAt: 1 }).limit(10).lean(),
    ]);

    const tourIds = (virtualTours as any[]).map((t) => t._id);
    const tourHotspots = tourIds.length
      ? await TourHotspot.find({ virtualTourId: { $in: tourIds }, isActive: true }).lean()
      : [];

    const { startAt, endAt } = req.query;
    let tablesWithStatus = (tables as any[]).map((t) => ({ ...t, status: 'available' as string }));
    let roomsWithStatus = (rooms as any[]).map((r) => ({ ...r, status: 'available' as string }));
    let seatsWithStatus = (seats as any[]).map((s) => ({ ...s, status: 'available' as string }));

    if (startAt && endAt) {
      const start = new Date(startAt as string);
      const end = new Date(endAt as string);
      const overlapping = await Reservation.find({
        venueId,
        status: { $in: ['PENDING', 'CONFIRMED'] },
        $or: [{ startAt: { $lt: end }, endAt: { $gt: start } }],
      });
      const reservedTableIds = new Set(overlapping.filter((r) => r.tableId).map((r) => r.tableId!.toString()));
      const reservedRoomIds = new Set(overlapping.filter((r) => r.roomId).map((r) => r.roomId!.toString()));
      const reservedSeatIds = new Set(overlapping.filter((r) => r.seatId).map((r) => r.seatId!.toString()));
      tablesWithStatus = (tables as any[]).map((t) => ({
        ...t,
        status: reservedTableIds.has(t._id.toString()) ? 'reserved' : 'available',
      }));
      roomsWithStatus = (rooms as any[]).map((r) => ({
        ...r,
        status: reservedRoomIds.has(r._id.toString()) ? 'reserved' : 'available',
      }));
      seatsWithStatus = (seats as any[]).map((s) => ({
        ...s,
        status: reservedSeatIds.has(s._id.toString()) ? 'reserved' : 'available',
      }));
    }

    res.json({
      ...venue,
      media,
      tables: tablesWithStatus,
      rooms: roomsWithStatus,
      seats: seatsWithStatus,
      hotspots: (tableHotspots as any[]).map((h) => ({
        _id: h._id,
        venueId: h.venueId,
        tableId: h.tableId,
        sceneId: h.sceneId,
        pitch: h.pitch,
        yaw: h.yaw,
        radius: h.radius,
        label: h.label,
      })),
      virtualTours,
      tourHotspots,
      events,
    });
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: 'Échec du chargement du lieu.' });
  }
});

export default router;

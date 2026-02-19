import { Router } from 'express';
import { Venue } from '../models/Venue';
import { VenueMedia } from '../models/VenueMedia';
import { Table } from '../models/Table';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { TableHotspot } from '../models/TableHotspot';
import { Event } from '../models/Event';
import { Reservation } from '../models/Reservation';

const router = Router();

// GET /api/venues — list all venues (optional filters: type, city, hasEvent)
router.get('/', async (req, res) => {
  try {
    const { type, city, hasEvent } = req.query;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = String(type).toUpperCase();
    if (city) filter.city = city;

    let venues = await Venue.find(filter).sort({ rating: -1 }).lean();

    const venueIds = venues.map((v) => v._id);
    const venuesWithEvents = await Event.distinct('venueId', { venueId: { $in: venueIds } });

    if (hasEvent === 'true') {
      venues = venues.filter((v) => venuesWithEvents.some((id) => id.toString() === (v._id as any).toString()));
    }

    const result = await Promise.all(
      venues.map(async (venue) => {
        const tables = await Table.countDocuments({ venueId: venue._id });
        return {
          ...venue,
          availableTables: tables,
          hasEvent: venuesWithEvents.some((id) => id.toString() === (venue._id as any).toString()),
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// GET /api/venues/:id — venue details with media, tables/rooms/seats, events; optional startAt/endAt for availability
router.get('/:id', async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id).lean();
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    const venueType = (venue as any).type;
    const [media, tables, rooms, seats, hotspots, events] = await Promise.all([
      VenueMedia.find({ venueId: req.params.id }).lean(),
      venueType === 'CAFE' || venueType === 'RESTAURANT' ? Table.find({ venueId: req.params.id }).sort({ tableNumber: 1 }).lean() : [],
      venueType === 'HOTEL' ? Room.find({ venueId: req.params.id }).sort({ roomNumber: 1 }).lean() : [],
      venueType === 'CINEMA' ? Seat.find({ venueId: req.params.id }).sort({ seatNumber: 1 }).lean() : [],
      TableHotspot.find({ venueId: req.params.id }).populate('tableId').lean(),
      Event.find({ venueId: req.params.id }).sort({ startAt: 1 }).limit(10).lean(),
    ]);

    const { startAt, endAt } = req.query;
    let tablesWithStatus = (tables as any[]).map((t) => ({ ...t, status: 'available' as string }));
    let roomsWithStatus = (rooms as any[]).map((r) => ({ ...r, status: 'available' as string }));
    let seatsWithStatus = (seats as any[]).map((s) => ({ ...s, status: 'available' as string }));

    if (startAt && endAt) {
      const start = new Date(startAt as string);
      const end = new Date(endAt as string);
      const overlapping = await Reservation.find({
        venueId: req.params.id,
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
      hotspots: (hotspots as any[]).map((h) => ({
        _id: h._id,
        venueId: h.venueId,
        tableId: h.tableId,
        sceneId: h.sceneId,
        pitch: h.pitch,
        yaw: h.yaw,
        radius: h.radius,
        label: h.label,
      })),
      events,
    });
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

export default router;

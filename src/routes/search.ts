import { Router } from 'express';
import { Venue } from '../models/Venue';
import { Room } from '../models/Room';
import { Event } from '../models/Event';

const router = Router();

// GET /api/v1/search/global?q=&type=&city=&date= — global search (venues, events, type filter includes hotel)
router.get('/global', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const type = req.query.type as string | undefined;
    const city = req.query.city as string | undefined;
    const date = req.query.date as string | undefined;
    const filterVenue: Record<string, unknown> = { isPublished: true };
    if (type) filterVenue.type = type.toUpperCase();
    if (city) filterVenue.city = new RegExp(city, 'i');
    const filterEvent: Record<string, unknown> = {};
    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filterEvent.startAt = { $gte: start, $lt: end };
    }
    if (q && q.length >= 2) {
      const regex = new RegExp(q, 'i');
      const [venues, events] = await Promise.all([
        Venue.find({ ...filterVenue, $or: [{ name: regex }, { description: regex }, { city: regex }, { address: regex }] }).lean().limit(20),
        Event.find({ ...filterEvent, isPublished: true, $or: [{ title: regex }, { description: regex }] }).populate('venueId', 'name city').sort({ startAt: 1 }).lean().limit(20),
      ]);
      return res.json({ venues, events });
    }
    const [venues, events] = await Promise.all([
      Venue.find(filterVenue).lean().limit(20),
      Event.find({ ...filterEvent, isPublished: true }).populate('venueId', 'name city').sort({ startAt: 1 }).lean().limit(20),
    ]);
    res.json({ venues, events });
  } catch (error) {
    console.error('Error global search:', error);
    res.status(500).json({ error: 'Recherche échouée' });
  }
});

// GET /api/v1/search?q=... — search venues, rooms, events (backward compat)
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return res.json({ lieux: [], chambres: [], evenements: [] });
    }

    const regex = new RegExp(q, 'i');

    const [venues, rooms, events] = await Promise.all([
      Venue.find({
        $or: [
          { name: regex },
          { description: regex },
          { city: regex },
          { address: regex },
        ],
      })
        .lean()
        .limit(10),
      Room.find()
        .populate('venueId', 'name city type')
        .lean()
        .then((list) =>
          list.filter(
            (r) =>
              regex.test((r.venueId as any)?.name || '') ||
              regex.test(String(r.roomType)) ||
              regex.test((r.venueId as any)?.city || '')
          )
        )
        .then((list) => list.slice(0, 10)),
      Event.find({
        $or: [{ title: regex }, { description: regex }],
      })
        .populate('venueId', 'name city')
        .sort({ startAt: 1 })
        .lean()
        .limit(10),
    ]);

    res.json({
      lieux: venues.map((v) => ({ type: 'venue', _id: v._id, name: (v as any).name, city: (v as any).city, venueType: (v as any).type })),
      chambres: rooms.map((r) => ({
        type: 'room',
        _id: r._id,
        roomNumber: (r as any).roomNumber,
        roomType: (r as any).roomType,
        venueId: (r as any).venueId?._id,
        venueName: (r as any).venueId?.name,
        city: (r as any).venueId?.city,
      })),
      evenements: events.map((e) => ({
        type: 'event',
        _id: e._id,
        title: (e as any).title,
        startAt: (e as any).startAt,
        venueId: (e as any).venueId?._id,
        venueName: (e as any).venueId?.name,
        city: (e as any).venueId?.city,
      })),
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

export default router;

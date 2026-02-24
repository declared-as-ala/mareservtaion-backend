import { Router } from 'express';
import { Venue } from '../models/Venue';
import { Room } from '../models/Room';
import { Event } from '../models/Event';

const router = Router();

// GET /api/search?q=... — search venues, rooms, events
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

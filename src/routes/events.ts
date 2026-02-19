import { Router } from 'express';
import { Event } from '../models/Event';
import { Venue } from '../models/Venue';

const router = Router();

// GET /api/events — list events (optional: city, type, venueId, upcoming=true)
router.get('/', async (req, res) => {
  try {
    const { city, type, venueId, upcoming } = req.query;
    const filter: Record<string, unknown> = {};
    if (upcoming !== 'false') filter.startAt = { $gte: new Date() };
    if (type) filter.type = type;
    if (venueId) filter.venueId = venueId;
    if (city) {
      const venueIds = await Venue.find({ city }).distinct('_id');
      filter.venueId = { $in: venueIds };
    }

    const events = await Event.find(filter)
      .populate('venueId', 'name address city')
      .sort({ startAt: 1 });

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('venueId');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

export default router;

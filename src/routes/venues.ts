import { Router } from 'express';
import mongoose from 'mongoose';
import { Venue } from '../models/Venue';
import { VenueMedia } from '../models/VenueMedia';
import { VirtualTour } from '../models/VirtualTour';
import { TourHotspot } from '../models/TourHotspot';
import { Table } from '../models/Table';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { ReservableUnit } from '../models/ReservableUnit';
import { TableHotspot } from '../models/TableHotspot';
import { TablePlacement } from '../models/TablePlacement';
import { Event } from '../models/Event';
import { Reservation } from '../models/Reservation';
import { ReservationHold } from '../models/ReservationHold';

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

// GET /api/v1/venues/:id/reservable-units — list reservable units (tables, rooms, seat zones) for a venue
router.get('/:id/reservable-units', async (req, res) => {
  try {
    const venue = await Venue.findOne(
      mongoose.Types.ObjectId.isValid(req.params.id) && req.params.id.length === 24
        ? { _id: req.params.id }
        : { slug: req.params.id }
    ).lean();
    if (!venue) return res.status(404).json({ error: 'Lieu non trouvé' });
    const units = await ReservableUnit.find({
      venueId: (venue as any)._id,
      status: { $in: ['active'] },
    })
      .sort({ displayOrder: 1 })
      .lean();
    res.json(units);
  } catch (error) {
    console.error('Error fetching reservable units:', error);
    res.status(500).json({ error: 'Échec du chargement des unités réservables.' });
  }
});

// GET /api/v1/venues/:id/availability — check availability for a date/time range (query: startsAt, endsAt, reservableUnitId?)
router.get('/:id/availability', async (req, res) => {
  try {
    const venue = await Venue.findOne(
      mongoose.Types.ObjectId.isValid(req.params.id) && req.params.id.length === 24
        ? { _id: req.params.id }
        : { slug: req.params.id }
    ).lean();
    if (!venue) return res.status(404).json({ error: 'Lieu non trouvé' });
    const venueId = (venue as any)._id;
    const { startsAt, endsAt, reservableUnitId } = req.query;
    if (!startsAt || !endsAt) {
      return res.status(400).json({ error: 'startsAt et endsAt sont requis en query.' });
    }
    const start = new Date(startsAt as string);
    const end = new Date(endsAt as string);
    const filter: Record<string, unknown> = {
      venueId,
      status: { $in: ['PENDING', 'CONFIRMED'] },
      $or: [{ startAt: { $lt: end }, endAt: { $gt: start } }],
    };
    if (reservableUnitId) filter.reservableUnitId = reservableUnitId;
    const overlapping = await Reservation.find(filter).select('reservableUnitId tableId roomId seatId startAt endAt').lean();
    res.json({ available: overlapping.length === 0, reservations: overlapping });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Échec de la vérification de disponibilité.' });
  }
});

// GET /api/v1/venues/:id/table-placements — public list of table placements for a venue, with table info
router.get('/:id/table-placements', async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const venue = await (mongoose.Types.ObjectId.isValid(idOrSlug) && idOrSlug.length === 24
      ? Venue.findById(idOrSlug)
      : Venue.findOne({ slug: idOrSlug })
    ).lean();
    if (!venue) return res.status(404).json({ error: 'Lieu non trouvé' });

    const venueId = (venue as any)._id;
    const placements = await TablePlacement.find({ venueId }).lean();

    const tableIds = [...new Set((placements as any[]).map((p) => p.tableId))];
    const tables = tableIds.length
      ? await Table.find({ _id: { $in: tableIds }, isActive: true })
          .select('_id tableNumber name capacity price minimumSpend defaultStatus isVip locationLabel')
          .lean()
      : [];
    const tableMap = new Map((tables as any[]).map((t) => [t._id.toString(), t]));

    const { startAt, endAt } = req.query;
    let reservedTableIds = new Set<string>();
    if (startAt && endAt) {
      const start = new Date(startAt as string);
      const end = new Date(endAt as string);
      const now = new Date();
      const [overlappingReservations, overlappingHolds] = await Promise.all([
        Reservation.find({
          venueId,
          status: { $in: ['PENDING', 'CONFIRMED'] },
          $or: [{ startAt: { $lt: end }, endAt: { $gt: start } }],
        }).select('tableId'),
        ReservationHold.find({
          venueId,
          status: 'active',
          expiresAt: { $gt: now },
          $or: [{ startsAt: { $lt: end }, endsAt: { $gt: start } }],
        }).select('reservableUnitId'),
      ]);

      const reservationTableIds = overlappingReservations
        .filter((r) => r.tableId)
        .map((r) => r.tableId!.toString());

      // Holds may be created against the same underlying unit id as `tableId`.
      // We treat `reservableUnitId` as the table id for this availability computation.
      const holdTableIds = overlappingHolds
        .filter((h) => h.reservableUnitId)
        .map((h) => h.reservableUnitId!.toString());

      reservedTableIds = new Set([...reservationTableIds, ...holdTableIds]);
    }

    const result = (placements as any[]).map((p) => {
      const table = tableMap.get(p.tableId?.toString());
      const isReserved = reservedTableIds.has(p.tableId?.toString());
      return {
        _id: p._id,
        venueId: p.venueId,
        tableId: p.tableId,
        sceneId: p.sceneId,
        positionType: p.positionType,
        yaw: p.yaw,
        pitch: p.pitch,
        floorIndex: p.floorIndex,
        anchorPosition: p.anchorPosition,
        stemVector: p.stemVector,
        table: table ? {
          _id: table._id,
          tableNumber: table.tableNumber,
          name: table.name,
          capacity: table.capacity,
          price: table.price,
          minimumSpend: table.minimumSpend,
          defaultStatus: table.defaultStatus,
          isVip: table.isVip,
          locationLabel: table.locationLabel,
          status: isReserved ? 'reserved' : (table.defaultStatus === 'blocked' ? 'blocked' : 'available'),
        } : null,
      };
    }).filter((p) => p.table !== null);

    res.json(result);
  } catch (error) {
    console.error('Error fetching table placements:', error);
    res.status(500).json({ error: 'Échec du chargement des placements.' });
  }
});

// GET /api/v1/venues — list venues (filters: type, city, categoryId, hasEvent, hasVirtualTour, priceRange, q)
router.get('/', async (req, res) => {
  try {
    const { type, city, governorate, categoryId, hasEvent, hasVirtualTour, isVedette, isFeatured, priceMin, priceMax, q } = req.query;
    const filter: Record<string, unknown> = { isPublished: true };
    if (type) filter.type = String(type).toUpperCase();
    if (city) filter.city = city;
    if (governorate) filter.governorate = String(governorate);
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId as string)) {
      filter.categoryIds = new mongoose.Types.ObjectId(categoryId as string);
    }
    if (isVedette === 'true') filter.isVedette = true;
    if (isFeatured === 'true') filter.isFeatured = true;
    if (priceMin != null && priceMin !== '') filter.priceRangeMin = { $gte: Number(priceMin) };
    if (priceMax != null && priceMax !== '') filter.priceRangeMax = { $lte: Number(priceMax) };
    if (q && String(q).trim()) {
      filter.$text = { $search: String(q).trim() };
    }

    let venues = await Venue.find(filter).sort({ vedetteOrder: 1, isFeatured: -1, createdAt: -1 }).lean();

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

import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest, requireEstablishmentOwner } from '../middleware/auth';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';
import { Room } from '../models/Room';
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

// ─────────────────────────────────────────────────────────────────────
// Rooms management for hotel owners (full CRUD scoped to their venues)
// ─────────────────────────────────────────────────────────────────────

async function assertHotelOwnedByCaller(venueId: string, req: AuthRequest) {
  if (!mongoose.Types.ObjectId.isValid(venueId)) return null;
  const venue = await Venue.findById(venueId).select('_id type ownerId').lean();
  if (!venue || (venue as any).type !== 'HOTEL') return null;
  if (req.userRole === 'ADMIN') return venue;
  if (String((venue as any).ownerId) !== String(req.userId)) return null;
  return venue;
}

async function assertRoomOwnedByCaller(roomId: string, req: AuthRequest) {
  if (!mongoose.Types.ObjectId.isValid(roomId)) return null;
  const room = await Room.findById(roomId);
  if (!room) return null;
  const venue = await assertHotelOwnedByCaller(String(room.venueId), req);
  if (!venue) return null;
  return room;
}

// GET /api/v1/owner/hotels/:id/rooms
router.get('/hotels/:id/rooms', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venue = await assertHotelOwnedByCaller(req.params.id, req);
    if (!venue) return res.status(404).json({ error: 'Hôtel introuvable ou non autorisé.' });
    const rooms = await Room.find({ venueId: (venue as any)._id }).sort({ pricePerNight: 1 }).lean();
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('Owner rooms list error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// POST /api/v1/owner/hotels/:id/rooms
router.post('/hotels/:id/rooms', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const venue = await assertHotelOwnedByCaller(req.params.id, req);
    if (!venue) return res.status(404).json({ error: 'Hôtel introuvable ou non autorisé.' });
    const { roomNumber, roomType, capacity, pricePerNight } = req.body;
    if (!roomNumber || !roomType || !capacity || !pricePerNight) {
      return res.status(400).json({ error: 'roomNumber, roomType, capacity, pricePerNight requis.' });
    }
    const room = await Room.create({ venueId: (venue as any)._id, ...req.body });
    res.status(201).json({ success: true, data: room });
  } catch (error: any) {
    console.error('Owner room create error:', error);
    if (error.code === 11000) return res.status(409).json({ error: 'Numéro de chambre déjà utilisé.' });
    res.status(500).json({ error: 'Erreur.' });
  }
});

// PATCH /api/v1/owner/rooms/:id — update room (including gallery + panoramicImages)
router.patch('/rooms/:id', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const room = await assertRoomOwnedByCaller(req.params.id, req);
    if (!room) return res.status(404).json({ error: 'Chambre introuvable ou non autorisé.' });
    Object.assign(room, req.body);
    await room.save();
    res.json({ success: true, data: room });
  } catch (error: any) {
    console.error('Owner room update error:', error);
    if (error.code === 11000) return res.status(409).json({ error: 'Numéro de chambre déjà utilisé.' });
    res.status(500).json({ error: 'Erreur.' });
  }
});

// DELETE /api/v1/owner/rooms/:id
router.delete('/rooms/:id', authenticate, requireEstablishmentOwner, async (req: AuthRequest, res) => {
  try {
    const room = await assertRoomOwnedByCaller(req.params.id, req);
    if (!room) return res.status(404).json({ error: 'Chambre introuvable ou non autorisé.' });
    await room.deleteOne();
    res.json({ success: true, message: 'Chambre supprimée.' });
  } catch (error) {
    console.error('Owner room delete error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

export default router;

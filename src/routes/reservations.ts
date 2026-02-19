import { Router } from 'express';
import { Reservation } from '../models/Reservation';
import { Table } from '../models/Table';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function overlaps(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && end1 > start2;
}

// POST /api/reservations — create reservation (TABLE | ROOM | SEAT); prevent conflicts
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });

    const { venueId, bookingType, tableId, roomId, seatId, startAt, endAt, totalPrice, guestFirstName, guestLastName, guestPhone, partySize } = req.body;
    if (!venueId || !startAt || !endAt) {
      return res.status(400).json({ error: 'venueId, startAt and endAt are required' });
    }
    if (!guestFirstName?.trim()) return res.status(400).json({ error: 'Prénom est requis' });
    if (!guestLastName?.trim()) return res.status(400).json({ error: 'Nom est requis' });
    if (!guestPhone?.trim()) return res.status(400).json({ error: 'Téléphone est requis' });
    const phone = String(guestPhone).trim().replace(/\s/g, '');
    if (!/^(\+216|216)?[0-9]{8}$/.test(phone) && !/^[0-9]{8}$/.test(phone)) {
      return res.status(400).json({ error: 'Format téléphone invalide (ex: 12345678 ou +21612345678)' });
    }
    const party = Number(partySize) || 1;
    if (party < 1 || party > 20) return res.status(400).json({ error: 'Nombre de personnes doit être entre 1 et 20' });
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start >= end) return res.status(400).json({ error: 'startAt must be before endAt' });

    const type = bookingType === 'ROOM' || bookingType === 'SEAT' ? bookingType : 'TABLE';
    let total = Number(totalPrice) || 0;

    if (type === 'TABLE') {
      if (!tableId) return res.status(400).json({ error: 'tableId required for table booking' });
      const table = await Table.findOne({ _id: tableId, venueId });
      if (!table) return res.status(404).json({ error: 'Table not found' });
      const tableCap = (table as any).capacity ?? 4;
      if (party > tableCap) return res.status(400).json({ error: `Capacité max: ${tableCap} personnes` });
      total = total || (table as any).price;
      const existing = await Reservation.find({ tableId, status: { $in: ['PENDING', 'CONFIRMED'] } });
      for (const r of existing) {
        if (overlaps(start, end, r.startAt, r.endAt))
          return res.status(409).json({ error: 'This table is already reserved for the selected time.' });
      }
    } else if (type === 'ROOM') {
      if (!roomId) return res.status(400).json({ error: 'roomId required for room booking' });
      const room = await Room.findOne({ _id: roomId, venueId });
      if (!room) return res.status(404).json({ error: 'Room not found' });
      const roomCap = (room as any).capacity ?? 4;
      if (party > roomCap) return res.status(400).json({ error: `Capacité max: ${roomCap} personnes` });
      total = total || (room as any).pricePerNight;
      const existing = await Reservation.find({ roomId, status: { $in: ['PENDING', 'CONFIRMED'] } });
      for (const r of existing) {
        if (overlaps(start, end, r.startAt, r.endAt))
          return res.status(409).json({ error: 'This room is already reserved for the selected nights.' });
      }
    } else {
      if (!seatId) return res.status(400).json({ error: 'seatId required for seat booking' });
      const seat = await Seat.findOne({ _id: seatId, venueId });
      if (!seat) return res.status(404).json({ error: 'Seat not found' });
      if (party > 1) return res.status(400).json({ error: '1 place par siège' });
      total = total || (seat as any).price;
      const existing = await Reservation.find({ seatId, status: { $in: ['PENDING', 'CONFIRMED'] } });
      for (const r of existing) {
        if (overlaps(start, end, r.startAt, r.endAt))
          return res.status(409).json({ error: 'This seat is already reserved.' });
      }
    }

    const reservation = new Reservation({
      userId: req.userId,
      venueId,
      bookingType: type,
      tableId: type === 'TABLE' ? tableId : undefined,
      roomId: type === 'ROOM' ? roomId : undefined,
      seatId: type === 'SEAT' ? seatId : undefined,
      startAt: start,
      endAt: end,
      status: 'CONFIRMED',
      totalPrice: total,
      guestFirstName: String(guestFirstName).trim(),
      guestLastName: String(guestLastName).trim(),
      guestPhone: phone,
      partySize: party,
    });
    await reservation.save();
    await reservation.populate(['tableId', 'roomId', 'seatId', 'venueId']);

    res.status(201).json({
      message: 'Reservation created',
      reservation: {
        _id: reservation._id,
        userId: reservation.userId,
        venueId: reservation.venueId,
        bookingType: reservation.bookingType,
        tableId: reservation.tableId,
        roomId: reservation.roomId,
        seatId: reservation.seatId,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        status: reservation.status,
        totalPrice: reservation.totalPrice,
        createdAt: reservation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

async function getMyReservations(req: AuthRequest, res: import('express').Response) {
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  const list = await Reservation.find({ userId: req.userId })
    .populate('tableId', 'tableNumber capacity locationLabel price isVip')
    .populate('roomId', 'roomNumber roomType capacity pricePerNight')
    .populate('seatId', 'seatNumber zone price')
    .populate('venueId', 'name address city')
    .sort({ startAt: -1 });
  res.json(list);
}

// GET /api/reservations/me and GET /api/reservations — current user's reservations
router.get(['/me', '/'], authenticate, async (req: AuthRequest, res) => {
  try {
    await getMyReservations(req, res);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// GET /api/reservations/:id/ticket — ticket data for QR display/print
router.get('/:id/ticket', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.userId,
    })
      .populate('venueId', 'name address city')
      .populate('tableId', 'tableNumber capacity price')
      .populate('roomId', 'roomNumber roomType pricePerNight')
      .populate('seatId', 'seatNumber zone price')
      .lean();
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    const v = reservation.venueId as any;
    const payload = `${reservation._id}`;
    res.json({
      _id: reservation._id,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      status: reservation.status,
      bookingType: reservation.bookingType,
      totalPrice: reservation.totalPrice,
      partySize: reservation.partySize,
      venueName: v?.name,
      venueAddress: v?.address,
      venueCity: v?.city,
      tableNumber: (reservation.tableId as any)?.tableNumber,
      roomNumber: (reservation.roomId as any)?.roomNumber,
      seatNumber: (reservation.seatId as any)?.seatNumber,
      qrPayload: payload,
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// GET /api/reservations/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.userId,
    })
      .populate('tableId')
      .populate('roomId')
      .populate('seatId')
      .populate('venueId');
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

// PATCH /api/reservations/:id/cancel
router.patch('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    if (reservation.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Reservation already cancelled' });
    }
    reservation.status = 'CANCELLED';
    await reservation.save();
    res.json({ message: 'Reservation cancelled', reservation });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

export default router;

// src/config/database.ts
import mongoose from "mongoose";
var connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("\u274C MONGO_URI (or MONGODB_URI) is required. Set it in .env or environment.");
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoUri);
    console.log("\u2705 Connected to MongoDB");
  } catch (error) {
    console.error("\u274C MongoDB connection error:", error);
    process.exit(1);
  }
};

// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoose13 from "mongoose";
import dotenv from "dotenv";

// src/routes/venues.ts
import { Router } from "express";

// src/models/Venue.ts
import mongoose2, { Schema } from "mongoose";
var VenueSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["CAFE", "RESTAURANT", "HOTEL", "CINEMA"], required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    description: { type: String, required: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    startingPrice: { type: Number, default: 0 }
  },
  { timestamps: true }
);
VenueSchema.index({ city: 1, type: 1 });
VenueSchema.index({ name: "text", description: "text", city: "text" });
var Venue = mongoose2.model("Venue", VenueSchema);

// src/models/VenueMedia.ts
import mongoose3, { Schema as Schema2 } from "mongoose";
var VenueMediaSchema = new Schema2(
  {
    venueId: { type: Schema2.Types.ObjectId, ref: "Venue", required: true },
    kind: { type: String, enum: ["HERO_IMAGE", "GALLERY_IMAGE", "TOUR_360_VIDEO", "TOUR_360_EMBED_URL"], required: true },
    url: { type: String, required: true }
  },
  { timestamps: false }
);
VenueMediaSchema.index({ venueId: 1, kind: 1 });
var VenueMedia = mongoose3.model("VenueMedia", VenueMediaSchema);

// src/models/Table.ts
import mongoose4, { Schema as Schema3 } from "mongoose";
var TableSchema = new Schema3(
  {
    venueId: { type: Schema3.Types.ObjectId, ref: "Venue", required: true },
    tableNumber: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1 },
    locationLabel: { type: String, required: true },
    price: { type: Number, required: true },
    isVip: { type: Boolean, default: false }
  },
  { timestamps: false }
);
TableSchema.index({ venueId: 1, tableNumber: 1 }, { unique: true });
var Table = mongoose4.model("Table", TableSchema);

// src/models/Room.ts
import mongoose5, { Schema as Schema4 } from "mongoose";
var RoomSchema = new Schema4(
  {
    venueId: { type: Schema4.Types.ObjectId, ref: "Venue", required: true },
    roomNumber: { type: Number, required: true },
    roomType: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    pricePerNight: { type: Number, required: true }
  },
  { timestamps: false }
);
RoomSchema.index({ venueId: 1, roomNumber: 1 }, { unique: true });
var Room = mongoose5.model("Room", RoomSchema);

// src/models/Seat.ts
import mongoose6, { Schema as Schema5 } from "mongoose";
var SeatSchema = new Schema5(
  {
    venueId: { type: Schema5.Types.ObjectId, ref: "Venue", required: true },
    seatNumber: { type: Number, required: true },
    zone: { type: String, required: true },
    price: { type: Number, required: true }
  },
  { timestamps: false }
);
SeatSchema.index({ venueId: 1, seatNumber: 1 }, { unique: true });
var Seat = mongoose6.model("Seat", SeatSchema);

// src/models/TableHotspot.ts
import mongoose7, { Schema as Schema6 } from "mongoose";
var TableHotspotSchema = new Schema6(
  {
    venueId: { type: Schema6.Types.ObjectId, ref: "Venue", required: true },
    tableId: { type: Schema6.Types.ObjectId, ref: "Table", required: true },
    sceneId: { type: String, required: true },
    pitch: { type: Number, required: true },
    yaw: { type: Number, required: true },
    radius: { type: Number },
    label: { type: String }
  },
  { timestamps: false }
);
TableHotspotSchema.index({ venueId: 1, sceneId: 1 });
var TableHotspot = mongoose7.model("TableHotspot", TableHotspotSchema);

// src/models/Event.ts
import mongoose8, { Schema as Schema7 } from "mongoose";
var EventSchema = new Schema7(
  {
    venueId: { type: Schema7.Types.ObjectId, ref: "Venue", required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ["DJ", "CHANTEUR", "CONCERT", "SOIREE", "CINEMA"], required: true },
    startAt: { type: Date, required: true },
    description: { type: String, default: "" }
  },
  { timestamps: false }
);
EventSchema.index({ venueId: 1 });
EventSchema.index({ startAt: 1 });
var Event = mongoose8.model("Event", EventSchema);

// src/models/Reservation.ts
import mongoose9, { Schema as Schema8 } from "mongoose";
var ReservationSchema = new Schema8(
  {
    userId: { type: Schema8.Types.ObjectId, ref: "User", required: true },
    venueId: { type: Schema8.Types.ObjectId, ref: "Venue", required: true },
    bookingType: { type: String, enum: ["TABLE", "ROOM", "SEAT"], required: true },
    tableId: { type: Schema8.Types.ObjectId, ref: "Table" },
    roomId: { type: Schema8.Types.ObjectId, ref: "Room" },
    seatId: { type: Schema8.Types.ObjectId, ref: "Seat" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "CONFIRMED"
    },
    totalPrice: { type: Number, required: true, default: 0 },
    guestFirstName: { type: String },
    guestLastName: { type: String },
    guestPhone: { type: String },
    partySize: { type: Number }
  },
  { timestamps: true }
);
ReservationSchema.index({ tableId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ roomId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ seatId: 1, startAt: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ venueId: 1, bookingType: 1, startAt: 1 });
var Reservation = mongoose9.model("Reservation", ReservationSchema);

// src/routes/venues.ts
var router = Router();
router.get("/", async (req, res) => {
  try {
    const { type, city, hasEvent } = req.query;
    const filter = {};
    if (type) filter.type = String(type).toUpperCase();
    if (city) filter.city = city;
    let venues = await Venue.find(filter).sort({ rating: -1 }).lean();
    const venueIds = venues.map((v) => v._id);
    const venuesWithEvents = await Event.distinct("venueId", { venueId: { $in: venueIds } });
    if (hasEvent === "true") {
      venues = venues.filter((v) => venuesWithEvents.some((id) => id.toString() === v._id.toString()));
    }
    const result = await Promise.all(
      venues.map(async (venue) => {
        const tables = await Table.countDocuments({ venueId: venue._id });
        return {
          ...venue,
          availableTables: tables,
          hasEvent: venuesWithEvents.some((id) => id.toString() === venue._id.toString())
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching venues:", error);
    res.status(500).json({ error: "Failed to fetch venues" });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id).lean();
    if (!venue) return res.status(404).json({ error: "Venue not found" });
    const venueType = venue.type;
    const [media, tables, rooms, seats, hotspots, events] = await Promise.all([
      VenueMedia.find({ venueId: req.params.id }).lean(),
      venueType === "CAFE" || venueType === "RESTAURANT" ? Table.find({ venueId: req.params.id }).sort({ tableNumber: 1 }).lean() : [],
      venueType === "HOTEL" ? Room.find({ venueId: req.params.id }).sort({ roomNumber: 1 }).lean() : [],
      venueType === "CINEMA" ? Seat.find({ venueId: req.params.id }).sort({ seatNumber: 1 }).lean() : [],
      TableHotspot.find({ venueId: req.params.id }).populate("tableId").lean(),
      Event.find({ venueId: req.params.id }).sort({ startAt: 1 }).limit(10).lean()
    ]);
    const { startAt, endAt } = req.query;
    let tablesWithStatus = tables.map((t) => ({ ...t, status: "available" }));
    let roomsWithStatus = rooms.map((r) => ({ ...r, status: "available" }));
    let seatsWithStatus = seats.map((s) => ({ ...s, status: "available" }));
    if (startAt && endAt) {
      const start = new Date(startAt);
      const end = new Date(endAt);
      const overlapping = await Reservation.find({
        venueId: req.params.id,
        status: { $in: ["PENDING", "CONFIRMED"] },
        $or: [{ startAt: { $lt: end }, endAt: { $gt: start } }]
      });
      const reservedTableIds = new Set(overlapping.filter((r) => r.tableId).map((r) => r.tableId.toString()));
      const reservedRoomIds = new Set(overlapping.filter((r) => r.roomId).map((r) => r.roomId.toString()));
      const reservedSeatIds = new Set(overlapping.filter((r) => r.seatId).map((r) => r.seatId.toString()));
      tablesWithStatus = tables.map((t) => ({
        ...t,
        status: reservedTableIds.has(t._id.toString()) ? "reserved" : "available"
      }));
      roomsWithStatus = rooms.map((r) => ({
        ...r,
        status: reservedRoomIds.has(r._id.toString()) ? "reserved" : "available"
      }));
      seatsWithStatus = seats.map((s) => ({
        ...s,
        status: reservedSeatIds.has(s._id.toString()) ? "reserved" : "available"
      }));
    }
    res.json({
      ...venue,
      media,
      tables: tablesWithStatus,
      rooms: roomsWithStatus,
      seats: seatsWithStatus,
      hotspots: hotspots.map((h) => ({
        _id: h._id,
        venueId: h.venueId,
        tableId: h.tableId,
        sceneId: h.sceneId,
        pitch: h.pitch,
        yaw: h.yaw,
        radius: h.radius,
        label: h.label
      })),
      events
    });
  } catch (error) {
    console.error("Error fetching venue:", error);
    res.status(500).json({ error: "Failed to fetch venue" });
  }
});
var venues_default = router;

// src/routes/tables.ts
import { Router as Router2 } from "express";
var router2 = Router2();
router2.get("/venue/:venueId", async (req, res) => {
  try {
    const { venueId } = req.params;
    const { startAt, endAt } = req.query;
    const tables = await Table.find({ venueId }).sort({ tableNumber: 1 }).lean();
    if (startAt && endAt) {
      const start = new Date(startAt);
      const end = new Date(endAt);
      const overlapping = await Reservation.find({
        venueId,
        status: { $in: ["PENDING", "CONFIRMED"] },
        $or: [{ startAt: { $lt: end }, endAt: { $gt: start } }]
      });
      const reservedIds = new Set(
        overlapping.filter((r) => r.tableId != null).map((r) => r.tableId.toString())
      );
      const withStatus = tables.map((t) => ({
        ...t,
        status: reservedIds.has(t._id.toString()) ? "reserved" : "available"
      }));
      return res.json(withStatus);
    }
    res.json(tables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});
var tables_default = router2;

// src/routes/events.ts
import { Router as Router3 } from "express";
var router3 = Router3();
router3.get("/", async (req, res) => {
  try {
    const { city, type, venueId, upcoming } = req.query;
    const filter = {};
    if (upcoming !== "false") filter.startAt = { $gte: /* @__PURE__ */ new Date() };
    if (type) filter.type = type;
    if (venueId) filter.venueId = venueId;
    if (city) {
      const venueIds = await Venue.find({ city }).distinct("_id");
      filter.venueId = { $in: venueIds };
    }
    const events = await Event.find(filter).populate("venueId", "name address city").sort({ startAt: 1 });
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});
router3.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("venueId");
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});
var events_default = router3;

// src/routes/reservations.ts
import { Router as Router4 } from "express";

// src/middleware/auth.ts
import jwt from "jsonwebtoken";
var authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production");
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
var requireAdmin = (req, res, next) => {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// src/routes/reservations.ts
var router4 = Router4();
function overlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}
router4.post("/", authenticate, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    const { venueId, bookingType, tableId, roomId, seatId, startAt, endAt, totalPrice, guestFirstName, guestLastName, guestPhone, partySize } = req.body;
    if (!venueId || !startAt || !endAt) {
      return res.status(400).json({ error: "venueId, startAt and endAt are required" });
    }
    if (!guestFirstName?.trim()) return res.status(400).json({ error: "Pr\xE9nom est requis" });
    if (!guestLastName?.trim()) return res.status(400).json({ error: "Nom est requis" });
    if (!guestPhone?.trim()) return res.status(400).json({ error: "T\xE9l\xE9phone est requis" });
    const phone = String(guestPhone).trim().replace(/\s/g, "");
    if (!/^(\+216|216)?[0-9]{8}$/.test(phone) && !/^[0-9]{8}$/.test(phone)) {
      return res.status(400).json({ error: "Format t\xE9l\xE9phone invalide (ex: 12345678 ou +21612345678)" });
    }
    const party = Number(partySize) || 1;
    if (party < 1 || party > 20) return res.status(400).json({ error: "Nombre de personnes doit \xEAtre entre 1 et 20" });
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start >= end) return res.status(400).json({ error: "startAt must be before endAt" });
    const type = bookingType === "ROOM" || bookingType === "SEAT" ? bookingType : "TABLE";
    let total = Number(totalPrice) || 0;
    if (type === "TABLE") {
      if (!tableId) return res.status(400).json({ error: "tableId required for table booking" });
      const table = await Table.findOne({ _id: tableId, venueId });
      if (!table) return res.status(404).json({ error: "Table not found" });
      const tableCap = table.capacity ?? 4;
      if (party > tableCap) return res.status(400).json({ error: `Capacit\xE9 max: ${tableCap} personnes` });
      total = total || table.price;
      const existing = await Reservation.find({ tableId, status: { $in: ["PENDING", "CONFIRMED"] } });
      for (const r of existing) {
        if (overlaps(start, end, r.startAt, r.endAt))
          return res.status(409).json({ error: "This table is already reserved for the selected time." });
      }
    } else if (type === "ROOM") {
      if (!roomId) return res.status(400).json({ error: "roomId required for room booking" });
      const room = await Room.findOne({ _id: roomId, venueId });
      if (!room) return res.status(404).json({ error: "Room not found" });
      const roomCap = room.capacity ?? 4;
      if (party > roomCap) return res.status(400).json({ error: `Capacit\xE9 max: ${roomCap} personnes` });
      total = total || room.pricePerNight;
      const existing = await Reservation.find({ roomId, status: { $in: ["PENDING", "CONFIRMED"] } });
      for (const r of existing) {
        if (overlaps(start, end, r.startAt, r.endAt))
          return res.status(409).json({ error: "This room is already reserved for the selected nights." });
      }
    } else {
      if (!seatId) return res.status(400).json({ error: "seatId required for seat booking" });
      const seat = await Seat.findOne({ _id: seatId, venueId });
      if (!seat) return res.status(404).json({ error: "Seat not found" });
      if (party > 1) return res.status(400).json({ error: "1 place par si\xE8ge" });
      total = total || seat.price;
      const existing = await Reservation.find({ seatId, status: { $in: ["PENDING", "CONFIRMED"] } });
      for (const r of existing) {
        if (overlaps(start, end, r.startAt, r.endAt))
          return res.status(409).json({ error: "This seat is already reserved." });
      }
    }
    const reservation = new Reservation({
      userId: req.userId,
      venueId,
      bookingType: type,
      tableId: type === "TABLE" ? tableId : void 0,
      roomId: type === "ROOM" ? roomId : void 0,
      seatId: type === "SEAT" ? seatId : void 0,
      startAt: start,
      endAt: end,
      status: "CONFIRMED",
      totalPrice: total,
      guestFirstName: String(guestFirstName).trim(),
      guestLastName: String(guestLastName).trim(),
      guestPhone: phone,
      partySize: party
    });
    await reservation.save();
    await reservation.populate(["tableId", "roomId", "seatId", "venueId"]);
    res.status(201).json({
      message: "Reservation created",
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
        createdAt: reservation.createdAt
      }
    });
  } catch (error) {
    console.error("Error creating reservation:", error);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});
async function getMyReservations(req, res) {
  if (!req.userId) return res.status(401).json({ error: "Authentication required" });
  const list = await Reservation.find({ userId: req.userId }).populate("tableId", "tableNumber capacity locationLabel price isVip").populate("roomId", "roomNumber roomType capacity pricePerNight").populate("seatId", "seatNumber zone price").populate("venueId", "name address city").sort({ startAt: -1 });
  res.json(list);
}
router4.get(["/me", "/"], authenticate, async (req, res) => {
  try {
    await getMyReservations(req, res);
  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});
router4.get("/:id/ticket", authenticate, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate("venueId", "name address city").populate("tableId", "tableNumber capacity price").populate("roomId", "roomNumber roomType pricePerNight").populate("seatId", "seatNumber zone price").lean();
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    const v = reservation.venueId;
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
      tableNumber: reservation.tableId?.tableNumber,
      roomNumber: reservation.roomId?.roomNumber,
      seatNumber: reservation.seatId?.seatNumber,
      qrPayload: payload
    });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});
router4.get("/:id", authenticate, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate("tableId").populate("roomId").populate("seatId").populate("venueId");
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    res.json(reservation);
  } catch (error) {
    console.error("Error fetching reservation:", error);
    res.status(500).json({ error: "Failed to fetch reservation" });
  }
});
router4.patch("/:id/cancel", authenticate, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    if (reservation.status === "CANCELLED") {
      return res.status(400).json({ error: "Reservation already cancelled" });
    }
    reservation.status = "CANCELLED";
    await reservation.save();
    res.json({ message: "Reservation cancelled", reservation });
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    res.status(500).json({ error: "Failed to cancel reservation" });
  }
});
var reservations_default = router4;

// src/routes/auth.ts
import { Router as Router5 } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";
import crypto from "crypto";

// src/models/User.ts
import mongoose10, { Schema as Schema9 } from "mongoose";
var UserSchema = new Schema9(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["CUSTOMER", "ADMIN"], default: "CUSTOMER" }
  },
  { timestamps: true }
);
var User = mongoose10.model("User", UserSchema);

// src/models/RefreshToken.ts
import mongoose11, { Schema as Schema10 } from "mongoose";
var RefreshTokenSchema = new Schema10(
  {
    userId: { type: Schema10.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
var RefreshToken = mongoose11.model("RefreshToken", RefreshTokenSchema);

// src/routes/auth.ts
var router5 = Router5();
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  message: { error: "Trop de tentatives de connexion. R\xE9essayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});
var JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
var REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_SECRET || JWT_SECRET;
var ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
var REFRESH_EXPIRY_DAYS = 7;
var COOKIE_NAME = "refreshToken";
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function setRefreshCookie(res, token) {
  const maxAge = REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1e3;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/api/auth"
  });
}
function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/api/auth" });
}
router5.post(["/register", "/signup"], async (req, res) => {
  try {
    let { fullName, email, password, role } = req.body;
    if (!fullName && req.body.name) fullName = req.body.name;
    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ error: "Le nom complet est obligatoire." });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "L'email est obligatoire." });
    }
    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ error: "Adresse email invalide." });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Le mot de passe est obligatoire." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caract\xE8res." });
    }
    const emailLower = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(409).json({ error: "Un compte existe d\xE9j\xE0 avec cet email." });
    }
    const allowedRole = "CUSTOMER";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      fullName: fullName.trim(),
      email: emailLower,
      passwordHash,
      role: allowedRole
    });
    await user.save();
    const accessToken = jwt2.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    const refreshTokenValue = crypto.randomBytes(40).toString("hex");
    const refreshTokenDoc = new RefreshToken({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1e3)
    });
    await refreshTokenDoc.save();
    setRefreshCookie(res, refreshTokenValue);
    res.status(201).json({
      message: "Compte cr\xE9\xE9 avec succ\xE8s",
      accessToken,
      expiresIn: 900,
      // 15 min in seconds
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Erreur lors de la cr\xE9ation du compte." });
  }
});
router5.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe sont obligatoires." });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    const accessToken = jwt2.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    const refreshTokenValue = crypto.randomBytes(40).toString("hex");
    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1e3)
    });
    setRefreshCookie(res, refreshTokenValue);
    res.json({
      message: "Connexion r\xE9ussie",
      accessToken,
      expiresIn: 900,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Erreur de connexion." });
  }
});
router5.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: "Refresh token manquant." });
    }
    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < /* @__PURE__ */ new Date()) {
      if (stored) await RefreshToken.deleteOne({ _id: stored._id });
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Session expir\xE9e. Veuillez vous reconnecter." });
    }
    const user = await User.findById(stored.userId);
    if (!user) {
      await RefreshToken.deleteOne({ _id: stored._id });
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Utilisateur introuvable." });
    }
    await RefreshToken.deleteOne({ _id: stored._id });
    const newRefresh = crypto.randomBytes(40).toString("hex");
    await RefreshToken.create({
      userId: user._id,
      token: newRefresh,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1e3)
    });
    setRefreshCookie(res, newRefresh);
    const accessToken = jwt2.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    res.json({
      accessToken,
      expiresIn: 900,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({ error: "Erreur de renouvellement de session." });
  }
});
router5.get("/me", authenticate, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Non authentifi\xE9." });
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
    res.json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error("Error fetching me:", error);
    res.status(500).json({ error: "Erreur lors de la r\xE9cup\xE9ration du profil." });
  }
});
router5.post("/logout", authenticate, async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    clearRefreshCookie(res);
    res.json({ message: "D\xE9connexion r\xE9ussie." });
  } catch (error) {
    clearRefreshCookie(res);
    res.json({ message: "D\xE9connexion r\xE9ussie." });
  }
});
var auth_default = router5;

// src/routes/search.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q || q.length < 2) {
      return res.json({ lieux: [], chambres: [], evenements: [] });
    }
    const regex = new RegExp(q, "i");
    const [venues, rooms, events] = await Promise.all([
      Venue.find({
        $or: [
          { name: regex },
          { description: regex },
          { city: regex },
          { address: regex }
        ]
      }).lean().limit(10),
      Room.find().populate("venueId", "name city type").lean().then(
        (list) => list.filter(
          (r) => regex.test(r.venueId?.name || "") || regex.test(String(r.roomType)) || regex.test(r.venueId?.city || "")
        )
      ).then((list) => list.slice(0, 10)),
      Event.find({
        $or: [{ title: regex }, { description: regex }]
      }).populate("venueId", "name city").sort({ startAt: 1 }).lean().limit(10)
    ]);
    res.json({
      lieux: venues.map((v) => ({ type: "venue", _id: v._id, name: v.name, city: v.city, venueType: v.type })),
      chambres: rooms.map((r) => ({
        type: "room",
        _id: r._id,
        roomNumber: r.roomNumber,
        roomType: r.roomType,
        venueId: r.venueId?._id,
        venueName: r.venueId?.name,
        city: r.venueId?.city
      })),
      evenements: events.map((e) => ({
        type: "event",
        _id: e._id,
        title: e.title,
        startAt: e.startAt,
        venueId: e.venueId?._id,
        venueName: e.venueId?.name,
        city: e.venueId?.city
      }))
    });
  } catch (error) {
    console.error("Error searching:", error);
    res.status(500).json({ error: "Failed to search" });
  }
});
var search_default = router6;

// src/routes/admin.ts
import { Router as Router7 } from "express";
import mongoose12 from "mongoose";
var router7 = Router7();
router7.use(authenticate, requireAdmin);
function parseDays(query) {
  const d = parseInt(query || "30", 10);
  return Math.min(Math.max(d, 1), 90);
}
router7.get("/overview", async (req, res) => {
  try {
    const range = req.query.range || "30d";
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const now = /* @__PURE__ */ new Date();
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
      activeVenuesCount
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekStart } }),
      Venue.countDocuments(),
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: todayStart, $lt: todayEnd } }),
      Reservation.countDocuments({ status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: weekStart } }),
      Reservation.countDocuments({ status: "CANCELLED", createdAt: { $gte: start } }),
      Reservation.countDocuments({ status: { $in: ["PENDING", "CONFIRMED"] }, createdAt: { $gte: start } }),
      Reservation.aggregate([{ $match: { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } } }, { $group: { _id: null, sum: { $sum: "$totalPrice" } } }]).then((r) => r[0]?.sum ?? 0),
      Reservation.distinct("venueId", { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } }).then((ids) => ids.length)
    ]);
    const totalLast30 = cancelledLast30 + confirmedLast30;
    const cancellationRate = totalLast30 > 0 ? Math.round(cancelledLast30 / totalLast30 * 100) : 0;
    res.json({
      totalUsers,
      newUsers7d,
      totalVenues,
      totalReservations,
      reservationsToday,
      reservations7d,
      cancellationRate30d: cancellationRate,
      revenue30d,
      activeVenues30d: activeVenuesCount
    });
  } catch (error) {
    console.error("Error fetching admin overview:", error);
    res.status(500).json({ error: "Erreur lors du chargement des statistiques." });
  }
});
router7.get("/charts/reservations-daily", async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const result = await Reservation.aggregate([
      { $match: { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(result.map((r) => ({ date: r._id, count: r.count })));
  } catch (error) {
    console.error("Error fetching reservations-daily:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
router7.get("/charts/revenue-daily", async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const result = await Reservation.aggregate([
      { $match: { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startAt" } }, revenue: { $sum: "$totalPrice" } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(result.map((r) => ({ date: r._id, revenue: r.revenue })));
  } catch (error) {
    console.error("Error fetching revenue-daily:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
router7.get("/charts/reservations-by-type", async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const result = await Reservation.aggregate([
      { $match: { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } } },
      { $group: { _id: "$bookingType", count: { $sum: 1 } } }
    ]);
    const map = { TABLE: 0, ROOM: 0, SEAT: 0 };
    result.forEach((r) => {
      map[r._id] = r.count;
    });
    res.json([
      { type: "TABLE", count: map.TABLE, label: "Table" },
      { type: "ROOM", count: map.ROOM, label: "Chambre" },
      { type: "SEAT", count: map.SEAT, label: "Si\xE8ge" }
    ]);
  } catch (error) {
    console.error("Error fetching reservations-by-type:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
router7.get("/charts/reservations-by-city", async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const result = await Reservation.aggregate([
      { $match: { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } } },
      { $lookup: { from: "venues", localField: "venueId", foreignField: "_id", as: "venue" } },
      { $unwind: "$venue" },
      { $group: { _id: "$venue.city", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(result.map((r) => ({ city: r._id, count: r.count })));
  } catch (error) {
    console.error("Error fetching reservations-by-city:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
router7.get("/charts/top-venues", async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 20);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const result = await Reservation.aggregate([
      { $match: { status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: start } } },
      { $group: { _id: "$venueId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $lookup: { from: "venues", localField: "_id", foreignField: "_id", as: "venue" } },
      { $unwind: "$venue" },
      { $project: { venueName: "$venue.name", city: "$venue.city", count: 1 } }
    ]);
    res.json(result.map((r) => ({ venueName: r.venueName, city: r.city, count: r.count })));
  } catch (error) {
    console.error("Error fetching top-venues:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
router7.get("/charts/users-signups", async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const result = await User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(result.map((r) => ({ date: r._id, count: r.count })));
  } catch (error) {
    console.error("Error fetching users-signups:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
router7.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) filter.email = new RegExp(q, "i");
    const [users, total] = await Promise.all([
      User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    const userIds = users.map((u) => u._id);
    const resCounts = await Reservation.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    resCounts.forEach((r) => {
      countMap[r._id.toString()] = r.count;
    });
    const usersWithCount = users.map((u) => ({
      ...u,
      reservationsCount: countMap[u._id.toString()] ?? 0
    }));
    res.json({ users: usersWithCount, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Erreur lors du chargement des utilisateurs." });
  }
});
router7.get("/venues", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const type = req.query.type;
    const city = req.query.city;
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (type) filter.type = type;
    if (city) filter.city = city;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { city: new RegExp(q, "i") },
        { description: new RegExp(q, "i") }
      ];
    }
    const [venues, total] = await Promise.all([
      Venue.find(filter).sort({ rating: -1 }).skip(skip).limit(limit).lean(),
      Venue.countDocuments(filter)
    ]);
    const venueIds = venues.map((v) => v._id);
    const resCounts = await Reservation.aggregate([
      { $match: { venueId: { $in: venueIds }, status: { $in: ["PENDING", "CONFIRMED"] } } },
      { $group: { _id: "$venueId", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    resCounts.forEach((r) => {
      countMap[r._id.toString()] = r.count;
    });
    const venuesWithCount = venues.map((v) => ({
      ...v,
      reservationsCount: countMap[v._id.toString()] ?? 0
    }));
    res.json({ venues: venuesWithCount, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching venues:", error);
    res.status(500).json({ error: "Erreur lors du chargement des lieux." });
  }
});
router7.get("/reservations", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const type = req.query.type;
    const city = req.query.city;
    const venueId = req.query.venueId;
    const from = req.query.from;
    const to = req.query.to;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.bookingType = type;
    if (venueId && mongoose12.Types.ObjectId.isValid(venueId)) filter.venueId = venueId;
    if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = new Date(from);
      if (to) filter.startAt.$lte = new Date(to);
    }
    if (city) {
      const venueIdsInCity = await Venue.find({ city }).distinct("_id");
      filter.venueId = { $in: venueIdsInCity };
    }
    const [list, total] = await Promise.all([
      Reservation.find(filter).populate("userId", "fullName email").populate("venueId", "name city type").populate("tableId", "tableNumber price").populate("roomId", "roomNumber pricePerNight").populate("seatId", "seatNumber price").sort({ startAt: -1 }).skip(skip).limit(limit).lean(),
      Reservation.countDocuments(filter)
    ]);
    res.json({ reservations: list, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).json({ error: "Erreur lors du chargement des r\xE9servations." });
  }
});
router7.get("/events", async (req, res) => {
  try {
    const events = await Event.find().populate("venueId", "name city").sort({ startAt: 1 }).limit(100).lean();
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Erreur lors du chargement des \xE9v\xE9nements." });
  }
});
router7.patch("/reservations/:id/cancel", async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "R\xE9servation introuvable." });
    if (r.status === "CANCELLED") return res.status(400).json({ error: "D\xE9j\xE0 annul\xE9e." });
    r.status = "CANCELLED";
    await r.save();
    res.json({ message: "R\xE9servation annul\xE9e.", reservation: r });
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    res.status(500).json({ error: "Erreur lors de l'annulation." });
  }
});
router7.get("/stats", async (req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const [totalUsers, totalVenues, reservationsToday, reservationsWeek, upcomingEvents] = await Promise.all([
      User.countDocuments(),
      Venue.countDocuments(),
      Reservation.countDocuments({ status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: todayStart, $lt: todayEnd } }),
      Reservation.countDocuments({ status: { $in: ["PENDING", "CONFIRMED"] }, startAt: { $gte: weekStart } }),
      Event.countDocuments({ startAt: { $gte: now } })
    ]);
    res.json({
      totalUsers,
      totalVenues,
      reservationsToday,
      reservationsWeek,
      upcomingEvents
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ error: "Erreur." });
  }
});
var admin_default = router7;

// src/app.ts
dotenv.config();
var app = express();
var CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173";
var ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://mareservtaion-frontend.vercel.app",
  CORS_ORIGIN
].filter(Boolean);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, origin || ALLOWED_ORIGINS[0]);
    else cb(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
var apiInfo = (req, res) => {
  res.status(200).json({
    name: "MaTable API",
    version: "1.0",
    docs: "/health",
    message: "Use /api/* endpoints. Health check at /health"
  });
};
app.get("/", apiInfo);
app.get("/api", apiInfo);
app.get("/health", (req, res) => {
  const dbConnected2 = mongoose13.connection.readyState === 1;
  res.status(dbConnected2 ? 200 : 503).json({
    status: dbConnected2 ? "ok" : "degraded",
    db: dbConnected2 ? "connected" : "disconnected",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());
app.get("/api/favicon.ico", (req, res) => res.status(204).end());
app.get("/api/favicon.png", (req, res) => res.status(204).end());
app.use("/api/venues", venues_default);
app.use("/api/tables", tables_default);
app.use("/api/events", events_default);
app.use("/api/reservations", reservations_default);
app.use("/api/auth", auth_default);
app.use("/api/search", search_default);
app.use("/api/admin", admin_default);
app.use((err, req, res) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
    message: "Use /api/* endpoints. Health check at /health"
  });
});
var app_default = app;

// src/vercel-handler.ts
var dbConnected = false;
async function ensureDb() {
  if (!dbConnected) {
    await connectDatabase();
    dbConnected = true;
  }
}
async function handler(req, res) {
  await ensureDb();
  return app_default(req, res);
}
export {
  handler as default
};

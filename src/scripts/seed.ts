import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { VenueMedia } from '../models/VenueMedia';
import { Table } from '../models/Table';
import { TableHotspot } from '../models/TableHotspot';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { Event } from '../models/Event';
import { Reservation } from '../models/Reservation';
import { RefreshToken } from '../models/RefreshToken';
import bcrypt from 'bcryptjs';

dotenv.config();

const PASSWORD = 'password123';

// Klapty 360°: store ONLY the official tunnel embed URL (https://www.klapty.com/tour/tunnel/<TOUR_ID>).
// Do NOT use storage.klapty.com or public page URLs (/p/.../t/...). Get tunnel IDs from Klapty dashboard.
const KLAPTY_TUNNEL = {
  cafe1: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  cafe2: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  restaurant: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  hotel: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  cinema: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
};

function assertValidKlaptyTunnelUrl(url: string, label: string): void {
  if (!url || typeof url !== 'string' || !url.includes('www.klapty.com/tour/tunnel/')) {
    throw new Error(
      `[Seed] Invalid Klapty URL for ${label}: must be https://www.klapty.com/tour/tunnel/<TOUR_ID>. Got: ${url}`
    );
  }
  if (url.toLowerCase().includes('storage.klapty.com') || url.includes('/p/')) {
    throw new Error(`[Seed] Invalid Klapty URL for ${label}: do not use storage.klapty.com or /p/ public pages. Got: ${url}`);
  }
}

async function seed() {
  Object.entries(KLAPTY_TUNNEL).forEach(([key, url]) => assertValidKlaptyTunnelUrl(url, key));
  await connectDatabase();

  await RefreshToken.deleteMany({});
  await Reservation.deleteMany({});
  await Seat.deleteMany({});
  await Room.deleteMany({});
  await Table.deleteMany({});
  await Event.deleteMany({});
  await VenueMedia.deleteMany({});
  await Venue.deleteMany({});
  await User.deleteMany({});

  console.log('🗑️  Cleared existing data');

  const hash = await bcrypt.hash(PASSWORD, 10);

  await User.create({
    fullName: 'Admin Ma Reservation',
    email: 'admin@mareservation.tn',
    passwordHash: hash,
    role: 'ADMIN',
  });

  const customers = await User.insertMany([
    { fullName: 'Rania Ben Salem', email: 'client1@example.com', passwordHash: hash, role: 'CUSTOMER' },
    { fullName: 'Karim Trabelsi', email: 'client2@example.com', passwordHash: hash, role: 'CUSTOMER' },
    { fullName: 'Amira Jlassi', email: 'client3@example.com', passwordHash: hash, role: 'CUSTOMER' },
    { fullName: 'Youssef Ben Ammar', email: 'client4@example.com', passwordHash: hash, role: 'CUSTOMER' },
    { fullName: 'Sarra Gharbi', email: 'client5@example.com', passwordHash: hash, role: 'CUSTOMER' },
  ]);

  console.log('👤 Created 1 admin, 5 customers');

  const heroImages = [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80',
  ];

  // Café 1 — max 2 tables
  const cafe1 = await Venue.create({
    name: 'Babol Coffee',
    type: 'CAFE',
    city: 'Tunis',
    address: 'Avenue Habib Bourguiba, Tunis',
    description: 'Café cosy avec vue. Thé, café et pâtisseries.',
    rating: 4.8,
    startingPrice: 12,
  });
  await VenueMedia.insertMany([
    { venueId: cafe1._id, kind: 'HERO_IMAGE', url: heroImages[0] },
    { venueId: cafe1._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cafe1 },
  ]);
  const cafe1Tables = await Table.insertMany([
    { venueId: cafe1._id, tableNumber: 1, capacity: 2, locationLabel: 'Fenêtre', price: 12, isVip: false },
    { venueId: cafe1._id, tableNumber: 2, capacity: 4, locationLabel: 'Centre', price: 15, isVip: false },
  ]);
  await TableHotspot.insertMany([
    { venueId: cafe1._id, tableId: cafe1Tables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.6 },
    { venueId: cafe1._id, tableId: cafe1Tables[1]._id, sceneId: 'default', pitch: 0, yaw: 0.6 },
  ]);

  // Café 2 — max 2 tables
  const cafe2 = await Venue.create({
    name: 'Ashkal Arabia',
    type: 'CAFE',
    city: 'Sidi Bou Said',
    address: 'Rue de la Corniche, Sidi Bou Said',
    description: 'Café avec terrasse et vue mer.',
    rating: 4.9,
    startingPrice: 14,
  });
  await VenueMedia.insertMany([
    { venueId: cafe2._id, kind: 'HERO_IMAGE', url: heroImages[1] },
    { venueId: cafe2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cafe2 },
  ]);
  const cafe2Tables = await Table.insertMany([
    { venueId: cafe2._id, tableNumber: 1, capacity: 2, locationLabel: 'Terrasse', price: 14, isVip: false },
    { venueId: cafe2._id, tableNumber: 2, capacity: 2, locationLabel: 'Intérieur', price: 12, isVip: false },
  ]);
  await TableHotspot.insertMany([
    { venueId: cafe2._id, tableId: cafe2Tables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.5 },
    { venueId: cafe2._id, tableId: cafe2Tables[1]._id, sceneId: 'default', pitch: 0, yaw: 0.5 },
  ]);

  // Restaurant
  const restaurant = await Venue.create({
    name: 'Il Monte Cristo',
    type: 'RESTAURANT',
    city: 'Tunis',
    address: 'La Goulette, Tunis',
    description: 'Restaurant italien et méditerranéen. Cuisine raffinée.',
    rating: 4.7,
    startingPrice: 45,
  });
  await VenueMedia.insertMany([
    { venueId: restaurant._id, kind: 'HERO_IMAGE', url: heroImages[2] },
    { venueId: restaurant._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.restaurant },
  ]);
  const restaurantTables = await Table.insertMany([
    { venueId: restaurant._id, tableNumber: 1, capacity: 2, locationLabel: 'Fenêtre', price: 45, isVip: false },
    { venueId: restaurant._id, tableNumber: 2, capacity: 4, locationLabel: 'Salle', price: 55, isVip: true },
    { venueId: restaurant._id, tableNumber: 3, capacity: 6, locationLabel: 'Terrasse', price: 65, isVip: false },
  ]);
  await TableHotspot.insertMany([
    { venueId: restaurant._id, tableId: restaurantTables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.7 },
    { venueId: restaurant._id, tableId: restaurantTables[1]._id, sceneId: 'default', pitch: 0, yaw: 0 },
    { venueId: restaurant._id, tableId: restaurantTables[2]._id, sceneId: 'default', pitch: 0, yaw: 0.7 },
  ]);

  // Hotel — multiple rooms
  const hotel = await Venue.create({
    name: 'Hôtel Le Padirac',
    type: 'HOTEL',
    city: 'Hammamet',
    address: 'Zone Touristique, Hammamet',
    description: 'Hôtel 4 étoiles avec piscine et spa. Chambres avec vue mer.',
    rating: 4.6,
    startingPrice: 120,
  });
  await VenueMedia.insertMany([
    { venueId: hotel._id, kind: 'HERO_IMAGE', url: heroImages[3] },
    { venueId: hotel._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.hotel },
  ]);
  const hotelRooms = await Room.insertMany([
    { venueId: hotel._id, roomNumber: 101, roomType: 'Standard', capacity: 2, pricePerNight: 120 },
    { venueId: hotel._id, roomNumber: 102, roomType: 'Standard', capacity: 2, pricePerNight: 120 },
    { venueId: hotel._id, roomNumber: 201, roomType: 'Vue mer', capacity: 3, pricePerNight: 180 },
    { venueId: hotel._id, roomNumber: 202, roomType: 'Suite', capacity: 4, pricePerNight: 250 },
  ]);

  // Cinema — 3 seats
  const cinema = await Venue.create({
    name: 'CGR Salle Premium',
    type: 'CINEMA',
    city: 'Tunis',
    address: 'Centre commercial, Tunis',
    description: 'Salle de cinéma premium. Son et image haute définition.',
    rating: 4.5,
    startingPrice: 25,
  });
  await VenueMedia.insertMany([
    { venueId: cinema._id, kind: 'HERO_IMAGE', url: heroImages[4] },
    { venueId: cinema._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cinema },
  ]);
  const cinemaSeats = await Seat.insertMany([
    { venueId: cinema._id, seatNumber: 1, zone: 'Centre', price: 25 },
    { venueId: cinema._id, seatNumber: 2, zone: 'Centre', price: 25 },
    { venueId: cinema._id, seatNumber: 3, zone: 'Vip', price: 35 },
  ]);

  console.log('🏢 Created 5 venues: 2 cafés (2 tables each), 1 restaurant, 1 hotel (4 rooms), 1 cinema (3 seats)');

  const now = new Date();
  await Event.insertMany([
    { venueId: cafe1._id, title: 'Soirée Jazz', type: 'CONCERT', startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000), description: 'Concert jazz en live.' },
    { venueId: restaurant._id, title: 'Dîner aux chandelles', type: 'SOIREE', startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000), description: 'Soirée spéciale.' },
    { venueId: cinema._id, title: 'Avant-première', type: 'CINEMA', startAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000), description: 'Projection en avant-première.' },
  ]);
  console.log('📅 Created 3 events');

  const twoHours = 2 * 60 * 60 * 1000;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  dayAfter.setHours(19, 30, 0, 0);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 3);
  lastWeek.setHours(21, 0, 0, 0);

  const customerId = customers[0]._id;
  await Reservation.insertMany([
    { userId: customerId, venueId: cafe1._id, bookingType: 'TABLE', tableId: cafe1Tables[0]._id, startAt: tomorrow, endAt: new Date(tomorrow.getTime() + twoHours), status: 'CONFIRMED', totalPrice: 12 },
    { userId: customerId, venueId: restaurant._id, bookingType: 'TABLE', tableId: restaurantTables[0]._id, startAt: dayAfter, endAt: new Date(dayAfter.getTime() + twoHours), status: 'CONFIRMED', totalPrice: 45 },
    { userId: customerId, venueId: hotel._id, bookingType: 'ROOM', roomId: hotelRooms[0]._id, startAt: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000), endAt: new Date(tomorrow.getTime() + 9 * 24 * 60 * 60 * 1000), status: 'CONFIRMED', totalPrice: 240 },
    { userId: customerId, venueId: cinema._id, bookingType: 'SEAT', seatId: cinemaSeats[0]._id, startAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000), endAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000), status: 'CONFIRMED', totalPrice: 25 },
    { userId: customerId, venueId: cafe2._id, bookingType: 'TABLE', tableId: cafe2Tables[1]._id, startAt: lastWeek, endAt: new Date(lastWeek.getTime() + twoHours), status: 'CONFIRMED', totalPrice: 12 },
  ]);
  console.log('📅 Created 5 sample reservations for client1@example.com (table, table, room, seat, past table)');

  console.log('\n✅ Seed completed.');
  console.log('\n📝 Credentials (password: ' + PASSWORD + ')');
  console.log('  Admin:   admin@mareservation.tn');
  console.log('  Customer (with reservations): client1@example.com');
  console.log('  Customers: client2@example.com, client3@example.com, client4@example.com, client5@example.com');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});

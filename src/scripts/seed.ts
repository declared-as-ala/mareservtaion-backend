import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { VenueMedia } from '../models/VenueMedia';
import { Category } from '../models/Category';
import { VirtualTour } from '../models/VirtualTour';
import { TourHotspot } from '../models/TourHotspot';
import { Table } from '../models/Table';
import { TableHotspot } from '../models/TableHotspot';
import { Room } from '../models/Room';
import { Seat } from '../models/Seat';
import { Event } from '../models/Event';
import { Reservation } from '../models/Reservation';
import { RefreshToken } from '../models/RefreshToken';
import { generateConfirmationCode } from '../utils/confirmationCode';
import bcrypt from 'bcryptjs';

dotenv.config();

const PASSWORD = 'password123';

// Klapty 360°: store ONLY the official tunnel embed URL (https://www.klapty.com/tour/tunnel/<TOUR_ID>).
const KLAPTY_TUNNEL = {
  cafe1: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  cafe2: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  restaurant: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  restaurant2: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  hotel: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  hotel2: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  cinema: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  cinema2: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  eventSpace1: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
  eventSpace2: 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq',
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

// Convert pitch/yaw (radians) to xPercent/yPercent for overlay
function pitchYawToPercent(pitch: number, yaw: number): { xPercent: number; yPercent: number } {
  const xPercent = ((yaw + Math.PI) / (2 * Math.PI)) * 100;
  const yPercent = ((Math.PI / 2 - pitch) / Math.PI) * 100;
  return { xPercent: Math.max(0, Math.min(100, xPercent)), yPercent: Math.max(0, Math.min(100, yPercent)) };
}

async function seed() {
  Object.entries(KLAPTY_TUNNEL).forEach(([key, url]) => assertValidKlaptyTunnelUrl(url, key));
  await connectDatabase();

  await RefreshToken.deleteMany({});
  await Reservation.deleteMany({});
  await TourHotspot.deleteMany({});
  await VirtualTour.deleteMany({});
  await TableHotspot.deleteMany({});
  await Seat.deleteMany({});
  await Room.deleteMany({});
  await Table.deleteMany({});
  await Event.deleteMany({});
  await VenueMedia.deleteMany({});
  await Venue.deleteMany({});
  await Category.deleteMany({});
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

  const categories = await Category.insertMany([
    { name: 'Cafés', slug: 'cafes', type: 'primary', displayOrder: 1 },
    { name: 'Restaurants', slug: 'restaurants', type: 'primary', displayOrder: 2 },
    { name: 'Hôtels', slug: 'hotels', type: 'primary', displayOrder: 3 },
    { name: 'Cinéma', slug: 'cinema', type: 'primary', displayOrder: 4 },
    { name: 'Événements', slug: 'evenements', type: 'primary', displayOrder: 5 },
  ]);
  const catCafes = categories[0]._id;
  const catRestaurants = categories[1]._id;
  const catHotels = categories[2]._id;
  const catCinema = categories[3]._id;
  const catEvenements = categories[4]._id;
  console.log('📁 Created 5 categories');

  const heroImages = [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
  ];

  // Café 1
  const cafe1 = await Venue.create({
    name: 'Babol Coffee',
    slug: 'babol-coffee-tunis',
    type: 'CAFE',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Avenue Habib Bourguiba, Tunis',
    shortDescription: 'Café cosy avec vue.',
    description: 'Café cosy avec vue. Thé, café et pâtisseries.',
    rating: 4.8,
    ratingCount: 120,
    startingPrice: 12,
    priceRangeMin: 8,
    priceRangeMax: 25,
    categoryIds: [catCafes],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
    { venueId: cafe1._id, kind: 'HERO_IMAGE', url: heroImages[0] },
    { venueId: cafe1._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cafe1 },
  ]);
  const cafe1Tables = await Table.insertMany([
    { venueId: cafe1._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Fenêtre', price: 12, basePrice: 12, isVip: false },
    { venueId: cafe1._id, tableNumber: 2, code: 'T2', capacity: 4, locationLabel: 'Centre', price: 15, basePrice: 15, isVip: false },
  ]);
  const tour1 = await VirtualTour.create({ venueId: cafe1._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.cafe1, isActive: true });
  await TableHotspot.insertMany([
    { venueId: cafe1._id, tableId: cafe1Tables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.6 },
    { venueId: cafe1._id, tableId: cafe1Tables[1]._id, sceneId: 'default', pitch: 0, yaw: 0.6 },
  ]);
  const p1 = pitchYawToPercent(0, -0.6);
  const p2 = pitchYawToPercent(0, 0.6);
  await TourHotspot.insertMany([
    { virtualTourId: tour1._id, label: 'Table 1', targetType: 'table', targetId: cafe1Tables[0]._id, xPercent: p1.xPercent, yPercent: p1.yPercent, isActive: true },
    { virtualTourId: tour1._id, label: 'Table 2', targetType: 'table', targetId: cafe1Tables[1]._id, xPercent: p2.xPercent, yPercent: p2.yPercent, isActive: true },
  ]);

  // Café 2
  const cafe2 = await Venue.create({
    name: 'Ashkal Arabia',
    slug: 'ashkal-arabia-sidi-bou-said',
    type: 'CAFE',
    city: 'Sidi Bou Said',
    governorate: 'Tunis',
    address: 'Rue de la Corniche, Sidi Bou Said',
    shortDescription: 'Café avec terrasse et vue mer.',
    description: 'Café avec terrasse et vue mer.',
    rating: 4.9,
    ratingCount: 85,
    startingPrice: 14,
    priceRangeMin: 10,
    priceRangeMax: 22,
    categoryIds: [catCafes],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
    { venueId: cafe2._id, kind: 'HERO_IMAGE', url: heroImages[1] },
    { venueId: cafe2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cafe2 },
  ]);
  const cafe2Tables = await Table.insertMany([
    { venueId: cafe2._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Terrasse', price: 14, basePrice: 14, isVip: false },
    { venueId: cafe2._id, tableNumber: 2, code: 'T2', capacity: 2, locationLabel: 'Intérieur', price: 12, basePrice: 12, isVip: false },
  ]);
  const tour2 = await VirtualTour.create({ venueId: cafe2._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.cafe2, isActive: true });
  await TableHotspot.insertMany([
    { venueId: cafe2._id, tableId: cafe2Tables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.5 },
    { venueId: cafe2._id, tableId: cafe2Tables[1]._id, sceneId: 'default', pitch: 0, yaw: 0.5 },
  ]);
  const p3 = pitchYawToPercent(0, -0.5);
  const p4 = pitchYawToPercent(0, 0.5);
  await TourHotspot.insertMany([
    { virtualTourId: tour2._id, label: 'Table 1', targetType: 'table', targetId: cafe2Tables[0]._id, xPercent: p3.xPercent, yPercent: p3.yPercent, isActive: true },
    { virtualTourId: tour2._id, label: 'Table 2', targetType: 'table', targetId: cafe2Tables[1]._id, xPercent: p4.xPercent, yPercent: p4.yPercent, isActive: true },
  ]);

  // Restaurant 1
  const restaurant = await Venue.create({
    name: 'Il Monte Cristo',
    slug: 'il-monte-cristo-tunis',
    type: 'RESTAURANT',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'La Goulette, Tunis',
    shortDescription: 'Restaurant italien et méditerranéen.',
    description: 'Restaurant italien et méditerranéen. Cuisine raffinée.',
    rating: 4.7,
    ratingCount: 200,
    startingPrice: 45,
    priceRangeMin: 35,
    priceRangeMax: 80,
    categoryIds: [catRestaurants],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
    { venueId: restaurant._id, kind: 'HERO_IMAGE', url: heroImages[2] },
    { venueId: restaurant._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.restaurant },
  ]);
  const restaurantTables = await Table.insertMany([
    { venueId: restaurant._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Fenêtre', price: 45, basePrice: 45, isVip: false },
    { venueId: restaurant._id, tableNumber: 2, code: 'T2', capacity: 4, locationLabel: 'Salle', price: 55, basePrice: 55, isVip: true },
    { venueId: restaurant._id, tableNumber: 3, code: 'T3', capacity: 6, locationLabel: 'Terrasse', price: 65, basePrice: 65, isVip: false },
  ]);
  const tourRest = await VirtualTour.create({ venueId: restaurant._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.restaurant, isActive: true });
  await TableHotspot.insertMany([
    { venueId: restaurant._id, tableId: restaurantTables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.7 },
    { venueId: restaurant._id, tableId: restaurantTables[1]._id, sceneId: 'default', pitch: 0, yaw: 0 },
    { venueId: restaurant._id, tableId: restaurantTables[2]._id, sceneId: 'default', pitch: 0, yaw: 0.7 },
  ]);
  await TourHotspot.insertMany([
    { virtualTourId: tourRest._id, label: 'Table 1', targetType: 'table', targetId: restaurantTables[0]._id, xPercent: pitchYawToPercent(0, -0.7).xPercent, yPercent: pitchYawToPercent(0, -0.7).yPercent, isActive: true },
    { virtualTourId: tourRest._id, label: 'Table 2', targetType: 'table', targetId: restaurantTables[1]._id, xPercent: 50, yPercent: 50, isActive: true },
    { virtualTourId: tourRest._id, label: 'Table 3', targetType: 'table', targetId: restaurantTables[2]._id, xPercent: pitchYawToPercent(0, 0.7).xPercent, yPercent: pitchYawToPercent(0, 0.7).yPercent, isActive: true },
  ]);

  // Restaurant 2
  const restaurant2 = await Venue.create({
    name: 'Le Golfe',
    slug: 'le-golfe-sousse',
    type: 'RESTAURANT',
    city: 'Sousse',
    governorate: 'Sousse',
    address: 'Corniche de Sousse',
    shortDescription: 'Fruits de mer et vue sur le golfe.',
    description: 'Restaurant de fruits de mer avec vue sur le golfe. Spécialités tunisiennes.',
    rating: 4.6,
    ratingCount: 150,
    startingPrice: 55,
    priceRangeMin: 40,
    priceRangeMax: 90,
    categoryIds: [catRestaurants],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
    { venueId: restaurant2._id, kind: 'HERO_IMAGE', url: heroImages[6] },
    { venueId: restaurant2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.restaurant2 },
  ]);
  const restaurant2Tables = await Table.insertMany([
    { venueId: restaurant2._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Vue mer', price: 55, basePrice: 55, isVip: false },
    { venueId: restaurant2._id, tableNumber: 2, code: 'T2', capacity: 4, locationLabel: 'Terrasse', price: 60, basePrice: 60, isVip: false },
  ]);

  // Hotel 1
  const hotel = await Venue.create({
    name: 'Hôtel Le Padirac',
    slug: 'hotel-le-padirac-hammamet',
    type: 'HOTEL',
    city: 'Hammamet',
    governorate: 'Nabeul',
    address: 'Zone Touristique, Hammamet',
    shortDescription: 'Hôtel 4 étoiles avec piscine et spa.',
    description: 'Hôtel 4 étoiles avec piscine et spa. Chambres avec vue mer.',
    rating: 4.6,
    ratingCount: 320,
    startingPrice: 120,
    priceRangeMin: 100,
    priceRangeMax: 280,
    categoryIds: [catHotels],
    isPublished: true,
    isFeatured: true,
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
  const tourHotel = await VirtualTour.create({ venueId: hotel._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.hotel, isActive: true });
  await TourHotspot.insertMany([
    { virtualTourId: tourHotel._id, label: 'Chambre 101', targetType: 'room', targetId: hotelRooms[0]._id, xPercent: 25, yPercent: 50, isActive: true },
    { virtualTourId: tourHotel._id, label: 'Chambre 102', targetType: 'room', targetId: hotelRooms[1]._id, xPercent: 75, yPercent: 50, isActive: true },
  ]);

  // Hotel 2
  const hotel2 = await Venue.create({
    name: 'Dar Hi',
    slug: 'dar-hi-nefta',
    type: 'HOTEL',
    city: 'Nefta',
    governorate: 'Tozeur',
    address: 'Nefta, Tozeur',
    shortDescription: 'Écolodge de charme en bord d\'oasis.',
    description: 'Écolodge de charme en bord d\'oasis. Piscine et spa.',
    rating: 4.8,
    ratingCount: 95,
    startingPrice: 180,
    priceRangeMin: 150,
    priceRangeMax: 350,
    categoryIds: [catHotels],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
    { venueId: hotel2._id, kind: 'HERO_IMAGE', url: heroImages[7] },
    { venueId: hotel2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.hotel2 },
  ]);
  await Room.insertMany([
    { venueId: hotel2._id, roomNumber: 1, roomType: 'Pavillon', capacity: 2, pricePerNight: 180 },
    { venueId: hotel2._id, roomNumber: 2, roomType: 'Suite', capacity: 4, pricePerNight: 280 },
  ]);

  // Cinema 1
  const cinema = await Venue.create({
    name: 'CGR Salle Premium',
    slug: 'cgr-salle-premium-tunis',
    type: 'CINEMA',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Centre commercial, Tunis',
    shortDescription: 'Salle de cinéma premium.',
    description: 'Salle de cinéma premium. Son et image haute définition.',
    rating: 4.5,
    ratingCount: 400,
    startingPrice: 25,
    priceRangeMin: 20,
    priceRangeMax: 40,
    categoryIds: [catCinema],
    isPublished: true,
    isFeatured: true,
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
  const tourCinema = await VirtualTour.create({ venueId: cinema._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.cinema, isActive: true });
  await TourHotspot.insertMany([
    { virtualTourId: tourCinema._id, label: 'Zone Centre', targetType: 'seat_zone', targetId: cinemaSeats[0]._id, xPercent: 40, yPercent: 50, isActive: true },
    { virtualTourId: tourCinema._id, label: 'Zone Vip', targetType: 'seat_zone', targetId: cinemaSeats[2]._id, xPercent: 60, yPercent: 50, isActive: true },
  ]);

  // Cinema 2
  const cinema2 = await Venue.create({
    name: 'Ciné Madart',
    slug: 'cine-madart-sfax',
    type: 'CINEMA',
    city: 'Sfax',
    governorate: 'Sfax',
    address: 'Avenue de la République, Sfax',
    shortDescription: 'Complexe cinéma multi-salles.',
    description: 'Complexe cinéma multi-salles. Événements et avant-premières.',
    rating: 4.4,
    ratingCount: 180,
    startingPrice: 22,
    priceRangeMin: 18,
    priceRangeMax: 35,
    categoryIds: [catCinema],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
    { venueId: cinema2._id, kind: 'HERO_IMAGE', url: heroImages[8] },
    { venueId: cinema2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cinema2 },
  ]);
  await Seat.insertMany([
    { venueId: cinema2._id, seatNumber: 1, zone: 'A', price: 22 },
    { venueId: cinema2._id, seatNumber: 2, zone: 'A', price: 22 },
    { venueId: cinema2._id, seatNumber: 3, zone: 'B', price: 28 },
  ]);

  // Event space 1
  const eventSpace1 = await Venue.create({
    name: 'Espace Culturel El Teatro',
    slug: 'el-teatro-tunis',
    type: 'EVENT_SPACE',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Avenue Mohamed V, Tunis',
    shortDescription: 'Salle de spectacles et événements.',
    description: 'Salle de spectacles, concerts et événements privés. Capacité 300 personnes.',
    rating: 4.7,
    ratingCount: 75,
    startingPrice: 50,
    priceRangeMin: 30,
    priceRangeMax: 120,
    categoryIds: [catEvenements],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
    { venueId: eventSpace1._id, kind: 'HERO_IMAGE', url: heroImages[5] },
    { venueId: eventSpace1._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.eventSpace1 },
  ]);
  const eventSpace1Tables = await Table.insertMany([
    { venueId: eventSpace1._id, tableNumber: 1, code: 'VIP1', capacity: 4, locationLabel: 'Scène', price: 120, basePrice: 120, isVip: true },
    { venueId: eventSpace1._id, tableNumber: 2, code: 'T2', capacity: 6, locationLabel: 'Salon', price: 80, basePrice: 80, isVip: false },
  ]);

  // Event space 2
  const eventSpace2 = await Venue.create({
    name: 'Rooftop Monastir',
    slug: 'rooftop-monastir',
    type: 'EVENT_SPACE',
    city: 'Monastir',
    governorate: 'Monastir',
    address: 'Corniche de Monastir',
    shortDescription: 'Rooftop événements et soirées.',
    description: 'Rooftop avec vue mer. Soirées privées et événements.',
    rating: 4.6,
    ratingCount: 60,
    startingPrice: 70,
    priceRangeMin: 50,
    priceRangeMax: 150,
    categoryIds: [catEvenements],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
    { venueId: eventSpace2._id, kind: 'HERO_IMAGE', url: heroImages[9] },
    { venueId: eventSpace2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.eventSpace2 },
  ]);
  await Table.insertMany([
    { venueId: eventSpace2._id, tableNumber: 1, code: 'T1', capacity: 4, locationLabel: 'Vue mer', price: 70, basePrice: 70, isVip: false },
  ]);

  console.log('🏢 Created 10 venues: 2 cafés, 2 restaurants, 2 hotels, 2 cinemas, 2 event spaces');

  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(21, 0, 0, 0);
  const tomorrowEv = new Date(now);
  tomorrowEv.setDate(tomorrowEv.getDate() + 2);
  tomorrowEv.setHours(21, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 5);
  nextWeek.setHours(19, 30, 0, 0);
  const pastEv = new Date(now);
  pastEv.setDate(pastEv.getDate() - 7);
  pastEv.setHours(20, 0, 0, 0);

  await Event.insertMany([
    { venueId: cafe1._id, title: 'Soirée Jazz', slug: 'soiree-jazz-babol', type: 'CONCERT', startAt: tomorrowEv, description: 'Concert jazz en live.', isPublished: true },
    { venueId: restaurant._id, title: 'Dîner aux chandelles', slug: 'diner-aux-chandelles-monte-cristo', type: 'SOIREE', startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000), description: 'Soirée spéciale.', isPublished: true },
    { venueId: cinema._id, title: 'Avant-première', slug: 'avant-premiere-cgr', type: 'CINEMA', startAt: nextWeek, description: 'Projection en avant-première.', isPublished: true },
    { venueId: eventSpace1._id, title: 'Concert Live', slug: 'concert-live-el-teatro', type: 'CONCERT', startAt: tonight, description: 'Concert ce soir.', isPublished: true },
    { venueId: eventSpace2._id, title: 'Soirée Rooftop', slug: 'soiree-rooftop-monastir', type: 'SOIREE', startAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000), description: 'Soirée rooftop.', isPublished: true },
  ]);
  console.log('📅 Created 5 events');

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
  const customer2Id = customers[1]._id;

  const codes = new Set<string>();
  function uniqueCode() {
    let c: string;
    do c = generateConfirmationCode(8); while (codes.has(c));
    codes.add(c);
    return c;
  }

  await Reservation.insertMany([
    { userId: customerId, venueId: cafe1._id, bookingType: 'TABLE', tableId: cafe1Tables[0]._id, startAt: tomorrow, endAt: new Date(tomorrow.getTime() + twoHours), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 12, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: customerId, venueId: restaurant._id, bookingType: 'TABLE', tableId: restaurantTables[0]._id, startAt: dayAfter, endAt: new Date(dayAfter.getTime() + twoHours), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 45, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: customerId, venueId: hotel._id, bookingType: 'ROOM', roomId: hotelRooms[0]._id, startAt: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000), endAt: new Date(tomorrow.getTime() + 9 * 24 * 60 * 60 * 1000), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 240, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: customerId, venueId: cinema._id, bookingType: 'SEAT', seatId: cinemaSeats[0]._id, startAt: nextWeek, endAt: new Date(nextWeek.getTime() + 3 * 60 * 60 * 1000), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 25, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 1 },
    { userId: customerId, venueId: cafe2._id, bookingType: 'TABLE', tableId: cafe2Tables[1]._id, startAt: lastWeek, endAt: new Date(lastWeek.getTime() + twoHours), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 12, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: customer2Id, venueId: cafe1._id, bookingType: 'TABLE', tableId: cafe1Tables[1]._id, startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000), endAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000), status: 'PENDING', paymentStatus: 'unpaid', confirmationCode: uniqueCode(), totalPrice: 15, guestFirstName: 'Karim', guestLastName: 'Trabelsi', guestPhone: '87654321', partySize: 3 },
    { userId: customer2Id, venueId: restaurant2._id, bookingType: 'TABLE', tableId: restaurant2Tables[0]._id, startAt: lastWeek, endAt: new Date(lastWeek.getTime() + twoHours), status: 'CANCELLED', paymentStatus: 'refunded', confirmationCode: uniqueCode(), totalPrice: 55, guestFirstName: 'Karim', guestLastName: 'Trabelsi', guestPhone: '87654321', partySize: 2 },
  ]);
  console.log('📋 Created 7 reservations (CONFIRMED, PENDING, CANCELLED) with confirmation codes');

  console.log('\n✅ Seed completed.');
  console.log('\n📝 Credentials (password: ' + PASSWORD + ')');
  console.log('  Admin:   admin@mareservation.tn');
  console.log('  Customer (with reservations): client1@example.com');
  console.log('  Customer (pending + cancelled): client2@example.com');
  console.log('  Customers: client3@example.com, client4@example.com, client5@example.com');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});

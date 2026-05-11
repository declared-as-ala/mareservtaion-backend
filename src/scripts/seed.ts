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
    emailVerified: true,
  });

  const normalUser = await User.create({
    fullName: 'Client Ma Reservation',
    email: 'user@mareservation.tn',
    passwordHash: hash,
    role: 'CUSTOMER',
    emailVerified: true,
  });

  console.log('👤 Created 2 users: 1 admin + 1 customer');

  const ownerCafe = await User.create({
    fullName: 'Owner Cafe MaTable',
    email: 'cafe@matable.tn',
    passwordHash: hash,
    role: 'ESTABLISHMENT_OWNER',
    emailVerified: true,
  });
  const ownerRestaurant = await User.create({
    fullName: 'Owner Restaurant MaTable',
    email: 'owner.restaurant@matable.tn',
    passwordHash: hash,
    role: 'ESTABLISHMENT_OWNER',
    emailVerified: true,
  });
  const ownerHotel = await User.create({
    fullName: 'Owner Hotel MaTable',
    email: 'owner.hotel@matable.tn',
    passwordHash: hash,
    role: 'ESTABLISHMENT_OWNER',
    emailVerified: true,
  });

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
    startingPrice: 12,
    priceRangeMin: 8,
    priceRangeMax: 25,
    categoryIds: [catCafes],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
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
    { venueId: cafe1._id, virtualTourId: tour1._id, label: 'Table 1', targetType: 'table', targetId: cafe1Tables[0]._id, xPercent: p1.xPercent, yPercent: p1.yPercent, isActive: true },
    { venueId: cafe1._id, virtualTourId: tour1._id, label: 'Table 2', targetType: 'table', targetId: cafe1Tables[1]._id, xPercent: p2.xPercent, yPercent: p2.yPercent, isActive: true },
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
    startingPrice: 14,
    priceRangeMin: 10,
    priceRangeMax: 22,
    categoryIds: [catCafes],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
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
    { venueId: cafe2._id, virtualTourId: tour2._id, label: 'Table 1', targetType: 'table', targetId: cafe2Tables[0]._id, xPercent: p3.xPercent, yPercent: p3.yPercent, isActive: true },
    { venueId: cafe2._id, virtualTourId: tour2._id, label: 'Table 2', targetType: 'table', targetId: cafe2Tables[1]._id, xPercent: p4.xPercent, yPercent: p4.yPercent, isActive: true },
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
    startingPrice: 45,
    priceRangeMin: 35,
    priceRangeMax: 80,
    categoryIds: [catRestaurants],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
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
    { venueId: restaurant._id, virtualTourId: tourRest._id, label: 'Table 1', targetType: 'table', targetId: restaurantTables[0]._id, xPercent: pitchYawToPercent(0, -0.7).xPercent, yPercent: pitchYawToPercent(0, -0.7).yPercent, isActive: true },
    { venueId: restaurant._id, virtualTourId: tourRest._id, label: 'Table 2', targetType: 'table', targetId: restaurantTables[1]._id, xPercent: 50, yPercent: 50, isActive: true },
    { venueId: restaurant._id, virtualTourId: tourRest._id, label: 'Table 3', targetType: 'table', targetId: restaurantTables[2]._id, xPercent: pitchYawToPercent(0, 0.7).xPercent, yPercent: pitchYawToPercent(0, 0.7).yPercent, isActive: true },
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
    startingPrice: 55,
    priceRangeMin: 40,
    priceRangeMax: 90,
    categoryIds: [catRestaurants],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
    { venueId: restaurant2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.restaurant2 },
  ]);
  const restaurant2Tables = await Table.insertMany([
    { venueId: restaurant2._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Vue mer', price: 55, basePrice: 55, isVip: false },
    { venueId: restaurant2._id, tableNumber: 2, code: 'T2', capacity: 4, locationLabel: 'Terrasse', price: 60, basePrice: 60, isVip: false },
  ]);

  // ── Hotels ────────────────────────────────────────────────────────────────

  // Hotel 1 — El Mouradi Palace (Hammamet, 5★)
  const hotel1 = await Venue.create({
    name: 'El Mouradi Palace',
    slug: 'el-mouradi-palace-hammamet',
    type: 'HOTEL',
    city: 'Hammamet',
    governorate: 'Nabeul',
    address: 'Zone Touristique Yasmine, Hammamet',
    phone: '+216 72 244 444',
    shortDescription: 'Palace 5 étoiles face à la mer, piscine olympique et spa de luxe.',
    description: 'El Mouradi Palace est un hôtel 5 étoiles exceptionnel situé en bord de mer à Yasmine Hammamet. Profitez d\'une piscine olympique, d\'un spa de luxe, de restaurants gastronomiques et d\'une plage privée. Chaque chambre offre une vue imprenable sur la Méditerranée. Piscine chauffée, tennis, animation et accès direct à la plage.',
    startingPrice: 150,
    priceRangeMin: 150,
    priceRangeMax: 480,
    amenities: ['piscine', 'spa', 'wifi', 'parking', 'restaurant', 'plage privée', 'tennis', 'fitness'],
    categoryIds: [catHotels],
    isPublished: true,
    isFeatured: true,
    hasVirtualTour: true,
    reservationModes: ['room'],
    immersiveType: 'virtual-tour',
    immersiveProvider: 'klapty',
    immersiveUrl: KLAPTY_TUNNEL.hotel,
    checkInPolicy: 'Check-in à partir de 14h00',
    checkOutPolicy: 'Check-out avant 12h00',
  });
  await VenueMedia.insertMany([
    { venueId: hotel1._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.hotel },
  ]);
  const hotel1Rooms = await Room.insertMany([
    {
      venueId: hotel1._id,
      roomNumber: 101,
      name: 'Chambre Standard Vue Jardin',
      roomType: 'STANDARD',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Double',
      pricePerNight: 150,
      surface: 28,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV satellite'],
      description: 'Chambre confortable avec vue sur les jardins verdoyants de l\'hôtel.',
      bathroomType: 'Salle de bain privée',
      isVip: false,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: hotel1._id,
      roomNumber: 201,
      name: 'Chambre Supérieure Vue Mer',
      roomType: 'SUPERIOR',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'King',
      pricePerNight: 220,
      surface: 35,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV satellite', 'Balcon privé', 'Vue mer'],
      description: 'Chambre supérieure avec balcon privé et vue panoramique sur la mer Méditerranée.',
      bathroomType: 'Salle de bain avec baignoire',
      isVip: false,
      hasBalcony: true,
      status: 'available',
    },
    {
      venueId: hotel1._id,
      roomNumber: 301,
      name: 'Suite Junior',
      roomType: 'SUITE',
      capacity: 3,
      capacityAdults: 2,
      capacityChildren: 1,
      bedType: 'King',
      pricePerNight: 320,
      surface: 55,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV satellite', 'Balcon privé', 'Vue mer', 'Salon séparé', 'Jacuzzi'],
      description: 'Suite junior avec salon séparé, jacuzzi et grande terrasse avec vue mer imprenable.',
      bathroomType: 'Salle de bain avec jacuzzi',
      isVip: true,
      hasBalcony: true,
      hasVirtualTour: true,
      status: 'available',
    },
    {
      venueId: hotel1._id,
      roomNumber: 401,
      name: 'Suite Présidentielle',
      roomType: 'PRESIDENTIAL',
      capacity: 4,
      capacityAdults: 4,
      bedType: 'King',
      pricePerNight: 480,
      surface: 120,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar privé', 'Coffre-fort', 'TV satellite', 'Terrasse panoramique', 'Vue mer 360°', 'Salon', 'Salle à manger', 'Jacuzzi', 'Butler privé', 'Peignoirs & chaussons'],
      description: 'La suite la plus prestigieuse de l\'hôtel. Terrasse panoramique de 80m² avec vue à 360° sur la Méditerranée. Butler privé et accès VIP à tous les services.',
      bathroomType: 'Salle de bain de luxe avec baignoire et douche à l\'italienne',
      isVip: true,
      hasBalcony: true,
      hasVirtualTour: true,
      status: 'available',
    },
    {
      venueId: hotel1._id,
      roomNumber: 102,
      name: 'Chambre Twin',
      roomType: 'STANDARD',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Twin',
      pricePerNight: 150,
      surface: 28,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV satellite'],
      description: 'Chambre twin idéale pour deux voyageurs, avec deux lits séparés et vue jardin.',
      bathroomType: 'Salle de bain privée',
      isVip: false,
      hasBalcony: false,
      status: 'available',
    },
  ]);
  const tourHotel1 = await VirtualTour.create({ venueId: hotel1._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.hotel, isActive: true });
  await TourHotspot.insertMany([
    { venueId: hotel1._id, virtualTourId: tourHotel1._id, label: 'Chambre 201', targetType: 'room', targetId: hotel1Rooms[1]._id, xPercent: 30, yPercent: 48, isActive: true },
    { venueId: hotel1._id, virtualTourId: tourHotel1._id, label: 'Suite Junior 301', targetType: 'room', targetId: hotel1Rooms[2]._id, xPercent: 65, yPercent: 45, isActive: true },
  ]);

  // Hotel 2 — Laico Tunis (Tunis, 5★)
  const hotel2 = await Venue.create({
    name: 'Hôtel Laico Tunis',
    slug: 'hotel-laico-tunis',
    type: 'HOTEL',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Avenue de la Ligue Arabe, Tunis',
    phone: '+216 71 347 777',
    shortDescription: 'Hôtel 5 étoiles au cœur de Tunis, business et luxe urbain.',
    description: 'L\'Hôtel Laico Tunis est un établissement 5 étoiles emblématique situé au cœur de la capitale tunisienne. Idéal pour les voyages d\'affaires et de loisirs, il offre des chambres et suites de grand standing, des salles de conférence, un spa et plusieurs restaurants. Depuis ses hauteurs, profitez d\'une vue imprenable sur la ville et le lac de Tunis. WiFi haut débit, piscine sur le toit et concierge 24h/24.',
    startingPrice: 180,
    priceRangeMin: 180,
    priceRangeMax: 550,
    amenities: ['piscine', 'spa', 'wifi', 'parking', 'restaurant', 'salle de conférence', 'fitness', 'concierge 24h'],
    categoryIds: [catHotels],
    isPublished: true,
    isFeatured: true,
    hasVirtualTour: true,
    reservationModes: ['room'],
    immersiveType: 'virtual-tour',
    immersiveProvider: 'klapty',
    immersiveUrl: KLAPTY_TUNNEL.hotel2,
    checkInPolicy: 'Check-in à partir de 15h00',
    checkOutPolicy: 'Check-out avant 12h00',
  });
  await VenueMedia.insertMany([
    { venueId: hotel2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.hotel2 },
  ]);
  const hotel2Rooms = await Room.insertMany([
    {
      venueId: hotel2._id,
      roomNumber: 501,
      name: 'Chambre Deluxe Ville',
      roomType: 'DELUXE',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Queen',
      pricePerNight: 180,
      surface: 32,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV LED 55"', 'Machine Nespresso', 'Bureau de travail'],
      description: 'Chambre deluxe avec vue sur la ville de Tunis et le lac. Idéale pour les séjours d\'affaires.',
      bathroomType: 'Salle de bain avec douche à l\'italienne',
      isVip: false,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: hotel2._id,
      roomNumber: 601,
      name: 'Chambre Deluxe Vue Lac',
      roomType: 'DELUXE',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'King',
      pricePerNight: 230,
      surface: 36,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV LED 55"', 'Machine Nespresso', 'Bureau de travail', 'Vue lac'],
      description: 'Chambre deluxe avec vue spectaculaire sur le lac de Tunis. Lumière naturelle toute la journée.',
      bathroomType: 'Salle de bain avec baignoire',
      isVip: false,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: hotel2._id,
      roomNumber: 701,
      name: 'Suite Executive',
      roomType: 'SUITE',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'King',
      pricePerNight: 350,
      surface: 65,
      amenities: ['WiFi gratuit', 'Climatisation', 'Bar privé', 'Coffre-fort', 'TV LED 65"', 'Machine Nespresso', 'Salon séparé', 'Accès Lounge Executive', 'Service en chambre 24h'],
      description: 'Suite executive avec salon séparé et accès au Executive Lounge au sommet de l\'hôtel. Business corner dédié.',
      bathroomType: 'Salle de bain de luxe',
      isVip: true,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: hotel2._id,
      roomNumber: 801,
      name: 'Suite Royale Panoramique',
      roomType: 'SUITE',
      capacity: 4,
      capacityAdults: 4,
      bedType: 'King',
      pricePerNight: 550,
      surface: 140,
      amenities: ['WiFi gratuit', 'Climatisation', 'Bar privé', 'Coffre-fort', 'TV LED 75"', 'Machine Nespresso', 'Salon', 'Salle à manger', 'Terrasse panoramique', 'Jacuzzi privatif', 'Butler 24h', 'Transfer aéroport inclus'],
      description: 'Suite royale au dernier étage avec terrasse panoramique offrant une vue à 360° sur Tunis, le lac et le golfe. L\'expérience ultime en plein cœur de la capitale.',
      bathroomType: 'Deux salles de bain de luxe',
      isVip: true,
      hasBalcony: true,
      hasVirtualTour: true,
      status: 'available',
    },
  ]);
  const tourHotel2 = await VirtualTour.create({ venueId: hotel2._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.hotel2, isActive: true });
  await TourHotspot.insertMany([
    { venueId: hotel2._id, virtualTourId: tourHotel2._id, label: 'Chambre Deluxe 601', targetType: 'room', targetId: hotel2Rooms[1]._id, xPercent: 35, yPercent: 50, isActive: true },
    { venueId: hotel2._id, virtualTourId: tourHotel2._id, label: 'Suite Executive 701', targetType: 'room', targetId: hotel2Rooms[2]._id, xPercent: 70, yPercent: 45, isActive: true },
  ]);

  // Hotel 3 — Dar Hi Nefta (Tozeur, Boutique)
  const hotel3 = await Venue.create({
    name: 'Dar Hi Nefta',
    slug: 'dar-hi-nefta',
    type: 'HOTEL',
    city: 'Nefta',
    governorate: 'Tozeur',
    address: 'Route de l\'Oasis, Nefta, Tozeur',
    phone: '+216 76 430 888',
    shortDescription: 'Écolodge de charme au bord de l\'oasis, architecture berbère et piscine.',
    description: 'Dar Hi est un écolodge boutique d\'exception niché au cœur de l\'oasis de Nefta, aux portes du Sahara tunisien. Conçu par l\'architecte Matali Crasset, cet hébergement allie architecture berbère contemporaine et respect de l\'environnement. Profitez de pavillons privés avec terrasse, d\'une piscine au milieu des palmiers, d\'un hammam traditionnel et d\'une cuisine du terroir à base de produits locaux. Une expérience sensorielle unique entre désert et oasis.',
    startingPrice: 200,
    priceRangeMin: 200,
    priceRangeMax: 520,
    amenities: ['piscine', 'spa', 'wifi', 'parking', 'restaurant', 'hammam', 'excursions désert', 'petit-déjeuner inclus'],
    categoryIds: [catHotels],
    isPublished: true,
    isFeatured: false,
    hasVirtualTour: false,
    reservationModes: ['room'],
    immersiveType: 'none',
    checkInPolicy: 'Check-in à partir de 15h00',
    checkOutPolicy: 'Check-out avant 11h00',
  });
  const hotel3Rooms = await Room.insertMany([
    {
      venueId: hotel3._id,
      roomNumber: 1,
      name: 'Pavillon Dune',
      roomType: 'STANDARD',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Double',
      pricePerNight: 200,
      surface: 40,
      amenities: ['WiFi gratuit', 'Climatisation', 'Terrasse privée', 'Vue sur l\'oasis', 'Petit-déjeuner inclus', 'Produits de bain naturels'],
      description: 'Pavillon indépendant avec terrasse privée sur l\'oasis. Décoration berbère authentique et matériaux naturels.',
      bathroomType: 'Salle de bain en pierre naturelle',
      isVip: false,
      hasBalcony: true,
      status: 'available',
    },
    {
      venueId: hotel3._id,
      roomNumber: 2,
      name: 'Pavillon Palmeraie',
      roomType: 'SUPERIOR',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'King',
      pricePerNight: 280,
      surface: 55,
      amenities: ['WiFi gratuit', 'Climatisation', 'Grande terrasse', 'Vue palmeraie', 'Petit-déjeuner inclus', 'Bain en plein air', 'Produits de bain naturels'],
      description: 'Pavillon supérieur avec grande terrasse et bain en plein air au milieu de la palmeraie. Vue sur les dunes au coucher du soleil.',
      bathroomType: 'Salle de bain avec bain extérieur',
      isVip: false,
      hasBalcony: true,
      status: 'available',
    },
    {
      venueId: hotel3._id,
      roomNumber: 3,
      name: 'Suite Sahara',
      roomType: 'SUITE',
      capacity: 3,
      capacityAdults: 2,
      capacityChildren: 1,
      bedType: 'King',
      pricePerNight: 380,
      surface: 85,
      amenities: ['WiFi gratuit', 'Climatisation', 'Piscine privée', 'Terrasse panoramique', 'Vue désert & oasis', 'Petit-déjeuner & dîner inclus', 'Bain de boue hammam', 'Excursion dunes incluse'],
      description: 'Suite exclusive avec piscine privée et panorama exceptionnel sur les dunes du Sahara. Dîner sous les étoiles inclus. L\'expérience ultime dans le sud tunisien.',
      bathroomType: 'Salle de bain de luxe avec hammam privé',
      isVip: true,
      hasBalcony: true,
      hasVirtualTour: false,
      status: 'available',
    },
    {
      venueId: hotel3._id,
      roomNumber: 4,
      name: 'Villa Oasis',
      roomType: 'VILLA',
      capacity: 6,
      capacityAdults: 4,
      capacityChildren: 2,
      bedType: 'King',
      pricePerNight: 520,
      surface: 180,
      amenities: ['WiFi gratuit', 'Climatisation', 'Piscine privée', 'Jardin privatif', 'Cuisine équipée', 'Vue 360° oasis & désert', 'Pension complète', 'Concierge dédié', 'Excursions incluses', '4×4 privé'],
      description: 'Villa indépendante avec jardin et piscine privés au cœur de l\'oasis. Pour les familles ou groupes souhaitant une immersion totale dans l\'environnement saharien. Chef cuisinier à la demande.',
      bathroomType: 'Deux salles de bain complètes',
      isVip: true,
      hasBalcony: true,
      status: 'available',
    },
  ]);

  // Store first hotel's rooms for the reservation seed below
  const hotelRooms = hotel1Rooms;

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
    startingPrice: 25,
    priceRangeMin: 20,
    priceRangeMax: 40,
    categoryIds: [catCinema],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
    { venueId: cinema._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.cinema },
  ]);
  const cinemaSeats = await Seat.insertMany([
    { venueId: cinema._id, seatNumber: 1, zone: 'Centre', price: 25 },
    { venueId: cinema._id, seatNumber: 2, zone: 'Centre', price: 25 },
    { venueId: cinema._id, seatNumber: 3, zone: 'Vip', price: 35 },
  ]);
  const tourCinema = await VirtualTour.create({ venueId: cinema._id, provider: 'klapty', embedUrl: KLAPTY_TUNNEL.cinema, isActive: true });
  await TourHotspot.insertMany([
    { venueId: cinema._id, virtualTourId: tourCinema._id, label: 'Zone Centre', targetType: 'seat_zone', targetId: cinemaSeats[0]._id, xPercent: 40, yPercent: 50, isActive: true },
    { venueId: cinema._id, virtualTourId: tourCinema._id, label: 'Zone Vip', targetType: 'seat_zone', targetId: cinemaSeats[2]._id, xPercent: 60, yPercent: 50, isActive: true },
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
    startingPrice: 22,
    priceRangeMin: 18,
    priceRangeMax: 35,
    categoryIds: [catCinema],
    isPublished: true,
    isFeatured: false,
  });
  await VenueMedia.insertMany([
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
    startingPrice: 50,
    priceRangeMin: 30,
    priceRangeMax: 120,
    categoryIds: [catEvenements],
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.insertMany([
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
    startingPrice: 70,
    priceRangeMin: 50,
    priceRangeMax: 150,
    categoryIds: [catEvenements],
    isPublished: true,
    isFeatured: false,
  });

  await Venue.updateMany({ type: 'CAFE' }, { $set: { ownerId: ownerCafe._id } });
  await Venue.updateMany({ type: 'RESTAURANT' }, { $set: { ownerId: ownerRestaurant._id } });
  await Venue.updateMany({ type: 'HOTEL' }, { $set: { ownerId: ownerHotel._id } });
  await VenueMedia.insertMany([
    { venueId: eventSpace2._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY_TUNNEL.eventSpace2 },
  ]);
  await Table.insertMany([
    { venueId: eventSpace2._id, tableNumber: 1, code: 'T1', capacity: 4, locationLabel: 'Vue mer', price: 70, basePrice: 70, isVip: false },
  ]);

  console.log('🏢 Created 11 venues: 2 cafés, 2 restaurants, 3 hotels, 2 cinemas, 2 event spaces');

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

  const customerId = normalUser._id;

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
    { userId: customerId, venueId: hotel1._id, bookingType: 'ROOM', roomId: hotelRooms[0]._id, startAt: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000), endAt: new Date(tomorrow.getTime() + 9 * 24 * 60 * 60 * 1000), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 240, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: customerId, venueId: cinema._id, bookingType: 'SEAT', seatId: cinemaSeats[0]._id, startAt: nextWeek, endAt: new Date(nextWeek.getTime() + 3 * 60 * 60 * 1000), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 25, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 1 },
    { userId: customerId, venueId: cafe2._id, bookingType: 'TABLE', tableId: cafe2Tables[1]._id, startAt: lastWeek, endAt: new Date(lastWeek.getTime() + twoHours), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 12, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: customerId, venueId: cafe1._id, bookingType: 'TABLE', tableId: cafe1Tables[1]._id, startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000), endAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000), status: 'PENDING', paymentStatus: 'unpaid', confirmationCode: uniqueCode(), totalPrice: 15, guestFirstName: 'Client', guestLastName: 'Ma Reservation', guestPhone: '87654321', partySize: 3 },
    { userId: customerId, venueId: restaurant2._id, bookingType: 'TABLE', tableId: restaurant2Tables[0]._id, startAt: lastWeek, endAt: new Date(lastWeek.getTime() + twoHours), status: 'CANCELLED', paymentStatus: 'refunded', confirmationCode: uniqueCode(), totalPrice: 55, guestFirstName: 'Client', guestLastName: 'Ma Reservation', guestPhone: '87654321', partySize: 2 },
  ]);
  console.log('📋 Created 7 reservations (CONFIRMED, PENDING, CANCELLED) with confirmation codes');

  console.log('\n✅ Seed completed.');
  console.log('\n📝 Credentials (password: ' + PASSWORD + ')');
  console.log('  Admin:   admin@mareservation.tn');
  console.log('  Customer: user@mareservation.tn');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});

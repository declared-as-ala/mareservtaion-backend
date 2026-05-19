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
const KLAPTY = 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq';

function pitchYawToPercent(pitch: number, yaw: number): { xPercent: number; yPercent: number } {
  const xPercent = ((yaw + Math.PI) / (2 * Math.PI)) * 100;
  const yPercent = ((Math.PI / 2 - pitch) / Math.PI) * 100;
  return { xPercent: Math.max(0, Math.min(100, xPercent)), yPercent: Math.max(0, Math.min(100, yPercent)) };
}

async function seed() {
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
  const ownerEvent = await User.create({
    fullName: 'Owner Événementiel MaTable',
    email: 'owner.event@matable.tn',
    passwordHash: hash,
    role: 'ESTABLISHMENT_OWNER',
    emailVerified: true,
  });

  console.log('👤 Created users: 1 admin + 1 customer + 4 owners');

  const categories = await Category.insertMany([
    { name: 'Cafés & Lounges', slug: 'cafes-lounges', type: 'primary', displayOrder: 1 },
    { name: 'Bars & Rooftops', slug: 'bars-rooftops', type: 'primary', displayOrder: 2 },
    { name: 'Restaurants Gastronomiques', slug: 'restaurants-gastronomiques', type: 'primary', displayOrder: 3 },
    { name: 'Clubs & Resto de Nuit', slug: 'clubs-resto-nuit', type: 'primary', displayOrder: 4 },
    { name: 'Salles & Événementiel', slug: 'salles-evenementiel', type: 'primary', displayOrder: 5 },
    { name: 'Hôtels & Resorts', slug: 'hotels-resorts', type: 'primary', displayOrder: 6 },
    { name: 'Beach Clubs', slug: 'beach-clubs', type: 'primary', displayOrder: 7 },
    { name: 'Spas & Bien-être', slug: 'spas-bien-etre', type: 'primary', displayOrder: 8 },
  ]);
  const [catCafes, catBars, catResto, catClubs, catSalles, catHotels, catBeach, catSpas] =
    categories.map((c) => c._id);
  console.log('📁 Created 8 categories matching the home page');

  // ─────────────────────────────────────────────────────────────────────
  // 1) CAFÉS & LOUNGES — 1 venue
  // ─────────────────────────────────────────────────────────────────────
  const cafe1 = await Venue.create({
    name: 'Babol Coffee Lounge',
    slug: 'babol-coffee-lounge-tunis',
    type: 'CAFE',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Avenue Habib Bourguiba, Tunis',
    shortDescription: 'Café lounge cosy avec vue sur l\'avenue.',
    description: 'Café lounge cosy avec vue sur l\'avenue. Thé, café de spécialité et pâtisseries maison.',
    startingPrice: 12,
    priceRangeMin: 8,
    priceRangeMax: 25,
    categoryIds: [catCafes],
    ownerId: ownerCafe._id,
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.create({ venueId: cafe1._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  const cafe1Tables = await Table.insertMany([
    { venueId: cafe1._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Fenêtre', price: 12, basePrice: 12, isVip: false },
    { venueId: cafe1._id, tableNumber: 2, code: 'T2', capacity: 4, locationLabel: 'Centre', price: 15, basePrice: 15, isVip: false },
  ]);
  const cafe1Tour = await VirtualTour.create({ venueId: cafe1._id, provider: 'klapty', embedUrl: KLAPTY, isActive: true });
  await TableHotspot.insertMany([
    { venueId: cafe1._id, tableId: cafe1Tables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.6 },
    { venueId: cafe1._id, tableId: cafe1Tables[1]._id, sceneId: 'default', pitch: 0, yaw: 0.6 },
  ]);
  const cp1 = pitchYawToPercent(0, -0.6);
  const cp2 = pitchYawToPercent(0, 0.6);
  await TourHotspot.insertMany([
    { venueId: cafe1._id, virtualTourId: cafe1Tour._id, label: 'Table 1', targetType: 'table', targetId: cafe1Tables[0]._id, xPercent: cp1.xPercent, yPercent: cp1.yPercent, isActive: true },
    { venueId: cafe1._id, virtualTourId: cafe1Tour._id, label: 'Table 2', targetType: 'table', targetId: cafe1Tables[1]._id, xPercent: cp2.xPercent, yPercent: cp2.yPercent, isActive: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 2) BARS & ROOFTOPS — 1 venue (name contains "Bar" for q=Bar)
  // ─────────────────────────────────────────────────────────────────────
  const bar = await Venue.create({
    name: 'Skyline Bar & Rooftop',
    slug: 'skyline-bar-rooftop-tunis',
    type: 'EVENT_SPACE',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Les Berges du Lac, Tunis',
    shortDescription: 'Rooftop bar tendance avec vue panoramique.',
    description: 'Rooftop bar tendance avec vue panoramique sur la ville et le lac. Cocktails signature, DJ sets et tapas raffinés.',
    startingPrice: 35,
    priceRangeMin: 25,
    priceRangeMax: 90,
    categoryIds: [catBars],
    ownerId: ownerEvent._id,
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.create({ venueId: bar._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  await Table.insertMany([
    { venueId: bar._id, tableNumber: 1, code: 'B1', capacity: 4, locationLabel: 'Rooftop bar', price: 35, basePrice: 35, isVip: false },
    { venueId: bar._id, tableNumber: 2, code: 'VIP', capacity: 6, locationLabel: 'Carré VIP', price: 90, basePrice: 90, isVip: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 3) RESTAURANTS GASTRONOMIQUES — 1 venue
  // ─────────────────────────────────────────────────────────────────────
  const restaurant = await Venue.create({
    name: 'Il Monte Cristo Gastronomique',
    slug: 'il-monte-cristo-gastronomique-tunis',
    type: 'RESTAURANT',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'La Goulette, Tunis',
    shortDescription: 'Restaurant gastronomique italo-méditerranéen.',
    description: 'Restaurant gastronomique italo-méditerranéen. Cuisine raffinée par un chef étoilé, cave à vins d\'exception.',
    startingPrice: 45,
    priceRangeMin: 35,
    priceRangeMax: 120,
    categoryIds: [catResto],
    ownerId: ownerRestaurant._id,
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.create({ venueId: restaurant._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  const restaurantTables = await Table.insertMany([
    { venueId: restaurant._id, tableNumber: 1, code: 'T1', capacity: 2, locationLabel: 'Fenêtre', price: 45, basePrice: 45, isVip: false },
    { venueId: restaurant._id, tableNumber: 2, code: 'T2', capacity: 4, locationLabel: 'Salle', price: 55, basePrice: 55, isVip: true },
    { venueId: restaurant._id, tableNumber: 3, code: 'T3', capacity: 6, locationLabel: 'Terrasse', price: 65, basePrice: 65, isVip: false },
  ]);
  const restaurantTour = await VirtualTour.create({ venueId: restaurant._id, provider: 'klapty', embedUrl: KLAPTY, isActive: true });
  await TableHotspot.insertMany([
    { venueId: restaurant._id, tableId: restaurantTables[0]._id, sceneId: 'default', pitch: 0, yaw: -0.7 },
    { venueId: restaurant._id, tableId: restaurantTables[1]._id, sceneId: 'default', pitch: 0, yaw: 0 },
    { venueId: restaurant._id, tableId: restaurantTables[2]._id, sceneId: 'default', pitch: 0, yaw: 0.7 },
  ]);
  await TourHotspot.insertMany([
    { venueId: restaurant._id, virtualTourId: restaurantTour._id, label: 'Table 1', targetType: 'table', targetId: restaurantTables[0]._id, xPercent: pitchYawToPercent(0, -0.7).xPercent, yPercent: pitchYawToPercent(0, -0.7).yPercent, isActive: true },
    { venueId: restaurant._id, virtualTourId: restaurantTour._id, label: 'Table 2', targetType: 'table', targetId: restaurantTables[1]._id, xPercent: 50, yPercent: 50, isActive: true },
    { venueId: restaurant._id, virtualTourId: restaurantTour._id, label: 'Table 3', targetType: 'table', targetId: restaurantTables[2]._id, xPercent: pitchYawToPercent(0, 0.7).xPercent, yPercent: pitchYawToPercent(0, 0.7).yPercent, isActive: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 4) CLUBS & RESTO DE NUIT — 1 venue (name contains "Club")
  // ─────────────────────────────────────────────────────────────────────
  const club = await Venue.create({
    name: 'Le Club Mojito Night',
    slug: 'le-club-mojito-night-gammarth',
    type: 'RESTAURANT',
    city: 'Gammarth',
    governorate: 'Tunis',
    address: 'Route de Gammarth',
    shortDescription: 'Resto-club de nuit, cuisine méditerranéenne et clubbing.',
    description: 'Resto-club de nuit incontournable. Cuisine méditerranéenne raffinée jusqu\'à minuit puis ambiance clubbing avec DJ résidents.',
    startingPrice: 60,
    priceRangeMin: 40,
    priceRangeMax: 150,
    categoryIds: [catClubs],
    ownerId: ownerRestaurant._id,
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.create({ venueId: club._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  await Table.insertMany([
    { venueId: club._id, tableNumber: 1, code: 'D1', capacity: 4, locationLabel: 'Dancefloor', price: 60, basePrice: 60, isVip: false },
    { venueId: club._id, tableNumber: 2, code: 'VIP', capacity: 8, locationLabel: 'Carré VIP', price: 150, basePrice: 150, isVip: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 5) SALLES & ÉVÉNEMENTIEL — 1 venue
  // ─────────────────────────────────────────────────────────────────────
  const eventSpace = await Venue.create({
    name: 'El Teatro — Salle Événementielle',
    slug: 'el-teatro-salle-evenementielle-tunis',
    type: 'EVENT_SPACE',
    city: 'Tunis',
    governorate: 'Tunis',
    address: 'Avenue Mohamed V, Tunis',
    shortDescription: 'Salle de spectacles et événements privés.',
    description: 'Salle de spectacles, concerts, mariages et événements privés. Capacité 300 personnes, scène modulable et acoustique professionnelle.',
    startingPrice: 50,
    priceRangeMin: 30,
    priceRangeMax: 120,
    categoryIds: [catSalles],
    ownerId: ownerEvent._id,
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.create({ venueId: eventSpace._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  await Table.insertMany([
    { venueId: eventSpace._id, tableNumber: 1, code: 'VIP1', capacity: 4, locationLabel: 'Scène', price: 120, basePrice: 120, isVip: true },
    { venueId: eventSpace._id, tableNumber: 2, code: 'T2', capacity: 6, locationLabel: 'Salon', price: 80, basePrice: 80, isVip: false },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 6) HÔTELS & RESORTS — 1 venue
  // ─────────────────────────────────────────────────────────────────────
  const hotel = await Venue.create({
    name: 'El Mouradi Palace Resort',
    slug: 'el-mouradi-palace-resort-hammamet',
    type: 'HOTEL',
    city: 'Hammamet',
    governorate: 'Nabeul',
    address: 'Zone Touristique Yasmine, Hammamet',
    phone: '+216 72 244 444',
    shortDescription: 'Resort 5 étoiles face à la mer, piscine olympique et spa.',
    description: 'El Mouradi Palace est un resort 5 étoiles exceptionnel en bord de mer à Yasmine Hammamet. Piscine olympique, spa de luxe, restaurants gastronomiques et plage privée.',
    startingPrice: 150,
    priceRangeMin: 150,
    priceRangeMax: 480,
    amenities: ['piscine', 'spa', 'wifi', 'parking', 'restaurant', 'plage privée', 'tennis', 'fitness'],
    categoryIds: [catHotels],
    ownerId: ownerHotel._id,
    isPublished: true,
    isFeatured: true,
    hasVirtualTour: true,
    reservationModes: ['room'],
    immersiveType: 'virtual-tour',
    immersiveProvider: 'klapty',
    immersiveUrl: KLAPTY,
    checkInPolicy: 'Check-in à partir de 14h00',
    checkOutPolicy: 'Check-out avant 12h00',
  });
  await VenueMedia.create({ venueId: hotel._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  const hotelRooms = await Room.insertMany([
    {
      venueId: hotel._id,
      roomNumber: 101,
      name: 'Chambre Standard Vue Jardin',
      roomType: 'STANDARD',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Double',
      pricePerNight: 150,
      surface: 28,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV satellite'],
      description: 'Chambre confortable avec vue sur les jardins.',
      bathroomType: 'Salle de bain privée',
      isVip: false,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: hotel._id,
      roomNumber: 201,
      name: 'Chambre Supérieure Vue Mer',
      roomType: 'SUPERIOR',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'King',
      pricePerNight: 220,
      surface: 35,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar', 'Coffre-fort', 'TV satellite', 'Balcon privé', 'Vue mer'],
      description: 'Chambre supérieure avec balcon et vue mer.',
      bathroomType: 'Salle de bain avec baignoire',
      isVip: false,
      hasBalcony: true,
      status: 'available',
    },
    {
      venueId: hotel._id,
      roomNumber: 401,
      name: 'Suite Présidentielle',
      roomType: 'PRESIDENTIAL',
      capacity: 4,
      capacityAdults: 4,
      bedType: 'King',
      pricePerNight: 480,
      surface: 120,
      amenities: ['WiFi gratuit', 'Climatisation', 'Minibar privé', 'Coffre-fort', 'TV satellite', 'Terrasse panoramique', 'Vue mer 360°', 'Jacuzzi', 'Butler privé'],
      description: 'La suite la plus prestigieuse. Terrasse panoramique 80m² avec vue 360°.',
      bathroomType: 'Salle de bain de luxe',
      isVip: true,
      hasBalcony: true,
      hasVirtualTour: true,
      status: 'available',
    },
  ]);
  const hotelTour = await VirtualTour.create({ venueId: hotel._id, provider: 'klapty', embedUrl: KLAPTY, isActive: true });
  await TourHotspot.insertMany([
    { venueId: hotel._id, virtualTourId: hotelTour._id, label: 'Chambre 201', targetType: 'room', targetId: hotelRooms[1]._id, xPercent: 30, yPercent: 48, isActive: true },
    { venueId: hotel._id, virtualTourId: hotelTour._id, label: 'Suite Présidentielle', targetType: 'room', targetId: hotelRooms[2]._id, xPercent: 65, yPercent: 45, isActive: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 7) BEACH CLUBS — 1 venue (name contains "Beach")
  // ─────────────────────────────────────────────────────────────────────
  const beach = await Venue.create({
    name: 'Azure Beach Club Hammamet',
    slug: 'azure-beach-club-hammamet',
    type: 'EVENT_SPACE',
    city: 'Hammamet',
    governorate: 'Nabeul',
    address: 'Plage de Yasmine Hammamet',
    shortDescription: 'Beach club exclusif, transats, piscine et lounge bar.',
    description: 'Beach club exclusif en bord de mer. Transats premium, piscine à débordement, lounge bar et restaurant méditerranéen les pieds dans le sable.',
    startingPrice: 40,
    priceRangeMin: 30,
    priceRangeMax: 200,
    amenities: ['plage privée', 'piscine', 'restaurant', 'bar', 'parking', 'wifi'],
    categoryIds: [catBeach],
    ownerId: ownerEvent._id,
    isPublished: true,
    isFeatured: true,
  });
  await VenueMedia.create({ venueId: beach._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  await Table.insertMany([
    { venueId: beach._id, tableNumber: 1, code: 'BC1', capacity: 2, locationLabel: 'Transat duo', price: 40, basePrice: 40, isVip: false },
    { venueId: beach._id, tableNumber: 2, code: 'BC2', capacity: 4, locationLabel: 'Cabana', price: 120, basePrice: 120, isVip: true },
    { venueId: beach._id, tableNumber: 3, code: 'VIP', capacity: 8, locationLabel: 'Lounge VIP', price: 200, basePrice: 200, isVip: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // 8) SPAS & BIEN-ÊTRE — 1 venue (name contains "Spa")
  // ─────────────────────────────────────────────────────────────────────
  const spa = await Venue.create({
    name: 'Zen Spa & Bien-être',
    slug: 'zen-spa-bien-etre-sidi-bou-said',
    type: 'HOTEL',
    city: 'Sidi Bou Said',
    governorate: 'Tunis',
    address: 'Avenue Hédi Chaker, Sidi Bou Said',
    shortDescription: 'Spa de luxe, hammam, massages et soins du visage.',
    description: 'Spa de luxe dans un cadre raffiné. Hammam traditionnel, massages signature, soins du visage, rituels orientaux et piscine thermale.',
    startingPrice: 80,
    priceRangeMin: 60,
    priceRangeMax: 250,
    amenities: ['hammam', 'piscine', 'massage', 'wifi', 'parking'],
    categoryIds: [catSpas],
    ownerId: ownerHotel._id,
    isPublished: true,
    isFeatured: true,
    reservationModes: ['room'],
  });
  await VenueMedia.create({ venueId: spa._id, kind: 'TOUR_360_EMBED_URL', url: KLAPTY });
  await Room.insertMany([
    {
      venueId: spa._id,
      roomNumber: 1,
      name: 'Cabine Hammam Duo',
      roomType: 'STANDARD',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Lit de massage',
      pricePerNight: 80,
      surface: 20,
      amenities: ['Hammam', 'Gommage', 'Produits naturels'],
      description: 'Rituel hammam duo : gommage noir, masque d\'argile, vapeur traditionnelle.',
      bathroomType: 'Hammam privatif',
      isVip: false,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: spa._id,
      roomNumber: 2,
      name: 'Suite Signature Massage',
      roomType: 'SUITE',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Lit double massage',
      pricePerNight: 180,
      surface: 35,
      amenities: ['Massage 90min', 'Champagne', 'Sauna privé', 'Jacuzzi'],
      description: 'Suite signature avec massage en duo de 90min, sauna privé et jacuzzi.',
      bathroomType: 'Salle de bain de luxe',
      isVip: true,
      hasBalcony: false,
      status: 'available',
    },
    {
      venueId: spa._id,
      roomNumber: 3,
      name: 'Pavillon Rituel Royal',
      roomType: 'SUITE',
      capacity: 2,
      capacityAdults: 2,
      bedType: 'Lit royal',
      pricePerNight: 250,
      surface: 60,
      amenities: ['Rituel 3h', 'Hammam privé', 'Massage 4 mains', 'Piscine thermale privée'],
      description: 'Pavillon prestige : rituel oriental complet de 3h, massage 4 mains, piscine thermale privée.',
      bathroomType: 'Hammam & jacuzzi privatifs',
      isVip: true,
      hasBalcony: false,
      status: 'available',
    },
  ]);

  console.log('🏢 Created 8 venues: 1 per category (café, bar, restaurant, club, salle, hôtel, beach club, spa)');

  // ─────────────────────────────────────────────────────────────────────
  // Events + sample reservations
  // ─────────────────────────────────────────────────────────────────────
  const now = new Date();
  const tonight = new Date(now); tonight.setHours(21, 0, 0, 0);
  const tomorrowEv = new Date(now); tomorrowEv.setDate(tomorrowEv.getDate() + 2); tomorrowEv.setHours(21, 0, 0, 0);

  await Event.insertMany([
    { venueId: cafe1._id, title: 'Soirée Jazz', slug: 'soiree-jazz-babol', type: 'CONCERT', startAt: tomorrowEv, description: 'Concert jazz en live.', isPublished: true },
    { venueId: bar._id, title: 'Rooftop Sunset DJ', slug: 'rooftop-sunset-dj-skyline', type: 'SOIREE', startAt: tonight, description: 'Coucher de soleil & DJ set.', isPublished: true },
    { venueId: club._id, title: 'Nuit Latina', slug: 'nuit-latina-mojito', type: 'SOIREE', startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000), description: 'Salsa, bachata et reggaeton.', isPublished: true },
    { venueId: eventSpace._id, title: 'Concert Live', slug: 'concert-live-el-teatro', type: 'CONCERT', startAt: tonight, description: 'Concert ce soir.', isPublished: true },
    { venueId: beach._id, title: 'Beach Party', slug: 'beach-party-azure', type: 'SOIREE', startAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000), description: 'Soirée plage avec DJ international.', isPublished: true },
  ]);
  console.log('📅 Created 5 events');

  const twoHours = 2 * 60 * 60 * 1000;
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(20, 0, 0, 0);
  const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1); dayAfter.setHours(19, 30, 0, 0);

  const codes = new Set<string>();
  function uniqueCode() {
    let c: string;
    do c = generateConfirmationCode(8); while (codes.has(c));
    codes.add(c);
    return c;
  }

  await Reservation.insertMany([
    { userId: normalUser._id, venueId: cafe1._id, bookingType: 'TABLE', tableId: cafe1Tables[0]._id, startAt: tomorrow, endAt: new Date(tomorrow.getTime() + twoHours), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 12, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: normalUser._id, venueId: restaurant._id, bookingType: 'TABLE', tableId: restaurantTables[0]._id, startAt: dayAfter, endAt: new Date(dayAfter.getTime() + twoHours), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 45, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
    { userId: normalUser._id, venueId: hotel._id, bookingType: 'ROOM', roomId: hotelRooms[0]._id, startAt: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000), endAt: new Date(tomorrow.getTime() + 9 * 24 * 60 * 60 * 1000), status: 'CONFIRMED', paymentStatus: 'paid', confirmationCode: uniqueCode(), totalPrice: 300, guestFirstName: 'Rania', guestLastName: 'Ben Salem', guestPhone: '12345678', partySize: 2 },
  ]);
  console.log('📋 Created 3 sample reservations');

  console.log('\n✅ Seed completed.');
  console.log('\n📝 Credentials (password: ' + PASSWORD + ')');
  console.log('  Admin:    admin@mareservation.tn');
  console.log('  Customer: user@mareservation.tn');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});

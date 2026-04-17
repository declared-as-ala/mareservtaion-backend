import mongoose, { Schema, Document, Types } from 'mongoose';

export type VenueType = 'CAFE' | 'RESTAURANT' | 'HOTEL' | 'CINEMA' | 'EVENT_SPACE';
export type ReservationMode = 'table' | 'room' | 'seat_zone' | 'seat' | 'ticket';

export interface IVenueCoordinates {
  lat: number;
  lng: number;
}

export type ImmersiveType = 'none' | 'virtual-tour' | 'view-360';
export type ImmersiveSourceType = 'url' | 'upload';
export type ImmersiveProvider = 'custom' | 'matterport' | 'klapty';

export interface IVenue extends Document {
  name: string;
  slug: string;
  type: VenueType;
  shortDescription?: string;
  shortDescriptionFr?: string;
  description: string;
  descriptionFr?: string;
  city: string;
  governorate?: string;
  address: string;
  phone?: string;
  email?: string;
  coordinates?: IVenueCoordinates;
  coverImage?: string;
  gallery?: string[];
  categoryIds?: Types.ObjectId[];
  tagIds?: Types.ObjectId[];
  amenities?: string[];
  startingPrice?: number;
  priceRangeMin?: number;
  priceRangeMax?: number;
  isPublished: boolean;
  isFeatured: boolean;
  isVedette?: boolean;
  vedetteOrder?: number;
  bannerImage?: string;
  hasVirtualTour?: boolean;
  activeEventTonight?: boolean;
  reservationModes?: ReservationMode[];
  immersiveType?: ImmersiveType;
  immersiveSourceType?: ImmersiveSourceType | null;
  immersiveProvider?: ImmersiveProvider;
  immersiveUrl?: string | null;
  immersiveFile?: string | null;
  immersiveMeta?: Record<string, unknown>;
  checkInPolicy?: string;
  checkOutPolicy?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IVenue>(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    type: { type: String, enum: ['CAFE', 'RESTAURANT', 'HOTEL', 'CINEMA', 'EVENT_SPACE'], required: true },
    shortDescription: { type: String },
    shortDescriptionFr: { type: String },
    description: { type: String, required: true },
    descriptionFr: { type: String },
    city: { type: String, required: true },
    governorate: { type: String },
    address: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    coordinates: { lat: { type: Number }, lng: { type: Number } },
    coverImage: { type: String },
    gallery: { type: [String], default: [] },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    tagIds: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    amenities: { type: [String], default: [] },
    startingPrice: { type: Number, default: 0 },
    priceRangeMin: { type: Number },
    priceRangeMax: { type: Number },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isVedette: { type: Boolean, default: false },
    vedetteOrder: { type: Number, default: 0 },
    bannerImage: { type: String },
    hasVirtualTour: { type: Boolean, default: false },
    activeEventTonight: { type: Boolean, default: false },
    reservationModes: { type: [String], enum: ['table', 'room', 'seat_zone', 'seat', 'ticket'], default: [] },
    immersiveType: { type: String, enum: ['none', 'virtual-tour', 'view-360'], default: 'none' },
    immersiveSourceType: { type: String, enum: ['url', 'upload'], default: null },
    immersiveProvider: { type: String, enum: ['custom', 'matterport', 'klapty'], default: 'custom' },
    immersiveUrl: { type: String, default: null },
    immersiveFile: { type: String, default: null },
    immersiveMeta: { type: Schema.Types.Mixed, default: null },
    checkInPolicy: { type: String },
    checkOutPolicy: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

VenueSchema.index({ city: 1, type: 1 });
VenueSchema.index({ name: 'text', description: 'text', city: 'text' });
VenueSchema.index({ isPublished: 1, isFeatured: -1 });
VenueSchema.index({ hasVirtualTour: 1, isPublished: 1 });

export const Venue = mongoose.model<IVenue>('Venue', VenueSchema);

import mongoose, { Schema, Document, Types } from 'mongoose';

export type VenueType = 'CAFE' | 'RESTAURANT' | 'HOTEL' | 'CINEMA' | 'EVENT_SPACE';

export interface IVenue extends Document {
  name: string;
  slug: string;
  type: VenueType;
  shortDescription?: string;
  description: string;
  city: string;
  governorate?: string;
  address: string;
  phone?: string;
  coverImage?: string;
  gallery?: string[];
  categoryIds?: Types.ObjectId[];
  amenities?: string[];
  rating: number;
  ratingCount?: number;
  startingPrice?: number;
  priceRangeMin?: number;
  priceRangeMax?: number;
  isPublished: boolean;
  isFeatured: boolean;
  activeEventTonight?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IVenue>(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    type: { type: String, enum: ['CAFE', 'RESTAURANT', 'HOTEL', 'CINEMA', 'EVENT_SPACE'], required: true },
    shortDescription: { type: String },
    description: { type: String, required: true },
    city: { type: String, required: true },
    governorate: { type: String },
    address: { type: String, required: true },
    phone: { type: String },
    coverImage: { type: String },
    gallery: { type: [String], default: [] },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    amenities: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    startingPrice: { type: Number, default: 0 },
    priceRangeMin: { type: Number },
    priceRangeMax: { type: Number },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    activeEventTonight: { type: Boolean, default: false },
  },
  { timestamps: true }
);

VenueSchema.index({ city: 1, type: 1 });
VenueSchema.index({ name: 'text', description: 'text', city: 'text' });
VenueSchema.index({ isPublished: 1, isFeatured: -1 });

export const Venue = mongoose.model<IVenue>('Venue', VenueSchema);

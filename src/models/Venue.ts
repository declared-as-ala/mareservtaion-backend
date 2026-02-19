import mongoose, { Schema, Document } from 'mongoose';

export type VenueType = 'CAFE' | 'RESTAURANT' | 'HOTEL' | 'CINEMA';

export interface IVenue extends Document {
  name: string;
  type: VenueType;
  city: string;
  address: string;
  description: string;
  rating: number;
  startingPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IVenue>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['CAFE', 'RESTAURANT', 'HOTEL', 'CINEMA'], required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    description: { type: String, required: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    startingPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

VenueSchema.index({ city: 1, type: 1 });
VenueSchema.index({ name: 'text', description: 'text', city: 'text' });

export const Venue = mongoose.model<IVenue>('Venue', VenueSchema);

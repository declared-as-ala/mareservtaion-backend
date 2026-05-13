import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRoom extends Document {
  venueId: Types.ObjectId;
  name?: string;
  roomNumber: number;
  roomType: string;
  capacityAdults?: number;
  capacityChildren?: number;
  capacity: number;
  bedType?: string;
  pricePerNight: number;
  surface?: number;
  amenities: string[];
  description?: string;
  bathroomType?: string;
  isActive: boolean;
  isReservable: boolean;
  isVip?: boolean;
  hasBalcony?: boolean;
  hasVirtualTour?: boolean;
  status?: 'available' | 'reserved' | 'blocked';
  coverImage?: string;
  gallery: string[];
  /** Single 360° panoramic images (one image, full rotation — no navigation between scenes) */
  panoramicImages: string[];
}

const RoomSchema = new Schema<IRoom>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    name: { type: String },
    roomNumber: { type: Number, required: true },
    roomType: { type: String, required: true },
    capacityAdults: { type: Number },
    capacityChildren: { type: Number },
    capacity: { type: Number, required: true, min: 1 },
    bedType: { type: String },
    pricePerNight: { type: Number, required: true },
    surface: { type: Number },
    amenities: { type: [String], default: [] },
    description: { type: String },
    bathroomType: { type: String },
    isActive: { type: Boolean, default: true },
    isReservable: { type: Boolean, default: true },
    isVip: { type: Boolean, default: false },
    hasBalcony: { type: Boolean, default: false },
    hasVirtualTour: { type: Boolean, default: false },
    status: { type: String, enum: ['available', 'reserved', 'blocked'], default: 'available' },
    coverImage: { type: String },
    gallery: { type: [String], default: [] },
    panoramicImages: { type: [String], default: [] },
  },
  { timestamps: false }
);

RoomSchema.index({ venueId: 1, roomNumber: 1 }, { unique: true });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);

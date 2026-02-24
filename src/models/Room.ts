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
  amenities: string[];
  isActive: boolean;
  isReservable: boolean;
  coverImage?: string;
  gallery: string[];
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
    amenities: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isReservable: { type: Boolean, default: true },
    coverImage: { type: String },
    gallery: { type: [String], default: [] },
  },
  { timestamps: false }
);

RoomSchema.index({ venueId: 1, roomNumber: 1 }, { unique: true });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);

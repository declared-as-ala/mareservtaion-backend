import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRoom extends Document {
  venueId: Types.ObjectId;
  roomNumber: number;
  roomType: string;
  capacity: number;
  pricePerNight: number;
}

const RoomSchema = new Schema<IRoom>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    roomNumber: { type: Number, required: true },
    roomType: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    pricePerNight: { type: Number, required: true },
  },
  { timestamps: false }
);

RoomSchema.index({ venueId: 1, roomNumber: 1 }, { unique: true });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISeat extends Document {
  venueId: Types.ObjectId;
  seatNumber: number;
  zone: string;
  price: number;
}

const SeatSchema = new Schema<ISeat>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    seatNumber: { type: Number, required: true },
    zone: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { timestamps: false }
);

SeatSchema.index({ venueId: 1, seatNumber: 1 }, { unique: true });

export const Seat = mongoose.model<ISeat>('Seat', SeatSchema);

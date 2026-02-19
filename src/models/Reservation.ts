import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type BookingType = 'TABLE' | 'ROOM' | 'SEAT';

export interface IReservation extends Document {
  userId: Types.ObjectId;
  venueId: Types.ObjectId;
  bookingType: BookingType;
  tableId?: Types.ObjectId;
  roomId?: Types.ObjectId;
  seatId?: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  status: ReservationStatus;
  totalPrice: number;
  guestFirstName?: string;
  guestLastName?: string;
  guestPhone?: string;
  partySize?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    bookingType: { type: String, enum: ['TABLE', 'ROOM', 'SEAT'], required: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
      default: 'CONFIRMED',
    },
    totalPrice: { type: Number, required: true, default: 0 },
    guestFirstName: { type: String },
    guestLastName: { type: String },
    guestPhone: { type: String },
    partySize: { type: Number },
  },
  { timestamps: true }
);

ReservationSchema.index({ tableId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ roomId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ seatId: 1, startAt: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ venueId: 1, bookingType: 1, startAt: 1 });

export const Reservation = mongoose.model<IReservation>('Reservation', ReservationSchema);

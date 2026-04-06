import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED' | 'NO_SHOW';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
export type BookingType = 'TABLE' | 'ROOM' | 'SEAT';
export type ReservableType = 'table' | 'room' | 'seat_zone' | 'seat';
export type CheckInStatus = 'not_checked_in' | 'checked_in';

export interface IPriceBreakdown {
  subtotal: number;
  serviceFee?: number;
  taxes?: number;
  discount?: number;
  total: number;
  currency: string;
}

export interface IReservation extends Document {
  reservationCode: string;
  userId: Types.ObjectId;
  venueId: Types.ObjectId;
  eventId?: Types.ObjectId;
  eventSessionId?: Types.ObjectId;
  reservableUnitId?: Types.ObjectId;
  reservableType?: ReservableType;
  bookingType: BookingType;
  tableId?: Types.ObjectId;
  roomId?: Types.ObjectId;
  seatId?: Types.ObjectId;
  reservationDate?: Date;
  startAt: Date;
  endAt: Date;
  peopleCount?: number;
  partySize?: number;
  customerFirstName?: string;
  customerLastName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestPhone?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  specialRequest?: string;
  priceBreakdown?: IPriceBreakdown;
  totalPrice: number;
  confirmationCode: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  qrCodeData?: string;
  qrCodeImageUrl?: string;
  checkInStatus: CheckInStatus;
  checkedInAt?: Date;
  checkedInBy?: Types.ObjectId;
  source?: string;
  orderType?: 'table_only' | 'with_menu';
  menuItems?: Array<{
    menuItemId: Types.ObjectId;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  menuTotal?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    reservationCode: { type: String, unique: true, sparse: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    eventSessionId: { type: Schema.Types.ObjectId, ref: 'EventSession' },
    reservableUnitId: { type: Schema.Types.ObjectId, ref: 'ReservableUnit' },
    reservableType: { type: String, enum: ['table', 'room', 'seat_zone', 'seat'] },
    bookingType: { type: String, enum: ['TABLE', 'ROOM', 'SEAT'], required: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat' },
    reservationDate: { type: Date },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    peopleCount: { type: Number },
    partySize: { type: Number },
    customerFirstName: { type: String },
    customerLastName: { type: String },
    guestFirstName: { type: String },
    guestLastName: { type: String },
    guestPhone: { type: String },
    customerPhone: { type: String },
    customerEmail: { type: String },
    notes: { type: String },
    specialRequest: { type: String },
    priceBreakdown: {
      subtotal: { type: Number },
      serviceFee: { type: Number },
      taxes: { type: Number },
      discount: { type: Number },
      total: { type: Number },
      currency: { type: String },
    },
    totalPrice: { type: Number, required: true, default: 0 },
    confirmationCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'], default: 'CONFIRMED' },
    paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed', 'refunded'], default: 'unpaid' },
    qrCodeData: { type: String },
    qrCodeImageUrl: { type: String },
    checkInStatus: { type: String, enum: ['not_checked_in', 'checked_in'], default: 'not_checked_in' },
    checkedInAt: { type: Date },
    checkedInBy: { type: Schema.Types.ObjectId, ref: 'User' },
    source: { type: String, default: 'web' },
    orderType: { type: String, enum: ['table_only', 'with_menu'], default: 'table_only' },
    menuItems: [{
      menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
      name: { type: String },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number },
    }],
    menuTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ReservationSchema.index({ tableId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ roomId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ seatId: 1, startAt: 1 });
ReservationSchema.index({ reservableUnitId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ venueId: 1, bookingType: 1, startAt: 1 });
ReservationSchema.index({ reservationCode: 1 });
ReservationSchema.index({ confirmationCode: 1 });

export const Reservation = mongoose.model<IReservation>('Reservation', ReservationSchema);

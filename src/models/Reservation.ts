import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
export type BookingType = 'TABLE' | 'ROOM' | 'SEAT';
export type ReservableType = 'table' | 'room' | 'seat_zone' | 'seat';
export type CheckInStatus = 'not_checked_in' | 'checked_in';
export type PaymentOption = 'online' | 'deposit' | 'pay_at_hotel';

export interface IPriceBreakdown {
  subtotal: number;
  serviceFee?: number;
  taxes?: number;
  discount?: number;
  extrasTotal?: number;
  total: number;
  currency: string;
}

export interface IReservationExtra {
  key: string;
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: 'once' | 'per_night' | 'per_person';
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
  paymentMethod?: 'cash' | 'card' | 'online' | 'wallet';
  paymentProvider?: string;
  amountPaid?: number;
  remainingAmount?: number;
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
  reminderEmailSentAt?: Date;
  reviewRequestSentAt?: Date;
  cancellationEmailSentAt?: Date;
  // Hotel-specific
  holdId?: Types.ObjectId;
  paymentOption?: PaymentOption;
  nights?: number;
  adults?: number;
  children?: number;
  childrenAges?: number[];
  roomsCount?: number;
  arrivalTime?: string; // "HH:mm"
  extras?: IReservationExtra[];
  extrasTotal?: number;
  cancellationDeadline?: Date;
  acceptedHotelPolicy?: boolean;
  acceptedPlatformTerms?: boolean;
  idNumber?: string;
  nationality?: string;
  dateOfBirth?: Date;
  guestCountry?: string;
  guestCity?: string;
  needBabyBed?: boolean;
  needExtraBed?: boolean;
  accessibilityRequest?: string;
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
      extrasTotal: { type: Number },
      total: { type: Number },
      currency: { type: String },
    },
    holdId: { type: Schema.Types.ObjectId, ref: 'ReservationHold' },
    paymentOption: { type: String, enum: ['online', 'deposit', 'pay_at_hotel'] },
    nights: { type: Number },
    adults: { type: Number },
    children: { type: Number, default: 0 },
    childrenAges: { type: [Number], default: [] },
    roomsCount: { type: Number, default: 1 },
    arrivalTime: { type: String },
    extras: [{
      key: { type: String },
      name: { type: String },
      unitPrice: { type: Number },
      quantity: { type: Number, default: 1 },
      unit: { type: String, enum: ['once', 'per_night', 'per_person'], default: 'once' },
    }],
    extrasTotal: { type: Number, default: 0 },
    cancellationDeadline: { type: Date },
    acceptedHotelPolicy: { type: Boolean, default: false },
    acceptedPlatformTerms: { type: Boolean, default: false },
    idNumber: { type: String },
    nationality: { type: String },
    dateOfBirth: { type: Date },
    guestCountry: { type: String },
    guestCity: { type: String },
    needBabyBed: { type: Boolean, default: false },
    needExtraBed: { type: Boolean, default: false },
    accessibilityRequest: { type: String },
    totalPrice: { type: Number, required: true, default: 0 },
    confirmationCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'confirmed',
    },
    paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed', 'refunded'], default: 'unpaid' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'online', 'wallet'] },
    paymentProvider: { type: String },
    amountPaid: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
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
    reminderEmailSentAt: { type: Date },
    reviewRequestSentAt: { type: Date },
    cancellationEmailSentAt: { type: Date },
  },
  { timestamps: true }
);

ReservationSchema.index({ tableId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ roomId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ seatId: 1, startAt: 1 });
ReservationSchema.index({ reservableUnitId: 1, startAt: 1, endAt: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ venueId: 1, bookingType: 1, startAt: 1 });
ReservationSchema.index({ venueId: 1, status: 1, startAt: -1 });
export const Reservation = mongoose.model<IReservation>('Reservation', ReservationSchema);

import mongoose, { Schema, Document, Types } from 'mongoose';

export type HoldStatus = 'active' | 'expired' | 'converted' | 'released';

export interface IReservationHold extends Document {
  venueId: Types.ObjectId;
  reservableUnitId?: Types.ObjectId;
  eventSessionId?: Types.ObjectId;
  userId?: Types.ObjectId;
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
  peopleCount: number;
  status: HoldStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationHoldSchema = new Schema<IReservationHold>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    reservableUnitId: { type: Schema.Types.ObjectId, ref: 'ReservableUnit' },
    eventSessionId: { type: Schema.Types.ObjectId, ref: 'EventSession' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    dateKey: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    peopleCount: { type: Number, default: 1 },
    status: { type: String, enum: ['active', 'expired', 'converted', 'released'], default: 'active' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ReservationHoldSchema.index({ reservableUnitId: 1, startsAt: 1, endsAt: 1 });
ReservationHoldSchema.index({ status: 1, expiresAt: 1 });
ReservationHoldSchema.index({ userId: 1, status: 1 });

export const ReservationHold = mongoose.model<IReservationHold>('ReservationHold', ReservationHoldSchema);

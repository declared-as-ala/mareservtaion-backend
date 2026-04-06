import mongoose, { Schema, Document, Types } from 'mongoose';

export type UnitType = 'table' | 'room' | 'seat_zone' | 'seat';
export type PriceType = 'fixed' | 'perPerson' | 'perNight' | 'perSession' | 'free';
export type UnitStatus = 'active' | 'inactive' | 'maintenance' | 'hidden';

export interface IReservableUnit extends Document {
  venueId: Types.ObjectId;
  zoneId?: Types.ObjectId;
  unitType: UnitType;
  label: string;
  code: string;
  capacityMin?: number;
  capacityMax?: number;
  priceType: PriceType;
  basePrice: number;
  currency: string;
  status: UnitStatus;
  isReservable: boolean;
  attributes?: Record<string, unknown>;
  mediaUrls?: string[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReservableUnitSchema = new Schema<IReservableUnit>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    unitType: { type: String, enum: ['table', 'room', 'seat_zone', 'seat'], required: true },
    label: { type: String, required: true },
    code: { type: String, required: true },
    capacityMin: { type: Number },
    capacityMax: { type: Number },
    priceType: { type: String, enum: ['fixed', 'perPerson', 'perNight', 'perSession', 'free'], default: 'fixed' },
    basePrice: { type: Number, default: 0 },
    currency: { type: String, default: 'TND' },
    status: { type: String, enum: ['active', 'inactive', 'maintenance', 'hidden'], default: 'active' },
    isReservable: { type: Boolean, default: true },
    attributes: { type: Schema.Types.Mixed },
    mediaUrls: { type: [String], default: [] },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ReservableUnitSchema.index({ venueId: 1, code: 1 }, { unique: true });
ReservableUnitSchema.index({ venueId: 1, unitType: 1, status: 1 });
ReservableUnitSchema.index({ zoneId: 1, displayOrder: 1 });

export const ReservableUnit = mongoose.model<IReservableUnit>('ReservableUnit', ReservableUnitSchema);

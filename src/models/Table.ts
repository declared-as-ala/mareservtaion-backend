import mongoose, { Schema, Document, Types } from 'mongoose';

export type TablePriceType = 'fixed' | 'perPerson' | 'eventPackage';
export type TableDefaultStatus = 'available' | 'reserved' | 'blocked';

export interface ITable extends Document {
  venueId: Types.ObjectId;
  name?: string;
  code: string;
  tableNumber: number;
  capacity: number;
  capacityMin?: number;
  capacityMax?: number;
  locationLabel: string;
  priceType: TablePriceType;
  basePrice: number;
  price: number;
  minimumSpend?: number;
  currency: string;
  isVip: boolean;
  isActive: boolean;
  isReservable: boolean;
  defaultStatus: TableDefaultStatus;
  tags: string[];
  displayOrder: number;
}

const TableSchema = new Schema<ITable>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    name: { type: String },
    code: { type: String, default: 'T1' },
    tableNumber: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1 },
    capacityMin: { type: Number },
    capacityMax: { type: Number },
    locationLabel: { type: String },
    priceType: { type: String, enum: ['fixed', 'perPerson', 'eventPackage'], default: 'fixed' },
    basePrice: { type: Number, default: 0 },
    price: { type: Number, required: true },
    minimumSpend: { type: Number },
    currency: { type: String, default: 'TND' },
    isVip: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isReservable: { type: Boolean, default: true },
    defaultStatus: { type: String, enum: ['available', 'reserved', 'blocked'], default: 'available' },
    tags: { type: [String], default: [] },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: false }
);

TableSchema.index({ venueId: 1, tableNumber: 1 }, { unique: true });
TableSchema.index({ venueId: 1, code: 1 }, { unique: true });

export const Table = mongoose.model<ITable>('Table', TableSchema);

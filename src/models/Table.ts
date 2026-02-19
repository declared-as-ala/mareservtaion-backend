import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITable extends Document {
  venueId: Types.ObjectId;
  tableNumber: number;
  capacity: number;
  locationLabel: string;
  price: number;
  isVip: boolean;
}

const TableSchema = new Schema<ITable>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    tableNumber: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1 },
    locationLabel: { type: String, required: true },
    price: { type: Number, required: true },
    isVip: { type: Boolean, default: false },
  },
  { timestamps: false }
);

TableSchema.index({ venueId: 1, tableNumber: 1 }, { unique: true });

export const Table = mongoose.model<ITable>('Table', TableSchema);

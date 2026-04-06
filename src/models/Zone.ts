import mongoose, { Schema, Document, Types } from 'mongoose';

export type ZoneType = 'table_zone' | 'seat_zone' | 'room_zone' | 'mixed';

export interface IZone extends Document {
  venueId: Types.ObjectId;
  name: string;
  slug: string;
  zoneType: ZoneType;
  descriptionFr?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    zoneType: { type: String, enum: ['table_zone', 'seat_zone', 'room_zone', 'mixed'], required: true },
    descriptionFr: { type: String },
    color: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ZoneSchema.index({ venueId: 1 });
ZoneSchema.index({ venueId: 1, slug: 1 }, { unique: true });
ZoneSchema.index({ venueId: 1, sortOrder: 1 });

export const Zone = mongoose.model<IZone>('Zone', ZoneSchema);

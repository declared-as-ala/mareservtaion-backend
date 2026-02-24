import mongoose, { Schema, Document, Types } from 'mongoose';

export type HotspotTargetType = 'table' | 'room' | 'seat_zone' | 'info';

export interface ITourHotspot extends Document {
  virtualTourId: Types.ObjectId;
  label: string;
  targetType: HotspotTargetType;
  targetId: Types.ObjectId;
  xPercent: number;
  yPercent: number;
  iconType?: string;
  tooltipText?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

const TourHotspotSchema = new Schema<ITourHotspot>(
  {
    virtualTourId: { type: Schema.Types.ObjectId, ref: 'VirtualTour', required: true },
    label: { type: String, required: true },
    targetType: { type: String, enum: ['table', 'room', 'seat_zone', 'info'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    xPercent: { type: Number, required: true, min: 0, max: 100 },
    yPercent: { type: Number, required: true, min: 0, max: 100 },
    iconType: { type: String },
    tooltipText: { type: String },
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

TourHotspotSchema.index({ virtualTourId: 1 });

export const TourHotspot = mongoose.model<ITourHotspot>('TourHotspot', TourHotspotSchema);

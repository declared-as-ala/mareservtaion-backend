import mongoose, { Schema, Document, Types } from 'mongoose';

export type HotspotTargetType = 'reservable_unit' | 'table' | 'room' | 'seat_zone' | 'info' | 'event' | 'scene';

export interface IAnchorPosition {
  x: number;
  y: number;
  z: number;
}

export interface ITourHotspot extends Document {
  venueId: Types.ObjectId;
  virtualTourId: Types.ObjectId;
  eventSessionId?: Types.ObjectId;
  targetType: HotspotTargetType;
  targetId: Types.ObjectId;
  label: string;
  iconType?: string;
  color?: string;
  isActive: boolean;
  xPercent: number;
  yPercent: number;
  startTimeSec?: number;
  endTimeSec?: number;
  yaw?: number;
  pitch?: number;
  anchorPosition?: IAnchorPosition;
  stemVector?: IAnchorPosition;
  tooltipText?: string;
  tooltipTextFr?: string;
  displayOrder: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TourHotspotSchema = new Schema<ITourHotspot>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    virtualTourId: { type: Schema.Types.ObjectId, ref: 'VirtualTour', required: true },
    eventSessionId: { type: Schema.Types.ObjectId, ref: 'EventSession' },
    targetType: { type: String, enum: ['reservable_unit', 'table', 'room', 'seat_zone', 'info', 'event', 'scene'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    label: { type: String, required: true },
    iconType: { type: String },
    color: { type: String },
    isActive: { type: Boolean, default: true },
    xPercent: { type: Number, required: true, min: 0, max: 100 },
    yPercent: { type: Number, required: true, min: 0, max: 100 },
    startTimeSec: { type: Number },
    endTimeSec: { type: Number },
    yaw: { type: Number },
    pitch: { type: Number },
    anchorPosition: { x: { type: Number }, y: { type: Number }, z: { type: Number } },
    stemVector: { x: { type: Number }, y: { type: Number }, z: { type: Number } },
    tooltipText: { type: String },
    tooltipTextFr: { type: String },
    displayOrder: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TourHotspotSchema.index({ virtualTourId: 1 });
TourHotspotSchema.index({ venueId: 1, virtualTourId: 1 });

export const TourHotspot = mongoose.model<ITourHotspot>('TourHotspot', TourHotspotSchema);

import mongoose, { Schema, Document, Types } from 'mongoose';

export type PlacementTargetType = 'event' | 'venue' | 'room' | 'reservable_unit';

export interface ISponsoredPlacement extends Document {
  placementKey: string;
  targetType: PlacementTargetType;
  targetId: Types.ObjectId;
  badgeTextFr?: string;
  priority: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SponsoredPlacementSchema = new Schema<ISponsoredPlacement>(
  {
    placementKey: { type: String, required: true },
    targetType: { type: String, enum: ['event', 'venue', 'room', 'reservable_unit'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    badgeTextFr: { type: String },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
  },
  { timestamps: true }
);

SponsoredPlacementSchema.index({ placementKey: 1, isActive: 1 });
SponsoredPlacementSchema.index({ priority: -1, isActive: 1 });

export const SponsoredPlacement = mongoose.model<ISponsoredPlacement>('SponsoredPlacement', SponsoredPlacementSchema);

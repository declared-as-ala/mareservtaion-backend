import mongoose, { Schema, Document, Types } from 'mongoose';

export type VirtualTourProvider = 'klapty' | 'pannellum' | 'video';

export interface IVirtualTour extends Document {
  venueId: Types.ObjectId;
  provider: VirtualTourProvider;
  embedUrl?: string;
  videoUrl?: string;
  previewImage?: string;
  aspectRatio?: number;
  width?: number;
  height?: number;
  isActive: boolean;
}

const VirtualTourSchema = new Schema<IVirtualTour>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    provider: { type: String, enum: ['klapty', 'pannellum', 'video'], required: true },
    embedUrl: { type: String },
    videoUrl: { type: String },
    previewImage: { type: String },
    aspectRatio: { type: Number },
    width: { type: Number },
    height: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VirtualTourSchema.index({ venueId: 1 });
VirtualTourSchema.index({ venueId: 1, isActive: 1 });

export const VirtualTour = mongoose.model<IVirtualTour>('VirtualTour', VirtualTourSchema);

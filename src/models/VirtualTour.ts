import mongoose, { Schema, Document, Types } from 'mongoose';

export type VirtualTourSourceType = 'matterport' | 'klapty_embed' | 'uploaded_video' | 'panorama_image' | 'custom_embed';
export type VirtualTourProvider = 'matterport' | 'klapty' | 'custom';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface IVirtualTour extends Document {
  venueId: Types.ObjectId;
  eventId?: Types.ObjectId;
  sourceType: VirtualTourSourceType;
  provider: VirtualTourProvider;
  title?: string;
  descriptionFr?: string;
  isActive: boolean;
  isDefault: boolean;
  embedUrl?: string;
  modelId?: string;
  videoUrl?: string;
  videoOriginalUrl?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
  posterImageUrl?: string;
  previewImage?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  is360: boolean;
  processingStatus: ProcessingStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const VirtualTourSchema = new Schema<IVirtualTour>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    sourceType: { type: String, enum: ['matterport', 'klapty_embed', 'uploaded_video', 'panorama_image', 'custom_embed'], default: 'klapty_embed' },
    provider: { type: String, enum: ['matterport', 'klapty', 'pannellum', 'custom', 'video'], default: 'klapty' },
    title: { type: String },
    descriptionFr: { type: String },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    embedUrl: { type: String },
    modelId: { type: String },
    videoUrl: { type: String },
    videoOriginalUrl: { type: String },
    originalFilename: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    durationSeconds: { type: Number },
    posterImageUrl: { type: String },
    previewImage: { type: String },
    width: { type: Number },
    height: { type: Number },
    aspectRatio: { type: Number },
    is360: { type: Boolean, default: false },
    processingStatus: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'ready' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

VirtualTourSchema.index({ venueId: 1 });
VirtualTourSchema.index({ venueId: 1, isActive: 1 });
VirtualTourSchema.index({ processingStatus: 1 });

export const VirtualTour = mongoose.model<IVirtualTour>('VirtualTour', VirtualTourSchema);

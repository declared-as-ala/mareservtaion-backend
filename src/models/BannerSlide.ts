import mongoose, { Schema, Document, Types } from 'mongoose';

export type BannerSlideType = 'category' | 'vedette_venue' | 'vedette_event' | 'generic';
export type ThemeVariant = 'light' | 'dark' | 'gradient' | 'brand';

export interface IBannerSlide extends Document {
  titleFr: string;
  subtitleFr?: string;
  ctaLabelFr?: string;
  ctaUrl?: string;
  imageUrlDesktop: string;
  imageUrlMobile?: string;
  type: BannerSlideType;
  linkedCategoryId?: Types.ObjectId;
  linkedEventId?: Types.ObjectId;
  linkedVenueId?: Types.ObjectId;
  autoPlayEnabled: boolean;
  isActive: boolean;
  sortOrder: number;
  startsAt?: Date;
  endsAt?: Date;
  themeVariant?: ThemeVariant;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSlideSchema = new Schema<IBannerSlide>(
  {
    titleFr: { type: String, required: true },
    subtitleFr: { type: String },
    ctaLabelFr: { type: String },
    ctaUrl: { type: String },
    imageUrlDesktop: { type: String, required: true },
    imageUrlMobile: { type: String },
    type: { type: String, enum: ['category', 'vedette_venue', 'vedette_event', 'generic'], default: 'generic' },
    linkedCategoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    linkedEventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    linkedVenueId: { type: Schema.Types.ObjectId, ref: 'Venue' },
    autoPlayEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    themeVariant: { type: String, enum: ['light', 'dark', 'gradient', 'brand'] },
  },
  { timestamps: true }
);

BannerSlideSchema.index({ isActive: 1, sortOrder: 1 });
BannerSlideSchema.index({ startsAt: 1, endsAt: 1 });

export const BannerSlide = mongoose.model<IBannerSlide>('BannerSlide', BannerSlideSchema);

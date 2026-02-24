import mongoose, { Schema, Document, Types } from 'mongoose';

export type VenueMediaKind = 'HERO_IMAGE' | 'GALLERY_IMAGE' | 'TOUR_360_VIDEO' | 'TOUR_360_EMBED_URL';

export interface IVenueMedia extends Document {
  venueId: Types.ObjectId;
  kind: VenueMediaKind;
  url: string;
}

const VenueMediaSchema = new Schema<IVenueMedia>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    kind: { type: String, enum: ['HERO_IMAGE', 'GALLERY_IMAGE', 'TOUR_360_VIDEO', 'TOUR_360_EMBED_URL'], required: true },
    url: { type: String, required: true },
  },
  { timestamps: false }
);

VenueMediaSchema.index({ venueId: 1, kind: 1 });

export const VenueMedia = mongoose.model<IVenueMedia>('VenueMedia', VenueMediaSchema);

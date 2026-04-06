import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFavorite extends Document {
  userId: Types.ObjectId;
  venueId: Types.ObjectId;
  createdAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  },
  { timestamps: true }
);

FavoriteSchema.index({ userId: 1, venueId: 1 }, { unique: true });
FavoriteSchema.index({ venueId: 1 });

export const Favorite = mongoose.model<IFavorite>('Favorite', FavoriteSchema);

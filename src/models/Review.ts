import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReview extends Document {
  userId: Types.ObjectId;
  venueId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  rating: number;       // 1–5
  comment: string;
  isVerified: boolean;  // true = came from real confirmed reservation
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 1000, trim: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ReviewSchema.index({ venueId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, venueId: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);

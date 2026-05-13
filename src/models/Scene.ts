import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScene extends Document {
  venueId: Types.ObjectId;
  /** If set, this scene belongs to a specific room/suite, not the venue globally */
  roomId?: Types.ObjectId;
  name: string;
  description?: string;
  /** Equirectangular 360° image URL (2:1 ratio) */
  image: string;
  /** Display order (lower = first) */
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SceneSchema = new Schema<IScene>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    image: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SceneSchema.index({ venueId: 1, roomId: 1, order: 1 });

export const Scene = mongoose.model<IScene>('Scene', SceneSchema);

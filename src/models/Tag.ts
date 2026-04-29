import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
  nameFr: string;
  slug: string;
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    nameFr: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    color: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TagSchema.index({ isActive: 1 });

export const Tag = mongoose.model<ITag>('Tag', TagSchema);

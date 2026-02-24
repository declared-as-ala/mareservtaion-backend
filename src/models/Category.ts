import mongoose, { Schema, Document } from 'mongoose';

export type CategoryType = 'primary' | 'secondary';

export interface ICategory extends Document {
  name: string;
  slug: string;
  type: CategoryType;
  icon?: string;
  displayOrder: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: ['primary', 'secondary'], default: 'primary' },
    icon: { type: String },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ slug: 1 });
CategorySchema.index({ displayOrder: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

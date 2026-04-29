import mongoose, { Schema, Document, Types } from 'mongoose';

export type CategoryType = 'primary' | 'secondary';
export type CategoryVenueType = 'cafe' | 'restaurant' | 'hotel' | 'cinema' | 'event' | 'mixed';

export interface ICategory extends Document {
  name: string;
  nameFr?: string;
  slug: string;
  type: CategoryType;
  venueType?: CategoryVenueType;
  icon?: string;
  parentId?: Types.ObjectId;
  isActive: boolean;
  sortOrder: number;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    nameFr: { type: String },
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: ['primary', 'secondary'], default: 'primary' },
    venueType: { type: String, enum: ['cafe', 'restaurant', 'hotel', 'cinema', 'event', 'mixed'] },
    icon: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ displayOrder: 1, sortOrder: 1 });
CategorySchema.index({ isActive: 1, venueType: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

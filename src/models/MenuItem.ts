import mongoose, { Schema, Document, Types } from 'mongoose';

export type MenuCategory = 'entree' | 'plat' | 'dessert' | 'boisson' | 'autre';

export interface IMenuItem extends Document {
  venueId: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  category: MenuCategory;
  image?: string;
  isAvailable: boolean;
  isPopular: boolean;
  allergens?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>({
  venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, enum: ['entree', 'plat', 'dessert', 'boisson', 'autre'], default: 'plat' },
  image: { type: String },
  isAvailable: { type: Boolean, default: true },
  isPopular: { type: Boolean, default: false },
  allergens: [{ type: String }],
}, { timestamps: true });

MenuItemSchema.index({ venueId: 1, category: 1 });

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);

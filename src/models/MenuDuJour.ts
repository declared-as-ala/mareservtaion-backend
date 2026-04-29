import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMenuDuJour extends Document {
  venueId: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  date: string;
  description?: string;
  items: Array<{ name: string; price: number; description?: string }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuDuJourSchema = new Schema<IMenuDuJour>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String },
    items: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

MenuDuJourSchema.index({ venueId: 1, date: 1 }, { unique: true });
MenuDuJourSchema.index({ ownerId: 1, isActive: 1 });

export const MenuDuJour = mongoose.model<IMenuDuJour>('MenuDuJour', MenuDuJourSchema);

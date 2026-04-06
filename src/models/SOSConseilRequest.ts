import mongoose, { Schema, Document } from 'mongoose';

export interface ISOSConseilRequest extends Document {
  fullName: string;
  phone: string;
  email?: string;
  occasionType: string;
  participantsCount: number;
  averageAgeRange: string;
  preferredRegion: string;
  preferredCategory: string;
  budgetRange: string;
  preferredDate?: Date;
  preferredTime?: string;
  details?: string;
  status: 'new' | 'in_review' | 'contacted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const SOSConseilRequestSchema = new Schema<ISOSConseilRequest>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    occasionType: {
      type: String,
      required: true,
      enum: ['birthday', 'wedding_engagement', 'business_meeting', 'family_event', 'romantic_dinner', 'other'],
    },
    participantsCount: { type: Number, required: true, min: 1 },
    averageAgeRange: {
      type: String,
      required: true,
      enum: ['18-20', '20-30', '30-40', '40-50', '50-60', '+60'],
    },
    preferredRegion: { type: String, required: true, trim: true },
    preferredCategory: {
      type: String,
      required: true,
      enum: ['cafe', 'restaurant', 'hotel', 'cinema', 'event_space'],
    },
    budgetRange: { type: String, required: true, trim: true },
    preferredDate: { type: Date },
    preferredTime: { type: String, trim: true },
    details: { type: String, trim: true },
    status: {
      type: String,
      enum: ['new', 'in_review', 'contacted', 'closed'],
      default: 'new',
    },
  },
  { timestamps: true }
);

export const SOSConseilRequest = mongoose.model<ISOSConseilRequest>(
  'SOSConseilRequest',
  SOSConseilRequestSchema
);

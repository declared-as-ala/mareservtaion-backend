import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  venueId: Types.ObjectId;
  title: string;
  type: string;
  startAt: Date;
  description: string;
}

const EventSchema = new Schema<IEvent>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['DJ', 'CHANTEUR', 'CONCERT', 'SOIREE', 'CINEMA'], required: true },
    startAt: { type: Date, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: false }
);

EventSchema.index({ venueId: 1 });
EventSchema.index({ startAt: 1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);

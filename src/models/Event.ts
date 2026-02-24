import mongoose, { Schema, Document, Types } from 'mongoose';

export type EventReservationMode = 'table' | 'seat_zone' | 'seat' | 'ticket_only';

export interface IEvent extends Document {
  venueId: Types.ObjectId;
  title: string;
  slug: string;
  type: string;
  description: string;
  coverImage?: string;
  startAt: Date;
  endsAt?: Date;
  isPublished: boolean;
  reservationMode: EventReservationMode;
  status: string;
}

const EventSchema = new Schema<IEvent>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    title: { type: String, required: true },
    slug: { type: String },
    type: { type: String, enum: ['DJ', 'CHANTEUR', 'CONCERT', 'SOIREE', 'CINEMA', 'STANDUP', 'SPORTS', 'PRIVATE_EVENT', 'CINEMA_SESSION'], default: 'CONCERT' },
    description: { type: String, default: '' },
    coverImage: { type: String },
    startAt: { type: Date, required: true },
    endsAt: { type: Date },
    isPublished: { type: Boolean, default: true },
    reservationMode: { type: String, enum: ['table', 'seat_zone', 'seat', 'ticket_only'], default: 'table' },
    status: { type: String, default: 'scheduled' },
  },
  { timestamps: true }
);

EventSchema.index({ venueId: 1 });
EventSchema.index({ startAt: 1 });
EventSchema.index({ slug: 1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);

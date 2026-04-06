import mongoose, { Schema, Document, Types } from 'mongoose';

export type SessionStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface IEventSession extends Document {
  eventId: Types.ObjectId;
  venueId: Types.ObjectId;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  status: SessionStatus;
  salesStartsAt?: Date;
  salesEndsAt?: Date;
  capacityGlobal?: number;
  pricingSummaryCache?: Record<string, unknown>;
  hasTables: boolean;
  hasSeatZones: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EventSessionSchema = new Schema<IEventSession>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timeZone: { type: String, default: 'Africa/Tunis' },
    status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
    salesStartsAt: { type: Date },
    salesEndsAt: { type: Date },
    capacityGlobal: { type: Number },
    pricingSummaryCache: { type: Schema.Types.Mixed },
    hasTables: { type: Boolean, default: false },
    hasSeatZones: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EventSessionSchema.index({ eventId: 1 });
EventSessionSchema.index({ venueId: 1, startsAt: 1 });
EventSessionSchema.index({ startsAt: 1, status: 1 });

export const EventSession = mongoose.model<IEventSession>('EventSession', EventSessionSchema);

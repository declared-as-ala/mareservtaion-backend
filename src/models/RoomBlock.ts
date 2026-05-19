import mongoose, { Schema, Document, Types } from 'mongoose';

export type RoomBlockReason =
  | 'maintenance'
  | 'private_event'
  | 'owner_hold'
  | 'cleaning'
  | 'renovation'
  | 'staff_use'
  | 'offline_booking'
  | 'emergency'
  | 'other';

export type RoomBlockScope = 'room' | 'venue';

export interface IRoomBlock extends Document {
  venueId: Types.ObjectId;
  roomId?: Types.ObjectId;
  scope: RoomBlockScope;
  startsAt: Date;
  endsAt: Date;
  reason: RoomBlockReason;
  note?: string;
  visibleToClient: boolean;
  autoReopen: boolean;
  createdBy: Types.ObjectId;
  createdByRole?: 'OWNER' | 'ADMIN' | 'STAFF';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomBlockSchema = new Schema<IRoomBlock>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', index: true },
    scope: { type: String, enum: ['room', 'venue'], required: true, default: 'room' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: {
      type: String,
      enum: ['maintenance', 'private_event', 'owner_hold', 'cleaning', 'renovation', 'staff_use', 'offline_booking', 'emergency', 'other'],
      default: 'owner_hold',
    },
    note: { type: String, maxlength: 500 },
    visibleToClient: { type: Boolean, default: false },
    autoReopen: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String, enum: ['OWNER', 'ADMIN', 'STAFF'] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

RoomBlockSchema.index({ roomId: 1, startsAt: 1, endsAt: 1, isActive: 1 });
RoomBlockSchema.index({ venueId: 1, scope: 1, startsAt: 1, endsAt: 1, isActive: 1 });

export const RoomBlock = mongoose.model<IRoomBlock>('RoomBlock', RoomBlockSchema);

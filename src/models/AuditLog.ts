import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'EMAIL_VERIFICATION'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_CHECKED_IN'
  | 'RESERVATION_CHECKED_OUT'
  | 'RESERVATION_NO_SHOW'
  | 'RESERVATION_ACCEPTED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_MANUAL_CREATED'
  | 'RESERVATION_DATES_CHANGED'
  | 'RESERVATION_ROOM_REASSIGNED'
  | 'RESERVATION_NOTE_ADDED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'ADMIN_SETTING_CHANGED'
  | 'VENUE_CREATED'
  | 'VENUE_UPDATED'
  | 'VENUE_DELETED'
  | 'VENUE_SUBMITTED_FOR_REVIEW'
  | 'VENUE_APPROVED'
  | 'VENUE_REJECTED'
  | 'VENUE_CHANGES_REQUESTED'
  | 'VENUE_SUSPENDED'
  | 'VENUE_REINSTATED'
  | 'VENUE_FEATURED'
  | 'VENUE_UNFEATURED'
  | 'ROOM_BLOCK_CREATED'
  | 'ROOM_BLOCK_UPDATED'
  | 'ROOM_BLOCK_DELETED'
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_DELETED';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: AuditAction;
  entityType?: 'user' | 'reservation' | 'venue' | 'event' | 'payment' | 'setting';
  entityId?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: {
      type: String, required: true, enum: [
        'LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'PASSWORD_CHANGE',
        'EMAIL_VERIFICATION', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
        'RESERVATION_CREATED', 'RESERVATION_CANCELLED', 'RESERVATION_CHECKED_IN',
        'RESERVATION_CHECKED_OUT', 'RESERVATION_NO_SHOW',
        'RESERVATION_ACCEPTED', 'RESERVATION_REJECTED', 'RESERVATION_MANUAL_CREATED',
        'RESERVATION_DATES_CHANGED', 'RESERVATION_ROOM_REASSIGNED', 'RESERVATION_NOTE_ADDED',
        'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED',
        'ADMIN_SETTING_CHANGED', 'VENUE_CREATED', 'VENUE_UPDATED', 'VENUE_DELETED',
        'VENUE_SUBMITTED_FOR_REVIEW', 'VENUE_APPROVED', 'VENUE_REJECTED',
        'VENUE_CHANGES_REQUESTED', 'VENUE_SUSPENDED', 'VENUE_REINSTATED',
        'VENUE_FEATURED', 'VENUE_UNFEATURED',
        'ROOM_BLOCK_CREATED', 'ROOM_BLOCK_UPDATED', 'ROOM_BLOCK_DELETED',
        'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED',
      ]
    },
    entityType: { type: String, enum: ['user', 'reservation', 'venue', 'event', 'payment', 'setting'] },
    entityId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    userAgent: { type: String },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });

// Auto-delete after 90 days
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

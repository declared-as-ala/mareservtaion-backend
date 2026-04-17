import mongoose, { Schema, Document } from 'mongoose';

export interface ILoginAttempt extends Document {
  email: string;
  ipAddress: string;
  success: boolean;
  userAgent?: string;
  timestamp: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>(
  {
    email: { type: String, required: true, index: true },
    ipAddress: { type: String, required: true },
    success: { type: Boolean, required: true },
    userAgent: { type: String },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

// TTL index - delete after 30 days
LoginAttemptSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
LoginAttemptSchema.index({ email: 1, timestamp: -1 });
LoginAttemptSchema.index({ ipAddress: 1, timestamp: -1 });

export const LoginAttempt = mongoose.model<ILoginAttempt>('LoginAttempt', LoginAttemptSchema);

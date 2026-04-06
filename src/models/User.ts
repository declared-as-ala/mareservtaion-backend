import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'ORGANIZER';

export interface IUserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
}

export interface IUser extends Document {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  avatarUrl?: string;
  lastLoginAt?: Date;
  preferences?: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['CUSTOMER', 'ADMIN', 'ORGANIZER'], default: 'CUSTOMER' },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    avatarUrl: { type: String },
    lastLoginAt: { type: Date },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'] },
      language: { type: String },
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);

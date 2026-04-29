import mongoose, { Schema, Document } from 'mongoose';

export interface IAppSettings extends Document {
  siteName: string;
  logoUrlLight?: string;
  logoUrlDark?: string;
  supportPhone?: string;
  supportEmail?: string;
  defaultLanguage: string;
  enabledThemes?: string[];
  homeSectionsOrder?: string[];
  featureFlags?: Record<string, boolean>;
  seoDefaults?: Record<string, string>;
  socialLinks?: Record<string, string>;
  isMaintenanceMode: boolean;
  maintenanceMessageFr?: string;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    siteName: { type: String, default: 'Ma Reservation' },
    logoUrlLight: { type: String },
    logoUrlDark: { type: String },
    supportPhone: { type: String },
    supportEmail: { type: String },
    defaultLanguage: { type: String, default: 'fr' },
    enabledThemes: { type: [String], default: ['light', 'dark'] },
    homeSectionsOrder: { type: [String], default: [] },
    featureFlags: { type: Schema.Types.Mixed, default: {} },
    seoDefaults: { type: Schema.Types.Mixed, default: {} },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    isMaintenanceMode: { type: Boolean, default: false },
    maintenanceMessageFr: { type: String },
  },
  { timestamps: true }
);

export const AppSettings = mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

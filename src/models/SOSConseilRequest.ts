import mongoose, { Schema, Document } from 'mongoose';

const AGE_ENUM = ['18-20', '20-30', '30-40', '40-50', '50-60', '+60'] as const;

const CONTACT_ENUM = ['whatsapp', 'phone', 'email'] as const;

export interface ISOSConseilRequest extends Document {
  fullName: string;
  phone: string;
  email?: string;
  occasionType: string;
  participantsCount: number;
  /** @deprecated Legacy single value from older submissions; prefer averageAgeRanges. */
  averageAgeRange?: string;
  /** One or more age brackets (multi-select). */
  averageAgeRanges: string[];
  preferredRegion: string;
  preferredCategory: string;
  /** Optional budget level or free text */
  budgetRange?: string;
  /** Tags décrivant ambiance / critères souhaités */
  ambianceTags?: string[];
  /** Préférence contact */
  contactPreference?: (typeof CONTACT_ENUM)[number];
  /** Résumé court issu du flux assistant IA (session non persistée) */
  aiAssistSummary?: string;
  /** Recommandations manuelles saisies par l'admin */
  adminRecommendedVenues?: string;
  preferredDate?: Date;
  preferredTime?: string;
  details?: string;
  status: 'new' | 'in_review' | 'contacted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const CATEGORY_ENUM = [
  'cafe',
  'restaurant',
  'hotel',
  'cinema',
  'event_space',
  'lounge',
  'rooftop',
] as const;

const SOSConseilRequestSchema = new Schema<ISOSConseilRequest>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    occasionType: {
      type: String,
      required: true,
      enum: [
        'birthday',
        'wedding_engagement',
        'business_meeting',
        'family_event',
        'romantic_dinner',
        'graduation',
        'corporate',
        'other',
      ],
    },
    participantsCount: { type: Number, required: true, min: 1 },
    averageAgeRange: { type: String, trim: true },
    averageAgeRanges: {
      type: [String],
      default: [],
      validate: {
        validator(v: string[]) {
          return (
            Array.isArray(v) &&
            v.length >= 1 &&
            v.every((x) => (AGE_ENUM as readonly string[]).includes(x))
          );
        },
        message: 'Tranches d\'age invalides',
      },
    },
    preferredRegion: { type: String, required: true, trim: true },
    preferredCategory: {
      type: String,
      required: true,
      enum: [...CATEGORY_ENUM],
    },
    budgetRange: { type: String, required: false, trim: true },
    ambianceTags: [{ type: String, trim: true }],
    contactPreference: {
      type: String,
      required: false,
      enum: [...CONTACT_ENUM],
    },
    aiAssistSummary: { type: String, trim: true, maxlength: 8000 },
    adminRecommendedVenues: { type: String, trim: true, maxlength: 12000 },
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

SOSConseilRequestSchema.pre('validate', function (next) {
  const doc = this as ISOSConseilRequest;
  const arr = doc.averageAgeRanges;
  if ((!arr || arr.length === 0) && doc.averageAgeRange) {
    doc.set('averageAgeRanges', [doc.averageAgeRange]);
  }
  next();
});

SOSConseilRequestSchema.post('init', function (doc: ISOSConseilRequest) {
  const legacy = doc.get('averageAgeRange') as string | undefined;
  const ranges = doc.get('averageAgeRanges') as string[] | undefined;
  if ((!ranges || ranges.length === 0) && legacy) {
    doc.set('averageAgeRanges', [legacy]);
  }
});

export const SOSConseilRequest = mongoose.model<ISOSConseilRequest>(
  'SOSConseilRequest',
  SOSConseilRequestSchema
);

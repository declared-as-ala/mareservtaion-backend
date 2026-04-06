import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentProvider = 'manual' | 'stripe' | 'konnect' | 'flouci' | 'other';
export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'on_site';
export type PaymentStatus = 'initiated' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface IPayment extends Document {
  reservationId: Types.ObjectId;
  provider: PaymentProvider;
  method: PaymentMethod;
  transactionRef?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: Date;
  rawPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', required: true },
    provider: { type: String, enum: ['manual', 'stripe', 'konnect', 'flouci', 'other'], required: true },
    method: { type: String, enum: ['card', 'cash', 'transfer', 'on_site'], required: true },
    transactionRef: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'TND' },
    status: { type: String, enum: ['initiated', 'pending', 'paid', 'failed', 'cancelled', 'refunded'], required: true },
    paidAt: { type: Date },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

PaymentSchema.index({ reservationId: 1 });
PaymentSchema.index({ transactionRef: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Payment, IPayment } from '../models/Payment';
import { Reservation } from '../models/Reservation';
import { ReservationHold } from '../models/ReservationHold';
import { konnectPaymentService, stripePaymentService } from '../services/payment.service';
import { getEnv } from '../config/env';
import { logAudit } from '../utils/audit.util';
import { logger } from '../config/logger';

const router = Router();
const env = getEnv();

// POST /api/v1/payments/create-checkout-session - Create payment checkout session
router.post('/create-checkout-session', authenticate, async (req: AuthRequest, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const { reservationId, provider = 'konnect', method = 'card' } = req.body;

    if (!reservationId) {
      return res.status(400).json({ error: 'reservationId est obligatoire.' });
    }

    // Find reservation with transaction
    const reservation = await Reservation.findById(reservationId).session(session);
    if (!reservation) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Réservation non trouvée.' });
    }

    // Check ownership
    if (reservation.userId.toString() !== req.userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Non autorisé.' });
    }

    // Check if already paid
    if (reservation.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Réservation déjà payée.' });
    }

    const amount = reservation.totalPrice || 0;
    if (amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Montant invalide.' });
    }

    // Create payment record
    const payment = new Payment({
      reservationId: reservation._id,
      provider,
      method,
      amount,
      currency: 'TND',
      status: 'initiated',
    });
    await payment.save({ session });

    // Create checkout session with payment provider
    let checkoutUrl: string;
    let paymentIntentId: string;

    try {
      if (provider === 'konnect' && konnectPaymentService) {
        const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
        const konnectResponse = await konnectPaymentService.createPaymentIntent({
          amount: amount * 100, // Convert to cents/smallest unit if needed
          currency: 'TND',
          customerId: req.userId.toString(),
          customerEmail: (req as any).userEmail || '',
          orderId: reservation._id.toString(),
          webhookUrl: `${env.FRONTEND_URL}/api/v1/payments/webhook/konnect`,
        });

        paymentIntentId = konnectResponse.id;
        checkoutUrl = konnectResponse.paymentUrl;
      } else if (provider === 'stripe') {
        const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
        const stripeResponse = await stripePaymentService.createCheckoutSession({
          amount: amount * 100,
          currency: 'TND',
          successUrl: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${frontendUrl}/payment/cancel`,
          metadata: {
            reservationId: reservation._id.toString(),
            userId: req.userId.toString(),
          },
        });

        paymentIntentId = stripeResponse.sessionId;
        checkoutUrl = stripeResponse.url;
      } else {
        // Manual payment - no checkout URL needed
        paymentIntentId = `manual_${Date.now()}`;
        checkoutUrl = '';
      }
    } catch (paymentError: any) {
      logger.error('Payment provider error:', paymentError);
      await session.abortTransaction();
      return res.status(500).json({ 
        error: 'Erreur lors de la création de la session de paiement.',
        details: paymentError.message,
      });
    }

    // Update payment and reservation
    payment.transactionRef = paymentIntentId;
    payment.status = 'pending';
    await payment.save({ session });

    reservation.paymentStatus = 'pending';
    await reservation.save({ session });

    // Convert hold to reservation if exists
    await ReservationHold.updateMany(
      { reservableUnitId: reservation.reservableUnitId, status: 'active' },
      { status: 'converted' }
    ).session(session);

    await session.commitTransaction();

    await logAudit(req, {
      action: 'PAYMENT_INITIATED',
      userId: req.userId,
      entityType: 'payment',
      entityId: payment._id,
      details: { reservationId, provider, amount },
    });

    res.json({
      success: true,
      paymentId: payment._id,
      checkoutUrl,
      paymentIntentId,
      amount,
    });
  } catch (error: any) {
    await session.abortTransaction();
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la session de paiement.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
});

// POST /api/v1/payments/webhook/konnect - Konnect payment webhook
router.post('/webhook/konnect', async (req, res) => {
  try {
    const signature = req.headers['x-konnect-signature'] as string;
    const payload = req.body;

    const webhookData = await konnectPaymentService?.handleWebhook(payload, signature || '');
    if (!webhookData) {
      return res.status(500).json({ error: 'Konnect service not available' });
    }

    const { paymentId, status, orderId } = webhookData;

    // Find payment by reservation ID (orderId)
    const payment = await Payment.findOne({
      reservationId: new mongoose.Types.ObjectId(orderId),
      status: { $in: ['initiated', 'pending'] },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (status === 'SUCCESS') {
        payment.status = 'paid';
        payment.paidAt = new Date();
        payment.rawPayload = payload;
        await payment.save({ session });

        await Reservation.findByIdAndUpdate(payment.reservationId, {
          paymentStatus: 'paid',
        }).session(session);
      } else {
        payment.status = 'failed';
        payment.rawPayload = payload;
        await payment.save({ session });

        await Reservation.findByIdAndUpdate(payment.reservationId, {
          paymentStatus: 'failed',
        }).session(session);
      }

      await session.commitTransaction();
      res.json({ received: true });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Konnect webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET /api/v1/payments/:id - Get payment details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const payment = await Payment.findById(req.params.id).populate('reservationId');
    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé.' });
    }

    // Check ownership
    const reservation = await Reservation.findById(payment.reservationId);
    if (!reservation || reservation.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Non autorisé.' });
    }

    res.json(payment);
  } catch (error) {
    logger.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du paiement.' });
  }
});

// POST /api/v1/payments/:id/verify - Manually verify payment status
router.post('/:id/verify', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé.' });
    }

    const reservation = await Reservation.findById(payment.reservationId);
    if (!reservation || reservation.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Non autorisé.' });
    }

    if (payment.status === 'paid') {
      return res.json({ status: 'paid', message: 'Paiement déjà confirmé.' });
    }

    // Verify with payment provider
    if (payment.provider === 'konnect' && payment.transactionRef && konnectPaymentService) {
      try {
        const verification = await konnectPaymentService.verifyPayment(payment.transactionRef);
        
        if (verification.status === 'SUCCESS') {
          payment.status = 'paid';
          payment.paidAt = new Date();
          await payment.save();

          reservation.paymentStatus = 'paid';
          await reservation.save();

          return res.json({ status: 'paid', message: 'Paiement confirmé.' });
        }
      } catch (verifyError) {
        logger.error('Payment verification failed:', verifyError);
      }
    }

    res.json({ status: payment.status, message: 'Statut inchangé.' });
  } catch (error) {
    logger.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du paiement.' });
  }
});

// GET /api/v1/payments/my-payments - Get user's payments
router.get('/my-payments', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const payments = await Payment.find()
      .populate({
        path: 'reservationId',
        match: { userId: new mongoose.Types.ObjectId(req.userId) },
      })
      .sort({ createdAt: -1 })
      .limit(20);

    // Filter out payments where reservationId is null (not owned by user)
    const filteredPayments = payments.filter((p) => p.reservationId);

    res.json(filteredPayments);
  } catch (error) {
    logger.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements.' });
  }
});

export default router;

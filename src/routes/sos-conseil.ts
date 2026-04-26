import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { SOSConseilRequest } from '../models/SOSConseilRequest';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendEmail, createSOSConseilAdminTemplate } from '../services/email.service';
import { getEnv } from '../config/env';

const router = Router();

// ─── Public: submit a SOS Conseil request ─────────────────────────────────────
router.post(
  '/',
  [
    body('fullName').trim().notEmpty().withMessage('Le nom complet est requis'),
    body('phone').trim().notEmpty().withMessage('Le numéro de téléphone est requis'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email invalide'),
    body('occasionType')
      .isIn(['birthday', 'wedding_engagement', 'business_meeting', 'family_event', 'romantic_dinner', 'other'])
      .withMessage('Type d\'occasion invalide'),
    body('participantsCount').isInt({ min: 1 }).withMessage('Nombre de participants invalide'),
    body('averageAgeRange')
      .isIn(['18-20', '20-30', '30-40', '40-50', '50-60', '+60'])
      .withMessage('Tranche d\'âge invalide'),
    body('preferredRegion').trim().notEmpty().withMessage('La région est requise'),
    body('preferredCategory')
      .isIn(['cafe', 'restaurant', 'hotel', 'cinema', 'event_space'])
      .withMessage('Catégorie invalide'),
    body('budgetRange').trim().notEmpty().withMessage('Le budget est requis'),
    body('preferredDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Date invalide'),
    body('preferredTime').optional({ nullable: true, checkFalsy: true }).trim(),
    body('details').optional({ nullable: true, checkFalsy: true }).trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const {
        fullName,
        phone,
        email,
        occasionType,
        participantsCount,
        averageAgeRange,
        preferredRegion,
        preferredCategory,
        budgetRange,
        preferredDate,
        preferredTime,
        details,
      } = req.body;

      const request = await SOSConseilRequest.create({
        fullName,
        phone,
        email: email || undefined,
        occasionType,
        participantsCount: Number(participantsCount),
        averageAgeRange,
        preferredRegion,
        preferredCategory,
        budgetRange,
        preferredDate: preferredDate ? new Date(preferredDate) : undefined,
        preferredTime: preferredTime || undefined,
        details: details || undefined,
        status: 'new',
      });

      // Send admin notification email in background
      const env = getEnv();
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || env.EMAIL_FROM;
      if (adminEmail) {
        const template = createSOSConseilAdminTemplate({
          fullName, phone, email: email || undefined,
          occasionType, participantsCount: Number(participantsCount),
          averageAgeRange, preferredRegion, preferredCategory, budgetRange,
          preferredDate: preferredDate || undefined,
          preferredTime: preferredTime || undefined,
          details: details || undefined,
        });
        sendEmail({ to: adminEmail, subject: template.subject, html: template.html, text: template.text })
          .catch((err) => console.error('SOS Conseil email error:', err));
      }

      return res.status(201).json({ success: true, data: request });
    } catch (err) {
      console.error('SOS Conseil create error:', err);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

// ─── Admin: list all requests ──────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = 20;
      const status = (req.query as any).status as string | undefined;

      const filter: any = {};
      if (status) filter.status = status;

      const [requests, total] = await Promise.all([
        SOSConseilRequest.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        SOSConseilRequest.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: requests,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      console.error('SOS Conseil list error:', err);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

// ─── Admin: get one request ────────────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const request = await SOSConseilRequest.findById(req.params.id).lean();
      if (!request) return res.status(404).json({ success: false, error: 'Introuvable' });
      return res.json({ success: true, data: request });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

// ─── Admin: update status ──────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  [
    body('status')
      .isIn(['new', 'in_review', 'contacted', 'closed'])
      .withMessage('Statut invalide'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const request = await SOSConseilRequest.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      ).lean();

      if (!request) return res.status(404).json({ success: false, error: 'Introuvable' });
      return res.json({ success: true, data: request });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

// ─── Admin: delete request ─────────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const request = await SOSConseilRequest.findByIdAndDelete(req.params.id);
      if (!request) return res.status(404).json({ success: false, error: 'Introuvable' });
      return res.json({ success: true, message: 'Supprimé' });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

export default router;

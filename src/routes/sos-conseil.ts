import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { SOSConseilRequest } from '../models/SOSConseilRequest';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendEmail, createSOSConseilAdminTemplate } from '../services/email.service';
import { getEnv } from '../config/env';
import { sosConseilChatLimiter } from '../middlewares/rateLimit.middleware';
import { runSOSConseilChat } from '../services/sos-conseil-chat';

const router = Router();

const MAX_CHAT_MESSAGES = 30;

/** Emails notifiés pour chaque nouvelle demande SOS Conseil (override via SOS_CONSEIL_NOTIFICATION_EMAILS). */
const SOS_CONSEIL_EMAIL_DEFAULT =
  'alamissaoui.dev@gmail.com,Wassim.ouelhazi100119862@gmail.com';

function parseEmailRecipientList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const e = part.trim();
    if (!e) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function getSosConseilNotificationRecipients(): string[] {
  const fromEnv = process.env.SOS_CONSEIL_NOTIFICATION_EMAILS?.trim();
  return parseEmailRecipientList(fromEnv || SOS_CONSEIL_EMAIL_DEFAULT);
}

/** Public: SOS assistant (OpenRouter) — MUST stay before parameterized routes */
router.post('/chat', sosConseilChatLimiter, async (req: Request, res: Response) => {
  try {
    const raw = req.body ?? {};
    const msgs = raw.messages;

    if (!Array.isArray(msgs) || msgs.length < 1) {
      return res.status(400).json({ success: false, error: 'messages requis' });
    }
    if (msgs.length > MAX_CHAT_MESSAGES) {
      return res.status(413).json({ success: false, error: 'Historique trop long' });
    }

    const sanitized: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of msgs) {
      if (!m || typeof m !== 'object') continue;
      const role = (m as { role?: string }).role;
      const content = typeof (m as { content?: string }).content === 'string'
        ? (m as { content: string }).content.trim()
        : '';
      if (role !== 'user' && role !== 'assistant') continue;
      sanitized.push({
        role,
        content: content.slice(0, 4000),
      });
    }

    if (sanitized.length < 1) {
      return res.status(400).json({ success: false, error: 'Au moins un message valide est requis' });
    }

    let currentFormData: Record<string, unknown> = {};
    if (raw.currentFormData !== undefined) {
      if (
        typeof raw.currentFormData !== 'object' ||
        raw.currentFormData === null ||
        Array.isArray(raw.currentFormData)
      ) {
        return res.status(400).json({ success: false, error: 'currentFormData invalide' });
      }
      currentFormData = raw.currentFormData as Record<string, unknown>;
      const serialized = JSON.stringify(currentFormData).length;
      if (serialized > 24000) {
        return res.status(413).json({ success: false, error: 'Formulaire envoyé trop volumineux' });
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'openrouter/free';
    const siteUrl =
      process.env.OPENROUTER_SITE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    const appTitle = process.env.OPENROUTER_APP_TITLE || 'MaTable SOS Conseil';

    const result = await runSOSConseilChat({
      messages: sanitized,
      currentFormData,
      apiKey,
      model,
      siteUrl,
      appTitle,
    });

    if (!result.ok) {
      const status =
        result.httpStatus === 503 ? 503 : result.httpStatus === 413 ? 413 : result.httpStatus ?? 502;
      return res.status(status).json({ success: false, error: result.message });
    }

    return res.json({ success: true, data: result.data });
  } catch (e) {
    console.error('[SOS Chat route]', e);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

const OCCASIONS = [
  'birthday',
  'wedding_engagement',
  'business_meeting',
  'family_event',
  'romantic_dinner',
  'graduation',
  'corporate',
  'other',
] as const;

const PLACE_CATEGORIES = [
  'cafe',
  'restaurant',
  'hotel',
  'cinema',
  'event_space',
  'lounge',
  'rooftop',
] as const;

/** Public: submit a SOS Conseil request */
router.post(
  '/',
  [
    body('fullName').trim().notEmpty().withMessage('Le nom complet est requis'),
    body('phone').trim().notEmpty().withMessage('Le numéro de téléphone est requis'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email invalide'),
    body('occasionType')
      .isIn([...OCCASIONS])
      .withMessage('Type d\'occasion invalide'),
    body('participantsCount').isInt({ min: 1 }).withMessage('Nombre de participants invalide'),
    body('averageAgeRanges')
      .isArray({ min: 1 })
      .withMessage('Au moins une tranche d\'âge est requise'),
    body('averageAgeRanges.*')
      .isIn(['18-20', '20-30', '30-40', '40-50', '50-60', '+60'])
      .withMessage('Tranche d\'âge invalide'),
    body('preferredRegion').trim().notEmpty().withMessage('La région est requise'),
    body('preferredCategory')
      .isIn([...PLACE_CATEGORIES])
      .withMessage('Catégorie invalide'),
    body('budgetRange').optional({ nullable: true, checkFalsy: true }).isString().trim(),
    body('ambianceTags').optional({ nullable: true }).isArray().withMessage('ambianceTags invalide'),
    body('ambianceTags.*').optional().isString().trim(),
    body('contactPreference').optional({ nullable: true }).isIn(['whatsapp', 'phone', 'email']),
    body('aiAssistSummary').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 8000 }),
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
        averageAgeRanges,
        preferredRegion,
        preferredCategory,
        budgetRange,
        ambianceTags,
        contactPreference,
        aiAssistSummary,
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
        averageAgeRanges: [...new Set(averageAgeRanges as string[])],
        preferredRegion,
        preferredCategory,
        budgetRange: budgetRange || undefined,
        ambianceTags:
          Array.isArray(ambianceTags) && ambianceTags.length
            ? [...new Set((ambianceTags as string[]).map((s) => String(s).trim()).filter(Boolean))]
            : undefined,
        contactPreference: contactPreference || undefined,
        aiAssistSummary: aiAssistSummary || undefined,
        preferredDate: preferredDate ? new Date(preferredDate) : undefined,
        preferredTime: preferredTime || undefined,
        details: details || undefined,
        status: 'new',
      });

      const env = getEnv();
      const recipients = getSosConseilNotificationRecipients();
      if (recipients.length > 0 && env.EMAIL_FROM) {
        const template = createSOSConseilAdminTemplate({
          fullName,
          phone,
          email: email || undefined,
          occasionType,
          participantsCount: Number(participantsCount),
          averageAgeRanges: [...new Set(averageAgeRanges as string[])],
          preferredRegion,
          preferredCategory,
          budgetRange: budgetRange || undefined,
          ambianceTags: request.ambianceTags,
          contactPreference: request.contactPreference,
          aiAssistSummary: aiAssistSummary || undefined,
          preferredDate: preferredDate || undefined,
          preferredTime: preferredTime || undefined,
          details: details || undefined,
        });
        for (const to of recipients) {
          sendEmail({ to, subject: template.subject, html: template.html, text: template.text }).catch((err) =>
            console.error(`SOS Conseil email error (${to}):`, err)
          );
        }
      }

      return res.status(201).json({ success: true, data: request });
    } catch (err) {
      console.error('SOS Conseil create error:', err);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

/** Admin: list all requests */
router.get(
  '/',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt((req.query as { page?: string }).page || '1', 10));
      const limit = 20;
      const status = (req.query as { status?: string }).status;

      const filter: Record<string, string> = {};
      if (status) filter.status = status;

      const [requests, total] = await Promise.all([
        SOSConseilRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
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

/** Admin: update manually recommended venues (free-text) — before GET /:id */
router.patch(
  '/:id/recommended-venues',
  authenticate,
  requireAdmin,
  [
    body('adminRecommendedVenues').optional({ nullable: true }).isString().isLength({ max: 12000 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    try {
      const venues = typeof req.body.adminRecommendedVenues === 'string'
        ? req.body.adminRecommendedVenues.trim()
        : undefined;

      const request = await SOSConseilRequest.findByIdAndUpdate(
        req.params.id,
        { ...(venues !== undefined ? { adminRecommendedVenues: venues || undefined } : {}) },
        { new: true }
      ).lean();

      if (!request) return res.status(404).json({ success: false, error: 'Introuvable' });
      return res.json({ success: true, data: request });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

/** Admin: get one request */
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

/** Admin: update status */
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  [body('status').isIn(['new', 'in_review', 'contacted', 'closed']).withMessage('Statut invalide')],
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

/** Admin: delete request */
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

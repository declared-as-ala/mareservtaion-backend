import { Router, Request } from 'express';
import mongoose from 'mongoose';
import { Venue, type VenueApprovalStatus } from '../models/Venue';
import { Room } from '../models/Room';
import { User } from '../models/User';
import { Reservation } from '../models/Reservation';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit.util';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { logger } from '../config/logger';

const router = Router();

router.use(authenticate, requireAdmin);

/* ─── checklist ────────────────────────────────────────────────────── */

interface ChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
}

async function buildChecklist(venueId: mongoose.Types.ObjectId | string): Promise<ChecklistItem[]> {
  const venue = await Venue.findById(venueId).lean();
  if (!venue) return [];
  const rooms = await Room.find({ venueId }).lean();
  const owner = venue.ownerId ? await User.findById(venue.ownerId).lean() : null;
  const items: ChecklistItem[] = [];

  items.push({
    key: 'owner_verified',
    label: 'Propriétaire vérifié',
    passed: !!owner && !!owner.email,
    detail: owner ? owner.email : 'Aucun propriétaire rattaché',
  });
  items.push({
    key: 'address_valid',
    label: 'Adresse renseignée',
    passed: !!venue.address && !!venue.city,
    detail: [venue.address, venue.city].filter(Boolean).join(', ') || '—',
  });
  items.push({
    key: 'phone_valid',
    label: 'Téléphone renseigné',
    passed: !!venue.phone && venue.phone.replace(/\s/g, '').length >= 8,
    detail: venue.phone ?? '—',
  });
  items.push({
    key: 'cover_image',
    label: 'Image de couverture',
    passed: !!venue.coverImage,
  });
  items.push({
    key: 'gallery',
    label: 'Au moins 3 photos de galerie',
    passed: (venue.gallery?.length ?? 0) >= 3,
    detail: `${venue.gallery?.length ?? 0} photo(s)`,
  });
  items.push({
    key: 'description',
    label: 'Description fournie (≥ 60 caractères)',
    passed: !!venue.description && venue.description.trim().length >= 60,
  });
  items.push({
    key: 'has_rooms',
    label: 'Au moins une chambre configurée',
    passed: rooms.length > 0,
    detail: `${rooms.length} chambre(s)`,
  });
  const roomsWithPrice = rooms.filter((r) => r.pricePerNight && r.pricePerNight > 0);
  items.push({
    key: 'rooms_priced',
    label: 'Toutes les chambres ont un tarif',
    passed: rooms.length > 0 && roomsWithPrice.length === rooms.length,
    detail: `${roomsWithPrice.length} / ${rooms.length}`,
  });
  const roomsWithPhoto = rooms.filter((r) => r.coverImage || (r.gallery && r.gallery.length > 0));
  items.push({
    key: 'rooms_photos',
    label: 'Toutes les chambres ont une photo',
    passed: rooms.length > 0 && roomsWithPhoto.length === rooms.length,
    detail: `${roomsWithPhoto.length} / ${rooms.length}`,
  });
  items.push({
    key: 'policies',
    label: 'Politiques check-in / check-out définies',
    passed: !!venue.checkInPolicy || !!venue.checkOutPolicy,
  });
  items.push({
    key: 'compliance_docs',
    label: 'Documents administratifs téléchargés',
    passed: (venue.complianceDocs?.length ?? 0) > 0,
    detail: `${venue.complianceDocs?.length ?? 0} fichier(s)`,
  });

  return items;
}

/* ─── helpers ──────────────────────────────────────────────────────── */

async function transition(
  venueId: string,
  req: AuthRequest,
  patch: Partial<{
    approvalStatus: VenueApprovalStatus;
    rejectionReason: string | null;
    adminNote: string | null;
    isPublished: boolean;
    isFeatured: boolean;
  }>,
  action:
    | 'VENUE_APPROVED'
    | 'VENUE_REJECTED'
    | 'VENUE_CHANGES_REQUESTED'
    | 'VENUE_SUSPENDED'
    | 'VENUE_REINSTATED'
    | 'VENUE_FEATURED'
    | 'VENUE_UNFEATURED'
) {
  if (!mongoose.Types.ObjectId.isValid(venueId)) return null;
  const venue = await Venue.findById(venueId);
  if (!venue) return null;
  Object.assign(venue, patch);
  if (patch.approvalStatus) {
    venue.reviewedAt = new Date();
    venue.reviewedBy = req.userId ? new mongoose.Types.ObjectId(req.userId) : undefined;
  }
  await venue.save();
  await logAudit(req as unknown as Request, {
    action,
    userId: req.userId,
    entityType: 'venue',
    entityId: venue._id as mongoose.Types.ObjectId,
    details: { ...patch, name: venue.name },
  });
  return venue;
}

/* ─── routes ──────────────────────────────────────────────────────── */

// GET /admin-hotel/hotels?status=&q=
router.get('/hotels', async (req: AuthRequest, res) => {
  try {
    const filter: Record<string, unknown> = { type: 'HOTEL' };
    if (req.query.status && req.query.status !== 'all') {
      filter.approvalStatus = req.query.status;
    }
    if (req.query.q) {
      const re = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      (filter as any).$or = [{ name: re }, { city: re }];
    }
    const hotels = await Venue.find(filter)
      .populate('ownerId', 'fullName email phone')
      .sort({ submittedForReviewAt: -1, updatedAt: -1 })
      .limit(200)
      .lean();

    const counts = await Venue.aggregate([
      { $match: { type: 'HOTEL' } },
      { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
    ]);
    const countsMap: Record<string, number> = {};
    counts.forEach((c) => {
      countsMap[c._id ?? 'approved'] = c.count;
    });

    return sendSuccess(res, { data: { hotels, counts: countsMap } });
  } catch (err) {
    logger.error('admin-hotel/hotels list failed', err);
    return sendError(res, { message: 'Erreur de chargement.', statusCode: 500 });
  }
});

// GET /admin-hotel/hotels/:id/checklist
router.get('/hotels/:id/checklist', async (req: AuthRequest, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, { message: 'Identifiant invalide.', statusCode: 400 });
    }
    const venue = await Venue.findById(req.params.id)
      .populate('ownerId', 'fullName email phone emailVerified')
      .lean();
    if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
    const checklist = await buildChecklist(venue._id);
    const passed = checklist.filter((i) => i.passed).length;
    const total = checklist.length;
    return sendSuccess(res, {
      data: {
        venue,
        checklist,
        completion: { passed, total, percent: total ? Math.round((passed / total) * 100) : 0 },
      },
    });
  } catch (err) {
    logger.error('admin-hotel/checklist failed', err);
    return sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

// POST /admin-hotel/hotels/:id/approve
router.post('/hotels/:id/approve', async (req: AuthRequest, res) => {
  const venue = await transition(
    req.params.id,
    req,
    { approvalStatus: 'approved', isPublished: true, rejectionReason: null },
    'VENUE_APPROVED'
  );
  if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
  return sendSuccess(res, { data: venue });
});

// POST /admin-hotel/hotels/:id/reject
router.post('/hotels/:id/reject', async (req: AuthRequest, res) => {
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) return sendError(res, { message: 'Motif requis.', statusCode: 400 });
  const venue = await transition(
    req.params.id,
    req,
    { approvalStatus: 'rejected', isPublished: false, rejectionReason: reason },
    'VENUE_REJECTED'
  );
  if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
  return sendSuccess(res, { data: venue });
});

// POST /admin-hotel/hotels/:id/request-changes
router.post('/hotels/:id/request-changes', async (req: AuthRequest, res) => {
  const note = String(req.body?.note ?? '').trim();
  if (!note) return sendError(res, { message: 'Note pour le propriétaire requise.', statusCode: 400 });
  const venue = await transition(
    req.params.id,
    req,
    { approvalStatus: 'changes_requested', adminNote: note },
    'VENUE_CHANGES_REQUESTED'
  );
  if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
  return sendSuccess(res, { data: venue });
});

// POST /admin-hotel/hotels/:id/suspend
router.post('/hotels/:id/suspend', async (req: AuthRequest, res) => {
  const reason = String(req.body?.reason ?? '').trim();
  const venue = await transition(
    req.params.id,
    req,
    { approvalStatus: 'suspended', isPublished: false, rejectionReason: reason || null },
    'VENUE_SUSPENDED'
  );
  if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
  return sendSuccess(res, { data: venue });
});

// POST /admin-hotel/hotels/:id/reinstate
router.post('/hotels/:id/reinstate', async (req: AuthRequest, res) => {
  const venue = await transition(
    req.params.id,
    req,
    { approvalStatus: 'approved', isPublished: true, rejectionReason: null },
    'VENUE_REINSTATED'
  );
  if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
  return sendSuccess(res, { data: venue });
});

// POST /admin-hotel/hotels/:id/feature  body: { featured: boolean }
router.post('/hotels/:id/feature', async (req: AuthRequest, res) => {
  const featured = !!req.body?.featured;
  const venue = await transition(
    req.params.id,
    req,
    { isFeatured: featured },
    featured ? 'VENUE_FEATURED' : 'VENUE_UNFEATURED'
  );
  if (!venue) return sendError(res, { message: 'Hôtel introuvable.', statusCode: 404 });
  return sendSuccess(res, { data: venue });
});

/* ─── audit logs (read) ───────────────────────────────────────────── */

import { AuditLog } from '../models/AuditLog';

router.get('/audit-logs', async (req: AuthRequest, res) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.entityId && mongoose.Types.ObjectId.isValid(String(req.query.entityId))) {
      filter.entityId = req.query.entityId;
    }
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId && mongoose.Types.ObjectId.isValid(String(req.query.userId))) {
      filter.userId = req.query.userId;
    }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const logs = await AuditLog.find(filter)
      .populate('userId', 'fullName email')
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return sendSuccess(res, { data: logs });
  } catch (err) {
    logger.error('admin-hotel/audit-logs failed', err);
    return sendError(res, { message: 'Erreur de chargement.', statusCode: 500 });
  }
});

export default router;

import { Router } from 'express';
import { Scene } from '../models/Scene';
import { TablePlacement } from '../models/TablePlacement';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/apiResponse';

const router = Router();

// GET /api/v1/scenes?venueId= — public: list active scenes for a venue
router.get('/', async (req, res) => {
  try {
    const { venueId } = req.query;
    if (!venueId) return sendError(res, { message: 'venueId requis.', statusCode: 400 });

    const scenes = await Scene.find({ venueId, isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    sendSuccess(res, { data: scenes });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

// POST /api/v1/scenes — admin: create a scene
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non autorisé.' });
    const { venueId, name, description, image, order } = req.body;
    if (!venueId || !name || !image) {
      return sendError(res, { message: 'venueId, name et image sont requis.', statusCode: 400 });
    }
    const scene = await Scene.create({
      venueId,
      name: name.trim(),
      description: description?.trim(),
      image,
      order: order ?? 0,
    });
    sendSuccess(res, { data: scene, statusCode: 201 });
  } catch (err) {
    sendError(res, { message: 'Erreur lors de la création de la scène.', statusCode: 500 });
  }
});

// PATCH /api/v1/scenes/:id — admin: update a scene
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, description, image, order, isActive } = req.body;
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description?.trim() || '';
    if (image !== undefined) update.image = image;
    if (order !== undefined) update.order = Number(order);
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const scene = await Scene.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!scene) return sendError(res, { message: 'Scène introuvable.', statusCode: 404 });
    sendSuccess(res, { data: scene });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

// DELETE /api/v1/scenes/:id — admin: delete a scene
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const scene = await Scene.findByIdAndDelete(req.params.id);
    if (!scene) return sendError(res, { message: 'Scène introuvable.', statusCode: 404 });

    // Nullify sceneId on related table placements
    await TablePlacement.updateMany({ sceneId: req.params.id }, { $unset: { sceneId: 1 } });

    sendSuccess(res, { data: null, message: 'Scène supprimée.' });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

// POST /api/v1/scenes/reorder — admin: bulk update order
router.post('/reorder', authenticate, async (req: AuthRequest, res) => {
  try {
    const { items } = req.body as { items: { id: string; order: number }[] };
    if (!Array.isArray(items)) return sendError(res, { message: 'items[] requis.', statusCode: 400 });
    await Promise.all(items.map(({ id, order }) => Scene.findByIdAndUpdate(id, { order })));
    sendSuccess(res, { data: null, message: 'Ordre mis à jour.' });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

export default router;

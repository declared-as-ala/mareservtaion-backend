import { Router } from 'express';
import { MenuItem } from '../models/MenuItem';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/apiResponse';

const router = Router();

// GET /menu/venue/:venueId — public, available items sorted by category
router.get('/venue/:venueId', async (req, res) => {
  try {
    const { venueId } = req.params;
    const items = await MenuItem.find({ venueId, isAvailable: true })
      .sort({ category: 1, name: 1 })
      .lean();
    sendSuccess(res, { data: items });
  } catch (err) {
    console.error('Error fetching menu:', err);
    sendError(res, { message: 'Erreur lors de la récupération du menu.', statusCode: 500 });
  }
});

// GET /menu/admin/venue/:venueId — admin, all items
router.get('/admin/venue/:venueId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { venueId } = req.params;
    const items = await MenuItem.find({ venueId })
      .sort({ category: 1, name: 1 })
      .lean();
    sendSuccess(res, { data: items });
  } catch (err) {
    console.error('Error fetching admin menu:', err);
    sendError(res, { message: 'Erreur lors de la récupération du menu.', statusCode: 500 });
  }
});

// POST /menu — admin, create item
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { venueId, name, description, price, category, image, isAvailable, isPopular, allergens } = req.body;
    if (!venueId || !name || price == null) {
      sendError(res, { message: 'venueId, name et price sont requis.', statusCode: 400 });
      return;
    }
    const item = await MenuItem.create({
      venueId,
      name,
      description,
      price,
      category: category ?? 'plat',
      image,
      isAvailable: isAvailable !== false,
      isPopular: isPopular === true,
      allergens: allergens ?? [],
    });
    sendSuccess(res, { data: item, statusCode: 201, message: 'Article créé avec succès.' });
  } catch (err) {
    console.error('Error creating menu item:', err);
    sendError(res, { message: 'Erreur lors de la création.', statusCode: 500 });
  }
});

// PATCH /menu/:id — admin, update item
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'description', 'price', 'category', 'image', 'isAvailable', 'isPopular', 'allergens'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const item = await MenuItem.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!item) {
      sendError(res, { message: 'Article introuvable.', statusCode: 404 });
      return;
    }
    sendSuccess(res, { data: item, message: 'Article mis à jour.' });
  } catch (err) {
    console.error('Error updating menu item:', err);
    sendError(res, { message: 'Erreur lors de la mise à jour.', statusCode: 500 });
  }
});

// DELETE /menu/:id — admin, delete item
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findByIdAndDelete(id);
    if (!item) {
      sendError(res, { message: 'Article introuvable.', statusCode: 404 });
      return;
    }
    sendSuccess(res, { message: 'Article supprimé.' });
  } catch (err) {
    console.error('Error deleting menu item:', err);
    sendError(res, { message: 'Erreur lors de la suppression.', statusCode: 500 });
  }
});

export default router;

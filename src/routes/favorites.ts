import { Router } from 'express';
import { Favorite } from '../models/Favorite';
import { Venue } from '../models/Venue';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/apiResponse';

const router = Router();

// All favorites routes require auth
router.use(authenticate);

// GET /api/v1/favorites — get current user's favorites
router.get('/', async (req: AuthRequest, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate('venueId', 'name slug type city coverImage startingPrice hasVirtualTour isFeatured isPublished')
      .lean();

    const venues = favorites
      .map((f) => f.venueId)
      .filter(Boolean);

    sendSuccess(res, { data: venues });
  } catch (err) {
    sendError(res, { message: 'Erreur lors de la récupération des favoris.', statusCode: 500 });
  }
});

// GET /api/v1/favorites/ids — get just the list of favorited venue IDs (for quick check)
router.get('/ids', async (req: AuthRequest, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.userId }).select('venueId').lean();
    const ids = favorites.map((f) => f.venueId.toString());
    sendSuccess(res, { data: ids });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

// POST /api/v1/favorites/:venueId — toggle favorite (add if not exists, remove if exists)
router.post('/:venueId', async (req: AuthRequest, res) => {
  try {
    const { venueId } = req.params;

    const venue = await Venue.findById(venueId).lean();
    if (!venue) return sendError(res, { message: 'Lieu introuvable.', statusCode: 404 });

    const existing = await Favorite.findOne({ userId: req.userId, venueId });

    if (existing) {
      await existing.deleteOne();
      return sendSuccess(res, { data: { favorited: false }, message: 'Retiré des favoris.' });
    }

    await Favorite.create({ userId: req.userId, venueId });
    sendSuccess(res, { data: { favorited: true }, message: 'Ajouté aux favoris.' });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

// DELETE /api/v1/favorites/:venueId — explicitly remove favorite
router.delete('/:venueId', async (req: AuthRequest, res) => {
  try {
    await Favorite.deleteOne({ userId: req.userId, venueId: req.params.venueId });
    sendSuccess(res, { data: { favorited: false } });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

export default router;

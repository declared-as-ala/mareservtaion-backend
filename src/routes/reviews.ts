import { Router } from 'express';
import { Review } from '../models/Review';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/apiResponse';

const router = Router();

// GET /api/v1/reviews/venue/:venueId — public: list approved reviews for a venue
router.get('/venue/:venueId', async (req, res) => {
  try {
    const { venueId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ venueId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName')
        .lean(),
      Review.countDocuments({ venueId }),
    ]);

    // Compute average rating
    const agg = await Review.aggregate([
      { $match: { venueId: { $toString: venueId } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const avgRating = agg[0]?.avg ?? null;

    sendSuccess(res, {
      data: { reviews, total, page, limit, avgRating },
    });
  } catch (err) {
    sendError(res, { message: 'Erreur lors de la récupération des avis.', statusCode: 500 });
  }
});

// POST /api/v1/reviews — authenticated: create a review
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { venueId, reservationId, rating, comment } = req.body;

    if (!venueId || !rating || !comment) {
      return sendError(res, { message: 'venueId, rating et comment sont requis.', statusCode: 400 });
    }
    if (rating < 1 || rating > 5) {
      return sendError(res, { message: 'La note doit être entre 1 et 5.', statusCode: 400 });
    }

    const venue = await Venue.findById(venueId).lean();
    if (!venue) return sendError(res, { message: 'Lieu introuvable.', statusCode: 404 });

    // Check for duplicate review (one per user per venue)
    const existing = await Review.findOne({ userId: req.userId, venueId });
    if (existing) {
      return sendError(res, { message: 'Vous avez déjà laissé un avis pour ce lieu.', statusCode: 409 });
    }

    // Verify if this review comes from a real reservation
    let isVerified = false;
    if (reservationId) {
      const res2 = await Reservation.findOne({
        _id: reservationId,
        userId: req.userId,
        venueId,
        status: { $in: ['CONFIRMED', 'COMPLETED'] },
      }).lean();
      if (res2) isVerified = true;
    }

    const review = await Review.create({
      userId: req.userId,
      venueId,
      reservationId: reservationId || undefined,
      rating: Number(rating),
      comment: comment.trim(),
      isVerified,
    });

    // Update venue average rating
    const agg = await Review.aggregate([
      { $match: { venueId: review.venueId } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]);
    if (agg[0]?.avg != null) {
      await Venue.findByIdAndUpdate(venueId, { rating: Math.round(agg[0].avg * 10) / 10 });
    }

    const populated = await review.populate('userId', 'fullName');
    sendSuccess(res, { data: populated, statusCode: 201 });
  } catch (err) {
    sendError(res, { message: 'Erreur lors de la création de l\'avis.', statusCode: 500 });
  }
});

// DELETE /api/v1/reviews/:id — user can delete their own review
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, userId: req.userId });
    if (!review) return sendError(res, { message: 'Avis introuvable.', statusCode: 404 });
    await review.deleteOne();
    sendSuccess(res, { data: null, message: 'Avis supprimé.' });
  } catch (err) {
    sendError(res, { message: 'Erreur.', statusCode: 500 });
  }
});

export default router;

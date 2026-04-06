import rateLimit from 'express-rate-limit';

const windowMs = 15 * 60 * 1000; // 15 minutes

/**
 * General API rate limit (e.g. for /api/v1/*).
 */
export const apiLimiter = rateLimit({
  windowMs,
  max: 200,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limit for auth routes (login/register already have their own in auth routes).
 */
export const authLimiter = rateLimit({
  windowMs,
  max: 20,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limit for reservation creation to prevent abuse.
 */
export const reservationLimiter = rateLimit({
  windowMs,
  max: 30,
  message: { success: false, message: 'Trop de réservations. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

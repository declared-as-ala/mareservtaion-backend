import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

const windowMs = 15 * 60 * 1000; // 15 minutes

// On Vercel, the real client IP is in X-Forwarded-For
const keyGenerator = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const forwardedIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    return ipKeyGenerator(forwardedIp);
  }
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? '');
};

export const apiLimiter = rateLimit({
  windowMs,
  max: 200,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

/**
 * Stricter limit for auth routes (login/register already have their own in auth routes).
 */
// export const authLimiter = rateLimit({
//   windowMs,
//   max: 20,
//   message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

/**
 * Limit for reservation creation to prevent abuse.
 */
export const reservationLimiter = rateLimit({
  windowMs,
  max: 30,
  message: { success: false, message: 'Trop de réservations. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

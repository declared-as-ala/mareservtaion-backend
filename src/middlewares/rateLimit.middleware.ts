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

const isDev = process.env.NODE_ENV !== 'production';

function logRateLimitHit(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
  console.warn(
    `[rate-limit] blocked ${req.method} ${req.originalUrl} ip=${ip}`
  );
}

export const apiLimiter = rateLimit({
  windowMs,
  max: 200,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  // In development, disable global API throttling to avoid blocking on page refresh/HMR.
  skip: () => isDev,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req);
    res.status(options.statusCode).json(options.message);
  },
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
  skip: () => isDev,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req);
    res.status(options.statusCode).json(options.message);
  },
});

/** Stricter limits for SOS Conseil assistant (OpenRouter). */
export const sosConseilChatLimiter = rateLimit({
  windowMs,
  max: Number(process.env.SOS_CHAT_RATE_MAX || 24),
  message: {
    success: false,
    error:
      'Trop de messages avec l\'assistant. Patientez quelques minutes ou réessayez plus tard.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  // Keep assistant limiter active even in dev by default unless explicitly disabled.
  skip: () => process.env.SOS_CHAT_DISABLE_RATE_LIMIT === 'true',
  handler: (req, res, _next, options) => {
    logRateLimitHit(req);
    res.status(options.statusCode).json(options.message);
  },
});

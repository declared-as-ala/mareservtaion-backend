import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_EXPIRY_DAYS = 7;
const ORGANIZER_COOKIE = 'organizerRefreshToken';

function setOrganizerRefreshCookie(res: Response, token: string) {
  const maxAge = REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(ORGANIZER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/api/v1/organizer',
  });
}

function clearOrganizerRefreshCookie(res: Response) {
  res.clearCookie(ORGANIZER_COOKIE, { path: '/api/v1/organizer' });
}

// POST /api/v1/organizer/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe sont obligatoires.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    if (user.role !== 'ORGANIZER') {
      return res.status(403).json({
        error: "Ce compte n'est pas un compte organisateur. Utilisez la connexion standard.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Ce compte est désactivé. Contactez le support.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );

    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
    setOrganizerRefreshCookie(res, refreshTokenValue);

    res.json({
      message: 'Connexion réussie',
      accessToken,
      expiresIn: 900,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[organizer] login error:', error);
    res.status(500).json({ error: 'Erreur de connexion.' });
  }
});

// POST /api/v1/organizer/auth/refresh
router.post('/auth/refresh', async (req, res) => {
  try {
    const token = req.cookies?.[ORGANIZER_COOKIE];
    if (!token) {
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }

    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await RefreshToken.deleteOne({ _id: stored._id });
      clearOrganizerRefreshCookie(res);
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }

    const user = await User.findById((stored as any).userId);
    if (!user || user.role !== 'ORGANIZER') {
      await RefreshToken.deleteOne({ _id: stored._id });
      clearOrganizerRefreshCookie(res);
      return res.status(401).json({ error: 'Accès non autorisé.' });
    }

    await RefreshToken.deleteOne({ _id: stored._id });
    const newRefresh = crypto.randomBytes(40).toString('hex');
    await RefreshToken.create({
      userId: user._id,
      token: newRefresh,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
    setOrganizerRefreshCookie(res, newRefresh);

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );

    res.json({
      accessToken,
      expiresIn: 900,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('[organizer] refresh error:', error);
    res.status(500).json({ error: 'Erreur de renouvellement de session.' });
  }
});

// GET /api/v1/organizer/auth/me
router.get('/auth/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié.' });
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (user.role !== 'ORGANIZER') {
      return res.status(403).json({ error: "Ce compte n'est pas un compte organisateur." });
    }
    res.json({ id: user._id, fullName: user.fullName, email: user.email, role: user.role });
  } catch (error) {
    console.error('[organizer] me error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

// POST /api/v1/organizer/auth/logout
router.post('/auth/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const token = req.cookies?.[ORGANIZER_COOKIE];
    if (token) await RefreshToken.deleteOne({ token });
    clearOrganizerRefreshCookie(res);
    res.json({ message: 'Déconnexion réussie.' });
  } catch {
    clearOrganizerRefreshCookie(res);
    res.json({ message: 'Déconnexion réussie.' });
  }
});

export default router;

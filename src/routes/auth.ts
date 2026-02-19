import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_SECRET || JWT_SECRET;
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_EXPIRY_DAYS = 7;
const COOKIE_NAME = 'refreshToken';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setRefreshCookie(res: Response, token: string) {
  const maxAge = REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
}

// POST /api/auth/register and POST /api/auth/signup (body.name accepted as fullName)
router.post(['/register', '/signup'], async (req, res) => {
  try {
    let { fullName, email, password, role } = req.body;
    if (!fullName && req.body.name) fullName = req.body.name;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'Le nom complet est obligatoire.' });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: "L'email est obligatoire." });
    }
    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Le mot de passe est obligatoire.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const emailLower = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    // Only CUSTOMER can self-register; ADMIN is created by seed
    const allowedRole = 'CUSTOMER';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      fullName: fullName.trim(),
      email: emailLower,
      passwordHash,
      role: allowedRole,
    });
    await user.save();

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );
    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    const refreshTokenDoc = new RefreshToken({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
    await refreshTokenDoc.save();
    setRefreshCookie(res, refreshTokenValue);

    res.status(201).json({
      message: 'Compte créé avec succès',
      accessToken,
      expiresIn: 900, // 15 min in seconds
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// POST /api/auth/login (rate limited)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe sont obligatoires.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

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
    setRefreshCookie(res, refreshTokenValue);

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
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Erreur de connexion.' });
  }
});

// POST /api/auth/refresh — rotate refresh token, return new access token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Refresh token manquant.' });
    }

    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await RefreshToken.deleteOne({ _id: stored._id });
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }

    const user = await User.findById((stored as any).userId);
    if (!user) {
      await RefreshToken.deleteOne({ _id: stored._id });
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    // Rotate: delete old refresh token, issue new one
    await RefreshToken.deleteOne({ _id: stored._id });
    const newRefresh = crypto.randomBytes(40).toString('hex');
    await RefreshToken.create({
      userId: user._id,
      token: newRefresh,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
    setRefreshCookie(res, newRefresh);

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );

    res.json({
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
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Erreur de renouvellement de session.' });
  }
});

// GET /api/auth/me — current user (requires valid token)
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié.' });
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    clearRefreshCookie(res);
    res.json({ message: 'Déconnexion réussie.' });
  } catch (error) {
    clearRefreshCookie(res);
    res.json({ message: 'Déconnexion réussie.' });
  }
});

export default router;

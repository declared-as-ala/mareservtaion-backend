import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { PasswordReset } from '../models/PasswordReset';
import { EmailVerification } from '../models/EmailVerification';
import { LoginAttempt } from '../models/LoginAttempt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getEnv } from '../config/env';
import { sendEmail, createPasswordResetTemplate, createEmailVerificationTemplate } from '../services/email.service';
import { logAudit } from '../utils/audit.util';
import { validatePasswordStrength } from '../utils/password.util';
import { logger } from '../config/logger';

const router = Router();
const env = getEnv();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const ACCESS_EXPIRY = env.ACCESS_TOKEN_EXPIRY;
const REFRESH_EXPIRY_DAYS = 7;
const REFRESH_COOKIE_NAME = 'refreshToken';
const ACCESS_COOKIE_NAME = 'accessToken';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const accessMaxAge = 15 * 60 * 1000; // 15 min
  const refreshMaxAge = REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const isProd = process.env.NODE_ENV === 'production';
  const sameSitePolicy: 'lax' | 'none' = isProd ? 'none' : 'lax';

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: sameSitePolicy,
    maxAge: accessMaxAge,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: sameSitePolicy,
    maxAge: refreshMaxAge,
    path: '/',
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
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

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Le mot de passe ne respecte pas les exigences de sécurité.',
        details: passwordValidation.errors
      });
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

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const emailVerification = new EmailVerification({
      userId: user._id,
      tokenHash: verificationTokenHash,
      expiresAt: verificationExpires,
    });
    await emailVerification.save();

    // Send verification email
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const emailTemplate = createEmailVerificationTemplate(user.fullName, verificationUrl);

    // Don't wait for email to send, let it happen in background
    sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    }).then((sent) => {
      if (sent) {
        logger.info(`Verification email sent to ${user.email}`);
      }
    });

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      env.JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );
    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    const refreshTokenDoc = new RefreshToken({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
    await refreshTokenDoc.save();
    setAuthCookies(res, accessToken, refreshTokenValue);

    // Log audit
    await logAudit(req, {
      action: 'USER_CREATED',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      details: { email: user.email },
    });

    res.status(201).json({
      message: 'Compte créé avec succès. Un email de vérification a été envoyé.',
      accessToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
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
      // Log failed attempt
      await LoginAttempt.create({
        email: email.toLowerCase(),
        ipAddress: req.ip || req.connection.remoteAddress,
        success: false,
        userAgent: req.headers['user-agent'],
      });

      return res.status(401).json({
        error: 'Email ou mot de passe incorrect.'
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Veuillez verifier votre email avant de vous connecter.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Successful login
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      env.JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );
    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
    setAuthCookies(res, accessToken, refreshTokenValue);

    // Log successful login
    await LoginAttempt.create({
      email: email.toLowerCase(),
      ipAddress: req.ip || req.connection.remoteAddress,
      success: true,
      userAgent: req.headers['user-agent'],
    });

    await logAudit(req, {
      action: 'LOGIN',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      details: { success: true },
    });

    res.json({
      message: 'Connexion réussie',
      accessToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error('Error logging in:', error);
    res.status(500).json({ error: 'Erreur de connexion.' });
  }
});

// POST /api/auth/refresh — rotate refresh token, return new access token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Refresh token manquant.' });
    }

    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await RefreshToken.deleteOne({ _id: stored._id });
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }

    const user = await User.findById((stored as any).userId);
    if (!user) {
      await RefreshToken.deleteOne({ _id: stored._id });
      clearAuthCookies(res);
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
    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      env.JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
    );
    setAuthCookies(res, accessToken, newRefresh);

    res.json({
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
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

// PATCH /api/auth/me — update current user profile basics
router.patch('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié.' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const { fullName, phone } = req.body ?? {};

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length < 2) {
        return res.status(400).json({ error: 'Le nom complet doit contenir au moins 2 caractères.' });
      }
      user.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      if (phone === null || phone === '') {
        user.phone = undefined;
      } else if (typeof phone !== 'string') {
        return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
      } else {
        const cleanedPhone = phone.trim();
        if (cleanedPhone.length > 30) {
          return res.status(400).json({ error: 'Numéro de téléphone trop long.' });
        }
        user.phone = cleanedPhone;
      }
    }

    await user.save();

    await logAudit(req, {
      action: 'USER_UPDATED',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      details: { fields: ['fullName', 'phone'] },
    });

    return res.json({
      message: 'Profil mis à jour avec succès.',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    clearAuthCookies(res);

    await logAudit(req, {
      action: 'LOGOUT',
      userId: req.userId,
    });

    res.json({ message: 'Déconnexion réussie.' });
  } catch (error) {
    clearAuthCookies(res);
    res.json({ message: 'Déconnexion réussie.' });
  }
});

// ==================== PASSWORD RESET FLOW ====================

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email est obligatoire.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
    }

    // Delete any existing reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id });

    // Generate new reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const passwordReset = new PasswordReset({
      userId: user._id,
      tokenHash: resetTokenHash,
      expiresAt: resetExpires,
    });
    await passwordReset.save();

    // Send reset email
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const emailTemplate = createPasswordResetTemplate(user.fullName, resetUrl);

    const emailSent = await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (emailSent) {
      logger.info(`Password reset email sent to ${user.email}`);
    }

    await logAudit(req, {
      action: 'PASSWORD_RESET',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      details: { emailSent },
    });

    res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
  } catch (error) {
    logger.error('Error in forgot-password:', error);
    res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token de réinitialisation invalide.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Nouveau mot de passe obligatoire.' });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Le mot de passe ne respecte pas les exigences de sécurité.',
        details: passwordValidation.errors,
      });
    }

    // Hash the token to find it in DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await PasswordReset.findOne({
      tokenHash,
      used: false,
    }).populate('userId');

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      if (resetRecord) await PasswordReset.deleteOne({ _id: resetRecord._id });
      return res.status(400).json({ error: 'Lien de réinitialisation expiré ou invalide.' });
    }

    const user = resetRecord.userId as any;
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    await user.save();

    // Mark reset token as used
    resetRecord.used = true;
    await resetRecord.save();

    // Delete all other reset tokens for this user
    await PasswordReset.deleteMany({
      userId: user._id,
      _id: { $ne: resetRecord._id },
    });

    await logAudit(req, {
      action: 'PASSWORD_RESET',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      details: { success: true },
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    logger.error('Error in reset-password:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
  }
});

// ==================== EMAIL VERIFICATION FLOW ====================

// GET /api/auth/verify-email - Verify email with token
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token de vérification invalide.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const verificationRecord = await EmailVerification.findOne({
      tokenHash,
      used: false,
    }).populate('userId');

    if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
      if (verificationRecord) await EmailVerification.deleteOne({ _id: verificationRecord._id });
      return res.status(400).json({ error: 'Lien de vérification expiré ou invalide.' });
    }

    const user = verificationRecord.userId as any;
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Mark email as verified
    user.emailVerified = true;
    await user.save();

    // Mark verification token as used
    verificationRecord.used = true;
    await verificationRecord.save();

    await logAudit(req, {
      action: 'EMAIL_VERIFICATION',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
    });

    // Redirect to frontend success page
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/email-verified?success=true`);
  } catch (error) {
    logger.error('Error in verify-email:', error);
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/email-verified?success=false`);
  }
});

// POST /api/auth/verify-email-token - verify email token and return JSON state for SPA
router.post('/verify-email-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token de vérification invalide.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const verificationRecord = await EmailVerification.findOne({
      tokenHash,
      used: false,
    }).populate('userId');

    if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
      if (verificationRecord) await EmailVerification.deleteOne({ _id: verificationRecord._id });
      return res.status(400).json({ error: 'Lien de vérification expiré ou invalide.' });
    }

    const user = verificationRecord.userId as any;
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    user.emailVerified = true;
    await user.save();
    verificationRecord.used = true;
    await verificationRecord.save();

    await logAudit(req, {
      action: 'EMAIL_VERIFICATION',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
    });

    return res.json({ message: 'Email vérifié avec succès.' });
  } catch (error) {
    logger.error('Error in verify-email-token:', error);
    return res.status(500).json({ error: 'Erreur lors de la vérification email.' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email déjà vérifié.' });
    }

    // Delete existing verification token
    await EmailVerification.deleteOne({ userId: user._id });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const emailVerification = new EmailVerification({
      userId: user._id,
      tokenHash: verificationTokenHash,
      expiresAt: verificationExpires,
    });
    await emailVerification.save();

    // Send verification email
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const emailTemplate = createEmailVerificationTemplate(user.fullName, verificationUrl);

    const emailSent = await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!emailSent) {
      return res.status(500).json({ error: "Erreur lors de l'envoi de l'email de vérification." });
    }

    res.json({ message: 'Email de vérification envoyé avec succès.' });
  } catch (error) {
    logger.error('Error in resend-verification:', error);
    res.status(500).json({ error: "Erreur lors du renvoi de l'email de vérification." });
  }
});

// POST /api/auth/resend-verification-public - resend verification by email (unauthenticated)
router.post('/resend-verification-public', async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
      return res.status(400).json({ error: "L'email est obligatoire." });
    }

    const email = rawEmail.trim().toLowerCase();
    const user = await User.findOne({ email });

    // Keep behavior non-enumerable
    if (!user) {
      return res.json({ message: 'Si un compte existe, un email de vérification sera envoyé.' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Compte déjà vérifié.' });
    }

    await EmailVerification.deleteMany({ userId: user._id });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await EmailVerification.create({
      userId: user._id,
      tokenHash: verificationTokenHash,
      expiresAt: verificationExpires,
    });

    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const emailTemplate = createEmailVerificationTemplate(user.fullName, verificationUrl);

    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    return res.json({ message: 'Si un compte existe, un email de vérification sera envoyé.' });
  } catch (error) {
    logger.error('Error in resend-verification-public:', error);
    return res.status(500).json({ error: "Erreur lors du renvoi de l'email de vérification." });
  }
});

// POST /api/auth/change-password - Change password (authenticated)
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe sont obligatoires.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe ne respecte pas les exigences de sécurité.',
        details: passwordValidation.errors,
      });
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAudit(req, {
      action: 'PASSWORD_CHANGE',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
    });

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    logger.error('Error in change-password:', error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
  }
});

export default router;

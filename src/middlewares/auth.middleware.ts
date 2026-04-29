import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

const env = getEnv();

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Prefer Bearer token from Authorization header, fall back to httpOnly cookie.
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      token = req.cookies?.accessToken;
    }
    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required', message: 'Token manquant.' });
      return;
    }
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token', message: 'Token invalide ou expiré.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Admin access required', message: 'Accès administrateur requis.' });
    return;
  }
  next();
};

export const requireRoles =
  (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ success: false, error: 'Forbidden', message: 'Permissions insuffisantes.' });
      return;
    }
    next();
  };

export const requireEstablishmentOwner = requireRoles('ESTABLISHMENT_OWNER', 'ADMIN');

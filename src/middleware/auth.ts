// Re-export from middlewares for backward compatibility
export { authenticate, requireAdmin, requireRoles, requireEstablishmentOwner, type AuthRequest } from '../middlewares/auth.middleware';

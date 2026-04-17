import { Request } from 'express';
import { AuditLog, IAuditLog, AuditAction } from '../models/AuditLog';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

interface AuditLogOptions {
  action: AuditAction;
  userId?: string | mongoose.Types.ObjectId;
  entityType?: IAuditLog['entityType'];
  entityId?: string | mongoose.Types.ObjectId;
  details?: Record<string, any>;
}

export async function logAudit(
  req: Request | undefined,
  options: AuditLogOptions
): Promise<void> {
  try {
    const logEntry = new AuditLog({
      userId: options.userId ? new mongoose.Types.ObjectId(options.userId.toString()) : undefined,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId ? new mongoose.Types.ObjectId(options.entityId.toString()) : undefined,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      details: options.details,
      timestamp: new Date(),
    });

    await logEntry.save();
  } catch (error) {
    // Don't let audit logging failures break the main flow
    logger.error(`Audit logging failed: ${error}`);
  }
}

// Middleware factory to log admin actions
export function logAdminAction(action: AuditAction, entityType?: IAuditLog['entityType']) {
  return async (req: Request, _res: any, next: any) => {
    try {
      const authReq = req as any;
      await logAudit(req, {
        action,
        userId: authReq.userId,
        entityType,
        entityId: req.params.id,
        details: {
          method: req.method,
          path: req.path,
          body: req.method !== 'GET' ? { ...req.body, password: undefined, passwordHash: undefined } : undefined,
        },
      });
    } catch (error) {
      logger.error(`Admin audit logging failed: ${error}`);
    }
    next();
  };
}

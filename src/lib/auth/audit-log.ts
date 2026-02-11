/**
 * Audit logging system
 * 
 * Tracks important actions and changes for security and compliance
 */

import { UserRole } from '@/generated/prisma/client';

export type AuditAction =
  | 'USER_ROLE_CHANGED'
  | 'USER_INVITED'
  | 'USER_REMOVED'
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_UPDATED'
  | 'ORGANIZATION_DELETED'
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_UPDATED'
  | 'ACCOUNT_DELETED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_DELETED'
  | 'SETTINGS_CHANGED';

export interface AuditLogEntry {
  action: AuditAction;
  userId: string;
  organizationId: string;
  targetUserId?: string;
  targetResourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // For now, just log to console
    // In production, this would save to a dedicated audit_logs table
    console.log('[AUDIT LOG]', {
      timestamp: new Date().toISOString(),
      ...entry,
    });

    // TODO: Implement database storage when audit_logs table is added to schema
    // await prisma.auditLog.create({
    //   data: {
    //     action: entry.action,
    //     userId: entry.userId,
    //     organizationId: entry.organizationId,
    //     targetUserId: entry.targetUserId,
    //     targetResourceId: entry.targetResourceId,
    //     details: entry.details,
    //     ipAddress: entry.ipAddress,
    //     userAgent: entry.userAgent,
    //   },
    // });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging failures shouldn't break the application
  }
}

/**
 * Log a role change
 */
export async function logRoleChange(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  oldRole: UserRole,
  newRole: UserRole,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    action: 'USER_ROLE_CHANGED',
    userId: actorUserId,
    organizationId,
    targetUserId,
    details: {
      oldRole,
      newRole,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a user invitation
 */
export async function logUserInvitation(
  actorUserId: string,
  organizationId: string,
  invitedEmail: string,
  role: UserRole,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    action: 'USER_INVITED',
    userId: actorUserId,
    organizationId,
    details: {
      invitedEmail,
      role,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a user removal
 */
export async function logUserRemoval(
  actorUserId: string,
  organizationId: string,
  removedUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    action: 'USER_REMOVED',
    userId: actorUserId,
    organizationId,
    targetUserId: removedUserId,
    details: {},
    ipAddress,
    userAgent,
  });
}

/**
 * Log organization creation
 */
export async function logOrganizationCreated(
  userId: string,
  organizationId: string,
  organizationName: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    action: 'ORGANIZATION_CREATED',
    userId,
    organizationId,
    details: {
      name: organizationName,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log organization settings change
 */
export async function logOrganizationUpdated(
  userId: string,
  organizationId: string,
  changes: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    action: 'ORGANIZATION_UPDATED',
    userId,
    organizationId,
    details: {
      changes,
    },
    ipAddress,
    userAgent,
  });
}

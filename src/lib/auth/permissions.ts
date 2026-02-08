/**
 * Role-based access control utilities
 * 
 * These utilities help enforce permissions throughout the application.
 */

import { UserRole } from '@prisma/client';

/**
 * Permission levels in ascending order
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  DONOR: 1,
  ORG_ADMIN: 2,
  PLATFORM_ADMIN: 3,
};

/**
 * Check if a role has sufficient permissions
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a role can perform admin actions
 */
export function isOrgAdmin(role: UserRole): boolean {
  return hasRole(role, 'ORG_ADMIN');
}

/**
 * Check if a role is platform admin
 */
export function isPlatformAdmin(role: UserRole): boolean {
  return role === 'PLATFORM_ADMIN';
}

/**
 * Get all roles that a user can assign to others
 * - PLATFORM_ADMIN can assign any role
 * - ORG_ADMIN can assign DONOR or ORG_ADMIN
 * - DONOR cannot assign any roles
 */
export function getAssignableRoles(userRole: UserRole): UserRole[] {
  if (isPlatformAdmin(userRole)) {
    return ['DONOR', 'ORG_ADMIN', 'PLATFORM_ADMIN'];
  }
  if (isOrgAdmin(userRole)) {
    return ['DONOR', 'ORG_ADMIN'];
  }
  return [];
}

/**
 * Check if user can modify another user's role
 */
export function canModifyRole(
  modifierRole: UserRole,
  targetRole: UserRole,
  newRole: UserRole
): boolean {
  // Platform admins can modify any role
  if (isPlatformAdmin(modifierRole)) {
    return true;
  }

  // Org admins can modify DONOR and ORG_ADMIN roles
  if (isOrgAdmin(modifierRole)) {
    return (
      targetRole !== 'PLATFORM_ADMIN' &&
      newRole !== 'PLATFORM_ADMIN'
    );
  }

  // Donors cannot modify any roles
  return false;
}

/**
 * Role display names
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  DONOR: 'Donor',
  ORG_ADMIN: 'Organization Administrator',
  PLATFORM_ADMIN: 'Platform Administrator',
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  DONOR: 'Can view public financial information and make donations',
  ORG_ADMIN: 'Can manage organization settings, accounts, and transactions',
  PLATFORM_ADMIN: 'Full system access across all organizations',
};

/**
 * Permissions by role
 */
export interface RolePermissions {
  // Organization permissions
  viewOrganization: boolean;
  editOrganization: boolean;
  deleteOrganization: boolean;
  
  // Account permissions
  viewAccounts: boolean;
  createAccounts: boolean;
  editAccounts: boolean;
  deleteAccounts: boolean;
  
  // Transaction permissions
  viewTransactions: boolean;
  createTransactions: boolean;
  editTransactions: boolean;
  deleteTransactions: boolean;
  
  // User management permissions
  viewUsers: boolean;
  inviteUsers: boolean;
  editUserRoles: boolean;
  removeUsers: boolean;
  
  // Financial data permissions
  viewBalances: boolean;
  exportData: boolean;
  
  // Public visibility permissions
  viewPublicDashboard: boolean;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return {
        viewOrganization: true,
        editOrganization: true,
        deleteOrganization: true,
        viewAccounts: true,
        createAccounts: true,
        editAccounts: true,
        deleteAccounts: true,
        viewTransactions: true,
        createTransactions: true,
        editTransactions: true,
        deleteTransactions: true,
        viewUsers: true,
        inviteUsers: true,
        editUserRoles: true,
        removeUsers: true,
        viewBalances: true,
        exportData: true,
        viewPublicDashboard: true,
      };

    case 'ORG_ADMIN':
      return {
        viewOrganization: true,
        editOrganization: true,
        deleteOrganization: false, // Only platform admin can delete
        viewAccounts: true,
        createAccounts: true,
        editAccounts: true,
        deleteAccounts: true,
        viewTransactions: true,
        createTransactions: true,
        editTransactions: true,
        deleteTransactions: true,
        viewUsers: true,
        inviteUsers: true,
        editUserRoles: true,
        removeUsers: true,
        viewBalances: true,
        exportData: true,
        viewPublicDashboard: true,
      };

    case 'DONOR':
      return {
        viewOrganization: true,
        editOrganization: false,
        deleteOrganization: false,
        viewAccounts: true,
        createAccounts: false,
        editAccounts: false,
        deleteAccounts: false,
        viewTransactions: true,
        createTransactions: false, // Donors can only donate, not record transactions
        editTransactions: false,
        deleteTransactions: false,
        viewUsers: false,
        inviteUsers: false,
        editUserRoles: false,
        removeUsers: false,
        viewBalances: true,
        exportData: false,
        viewPublicDashboard: true,
      };
  }
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  const permissions = getRolePermissions(role);
  return permissions[permission];
}

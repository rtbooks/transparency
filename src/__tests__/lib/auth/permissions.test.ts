/**
 * Permissions utility tests
 *
 * Covers role hierarchy, permission checks, role assignment rules,
 * and per-role permission matrices.
 */

import {
  ROLE_HIERARCHY,
  hasRole,
  isOrgAdmin,
  isPlatformAdmin,
  getAssignableRoles,
  canModifyRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  getRolePermissions,
  hasPermission,
} from '@/lib/auth/permissions';

// ── Role Hierarchy ──────────────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  it('should rank PUBLIC lowest', () => {
    expect(ROLE_HIERARCHY.PUBLIC).toBe(0);
  });

  it('should rank PLATFORM_ADMIN highest', () => {
    expect(ROLE_HIERARCHY.PLATFORM_ADMIN).toBe(3);
  });

  it('should maintain ascending order', () => {
    expect(ROLE_HIERARCHY.PUBLIC).toBeLessThan(ROLE_HIERARCHY.SUPPORTER);
    expect(ROLE_HIERARCHY.SUPPORTER).toBeLessThan(ROLE_HIERARCHY.ORG_ADMIN);
    expect(ROLE_HIERARCHY.ORG_ADMIN).toBeLessThan(ROLE_HIERARCHY.PLATFORM_ADMIN);
  });
});

// ── hasRole ──────────────────────────────────────────────────────────────

describe('hasRole', () => {
  it('should return true when user role equals required role', () => {
    expect(hasRole('ORG_ADMIN', 'ORG_ADMIN')).toBe(true);
  });

  it('should return true when user role exceeds required role', () => {
    expect(hasRole('PLATFORM_ADMIN', 'SUPPORTER')).toBe(true);
    expect(hasRole('ORG_ADMIN', 'SUPPORTER')).toBe(true);
  });

  it('should return false when user role is below required role', () => {
    expect(hasRole('SUPPORTER', 'ORG_ADMIN')).toBe(false);
    expect(hasRole('PUBLIC', 'SUPPORTER')).toBe(false);
  });
});

// ── isOrgAdmin / isPlatformAdmin ────────────────────────────────────────

describe('isOrgAdmin', () => {
  it('should return true for ORG_ADMIN', () => {
    expect(isOrgAdmin('ORG_ADMIN')).toBe(true);
  });

  it('should return true for PLATFORM_ADMIN (higher level)', () => {
    expect(isOrgAdmin('PLATFORM_ADMIN')).toBe(true);
  });

  it('should return false for SUPPORTER', () => {
    expect(isOrgAdmin('SUPPORTER')).toBe(false);
  });

  it('should return false for PUBLIC', () => {
    expect(isOrgAdmin('PUBLIC')).toBe(false);
  });
});

describe('isPlatformAdmin', () => {
  it('should return true only for PLATFORM_ADMIN', () => {
    expect(isPlatformAdmin('PLATFORM_ADMIN')).toBe(true);
  });

  it('should return false for ORG_ADMIN', () => {
    expect(isPlatformAdmin('ORG_ADMIN')).toBe(false);
  });

  it('should return false for SUPPORTER', () => {
    expect(isPlatformAdmin('SUPPORTER')).toBe(false);
  });
});

// ── getAssignableRoles ──────────────────────────────────────────────────

describe('getAssignableRoles', () => {
  it('PLATFORM_ADMIN can assign all roles', () => {
    const roles = getAssignableRoles('PLATFORM_ADMIN');
    expect(roles).toContain('SUPPORTER');
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('PLATFORM_ADMIN');
  });

  it('ORG_ADMIN can assign SUPPORTER and ORG_ADMIN', () => {
    const roles = getAssignableRoles('ORG_ADMIN');
    expect(roles).toContain('SUPPORTER');
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).not.toContain('PLATFORM_ADMIN');
  });

  it('SUPPORTER cannot assign any roles', () => {
    expect(getAssignableRoles('SUPPORTER')).toEqual([]);
  });

  it('PUBLIC cannot assign any roles', () => {
    expect(getAssignableRoles('PUBLIC')).toEqual([]);
  });
});

// ── canModifyRole ───────────────────────────────────────────────────────

describe('canModifyRole', () => {
  it('PLATFORM_ADMIN can modify any role', () => {
    expect(canModifyRole('PLATFORM_ADMIN', 'SUPPORTER', 'ORG_ADMIN')).toBe(true);
    expect(canModifyRole('PLATFORM_ADMIN', 'ORG_ADMIN', 'PLATFORM_ADMIN')).toBe(true);
  });

  it('ORG_ADMIN can modify SUPPORTER to ORG_ADMIN', () => {
    expect(canModifyRole('ORG_ADMIN', 'SUPPORTER', 'ORG_ADMIN')).toBe(true);
  });

  it('ORG_ADMIN cannot promote to PLATFORM_ADMIN', () => {
    expect(canModifyRole('ORG_ADMIN', 'SUPPORTER', 'PLATFORM_ADMIN')).toBe(false);
  });

  it('ORG_ADMIN cannot modify a PLATFORM_ADMIN', () => {
    expect(canModifyRole('ORG_ADMIN', 'PLATFORM_ADMIN', 'SUPPORTER')).toBe(false);
  });

  it('SUPPORTER cannot modify any roles', () => {
    expect(canModifyRole('SUPPORTER', 'SUPPORTER', 'ORG_ADMIN')).toBe(false);
  });
});

// ── ROLE_LABELS / ROLE_DESCRIPTIONS ─────────────────────────────────────

describe('ROLE_LABELS', () => {
  it('should have labels for all roles', () => {
    expect(ROLE_LABELS.PUBLIC).toBe('Public');
    expect(ROLE_LABELS.SUPPORTER).toBe('Supporter');
    expect(ROLE_LABELS.ORG_ADMIN).toBe('Organization Administrator');
    expect(ROLE_LABELS.PLATFORM_ADMIN).toBe('Platform Administrator');
  });
});

describe('ROLE_DESCRIPTIONS', () => {
  it('should have descriptions for all roles', () => {
    expect(ROLE_DESCRIPTIONS.PUBLIC).toBeTruthy();
    expect(ROLE_DESCRIPTIONS.SUPPORTER).toBeTruthy();
    expect(ROLE_DESCRIPTIONS.ORG_ADMIN).toBeTruthy();
    expect(ROLE_DESCRIPTIONS.PLATFORM_ADMIN).toBeTruthy();
  });
});

// ── getRolePermissions ──────────────────────────────────────────────────

describe('getRolePermissions', () => {
  it('PLATFORM_ADMIN has all permissions', () => {
    const perms = getRolePermissions('PLATFORM_ADMIN');
    for (const value of Object.values(perms)) {
      expect(value).toBe(true);
    }
  });

  it('ORG_ADMIN has all permissions except deleteOrganization', () => {
    const perms = getRolePermissions('ORG_ADMIN');
    expect(perms.deleteOrganization).toBe(false);
    expect(perms.viewOrganization).toBe(true);
    expect(perms.editOrganization).toBe(true);
    expect(perms.createTransactions).toBe(true);
    expect(perms.viewUsers).toBe(true);
  });

  it('SUPPORTER has read-only access plus public dashboard', () => {
    const perms = getRolePermissions('SUPPORTER');
    expect(perms.viewOrganization).toBe(true);
    expect(perms.viewAccounts).toBe(true);
    expect(perms.viewTransactions).toBe(true);
    expect(perms.viewBalances).toBe(true);
    expect(perms.viewPublicDashboard).toBe(true);
    expect(perms.editOrganization).toBe(false);
    expect(perms.createAccounts).toBe(false);
    expect(perms.createTransactions).toBe(false);
    expect(perms.viewUsers).toBe(false);
  });

  it('PUBLIC can only view organization and public dashboard', () => {
    const perms = getRolePermissions('PUBLIC');
    expect(perms.viewOrganization).toBe(true);
    expect(perms.viewPublicDashboard).toBe(true);
    expect(perms.viewAccounts).toBe(false);
    expect(perms.viewTransactions).toBe(false);
    expect(perms.viewBalances).toBe(false);
    expect(perms.editOrganization).toBe(false);
  });
});

// ── hasPermission ───────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('should return true when role has the permission', () => {
    expect(hasPermission('PLATFORM_ADMIN', 'deleteOrganization')).toBe(true);
    expect(hasPermission('ORG_ADMIN', 'createTransactions')).toBe(true);
  });

  it('should return false when role lacks the permission', () => {
    expect(hasPermission('SUPPORTER', 'createTransactions')).toBe(false);
    expect(hasPermission('PUBLIC', 'viewAccounts')).toBe(false);
    expect(hasPermission('ORG_ADMIN', 'deleteOrganization')).toBe(false);
  });
});

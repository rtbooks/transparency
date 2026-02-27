/**
 * Unit tests for OrganizationUser Service
 *
 * Tests membership CRUD, role checks, temporal versioning operations,
 * and soft-delete logic. These tests directly prevent the class of bugs where:
 *   - Temporal versioning is not applied on updates
 *   - Role checks return incorrect results
 *   - Soft-delete does not close the old version correctly
 *   - User not found errors are not raised properly
 */

import { prisma } from '@/lib/prisma';
import { MAX_DATE, buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organizationUser: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Mock temporal utils — pass through real implementations but allow spy access
jest.mock('@/lib/temporal/temporal-utils', () => {
  const actual = jest.requireActual('@/lib/temporal/temporal-utils');
  return {
    ...actual,
    closeVersion: jest.fn().mockResolvedValue(undefined),
  };
});

import {
  createOrganizationUser,
  findOrganizationUserByUserAndOrg,
  findUsersForOrganization,
  updateUserRole,
  removeUserFromOrganization,
  hasRole,
  isOrgAdmin,
} from '@/services/organization-user.service';
import { closeVersion } from '@/lib/temporal/temporal-utils';

const mockOrgUser = prisma.organizationUser as unknown as {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
};

describe('OrganizationUser Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseOrgUser = {
    id: 'orguser-1',
    userId: 'user-1',
    organizationId: 'org-1',
    role: 'SUPPORTER' as const,
    anonymousDonor: false,
    showInHighlights: true,
    versionId: 'v-1',
    previousVersionId: null,
    validFrom: new Date('2026-01-01'),
    validTo: MAX_DATE,
    systemFrom: new Date('2026-01-01'),
    systemTo: MAX_DATE,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    changedBy: 'user-admin',
  };

  // ────────────────────────────────────────────────────────────
  // createOrganizationUser
  // ────────────────────────────────────────────────────────────
  describe('createOrganizationUser', () => {
    it('should create a membership with temporal fields', async () => {
      mockOrgUser.create.mockResolvedValue(baseOrgUser);

      const result = await createOrganizationUser({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'SUPPORTER',
        createdByUserId: 'user-admin',
      });

      expect(result).toEqual(baseOrgUser);
      expect(mockOrgUser.create).toHaveBeenCalledTimes(1);

      const callData = mockOrgUser.create.mock.calls[0][0].data;
      expect(callData.userId).toBe('user-1');
      expect(callData.organizationId).toBe('org-1');
      expect(callData.role).toBe('SUPPORTER');
      expect(callData.changedBy).toBe('user-admin');
      // Temporal fields
      expect(callData.validTo).toEqual(MAX_DATE);
      expect(callData.systemTo).toEqual(MAX_DATE);
      expect(callData.isDeleted).toBe(false);
      expect(callData.previousVersionId).toBeNull();
      expect(callData.versionId).toBeDefined();
    });

    it('should default role to SUPPORTER when not provided', async () => {
      mockOrgUser.create.mockResolvedValue(baseOrgUser);

      await createOrganizationUser({
        userId: 'user-1',
        organizationId: 'org-1',
        createdByUserId: 'user-admin',
      });

      const callData = mockOrgUser.create.mock.calls[0][0].data;
      expect(callData.role).toBe('SUPPORTER');
    });

    it('should default anonymousDonor to false and showInHighlights to true', async () => {
      mockOrgUser.create.mockResolvedValue(baseOrgUser);

      await createOrganizationUser({
        userId: 'user-1',
        organizationId: 'org-1',
        createdByUserId: 'user-admin',
      });

      const callData = mockOrgUser.create.mock.calls[0][0].data;
      expect(callData.anonymousDonor).toBe(false);
      expect(callData.showInHighlights).toBe(true);
    });

    it('should respect explicit anonymousDonor and showInHighlights values', async () => {
      mockOrgUser.create.mockResolvedValue({
        ...baseOrgUser,
        anonymousDonor: true,
        showInHighlights: false,
      });

      await createOrganizationUser({
        userId: 'user-1',
        organizationId: 'org-1',
        anonymousDonor: true,
        showInHighlights: false,
        createdByUserId: 'user-admin',
      });

      const callData = mockOrgUser.create.mock.calls[0][0].data;
      expect(callData.anonymousDonor).toBe(true);
      expect(callData.showInHighlights).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // findOrganizationUserByUserAndOrg
  // ────────────────────────────────────────────────────────────
  describe('findOrganizationUserByUserAndOrg', () => {
    it('should find membership by userId and organizationId', async () => {
      mockOrgUser.findFirst.mockResolvedValue(baseOrgUser);

      const result = await findOrganizationUserByUserAndOrg('user-1', 'org-1');

      expect(result).toEqual(baseOrgUser);
      expect(mockOrgUser.findFirst).toHaveBeenCalledWith({
        where: buildCurrentVersionWhere({
          userId: 'user-1',
          organizationId: 'org-1',
        }),
      });
    });

    it('should return null when no membership exists', async () => {
      mockOrgUser.findFirst.mockResolvedValue(null);

      const result = await findOrganizationUserByUserAndOrg('user-999', 'org-1');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────
  // findUsersForOrganization
  // ────────────────────────────────────────────────────────────
  describe('findUsersForOrganization', () => {
    it('should return all current users for an organization', async () => {
      const users = [
        baseOrgUser,
        { ...baseOrgUser, id: 'orguser-2', userId: 'user-2', versionId: 'v-2' },
      ];
      mockOrgUser.findMany.mockResolvedValue(users);

      const result = await findUsersForOrganization('org-1');

      expect(result).toHaveLength(2);
      expect(mockOrgUser.findMany).toHaveBeenCalledWith({
        where: buildCurrentVersionWhere({ organizationId: 'org-1' }),
      });
    });

    it('should return empty array when organization has no users', async () => {
      mockOrgUser.findMany.mockResolvedValue([]);

      const result = await findUsersForOrganization('org-empty');

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────
  // updateUserRole
  // ────────────────────────────────────────────────────────────
  describe('updateUserRole', () => {
    it('should close old version and create new version with updated role', async () => {
      // First call: findOrganizationUserByUserAndOrg (direct prisma.findFirst)
      // Second call: orgUserRepo.update -> findCurrentById (findFirst)
      mockOrgUser.findFirst
        .mockResolvedValueOnce(baseOrgUser)   // findOrganizationUserByUserAndOrg
        .mockResolvedValueOnce(baseOrgUser);  // orgUserRepo.findCurrentById inside update

      const updatedOrgUser = {
        ...baseOrgUser,
        role: 'ORG_ADMIN',
        versionId: 'v-2',
        previousVersionId: 'v-1',
      };
      mockOrgUser.create.mockResolvedValue(updatedOrgUser);

      const result = await updateUserRole('user-1', 'org-1', 'ORG_ADMIN' as any, 'user-admin');

      expect(result.role).toBe('ORG_ADMIN');
      expect(result.previousVersionId).toBe('v-1');

      // closeVersion should have been called to close the old version
      expect(closeVersion).toHaveBeenCalledWith(
        expect.anything(),
        'v-1',
        expect.any(Date),
        'organizationUser'
      );

      // New version should be created
      expect(mockOrgUser.create).toHaveBeenCalledTimes(1);
      const createData = mockOrgUser.create.mock.calls[0][0].data;
      expect(createData.role).toBe('ORG_ADMIN');
      expect(createData.id).toBe('orguser-1');
      expect(createData.previousVersionId).toBe('v-1');
      expect(createData.validTo).toEqual(MAX_DATE);
      expect(createData.changedBy).toBe('user-admin');
    });

    it('should throw when organization user not found', async () => {
      mockOrgUser.findFirst.mockResolvedValue(null);

      await expect(
        updateUserRole('user-999', 'org-1', 'ORG_ADMIN' as any, 'user-admin')
      ).rejects.toThrow('Organization user not found');

      expect(mockOrgUser.create).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // removeUserFromOrganization
  // ────────────────────────────────────────────────────────────
  describe('removeUserFromOrganization', () => {
    it('should soft-delete the membership', async () => {
      // findOrganizationUserByUserAndOrg
      mockOrgUser.findFirst
        .mockResolvedValueOnce(baseOrgUser)   // findOrganizationUserByUserAndOrg
        .mockResolvedValueOnce(baseOrgUser)   // orgUserRepo.softDelete -> findCurrentById
        .mockResolvedValueOnce({              // orgUserRepo.softDelete -> return updated record
          ...baseOrgUser,
          isDeleted: true,
          deletedAt: expect.any(Date),
          deletedBy: 'user-admin',
        });

      mockOrgUser.updateMany.mockResolvedValue({ count: 1 });

      const result = await removeUserFromOrganization('user-1', 'org-1', 'user-admin');

      expect(result.isDeleted).toBe(true);

      // updateMany should have been called to mark as deleted
      expect(mockOrgUser.updateMany).toHaveBeenCalledWith({
        where: {
          versionId: 'v-1',
          systemTo: MAX_DATE,
        },
        data: {
          validTo: expect.any(Date),
          systemTo: expect.any(Date),
          isDeleted: true,
          deletedAt: expect.any(Date),
          deletedBy: 'user-admin',
        },
      });
    });

    it('should throw when organization user not found', async () => {
      mockOrgUser.findFirst.mockResolvedValue(null);

      await expect(
        removeUserFromOrganization('user-999', 'org-1', 'user-admin')
      ).rejects.toThrow('Organization user not found');

      expect(mockOrgUser.updateMany).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // hasRole
  // ────────────────────────────────────────────────────────────
  describe('hasRole', () => {
    it('should return true when user has the specified role', async () => {
      mockOrgUser.findFirst.mockResolvedValue(baseOrgUser);

      const result = await hasRole('user-1', 'org-1', 'SUPPORTER' as any);

      expect(result).toBe(true);
    });

    it('should return false when user has a different role', async () => {
      mockOrgUser.findFirst.mockResolvedValue(baseOrgUser);

      const result = await hasRole('user-1', 'org-1', 'ORG_ADMIN' as any);

      expect(result).toBe(false);
    });

    it('should return false when user is not a member of the organization', async () => {
      mockOrgUser.findFirst.mockResolvedValue(null);

      const result = await hasRole('user-999', 'org-1', 'SUPPORTER' as any);

      expect(result).toBe(false);
    });

    it('should accept an array of roles and return true if user has any', async () => {
      mockOrgUser.findFirst.mockResolvedValue(baseOrgUser);

      const result = await hasRole('user-1', 'org-1', ['ORG_ADMIN', 'SUPPORTER'] as any);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the specified roles', async () => {
      mockOrgUser.findFirst.mockResolvedValue(baseOrgUser);

      const result = await hasRole('user-1', 'org-1', ['ORG_ADMIN', 'TREASURER'] as any);

      expect(result).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // isOrgAdmin
  // ────────────────────────────────────────────────────────────
  describe('isOrgAdmin', () => {
    it('should return true when user is an ORG_ADMIN', async () => {
      mockOrgUser.findFirst.mockResolvedValue({
        ...baseOrgUser,
        role: 'ORG_ADMIN',
      });

      const result = await isOrgAdmin('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false when user is a SUPPORTER', async () => {
      mockOrgUser.findFirst.mockResolvedValue(baseOrgUser);

      const result = await isOrgAdmin('user-1', 'org-1');

      expect(result).toBe(false);
    });

    it('should return false when user is not a member', async () => {
      mockOrgUser.findFirst.mockResolvedValue(null);

      const result = await isOrgAdmin('user-999', 'org-1');

      expect(result).toBe(false);
    });
  });
});

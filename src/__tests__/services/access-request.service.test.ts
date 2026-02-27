/**
 * Unit tests for Access Request Service
 *
 * Tests access request CRUD, auto-approve flow, membership creation,
 * and status lifecycle management. These tests prevent bugs where:
 *   - Duplicate pending requests are created
 *   - Auto-approve skips membership creation
 *   - Status transitions violate business rules
 *   - Contact auto-linking fails during donor membership creation
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    organization: {
      findFirst: jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
    },
    accessRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock temporal utils
jest.mock('@/lib/temporal/temporal-utils', () => ({
  buildCurrentVersionWhere: jest.fn((where: Record<string, unknown>) => ({
    ...where,
    validTo: new Date('9999-12-31'),
  })),
  closeVersion: jest.fn(),
  buildNewVersionData: jest.fn((existing: Record<string, unknown>, updates: Record<string, unknown>) => ({
    ...existing,
    ...updates,
    versionId: 'new-version-id',
  })),
}));

const mockTx = {
  accessRequest: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organizationUser: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  contact: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

import {
  createAccessRequest,
  approveAccessRequest,
  denyAccessRequest,
  getPendingRequests,
  getPendingRequestCount,
  getRequestByUserAndOrg,
} from '@/services/access-request.service';

describe('Access Request Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no contact auto-link scenario
    mockTx.user.findUnique.mockResolvedValue(null);
  });

  describe('createAccessRequest', () => {
    const input = {
      organizationId: 'org-1',
      userId: 'user-1',
      message: 'Please let me in',
    };

    it('should create a pending request for REQUIRE_APPROVAL org', async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: 'org-1',
        donorAccessMode: 'REQUIRE_APPROVAL',
      });
      (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.accessRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const createdRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        userId: 'user-1',
        message: 'Please let me in',
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.accessRequest.create as jest.Mock).mockResolvedValue(createdRequest);

      const result = await createAccessRequest(input);

      expect(result).toEqual(createdRequest);
      expect(result.status).toBe('PENDING');
      expect(prisma.accessRequest.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          message: 'Please let me in',
        },
      });
      // Should NOT use $transaction for REQUIRE_APPROVAL
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should auto-approve and create membership for AUTO_APPROVE org', async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: 'org-1',
        donorAccessMode: 'AUTO_APPROVE',
      });
      (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.accessRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const approvedRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        userId: 'user-1',
        message: 'Please let me in',
        status: 'APPROVED',
        reviewedAt: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTx.accessRequest.create.mockResolvedValue(approvedRequest);
      mockTx.organizationUser.create.mockResolvedValue({});

      const result = await createAccessRequest(input);

      expect(result.status).toBe('APPROVED');
      expect(result.autoApproved).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.accessRequest.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          message: 'Please let me in',
          status: 'APPROVED',
          reviewedAt: expect.any(Date),
        },
      });
      expect(mockTx.organizationUser.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          organizationId: 'org-1',
          role: 'SUPPORTER',
        },
      });
    });

    it('should throw if user already has membership', async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: 'org-1',
        donorAccessMode: 'REQUIRE_APPROVAL',
      });
      (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue({
        id: 'ou-1',
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'SUPPORTER',
      });

      await expect(createAccessRequest(input)).rejects.toThrow(
        'You already have access to this organization'
      );
    });

    it('should throw if pending request already exists', async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: 'org-1',
        donorAccessMode: 'REQUIRE_APPROVAL',
      });
      (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.accessRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'req-existing',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'PENDING',
      });

      await expect(createAccessRequest(input)).rejects.toThrow(
        'You already have a pending access request for this organization'
      );
    });

    it('should allow new request when prior APPROVED/DENIED request exists', async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: 'org-1',
        donorAccessMode: 'REQUIRE_APPROVAL',
      });
      (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue(null);
      // No pending request found (the findFirst filters by status: 'PENDING')
      (prisma.accessRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const createdRequest = {
        id: 'req-2',
        organizationId: 'org-1',
        userId: 'user-1',
        message: 'Trying again',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.accessRequest.create as jest.Mock).mockResolvedValue(createdRequest);

      const result = await createAccessRequest({
        ...input,
        message: 'Trying again',
      });

      expect(result.status).toBe('PENDING');
      expect(result.id).toBe('req-2');
    });

    it('should throw if organization not found', async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(createAccessRequest(input)).rejects.toThrow(
        'Organization not found'
      );
    });
  });

  describe('approveAccessRequest', () => {
    it('should approve pending request and create donor membership', async () => {
      const pendingRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'PENDING',
        message: 'Let me in',
      };
      const approvedRequest = {
        ...pendingRequest,
        status: 'APPROVED',
        reviewedBy: 'admin-1',
        reviewedAt: expect.any(Date),
      };

      mockTx.accessRequest.findUnique.mockResolvedValue(pendingRequest);
      mockTx.accessRequest.update.mockResolvedValue(approvedRequest);
      mockTx.organizationUser.create.mockResolvedValue({});

      const result = await approveAccessRequest('req-1', 'admin-1');

      expect(result.status).toBe('APPROVED');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: 'APPROVED',
          reviewedBy: 'admin-1',
          reviewedAt: expect.any(Date),
        },
      });
      expect(mockTx.organizationUser.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          organizationId: 'org-1',
          role: 'SUPPORTER',
        },
      });
    });

    it('should auto-link contact when user email matches existing contact', async () => {
      const pendingRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'PENDING',
      };

      mockTx.accessRequest.findUnique.mockResolvedValue(pendingRequest);
      mockTx.accessRequest.update.mockResolvedValue({ ...pendingRequest, status: 'APPROVED' });
      mockTx.organizationUser.create.mockResolvedValue({});
      mockTx.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'donor@example.com',
      });
      mockTx.contact.findFirst.mockResolvedValue({
        id: 'contact-1',
        versionId: 'ver-1',
        organizationId: 'org-1',
        email: 'donor@example.com',
        userId: null,
      });
      mockTx.contact.create.mockResolvedValue({});

      await approveAccessRequest('req-1', 'admin-1');

      expect(closeVersion).toHaveBeenCalledWith(
        mockTx.contact,
        'ver-1',
        expect.any(Date),
        'contact'
      );
      expect(buildNewVersionData).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'contact-1' }),
        expect.objectContaining({ userId: 'user-1' }),
        expect.any(Date)
      );
      expect(mockTx.contact.create).toHaveBeenCalled();
    });

    it('should throw on already-approved request', async () => {
      mockTx.accessRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
      });

      await expect(approveAccessRequest('req-1', 'admin-1')).rejects.toThrow(
        'Cannot approve a request with status APPROVED'
      );
    });

    it('should throw if request not found', async () => {
      mockTx.accessRequest.findUnique.mockResolvedValue(null);

      await expect(approveAccessRequest('nonexistent', 'admin-1')).rejects.toThrow(
        'Access request not found'
      );
    });
  });

  describe('denyAccessRequest', () => {
    it('should deny a pending request', async () => {
      const pendingRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'PENDING',
      };
      const deniedRequest = {
        ...pendingRequest,
        status: 'DENIED',
        reviewedBy: 'admin-1',
        reviewedAt: expect.any(Date),
      };

      (prisma.accessRequest.findUnique as jest.Mock).mockResolvedValue(pendingRequest);
      (prisma.accessRequest.update as jest.Mock).mockResolvedValue(deniedRequest);

      const result = await denyAccessRequest('req-1', 'admin-1');

      expect(result.status).toBe('DENIED');
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: 'DENIED',
          reviewedBy: 'admin-1',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('should throw on non-pending request', async () => {
      (prisma.accessRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
      });

      await expect(denyAccessRequest('req-1', 'admin-1')).rejects.toThrow(
        'Cannot deny a request with status APPROVED'
      );
    });

    it('should throw if request not found', async () => {
      (prisma.accessRequest.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(denyAccessRequest('nonexistent', 'admin-1')).rejects.toThrow(
        'Access request not found'
      );
    });
  });

  describe('getPendingRequests', () => {
    it('should return pending requests with user info', async () => {
      const pendingRequests = [
        {
          id: 'req-1',
          organizationId: 'org-1',
          userId: 'user-1',
          status: 'PENDING',
          message: 'Request 1',
          createdAt: new Date('2026-01-15'),
          user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
        },
        {
          id: 'req-2',
          organizationId: 'org-1',
          userId: 'user-2',
          status: 'PENDING',
          message: 'Request 2',
          createdAt: new Date('2026-01-16'),
          user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
        },
      ];
      (prisma.accessRequest.findMany as jest.Mock).mockResolvedValue(pendingRequests);

      const result = await getPendingRequests('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].user).toEqual({ id: 'user-1', name: 'Alice', email: 'alice@example.com' });
      expect(result[1].user).toEqual({ id: 'user-2', name: 'Bob', email: 'bob@example.com' });
      expect(prisma.accessRequest.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', status: 'PENDING' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no pending requests', async () => {
      (prisma.accessRequest.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getPendingRequests('org-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getPendingRequestCount', () => {
    it('should return correct count', async () => {
      (prisma.accessRequest.count as jest.Mock).mockResolvedValue(5);

      const result = await getPendingRequestCount('org-1');

      expect(result).toBe(5);
      expect(prisma.accessRequest.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', status: 'PENDING' },
      });
    });

    it('should return 0 when no pending requests', async () => {
      (prisma.accessRequest.count as jest.Mock).mockResolvedValue(0);

      const result = await getPendingRequestCount('org-1');

      expect(result).toBe(0);
    });
  });

  describe('getRequestByUserAndOrg', () => {
    it('should return the most recent request', async () => {
      const request = {
        id: 'req-2',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'DENIED',
        createdAt: new Date('2026-01-16'),
      };
      (prisma.accessRequest.findFirst as jest.Mock).mockResolvedValue(request);

      const result = await getRequestByUserAndOrg('org-1', 'user-1');

      expect(result).toEqual(request);
      expect(prisma.accessRequest.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return null when no request exists', async () => {
      (prisma.accessRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getRequestByUserAndOrg('org-1', 'user-1');

      expect(result).toBeNull();
    });
  });
});

/**
 * Unit tests for Contact Service
 *
 * Tests contact CRUD, temporal versioning, field persistence on updates,
 * user linking/unlinking, soft deletion, filtering, and pagination.
 */

import { prisma } from '@/lib/prisma';
import { MAX_DATE, buildCurrentVersionWhere, closeVersion } from '@/lib/temporal/temporal-utils';

const mockTx = {
  contact: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    contact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Mock temporal utils — keep real buildCurrentVersionWhere for assertion readability
jest.mock('@/lib/temporal/temporal-utils', () => {
  const actual = jest.requireActual('@/lib/temporal/temporal-utils');
  return {
    ...actual,
    closeVersion: jest.fn().mockResolvedValue(undefined),
  };
});

import {
  createContact,
  updateContact,
  getContact,
  listContacts,
  deleteContact,
  linkContactToUser,
  unlinkContactFromUser,
} from '@/services/contact.service';

describe('Contact Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // createContact
  // ---------------------------------------------------------------
  describe('createContact', () => {
    it('should create a contact with all provided fields', async () => {
      const input = {
        organizationId: 'org-1',
        name: 'Jane Donor',
        type: 'INDIVIDUAL' as const,
        roles: ['DONOR' as const],
        email: 'jane@example.com',
        phone: '555-1234',
        address: '123 Main St',
        notes: 'Major donor',
        userId: 'user-1',
        createdBy: 'admin-1',
      };

      const created = { id: 'contact-1', ...input };
      (prisma.contact.create as jest.Mock).mockResolvedValue(created);

      const result = await createContact(input);

      expect(result).toEqual(created);
      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          name: 'Jane Donor',
          type: 'INDIVIDUAL',
          roles: ['DONOR'],
          email: 'jane@example.com',
          phone: '555-1234',
          address: '123 Main St',
          notes: 'Major donor',
          userId: 'user-1',
          isActive: true,
          isDeleted: false,
          validTo: MAX_DATE,
          systemTo: MAX_DATE,
          changedBy: 'admin-1',
        }),
      });
    });

    it('should default optional fields to null and type to INDIVIDUAL', async () => {
      const input = {
        organizationId: 'org-1',
        name: 'Minimal Contact',
        roles: ['VENDOR' as const],
      };

      (prisma.contact.create as jest.Mock).mockResolvedValue({ id: 'c-2', ...input });

      await createContact(input);

      const data = (prisma.contact.create as jest.Mock).mock.calls[0][0].data;
      expect(data.type).toBe('INDIVIDUAL');
      expect(data.email).toBeNull();
      expect(data.phone).toBeNull();
      expect(data.address).toBeNull();
      expect(data.notes).toBeNull();
      expect(data.userId).toBeNull();
      expect(data.changedBy).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // updateContact
  // ---------------------------------------------------------------
  describe('updateContact', () => {
    const currentContact = {
      id: 'contact-1',
      organizationId: 'org-1',
      versionId: 'v-old',
      name: 'Old Name',
      type: 'INDIVIDUAL',
      roles: ['DONOR'],
      email: 'old@example.com',
      phone: '555-0000',
      address: '1 Old St',
      notes: 'Old note',
      userId: null,
      isActive: true,
    };

    beforeEach(() => {
      mockTx.contact.findFirst.mockResolvedValue(currentContact);
      mockTx.contact.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...currentContact, ...data })
      );
    });

    it('should close old version and create new version', async () => {
      await updateContact('contact-1', 'org-1', { name: 'New Name' }, 'user-1');

      expect(closeVersion).toHaveBeenCalledWith(
        mockTx.contact,
        'v-old',
        expect.any(Date),
        'Contact'
      );
      expect(mockTx.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should persist name changes', async () => {
      await updateContact('contact-1', 'org-1', { name: 'New Name' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'New Name' }),
      });
    });

    it('should persist type changes', async () => {
      await updateContact('contact-1', 'org-1', { type: 'ORGANIZATION' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'ORGANIZATION' }),
      });
    });

    it('should persist roles changes', async () => {
      await updateContact('contact-1', 'org-1', { roles: ['VENDOR'] }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ roles: ['VENDOR'] }),
      });
    });

    it('should persist email changes', async () => {
      await updateContact('contact-1', 'org-1', { email: 'new@example.com' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'new@example.com' }),
      });
    });

    it('should persist email as null to clear it', async () => {
      await updateContact('contact-1', 'org-1', { email: null }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: null }),
      });
    });

    it('should persist phone changes', async () => {
      await updateContact('contact-1', 'org-1', { phone: '555-9999' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ phone: '555-9999' }),
      });
    });

    it('should persist address changes', async () => {
      await updateContact('contact-1', 'org-1', { address: '99 New Ave' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ address: '99 New Ave' }),
      });
    });

    it('should persist notes changes', async () => {
      await updateContact('contact-1', 'org-1', { notes: 'Updated note' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ notes: 'Updated note' }),
      });
    });

    it('should persist isActive changes', async () => {
      await updateContact('contact-1', 'org-1', { isActive: false }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: false }),
      });
    });

    it('should persist userId changes', async () => {
      await updateContact('contact-1', 'org-1', { userId: 'user-linked' }, 'user-1');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-linked' }),
      });
    });

    it('should keep unchanged fields from current version', async () => {
      await updateContact('contact-1', 'org-1', { name: 'Only Name' }, 'user-1');

      const data = mockTx.contact.create.mock.calls[0][0].data;
      // Unchanged fields retain their old values
      expect(data.email).toBe('old@example.com');
      expect(data.phone).toBe('555-0000');
      expect(data.address).toBe('1 Old St');
      expect(data.notes).toBe('Old note');
      expect(data.roles).toEqual(['DONOR']);
      expect(data.type).toBe('INDIVIDUAL');
    });

    it('should set changedBy to userId', async () => {
      await updateContact('contact-1', 'org-1', { name: 'X' }, 'admin-99');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: 'admin-99' }),
      });
    });

    it('should set changeReason when provided', async () => {
      await updateContact('contact-1', 'org-1', { name: 'X' }, 'user-1', 'Corrected typo');

      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changeReason: 'Corrected typo' }),
      });
    });

    it('should preserve stable entity id across versions', async () => {
      await updateContact('contact-1', 'org-1', { name: 'X' }, 'user-1');

      const data = mockTx.contact.create.mock.calls[0][0].data;
      expect(data.id).toBe('contact-1');
      expect(data.previousVersionId).toBe('v-old');
    });

    it('should throw when contact not found', async () => {
      mockTx.contact.findFirst.mockResolvedValue(null);

      await expect(
        updateContact('nonexistent', 'org-1', { name: 'X' }, 'user-1')
      ).rejects.toThrow('Contact not found');
    });
  });

  // ---------------------------------------------------------------
  // getContact
  // ---------------------------------------------------------------
  describe('getContact', () => {
    it('should return current version of contact', async () => {
      const contact = { id: 'contact-1', name: 'Acme' };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);

      const result = await getContact('contact-1', 'org-1');

      expect(result).toEqual(contact);
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: buildCurrentVersionWhere({ id: 'contact-1', organizationId: 'org-1' }),
      });
    });

    it('should return null when contact not found', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getContact('nonexistent', 'org-1');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // listContacts
  // ---------------------------------------------------------------
  describe('listContacts', () => {
    it('should return contacts and totalCount', async () => {
      const contacts = [{ id: 'c-1', name: 'Alice' }];
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(contacts);
      (prisma.contact.count as jest.Mock).mockResolvedValue(1);

      const result = await listContacts('org-1');

      expect(result).toEqual({ contacts, totalCount: 1 });
    });

    it('should apply role filter', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);

      await listContacts('org-1', { role: 'DONOR' });

      const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where).toEqual(
        expect.objectContaining({ roles: { has: 'DONOR' } })
      );
    });

    it('should apply search filter to name and email', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);

      await listContacts('org-1', { search: 'acme' });

      const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { name: { contains: 'acme', mode: 'insensitive' } },
        { email: { contains: 'acme', mode: 'insensitive' } },
      ]);
    });

    it('should apply isActive filter', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);

      await listContacts('org-1', { isActive: true });

      const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where).toEqual(
        expect.objectContaining({ isActive: true })
      );
    });

    it('should paginate with default limit 50', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);

      await listContacts('org-1');

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 })
      );
    });

    it('should paginate with custom page and limit', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(100);

      await listContacts('org-1', { page: 3, limit: 10 });

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });

    it('should order by name ascending', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);

      await listContacts('org-1');

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } })
      );
    });
  });

  // ---------------------------------------------------------------
  // deleteContact
  // ---------------------------------------------------------------
  describe('deleteContact', () => {
    it('should soft-delete contact by setting isDeleted', async () => {
      const contact = { id: 'contact-1', versionId: 'v-1' };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.contact.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await deleteContact('contact-1', 'org-1', 'user-1');

      expect(prisma.contact.updateMany).toHaveBeenCalledWith({
        where: {
          versionId: 'v-1',
          systemTo: MAX_DATE,
        },
        data: expect.objectContaining({
          isDeleted: true,
          deletedBy: 'user-1',
          validTo: expect.any(Date),
          systemTo: expect.any(Date),
          deletedAt: expect.any(Date),
        }),
      });
    });

    it('should throw when contact not found', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        deleteContact('nonexistent', 'org-1', 'user-1')
      ).rejects.toThrow('Contact not found');
    });

    it('should throw ConcurrentModificationError when version already closed', async () => {
      const contact = { id: 'contact-1', versionId: 'v-1' };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.contact.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        deleteContact('contact-1', 'org-1', 'user-1')
      ).rejects.toThrow(/Concurrent modification detected/);
    });
  });

  // ---------------------------------------------------------------
  // linkContactToUser
  // ---------------------------------------------------------------
  describe('linkContactToUser', () => {
    it('should link contact to user via updateContact', async () => {
      // No existing link for this user
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);

      // updateContact will run inside $transaction
      mockTx.contact.findFirst.mockResolvedValue({
        id: 'contact-1',
        organizationId: 'org-1',
        versionId: 'v-1',
        name: 'Jane',
        type: 'INDIVIDUAL',
        roles: ['DONOR'],
        email: null,
        phone: null,
        address: null,
        notes: null,
        userId: null,
        isActive: true,
      });
      const linked = { id: 'contact-1', userId: 'user-1' };
      mockTx.contact.create.mockResolvedValue(linked);

      const result = await linkContactToUser('org-1', 'contact-1', 'user-1', 'admin-1');

      expect(result).toEqual(linked);
    });

    it('should return existing contact if already linked to same contact', async () => {
      const existing = { id: 'contact-1', name: 'Jane', userId: 'user-1' };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await linkContactToUser('org-1', 'contact-1', 'user-1', 'admin-1');

      expect(result).toEqual(existing);
      // Should NOT call updateContact
      expect(mockTx.contact.create).not.toHaveBeenCalled();
    });

    it('should throw if user already linked to a different contact', async () => {
      const otherContact = { id: 'contact-other', name: 'Other Person', userId: 'user-1' };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(otherContact);

      await expect(
        linkContactToUser('org-1', 'contact-1', 'user-1', 'admin-1')
      ).rejects.toThrow('User is already linked to contact "Other Person" in this organization');
    });
  });

  // ---------------------------------------------------------------
  // unlinkContactFromUser
  // ---------------------------------------------------------------
  describe('unlinkContactFromUser', () => {
    it('should set userId to null via updateContact', async () => {
      mockTx.contact.findFirst.mockResolvedValue({
        id: 'contact-1',
        organizationId: 'org-1',
        versionId: 'v-1',
        name: 'Jane',
        type: 'INDIVIDUAL',
        roles: ['DONOR'],
        email: null,
        phone: null,
        address: null,
        notes: null,
        userId: 'user-1',
        isActive: true,
      });
      const unlinked = { id: 'contact-1', userId: null };
      mockTx.contact.create.mockResolvedValue(unlinked);

      const result = await unlinkContactFromUser('org-1', 'contact-1', 'admin-1');

      expect(result).toEqual(unlinked);
      expect(mockTx.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          changeReason: 'Unlinked from platform user',
        }),
      });
    });

    it('should throw when contact not found', async () => {
      mockTx.contact.findFirst.mockResolvedValue(null);

      await expect(
        unlinkContactFromUser('org-1', 'nonexistent', 'admin-1')
      ).rejects.toThrow('Contact not found');
    });
  });
});

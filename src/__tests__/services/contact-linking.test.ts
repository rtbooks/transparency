/**
 * Unit tests for Contact Service — user-contact linking
 *
 * Tests the new linking functions: findOrCreateForUser with custom roles,
 * linkContactToUser duplicate prevention, unlinkContactFromUser, getContactForUser.
 */

import { prisma } from '@/lib/prisma';
import { MAX_DATE, buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const mockTx = {
  contact: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('@/lib/temporal/temporal-utils', () => ({
  MAX_DATE: new Date('9999-12-31T23:59:59.999Z'),
  buildCurrentVersionWhere: jest.fn((filters) => ({
    validTo: new Date('9999-12-31T23:59:59.999Z'),
    systemTo: new Date('9999-12-31T23:59:59.999Z'),
    isDeleted: false,
    ...filters,
  })),
  closeVersion: jest.fn().mockResolvedValue({ count: 1 }),
}));

import {
  findOrCreateForUser,
  getContactForUser,
  linkContactToUser,
  unlinkContactFromUser,
} from '@/services/contact.service';

beforeEach(() => {
  jest.clearAllMocks();
});

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const CONTACT_ID = 'contact-1';

function makeContact(overrides = {}) {
  return {
    id: CONTACT_ID,
    versionId: 'v-1',
    organizationId: ORG_ID,
    userId: USER_ID,
    name: 'John Doe',
    email: 'john@example.com',
    type: 'INDIVIDUAL',
    roles: ['DONOR'],
    isActive: true,
    validFrom: new Date(),
    validTo: MAX_DATE,
    systemFrom: new Date(),
    systemTo: MAX_DATE,
    isDeleted: false,
    ...overrides,
  };
}

describe('findOrCreateForUser', () => {
  it('returns existing contact when one is linked to the user', async () => {
    const existing = makeContact();
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(existing);

    const result = await findOrCreateForUser(ORG_ID, USER_ID, 'John Doe', 'john@example.com');

    expect(result).toBe(existing);
    expect(prisma.contact.create).not.toHaveBeenCalled();
  });

  it('creates a new contact with default DONOR role when none exists', async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    const newContact = makeContact();
    (prisma.contact.create as jest.Mock).mockResolvedValue(newContact);

    await findOrCreateForUser(ORG_ID, USER_ID, 'John Doe', 'john@example.com');

    const createArgs = (prisma.contact.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.roles).toEqual(['DONOR']);
    expect(createArgs.data.userId).toBe(USER_ID);
  });

  it('creates a new contact with custom roles when provided', async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.contact.create as jest.Mock).mockResolvedValue(makeContact({ roles: ['VENDOR'] }));

    await findOrCreateForUser(ORG_ID, USER_ID, 'John Doe', 'john@example.com', ['VENDOR']);

    const createArgs = (prisma.contact.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.roles).toEqual(['VENDOR']);
  });

  it('creates contact with both DONOR and VENDOR roles', async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.contact.create as jest.Mock).mockResolvedValue(
      makeContact({ roles: ['DONOR', 'VENDOR'] })
    );

    await findOrCreateForUser(ORG_ID, USER_ID, 'John Doe', undefined, ['DONOR', 'VENDOR']);

    const createArgs = (prisma.contact.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.roles).toEqual(['DONOR', 'VENDOR']);
    expect(createArgs.data.email).toBeNull();
  });
});

describe('getContactForUser', () => {
  it('returns the user linked contact', async () => {
    const contact = makeContact();
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);

    const result = await getContactForUser(ORG_ID, USER_ID);

    expect(result).toBe(contact);
    expect(buildCurrentVersionWhere).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: USER_ID,
    });
  });

  it('returns null when user has no linked contact', async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getContactForUser(ORG_ID, USER_ID);

    expect(result).toBeNull();
  });
});

describe('linkContactToUser', () => {
  it('throws error when user already has a different linked contact', async () => {
    const existingOther = makeContact({ id: 'other-contact', name: 'Jane Doe' });
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(existingOther);

    await expect(
      linkContactToUser(ORG_ID, CONTACT_ID, USER_ID, 'admin-1')
    ).rejects.toThrow('already linked to contact "Jane Doe"');
  });

  it('returns existing contact when already linked to the same contact', async () => {
    const existing = makeContact();
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(existing);

    const result = await linkContactToUser(ORG_ID, CONTACT_ID, USER_ID, 'admin-1');

    expect(result).toBe(existing);
  });

  it('calls updateContact when linking a new user to a contact', async () => {
    // First call: check for existing link — none
    (prisma.contact.findFirst as jest.Mock).mockResolvedValueOnce(null);

    // updateContact uses $transaction internally; mock the chain
    const updatedContact = makeContact({ userId: USER_ID });
    (mockTx.contact.findFirst as jest.Mock).mockResolvedValue(makeContact({ userId: null }));
    (mockTx.contact.create as jest.Mock).mockResolvedValue(updatedContact);

    const result = await linkContactToUser(ORG_ID, CONTACT_ID, USER_ID, 'admin-1');

    expect(result.userId).toBe(USER_ID);
  });
});

describe('unlinkContactFromUser', () => {
  it('calls updateContact with userId: null', async () => {
    const unlinked = makeContact({ userId: null });
    (mockTx.contact.findFirst as jest.Mock).mockResolvedValue(makeContact());
    (mockTx.contact.create as jest.Mock).mockResolvedValue(unlinked);

    const result = await unlinkContactFromUser(ORG_ID, CONTACT_ID, 'admin-1');

    // The new version should have userId set to null
    const createArgs = (mockTx.contact.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.userId).toBeNull();
  });
});

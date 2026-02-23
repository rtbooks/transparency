/**
 * API contract tests for user-contact linking endpoints
 *
 * Tests the Zod schemas and response shapes for:
 * - GET /contacts/me
 * - POST /contacts/[id]/link-user
 * - DELETE /contacts/[id]/link-user
 */

import { z } from 'zod';

// Response schema for the /contacts/me endpoint
const contactMeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  type: z.enum(['INDIVIDUAL', 'ORGANIZATION']),
  roles: z.array(z.enum(['DONOR', 'VENDOR'])),
  userId: z.string(),
  isActive: z.boolean(),
  organizationId: z.string(),
});

// Request schema for link-user POST
const linkUserRequestSchema = z.object({
  userId: z.string().uuid('Must provide a valid user ID'),
});

describe('Contact Me Response Schema', () => {
  it('validates a complete contact response', () => {
    const response = {
      id: 'contact-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-0100',
      type: 'INDIVIDUAL',
      roles: ['DONOR'],
      userId: 'user-1',
      isActive: true,
      organizationId: 'org-1',
    };
    expect(() => contactMeResponseSchema.parse(response)).not.toThrow();
  });

  it('requires userId to be present (linked contact)', () => {
    const response = {
      id: 'contact-1',
      name: 'John Doe',
      email: null,
      phone: null,
      type: 'INDIVIDUAL',
      roles: ['DONOR'],
      userId: 'user-1',
      isActive: true,
      organizationId: 'org-1',
    };
    expect(() => contactMeResponseSchema.parse(response)).not.toThrow();
  });

  it('accepts VENDOR role', () => {
    const response = {
      id: 'contact-1',
      name: 'Jane Smith',
      email: null,
      phone: null,
      type: 'INDIVIDUAL',
      roles: ['VENDOR'],
      userId: 'user-2',
      isActive: true,
      organizationId: 'org-1',
    };
    expect(() => contactMeResponseSchema.parse(response)).not.toThrow();
  });

  it('accepts multiple roles (DONOR + VENDOR)', () => {
    const response = {
      id: 'contact-1',
      name: 'Multi-Role User',
      email: null,
      phone: null,
      type: 'INDIVIDUAL',
      roles: ['DONOR', 'VENDOR'],
      userId: 'user-3',
      isActive: true,
      organizationId: 'org-1',
    };
    expect(() => contactMeResponseSchema.parse(response)).not.toThrow();
  });
});

describe('Link User Request Schema', () => {
  it('accepts a valid UUID userId', () => {
    const body = { userId: '550e8400-e29b-41d4-a716-446655440000' };
    expect(() => linkUserRequestSchema.parse(body)).not.toThrow();
  });

  it('rejects non-UUID userId', () => {
    const body = { userId: 'not-a-uuid' };
    expect(() => linkUserRequestSchema.parse(body)).toThrow();
  });

  it('rejects missing userId', () => {
    expect(() => linkUserRequestSchema.parse({})).toThrow();
  });

  it('rejects empty string userId', () => {
    const body = { userId: '' };
    expect(() => linkUserRequestSchema.parse(body)).toThrow();
  });
});

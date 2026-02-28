---
name: Test development
description: Develop the right tests when adding features or changing the data model to ensure stability and catch issues early.
tags:
  - testing
  - test development
  - zod
  - jest
---

**⚠️ Every new feature or model change MUST include tests. Do not consider a feature complete without them.**

Tests live in `src/__tests__/` mirroring the source structure. Run with `npx jest`.

### 1. API Contract Tests (`src/__tests__/api/`)

Define a Zod schema representing the exact response shape the UI component expects. This catches field omissions before they reach production.

```typescript
// Define what the UI needs — if the API stops returning a field, this fails
const BillDetailResponseSchema = z.object({
  id: z.string(),
  contact: z.object({ id: z.string(), name: z.string() }).nullable(), // nullable, NOT optional
  fundingAccountId: z.string().nullable(),
  // ... every field the UI reads
});

it('should validate response with all required fields', () => {/yolo

  const result = BillDetailResponseSchema.safeParse(mockResponse);
  expect(result.success).toBe(true);
});

it('should FAIL if contact field is missing', () => {
  const { contact, ...incomplete } = mockResponse;
  expect(BillDetailResponseSchema.safeParse(incomplete).success).toBe(false);
});
```

**For PATCH/PUT endpoints**, also validate the request schema accepts every field the form sends:

```typescript
it('should accept issueDate update', () => {
  expect(UpdateSchema.safeParse({ issueDate: '2026-03-01' }).success).toBe(true);
});

it('should accept null fundingAccountId to clear it', () => {
  expect(UpdateSchema.safeParse({ fundingAccountId: null }).success).toBe(true);
});
```

### 2. Service Field-Persistence Tests (`src/__tests__/services/`)

For every updatable field on a model, write a test that the update function actually persists it. This is the #1 way to catch "added field to schema but forgot to wire it into the update function."

```typescript
it('should persist issueDate changes', async () => {
  await updateBill('bill-1', 'org-1', { issueDate: new Date('2026-03-01') });

  expect(mockTx.bill.update).toHaveBeenCalledWith({
    where: { id: 'bill-1' },
    data: expect.objectContaining({ issueDate: expect.any(Date) }),
  });
});

it('should NOT include fields that were not provided', async () => {
  await updateBill('bill-1', 'org-1', { description: 'Only this' });
  const callData = mockTx.bill.update.mock.calls[0][0].data;
  expect(callData).not.toHaveProperty('issueDate');
  expect(callData).not.toHaveProperty('fundingAccountId');
});
```

### 3. Bitemporal Entity Resolution Tests

Any service function that returns data with related bitemporal entities (Contact, Account, Transaction) MUST have a test confirming the lookup works. The pattern:

```typescript
it('should resolve contact from bitemporal storage', async () => {
  (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
    id: 'contact-1', name: 'Acme Corp', email: 'test@acme.com',
  });

  const result = await getBill('bill-1', 'org-1');

  expect(result.contact).toEqual({ id: 'contact-1', name: 'Acme Corp', email: 'test@acme.com' });
  expect(prisma.contact.findFirst).toHaveBeenCalledWith({
    where: buildCurrentVersionWhere({ id: 'contact-1' }),
    select: { id: true, name: true, email: true },
  });
});
```

### 4. Active/Inactive Filtering

Any query that returns accounts for use in UI dropdowns or pickers MUST filter by `isActive: true`. The only exception is the Chart of Accounts page when the admin explicitly enables "Show inactive."

```typescript
// ✅ Correct: for form dropdowns, always filter active
where: buildCurrentVersionWhere({ organizationId, isActive: true })

// ✅ Correct: service function for dropdowns
export async function findActiveAccounts(orgId: string) {
  return prisma.account.findMany({
    where: buildCurrentVersionWhere({ organizationId: orgId, isActive: true }),
  });
}

// ❌ Wrong: using buildCurrentVersionWhere without isActive for a dropdown
where: buildCurrentVersionWhere({ organizationId })  // includes deactivated accounts!
```

### Checklist Before Completing a Feature

- [ ] **Service tests exist** for every new or modified service function
- [ ] **Every updatable field** has a persistence test in the service test file
- [ ] **API contract test** validates the response schema matches what the UI reads
- [ ] **PATCH/PUT schema test** confirms every field the edit form sends is accepted
- [ ] **Bitemporal lookups** for related entities are tested (contact, account, transaction)
- [ ] **All existing tests still pass** (`npx jest`)
- [ ] **TypeScript compiles** (`npm run type-check`)

### Existing Test Examples to Follow

| Test Type          | Example File                                                   |
| ------------------ | -------------------------------------------------------------- |
| Service unit tests | `src/__tests__/services/bill.service.test.ts`                  |
| API contract tests | `src/__tests__/api/bills-api-contract.test.ts`                 |
| Integration tests  | `src/__tests__/integration/double-entry-integrity.test.ts`     |
| Library unit tests | `src/__tests__/lib/temporal/temporal-utils.test.ts`            |
| Component tests    | `src/__tests__/components/dashboard/DashboardSummary.test.tsx` |

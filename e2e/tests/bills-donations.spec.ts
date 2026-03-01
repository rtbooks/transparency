import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Bills Page', () => {
  test('Bills page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/bills`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /bills/i });
    await expect(heading).toBeVisible();
  });

  test('Create Bill button is visible', async ({ page }) => {
    await page.goto(`/org/${slug}/bills`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /create bill|new bill|add bill/i });
    await expect(addBtn).toBeVisible();
  });

  test('Create Bill dialog opens with form fields', async ({ page }) => {
    await page.goto(`/org/${slug}/bills`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /create bill|new bill|add bill/i });
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Should have key fields: vendor/contact, amount, due date
    await expect(dialog.getByText(/vendor|contact|payee/i).first()).toBeVisible();
    await expect(dialog.getByText(/amount/i).first()).toBeVisible();

    // Cancel
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Donations Page', () => {
  test('Donations page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/donations`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /donations overview/i });
    await expect(heading).toBeVisible();
  });

  test('Donations overview shows summary stats', async ({ page }) => {
    await page.goto(`/org/${slug}/donations`);
    await page.waitForLoadState('load');

    // Should show donation stats sections
    await expect(page.getByText('Donors')).toBeVisible();
    await expect(page.getByText('Total Pledged')).toBeVisible();
    await expect(page.getByText('Total Received')).toBeVisible();
  });
});

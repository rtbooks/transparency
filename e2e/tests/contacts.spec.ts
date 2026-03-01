import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Contacts Page', () => {
  test('Contacts page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/contacts`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /contacts/i });
    await expect(heading).toBeVisible();
  });

  test('Contacts page shows seeded contacts', async ({ page }) => {
    await page.goto(`/org/${slug}/contacts`);
    await page.waitForLoadState('load');

    // Seed creates Jane Donor and Office Supply Co
    await expect(page.getByText('Jane Donor')).toBeVisible();
    await expect(page.getByText('Office Supply Co')).toBeVisible();
  });

  test('Add Contact button is visible', async ({ page }) => {
    await page.goto(`/org/${slug}/contacts`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /add contact/i });
    await expect(addBtn).toBeVisible();
  });

  test('Add Contact dialog opens', async ({ page }) => {
    await page.goto(`/org/${slug}/contacts`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /add contact/i });
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Should have Name field (using placeholder since label isn't linked via for/id)
    await expect(dialog.getByPlaceholder('Contact name')).toBeVisible();

    // Cancel
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});

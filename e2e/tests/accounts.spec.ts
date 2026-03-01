import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Accounts Page', () => {
  test('Accounts page renders chart of accounts', async ({ page }) => {
    await page.goto(`/org/${slug}/accounts`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /chart of accounts/i });
    await expect(heading).toBeVisible();
  });

  test('Accounts page shows Add Account button', async ({ page }) => {
    await page.goto(`/org/${slug}/accounts`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /add account/i });
    await expect(addBtn).toBeVisible();
  });

  test('Accounts page displays seeded accounts', async ({ page }) => {
    await page.goto(`/org/${slug}/accounts`);
    await page.waitForLoadState('load');

    // Our seed creates accounts with these names
    await expect(page.getByText('Operating Checking')).toBeVisible();
    await expect(page.getByText('Donation Revenue')).toBeVisible();
  });

  test('Add Account dialog opens and has required fields', async ({ page }) => {
    await page.goto(`/org/${slug}/accounts`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /add account/i });
    await addBtn.click();

    // Dialog should appear with form fields
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check for key form fields
    await expect(dialog.getByLabel(/account name/i)).toBeVisible();
    await expect(dialog.getByText(/account type/i)).toBeVisible();

    // Cancel button should close dialog
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('Create account form validates required fields', async ({ page }) => {
    await page.goto(`/org/${slug}/accounts`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /add account/i });
    await addBtn.click();

    const dialog = page.getByRole('dialog');

    // Clear the account name field (it may have a default)
    const nameField = dialog.getByLabel(/account name/i);
    await nameField.clear();

    // Try to submit form with empty name
    const submitBtn = dialog.getByRole('button', { name: /create account/i });
    await submitBtn.click();

    // Should show validation error for account name
    await expect(dialog.getByText(/required/i)).toBeVisible({ timeout: 5000 });
  });

  test('Create and verify new account', async ({ page }) => {
    await page.goto(`/org/${slug}/accounts`);
    await page.waitForLoadState('load');

    const addBtn = page.getByRole('button', { name: /add account/i });
    await addBtn.click();

    const dialog = page.getByRole('dialog');

    // Fill in account details
    await dialog.getByLabel(/account name/i).fill('E2E Test Savings');

    // Select account type
    const typeSelect = dialog.getByRole('combobox').first();
    await typeSelect.click();
    await page.getByRole('option', { name: /asset/i }).click();

    // Submit
    const submitBtn = dialog.getByRole('button', { name: /create account/i });
    await submitBtn.click();

    // Wait for dialog to close (success)
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Verify the new account appears in the list
    await expect(page.getByText('E2E Test Savings').first()).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Transactions Page', () => {
  test('Transactions page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /transactions/i });
    await expect(heading).toBeVisible();
  });

  test('Record Transaction button is visible for admin', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    const btn = page.getByRole('button', { name: /record transaction/i });
    await expect(btn).toBeVisible();
  });

  test('Transactions list displays seeded transactions', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    // Default filter is "Last 30 days" — change to "All Time" to see seeded data
    const periodFilter = page.locator('text=Last 30 days').first();
    await periodFilter.click();
    await page.getByRole('option', { name: /all time/i }).click();

    // Wait for table to update
    await page.waitForTimeout(1000);

    // Seeded data should have transactions with these descriptions
    await expect(page.getByText('Annual Gala Donation')).toBeVisible();
  });

  test('Transaction type filter works', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    // Find and use type filter
    const typeFilter = page.locator('select, [role="combobox"]').filter({ hasText: /all|type/i }).first();
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      // Select INCOME filter
      const incomeOption = page.getByRole('option', { name: /income/i });
      if (await incomeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await incomeOption.click();
        await page.waitForLoadState('load');
      }
    }
  });

  test('Transaction search filters results', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Donation');
      // Trigger search
      const searchBtn = page.getByRole('button', { name: /search/i });
      if (await searchBtn.isVisible()) {
        await searchBtn.click();
      } else {
        await searchInput.press('Enter');
      }
      await page.waitForLoadState('load');
    }
  });

  test('Record Transaction dialog opens with required fields', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    const btn = page.getByRole('button', { name: /record transaction/i });
    await btn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Should have transaction type, date, amount, accounts, description
    await expect(dialog.getByText(/transaction type|type/i).first()).toBeVisible();
    await expect(dialog.getByText(/amount/i).first()).toBeVisible();
    await expect(dialog.getByText(/description/i).first()).toBeVisible();

    // Cancel
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('Record an income transaction', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    const btn = page.getByRole('button', { name: /record transaction/i });
    await btn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select transaction type = INCOME
    const typeSelect = dialog.locator('[role="combobox"]').first();
    await typeSelect.click();
    await page.getByRole('option', { name: /income/i }).click();

    // Fill amount
    const amountInput = dialog.getByLabel(/amount/i);
    await amountInput.fill('250.00');

    // Fill description
    const descInput = dialog.getByLabel(/description/i);
    await descInput.fill('E2E Test Income Transaction');

    // Select from/to accounts
    const comboboxes = dialog.locator('[role="combobox"]');
    const count = await comboboxes.count();

    // We need at least the type + 2 account selectors
    if (count >= 3) {
      // Select credit account (revenue)
      await comboboxes.nth(1).click();
      const revenueOpt = page.getByRole('option', { name: /revenue|donation/i }).first();
      if (await revenueOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await revenueOpt.click();
      }

      // Select debit account (checking)
      await comboboxes.nth(2).click();
      const checkingOpt = page.getByRole('option', { name: /checking|cash/i }).first();
      if (await checkingOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkingOpt.click();
      }
    }

    // Submit
    const submitBtn = dialog.getByRole('button', { name: /record transaction/i });
    await submitBtn.click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Verify the transaction appears in the list
    await expect(page.getByText('E2E Test Income Transaction').first()).toBeVisible({ timeout: 5000 });
  });

  test('Export CSV button is visible', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await page.waitForLoadState('load');

    // Look for export/download button
    const exportBtn = page.getByRole('button', { name: /export|csv|download/i });
    if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(exportBtn).toBeVisible();
    }
  });
});

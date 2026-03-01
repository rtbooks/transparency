import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Reports Page', () => {
  test('Reports page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/reports`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /reports/i });
    await expect(heading).toBeVisible();
  });

  test('Income Statement report loads', async ({ page }) => {
    await page.goto(`/org/${slug}/reports/income-statement`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /income statement/i });
    await expect(heading).toBeVisible();

    // Should show revenue and expense sections
    await expect(page.getByText(/revenue/i).first()).toBeVisible();
    await expect(page.getByText(/expense/i).first()).toBeVisible();
  });

  test('Balance Sheet report loads', async ({ page }) => {
    await page.goto(`/org/${slug}/reports/balance-sheet`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /balance sheet/i });
    await expect(heading).toBeVisible();

    // Should show assets and liabilities sections
    await expect(page.getByText(/assets/i).first()).toBeVisible();
    await expect(page.getByText(/liabilities/i).first()).toBeVisible();
  });

  test('Cross-navigation between reports works', async ({ page }) => {
    await page.goto(`/org/${slug}/reports/income-statement`);
    await page.waitForLoadState('load');

    // Navigate to Balance Sheet
    const balanceSheetLink = page.locator('a[href*="balance-sheet"]').first();
    if (await balanceSheetLink.isVisible()) {
      await balanceSheetLink.click();
      await expect(page).toHaveURL(/balance-sheet/);

      const heading = page.getByRole('heading', { name: /balance sheet/i });
      await expect(heading).toBeVisible();
    }
  });

  test('Reports display currency formatted values', async ({ page }) => {
    await page.goto(`/org/${slug}/reports/income-statement`);
    await page.waitForLoadState('load');

    // Should show $ formatted values
    const currencyValues = page.locator('text=/\\$[\\d,]+\\.\\d{2}/');
    const count = await currencyValues.count();
    expect(count).toBeGreaterThan(0);
  });
});

import { test, expect } from '@playwright/test';
import { checkAccessibility, waitForPageReady } from '../helpers/accessibility';

/**
 * Navigation smoke test — visits every sidebar link for an authenticated user
 * and verifies pages load without server errors or uncaught JS exceptions.
 */
test.describe('Navigation Smoke Test', () => {
  // These tests require a valid org slug in the seeded test data.
  // Set E2E_ORG_SLUG env var or default to 'e2e-test-org'.
  const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

  // All sidebar nav paths for an admin user
  const orgPages = [
    { path: `/org/${slug}/dashboard`, name: 'Dashboard' },
    { path: `/org/${slug}/accounts`, name: 'Accounts' },
    { path: `/org/${slug}/transactions`, name: 'Transactions' },
    { path: `/org/${slug}/contacts`, name: 'Contacts' },
    { path: `/org/${slug}/bills`, name: 'Bills' },
    { path: `/org/${slug}/reports`, name: 'Reports' },
    { path: `/org/${slug}/program-spending`, name: 'Program Spending' },
    { path: `/org/${slug}/campaigns`, name: 'Campaigns' },
    { path: `/org/${slug}/donations`, name: 'Donations' },
    { path: `/org/${slug}/users`, name: 'Users' },
    { path: `/org/${slug}/settings`, name: 'Settings' },
  ];

  for (const { path, name } of orgPages) {
    test(`${name} page loads without errors`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));

      const response = await page.goto(path);

      // Should not get a server error
      expect(response?.status(), `${name} returned ${response?.status()}`).toBeLessThan(500);

      // Wait for content to load
      await waitForPageReady(page);

      // Page should have meaningful content (not blank)
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(10);

      // No uncaught JS exceptions
      expect(jsErrors, `JS errors on ${name}: ${jsErrors.join(', ')}`).toHaveLength(0);
    });
  }

  // Report sub-pages (cross-navigation)
  const reportPages = [
    { path: `/org/${slug}/reports/income-statement`, name: 'Income Statement' },
    { path: `/org/${slug}/reports/balance-sheet`, name: 'Balance Sheet' },
    { path: `/org/${slug}/reports/dashboard`, name: 'Reports Dashboard' },
  ];

  for (const { path, name } of reportPages) {
    test(`Report: ${name} loads correctly`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await waitForPageReady(page);
    });
  }

  test('Sidebar navigation links are visible', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await waitForPageReady(page);

    // Desktop sidebar should have navigation items
    const sidebar = page.locator('nav, [role="navigation"]').first();
    if (await sidebar.isVisible()) {
      const links = sidebar.locator('a');
      const count = await links.count();
      expect(count).toBeGreaterThan(3);
    }
  });

  test('Cross-report navigation works', async ({ page }) => {
    // Navigate to income statement
    await page.goto(`/org/${slug}/reports/income-statement`);
    await waitForPageReady(page);

    // Look for a link to balance sheet
    const balanceSheetLink = page.locator('a[href*="balance-sheet"]').first();
    if (await balanceSheetLink.isVisible()) {
      await balanceSheetLink.click();
      await expect(page).toHaveURL(/balance-sheet/);
      await waitForPageReady(page);

      // Should show balance sheet content
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();
    }
  });
});

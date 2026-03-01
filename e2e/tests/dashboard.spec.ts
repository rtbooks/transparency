import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Organization Dashboard', () => {
  test('Dashboard renders with organization name', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Dashboard');
  });

  test('Dashboard shows summary cards', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await page.waitForLoadState('load');

    // Should show financial summary headings
    await expect(page.getByRole('heading', { name: 'Total Assets' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Total Liabilities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revenue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
  });

  test('Dashboard shows recent transactions section', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await page.waitForLoadState('load');

    const recentTx = page.getByText('Recent Transactions');
    await expect(recentTx).toBeVisible();
  });

  test('Dashboard displays monetary values in currency format', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await page.waitForLoadState('load');

    // Total Assets card should display a dollar value
    const assetsCard = page.getByRole('heading', { name: 'Total Assets' }).locator('..');
    await expect(assetsCard.locator('..').getByText(/\$\d/).first()).toBeVisible();
  });

  test('Dashboard role badge is visible', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await page.waitForLoadState('load');

    const roleBadge = page.getByText(/Role:/);
    await expect(roleBadge).toBeVisible();
  });

  test('Dashboard shows seeded transaction descriptions', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await page.waitForLoadState('load');

    // Seeded data should have these transaction descriptions
    await expect(page.getByText('Annual Gala Donation')).toBeVisible();
    await expect(page.getByText('Monthly Supporter Donation')).toBeVisible();
  });
});

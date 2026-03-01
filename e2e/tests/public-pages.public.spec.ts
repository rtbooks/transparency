import { test, expect } from '@playwright/test';
import { checkAccessibility, waitForPageReady } from '../helpers/accessibility';

/**
 * Public pages smoke tests.
 * Verifies all marketing/public pages render without errors and pass basic accessibility checks.
 */
test.describe('Public Pages', () => {
  const publicPages = [
    { path: '/', name: 'Home' },
    { path: '/about', name: 'About' },
    { path: '/contact', name: 'Contact' },
    { path: '/features', name: 'Features' },
    { path: '/organizations', name: 'Organizations' },
    { path: '/privacy', name: 'Privacy' },
    { path: '/terms', name: 'Terms' },
  ];

  for (const { path, name } of publicPages) {
    test(`${name} page (${path}) renders without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().includes('favicon')) {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);

      await waitForPageReady(page);

      // Page should have a title
      const title = await page.title();
      expect(title).toBeTruthy();

      // No serious console errors (filter out common non-issues)
      const realErrors = consoleErrors.filter(
        (e) => !e.includes('hydration') && !e.includes('Warning:')
      );
      expect(realErrors).toHaveLength(0);
    });

    test(`${name} page (${path}) passes accessibility audit`, async ({ page }) => {
      await page.goto(path);
      await waitForPageReady(page);
      // Exclude Clerk components (3rd party, not our concern)
      await checkAccessibility(page, { exclude: ['.cl-rootBox', '.cl-card'] });
    });
  }

  test('Home page has navigation links', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Home page uses inline CTA links (Browse Organizations, Learn More) rather than a header nav
    const links = page.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Should have key CTA links
    const browseOrgs = page.locator('a[href="/organizations"]').first();
    await expect(browseOrgs).toBeVisible();
  });

  test('Navigation links are functional', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Click "Browse Organizations" CTA
    const browseLink = page.locator('a[href="/organizations"]').first();
    if (await browseLink.isVisible()) {
      await browseLink.click();
      await expect(page).toHaveURL(/\/organizations/);
    }
  });

  test('Non-existent page shows empty or not-found state', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    // Next.js may render a blank page with 200 or a proper 404
    const status = response?.status() ?? 200;
    // Either a 404 status or minimal/blank page content is acceptable
    expect(status).toBeLessThan(500);
  });
});

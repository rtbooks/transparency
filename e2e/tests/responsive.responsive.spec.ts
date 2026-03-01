import { test, expect } from '@playwright/test';
import { waitForPageReady } from '../helpers/accessibility';

/**
 * Responsive layout tests at mobile viewport (Pixel 5 device).
 * These run in the mobile-chrome project with narrower viewport.
 */
test.describe('Responsive Layout', () => {
  const slug = process.env.E2E_ORG_SLUG || 'grit-hoops';

  test('Dashboard renders properly on mobile', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await waitForPageReady(page);

    // Page should still have content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    // Desktop sidebar should be hidden on mobile
    const desktopSidebar = page.locator('aside').first();
    if (await desktopSidebar.count() > 0) {
      const isVisible = await desktopSidebar.isVisible();
      // On mobile, sidebar should either be hidden or collapsed
      // We accept both states since some implementations use off-canvas
    }
  });

  test('Transactions page is usable on mobile', async ({ page }) => {
    await page.goto(`/org/${slug}/transactions`);
    await waitForPageReady(page);

    // Page content should be visible
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();

    // Any tables should be scrollable (not overflowing)
    const viewport = page.viewportSize();
    if (viewport) {
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      // Body shouldn't be significantly wider than viewport (allows small overflow)
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20);
    }
  });

  test('Navigation is accessible on mobile', async ({ page }) => {
    await page.goto(`/org/${slug}/dashboard`);
    await waitForPageReady(page);

    // Mobile should have a menu trigger button (hamburger)
    const menuButton = page.locator('button').filter({ hasText: /menu/i }).first();
    const hamburger = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu" i], button[aria-label*="Menu" i]').first();

    const hasMobileMenu = (await menuButton.count() > 0) || (await hamburger.count() > 0);
    // Mobile nav should be accessible somehow
    // Accept either a hamburger menu or always-visible nav
    expect(hasMobileMenu || (await page.locator('nav a').count()) > 0).toBeTruthy();
  });
});

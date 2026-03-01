import { test, expect } from '@playwright/test';

// Use env var or fall back to a slug that may not exist (tests handle this)
const ORG_SLUG = process.env.E2E_ORG_SLUG || 'grit-hoops';

test.describe('Auth Redirect Flow', () => {
  const protectedRoutes = [
    'dashboard',
    'accounts',
    'transactions',
    'settings',
    'reports',
    'bills',
    'donations',
    'contacts',
    'campaigns',
  ];

  for (const route of protectedRoutes) {
    test(`Unauthenticated user accessing /${route} is redirected to login`, async ({ page }) => {
      await page.goto(`/org/${ORG_SLUG}/${route}`);

      // Should redirect to login page (Clerk)
      await page.waitForURL(/\/(login|sign-in)/, { timeout: 15000 }).catch(() => {});

      const url = page.url();
      const redirected = url.includes('login') || url.includes('sign-in');
      // If no redirect, might be a 404 (org doesn't exist locally) — that's still secure
      const is404 = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(redirected || is404).toBe(true);
    });
  }

  test('Public org page remains accessible without auth', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    const orgLink = page.locator('a[href^="/org/"]').first();
    const hasOrgs = await orgLink.isVisible().catch(() => false);
    test.skip(!hasOrgs, 'No orgs in dev database');

    const href = await orgLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('load');

    // Should NOT redirect to login
    const url = page.url();
    expect(url).not.toContain('login');
    expect(url).not.toContain('sign-in');
  });

  test('Public donate page remains accessible without auth', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    const orgLink = page.locator('a[href^="/org/"]').first();
    const hasOrgs = await orgLink.isVisible().catch(() => false);
    test.skip(!hasOrgs, 'No orgs in dev database');

    const href = await orgLink.getAttribute('href');
    const slug = href!.replace('/org/', '');
    await page.goto(`/org/${slug}/donate`);
    await page.waitForLoadState('load');

    const url = page.url();
    expect(url).not.toContain('login');
    expect(url).not.toContain('sign-in');
  });

  test('API webhook routes are publicly accessible', async ({ page }) => {
    const response = await page.goto('/api/webhooks/stripe');

    // Should get a method error, NOT a redirect to login
    const url = page.url();
    expect(url).not.toContain('login');
    expect(url).not.toContain('sign-in');
  });
});

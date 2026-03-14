import { test, expect, Page } from '@playwright/test';

const ORG_SLUG = process.env.E2E_ORG_SLUG || 'e2e-test-org';

/**
 * Public donation access tests — no authentication.
 * Verifies correct CTAs for anonymous users and auth redirects for protected donation pages.
 */
test.describe('Public Donation Access', () => {
  test('Public org page shows "Sign In" CTA for anonymous users', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    // Anonymous users should see the sign-in CTA
    const signInButton = page.getByRole('link', { name: /sign in to get started/i });
    await expect(signInButton).toBeVisible();

    // Should also see supporting text about donations
    await expect(page.getByText(/sign in to donate/i)).toBeVisible();
  });

  test('Public org page shows "Want to support" heading for anonymous users', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    await expect(page.getByText(/want to support this organization/i)).toBeVisible();
  });

  test('My-donations page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/my-donations`);

    await page.waitForURL(/\/(login|sign-in)/, { timeout: 15000 }).catch(() => {});

    const url = page.url();
    const redirected = url.includes('login') || url.includes('sign-in');
    expect(redirected).toBe(true);
  });

  test('My-donations/new page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/my-donations/new`);

    await page.waitForURL(/\/(login|sign-in)/, { timeout: 15000 }).catch(() => {});

    const url = page.url();
    const redirected = url.includes('login') || url.includes('sign-in');
    expect(redirected).toBe(true);
  });

  test('My-donations/new with campaignId redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/my-donations/new?campaignId=some-campaign-id`);

    await page.waitForURL(/\/(login|sign-in)/, { timeout: 15000 }).catch(() => {});

    const url = page.url();
    const redirected = url.includes('login') || url.includes('sign-in');
    expect(redirected).toBe(true);
  });

  test('Public donate page is accessible without auth', async ({ page }) => {
    // Discover a campaign from the org page
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    const donateLink = page.locator(`a[href*="/org/${ORG_SLUG}/donate/"]`).first();
    const hasCampaign = await donateLink.isVisible().catch(() => false);
    test.skip(!hasCampaign, 'No active campaigns in test org');

    const href = await donateLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('load');

    // Should NOT redirect to login — public donate page is accessible
    const url = page.url();
    expect(url).not.toContain('login');
    expect(url).not.toContain('sign-in');
  });
});

import { test, expect } from '@playwright/test';

const ORG_SLUG = process.env.E2E_ORG_SLUG || 'e2e-test-org';

/**
 * Authenticated donation access tests — run as org admin.
 * Verifies donation pages work for authenticated members and
 * confirms no auto-join behavior remains.
 */
test.describe('Authenticated Donation Access (Admin)', () => {
  test('My-donations page renders for authenticated member', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/my-donations`);
    await page.waitForLoadState('load');

    // Should NOT redirect to login
    const url = page.url();
    expect(url).not.toContain('login');
    expect(url).not.toContain('sign-in');

    // Page should render (not show Access Denied or error)
    await expect(page.locator('body')).not.toContainText('Access Denied');
    await expect(page.locator('body')).not.toContainText('access denied');
  });

  test('My-donations/new page renders donation form', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/my-donations/new`);
    await page.waitForLoadState('load');

    // Should NOT redirect to login
    expect(page.url()).not.toContain('login');

    // Should show the donation form content
    await expect(page.locator('body')).not.toContainText('Access Denied');

    // Look for donation form elements
    const body = await page.locator('body').innerText();
    const hasDonationContent = body.toLowerCase().includes('donat') ||
      body.toLowerCase().includes('pledge') ||
      body.toLowerCase().includes('amount') ||
      body.toLowerCase().includes('record');
    expect(hasDonationContent).toBe(true);
  });

  test('Donation form works with campaign pre-selection', async ({ page }) => {
    // First discover a campaign ID
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    const donateLink = page.locator(`a[href*="/org/${ORG_SLUG}/donate/"]`).first();
    const hasCampaign = await donateLink.isVisible().catch(() => false);
    test.skip(!hasCampaign, 'No active campaigns in test org');

    const href = await donateLink.getAttribute('href');
    const campaignId = href!.match(/\/donate\/([^/]+)$/)?.[1];
    test.skip(!campaignId, 'Could not extract campaign ID');

    // Visit donation form with campaignId query param
    await page.goto(`/org/${ORG_SLUG}/my-donations/new?campaignId=${campaignId}`);
    await page.waitForLoadState('load');

    // Should render the form, not redirect or error
    expect(page.url()).not.toContain('login');
    await expect(page.locator('body')).not.toContainText('Access Denied');
  });

  test('No auto-join messaging on donation page', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/my-donations/new`);
    await page.waitForLoadState('load');

    const body = await page.locator('body').innerText();

    // Should NOT contain any auto-join or access request messaging
    expect(body).not.toContain('Access Request Submitted');
    expect(body).not.toContain('pending approval');
    expect(body).not.toContain('Your request to join');
    expect(body).not.toContain('automatically added');
  });

  test('Public org page shows "Dashboard" CTA for authenticated members', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    // Authenticated member should see "Go to Dashboard" CTA
    const dashboardButton = page.getByRole('link', { name: /go to dashboard/i });
    await expect(dashboardButton).toBeVisible();

    // Should see "You're a member" text
    await expect(page.getByText(/you.*re a member/i)).toBeVisible();
  });
});

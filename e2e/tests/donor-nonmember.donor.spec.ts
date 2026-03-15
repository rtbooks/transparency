import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { cleanupDonorMembership } from '../helpers/db';

// Run tests serially — the membership request test at the end modifies state
test.describe.configure({ mode: 'serial' });

const ORG_SLUG = process.env.E2E_ORG_SLUG || 'e2e-test-org';

/**
 * Signs in the donor user via Clerk testing helpers.
 * Must be called at the start of each test since storage state may not persist sessions.
 */
async function signInAsDonor(page: import('@playwright/test').Page) {
  await page.goto('/');

  // Use emailAddress-based sign-in which creates a signInToken via Backend API.
  // This is more reliable than password strategy for Clerk testing.
  await (clerk.signIn as any)({
    page,
    emailAddress: process.env.E2E_DONOR_USERNAME || 'e2e-donor@radbooks.org',
  });
}

/**
 * Non-member donor tests — authenticated user who is NOT a member of the org.
 * Verifies that platform users can donate without being org members,
 * and that admin-only routes remain protected.
 */
test.describe('Non-Member Donor: Donation Access', () => {
  test('Non-member can access my-donations page', async ({ page }) => {
    await signInAsDonor(page);
    await page.goto(`/org/${ORG_SLUG}/my-donations`);
    await page.waitForLoadState('load');

    // Should NOT redirect to login — user is authenticated
    expect(page.url()).not.toContain('login');
    expect(page.url()).not.toContain('sign-in');

    // Should NOT show "Access Denied"
    await expect(page.locator('body')).not.toContainText('Access Denied');
  });

  test('Non-member can access my-donations/new page', async ({ page }) => {
    await signInAsDonor(page);
    await page.goto(`/org/${ORG_SLUG}/my-donations/new`);
    await page.waitForLoadState('load');

    // Should NOT redirect to login
    expect(page.url()).not.toContain('login');

    // Should render donation form content
    await expect(page.locator('body')).not.toContainText('Access Denied');

    const body = await page.locator('body').innerText();
    const hasDonationContent = body.toLowerCase().includes('donat') ||
      body.toLowerCase().includes('pledge') ||
      body.toLowerCase().includes('amount') ||
      body.toLowerCase().includes('record');
    expect(hasDonationContent).toBe(true);
  });

  test('Non-member sees "Donate Now" and "Request Membership" on public org page', async ({ page }) => {
    await signInAsDonor(page);
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    // Non-member should see the "can_request" state CTA
    await expect(page.getByText(/want to support this organization/i)).toBeVisible();

    // Should see "Request Membership" button
    const requestMembershipButton = page.getByRole('button', { name: /request membership/i });
    await expect(requestMembershipButton).toBeVisible();

    // Should see "Donate Now" link (if campaigns exist)
    const donateButton = page.getByRole('link', { name: /donate now/i });
    const hasDonate = await donateButton.isVisible().catch(() => false);
    if (hasDonate) {
      await expect(donateButton).toBeVisible();
    }

    // Should NOT see "Go to Dashboard" (that's for members)
    await expect(page.getByRole('link', { name: /go to dashboard/i })).not.toBeVisible();

    // Should NOT see "Sign In" CTA (user is already authenticated)
    await expect(page.getByRole('link', { name: /sign in to get started/i })).not.toBeVisible();
  });
});

test.describe('Non-Member Donor: Admin Route Protection', () => {
  const adminRoutes = [
    'dashboard',
    'accounts',
    'transactions',
    'settings',
    'bills',
    'donations',
    'contacts',
    'campaigns',
  ];

  for (const route of adminRoutes) {
    test(`Non-member cannot access org ${route} page`, async ({ page }) => {
      await signInAsDonor(page);
      const response = await page.goto(`/org/${ORG_SLUG}/${route}`);
      await page.waitForLoadState('load');

      const url = page.url();
      const status = response?.status() ?? 200;
      const body = await page.locator('body').innerText();

      // Should be blocked: either redirect to login/home, show access denied, or return error status
      const isBlocked =
        url.includes('login') ||
        url.includes('sign-in') ||
        status === 403 ||
        status === 404 ||
        body.includes('Access Denied') ||
        body.includes('access denied') ||
        body.includes('not authorized') ||
        body.includes('Not authorized') ||
        body.includes('Forbidden') ||
        // Some pages may just show nothing useful without membership
        !url.includes(`/org/${ORG_SLUG}/${route}`);

      expect(isBlocked).toBe(true);
    });
  }
});

test.describe('Non-Member Donor: No Auto-Join Side Effects', () => {
  test('Visiting donation page does not create org membership', async ({ page, request }) => {
    await signInAsDonor(page);
    // Visit the donation page
    await page.goto(`/org/${ORG_SLUG}/my-donations/new`);
    await page.waitForLoadState('load');

    // Now check the public org page — should still show "Request Membership"
    // (not "Go to Dashboard" which would indicate membership was created)
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    // Should still be in "can_request" state, not "member" state
    await expect(page.getByRole('link', { name: /go to dashboard/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /request membership/i })).toBeVisible();
  });

  test('Visiting donation page with campaignId does not create org membership', async ({ page }) => {
    await signInAsDonor(page);
    // First discover a campaign
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    const donateLink = page.locator(`a[href*="/org/${ORG_SLUG}/donate/"]`).first();
    const hasCampaign = await donateLink.isVisible().catch(() => false);
    test.skip(!hasCampaign, 'No active campaigns in test org');

    const href = await donateLink.getAttribute('href');
    const campaignId = href!.match(/\/donate\/([^/]+)$/)?.[1];

    // Visit donation form with campaignId (the old code auto-joined here)
    await page.goto(`/org/${ORG_SLUG}/my-donations/new?campaignId=${campaignId}`);
    await page.waitForLoadState('load');

    // Verify still not a member
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    await expect(page.getByRole('link', { name: /go to dashboard/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /request membership/i })).toBeVisible();
  });
});

test.describe('Non-Member Donor: Membership Request', () => {
  // These tests modify state (create membership via AUTO_APPROVE),
  // so they must run AFTER the "no auto-join" tests above.
  test('Non-member can submit a membership request successfully', async ({ page }) => {
    await signInAsDonor(page);
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    // Click "Request Membership" to open the dialog
    const requestButton = page.getByRole('button', { name: /request membership/i });
    await expect(requestButton).toBeVisible();
    await requestButton.click();

    // Dialog should appear with the org name
    await expect(page.getByText(/request membership in/i)).toBeVisible();

    // Submit the request
    const submitButton = page.getByRole('button', { name: /submit request/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Should NOT show an error — the request should succeed
    // With AUTO_APPROVE, the user becomes a member
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Access Denied');
    expect(bodyText).not.toContain('Error');

    // The dialog should close without error
    const dialogStillOpen = await page.getByText(/request membership in/i).isVisible().catch(() => false);
    expect(dialogStillOpen).toBe(false);
  });

  test('Non-member can re-request membership after being removed', async ({ page }) => {
    // Clean up directly via DB — no test-only API routes in production code
    await cleanupDonorMembership(ORG_SLUG, process.env.E2E_DONOR_USERNAME || 'e2e-donor@radbooks.org');

    await signInAsDonor(page);
    await page.goto(`/org/${ORG_SLUG}`);
    await page.waitForLoadState('load');

    // Should see Request Membership again (no longer a member)
    const requestButton = page.getByRole('button', { name: /request membership/i });
    await expect(requestButton).toBeVisible();
    await requestButton.click();

    await expect(page.getByText(/request membership in/i)).toBeVisible();

    const submitButton = page.getByRole('button', { name: /submit request/i });
    await submitButton.click();

    // Should succeed — old resolved request should not block
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Access Denied');
    expect(bodyText).not.toContain('Error');
    expect(bodyText).not.toContain('constraint');

    const dialogStillOpen = await page.getByText(/request membership in/i).isVisible().catch(() => false);
    expect(dialogStillOpen).toBe(false);
  });
});

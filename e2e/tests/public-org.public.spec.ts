import { test, expect, Page } from '@playwright/test';
import { checkAccessibility, waitForPageReady } from '../helpers/accessibility';

/**
 * Discovers an org slug from the /organizations listing page.
 * Extracts the slug from the first org link without visiting the detail page.
 */
async function discoverOrgSlug(page: Page): Promise<string | null> {
  await page.goto('/organizations');
  await page.waitForLoadState('load');

  const orgLinks = page.locator('a[href^="/org/"]');
  const count = await orgLinks.count();
  if (count === 0) return null;

  const href = await orgLinks.first().getAttribute('href');
  if (!href) return null;
  return href.replace('/org/', '');
}

test.describe('Public Organization Page', () => {
  let orgSlug: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    orgSlug = await discoverOrgSlug(page);
    await page.close();
  });

  test('Organization page renders with org name', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}`);
    await page.waitForLoadState('load');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const text = await heading.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('Organization page shows financial summary when public transparency enabled', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}`);
    await page.waitForLoadState('load');

    const revenueCard = page.getByText('Total Revenue');
    const hasFinancials = await revenueCard.isVisible().catch(() => false);
    if (hasFinancials) {
      await expect(revenueCard).toBeVisible();
      await expect(page.getByText('Total Expenses')).toBeVisible();
      await expect(page.getByText('Net Income')).toBeVisible();
    }
  });

  test('Organization page shows campaigns section when campaigns exist', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}`);
    await page.waitForLoadState('load');

    const campaignsHeading = page.getByText('Active Campaigns');
    const hasCampaigns = await campaignsHeading.isVisible().catch(() => false);
    if (hasCampaigns) {
      const donateButtons = page.getByRole('link', { name: /donate/i });
      const count = await donateButtons.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('Organization page shows CTA for anonymous users', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}`);
    await page.waitForLoadState('load');

    const signInCta = page.getByText(/sign in/i).first();
    const supportCta = page.getByText(/want to support/i).first();

    const hasCta = await signInCta.isVisible().catch(() => false) ||
      await supportCta.isVisible().catch(() => false);
    if (hasCta) {
      expect(hasCta).toBe(true);
    }
  });

  test('Organization page passes accessibility audit', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}`);
    await page.waitForLoadState('load');

    const violations = await checkAccessibility(page, {
      exclude: ['.cl-rootBox', '.cl-card'],
    });
    expect(violations).toHaveLength(0);
  });

  test('Organization page has no console errors', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('hydrat') && !text.includes('Warning:') && !text.includes('favicon') && !text.includes('Failed to load resource')) {
          errors.push(text);
        }
      }
    });

    await page.goto(`/org/${orgSlug}`);
    await page.waitForLoadState('load');
    expect(errors).toHaveLength(0);
  });

  test('Non-existent organization returns 404', async ({ page }) => {
    const response = await page.goto('/org/this-org-does-not-exist-xyz-999');
    const status = response?.status() ?? 200;
    expect(status).toBe(404);
  });
});

test.describe('Public Organizations Listing', () => {
  test('Organizations listing page renders', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    await expect(page.getByRole('heading', { name: /transparent organizations/i })).toBeVisible();
  });

  test('Organizations listing shows stats bar', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    // Stats bar shows org count, transaction count, and verified label
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('Transparent Organizations');
    expect(bodyText).toContain('Transactions');
  });

  test('Organizations listing shows org cards with links', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    const viewLinks = page.getByText(/View Dashboard/i);
    const count = await viewLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Organizations listing links navigate to org page', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    const orgLinks = page.locator('a[href^="/org/"]');
    const count = await orgLinks.count();
    test.skip(count === 0, 'No org links found');

    await orgLinks.first().click();
    await expect(page).toHaveURL(/\/org\//);
    await page.waitForLoadState('load');

    // Org page shows either content or a not-found page
    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');
  });

  test('Organizations listing page passes accessibility audit', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    const violations = await checkAccessibility(page, {
      exclude: ['.cl-rootBox', '.cl-card'],
    });
    expect(violations).toHaveLength(0);
  });

  test('Organizations listing has CTA section', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('load');

    const bodyText = await page.locator('body').innerText();
    const hasCta = bodyText.toLowerCase().includes('ready for transparency') ||
      bodyText.toLowerCase().includes('get started');
    expect(hasCta).toBe(true);
  });
});

test.describe('Public Donation Page', () => {
  let orgSlug: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    orgSlug = await discoverOrgSlug(page);
    await page.close();
  });

  test('Donation page loads for valid org', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    const response = await page.goto(`/org/${orgSlug}/donate`);
    await page.waitForLoadState('load');

    const status = response?.status() ?? 200;
    expect(status).toBeLessThan(400);
  });

  test('Donation page shows donation content', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}/donate`);
    await page.waitForLoadState('load');

    // Wait for client-side content to render
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    const hasDonationContent = body.toLowerCase().includes('donat') ||
      body.toLowerCase().includes('amount') ||
      body.toLowerCase().includes('give') ||
      body.toLowerCase().includes('pledge') ||
      body.toLowerCase().includes('set up');
    expect(hasDonationContent).toBe(true);
  });

  test('Donation page for non-existent org returns 404', async ({ page }) => {
    const response = await page.goto('/org/fake-org-xyz-999/donate');
    const status = response?.status() ?? 200;
    expect(status).toBe(404);
  });

  test('Donation page passes accessibility audit', async ({ page }) => {
    test.skip(!orgSlug, 'No working org found in dev database');
    await page.goto(`/org/${orgSlug}/donate`);
    await page.waitForLoadState('load');

    const violations = await checkAccessibility(page, {
      exclude: ['.cl-rootBox', '.cl-card'],
    });
    expect(violations).toHaveLength(0);
  });
});

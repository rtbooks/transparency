import { test, expect } from '@playwright/test';

const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

test.describe('Campaigns Page', () => {
  test('Campaigns page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/campaigns`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /campaigns/i });
    await expect(heading).toBeVisible();
  });

  test('Campaigns page shows seeded campaign', async ({ page }) => {
    await page.goto(`/org/${slug}/campaigns`);
    await page.waitForLoadState('load');

    await expect(page.getByText('Spring Fundraiser')).toBeVisible();
  });
});

test.describe('Program Spending Page', () => {
  test('Program Spending page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/program-spending`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /program spending/i });
    await expect(heading).toBeVisible();
  });

  test('Program Spending shows seeded items', async ({ page }) => {
    await page.goto(`/org/${slug}/program-spending`);
    await page.waitForLoadState('load');

    await expect(page.getByText('Basketball Equipment')).toBeVisible();
  });
});

test.describe('Settings Page', () => {
  test('Settings page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/settings`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /settings/i });
    await expect(heading).toBeVisible();
  });

  test('Settings page shows organization name', async ({ page }) => {
    await page.goto(`/org/${slug}/settings`);
    await page.waitForLoadState('load');

    const nameInput = page.getByLabel('Organization Name');
    await expect(nameInput).toHaveValue('E2E Test Organization');
  });
});

test.describe('Users Page', () => {
  test('Users page renders', async ({ page }) => {
    await page.goto(`/org/${slug}/users`);
    await page.waitForLoadState('load');

    const heading = page.getByRole('heading', { name: /users|members|team/i });
    await expect(heading).toBeVisible();
  });
});

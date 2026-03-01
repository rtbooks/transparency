import { clerk } from '@clerk/testing/playwright';
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const adminAuthFile = path.join(__dirname, '.auth/admin.json');

/**
 * Authenticate as an admin user and store the session state.
 * Requires E2E_CLERK_USER_USERNAME and E2E_CLERK_USER_PASSWORD env vars.
 */
setup('authenticate as admin', async ({ page }) => {
  const username = process.env.E2E_CLERK_USER_USERNAME;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'E2E_CLERK_USER_USERNAME and E2E_CLERK_USER_PASSWORD env vars required for authenticated tests'
    );
  }

  await page.goto('/');
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: username,
      password: password,
    },
  });

  // Wait for auth to complete — should redirect or show authenticated UI
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await expect(page).not.toHaveURL(/\/login/);

  // Save authenticated state
  await page.context().storageState({ path: adminAuthFile });
});

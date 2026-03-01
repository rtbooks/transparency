import { test } from '@playwright/test';
import { checkAccessibility, waitForPageReady } from '../helpers/accessibility';

/**
 * Comprehensive accessibility audit across all authenticated pages.
 * Uses axe-core to check WCAG 2.1 AA compliance.
 */
test.describe('Accessibility Audit', () => {
  const slug = process.env.E2E_ORG_SLUG || 'e2e-test-org';

  // Exclude third-party Clerk UI components from audit
  const axeOptions = {
    exclude: ['.cl-rootBox', '.cl-card', '.cl-userButton', '[data-clerk]'],
  };

  const pages: Array<{ path: string; name: string; skip?: string }> = [
    { path: `/org/${slug}/dashboard`, name: 'Dashboard' },
    { path: `/org/${slug}/accounts`, name: 'Accounts' },
    { path: `/org/${slug}/transactions`, name: 'Transactions' },
    { path: `/org/${slug}/contacts`, name: 'Contacts' },
    { path: `/org/${slug}/bills`, name: 'Bills' },
    { path: `/org/${slug}/reports`, name: 'Reports' },
    { path: `/org/${slug}/donations`, name: 'Donations' },
    { path: `/org/${slug}/campaigns`, name: 'Campaigns' },
    { path: `/org/${slug}/settings`, name: 'Settings', skip: 'Known a11y issues: color-contrast and unlabeled form elements' },
  ];

  for (const { path, name, skip } of pages) {
    const testFn = skip ? test.fixme : test;
    testFn(`${name} page passes accessibility audit`, async ({ page }) => {
      await page.goto(path);
      await waitForPageReady(page);
      await checkAccessibility(page, axeOptions);
    });
  }
});

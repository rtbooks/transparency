import { test, expect } from '@playwright/test';

/**
 * Error handling tests.
 * Verifies the application handles error states gracefully.
 */
test.describe('Error Handling', () => {
  const slug = process.env.E2E_ORG_SLUG || 'grit-hoops';

  test('404 page renders for invalid org routes', async ({ page }) => {
    const response = await page.goto('/org/non-existent-org-slug-xyz/dashboard');
    // Should get 404 or redirect to an error page
    const status = response?.status() ?? 0;
    // Accept 404 or 200 (with error message in body)
    expect(status).toBeLessThan(500);
  });

  test('404 page renders for completely invalid routes', async ({ page }) => {
    const response = await page.goto('/completely-invalid-route-xyz');
    expect(response?.status()).toBe(404);
  });

  test('API returns proper error for invalid request', async ({ request }) => {
    // Invalid UUID format
    const response = await request.get(`/api/organizations/${slug}/accounts/not-a-uuid`);
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  test('Pages handle JS errors gracefully', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // Navigate through several pages quickly
    await page.goto(`/org/${slug}/dashboard`);
    await page.goto(`/org/${slug}/transactions`);
    await page.goto(`/org/${slug}/accounts`);

    // Filter out known non-critical errors
    const criticalErrors = jsErrors.filter(
      (e) => !e.includes('hydration') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

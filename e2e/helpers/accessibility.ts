import AxeBuilder from '@axe-core/playwright';
import { Page, expect } from '@playwright/test';

/**
 * Run an axe accessibility audit on the current page.
 * Fails the test if any violations with impact 'serious' or 'critical' are found.
 */
export async function checkAccessibility(
  page: Page,
  options?: { exclude?: string[]; disableRules?: string[] }
) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );

  if (serious.length > 0) {
    const summary = serious
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`)
      .join('\n');
    expect(serious, `Accessibility violations found:\n${summary}`).toHaveLength(0);
  }

  return serious;
}

/**
 * Verify no console errors occurred during the test.
 * Call this in afterEach or at end of test.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

/**
 * Wait for the page to be fully loaded (no pending network requests).
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
}

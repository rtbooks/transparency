import { clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

/**
 * Global setup: initializes Clerk testing environment.
 * Must run before any authenticated tests.
 */
setup('global clerk setup', async () => {
  await clerkSetup();
});

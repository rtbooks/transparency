'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { type ReactNode } from 'react';

/**
 * Wraps ClerkProvider but gracefully falls back when Clerk keys are unavailable
 * (e.g., during CI builds or static prerendering on Vercel).
 */
export function SafeClerkProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasValidKey = key && !key.includes('test_Y2xlcms');

  if (!hasValidKey) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}

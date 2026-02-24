/**
 * Typed analytics wrapper around @vercel/analytics.
 * Client-only — safe to import anywhere but only fires in the browser.
 */

import { track } from '@vercel/analytics';

type AnalyticsEvents = {
  pledge_created: { amount: number; orgSlug: string; campaignId?: string };
  pledge_updated: { orgSlug: string };
  pledge_cancelled: { orgSlug: string };
  donation_created: { type: string; amount: number; orgSlug: string; campaignId?: string };
  bill_created: { direction: string; amount: number; orgSlug: string };
  bill_paid: { amount: number; orgSlug: string };
  transaction_created: { amount: number; type: string; orgSlug: string };
  campaign_created: { orgSlug: string; goalAmount?: number };
  contact_linked: { orgSlug: string };
  access_requested: { orgSlug: string };
  org_created: { orgSlug: string };
  report_viewed: { reportType: string; orgSlug: string; period?: string };
};

export function trackEvent<E extends keyof AnalyticsEvents>(
  event: E,
  data: AnalyticsEvents[E]
) {
  if (typeof window === 'undefined') return;
  try {
    track(event, data);
  } catch {
    // Silently ignore analytics failures — never break the app
  }
}

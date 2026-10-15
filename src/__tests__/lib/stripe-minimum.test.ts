import { meetsStripeMinimum, STRIPE_MINIMUM_USD } from '@/lib/stripe-minimum';

describe('Stripe USD minimum', () => {
  it('uses Stripe’s $0.50 minimum', () => {
    expect(STRIPE_MINIMUM_USD).toBe(0.5);
  });

  it('allows amounts at or above the minimum', () => {
    expect(meetsStripeMinimum(0.5)).toBe(true);
    expect(meetsStripeMinimum(1)).toBe(true);
  });

  it('rejects amounts below the minimum and non-finite values', () => {
    expect(meetsStripeMinimum(0.49)).toBe(false);
    expect(meetsStripeMinimum(0)).toBe(false);
    expect(meetsStripeMinimum(Number.NaN)).toBe(false);
  });
});

/** Stripe's minimum charge for USD payments. Amounts are in dollars. */
export const STRIPE_MINIMUM_USD = 0.5;

export function meetsStripeMinimum(amount: number): boolean {
  return Number.isFinite(amount) && amount >= STRIPE_MINIMUM_USD;
}

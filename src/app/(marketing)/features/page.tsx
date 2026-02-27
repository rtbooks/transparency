import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Discover the powerful features that make financial transparency simple for nonprofits.",
};

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-purple-50 to-white py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight">
              Professional Tools for Transparency
            </h1>
            <p className="text-xl text-gray-600">
              Everything nonprofits need to publish complete financial data with confidence and
              ease.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">🔍</div>
              <h3 className="mb-3 text-xl font-semibold">Complete Transparency</h3>
              <p className="text-gray-600">
                Publish every transaction with full details. Donors see exactly where their money
                goes, building unprecedented trust in your organization.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">📊</div>
              <h3 className="mb-3 text-xl font-semibold">Real-Time Dashboards</h3>
              <p className="text-gray-600">
                Beautiful, interactive financial dashboards update automatically. Share a single URL
                that always shows your current financial position.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">🏦</div>
              <h3 className="mb-3 text-xl font-semibold">Double-Entry Accounting</h3>
              <p className="text-gray-600">
                Professional-grade bookkeeping system ensures accuracy. Your data is audit-ready and
                compatible with standard accounting practices.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">🎯</div>
              <h3 className="mb-3 text-xl font-semibold">Planned Purchases</h3>
              <p className="text-gray-600">
                Show donors what you plan to spend money on before it's spent. Create transparency
                around future needs and priorities.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">💳</div>
              <h3 className="mb-3 text-xl font-semibold">Integrated Donations</h3>
              <p className="text-gray-600">
                Accept donations directly through your transparency page with Stripe. Donors see
                proof their contribution was received.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">🔒</div>
              <h3 className="mb-3 text-xl font-semibold">Privacy Protected</h3>
              <p className="text-gray-600">
                Financial transparency doesn't mean exposing donor identities. Personal information
                stays private while financial data is public.
              </p>
            </div>

            {/* Feature 7 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">📈</div>
              <h3 className="mb-3 text-xl font-semibold">Visual Reports</h3>
              <p className="text-gray-600">
                Revenue trends, expense breakdowns, and program spending ratios presented in clear,
                easy-to-understand charts and graphs.
              </p>
            </div>

            {/* Feature 8 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">📱</div>
              <h3 className="mb-3 text-xl font-semibold">Mobile Friendly</h3>
              <p className="text-gray-600">
                All dashboards and admin tools work perfectly on phones and tablets. Update finances
                and view reports from anywhere.
              </p>
            </div>

            {/* Feature 9 */}
            <div className="rounded-lg border p-8">
              <div className="mb-4 text-4xl">✅</div>
              <h3 className="mb-3 text-xl font-semibold">Verified Organizations</h3>
              <p className="text-gray-600">
                We verify 501(c)(3) status for every organization. Donors can trust they're giving
                to legitimate charitable entities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="border-t bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold">Coming Soon</h2>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-lg font-semibold">🏦 Bank Account Integration</h3>
                <p className="text-sm text-gray-600">
                  Connect your bank accounts with Plaid for automatic transaction imports. Reduce
                  manual data entry and ensure accuracy.
                </p>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-lg font-semibold">📊 QuickBooks Sync</h3>
                <p className="text-sm text-gray-600">
                  Already using QuickBooks? Sync your data automatically to publish transparency
                  without duplicate work.
                </p>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-lg font-semibold">🔄 Recurring Donations</h3>
                <p className="text-sm text-gray-600">
                  Enable monthly giving programs with automated recurring payments and donor
                  management tools.
                </p>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-lg font-semibold">📧 Donor Updates</h3>
                <p className="text-sm text-gray-600">
                  Automated email updates to donors showing how their contributions are being used
                  in real time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
            <p className="mb-8 text-lg text-gray-600">
              See how easy it is to bring complete transparency to your nonprofit.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Create Free Account
              </Link>
              <Link
                href="/organizations"
                className="rounded-lg border-2 border-gray-300 px-8 py-3 font-semibold text-gray-700 hover:border-gray-400"
              >
                See Examples
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

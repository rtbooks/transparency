import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | RadBooks",
  description:
    "Learn about our mission to bring radical transparency to 501(c)(3) charitable organizations.",
};

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight">
              Radical Transparency for Nonprofits
            </h1>
            <p className="text-xl text-gray-600">
              We believe donors deserve to see exactly where every dollar goes. We're building the
              infrastructure to make complete financial transparency the standard for charitable
              organizations.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold">Our Mission</h2>
            <div className="space-y-4 text-lg text-gray-700">
              <p>
                Trust is the foundation of charitable giving. Yet too often, donors are left
                wondering if their contributions are truly making an impact. Annual reports and
                summary financials don't tell the whole story.
              </p>
              <p>
                We're changing that. Our platform gives 501(c)(3) organizations the tools to publish
                their complete financial picture—every transaction, every account, every dollar—in
                real time.
              </p>
              <p>
                This isn't just about compliance or reporting. It's about building unprecedented
                trust between nonprofits and the communities they serve. When donors can see exactly
                where their money goes, they give with confidence and commitment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>

            <div className="grid gap-8 md:grid-cols-2">
              {/* For Nonprofits */}
              <div className="rounded-lg bg-white p-8 shadow-sm">
                <h3 className="mb-6 text-2xl font-semibold text-blue-600">For Nonprofits</h3>
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                        1
                      </div>
                      <h4 className="font-semibold">Sign Up & Verify</h4>
                    </div>
                    <p className="ml-11 text-sm text-gray-600">
                      Create an account and verify your 501(c)(3) status. We ensure only legitimate
                      charitable organizations join the platform.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                        2
                      </div>
                      <h4 className="font-semibold">Set Up Your Accounts</h4>
                    </div>
                    <p className="ml-11 text-sm text-gray-600">
                      Build your chart of accounts with our professional double-entry system. Import
                      existing data or start fresh with our templates.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                        3
                      </div>
                      <h4 className="font-semibold">Publish & Share</h4>
                    </div>
                    <p className="ml-11 text-sm text-gray-600">
                      Your financial dashboard goes live. Share your transparency URL with donors,
                      grant makers, and supporters to build trust.
                    </p>
                  </div>
                </div>
              </div>

              {/* For Donors */}
              <div className="rounded-lg bg-white p-8 shadow-sm">
                <h3 className="mb-6 text-2xl font-semibold text-green-600">For Donors</h3>
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-600">
                        1
                      </div>
                      <h4 className="font-semibold">Browse Organizations</h4>
                    </div>
                    <p className="ml-11 text-sm text-gray-600">
                      Explore verified 501(c)(3) nonprofits committed to complete financial
                      transparency. Filter by cause, location, or size.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-600">
                        2
                      </div>
                      <h4 className="font-semibold">See Every Detail</h4>
                    </div>
                    <p className="ml-11 text-sm text-gray-600">
                      View real-time financial data: every transaction, revenue source, and expense.
                      See exactly what percentage goes to programs vs overhead.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-600">
                        3
                      </div>
                      <h4 className="font-semibold">Donate with Confidence</h4>
                    </div>
                    <p className="ml-11 text-sm text-gray-600">
                      Make informed giving decisions based on complete information. Donate directly
                      through the platform with integrated payment processing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-12 text-center text-3xl font-bold">Our Values</h2>

            <div className="space-y-8">
              <div>
                <h3 className="mb-2 text-xl font-semibold">🔍 Transparency First</h3>
                <p className="text-gray-700">
                  We practice what we preach. Our platform's financials and operations are open for
                  inspection. We believe in leading by example.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-semibold">🛡️ Trust & Security</h3>
                <p className="text-gray-700">
                  We protect donor privacy while ensuring financial transparency. Personal
                  information is never exposed, and all data is encrypted and secure.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-semibold">🤝 Nonprofit-Friendly</h3>
                <p className="text-gray-700">
                  We understand the constraints nonprofits face. Our platform is designed to save
                  time, not create more work. Professional-grade tools at accessible prices.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-semibold">📊 Data Integrity</h3>
                <p className="text-gray-700">
                  We use proper double-entry accounting standards. Financial data is accurate,
                  auditable, and export-ready for tax filings and grant applications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section (Optional - placeholder) */}
      <section className="border-t bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold">Built for Impact</h2>
            <p className="mb-8 text-lg text-gray-700">
              We're a team of technologists, nonprofit veterans, and transparency advocates working
              to rebuild trust in charitable giving.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">Join the Movement</h2>
            <p className="mb-8 text-lg text-gray-600">
              Whether you're a nonprofit ready to embrace transparency or a donor seeking
              trustworthy organizations, we'd love to have you.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Get Started
              </Link>
              <Link
                href="/organizations"
                className="rounded-lg border-2 border-gray-300 px-8 py-3 font-semibold text-gray-700 hover:border-gray-400"
              >
                Browse Organizations
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

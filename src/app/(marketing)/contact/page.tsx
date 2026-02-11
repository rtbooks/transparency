import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact | Financial Transparency Platform",
  description: "Get in touch with our team to learn more about bringing transparency to your nonprofit.",
};

export default function ContactPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-blue-50 to-white py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight">Get in Touch</h1>
            <p className="text-xl text-gray-600">
              Questions about the platform? Ready to bring transparency to your nonprofit? 
              We'd love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
            {/* Email */}
            <div className="rounded-lg border p-8 text-center">
              <div className="mb-4 text-5xl">📧</div>
              <h3 className="mb-3 text-xl font-semibold">Email Us</h3>
              <p className="mb-4 text-gray-600">
                Get a response within 1-2 business days
              </p>
              <a
                href="mailto:hello@transparency.org"
                className="text-blue-600 hover:text-blue-700"
              >
                hello@transparency.org
              </a>
            </div>

            {/* General Inquiries */}
            <div className="rounded-lg border p-8 text-center">
              <div className="mb-4 text-5xl">💬</div>
              <h3 className="mb-3 text-xl font-semibold">General Questions</h3>
              <p className="mb-4 text-gray-600">
                Learn about the platform and how it works
              </p>
              <Link
                href="/about"
                className="text-blue-600 hover:text-blue-700"
              >
                Read About Us →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Frequently Asked Questions
            </h2>

            <div className="space-y-8">
              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  How much does it cost?
                </h3>
                <p className="text-gray-600">
                  We're currently in beta with our first partner organization. Pricing 
                  will be announced soon, but our goal is to keep it affordable for 
                  nonprofits of all sizes.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  Do you verify 501(c)(3) status?
                </h3>
                <p className="text-gray-600">
                  Yes. We verify EIN numbers and 501(c)(3) status before organizations 
                  can publish financial data. This ensures donors can trust all 
                  organizations on the platform are legitimate charitable entities.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  Will donor names be public?
                </h3>
                <p className="text-gray-600">
                  No. Donor privacy is protected. Financial transactions show amounts and 
                  categories but never include personally identifiable information. Donors 
                  can choose to be recognized publicly if they wish.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  Can I import existing financial data?
                </h3>
                <p className="text-gray-600">
                  Yes. We support importing transactions from CSV files and plan to add 
                  integrations with QuickBooks and other accounting software soon.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  Is my data secure?
                </h3>
                <p className="text-gray-600">
                  Absolutely. We use industry-standard encryption and security practices. 
                  Your financial data is stored securely, and only the information you 
                  choose to make public is visible to others.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">
                  How is this different from annual reports?
                </h3>
                <p className="text-gray-600">
                  Traditional annual reports are summaries created once a year. Our platform 
                  shows real-time, transaction-level detail. Donors can see where every 
                  dollar goes, not just high-level categories.
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
            <h2 className="mb-4 text-3xl font-bold">
              Ready to Join the Transparency Movement?
            </h2>
            <p className="mb-8 text-lg text-gray-600">
              Create your free account and start building trust with your donors today.
            </p>
            <Link
              href="/register"
              className="inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

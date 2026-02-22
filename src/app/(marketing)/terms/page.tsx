import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | RadBooks",
  description: "Terms of Service for the RadBooks financial transparency platform.",
};

export default function TermsOfServicePage() {
  const lastUpdated = "February 22, 2026";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: {lastUpdated}</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the RadBooks platform (&quot;Service&quot;), operated by RadBooks LLC
            (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be
            bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms,
            you may not use the Service.
          </p>
          <p>
            By creating an account, you represent that you are at least 18 years old and have the
            legal authority to enter into these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">2. Description of Service</h2>
          <p>
            RadBooks is a financial transparency platform designed for 501(c)(3) charitable
            organizations. The Service provides tools for double-entry bookkeeping, financial
            reporting, donation tracking, and public financial transparency dashboards.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Service at any
            time with reasonable notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities that occur under your account. You agree to:
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Provide accurate and complete registration information</li>
            <li>Keep your account credentials secure</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
            <li>Accept responsibility for all activity under your account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">4. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Violate any applicable law or regulation</li>
            <li>Record false, misleading, or fraudulent financial information</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Upload or transmit malicious code or harmful content</li>
            <li>Impersonate another person or entity</li>
            <li>Use the Service for any purpose other than its intended use</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">5. Organization Data</h2>
          <p>
            Organizations using the Service retain ownership of all financial data they enter into
            the platform. By using the Service, organizations grant us a limited license to store,
            process, and display their data as necessary to operate the platform, including making
            certain financial information publicly available through transparency dashboards as
            configured by the organization administrator.
          </p>
          <p>
            You are solely responsible for ensuring the accuracy and legality of the financial data
            you enter. RadBooks does not provide accounting, tax, or legal advice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">6. Fees and Payments</h2>
          <p>
            RadBooks currently offers its core platform features at no charge. We reserve the right
            to introduce paid features or subscription plans in the future. Any changes to pricing
            will be communicated with at least 30 days&apos; notice.
          </p>
          <p>
            Donation processing through the platform may be subject to third-party payment
            processing fees (e.g., Stripe), which are separate from any RadBooks fees.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">7. Intellectual Property</h2>
          <p>
            The Service, including its design, code, features, and branding, is owned by RadBooks
            LLC and protected by intellectual property laws. You may not copy, modify, distribute, or
            reverse-engineer any part of the Service without our written consent.
          </p>
          <p>
            You retain all rights to the content and data you submit to the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">8. Privacy</h2>
          <p>
            Your use of the Service is also governed by our{" "}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
            , which describes how we collect, use, and protect your information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">9. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
            OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, error-free, or secure, or that
            any defects will be corrected. RadBooks is not a substitute for professional accounting
            or financial advisory services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, RADBOOKS LLC SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
            PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE,
            GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
          </p>
          <p>
            Our total aggregate liability for all claims related to the Service shall not exceed the
            amount you paid us in the twelve (12) months preceding the claim, or $100, whichever is
            greater.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless RadBooks LLC, its officers, directors,
            employees, and agents from any claims, damages, losses, or expenses (including reasonable
            attorney&apos;s fees) arising from your use of the Service or violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">12. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time for violation of these
            Terms or for any other reason with reasonable notice. You may terminate your account at
            any time by contacting us.
          </p>
          <p>
            Upon termination, your right to use the Service ceases immediately. We will make your
            organization data available for export for a reasonable period following termination.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">13. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on this page and updating the &quot;Last updated&quot; date.
            Your continued use of the Service after changes become effective constitutes acceptance of
            the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State
            of Massachusetts, without regard to its conflict of law provisions. Any disputes arising
            under these Terms shall be resolved in the courts located in the State of Massachusetts.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">15. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:support@radbooks.org" className="text-blue-600 hover:underline">
              support@radbooks.org
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

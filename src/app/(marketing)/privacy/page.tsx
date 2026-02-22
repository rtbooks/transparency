import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | RadBooks",
  description: "Privacy Policy for the RadBooks financial transparency platform.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "February 22, 2026";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: {lastUpdated}</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold">1. Introduction</h2>
          <p>
            RadBooks LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            operates the RadBooks financial transparency platform (&quot;Service&quot;). This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when you
            use our Service.
          </p>
          <p>
            By using the Service, you consent to the data practices described in this policy. If you
            do not agree with this policy, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">2. Information We Collect</h2>

          <h3 className="mt-4 text-xl font-medium">2.1 Information You Provide</h3>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              <strong>Account information:</strong> Name, email address, and authentication
              credentials when you create an account
            </li>
            <li>
              <strong>Organization data:</strong> Organization name, financial records, transaction
              data, contact information for vendors and donors, and other data you enter into the
              platform
            </li>
            <li>
              <strong>Communications:</strong> Information you provide when contacting us for support
              or feedback
            </li>
          </ul>

          <h3 className="mt-4 text-xl font-medium">2.2 Information Collected Automatically</h3>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              <strong>Usage data:</strong> Pages visited, features used, and interactions with the
              Service
            </li>
            <li>
              <strong>Device information:</strong> Browser type, operating system, and device
              identifiers
            </li>
            <li>
              <strong>Log data:</strong> IP address, access times, and referring URLs
            </li>
            <li>
              <strong>Analytics data:</strong> We use Vercel Analytics to collect anonymized usage
              statistics to improve the Service
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Provide, maintain, and improve the Service</li>
            <li>Process and display financial data as configured by organization administrators</li>
            <li>Send you important notices, such as account and security updates</li>
            <li>Respond to your requests and provide customer support</li>
            <li>Monitor and analyze usage trends to improve user experience</li>
            <li>Detect, prevent, and address technical issues and security threats</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">4. How We Share Your Information</h2>
          <p>
            We do not sell your personal information. We may share your information in the following
            circumstances:
          </p>

          <h3 className="mt-4 text-xl font-medium">4.1 Public Financial Transparency</h3>
          <p>
            The core purpose of RadBooks is financial transparency. Organization administrators may
            configure certain financial data to be publicly visible through transparency dashboards.
            We display this data as directed by the organization. Anonymous donor information is
            never publicly disclosed.
          </p>

          <h3 className="mt-4 text-xl font-medium">4.2 Service Providers</h3>
          <p>We share information with third-party providers that help us operate the Service:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              <strong>Clerk</strong> — Authentication and user management
            </li>
            <li>
              <strong>Stripe</strong> — Payment and donation processing
            </li>
            <li>
              <strong>Vercel</strong> — Hosting and analytics
            </li>
            <li>
              <strong>Neon</strong> — Database hosting
            </li>
            <li>
              <strong>Resend</strong> — Transactional email delivery
            </li>
          </ul>
          <p>
            These providers are contractually obligated to protect your information and use it only
            for the purposes of providing their services.
          </p>

          <h3 className="mt-4 text-xl font-medium">4.3 Legal Requirements</h3>
          <p>
            We may disclose your information if required to do so by law or in response to valid
            legal process, such as a subpoena, court order, or government request.
          </p>

          <h3 className="mt-4 text-xl font-medium">4.4 Business Transfers</h3>
          <p>
            In the event of a merger, acquisition, or sale of all or a portion of our assets, your
            information may be transferred as part of that transaction. We will notify you of any
            such change.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your
            information, including:
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Encryption of data in transit (TLS/SSL)</li>
            <li>Encryption of data at rest</li>
            <li>Regular security assessments</li>
            <li>Access controls and authentication</li>
            <li>Parameterized database queries to prevent injection attacks</li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic storage is 100%
            secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">6. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide
            the Service. Financial records are retained in accordance with applicable legal
            requirements for nonprofit organizations.
          </p>
          <p>
            When you request account deletion, we will delete or anonymize your personal information
            within 30 days, except where retention is required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">7. Your Rights</h2>
          <p>Depending on your location, you may have the following rights regarding your data:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              <strong>Access:</strong> Request a copy of the personal data we hold about you
            </li>
            <li>
              <strong>Correction:</strong> Request correction of inaccurate or incomplete data
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your personal data
            </li>
            <li>
              <strong>Export:</strong> Request your data in a portable format
            </li>
            <li>
              <strong>Objection:</strong> Object to certain processing of your data
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:support@radbooks.org" className="text-blue-600 hover:underline">
              support@radbooks.org
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">8. Cookies and Tracking</h2>
          <p>
            We use essential cookies required for authentication and the proper functioning of the
            Service. We use Vercel Analytics for anonymized usage statistics. We do not use
            advertising cookies or sell data to advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">9. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you believe we have collected
            such information, please contact us so we can promptly delete it.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on this page and updating the &quot;Last
            updated&quot; date. Your continued use of the Service after changes become effective
            constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">11. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <div className="mt-2 rounded-lg bg-gray-50 p-4">
            <p className="font-medium">RadBooks LLC</p>
            <p>
              Email:{" "}
              <a href="mailto:support@radbooks.org" className="text-blue-600 hover:underline">
                support@radbooks.org
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

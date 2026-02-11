import { Suspense } from "react";
import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Marketing navigation */}
      <header className="border-b bg-white">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold">
              Transparency Platform
            </Link>
            <div className="hidden gap-6 md:flex">
              <Link href="/about" className="text-sm text-gray-600 hover:text-gray-900">
                About
              </Link>
              <Link href="/organizations" className="text-sm text-gray-600 hover:text-gray-900">
                Organizations
              </Link>
              <Link href="/features" className="text-sm text-gray-600 hover:text-gray-900">
                Features
              </Link>
              <Link href="/contact" className="text-sm text-gray-600 hover:text-gray-900">
                Contact
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <Suspense fallback={<div>Loading...</div>}>
          {children}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/features" className="hover:text-gray-900">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/organizations" className="hover:text-gray-900">
                    Organizations
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/about" className="hover:text-gray-900">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-gray-900">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/terms" className="hover:text-gray-900">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-gray-900">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Connect</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <a href="mailto:hello@transparency.org" className="hover:text-gray-900">
                    Email
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-gray-500">
            © 2026 Financial Transparency Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

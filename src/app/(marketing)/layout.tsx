import { Suspense } from "react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Marketing navigation will go here */}
      <header className="border-b bg-white">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <a href="/" className="text-xl font-bold">
              Transparency Platform
            </a>
            <div className="hidden gap-6 md:flex">
              <a href="/about" className="text-sm text-gray-600 hover:text-gray-900">
                About
              </a>
              <a href="/organizations" className="text-sm text-gray-600 hover:text-gray-900">
                Organizations
              </a>
              <a href="/features" className="text-sm text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="/contact" className="text-sm text-gray-600 hover:text-gray-900">
                Contact
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </a>
            <a
              href="/register"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Get Started
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <Suspense fallback={<div>Loading...</div>}>
          {children}
        </Suspense>
      </main>

      {/* Footer will be enhanced later */}
      <footer className="border-t bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/features">Features</a></li>
                <li><a href="/organizations">Organizations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/about">About</a></li>
                <li><a href="/contact">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/terms">Terms of Service</a></li>
                <li><a href="/privacy">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Connect</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="mailto:hello@transparency.org">Email</a></li>
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

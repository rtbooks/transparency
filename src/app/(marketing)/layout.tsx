import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { MarketingNav } from "./MarketingNav";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const clerkUser = await currentUser();

  // Serialize user data for client component
  let user = null;
  if (clerkUser) {
    // Fetch isPlatformAdmin from database
    const dbUser = await prisma.user.findUnique({
      where: { authId: clerkUser.id },
      select: { isPlatformAdmin: true },
    });

    user = {
      firstName: clerkUser.firstName,
      isPlatformAdmin: dbUser?.isPlatformAdmin || false,
    };
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav user={user} />

      <main className="flex-1">
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
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
                  <a href="mailto:hello@radbooks.org" className="hover:text-gray-900">
                    Email
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-gray-500">
            © 2026 RadBooks. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

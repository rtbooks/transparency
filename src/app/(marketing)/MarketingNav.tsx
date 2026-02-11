'use client';

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

interface MarketingNavProps {
  user: {
    firstName?: string | null;
  } | null;
}

export function MarketingNav({ user }: MarketingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
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
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden text-sm text-gray-600 hover:text-gray-900 md:block"
              >
                {user.firstName || "Profile"}
              </Link>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm text-gray-600 hover:text-gray-900 md:block">
                Sign In
              </Link>
              <Link
                href="/register"
                className="hidden rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 md:block"
              >
                Get Started
              </Link>
            </>
          )}
          
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-white md:hidden">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col space-y-3">
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base text-gray-700 hover:bg-gray-100"
              >
                About
              </Link>
              <Link
                href="/organizations"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base text-gray-700 hover:bg-gray-100"
              >
                Organizations
              </Link>
              <Link
                href="/features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base text-gray-700 hover:bg-gray-100"
              >
                Features
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base text-gray-700 hover:bg-gray-100"
              >
                Contact
              </Link>
              
              {!user && (
                <>
                  <div className="border-t pt-3">
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-base text-gray-700 hover:bg-gray-100"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="mt-2 block rounded-md bg-blue-600 px-3 py-2 text-base font-medium text-white hover:bg-blue-700"
                    >
                      Get Started
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

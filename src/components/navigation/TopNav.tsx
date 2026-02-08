'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { cn } from '@/lib/utils';

interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface TopNavProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isPlatformAdmin: boolean;
  } | null;
  organizationContext?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  userOrganizations?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
  navLinks: NavLink[];
}

export function TopNav({
  user,
  organizationContext,
  userOrganizations = [],
  navLinks,
}: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-100 border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo and Org Switcher */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
                FT
              </div>
              <span className="hidden sm:block font-semibold text-gray-900">
                Financial Transparency
              </span>
            </Link>

            {/* Organization Context or Switcher */}
            {organizationContext && (
              <div className="hidden md:block">
                {userOrganizations.length > 1 ? (
                  <OrganizationSwitcher
                    currentOrg={organizationContext}
                    organizations={userOrganizations}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5">
                    <span className="text-sm font-medium text-gray-900">
                      {organizationContext.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === link.href || link.active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right: User Menu or Login */}
          <div className="flex items-center gap-2">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-white md:hidden">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {/* Organization switcher on mobile */}
            {organizationContext && userOrganizations.length > 1 && (
              <div className="mb-3">
                <OrganizationSwitcher
                  currentOrg={organizationContext}
                  organizations={userOrganizations}
                  mobile
                />
              </div>
            )}

            {/* Navigation links */}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block rounded-md px-3 py-2 text-base font-medium',
                  pathname === link.href || link.active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* User section on mobile */}
            {!user && (
              <div className="flex flex-col gap-2 pt-4 border-t mt-4">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">
                    Login
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

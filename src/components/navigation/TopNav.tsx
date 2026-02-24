"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UserMenu } from "./UserMenu";
import { MobileSidebar } from "./MobileSidebar";
import type { NavLink } from "@/lib/navigation";

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
  orgLogoUrl?: string | null;
}

export function TopNav({
  user,
  organizationContext,
  userOrganizations = [],
  navLinks,
  orgLogoUrl,
}: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // When in org context, nav links are handled by the sidebar
  const isOrgContext = !!organizationContext;

  return (
    <>
      <nav className="z-100 sticky top-0 border-b bg-white">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left: Logo and Org Switcher */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button — only in org context */}
              {isOrgContext && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              )}

              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                  RB
                </div>
                <span className="hidden font-semibold text-gray-900 sm:block">RadBooks</span>
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
                      {orgLogoUrl && (
                        <img
                          src={orgLogoUrl}
                          alt=""
                          className="h-5 w-5 rounded object-contain"
                        />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {organizationContext.name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Center: Desktop Navigation Links — only when NOT in org context */}
            {!isOrgContext && navLinks.length > 0 && (
              <div className="hidden items-center gap-1 md:flex">
                {navLinks.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "org-nav-active"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      )}
                      style={active ? {
                        backgroundColor: 'var(--org-primary-bg, rgb(239 246 255))',
                        color: 'var(--org-primary, rgb(29 78 216))',
                      } : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Right: User Menu or Login */}
            <div className="flex items-center gap-2">
              {user ? (
                <UserMenu user={user} />
              ) : (
                <div className="hidden items-center gap-2 md:flex">
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

              {/* Mobile menu button — only when NOT in org context */}
              {!isOrgContext && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu — only when NOT in org context */}
        {!isOrgContext && mobileMenuOpen && (
          <div className="border-t bg-white md:hidden">
            <div className="space-y-1 px-4 pb-3 pt-2">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-base font-medium",
                      active
                        ? "org-nav-active"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                    style={active ? {
                      backgroundColor: 'var(--org-primary-bg, rgb(239 246 255))',
                      color: 'var(--org-primary, rgb(29 78 216))',
                    } : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {!user && (
                <div className="mt-4 flex flex-col gap-2 border-t pt-4">
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

      {/* Mobile sidebar sheet — only in org context */}
      {isOrgContext && (
        <MobileSidebar
          navLinks={navLinks}
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
        />
      )}
    </>
  );
}

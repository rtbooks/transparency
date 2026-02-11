import { UserRole } from '@/generated/prisma/client';

export interface NavLink {
  label: string;
  href: string;
}

export function getOrganizationNavLinks(
  slug: string,
  role: UserRole
): NavLink[] {
  const baseLinks: NavLink[] = [
    { label: 'Dashboard', href: `/org/${slug}/dashboard` },
  ];

  // DONOR role gets limited nav
  if (role === 'DONOR') {
    return [
      ...baseLinks,
      { label: 'My Donations', href: `/org/${slug}/donations` },
    ];
  }

  // ORG_ADMIN and PLATFORM_ADMIN get full nav
  if (role === 'ORG_ADMIN' || role === 'PLATFORM_ADMIN') {
    return [
      ...baseLinks,
      { label: 'Accounts', href: `/org/${slug}/accounts` },
      { label: 'Transactions', href: `/org/${slug}/transactions` },
      { label: 'Planned Purchases', href: `/org/${slug}/planned-purchases` },
      { label: 'Users', href: `/org/${slug}/users` },
      { label: 'Settings', href: `/org/${slug}/settings` },
    ];
  }

  // PUBLIC or unknown role
  return baseLinks;
}

export function getPlatformAdminNavLinks(): NavLink[] {
  return [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Verifications', href: '/admin/verifications' },
    { label: 'Organizations', href: '/admin/organizations' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Analytics', href: '/admin/analytics' },
  ];
}

export function getPublicNavLinks(): NavLink[] {
  return [
    { label: 'Home', href: '/' },
    { label: 'Browse Organizations', href: '/organizations' },
    { label: 'About', href: '/about' },
  ];
}

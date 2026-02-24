import { UserRole } from '@/generated/prisma/client';

export interface NavLink {
  label: string;
  href: string;
  icon?: string;
  section?: string;
}

export function getOrganizationNavLinks(
  slug: string,
  role: UserRole
): NavLink[] {
  // DONOR role gets limited nav
  if (role === 'SUPPORTER') {
    return [
      { label: 'Dashboard', href: `/org/${slug}/dashboard`, icon: 'LayoutDashboard' },
      { label: 'Reports', href: `/org/${slug}/reports`, icon: 'BarChart3' },
      { label: 'Program Spending', href: `/org/${slug}/program-spending`, icon: 'Target' },
      { label: 'Campaigns', href: `/org/${slug}/campaigns`, icon: 'Megaphone' },
      { label: 'My Donations', href: `/org/${slug}/donations`, icon: 'Heart' },
    ];
  }

  // ORG_ADMIN and PLATFORM_ADMIN get full nav with sections
  if (role === 'ORG_ADMIN' || role === 'PLATFORM_ADMIN') {
    return [
      { label: 'Dashboard', href: `/org/${slug}/dashboard`, icon: 'LayoutDashboard', section: 'Main' },
      { label: 'Accounts', href: `/org/${slug}/accounts`, icon: 'BookOpen', section: 'Main' },
      { label: 'Transactions', href: `/org/${slug}/transactions`, icon: 'ArrowLeftRight', section: 'Main' },
      { label: 'Contacts', href: `/org/${slug}/contacts`, icon: 'Users', section: 'Payables' },
      { label: 'Bills', href: `/org/${slug}/bills`, icon: 'FileText', section: 'Payables' },
      { label: 'Reports', href: `/org/${slug}/reports`, icon: 'BarChart3', section: 'Reporting' },
      { label: 'Program Spending', href: `/org/${slug}/program-spending`, icon: 'Target', section: 'Reporting' },
      { label: 'Campaigns', href: `/org/${slug}/campaigns`, icon: 'Megaphone', section: 'Fundraising' },
      { label: 'My Donations', href: `/org/${slug}/donations`, icon: 'Heart', section: 'Fundraising' },
      { label: 'Users', href: `/org/${slug}/users`, icon: 'UserCog', section: 'Admin' },
      { label: 'Settings', href: `/org/${slug}/settings`, icon: 'Settings', section: 'Admin' },
    ];
  }

  // PUBLIC or unknown role
  return [
    { label: 'Dashboard', href: `/org/${slug}/dashboard`, icon: 'LayoutDashboard' },
    { label: 'Reports', href: `/org/${slug}/reports`, icon: 'BarChart3' },
  ];
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

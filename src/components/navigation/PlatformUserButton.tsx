'use client';

import { UserButton } from '@clerk/nextjs';

interface PlatformUserButtonProps {
  isPlatformAdmin?: boolean;
}

/**
 * Reusable UserButton component with Platform Admin link
 * Use this instead of raw UserButton to maintain consistency
 */
export function PlatformUserButton({ isPlatformAdmin }: PlatformUserButtonProps) {
  if (!isPlatformAdmin) {
    // No custom menu items for regular users
    return <UserButton afterSignOutUrl="/" />;
  }

  return (
    <UserButton afterSignOutUrl="/">
      <UserButton.MenuItems>
        <UserButton.Link
          label="Profile"
          labelIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
          href="/profile"
        />
        <UserButton.Link
          label="Platform Admin"
          labelIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
          }
          href="/admin/dashboard"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

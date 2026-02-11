'use client';

import { PlatformUserButton } from './PlatformUserButton';

interface UserMenuProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isPlatformAdmin: boolean;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  return <PlatformUserButton isPlatformAdmin={user.isPlatformAdmin} />;
}

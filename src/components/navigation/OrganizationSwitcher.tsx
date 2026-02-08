'use client';

import { Check, ChevronDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrganizationSwitcherProps {
  currentOrg: {
    id: string;
    name: string;
    slug: string;
  };
  organizations: Organization[];
  mobile?: boolean;
}

export function OrganizationSwitcher({
  currentOrg,
  organizations,
  mobile = false,
}: OrganizationSwitcherProps) {
  const router = useRouter();

  const handleSwitch = (slug: string) => {
    router.push(`/org/${slug}/dashboard`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={mobile ? 'outline' : 'ghost'}
          className={cn(
            'justify-between',
            mobile ? 'w-full' : 'max-w-[200px]'
          )}
        >
          <span className="truncate">{currentOrg.name}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.slug)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">{org.name}</span>
                <span className="text-xs text-muted-foreground">
                  {org.role}
                </span>
              </div>
              {currentOrg.id === org.id && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile#organizations" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Browse Organizations
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

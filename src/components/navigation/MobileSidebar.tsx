"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NavLink } from "@/lib/navigation";
import { getNavIcon } from "@/lib/nav-icons";

interface MobileSidebarProps {
  navLinks: NavLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ navLinks, open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();

  // Group links by section
  const sections: { name: string | null; links: NavLink[] }[] = [];
  let currentSection: string | null = null;

  for (const link of navLinks) {
    const section = link.section ?? null;
    if (section !== currentSection) {
      sections.push({ name: section, links: [link] });
      currentSection = section;
    } else {
      sections[sections.length - 1].links.push(link);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="text-left text-sm font-semibold text-gray-900">
            Navigation
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {sIdx > 0 && <hr className="mx-2 my-2 border-gray-200" />}
              {section.links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== `/org/` && pathname.startsWith(link.href + "/"));
                const Icon = getNavIcon(link.icon);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-blue-700" : "text-gray-400"
                        )}
                      />
                    )}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

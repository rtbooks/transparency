"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavLink } from "@/lib/navigation";

const STORAGE_KEY = "radbooks-sidebar-collapsed";

interface OrgSidebarProps {
  navLinks: NavLink[];
  className?: string;
}

export function OrgSidebar({ navLinks, className }: OrgSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

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
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-[calc(100vh-4rem)] flex-col border-r bg-gray-50/50 transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          className
        )}
      >
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {/* Section separator (skip for first section) */}
              {sIdx > 0 && <hr className="mx-2 my-2 border-gray-200" />}

              {/* Section links */}
              {section.links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== `/org/` && pathname.startsWith(link.href + "/"));
                const Icon = link.icon;

                const linkContent = (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-2",
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
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={link.href}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {link.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t p-2">
          <button
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center rounded-md px-2 py-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

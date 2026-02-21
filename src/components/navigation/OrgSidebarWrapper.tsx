"use client";

import { OrgSidebar } from "./OrgSidebar";
import { MobileSidebar } from "./MobileSidebar";
import type { NavLink } from "@/lib/navigation";

interface OrgSidebarWrapperProps {
  navLinks: NavLink[];
}

export function OrgSidebarWrapper({ navLinks }: OrgSidebarWrapperProps) {
  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <OrgSidebar navLinks={navLinks} className="hidden md:flex" />
      {/* Mobile sidebar is rendered inside TopNav via MobileSidebar */}
    </>
  );
}

export { MobileSidebar };

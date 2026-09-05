import React from "react";

export interface SubNavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ModuleSubNavProps {
  items?: SubNavItem[];
  className?: string;
}

export function ModuleSubNav(_props?: ModuleSubNavProps) {
  return null;
}

export default ModuleSubNav;



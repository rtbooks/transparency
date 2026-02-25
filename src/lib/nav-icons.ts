import {
  LayoutDashboard,
  BookOpen,
  ArrowLeftRight,
  Users,
  FileText,
  BarChart3,
  ShoppingCart,
  UserCog,
  Settings,
  Heart,
  HandHeart,
  Target,
  Megaphone,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  BookOpen,
  ArrowLeftRight,
  Users,
  FileText,
  BarChart3,
  ShoppingCart,
  UserCog,
  Settings,
  Heart,
  HandHeart,
  Target,
  Megaphone,
  Scale,
};

export function getNavIcon(name?: string): LucideIcon | undefined {
  if (!name) return undefined;
  return iconMap[name];
}

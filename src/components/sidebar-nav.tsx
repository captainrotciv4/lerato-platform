"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users, Heart, GraduationCap, Plane, CalendarDays, CreditCard, MessageSquare,
  BarChart3, ShieldCheck, Home, ArrowLeftRight, MapPin,
  Users2, CalendarMinus, Banknote, ShoppingCart, Building2, ClipboardList,
  BookOpen, Scale, BarChart2, GitMerge, Settings, Landmark, Upload, TrendingDown,
  CloudUpload,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Users, Heart, GraduationCap, Plane, CalendarDays, CreditCard, MessageSquare,
  BarChart3, ShieldCheck, Home, ArrowLeftRight, MapPin,
  Users2, CalendarMinus, Banknote, ShoppingCart, Building2, ClipboardList,
  BookOpen, Scale, BarChart2, GitMerge, Settings, Landmark, Upload, TrendingDown,
  CloudUpload,
};

export type SerializableNavItem =
  | { section: string }
  | { href: string; label: string; iconName: string };

export function SidebarNavLinks({
  items,
  orgSlug,
  collapsed = false,
}: {
  items: SerializableNavItem[];
  orgSlug: string;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {items.map((item, i) => {
        if ("section" in item) {
          if (collapsed) return null;
          const next = items[i + 1];
          if (!next || "section" in next) return null;
          return (
            <p
              key={i}
              className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fg-muted)]"
            >
              {item.section}
            </p>
          );
        }

        const Icon = ICONS[item.iconName] ?? Home;
        const fullHref = `/${orgSlug}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === `/${orgSlug}`
            : pathname.startsWith(fullHref);

        return (
          <Link
            key={i}
            href={fullHref as any}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group mb-0.5 flex items-center rounded-lg px-3 py-2 text-sm transition-all duration-100",
              collapsed ? "justify-center gap-0" : "gap-3",
              isActive
                ? "bg-[var(--brand-primary)] font-semibold text-white shadow-sm"
                : "text-[var(--fg)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                collapsed ? "h-5 w-5" : "h-4 w-4",
                isActive ? "text-white/90" : "text-[var(--fg-muted)] group-hover:text-[var(--fg)]"
              )}
            />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

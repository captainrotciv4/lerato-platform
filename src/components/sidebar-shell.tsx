"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ChevronLeft, Menu, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { SidebarNavLinks, type SerializableNavItem } from "@/components/sidebar-nav";
import { OfflineBadge } from "@/components/offline-badge";

type AccessibleOrg = {
  slug: string;
  shortName: string;
  primaryColor: string;
};

type Props = {
  // Branding
  orgShortName: string;
  orgType: "FOUNDATION" | "ACADEMY" | "MISSION" | "OTHER";
  primaryColor: string;
  themeStyle: React.CSSProperties;
  // Nav
  navItems: SerializableNavItem[];
  orgSlug: string;
  // User
  userName: string;
  userTitle: string | null;
  userRole: string;
  // Org switcher
  accessibleOrgs: AccessibleOrg[];
  // Actions
  signOutAction: () => Promise<void>;
  // Page content
  children: React.ReactNode;
};

function OrgSwitcher({ current, orgs }: { current: string; orgs: AccessibleOrg[] }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] p-1">
      {orgs.map((o) => (
        <Link
          key={o.slug}
          href={`/${o.slug}` as any}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150",
            o.slug === current
              ? "text-white shadow-sm"
              : "text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
          )}
          style={o.slug === current ? { background: o.primaryColor } : undefined}
        >
          {o.slug !== current && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.primaryColor }} />
          )}
          <span>{o.shortName}</span>
        </Link>
      ))}
    </div>
  );
}

export function SidebarShell({
  orgShortName,
  orgType,
  primaryColor,
  themeStyle,
  navItems,
  orgSlug,
  userName,
  userTitle,
  userRole,
  accessibleOrgs,
  signOutAction,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Persist collapsed state across page loads
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  const orgTypeLabel =
    orgType === "FOUNDATION" ? "Foundation"
    : orgType === "ACADEMY" ? "Sports Academy"
    : "Mission";

  return (
    <div style={themeStyle} className="flex min-h-screen bg-[var(--bg-muted)]">
      {/* ── Mobile backdrop ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          // Mobile: fixed overlay; desktop: in-flow
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "lg:relative lg:inset-auto lg:z-auto",
          // Height
          "h-full min-h-screen lg:min-h-screen",
          // Border + bg
          "border-r border-[var(--border)] bg-[var(--bg)]",
          // Mobile open/close slide
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-transform duration-300 ease-in-out lg:transition-none",
        )}
        style={{
          // Mobile drawer is always 256px; desktop respects collapsed state
          width: mobileOpen ? 256 : (collapsed ? 56 : 256),
          transition: "transform 0.3s ease, width 0.2s ease",
        }}
      >
        {/* ── Branded header ───────────────────────────────────────── */}
        <div
          className="relative overflow-hidden px-4 pb-5 pt-5 shrink-0"
          style={{ background: primaryColor }}
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-0 h-12 w-12 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-white/30 bg-white/20 text-base font-bold text-white backdrop-blur-sm">
              {orgShortName.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-display text-sm font-bold leading-tight text-white truncate">
                  {orgShortName}
                </div>
                <div className="mt-0.5 text-[11px] capitalize text-white/60">{orgTypeLabel}</div>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-3 rounded-md p-1 text-white/70 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Nav ──────────────────────────────────────────────────── */}
        <SidebarNavLinks items={navItems} orgSlug={orgSlug} collapsed={collapsed} />

        {/* ── User footer ──────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: primaryColor }}
              title={collapsed ? `${userName} · ${userTitle ?? userRole}` : undefined}
            >
              {initials(userName)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-[var(--fg)]">{userName}</div>
                <div className="truncate text-[10px] capitalize text-[var(--fg-muted)]">
                  {userTitle ?? userRole.replace("_", " ").toLowerCase()}
                </div>
              </div>
            )}
          </div>
          {/* Sign-out — text label for visibility */}
          {!collapsed && (
            <form action={signOutAction} className="mt-1">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]">
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          )}
          {/* Sign-out icon only in collapsed mode */}
          {collapsed && (
            <form action={signOutAction} className="mt-1">
              <button
                title="Sign out"
                className="flex w-full items-center justify-center rounded-lg p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {/* ── Desktop collapse toggle ───────────────────────────────── */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3.5 top-[52px] z-10 hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] shadow-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:shadow-md transition-shadow"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn("h-3.5 w-3.5 transition-transform duration-200", collapsed && "rotate-180")}
          />
        </button>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden min-w-0">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-3 sm:px-6 gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex lg:hidden items-center justify-center rounded-md p-2 text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <OrgSwitcher current={orgSlug} orgs={accessibleOrgs} />

          <div className="flex items-center gap-2">
            <OfflineBadge org={orgSlug} />
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-0.5 text-[11px] font-medium capitalize text-[var(--fg-muted)] hidden sm:inline">
              {userRole.replace("_", " ").toLowerCase()}
            </span>
            <span className="text-[10px] text-[var(--fg-muted)] opacity-50">v0.4</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}

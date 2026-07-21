import { requireTenant, getAccessibleOrganizations } from "@/lib/tenant/context";
import { can, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { initials, cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { SidebarNavLinks, type SerializableNavItem } from "@/components/sidebar-nav";
import { OfflineBadge } from "@/components/offline-badge";

type NavItem =
  | { section: string }
  | { href: string; label: string; iconName: string; permission?: Permission };

// ── Lerato Foundation ─────────────────────────────────────────────────────────
const NAV_FOUNDATION: NavItem[] = [
  { href: "", label: "Dashboard", iconName: "Home" },
  { section: "People" },
  { href: "/beneficiaries", label: "Beneficiaries",    iconName: "Users",         permission: PERMISSIONS.BENEFICIARY_READ },
  { href: "/donors",        label: "Donors",            iconName: "Heart",         permission: PERMISSIONS.DONOR_READ },
  { href: "/staff",         label: "Staff & Volunteers",iconName: "ShieldCheck",   permission: PERMISSIONS.STAFF_READ },
  { href: "/partners",      label: "Partners",          iconName: "Users",         permission: PERMISSIONS.PARTNER_READ },
  { section: "Finance" },
  { href: "/finance",               label: "Finance",           iconName: "CreditCard",    permission: PERMISSIONS.FINANCE_READ },
  { href: "/allocations",           label: "Allocations",       iconName: "ArrowLeftRight",permission: PERMISSIONS.ALLOCATION_READ },
  { section: "Accounting" },
  { href: "/finance/accounts",      label: "Chart of Accounts", iconName: "BookOpen",      permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/budget",        label: "Budgets",           iconName: "TrendingDown",  permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/trial-balance", label: "Trial Balance",     iconName: "Scale",         permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/statements",    label: "Statements",        iconName: "BarChart2",     permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/reconcile",     label: "Reconcile",         iconName: "GitMerge",      permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/assets",        label: "Fixed Assets",      iconName: "Landmark",      permission: PERMISSIONS.FINANCE_READ },
  { section: "Human Resources" },
  { href: "/hr",            label: "HR & People",       iconName: "Users2",        permission: PERMISSIONS.STAFF_READ },
  { href: "/hr/leave",      label: "Leave",             iconName: "CalendarMinus", permission: PERMISSIONS.STAFF_READ },
  { href: "/hr/payroll",    label: "Payroll",           iconName: "Banknote",      permission: PERMISSIONS.FINANCE_READ },
  { section: "Procurement" },
  { href: "/procurement",          label: "Overview",        iconName: "ShoppingCart",  permission: PERMISSIONS.FINANCE_READ },
  { href: "/procurement/vendors",  label: "Vendors",         iconName: "Building2",     permission: PERMISSIONS.FINANCE_READ },
  { href: "/procurement/orders",   label: "Purchase Orders", iconName: "ClipboardList", permission: PERMISSIONS.FINANCE_READ },
  { section: "Operations" },
  { href: "/events",         label: "Events",        iconName: "CalendarDays",  permission: PERMISSIONS.EVENT_READ },
  { href: "/communications", label: "Communications",iconName: "MessageSquare", permission: PERMISSIONS.COMM_SEND },
  { section: "Impact" },
  { href: "/education", label: "Programmes", iconName: "GraduationCap", permission: PERMISSIONS.PROGRAM_READ },
  { href: "/reports",   label: "Reports",    iconName: "BarChart3",     permission: PERMISSIONS.REPORT_READ },
  { section: "Admin" },
  { href: "/settings",  label: "Settings",   iconName: "Settings",      permission: PERMISSIONS.ORG_SETTINGS },
  { href: "/sync",      label: "Offline Sync", iconName: "CloudUpload" },
];

// ── Darajani Sports Academy ───────────────────────────────────────────────────
const NAV_ACADEMY: NavItem[] = [
  { href: "", label: "Dashboard", iconName: "Home" },
  { section: "Athletes" },
  { href: "/beneficiaries", label: "Players",         iconName: "Users",       permission: PERMISSIONS.BENEFICIARY_READ },
  { section: "Training" },
  { href: "/branches",      label: "Branches",        iconName: "MapPin",      permission: PERMISSIONS.BRANCH_READ },
  { section: "Competition" },
  { href: "/events",        label: "Fixtures & Events",iconName: "CalendarDays",permission: PERMISSIONS.EVENT_READ },
  { section: "Administration" },
  { href: "/staff",         label: "Coaches & Staff", iconName: "ShieldCheck", permission: PERMISSIONS.STAFF_READ },
  { href: "/donors",        label: "Sponsors",        iconName: "Heart",       permission: PERMISSIONS.DONOR_READ },
  { href: "/partners",      label: "Partners",        iconName: "Users2",      permission: PERMISSIONS.PARTNER_READ },
  { section: "Finance" },
  { href: "/finance",       label: "Finance",         iconName: "CreditCard",  permission: PERMISSIONS.FINANCE_READ },
  { section: "Accounting" },
  { href: "/finance/accounts",      label: "Chart of Accounts", iconName: "BookOpen",     permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/budget",        label: "Budgets",           iconName: "TrendingDown", permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/trial-balance", label: "Trial Balance",     iconName: "Scale",        permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/statements",    label: "Statements",        iconName: "BarChart2",    permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/reconcile",     label: "Reconcile",         iconName: "GitMerge",     permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/assets",        label: "Fixed Assets",      iconName: "Landmark",     permission: PERMISSIONS.FINANCE_READ },
  { section: "Compliance" },
  { href: "/reports",       label: "Reports",         iconName: "BarChart3",   permission: PERMISSIONS.REPORT_READ },
  { section: "Communications" },
  { href: "/communications",label: "Communications",  iconName: "MessageSquare",permission: PERMISSIONS.COMM_SEND },
  { section: "Admin" },
  { href: "/settings",      label: "Settings",        iconName: "Settings",    permission: PERMISSIONS.ORG_SETTINGS },
  { href: "/sync",          label: "Offline Sync",    iconName: "CloudUpload" },
];

// ── Agape in Action (Mission) ─────────────────────────────────────────────────
const NAV_MISSION: NavItem[] = [
  { href: "", label: "Dashboard", iconName: "Home" },
  { section: "Community" },
  { href: "/beneficiaries", label: "Community Served",    iconName: "Users",        permission: PERMISSIONS.BENEFICIARY_READ },
  { href: "/partners",      label: "Partners",            iconName: "Users2",       permission: PERMISSIONS.PARTNER_READ },
  { href: "/donors",        label: "Donors & Supporters", iconName: "Heart",        permission: PERMISSIONS.DONOR_READ },
  { section: "Missions" },
  { href: "/missions",      label: "Mission Trips",       iconName: "Plane",        permission: PERMISSIONS.MISSION_READ },
  { section: "Programmes" },
  { href: "/education",     label: "Programmes",          iconName: "GraduationCap",permission: PERMISSIONS.PROGRAM_READ },
  { section: "People" },
  { href: "/staff",         label: "Volunteers",          iconName: "ShieldCheck",  permission: PERMISSIONS.STAFF_READ },
  { section: "Operations" },
  { href: "/events",         label: "Events & Camps",  iconName: "CalendarDays",  permission: PERMISSIONS.EVENT_READ },
  { href: "/communications", label: "Communications",  iconName: "MessageSquare", permission: PERMISSIONS.COMM_SEND },
  { section: "Finance" },
  { href: "/finance",        label: "Finance",         iconName: "CreditCard",    permission: PERMISSIONS.FINANCE_READ },
  { section: "Accounting" },
  { href: "/finance/accounts",      label: "Chart of Accounts", iconName: "BookOpen",     permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/budget",        label: "Budgets",           iconName: "TrendingDown", permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/trial-balance", label: "Trial Balance",     iconName: "Scale",        permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/statements",    label: "Statements",        iconName: "BarChart2",    permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/reconcile",     label: "Reconcile",         iconName: "GitMerge",     permission: PERMISSIONS.FINANCE_READ },
  { href: "/finance/assets",        label: "Fixed Assets",      iconName: "Landmark",     permission: PERMISSIONS.FINANCE_READ },
  { section: "Impact" },
  { href: "/reports",        label: "Reports",         iconName: "BarChart3",     permission: PERMISSIONS.REPORT_READ },
  { section: "Admin" },
  { href: "/settings",       label: "Settings",        iconName: "Settings",      permission: PERMISSIONS.ORG_SETTINGS },
  { href: "/sync",           label: "Offline Sync",    iconName: "CloudUpload" },
];

const NAV_BY_TYPE: Partial<Record<string, NavItem[]>> = {
  FOUNDATION: NAV_FOUNDATION,
  ACADEMY:    NAV_ACADEMY,
  MISSION:    NAV_MISSION,
};

export default async function OrgDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const accessibleOrgs = await getAccessibleOrganizations();

  const themeStyle = {
    "--brand-primary": ctx.organization.primaryColor,
    "--brand-secondary": ctx.organization.secondaryColor,
    "--brand-accent": ctx.organization.accentColor || "#ED1C24",
  } as React.CSSProperties;

  const navItems: NavItem[] = NAV_BY_TYPE[ctx.organization.type] ?? NAV_FOUNDATION;
  const visibleNav = navItems.filter((item: NavItem) => {
    if ("section" in item) return true;
    if (!item.permission) return true;
    return can(ctx.role, ctx.permissions, item.permission);
  });

  const serializedNav: SerializableNavItem[] = visibleNav.map((item: NavItem) => {
    if ("section" in item) return { section: item.section };
    return { href: item.href, label: item.label, iconName: item.iconName };
  });

  return (
    <div style={themeStyle} className="flex min-h-screen bg-[var(--bg-muted)]">
      {/* Sidebar */}
      <aside className="relative flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]">
        {/* Branded header */}
        <div
          className="relative overflow-hidden px-4 pb-5 pt-5"
          style={{ background: ctx.organization.primaryColor }}
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-0 h-12 w-12 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white/30 bg-white/20 text-base font-bold text-white backdrop-blur-sm">
              {ctx.organization.shortName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-display text-sm font-bold leading-tight text-white">
                {ctx.organization.shortName}
              </div>
              <div className="mt-0.5 text-[11px] capitalize text-white/60">
                {ctx.organization.type === "FOUNDATION" ? "Foundation"
                  : ctx.organization.type === "ACADEMY" ? "Sports Academy"
                  : "Mission"}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <SidebarNavLinks items={serializedNav} orgSlug={ctx.organization.slug} />

        {/* User footer */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--bg-muted)]">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: ctx.organization.primaryColor }}
            >
              {initials(ctx.user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-[var(--fg)]">{ctx.user.name}</div>
              <div className="truncate text-[10px] capitalize text-[var(--fg-muted)]">
                {ctx.user.title ?? ctx.role.replace("_", " ").toLowerCase()}
              </div>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button
                title="Sign out"
                className="rounded-md p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-6">
          <OrgSwitcher current={ctx.organization.slug} orgs={accessibleOrgs} />
          <div className="flex items-center gap-2">
            <OfflineBadge org={ctx.organization.slug} />
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-0.5 text-[11px] font-medium capitalize text-[var(--fg-muted)]">
              {ctx.role.replace("_", " ").toLowerCase()}
            </span>
            <span className="text-[10px] text-[var(--fg-muted)] opacity-50">v0.4</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}

function OrgSwitcher({
  current,
  orgs,
}: {
  current: string;
  orgs: { slug: string; shortName: string; primaryColor: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] p-1">
      {orgs.map((o) => (
        <Link
          key={o.slug}
          href={`/${o.slug}` as any}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150",
            o.slug === current
              ? "text-white shadow-sm"
              : "text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
          )}
          style={o.slug === current ? { background: o.primaryColor } : undefined}
        >
          {o.slug !== current && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.primaryColor }} />
          )}
          {o.shortName}
        </Link>
      ))}
    </div>
  );
}

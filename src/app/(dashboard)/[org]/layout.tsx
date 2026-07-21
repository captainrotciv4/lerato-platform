import { requireTenant, getAccessibleOrganizations } from "@/lib/tenant/context";
import { can, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { signOut } from "@/lib/auth";
import { SidebarShell } from "@/components/sidebar-shell";
import type { SerializableNavItem } from "@/components/sidebar-nav";

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

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  };

  return (
    <SidebarShell
      orgShortName={ctx.organization.shortName}
      orgType={ctx.organization.type}
      primaryColor={ctx.organization.primaryColor}
      themeStyle={themeStyle}
      navItems={serializedNav}
      orgSlug={ctx.organization.slug}
      userName={ctx.user.name}
      userTitle={ctx.user.title ?? null}
      userRole={ctx.role}
      accessibleOrgs={accessibleOrgs.map((o) => ({
        slug: o.slug,
        shortName: o.shortName,
        primaryColor: o.primaryColor,
      }))}
      signOutAction={signOutAction}
    >
      {children}
    </SidebarShell>
  );
}

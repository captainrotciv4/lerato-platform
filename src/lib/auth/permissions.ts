/**
 * Default permission sets per role.
 *
 * A user's effective permission set = role defaults UNION their Membership.permissions[] override.
 * Use `can(role, overrides, "beneficiary:write")` in server components and actions.
 */

import type { Role } from "@prisma/client";

export const PERMISSIONS = {
  // People
  BENEFICIARY_READ: "beneficiary:read",
  BENEFICIARY_WRITE: "beneficiary:write",
  BENEFICIARY_DELETE: "beneficiary:delete",
  DONOR_READ: "donor:read",
  DONOR_WRITE: "donor:write",
  STAFF_READ: "staff:read",
  STAFF_WRITE: "staff:write",
  PARTNER_READ: "partner:read",
  PARTNER_WRITE: "partner:write",

  // Programs
  PROGRAM_READ: "program:read",
  PROGRAM_WRITE: "program:write",
  ATTENDANCE_WRITE: "attendance:write",
  MISSION_READ: "mission:read",
  MISSION_WRITE: "mission:write",

  // Operations
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",
  EVENT_READ: "event:read",
  EVENT_WRITE: "event:write",
  COMM_SEND: "comm:send",

  // Allocations & approvals
  ALLOCATION_READ: "allocation:read",
  ALLOCATION_WRITE: "allocation:write",          // create + submit
  ALLOCATION_APPROVE: "allocation:approve",      // act on approvals assigned to me
  ALLOCATION_EXECUTE: "allocation:execute",      // execute fully-approved allocations
  ALLOCATION_RULE_WRITE: "allocation:rule:write",// configure thresholds per org

  // Impact
  REPORT_READ: "report:read",
  REPORT_GENERATE: "report:generate",
  OUTCOME_WRITE: "outcome:write",

  // Academy branches (Darajani)
  BRANCH_READ: "branch:read",
  BRANCH_WRITE: "branch:write",

  // Org admin
  USER_INVITE: "user:invite",
  USER_REMOVE: "user:remove",
  ORG_SETTINGS: "org:settings",
  AUDIT_VIEW: "audit:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const READ_ALL: Permission[] = [
  PERMISSIONS.BENEFICIARY_READ,
  PERMISSIONS.DONOR_READ,
  PERMISSIONS.STAFF_READ,
  PERMISSIONS.PARTNER_READ,
  PERMISSIONS.PROGRAM_READ,
  PERMISSIONS.MISSION_READ,
  PERMISSIONS.FINANCE_READ,
  PERMISSIONS.EVENT_READ,
  PERMISSIONS.REPORT_READ,
  PERMISSIONS.ALLOCATION_READ,
  PERMISSIONS.BRANCH_READ,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: Object.values(PERMISSIONS) as Permission[],

  PROGRAMME_MANAGER: [
    ...READ_ALL,
    PERMISSIONS.BENEFICIARY_WRITE,
    PERMISSIONS.PROGRAM_WRITE,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.MISSION_WRITE,
    PERMISSIONS.EVENT_WRITE,
    PERMISSIONS.OUTCOME_WRITE,
    PERMISSIONS.REPORT_GENERATE,
    PERMISSIONS.BRANCH_WRITE,
  ],

  FINANCE: [
    ...READ_ALL,
    PERMISSIONS.FINANCE_WRITE,
    PERMISSIONS.ALLOCATION_WRITE,        // can create allocation requests
    PERMISSIONS.REPORT_GENERATE,
  ],

  FINANCE_LEAD: [
    ...READ_ALL,
    PERMISSIONS.FINANCE_WRITE,
    PERMISSIONS.ALLOCATION_WRITE,
    PERMISSIONS.ALLOCATION_APPROVE,      // can approve up to mid-tier
    PERMISSIONS.ALLOCATION_EXECUTE,      // can execute approved allocations
    PERMISSIONS.REPORT_GENERATE,
  ],

  COMMUNICATIONS: [
    PERMISSIONS.BENEFICIARY_READ,
    PERMISSIONS.DONOR_READ,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.EVENT_READ,
    PERMISSIONS.COMM_SEND,
  ],

  FIELD_STAFF: [
    PERMISSIONS.BENEFICIARY_READ,
    PERMISSIONS.PROGRAM_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.OUTCOME_WRITE,
  ],

  BOARD_OBSERVER: READ_ALL,

  BOARD_MEMBER: [
    ...READ_ALL,
    PERMISSIONS.ALLOCATION_APPROVE,      // board members approve high-tier allocations
    PERMISSIONS.REPORT_GENERATE,
    PERMISSIONS.AUDIT_VIEW,
  ],
};

/** Resolve a user's effective permission set within an organization. */
export function effectivePermissions(role: Role, overrides: string[] = []): Permission[] {
  const base = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const p of overrides) {
    base.add(p as Permission);
  }
  return Array.from(base);
}

/** Check whether a role + override combo has a permission. */
export function can(role: Role, overrides: string[] = [], permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return ROLE_PERMISSIONS[role].includes(permission) || overrides.includes(permission);
}

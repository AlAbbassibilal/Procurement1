// ---------------------------------------------------------------------------
// Function-level permissions — what each person may DO inside a workspace,
// on top of workspace access (which decides what they can OPEN).
// Role defaults keep today's behaviour; an administrator can grant or deny any
// single function per user (Users & access → Permissions).
// ---------------------------------------------------------------------------
import type { Department, Role, User } from '@/types'

export interface PermissionDef { key: string; label: string }
export const PERMISSIONS: Record<Department, PermissionDef[]> = {
  grants: [
    { key: 'grants.project.create', label: 'Create projects / proposals' },
    { key: 'grants.project.edit', label: 'Edit project documents (proposal, logframe, work plan, spending plan, IPTT, reports, tasks)' },
    { key: 'grants.project.stage', label: 'Move projects between stages (submit · granted · active · closed)' },
    { key: 'grants.donors.edit', label: 'Add / edit donor contacts' },
    { key: 'grants.budget.edit', label: 'Edit project budget lines from the project Budget tab' },
  ],
  finance: [
    { key: 'finance.invoice.register', label: 'Register invoices and run the 3-way match' },
    { key: 'finance.budget.edit', label: 'Upload, close, re-open and delete approved budgets; manage templates' },
    { key: 'finance.bva.update', label: 'Update BvA figures (funds received) without editing the budget' },
    { key: 'finance.invoice.pay', label: 'Override 3-way-match exceptions and record payments' },
    { key: 'finance.master_budget.edit', label: 'Edit master budget lines (all lines, not only own)' },
    { key: 'finance.master_budget.approve', label: 'Approve / re-open the master budget' },
    { key: 'finance.salary_plan.edit', label: 'Edit the master salary plan (staff, salaries, positions)' },
    { key: 'finance.payroll.run', label: 'Run payroll and generate payslips' },
    { key: 'finance.approval_matrix.edit', label: 'Edit the approval matrix' },
  ],
  procurement: [
    { key: 'supply.pr.create', label: 'Raise purchase requisitions' },
    { key: 'supply.sourcing', label: 'Run sourcing (quotations, bids, award) and issue purchase orders' },
    { key: 'supply.receiving', label: 'Post goods receipts' },
    { key: 'supply.vendors.edit', label: 'Register / edit vendors' },
    { key: 'supply.thresholds.edit', label: 'Edit procurement thresholds (SOP tiers)' },
    { key: 'supply.stock.manage', label: 'Manage warehouses, stock, adjustments and transfers' },
    { key: 'supply.release.issue', label: 'Issue stock against approved release requests' },
    { key: 'supply.assets.manage', label: 'Register assets, hand over, transfer, verify, dispose' },
    { key: 'supply.fleet.manage', label: 'Manage vehicles, assign and close trips' },
    { key: 'supply.waybills.manage', label: 'Issue manual waybills' },
  ],
  partnerships: [
    { key: 'partners.edit', label: 'Add partners and fill due-diligence files' },
    { key: 'partners.manage', label: 'Move partner stages, record decisions, remove partners' },
  ],
  hr: [
    { key: 'hr.staff.manage', label: 'Edit the staff register and the org chart' },
    { key: 'hr.requests.decide_any', label: 'Decide leave / WFH requests for anyone (not only own reports)' },
    { key: 'hr.timesheets.approve', label: 'Approve / return timesheets' },
    { key: 'hr.recruitment.raise', label: 'Raise recruitment requests' },
    { key: 'hr.recruitment.advertise', label: 'Create advertisements and manage applicants' },
  ],
  media: [],
}
export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS).flatMap((l) => l.map((p) => p.key))

const G = ['grants.project.create', 'grants.project.edit', 'grants.project.stage', 'grants.donors.edit', 'grants.budget.edit']
const F = ['finance.invoice.register', 'finance.invoice.pay', 'finance.budget.edit', 'finance.bva.update', 'finance.master_budget.edit', 'finance.master_budget.approve', 'finance.salary_plan.edit', 'finance.payroll.run', 'finance.approval_matrix.edit']
const S = ['supply.pr.create', 'supply.sourcing', 'supply.receiving', 'supply.vendors.edit', 'supply.thresholds.edit', 'supply.stock.manage', 'supply.release.issue', 'supply.assets.manage', 'supply.fleet.manage', 'supply.waybills.manage']
const P = ['partners.edit', 'partners.manage']
const H = ['hr.staff.manage', 'hr.requests.decide_any', 'hr.timesheets.approve', 'hr.recruitment.raise', 'hr.recruitment.advertise']
/** Defaults by role — mirrors the behaviour before function permissions existed. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ALL_PERMISSION_KEYS,
  executive_director: [...G, ...F, ...S, ...P, ...H],
  programs_director: [...G, 'finance.budget.edit', 'finance.bva.update', 'supply.pr.create', 'supply.receiving', ...P, 'hr.recruitment.raise'],
  finance_director: ['grants.budget.edit', ...F, 'supply.pr.create', 'supply.receiving', 'partners.edit', 'hr.recruitment.raise'],
  finance: ['grants.budget.edit', 'finance.invoice.register', 'finance.invoice.pay', 'finance.budget.edit', 'finance.bva.update', 'supply.pr.create', 'supply.receiving'],
  procurement_manager: ['supply.pr.create', 'supply.sourcing', 'supply.receiving', 'supply.vendors.edit', 'supply.stock.manage', 'supply.release.issue', 'supply.assets.manage', 'supply.fleet.manage', 'supply.waybills.manage', 'grants.donors.edit', 'hr.recruitment.raise', 'finance.invoice.register'],
  procurement_officer: ['supply.pr.create', 'supply.sourcing', 'supply.receiving', 'supply.vendors.edit', 'supply.stock.manage', 'supply.release.issue', 'supply.assets.manage', 'supply.fleet.manage', 'supply.waybills.manage', 'finance.invoice.register'],
  dept_manager: ['grants.project.edit', 'supply.pr.create', 'supply.receiving', 'hr.recruitment.raise'],
  requester: ['grants.project.edit', 'supply.pr.create', 'supply.receiving'],
  legal: ['partners.edit', 'supply.pr.create'],
  logistics: ['supply.pr.create', 'supply.receiving', 'supply.stock.manage', 'supply.release.issue', 'supply.assets.manage', 'supply.fleet.manage', 'supply.waybills.manage'],
  hr: ['supply.pr.create', ...H],
}
/** May this user perform the function? Administrators always can; explicit overrides win over the role default. */
export const can = (user: User, key: string): boolean => user.role === 'admin' ? true : (user.permissions?.[key] ?? ROLE_PERMISSIONS[user.role]?.includes(key) ?? false)
export const permissionsOf = (user: User): Record<string, boolean> => Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, can(user, k)]))
export const customCount = (user: User) => Object.entries(user.permissions ?? {}).filter(([k, v]) => v !== ROLE_PERMISSIONS[user.role]?.includes(k)).length

// ---------------------------------------------------------------------------
// Platform workspaces — the six department cards on the home hub.
// Each workspace owns a set of routes; a user enters it according to their
// access level (none / view / edit / manage), defaulting from their role.
// ---------------------------------------------------------------------------
import type { AccessLevel, Department, Role, User } from '@/types'

export interface ModuleLink { to: string; label: string; soon?: boolean }
export interface DepartmentDef {
  id: Department
  name: string
  short: string            // card tagline
  description: string
  home: string             // landing route
  paths: string[]          // route prefixes owned by this workspace
  tone: { tile: string; text: string; ring: string }
  modules: ModuleLink[]
}

export const DEPARTMENTS: DepartmentDef[] = [
  {
    id: 'grants', name: 'Grants', short: 'Projects, donors & budgets', home: '/grants', paths: ['/grants', '/budgets'],
    description: 'The project cycle from proposal to close-out: grant register, approved budgets, donor agreements and reporting obligations. Every other workspace charges its work to a project here.',
    tone: { tile: 'bg-brand-600 text-white', text: 'text-brand-700', ring: 'ring-brand-200' },
    modules: [{ to: '/grants', label: 'Overview' }, { to: '/grants/tracker', label: 'Grants tracker' }, { to: '/grants/new', label: 'New project / proposal' }, { to: '/grants/donors', label: 'Donor contacts' }, { to: '/budgets', label: 'Budgets & BvA' }],
  },
  {
    id: 'partnerships', name: 'Partnerships', short: 'Partners, MoUs & due diligence', home: '/partnerships', paths: ['/partnerships'],
    description: 'Implementing partners, government counterparts and institutional relationships: partner register, agreements and MoUs, due-diligence and partner reporting.',
    tone: { tile: 'bg-info-500 text-white', text: 'text-info-700', ring: 'ring-info-500/30' },
    modules: [{ to: '/partnerships', label: 'Overview' }, { to: '/partnerships/partners', label: 'Partner register' }, { to: '/partnerships/due-diligence', label: 'Due diligence tracker' }, { to: '/partnerships/agreements', label: 'Agreements & MoUs', soon: true }, { to: '/partnerships/reporting', label: 'Partner reporting', soon: true }],
  },
  {
    id: 'procurement', name: 'Supply Chain', short: 'Procurement, warehouses, assets & fleet', home: '/procurement', paths: ['/procurement', '/supply-chain', '/requisitions', '/sourcing', '/orders', '/contracts', '/receiving', '/vendors', '/admin/thresholds', '/warehouses', '/stock-requests', '/waybills', '/assets', '/fleet'],
    description: 'Procure-to-pay (requisitions, SOP-driven sourcing, purchase orders, contracts, goods receipt and suppliers), warehouses and stock in every country, waybills, the asset registry and fleet management.',
    tone: { tile: 'bg-brand-800 text-white', text: 'text-brand-800', ring: 'ring-brand-300' },
    modules: [{ to: '/procurement', label: 'Overview' }, { to: '/requisitions', label: 'Requisitions' }, { to: '/sourcing', label: 'Sourcing & quotations' }, { to: '/orders', label: 'Purchase orders' }, { to: '/contracts', label: 'Contracts' }, { to: '/receiving', label: 'Goods receipt (GRN)' }, { to: '/waybills', label: 'Waybills' }, { to: '/warehouses', label: 'Warehouses & stock' }, { to: '/stock-requests', label: 'Stock release requests' }, { to: '/assets', label: 'Asset registry' }, { to: '/fleet', label: 'Fleet & transport' }, { to: '/vendors', label: 'Vendors' }, { to: '/admin/thresholds', label: 'Procurement thresholds' }, { to: '/supply-chain/process', label: 'Process documentation' }],
  },
  {
    id: 'finance', name: 'Financial', short: 'Payments, budgets & reporting', home: '/finance', paths: ['/finance', '/invoices', '/admin/approval-matrix'],
    description: 'Invoice matching and payment authorisation, budget control and Budget-vs-Actual, approval authorities and donor financial reporting.',
    tone: { tile: 'bg-sun-500 text-ink-900', text: 'text-sun-700', ring: 'ring-sun-300' },
    modules: [{ to: '/finance', label: 'Overview' }, { to: '/finance/master-budget', label: 'Master budget' }, { to: '/finance/salary-plan', label: 'Master salary plan' }, { to: '/invoices', label: 'Invoices & payments' }, { to: '/budgets', label: 'Budgets & BvA' }, { to: '/grants/tracker', label: 'Grants tracker' }, { to: '/admin/approval-matrix', label: 'Approval matrix' }, { to: '/finance/payments', label: 'Payments register', soon: true }, { to: '/finance/reports', label: 'Donor financial reports', soon: true }],
  },
  {
    id: 'hr', name: 'HR & Admin', short: 'People, time & office', home: '/hr', paths: ['/hr'],
    description: 'Staff register and contracts, leave and attendance, timesheets and level-of-effort against projects, and administrative requests.',
    tone: { tile: 'bg-ink-700 text-white', text: 'text-ink-700', ring: 'ring-ink-300' },
    modules: [{ to: '/hr', label: 'Overview' }, { to: '/hr/me', label: 'My HR' }, { to: '/hr/staff', label: 'Staff register' }, { to: '/hr/requests', label: 'Leave & WFH requests' }, { to: '/hr/timesheets', label: 'Timesheets' }, { to: '/hr/attendance', label: 'Attendance' }, { to: '/hr/payroll', label: 'Payroll & payslips' }, { to: '/hr/recruitment', label: 'Recruitment' }, { to: '/finance/salary-plan', label: 'Master salary plan' }],
  },
  {
    id: 'media', name: 'Media & Communication', short: 'Visibility & content', home: '/media', paths: ['/media'],
    description: 'Content calendar, visibility commitments per grant, media assets and coverage log, and communication approvals.',
    tone: { tile: 'bg-accent-600 text-white', text: 'text-accent-700', ring: 'ring-accent-200' },
    modules: [{ to: '/media', label: 'Overview' }, { to: '/media/calendar', label: 'Content calendar', soon: true }, { to: '/media/visibility', label: 'Visibility log', soon: true }, { to: '/media/assets', label: 'Media assets', soon: true }],
  },
]

export const DEPT = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d])) as Record<Department, DepartmentDef>
export const ACCESS_LABEL: Record<AccessLevel, string> = { none: 'No access', view: 'View', edit: 'Edit', manage: 'Manage' }

/** Default workspace access by role — the admin can override per user. */
const ROLE_DEFAULTS: Record<Role, Partial<Record<Department, AccessLevel>>> = {
  admin:               { grants: 'manage', partnerships: 'manage', procurement: 'manage', finance: 'manage', hr: 'manage', media: 'manage' },
  executive_director:  { grants: 'manage', partnerships: 'manage', procurement: 'manage', finance: 'manage', hr: 'manage', media: 'manage' },
  programs_director:   { grants: 'manage', partnerships: 'manage', procurement: 'edit', finance: 'view', hr: 'view', media: 'edit' },
  finance_director:    { grants: 'edit', partnerships: 'view', procurement: 'edit', finance: 'manage', hr: 'view' },
  finance:             { grants: 'view', procurement: 'edit', finance: 'manage' },
  procurement_manager: { grants: 'view', procurement: 'manage', finance: 'view' },
  procurement_officer: { grants: 'view', procurement: 'manage', finance: 'view' },
  dept_manager:        { grants: 'view', procurement: 'edit', hr: 'view' },
  requester:           { grants: 'view', procurement: 'edit' },
  legal:               { grants: 'view', partnerships: 'edit', procurement: 'view' },
  logistics:           { procurement: 'edit' },
  hr:                  { grants: 'view', procurement: 'edit', finance: 'view', hr: 'manage' },
}

export const defaultAccess = (role: Role): Record<Department, AccessLevel> =>
  Object.fromEntries(DEPARTMENTS.map((d) => [d.id, ROLE_DEFAULTS[role]?.[d.id] ?? 'none'])) as Record<Department, AccessLevel>

export const effectiveAccess = (user: User): Record<Department, AccessLevel> => ({ ...defaultAccess(user.role), ...(user.access ?? {}) })
export const accessOf = (user: User, dept: Department): AccessLevel => effectiveAccess(user)[dept]
export const canEnter = (user: User, dept: Department) => accessOf(user, dept) !== 'none'

/** Which workspace owns a route (undefined = global: home, approvals, audit, admin). */
export function deptForPath(pathname: string): DepartmentDef | undefined {
  const p = pathname.replace(/\/+$/, '') || '/'
  return DEPARTMENTS.find((d) => d.paths.some((x) => p === x || p.startsWith(x + '/')))
}

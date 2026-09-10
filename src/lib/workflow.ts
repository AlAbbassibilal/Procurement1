// ---------------------------------------------------------------------------
// Approval workflow engine
// Builds an approval chain from the configurable approval matrix, and applies
// approve / reject / return / delegate decisions with full step tracking.
// ---------------------------------------------------------------------------
import type { ApprovalRule, ApprovalStep, DocType, Role, User } from '@/types'
import { uid } from './format'

export const ROLE_LABEL: Record<Role, string> = {
  requester: 'Requester',
  dept_manager: 'Department Manager',
  finance: 'Finance',
  procurement_officer: 'Procurement Officer',
  procurement_manager: 'Procurement Manager',
  executive_director: 'Executive Director',
  legal: 'Legal Counsel',
  admin: 'System Administrator',
}

export function findRule(rules: ApprovalRule[], docType: DocType, amount: number): ApprovalRule | undefined {
  return rules
    .filter((r) => r.docType === docType)
    .sort((a, b) => a.minAmount - b.minAmount)
    .find((r) => amount >= r.minAmount && (r.maxAmount === null || amount <= r.maxAmount))
}

/** Resolve a specific approver for a step: same-department manager where relevant, else first active user with the role. */
export function resolveApprover(users: User[], role: Role, department?: string): User | undefined {
  const active = users.filter((u) => u.active && u.role === role)
  if (role === 'dept_manager' && department) {
    const same = active.find((u) => u.department === department)
    if (same) return same
  }
  return active[0]
}

export function buildChain(rules: ApprovalRule[], users: User[], docType: DocType, amount: number, department?: string): ApprovalStep[] {
  const rule = findRule(rules, docType, amount)
  if (!rule) return []
  return rule.steps.map((s, i) => ({
    id: uid('step_'),
    order: i + 1,
    label: s.label,
    role: s.role,
    approverId: resolveApprover(users, s.role, department)?.id,
    status: i === 0 ? 'current' : 'pending',
  }))
}

export function currentStep(chain: ApprovalStep[]): ApprovalStep | undefined {
  return chain.find((s) => s.status === 'current')
}

/** Can this user act on the current step? Either the resolved approver, a delegate, or anyone holding the role (fallback). */
export function canApprove(chain: ApprovalStep[], user: User): boolean {
  const step = currentStep(chain)
  if (!step) return false
  if (step.delegatedTo) return step.delegatedTo === user.id
  if (step.approverId) return step.approverId === user.id || (user.role === 'admin')
  return step.role === user.role || user.role === 'admin'
}

export type DecisionResult = { chain: ApprovalStep[]; outcome: 'advanced' | 'completed' | 'rejected' | 'returned' | 'delegated' }

export function applyDecision(
  chain: ApprovalStep[],
  decision: 'approved' | 'rejected' | 'returned' | 'delegated',
  actor: User,
  comment?: string,
  delegateTo?: string,
): DecisionResult {
  const idx = chain.findIndex((s) => s.status === 'current')
  if (idx < 0) return { chain, outcome: 'completed' }
  const now = new Date().toISOString()
  const next = chain.map((s) => ({ ...s }))
  const step = next[idx]!

  if (decision === 'delegated') {
    step.delegatedTo = delegateTo
    step.comment = comment
    return { chain: next, outcome: 'delegated' }
  }

  step.status = decision
  step.decidedBy = actor.id
  step.decidedAt = now
  step.comment = comment

  if (decision === 'approved') {
    if (idx + 1 < next.length) {
      next[idx + 1]!.status = 'current'
      return { chain: next, outcome: 'advanced' }
    }
    return { chain: next, outcome: 'completed' }
  }
  return { chain: next, outcome: decision }
}

/** Reset a chain for re-submission after "returned" */
export function resetChain(chain: ApprovalStep[]): ApprovalStep[] {
  return chain.map((s, i) => ({
    ...s,
    status: i === 0 ? 'current' : 'pending',
    decidedAt: undefined,
    decidedBy: undefined,
    comment: undefined,
    delegatedTo: undefined,
  }))
}

export function chainProgress(chain: ApprovalStep[]) {
  const done = chain.filter((s) => s.status === 'approved').length
  return { done, total: chain.length, pct: chain.length ? Math.round((done / chain.length) * 100) : 0 }
}

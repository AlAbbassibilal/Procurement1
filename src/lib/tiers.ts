// ---------------------------------------------------------------------------
// Procurement thresholds & sourcing methods — RHS Procurement SOPs §3,
// SOP-PRO-03 (RFQ), SOP-PRO-04 (RFP / Tender), SOP-PRO-09 (Emergency & Sole Source)
// ---------------------------------------------------------------------------
import type { Currency, OrgSettings, ProcurementTier, PurchaseRequisition, SourcingMethod, User } from '@/types'
import { linesSubtotal } from './format'

export const METHOD_LABEL: Record<SourcingMethod, string> = {
  direct: 'Direct purchase',
  rfq: '3 written quotations',
  rfq_formal: 'RFQ with formal bid comparison',
  closed_bid: 'Closed bid — RFP / ITB',
  open_bid: 'Open bid — competitive tender (ICB)',
}
export const METHOD_SOP: Record<SourcingMethod, string> = {
  direct: 'SOP §3 · Petty cash / direct purchase',
  rfq: 'SOP-PRO-03 · Request for Quotation',
  rfq_formal: 'SOP-PRO-03 · Request for Quotation',
  closed_bid: 'SOP-PRO-04 · RFP / Tender',
  open_bid: 'SOP-PRO-04 · RFP / Tender',
}
export const METHOD_DESC: Record<SourcingMethod, string> = {
  direct: 'No formal quotation required. Record the supplier and agreed price; Department Head approves.',
  rfq: 'Issue the same RFQ simultaneously to at least 3 shortlisted suppliers. Open all quotations together with a witness and record the comparison.',
  rfq_formal: 'Formal RFQ to at least 3 suppliers with a documented Bid Comparison Table and selection rationale — the lowest price is not automatically the best option.',
  closed_bid: 'Restricted tender: RFP / ITB issued directly to at least 5 known qualified suppliers. Evaluation committee (min. 3, one technical) scores technical proposals before prices are opened.',
  open_bid: 'Publicly advertised international competitive tender (and/or donor platforms). Evaluation committee, technical then financial evaluation, donor approval where required.',
}
export const EXCEPTION_LABEL = {
  emergency: 'Genuine emergency',
  sole_source: 'Sole source / monopoly',
  proprietary: 'Proprietary requirement',
  donor_restriction: 'Donor-specified supplier',
} as const

export const toUSD = (amount: number, ccy: Currency, s: OrgSettings) => amount * (s.fxToUSD[ccy] ?? 1)
export const fromUSD = (usd: number, ccy: Currency, s: OrgSettings) => usd / (s.fxToUSD[ccy] ?? 1)

export function resolveTier(amountUSD: number, tiers: ProcurementTier[]): ProcurementTier | undefined {
  return [...tiers].sort((a, b) => a.minUSD - b.minUSD).find((t) => amountUSD >= t.minUSD && (t.maxUSD === null || amountUSD <= t.maxUSD))
}

export const isBidMethod = (m: SourcingMethod) => m === 'closed_bid' || m === 'open_bid'
export const isRfqMethod = (m: SourcingMethod) => m === 'rfq' || m === 'rfq_formal'

/** Value used to determine the tier: the higher of the estimate and the best quotation, so a low estimate cannot dodge a tier. */
export function effectiveAmount(pr: PurchaseRequisition) {
  const est = linesSubtotal(pr.lines)
  const bestQuote = pr.quotations.filter((q) => q.compliant && !q.late && q.subtotal > 0).map((q) => q.subtotal)
  return Math.max(est, ...bestQuote)
}

export function tierForPR(pr: PurchaseRequisition, s: OrgSettings) {
  const amount = effectiveAmount(pr)
  const amountUSD = toUSD(amount, pr.currency, s)
  return { amount, amountUSD, tier: resolveTier(amountUSD, s.tiers) }
}

/** Jordan working week is Sunday–Thursday. */
export function workingDaysBetween(from: string | Date, to: string | Date) {
  const a = new Date(from), b = new Date(to)
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0
  let n = 0
  for (const d = new Date(a); d < b; d.setDate(d.getDate() + 1)) { const wd = d.getDay(); if (wd !== 5 && wd !== 6) n++ }
  return n
}

export interface Requirement { ok: boolean; label: string; blocking: boolean; hint?: string }

/** The SOP checklist for a requisition under its tier — drives the sourcing page and award validation. */
export function sourcingRequirements(pr: PurchaseRequisition, s: OrgSettings, users: User[]): { tier?: ProcurementTier; amountUSD: number; reqs: Requirement[] } {
  const { tier, amountUSD } = tierForPR(pr, s)
  const src = pr.sourcing
  const reqs: Requirement[] = []
  if (!tier) return { tier, amountUSD, reqs: [{ ok: false, label: 'No procurement tier covers this value — check Settings › Thresholds', blocking: true }] }
  const quotes = pr.quotations.filter((q) => !q.late)
  reqs.push({ ok: !!pr.sourcingOwnerId, label: 'Sourcing officer assigned', blocking: true })

  // ---- Exception route (SOP-PRO-09) ---------------------------------------
  if (src.exception) {
    const ex = src.exception
    reqs.push({ ok: ex.justification.trim().length > 20, label: 'Written sole-source / emergency justification memo', blocking: true })
    if (amountUSD > s.soleSourceEdThresholdUSD) reqs.push({ ok: ex.decision === 'approved', label: `Executive Director pre-approval (value above USD ${s.soleSourceEdThresholdUSD.toLocaleString()})`, blocking: true, hint: ex.decision === 'rejected' ? 'Rejected — competitive sourcing required' : undefined })
    if (pr.donorCode) reqs.push({ ok: !!src.donorNotifiedAt, label: 'Donor notified of sole-source justification', blocking: true })
    reqs.push({ ok: quotes.length >= 1, label: 'Negotiated terms recorded as a quotation', blocking: true })
    reqs.push({ ok: quotes.every((q) => q.attachments.length > 0) && quotes.length > 0, label: 'Supplier offer document attached', blocking: false })
    return { tier, amountUSD, reqs }
  }

  // ---- Competitive routes --------------------------------------------------
  if (tier.method === 'direct') {
    reqs.push({ ok: quotes.length >= 1, label: 'Supplier price recorded', blocking: true })
    return { tier, amountUSD, reqs }
  }
  const invited = src.invitedVendorIds.length
  if (tier.method === 'open_bid') {
    reqs.push({ ok: !!src.advertisementRef?.trim(), label: 'Tender publicly advertised (reference recorded)', blocking: true })
  } else {
    reqs.push({ ok: invited >= tier.invitedSuppliersMin, label: `${isBidMethod(tier.method) ? 'RFP / ITB' : 'RFQ'} issued to at least ${tier.invitedSuppliersMin} suppliers (${invited} invited)`, blocking: true })
  }
  reqs.push({ ok: !!src.issuedAt && !!src.deadline, label: 'Issue date and submission deadline recorded', blocking: true })
  if (tier.deadlineWorkingDays > 0 && src.issuedAt && src.deadline) {
    const wd = workingDaysBetween(src.issuedAt, src.deadline)
    reqs.push({ ok: wd >= tier.deadlineWorkingDays, label: `Submission period of at least ${tier.deadlineWorkingDays} working days (${wd} given)`, blocking: true })
  }
  if (isBidMethod(tier.method)) {
    const c = src.committee
    const okSize = c.length >= tier.committeeMin, okTech = c.some((m) => m.role === 'technical'), okNda = c.length > 0 && c.every((m) => m.ndaSigned && m.coiDeclared)
    reqs.push({ ok: okSize && okTech, label: `Evaluation committee of at least ${tier.committeeMin} incl. one technical member (${c.length} named)`, blocking: true })
    reqs.push({ ok: okNda, label: 'All committee members signed NDA and conflict-of-interest declaration', blocking: true })
  } else {
    reqs.push({ ok: !!src.openingWitnessId, label: 'Quotations opened together in the presence of a witness', blocking: true, hint: src.openingWitnessId ? `Witness: ${users.find((u) => u.id === src.openingWitnessId)?.name ?? ''}` : undefined })
  }
  const fewerOk = !!src.fewerQuotesReason?.trim() && !!src.fewerQuotesApprovedBy
  reqs.push({ ok: quotes.length >= tier.minQuotations || fewerOk, label: `At least ${tier.minQuotations} ${isBidMethod(tier.method) ? 'bids' : 'written quotations'} received by the deadline (${quotes.length} recorded)`, blocking: true, hint: fewerOk ? 'Fewer accepted with documented reason and supervisor approval' : quotes.length < tier.minQuotations ? 'Or document the reason and obtain supervisor approval' : undefined })
  reqs.push({ ok: quotes.length > 0 && quotes.every((q) => q.attachments.length > 0), label: 'Every quotation / bid has its document attached', blocking: false })
  if (isBidMethod(tier.method)) {
    reqs.push({ ok: quotes.length > 0 && quotes.every((q) => typeof q.technicalScore === 'number'), label: 'Technical evaluation scored for every bid (before prices are compared)', blocking: true })
    reqs.push({ ok: (src.evaluationReport?.trim().length ?? 0) > 30 && !!src.evaluationSignedAt, label: 'Evaluation report written and signed by the committee', blocking: true })
  }
  if (tier.donorApproval) reqs.push({ ok: !!src.donorApprovalRef?.trim(), label: 'Donor approval / no-objection reference recorded', blocking: true })
  return { tier, amountUSD, reqs }
}

export const blockingFailures = (reqs: Requirement[]) => reqs.filter((r) => r.blocking && !r.ok)

export const emptySourcing = (): PurchaseRequisition['sourcing'] => ({ invitedVendorIds: [], committee: [], technicalPassMark: 70 })

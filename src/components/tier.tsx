// ---------------------------------------------------------------------------
// Procurement tier / sourcing-method presentation (SOP §3)
// ---------------------------------------------------------------------------
import { Link } from 'react-router-dom'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { fmtMoney, cx } from '@/lib/format'
import { METHOD_LABEL, METHOD_SOP, METHOD_DESC, resolveTier, toUSD } from '@/lib/tiers'
import type { Currency, SourcingMethod, PurchaseRequisition } from '@/types'

const METHOD_TONE: Record<SourcingMethod, string> = {
  direct: 'bg-ink-100 text-ink-700 ring-ink-200',
  rfq: 'bg-brand-50 text-brand-800 ring-brand-200',
  rfq_formal: 'bg-brand-100 text-brand-800 ring-brand-300',
  closed_bid: 'bg-sun-100 text-sun-700 ring-sun-300',
  open_bid: 'bg-accent-50 text-accent-700 ring-accent-200',
}
export function MethodBadge({ method, className }: { method: SourcingMethod; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', METHOD_TONE[method], className)}>{METHOD_LABEL[method]}</span>
}

export function TierCard({ amount, currency, procurementType, donorCode, compact }: {
  amount: number; currency: Currency; procurementType: PurchaseRequisition['procurementType']; donorCode?: string; compact?: boolean
}) {
  const { settings } = useStore()
  const usd = toUSD(amount, currency, settings)
  const tier = resolveTier(usd, settings.tiers)
  if (!tier) return <div className="rounded-control border border-danger-500/30 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">No procurement tier covers this value. <Link to="/admin/thresholds" className="underline">Check thresholds</Link>.</div>
  const svc = procurementType !== 'goods'
  const notes: { t: string; warn?: boolean }[] = []
  if (svc && usd > settings.contractThresholdUSD) notes.push({ t: `Formal contract required for ${procurementType} above USD ${settings.contractThresholdUSD.toLocaleString()}${usd > settings.legalReviewThresholdUSD ? ' — with legal review' : ''}.` })
  if (usd > settings.dualAuthThresholdUSD) notes.push({ t: 'PO requires dual authorisation; enhanced supplier due diligence applies.' })
  if (donorCode) notes.push({ t: `Donor-funded (${donorCode}) — check the grant agreement for lower thresholds or specific rules.`, warn: true })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={tier.method} />
        <span className="text-[12px] text-ink-500">{METHOD_SOP[tier.method]}</span>
      </div>
      <div>
        <div className="text-[15px] font-semibold text-ink-900">{tier.name}</div>
        <div className="text-[12.5px] text-ink-500">
          USD {tier.minUSD.toLocaleString()} – {tier.maxUSD === null ? 'no limit' : tier.maxUSD.toLocaleString()} · this request ≈ <b className="text-ink-800">USD {Math.round(usd).toLocaleString()}</b>
          {currency !== 'USD' && <span> (from {fmtMoney(amount, currency)} @ {settings.fxToUSD[currency]})</span>}
        </div>
      </div>
      {!compact && <p className="text-[12.5px] leading-relaxed text-ink-700">{METHOD_DESC[tier.method]}</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
        <dt className="text-ink-500">Min. quotations / bids</dt><dd className="font-medium text-ink-900">{tier.minQuotations === 0 ? 'None required' : tier.minQuotations}</dd>
        {tier.invitedSuppliersMin > 0 && <><dt className="text-ink-500">Issue to at least</dt><dd className="font-medium text-ink-900">{tier.invitedSuppliersMin} suppliers</dd></>}
        {tier.deadlineWorkingDays > 0 && <><dt className="text-ink-500">Submission period</dt><dd className="font-medium text-ink-900">≥ {tier.deadlineWorkingDays} working days</dd></>}
        {tier.committeeMin > 0 && <><dt className="text-ink-500">Evaluation committee</dt><dd className="font-medium text-ink-900">≥ {tier.committeeMin} members</dd></>}
        {tier.donorApproval && <><dt className="text-ink-500">Donor approval</dt><dd className="font-medium text-ink-900">Required before PO</dd></>}
      </dl>
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-500">Approval authority (PO / award)</div>
        <div className="flex flex-wrap items-center gap-1">{tier.approvers.map((a, i) => <span key={i} className="flex items-center gap-1"><span className="rounded-pill bg-brand-100 px-2 py-0.5 text-[11.5px] font-medium text-brand-800">{a.label}</span>{i < tier.approvers.length - 1 && <span className="text-ink-300">+</span>}</span>)}</div>
      </div>
      {notes.length > 0 && <ul className="space-y-1">{notes.map((n, i) => <li key={i} className={cx('flex items-start gap-1.5 text-[12px]', n.warn ? 'text-sun-700' : 'text-ink-600')}>{n.warn ? <AlertTriangle size={13} className="mt-0.5 shrink-0" /> : <ShieldCheck size={13} className="mt-0.5 shrink-0 text-brand-600" />}{n.t}</li>)}</ul>}
      {!compact && <div className="rounded-control bg-surface-sunken px-3 py-2 text-[11.5px] text-ink-500">Thresholds apply to the total value of a single transaction. Splitting a requirement to avoid a higher tier is prohibited (SOP §3).</div>}
    </div>
  )
}

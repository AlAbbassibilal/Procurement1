import { Link, useNavigate } from 'react-router-dom'
import { FileText, CheckSquare, Search, ShoppingCart, FileSignature, Plus, ArrowRight, Clock, Receipt } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, StatusPill, EmptyState, PriorityDot } from '@/components/ui'
import { fmtMoney, fmtDate, linesSubtotal, timeAgo } from '@/lib/format'
import { canApprove, ROLE_LABEL } from '@/lib/workflow'
import { invoiceTotals } from '@/lib/match'
import { tierForPR } from '@/lib/tiers'

export default function Dashboard() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { prs, pos, contracts, invoices, audit, settings } = useStore()

  const myPRs = prs.filter((p) => p.requesterId === user.id)
  const pendingMine = prs.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user))
  const pendingPO = pos.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user))
  const legalQueue = user.role === 'legal' ? contracts.filter((c) => c.status === 'legal_review') : []
  const pendingINV = invoices.filter((i) => i.status === 'pending_approval' && canApprove(i.approvalChain, user))
  const queueTotal = pendingMine.length + pendingPO.length + legalQueue.length + pendingINV.length
  const inSourcing = prs.filter((p) => p.status === 'approved' || p.status === 'sourcing' || p.status === 'awarded')
  const openPOs = pos.filter((p) => ['draft', 'pending_approval', 'approved', 'issued'].includes(p.status))
  const committed = pos.filter((p) => ['issued', 'contracted', 'received'].includes(p.status)).reduce((s, p) => s + linesSubtotal(p.lines) * (1 + p.taxRate / 100), 0)
  const pipeline = prs.filter((p) => ['pending_approval', 'approved', 'sourcing', 'awarded'].includes(p.status)).reduce((s, p) => s + linesSubtotal(p.lines), 0)

  const isProc = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader eyebrow={ROLE_LABEL[user.role]} title={`${greet}, ${user.name.split(' ')[0]}`}
        subtitle={`Here is what needs your attention across ${settings.orgShort} procurement today.`}
        actions={<>
          <Link to="/approvals" className="btn-secondary"><CheckSquare size={15} /> My approvals {queueTotal > 0 && <span className="rounded-pill bg-sun-500 px-1.5 text-[11px] font-bold text-ink-900">{queueTotal}</span>}</Link>
          <button className="btn-primary" onClick={() => nav('/requisitions/new')}><Plus size={15} /> New requisition</button>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting my approval" value={queueTotal} hint="PRs, POs, invoices and contracts" tone="sun" icon={<CheckSquare size={18} />} />
        <Stat label="In sourcing" value={inSourcing.length} hint="Approved PRs with Procurement" tone="brand" icon={<Search size={18} />} />
        <Stat label="Open purchase orders" value={openPOs.length} hint={`${fmtMoney(committed, settings.defaultCurrency)} committed`} tone="ink" icon={<ShoppingCart size={18} />} />
        <Stat label="Pipeline value" value={fmtMoney(pipeline, settings.defaultCurrency)} hint="PRs in approval or sourcing" tone="accent" icon={<FileText size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Approvals queue */}
          <Card title="Awaiting your decision" description="Documents where you are the current approver" padded={false}
            actions={<Link to="/approvals" className="text-[12.5px] font-medium text-brand-700 hover:underline">View all</Link>}>
            {queueTotal === 0 ? (
              <div className="p-5"><EmptyState title="Nothing waiting on you" body="You'll see requisitions, purchase orders and contracts here when they reach your step." icon={<CheckSquare size={22} />} /></div>
            ) : (
              <ul className="divide-y divide-line">
                {pendingMine.slice(0, 5).map((p) => (
                  <li key={p.id}><Link to={`/requisitions/${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-700"><FileText size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">{p.title}</span>
                      <span className="block text-[12px] text-ink-500">{p.number} · {p.requesterName} · {p.department} · submitted {timeAgo(p.submittedAt ?? p.createdAt)}</span>
                    </span>
                    <span className="hidden text-[13.5px] font-semibold tabular-nums sm:block">{fmtMoney(linesSubtotal(p.lines), p.currency)}</span>
                    <ArrowRight size={16} className="text-ink-400" />
                  </Link></li>
                ))}
                {pendingPO.slice(0, 5).map((p) => (
                  <li key={p.id}><Link to={`/orders/${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-ink-800 text-white"><ShoppingCart size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">{p.title}</span>
                      <span className="block text-[12px] text-ink-500">{p.number} · {p.vendorName}</span>
                    </span>
                    <span className="hidden text-[13.5px] font-semibold tabular-nums sm:block">{fmtMoney(linesSubtotal(p.lines), p.currency)}</span>
                    <ArrowRight size={16} className="text-ink-400" />
                  </Link></li>
                ))}
                {pendingINV.slice(0, 5).map((i) => (
                  <li key={i.id}><Link to={`/invoices/${i.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-sun-100 text-sun-700"><Receipt size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">Invoice {i.vendorInvoiceNo} · {i.vendorName}</span>
                      <span className="block text-[12px] text-ink-500">{i.number} · {i.poNumber} · due {fmtDate(i.dueDate)}</span>
                    </span>
                    <span className="hidden text-[13.5px] font-semibold tabular-nums sm:block">{fmtMoney(invoiceTotals(i.lines, i.taxRate).total, i.currency)}</span>
                    <ArrowRight size={16} className="text-ink-400" />
                  </Link></li>
                ))}
                {legalQueue.map((c) => (
                  <li key={c.id}><Link to={`/contracts/${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-info-50 text-info-700"><FileSignature size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">{c.title}</span>
                      <span className="block text-[12px] text-ink-500">{c.number} · Legal review · {c.vendorName}</span>
                    </span>
                    <ArrowRight size={16} className="text-ink-400" />
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>

          {/* My requisitions or Sourcing queue */}
          {isProc ? (
            <Card title="Sourcing queue" description="Approved requisitions ready for quotations" padded={false} actions={<Link to="/sourcing" className="text-[12.5px] font-medium text-brand-700 hover:underline">Open sourcing</Link>}>
              {inSourcing.length === 0 ? <div className="p-5"><EmptyState title="No requisitions in sourcing" icon={<Search size={22} />} /></div> : (
                <table className="w-full text-[13px]">
                  <thead><tr><th className="table-th">Requisition</th><th className="table-th">Dept</th><th className="table-th">Quotes</th><th className="table-th">Needed by</th><th className="table-th text-right">Value</th><th className="table-th">Status</th></tr></thead>
                  <tbody>{inSourcing.slice(0, 6).map((p) => (
                    <tr key={p.id} className="hover:bg-surface-muted cursor-pointer" onClick={() => nav(`/sourcing/${p.id}`)}>
                      <td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="text-[11.5px] text-ink-500">{p.number}</div></td>
                      <td className="table-td">{p.department}</td>
                      <td className="table-td">{(() => { const t = tierForPR(p, settings).tier; const need = Math.max(t?.minQuotations ?? 0, 1); return <span className={p.quotations.length >= need ? 'text-brand-700 font-semibold' : 'text-ink-700'}>{p.quotations.length}/{need}</span> })()}</td>
                      <td className="table-td">{fmtDate(p.neededBy)}</td>
                      <td className="table-td text-right tabular-nums">{fmtMoney(linesSubtotal(p.lines), p.currency)}</td>
                      <td className="table-td"><StatusPill status={p.status} /></td>
                    </tr>))}</tbody>
                </table>
              )}
            </Card>
          ) : (
            <Card title="My requisitions" description="Requests you have raised" padded={false} actions={<Link to="/requisitions" className="text-[12.5px] font-medium text-brand-700 hover:underline">View all</Link>}>
              {myPRs.length === 0 ? <div className="p-5"><EmptyState title="You haven't raised any requisitions" action={<button className="btn-primary btn-sm" onClick={() => nav('/requisitions/new')}><Plus size={14} /> New requisition</button>} /></div> : (
                <table className="w-full text-[13px]">
                  <thead><tr><th className="table-th">Requisition</th><th className="table-th">Priority</th><th className="table-th">Needed by</th><th className="table-th text-right">Value</th><th className="table-th">Status</th></tr></thead>
                  <tbody>{myPRs.slice(0, 6).map((p) => (
                    <tr key={p.id} className="hover:bg-surface-muted cursor-pointer" onClick={() => nav(`/requisitions/${p.id}`)}>
                      <td className="table-td"><div className="font-medium text-ink-900">{p.title || 'Untitled'}</div><div className="text-[11.5px] text-ink-500">{p.number}</div></td>
                      <td className="table-td"><PriorityDot p={p.priority} /></td>
                      <td className="table-td">{fmtDate(p.neededBy)}</td>
                      <td className="table-td text-right tabular-nums">{fmtMoney(linesSubtotal(p.lines), p.currency)}</td>
                      <td className="table-td"><StatusPill status={p.status} /></td>
                    </tr>))}</tbody>
                </table>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Process at a glance">
            <ol className="space-y-2.5 text-[13px]">
              {[
                { l: 'Requisitions pending approval', n: prs.filter((p) => p.status === 'pending_approval').length, to: '/requisitions?status=pending_approval' },
                { l: 'Returned to requester', n: prs.filter((p) => p.status === 'returned').length, to: '/requisitions?status=returned' },
                { l: 'In sourcing (quotations)', n: prs.filter((p) => p.status === 'sourcing' || p.status === 'approved').length, to: '/sourcing' },
                { l: 'Awarded — PO to raise', n: prs.filter((p) => p.status === 'awarded' && !p.poId).length, to: '/sourcing' },
                { l: 'POs pending approval', n: pos.filter((p) => p.status === 'pending_approval').length, to: '/orders' },
                { l: 'POs issued to vendors', n: pos.filter((p) => p.status === 'issued' || p.status === 'contracted').length, to: '/orders' },
                { l: 'Contracts in legal review', n: contracts.filter((c) => c.status === 'legal_review').length, to: '/contracts' },
                { l: 'POs awaiting goods receipt', n: pos.filter((p) => ['issued', 'contracted', 'partially_received'].includes(p.status)).length, to: '/receiving' },
                { l: 'Invoices with match exceptions', n: invoices.filter((i) => i.status === 'exception').length, to: '/invoices' },
                { l: 'Invoices approved — to pay', n: invoices.filter((i) => i.status === 'approved').length, to: '/invoices' },
                { l: 'Active contracts', n: contracts.filter((c) => c.status === 'active').length, to: '/contracts' },
              ].map((r) => (
                <li key={r.l}><Link to={r.to} className="flex items-center justify-between rounded-control px-2 py-1.5 -mx-2 hover:bg-surface-muted">
                  <span className="text-ink-700">{r.l}</span><span className="rounded-pill bg-ink-100 px-2 py-0.5 text-[12px] font-semibold text-ink-800">{r.n}</span>
                </Link></li>
              ))}
            </ol>
          </Card>

          <Card title="Recent activity" padded={false}>
            <ul className="divide-y divide-line">
              {audit.slice(0, 8).map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-2.5">
                  <Clock size={14} className="mt-0.5 shrink-0 text-ink-400" />
                  <div className="min-w-0 text-[12.5px]">
                    <span className="font-medium text-ink-900">{a.actorName}</span> <span className="text-ink-600">{a.action.toLowerCase()}</span>
                    {a.docNumber && <span className="text-brand-700 font-medium"> {a.docNumber}</span>}
                    <div className="text-[11px] text-ink-400">{timeAgo(a.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

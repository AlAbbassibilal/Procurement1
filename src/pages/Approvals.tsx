import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, FileText, ShoppingCart, FileSignature, Receipt } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState, Tabs, PriorityDot } from '@/components/ui'
import { fmtMoney, fmtDate, linesSubtotal, timeAgo } from '@/lib/format'
import { canApprove, currentStep } from '@/lib/workflow'
import { invoiceTotals } from '@/lib/match'

export default function Approvals() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { prs, pos, contracts, invoices } = useStore()
  const [tab, setTab] = useState<'queue' | 'history'>('queue')

  const qPR = prs.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user))
  const qPO = pos.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user))
  const qCT = user.role === 'legal' ? contracts.filter((c) => c.status === 'legal_review') : []
  const qINV = invoices.filter((i) => i.status === 'pending_approval' && canApprove(i.approvalChain, user))
  const hPR = prs.filter((p) => p.approvalChain.some((s) => s.decidedBy === user.id))
  const hPO = pos.filter((p) => p.approvalChain.some((s) => s.decidedBy === user.id))
  const total = qPR.length + qPO.length + qCT.length + qINV.length

  return (
    <>
      <PageHeader title="My approvals" subtitle="Everything currently waiting for your decision, in the order it arrived." />
      <Tabs tabs={[{ id: 'queue', label: 'Queue', count: total }, { id: 'history', label: 'My decisions', count: hPR.length + hPO.length }]} value={tab} onChange={setTab} />

      {tab === 'queue' && (
        <div className="mt-5 space-y-5">
          {total === 0 && <EmptyState title="Your queue is empty" body="Documents will appear here when they reach a step assigned to you or your role." icon={<CheckSquare size={22} />} />}
          {qPR.length > 0 && (
            <Card title="Purchase requisitions" padded={false}>
              <table className="w-full text-[13px]">
                <thead><tr><th className="table-th">Requisition</th><th className="table-th">Requester</th><th className="table-th">Step</th><th className="table-th">Priority</th><th className="table-th">Needed by</th><th className="table-th text-right">Value</th><th className="table-th">Waiting</th></tr></thead>
                <tbody>{qPR.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/requisitions/${p.id}`)}>
                    <td className="table-td"><div className="flex items-center gap-2"><FileText size={15} className="text-brand-600" /><div><div className="font-medium text-ink-900">{p.title}</div><div className="text-[11.5px] text-ink-500">{p.number} · {p.department}</div></div></div></td>
                    <td className="table-td">{p.requesterName}</td>
                    <td className="table-td">{currentStep(p.approvalChain)?.label}</td>
                    <td className="table-td"><PriorityDot p={p.priority} /></td>
                    <td className="table-td">{fmtDate(p.neededBy)}</td>
                    <td className="table-td text-right font-medium tabular-nums">{fmtMoney(linesSubtotal(p.lines), p.currency)}</td>
                    <td className="table-td text-ink-500">{timeAgo(p.updatedAt)}</td>
                  </tr>))}</tbody>
              </table>
            </Card>
          )}
          {qPO.length > 0 && (
            <Card title="Purchase orders" padded={false}>
              <table className="w-full text-[13px]">
                <thead><tr><th className="table-th">Order</th><th className="table-th">Vendor</th><th className="table-th">Step</th><th className="table-th">Delivery</th><th className="table-th text-right">Value (excl. tax)</th><th className="table-th">Waiting</th></tr></thead>
                <tbody>{qPO.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/orders/${p.id}`)}>
                    <td className="table-td"><div className="flex items-center gap-2"><ShoppingCart size={15} className="text-ink-700" /><div><div className="font-medium text-ink-900">{p.title}</div><div className="text-[11.5px] text-ink-500">{p.number} · from {p.prNumber}</div></div></div></td>
                    <td className="table-td">{p.vendorName}</td>
                    <td className="table-td">{currentStep(p.approvalChain)?.label}</td>
                    <td className="table-td">{fmtDate(p.deliveryDate)}</td>
                    <td className="table-td text-right font-medium tabular-nums">{fmtMoney(linesSubtotal(p.lines), p.currency)}</td>
                    <td className="table-td text-ink-500">{timeAgo(p.updatedAt)}</td>
                  </tr>))}</tbody>
              </table>
            </Card>
          )}
          {qINV.length > 0 && (
            <Card title="Vendor invoices — payment approval" padded={false}>
              <table className="w-full text-[13px]">
                <thead><tr><th className="table-th">Invoice</th><th className="table-th">Vendor</th><th className="table-th">PO</th><th className="table-th">Step</th><th className="table-th">Due</th><th className="table-th">Match</th><th className="table-th text-right">Total</th></tr></thead>
                <tbody>{qINV.map((i) => (
                  <tr key={i.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/invoices/${i.id}`)}>
                    <td className="table-td"><div className="flex items-center gap-2"><Receipt size={15} className="text-brand-700" /><div><div className="font-medium text-ink-900">{i.vendorInvoiceNo}</div><div className="text-[11.5px] text-ink-500">{i.number}</div></div></div></td>
                    <td className="table-td">{i.vendorName}</td><td className="table-td font-mono text-[12px]">{i.poNumber}</td>
                    <td className="table-td">{currentStep(i.approvalChain)?.label}</td><td className="table-td">{fmtDate(i.dueDate)}</td>
                    <td className="table-td">{i.matchOverrideReason ? <span className="text-sun-700">Overridden</span> : <span className="text-brand-700">✓ 3-way</span>}</td>
                    <td className="table-td text-right font-medium tabular-nums">{fmtMoney(invoiceTotals(i.lines, i.taxRate).total, i.currency)}</td>
                  </tr>))}</tbody>
              </table>
            </Card>
          )}
          {qCT.length > 0 && (
            <Card title="Contracts — legal review" padded={false}>
              <table className="w-full text-[13px]">
                <thead><tr><th className="table-th">Contract</th><th className="table-th">Vendor</th><th className="table-th">Type</th><th className="table-th">Term</th><th className="table-th text-right">Value</th></tr></thead>
                <tbody>{qCT.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/contracts/${c.id}`)}>
                    <td className="table-td"><div className="flex items-center gap-2"><FileSignature size={15} className="text-info-700" /><div><div className="font-medium text-ink-900">{c.title}</div><div className="text-[11.5px] text-ink-500">{c.number} · {c.poNumber}</div></div></div></td>
                    <td className="table-td">{c.vendorName}</td><td className="table-td capitalize">{c.type}</td>
                    <td className="table-td">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</td>
                    <td className="table-td text-right font-medium tabular-nums">{fmtMoney(c.value, c.currency)}</td>
                  </tr>))}</tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-5">
          <Card padded={false}>
            {hPR.length + hPO.length === 0 ? <div className="p-5"><EmptyState title="No decisions yet" /></div> : (
              <table className="w-full text-[13px]">
                <thead><tr><th className="table-th">Document</th><th className="table-th">Step</th><th className="table-th">My decision</th><th className="table-th">Comment</th><th className="table-th">Current status</th></tr></thead>
                <tbody>
                  {[...hPR.map((p) => ({ kind: 'PR' as const, d: p })), ...hPO.map((p) => ({ kind: 'PO' as const, d: p }))].map(({ kind, d }) => {
                    const st = d.approvalChain.find((s) => s.decidedBy === user.id)!
                    return (
                      <tr key={d.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(kind === 'PR' ? `/requisitions/${d.id}` : `/orders/${d.id}`)}>
                        <td className="table-td"><div className="font-medium text-ink-900">{d.title}</div><div className="text-[11.5px] text-ink-500">{d.number}</div></td>
                        <td className="table-td">{st.label}</td>
                        <td className="table-td"><StatusPill status={st.status} /> <span className="text-[11.5px] text-ink-500">{fmtDate(st.decidedAt)}</span></td>
                        <td className="table-td text-ink-600 max-w-[280px] truncate">{st.comment || '—'}</td>
                        <td className="table-td"><StatusPill status={d.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

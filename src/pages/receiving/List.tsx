import { useNavigate } from 'react-router-dom'
import { PackageCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState } from '@/components/ui'
import { fmtDate, fmtDateTime, timeAgo, cx } from '@/lib/format'
import { receiptProgress } from '@/lib/match'

export default function ReceivingList() {
  const nav = useNavigate()
  const { pos, grns } = useStore()
  const open = pos.filter((p) => ['issued', 'contracted', 'partially_received', 'received', 'closed'].includes(p.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <>
      <PageHeader title="Goods receipt" subtitle="Confirm what has physically arrived against each issued purchase order. Receipts unlock invoice matching." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Purchase orders awaiting or in receipt" padded={false}>
            {open.length === 0 ? <div className="p-5"><EmptyState title="No issued purchase orders" icon={<PackageCheck size={22} />} /></div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[760px] text-[13px]">
                  <thead><tr><th className="table-th">Order</th><th className="table-th">Vendor</th><th className="table-th">Expected</th><th className="table-th w-56">Received</th><th className="table-th">Status</th><th className="table-th">Updated</th></tr></thead>
                  <tbody>{open.map((p) => { const pr = receiptProgress(p, grns); const late = !pr.complete && new Date(p.deliveryDate) < new Date(); return (
                    <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/receiving/${p.id}`)}>
                      <td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.number}</div></td>
                      <td className="table-td">{p.vendorName}</td>
                      <td className={cx('table-td', late && 'text-accent-700 font-medium')}>{fmtDate(p.deliveryDate)}{late && ' · overdue'}</td>
                      <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', pr.complete ? 'bg-brand-600' : 'bg-sun-500')} style={{ width: `${pr.pct}%` }} /></div><span className="w-16 text-right tabular-nums text-ink-700">{pr.received}/{pr.ordered}</span></div></td>
                      <td className="table-td"><StatusPill status={p.status} /></td>
                      <td className="table-td text-ink-500">{timeAgo(p.updatedAt)}</td>
                    </tr>) })}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <Card title="Recent goods receipt notes" padded={false}>
          <ul className="divide-y divide-line">
            {grns.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-ink-500">No receipts posted yet.</li>}
            {grns.slice(0, 12).map((g) => (
              <li key={g.id} className="cursor-pointer px-5 py-3 hover:bg-surface-muted" onClick={() => nav(`/receiving/${g.poId}`)}>
                <div className="flex items-center justify-between"><span className="font-mono text-[12px] text-brand-700">{g.number}</span><span className="text-[11.5px] text-ink-400">{fmtDateTime(g.receivedAt)}</span></div>
                <div className="text-[13px] font-medium text-ink-900">{g.vendorName} · {g.poNumber}</div>
                <div className="text-[12px] text-ink-500">{g.lines.reduce((s, l) => s + l.quantity, 0)} unit(s) · DN {g.deliveryNoteRef || '—'} · by {g.receivedByName}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

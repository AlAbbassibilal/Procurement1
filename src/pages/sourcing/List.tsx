import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState, PriorityDot } from '@/components/ui'
import { fmtMoney, fmtDate, linesSubtotal, timeAgo } from '@/lib/format'

export default function SourcingList() {
  const nav = useNavigate()
  const { prs, users, settings } = useStore()
  const rows = prs.filter((p) => ['approved', 'sourcing', 'awarded', 'ordered'].includes(p.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const queue = rows.filter((p) => p.status !== 'ordered')

  return (
    <>
      <PageHeader title="Sourcing & quotations" subtitle={`Approved requisitions ready for the market. Requisitions ≥ ${fmtMoney(settings.quotationThreshold, settings.defaultCurrency)} require ${settings.quotationMinimum} quotations before award.`} />
      <Card padded={false}>
        {queue.length === 0 ? <div className="p-5"><EmptyState title="Nothing to source" body="Approved requisitions will land here automatically." icon={<Search size={22} />} /></div> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead><tr><th className="table-th">Requisition</th><th className="table-th">Department</th><th className="table-th">Priority</th><th className="table-th">Needed by</th><th className="table-th">Quotations</th><th className="table-th">Officer</th><th className="table-th text-right">Est. value</th><th className="table-th">Status</th><th className="table-th">Updated</th></tr></thead>
              <tbody>{queue.map((p) => {
                const need = linesSubtotal(p.lines) >= settings.quotationThreshold ? settings.quotationMinimum : 1
                const ok = p.quotations.length >= need
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/sourcing/${p.id}`)}>
                    <td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.number}</div></td>
                    <td className="table-td">{p.department}</td>
                    <td className="table-td"><PriorityDot p={p.priority} /></td>
                    <td className="table-td">{fmtDate(p.neededBy)}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">{Array.from({ length: need }).map((_, i) => <span key={i} className={`h-2 w-4 rounded-sm ${i < p.quotations.length ? 'bg-brand-600' : 'bg-ink-200'}`} />)}</div>
                        <span className={ok ? 'font-semibold text-brand-700' : 'text-ink-600'}>{p.quotations.length}/{need}</span>
                      </div>
                    </td>
                    <td className="table-td">{users.find((u) => u.id === p.sourcingOwnerId)?.name ?? <span className="text-ink-400">Unassigned</span>}</td>
                    <td className="table-td text-right font-medium tabular-nums">{fmtMoney(linesSubtotal(p.lines), p.currency)}</td>
                    <td className="table-td"><StatusPill status={p.status} /></td>
                    <td className="table-td text-ink-500">{timeAgo(p.updatedAt)}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search as SearchIcon, FileText } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState, PriorityDot } from '@/components/ui'
import { fmtMoney, fmtDate, linesSubtotal, timeAgo } from '@/lib/format'
import { DEPARTMENTS } from '@/data/seed'
import type { PRStatus } from '@/types'

const STATUSES: PRStatus[] = ['draft', 'pending_approval', 'returned', 'rejected', 'approved', 'sourcing', 'awarded', 'ordered', 'closed', 'cancelled']

export default function RequisitionList() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const prs = useStore((s) => s.prs)
  const [q, setQ] = useState('')
  const status = sp.get('status') ?? ''
  const dept = sp.get('dept') ?? ''
  const mine = sp.get('mine') === '1'

  const rows = useMemo(() => prs.filter((p) =>
    (!status || p.status === status) && (!dept || p.department === dept) && (!mine || p.requesterId === user.id) &&
    (!q || `${p.number} ${p.title} ${p.requesterName}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [prs, status, dept, mine, q, user.id])

  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n) }

  return (
    <>
      <PageHeader title="Purchase requisitions" subtitle="Raise a request, track its approvals and follow it through to order."
        actions={<button className="btn-primary" onClick={() => nav('/requisitions/new')}><Plus size={15} /> New requisition</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search number, title, requester…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="input w-auto" value={dept} onChange={(e) => setParam('dept', e.target.value)}>
          <option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-control border border-ink-300 bg-surface px-3 py-2 text-[13px]"><input type="checkbox" className="accent-brand-600" checked={mine} onChange={(e) => setParam('mine', e.target.checked ? '1' : '')} /> Mine only</label>
      </div>

      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No requisitions match" icon={<FileText size={22} />} action={<Link to="/requisitions/new" className="btn-primary btn-sm"><Plus size={14} /> New requisition</Link>} /></div> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead><tr><th className="table-th">Requisition</th><th className="table-th">Requester</th><th className="table-th">Department</th><th className="table-th">Priority</th><th className="table-th">Needed by</th><th className="table-th text-right">Est. value</th><th className="table-th">Status</th><th className="table-th">Updated</th></tr></thead>
              <tbody>{rows.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/requisitions/${p.id}`)}>
                  <td className="table-td"><div className="font-medium text-ink-900">{p.title || <span className="italic text-ink-400">Untitled draft</span>}</div><div className="font-mono text-[11.5px] text-ink-500">{p.number}</div></td>
                  <td className="table-td">{p.requesterName}</td><td className="table-td">{p.department}</td>
                  <td className="table-td"><PriorityDot p={p.priority} /></td>
                  <td className="table-td">{fmtDate(p.neededBy)}</td>
                  <td className="table-td text-right font-medium tabular-nums">{fmtMoney(linesSubtotal(p.lines), p.currency)}</td>
                  <td className="table-td"><StatusPill status={p.status} /></td>
                  <td className="table-td text-ink-500">{timeAgo(p.updatedAt)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

import { useNavigate } from 'react-router-dom'
import { FileSignature } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState } from '@/components/ui'
import { fmtMoney, fmtDate, timeAgo } from '@/lib/format'

export default function ContractList() {
  const nav = useNavigate()
  const contracts = useStore((s) => s.contracts)
  const rows = [...contracts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <>
      <PageHeader title="Contracts" subtitle="Agreements drafted from issued purchase orders, reviewed by Legal and executed by both parties." />
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No contracts yet" body="Draft a contract from an issued purchase order." icon={<FileSignature size={22} />} /></div> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead><tr><th className="table-th">Contract</th><th className="table-th">Vendor</th><th className="table-th">Type</th><th className="table-th">Term</th><th className="table-th text-right">Value</th><th className="table-th">Milestones</th><th className="table-th">Status</th><th className="table-th">Updated</th></tr></thead>
              <tbody>{rows.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/contracts/${c.id}`)}>
                  <td className="table-td"><div className="font-medium text-ink-900">{c.title}</div><div className="font-mono text-[11.5px] text-ink-500">{c.number} · {c.poNumber}</div></td>
                  <td className="table-td">{c.vendorName}</td><td className="table-td capitalize">{c.type}</td>
                  <td className="table-td">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</td>
                  <td className="table-td text-right font-medium tabular-nums">{fmtMoney(c.value, c.currency)}</td>
                  <td className="table-td">{c.milestones.filter((m) => m.status !== 'pending').length}/{c.milestones.length}</td>
                  <td className="table-td"><StatusPill status={c.status} /></td>
                  <td className="table-td text-ink-500">{timeAgo(c.updatedAt)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

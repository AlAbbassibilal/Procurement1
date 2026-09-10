import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, EmptyState } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export default function Audit() {
  const nav = useNavigate()
  const { audit } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const rows = audit.filter((a) => (!type || a.docType === type) && (!q || `${a.actorName} ${a.action} ${a.docNumber ?? ''} ${a.detail ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const linkFor = (a: typeof audit[number]) => a.docType === 'PR' ? `/requisitions/${a.docId}` : a.docType === 'PO' ? `/orders/${a.docId}` : a.docType === 'CONTRACT' ? `/contracts/${a.docId}` : a.docType === 'VENDOR' ? '/vendors' : null
  return (
    <>
      <PageHeader title="Audit trail" subtitle="Every decision, submission, award and change — who, what and when." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-sm" placeholder="Search actor, action, document…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{['PR', 'PO', 'CONTRACT', 'VENDOR', 'USER', 'SYSTEM'].map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No events" icon={<History size={22} />} /></div> : (
          <table className="w-full text-[13px]">
            <thead><tr><th className="table-th w-44">When</th><th className="table-th">Actor</th><th className="table-th">Type</th><th className="table-th">Document</th><th className="table-th">Action</th><th className="table-th">Detail</th></tr></thead>
            <tbody>{rows.map((a) => { const l = linkFor(a); return (
              <tr key={a.id} className={l ? 'cursor-pointer hover:bg-surface-muted' : ''} onClick={() => l && nav(l)}>
                <td className="table-td text-ink-500 whitespace-nowrap">{fmtDateTime(a.at)}</td>
                <td className="table-td font-medium text-ink-900">{a.actorName}</td>
                <td className="table-td"><span className="rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">{a.docType}</span></td>
                <td className="table-td font-mono text-[12px] text-brand-700">{a.docNumber ?? '—'}</td>
                <td className="table-td">{a.action}</td>
                <td className="table-td text-ink-600">{a.detail ?? ''}</td>
              </tr>) })}</tbody>
          </table>
        )}
      </Card>
    </>
  )
}

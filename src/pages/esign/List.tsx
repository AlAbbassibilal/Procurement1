import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, PenLine, Inbox } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState, Tabs, Stat } from '@/components/ui'
import { fmtDateTime, timeAgo, cx } from '@/lib/format'
import { recipientTurn } from '@/lib/esign'

export default function EnvelopeList() {
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { envelopes } = useStore()
  const myTurn = (e: typeof envelopes[number]) => e.status === 'sent' && recipientTurn(e).some((r) => r.userId === user.id)
  const involved = (e: typeof envelopes[number]) => e.createdBy === user.id || e.recipients.some((r) => r.userId === user.id)
  const [tab, setTab] = useState<'inbox' | 'sent' | 'completed' | 'all'>('inbox')
  const rows = [...envelopes].sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt)).filter((e) => tab === 'inbox' ? myTurn(e) : tab === 'sent' ? e.createdBy === user.id : tab === 'completed' ? e.status === 'completed' && involved(e) : user.role === 'admin' || involved(e))
  const inbox = envelopes.filter(myTurn).length
  return (
    <>
      <PageHeader title="E-Signature" subtitle="Send documents for signature, sign what is waiting for you, and keep every signed document with its certificate of completion and audit trail."
        actions={<Link to="/esign/new" className="btn-primary"><Plus size={15} /> New envelope</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Waiting for my signature" value={inbox} tone={inbox ? 'sun' : 'default'} icon={<PenLine size={18} />} />
        <Stat label="Out for signature (sent by me)" value={envelopes.filter((e) => e.createdBy === user.id && e.status === 'sent').length} />
        <Stat label="Completed" value={envelopes.filter((e) => e.status === 'completed' && involved(e)).length} tone="brand" />
        <Stat label="Declined / voided" value={envelopes.filter((e) => ['declined', 'voided'].includes(e.status) && involved(e)).length} tone="accent" />
      </div>
      <Tabs tabs={[{ id: 'inbox', label: 'Action required', count: inbox }, { id: 'sent', label: 'Sent by me' }, { id: 'completed', label: 'Completed' }, { id: 'all', label: 'All' }]} value={tab} onChange={setTab} />
      <div className="mt-5"><Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title={tab === 'inbox' ? 'Nothing waiting for your signature' : 'No envelopes here'} icon={<Inbox size={22} />} action={<Link to="/esign/new" className="btn-primary btn-sm"><Plus size={13} /> New envelope</Link>} /></div> : (
          <div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[860px] text-[13px]">
            <thead><tr><th className="table-th">Envelope</th><th className="table-th">From</th><th className="table-th">Recipients</th><th className="table-th">Status</th><th className="table-th">Last activity</th></tr></thead>
            <tbody>{rows.map((e) => { const turn = myTurn(e); const last = e.events[e.events.length - 1]; return (
              <tr key={e.id} className={cx('cursor-pointer hover:bg-surface-muted', turn && 'bg-sun-50/40')} onClick={() => nav(`/esign/${e.id}`)}>
                <td className="table-td"><div className="font-medium text-ink-900">{e.subject}</div><div className="font-mono text-[11.5px] text-ink-500">{e.number} · {e.documentName}</div></td>
                <td className="table-td">{e.createdByName}</td>
                <td className="table-td"><div className="flex flex-wrap gap-1">{e.recipients.map((r) => <span key={r.id} className={cx('rounded-pill px-1.5 py-0.5 text-[10.5px] font-medium', r.status === 'signed' || r.status === 'approved' ? 'bg-brand-50 text-brand-800' : r.status === 'declined' ? 'bg-danger-50 text-danger-700' : r.status === 'viewed' ? 'bg-info-50 text-info-700' : r.status === 'sent' ? 'bg-sun-100 text-sun-700' : 'bg-surface-sunken text-ink-500')} title={r.status}>{r.order}. {r.name.split(' ')[0]}{r.role !== 'signer' ? ` (${r.role})` : ''}</span>)}</div></td>
                <td className="table-td"><StatusPill status={e.status === 'sent' ? (turn ? 'action_required' : 'out_for_signature') : e.status} /></td>
                <td className="table-td text-ink-500">{last ? <><span className="text-ink-700">{last.action}</span> · {timeAgo(last.at)}</> : fmtDateTime(e.createdAt)}</td>
              </tr>) })}</tbody>
          </table></div>
        )}
      </Card></div>
    </>
  )
}

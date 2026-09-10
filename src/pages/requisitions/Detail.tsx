import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Send, Ban, ShoppingCart, Search, Printer } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, KV, PriorityDot, Alert } from '@/components/ui'
import { ApprovalChain, DecisionPanel, CommentThread, AttachmentList, LineItemsEditor, ProcessTracker, type Stage } from '@/components/workflow'
import { fmtMoney, fmtDate, fmtDateTime, linesSubtotal } from '@/lib/format'

export default function RequisitionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { prs, users, pos, submitPR, decidePR, cancelPR, addPRComment, updatePR, settings } = useStore()
  const pr = prs.find((p) => p.id === id)
  if (!pr) return <Alert tone="danger">Requisition not found. <Link to="/requisitions" className="underline">Back to list</Link></Alert>

  const amount = linesSubtotal(pr.lines)
  const isOwner = pr.requesterId === user.id || user.role === 'admin'
  const isProc = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const po = pr.poId ? pos.find((p) => p.id === pr.poId) : undefined
  const stage: Stage = pr.status === 'draft' || pr.status === 'returned' ? 'pr' : pr.status === 'pending_approval' || pr.status === 'rejected' ? 'pr_approval'
    : pr.status === 'approved' || pr.status === 'sourcing' ? 'sourcing' : pr.status === 'awarded' ? 'po' : po?.status === 'pending_approval' ? 'po_approval' : po?.contractId ? 'contract' : 'po'
  const awarded = pr.quotations.find((q) => q.id === pr.awardedQuotationId)

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{pr.number}</span>} title={pr.title || 'Untitled requisition'}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={pr.status} /><span>Raised by {pr.requesterName} · {pr.department}</span><span>· Owner {pr.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {isOwner && ['draft', 'returned'].includes(pr.status) && <button className="btn-secondary" onClick={() => nav(`/requisitions/${pr.id}/edit`)}><Pencil size={15} /> Edit</button>}
          {isOwner && ['draft', 'returned'].includes(pr.status) && <button className="btn-primary" onClick={() => { const r = submitPR(pr.id); if (!r.ok) alert(r.error) }}><Send size={15} /> {pr.status === 'returned' ? 'Re-submit' : 'Submit for approval'}</button>}
          {isOwner && ['draft', 'returned', 'pending_approval'].includes(pr.status) && <button className="btn-danger-soft" onClick={() => confirm('Cancel this requisition?') && cancelPR(pr.id)}><Ban size={15} /> Cancel</button>}
          {isProc && ['approved', 'sourcing', 'awarded'].includes(pr.status) && <Link to={`/sourcing/${pr.id}`} className="btn-primary"><Search size={15} /> Open sourcing</Link>}
          {po && <Link to={`/orders/${po.id}`} className="btn-secondary"><ShoppingCart size={15} /> {po.number}</Link>}
        </>} />

      <div className="card mb-6 px-5 py-4"><ProcessTracker current={stage} failed={pr.status === 'rejected' || pr.status === 'cancelled'} /></div>

      {pr.status === 'pending_approval' && (
        <div className="mb-6"><DecisionPanel chain={pr.approvalChain} docLabel={pr.number} onDecide={(d, c, del) => decidePR(pr.id, d, c, del)} /></div>
      )}
      {pr.status === 'rejected' && <div className="mb-6"><Alert tone="danger"><b>Rejected.</b> {pr.approvalChain.find((s) => s.status === 'rejected')?.comment}</Alert></div>}
      {pr.status === 'returned' && <div className="mb-6"><Alert tone="warning"><b>Returned for changes.</b> {pr.approvalChain.find((s) => s.status === 'returned')?.comment}</Alert></div>}
      {pr.status === 'approved' && <div className="mb-6"><Alert tone="success"><b>Fully approved</b> on {fmtDateTime(pr.approvedAt)}. Now with Procurement to collect {settings.quotationMinimum} quotations.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Request details">
            <p className="text-[13.5px] leading-relaxed text-ink-800 whitespace-pre-wrap">{pr.justification || <i className="text-ink-400">No justification provided.</i>}</p>
            <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
              <KV k="Priority" v={<PriorityDot p={pr.priority} />} />
              <KV k="Needed by" v={fmtDate(pr.neededBy)} />
              <KV k="Department" v={pr.department} />
              <KV k="Currency" v={pr.currency} />
              <KV k="Created" v={fmtDateTime(pr.createdAt)} />
              <KV k="Submitted" v={fmtDateTime(pr.submittedAt)} />
            </div>
          </Card>
          <Card title="Line items" padded={false}><div className="p-4"><LineItemsEditor lines={pr.lines} currency={pr.currency} readOnly /></div></Card>

          {(pr.quotations.length > 0 || awarded) && (
            <Card title="Sourcing outcome" description={`${pr.quotations.length} of ${settings.quotationMinimum} quotations recorded`} actions={isProc && <Link to={`/sourcing/${pr.id}`} className="text-[12.5px] font-medium text-brand-700 hover:underline">Manage</Link>}>
              <ul className="divide-y divide-line">
                {pr.quotations.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span><b className="text-ink-900">{q.vendorName}</b> <span className="text-ink-500">· {q.reference} · {q.deliveryDays} days</span></span>
                    <span className="flex items-center gap-3"><span className="font-medium tabular-nums">{fmtMoney(q.subtotal, q.currency)}</span>{q.id === pr.awardedQuotationId && <StatusPill status="awarded" />}</span>
                  </li>
                ))}
              </ul>
              {pr.awardJustification && <div className="mt-3 rounded-control bg-brand-50 border border-brand-200 px-3 py-2 text-[12.5px] text-ink-800"><b>Award justification:</b> {pr.awardJustification}</div>}
            </Card>
          )}

          <Card title="Attachments"><AttachmentList items={pr.attachments} readOnly={!isOwner || !['draft', 'returned'].includes(pr.status)} onAdd={(a) => updatePR(pr.id, { attachments: [...pr.attachments, a] })} onRemove={(aid) => updatePR(pr.id, { attachments: pr.attachments.filter((a) => a.id !== aid) })} /></Card>
          <Card title="Discussion"><CommentThread comments={pr.comments} onAdd={(t) => addPRComment(pr.id, t)} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Estimated value">
            <div className="text-[26px] font-semibold text-ink-900">{fmtMoney(amount, pr.currency)}</div>
            <div className="text-[12.5px] text-ink-500">{pr.lines.length} line(s) · excl. tax</div>
          </Card>
          <Card title="Approval chain"><ApprovalChain chain={pr.approvalChain} users={users} /></Card>
          <Card title="Document control">
            <KV k="Document owner" v={pr.ownerName} />
            <KV k="Requester" v={pr.requesterName} />
            <KV k="Sourcing officer" v={users.find((u) => u.id === pr.sourcingOwnerId)?.name ?? '—'} />
            <KV k="Purchase order" v={po ? <Link className="text-brand-700 hover:underline" to={`/orders/${po.id}`}>{po.number}</Link> : '—'} />
            <KV k="Last updated" v={fmtDateTime(pr.updatedAt)} />
          </Card>
        </div>
      </div>
    </>
  )
}

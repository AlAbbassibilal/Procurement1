import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, SendHorizontal, FileSignature, Ban, Printer } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, KV, Alert, Field } from '@/components/ui'
import { ApprovalChain, DecisionPanel, CommentThread, AttachmentList, LineItemsEditor, ProcessTracker } from '@/components/workflow'
import { fmtMoney, fmtDate, fmtDateTime, linesSubtotal } from '@/lib/format'
import { Logo } from '@/components/Logo'

export default function OrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { pos, prs, users, vendors, settings, updatePO, submitPO, decidePO, issuePO, cancelPO, addPOComment, createContractFromPO } = useStore()
  const po = pos.find((p) => p.id === id)
  if (!po) return <Alert tone="danger">Purchase order not found.</Alert>
  const pr = prs.find((p) => p.id === po.prId)
  const vendor = vendors.find((v) => v.id === po.vendorId)
  const isProc = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const editable = isProc && ['draft', 'returned'].includes(po.status)
  const sub = linesSubtotal(po.lines), tax = sub * po.taxRate / 100, total = sub + tax
  const stage = po.status === 'draft' || po.status === 'returned' ? 'po' : po.status === 'pending_approval' || po.status === 'rejected' || po.status === 'approved' ? 'po_approval' : po.contractId ? 'contract' : 'po_approval'

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{po.number}</span>} title={po.title}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={po.status} /><span>{po.vendorName}</span><span>· from <Link to={`/requisitions/${po.prId}`} className="text-brand-700 hover:underline">{po.prNumber}</Link></span><span>· Owner {po.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print PO</button>
          {editable && <button className="btn-primary" onClick={() => { const r = submitPO(po.id); if (!r.ok) alert(r.error) }}><Send size={15} /> {po.status === 'returned' ? 'Re-submit' : 'Submit for approval'}</button>}
          {isProc && po.status === 'approved' && <button className="btn-primary" onClick={() => confirm(`Issue ${po.number} to ${po.vendorName}?`) && issuePO(po.id)}><SendHorizontal size={15} /> Issue to vendor</button>}
          {isProc && po.status === 'issued' && !po.contractId && <button className="btn-primary" onClick={() => { const r = createContractFromPO(po.id); if (!r.ok) return alert(r.error); nav(`/contracts/${r.contractId}`) }}><FileSignature size={15} /> Draft contract</button>}
          {po.contractId && <Link to={`/contracts/${po.contractId}`} className="btn-secondary"><FileSignature size={15} /> Open contract</Link>}
          {isProc && ['draft', 'returned', 'pending_approval', 'approved'].includes(po.status) && <button className="btn-danger-soft" onClick={() => confirm('Cancel this PO? The requisition returns to "awarded".') && cancelPO(po.id)}><Ban size={15} /> Cancel</button>}
        </>} />

      <div className="card mb-6 px-5 py-4"><ProcessTracker current={stage} failed={po.status === 'rejected' || po.status === 'cancelled'} /></div>

      {po.status === 'pending_approval' && <div className="mb-6"><DecisionPanel chain={po.approvalChain} docLabel={po.number} onDecide={(d, c, del) => decidePO(po.id, d, c, del)} /></div>}
      {po.status === 'rejected' && <div className="mb-6"><Alert tone="danger"><b>Rejected.</b> {po.approvalChain.find((s) => s.status === 'rejected')?.comment}</Alert></div>}
      {po.status === 'returned' && <div className="mb-6"><Alert tone="warning"><b>Returned for changes.</b> {po.approvalChain.find((s) => s.status === 'returned')?.comment}</Alert></div>}
      {po.status === 'approved' && <div className="mb-6"><Alert tone="success"><b>Approved.</b> Ready to be issued to {po.vendorName}.</Alert></div>}
      {po.status === 'issued' && <div className="mb-6"><Alert tone="info"><b>Issued</b> to {po.vendorName} on {fmtDateTime(po.issuedAt)}. Next: draft the contract.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Printable PO header block */}
          <Card padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4">
              <Logo size="sm" />
              <div className="text-right text-[12.5px] text-ink-600">
                <div className="text-[16px] font-semibold text-ink-900">PURCHASE ORDER</div>
                <div className="font-mono">{po.number}</div>
                <div>Date: {fmtDate(po.createdAt)}</div>
              </div>
            </div>
            <div className="grid gap-6 px-5 py-4 md:grid-cols-2 text-[13px]">
              <div>
                <div className="label">Vendor</div>
                <div className="font-semibold text-ink-900">{po.vendorName}</div>
                {vendor && <div className="text-ink-600">{vendor.contactName} · {vendor.email}<br />{vendor.phone} · {vendor.country} · Tax ID {vendor.taxId}</div>}
              </div>
              <div>
                <div className="label">Bill to / Ship to</div>
                <div className="font-semibold text-ink-900">{settings.orgName}</div>
                <div className="text-ink-600">{po.deliveryAddress}<br />{settings.email} · {settings.phone}</div>
              </div>
            </div>
          </Card>

          <Card title="Order terms">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery date" required><input type="date" className="input" disabled={!editable} value={po.deliveryDate} onChange={(e) => updatePO(po.id, { deliveryDate: e.target.value })} /></Field>
              <Field label="Incoterms"><select className="input" disabled={!editable} value={po.incoterms} onChange={(e) => updatePO(po.id, { incoterms: e.target.value })}>{['DAP', 'DDP', 'EXW', 'FOB', 'CIF', 'N/A (services)'].map((i) => <option key={i}>{i}</option>)}</select></Field>
              <Field label="Payment terms"><input className="input" disabled={!editable} value={po.paymentTerms} onChange={(e) => updatePO(po.id, { paymentTerms: e.target.value })} /></Field>
              <Field label="Tax rate %"><input type="number" className="input" disabled={!editable} value={po.taxRate} onChange={(e) => updatePO(po.id, { taxRate: Number(e.target.value) })} /></Field>
              <Field label="Delivery address" className="sm:col-span-2"><input className="input" disabled={!editable} value={po.deliveryAddress} onChange={(e) => updatePO(po.id, { deliveryAddress: e.target.value })} /></Field>
              <Field label="Notes to vendor" className="sm:col-span-2"><textarea className="input min-h-[72px]" disabled={!editable} value={po.notes} onChange={(e) => updatePO(po.id, { notes: e.target.value })} /></Field>
            </div>
          </Card>

          <Card title="Order lines" description="Prices from the awarded quotation" padded={false}>
            <div className="p-4"><LineItemsEditor lines={po.lines} onChange={(lines) => updatePO(po.id, { lines })} currency={po.currency} readOnly={!editable} priceLabel="Unit price" /></div>
            <div className="border-t border-line bg-surface-muted px-5 py-3">
              <div className="ml-auto max-w-xs space-y-1 text-[13px]">
                <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="tabular-nums">{fmtMoney(sub, po.currency)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Tax ({po.taxRate}%)</span><span className="tabular-nums">{fmtMoney(tax, po.currency)}</span></div>
                <div className="flex justify-between border-t border-line pt-1 text-[15px] font-semibold"><span>Total</span><span className="tabular-nums">{fmtMoney(total, po.currency)}</span></div>
              </div>
            </div>
          </Card>

          {pr?.awardJustification && <Card title="Award basis" description="From the sourcing stage — visible to approvers"><p className="text-[13px] text-ink-800">{pr.awardJustification}</p><div className="mt-2 text-[12px] text-ink-500">{pr.quotations.length} quotation(s) compared · awarded {pr.quotations.find((q) => q.id === po.quotationId)?.reference}</div></Card>}

          <Card title="Attachments"><AttachmentList items={po.attachments} readOnly={!isProc} onAdd={(a) => updatePO(po.id, { attachments: [...po.attachments, a] })} onRemove={(aid) => updatePO(po.id, { attachments: po.attachments.filter((a) => a.id !== aid) })} /></Card>
          <Card title="Discussion"><CommentThread comments={po.comments} onAdd={(t) => addPOComment(po.id, t)} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Order value">
            <div className="text-[26px] font-semibold text-ink-900">{fmtMoney(total, po.currency)}</div>
            <div className="text-[12.5px] text-ink-500">incl. {po.taxRate}% tax · {po.lines.length} line(s)</div>
          </Card>
          <Card title="Approval chain"><ApprovalChain chain={po.approvalChain} users={users} /></Card>
          <Card title="Document control">
            <KV k="Document owner" v={po.ownerName} /><KV k="Prepared by" v={po.createdByName} /><KV k="Requisition" v={<Link className="text-brand-700 hover:underline" to={`/requisitions/${po.prId}`}>{po.prNumber}</Link>} />
            <KV k="Issued" v={fmtDateTime(po.issuedAt)} /><KV k="Contract" v={po.contractId ? <Link className="text-brand-700 hover:underline" to={`/contracts/${po.contractId}`}>Open</Link> : '—'} /><KV k="Last updated" v={fmtDateTime(po.updatedAt)} />
          </Card>
        </div>
      </div>
    </>
  )
}

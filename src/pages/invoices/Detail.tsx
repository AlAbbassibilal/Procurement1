import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, RefreshCw, ShieldAlert, Banknote, XCircle, Printer } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, KV, Alert, Field, Modal } from '@/components/ui'
import { ApprovalChain, DecisionPanel, CommentThread, AttachmentList, ProcessTracker } from '@/components/workflow'
import { fmtMoney, fmtDate, fmtDateTime, toInputDate, cx } from '@/lib/format'
import { invoiceTotals, receivedQty, invoicedQty } from '@/lib/match'
import { Logo } from '@/components/Logo'

export default function InvoiceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { invoices, pos, grns, users, settings, updateInvoice, rematchInvoice, overrideMatch, submitInvoice, decideInvoice, payInvoice, rejectInvoiceAtRegistration, addInvoiceComment } = useStore()
  const inv = invoices.find((i) => i.id === id)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [pay, setPay] = useState<{ reference: string; method: 'bank_transfer' | 'cheque' | 'cash'; paidAt: string }>({ reference: '', method: 'bank_transfer', paidAt: toInputDate(new Date()) })
  const [err, setErr] = useState<string | null>(null)
  if (!inv) return <Alert tone="danger">Invoice not found.</Alert>
  const po = pos.find((p) => p.id === inv.poId)
  const t = invoiceTotals(inv.lines, inv.taxRate)
  const isFinance = ['finance', 'admin'].includes(user.role)
  const isAP = ['finance', 'procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const blocks = inv.matchIssues.filter((i) => i.severity === 'block')
  const warns = inv.matchIssues.filter((i) => i.severity === 'warn')

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{inv.number}</span>} title={`Invoice ${inv.vendorInvoiceNo} — ${inv.vendorName}`}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={inv.status} /><span>against <Link to={`/orders/${inv.poId}`} className="text-brand-700 hover:underline">{inv.poNumber}</Link></span><span>· due {fmtDate(inv.dueDate)}</span><span>· Owner {inv.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {isAP && ['exception', 'matched', 'registered'].includes(inv.status) && <button className="btn-secondary" onClick={() => rematchInvoice(inv.id)}><RefreshCw size={15} /> Re-run match</button>}
          {isFinance && inv.status === 'exception' && <button className="btn-secondary" onClick={() => { setReason(''); setErr(null); setOverrideOpen(true) }}><ShieldAlert size={15} /> Override exceptions</button>}
          {isAP && ['matched', 'returned'].includes(inv.status) && <button className="btn-primary" onClick={() => { const r = submitInvoice(inv.id); if (!r.ok) alert(r.error) }}><Send size={15} /> {inv.status === 'returned' ? 'Re-submit' : 'Submit for approval'}</button>}
          {isFinance && inv.status === 'approved' && <button className="btn-primary" onClick={() => { setErr(null); setPayOpen(true) }}><Banknote size={15} /> Record payment</button>}
          {isAP && ['registered', 'matched', 'exception'].includes(inv.status) && <button className="btn-danger-soft" onClick={() => { const r = prompt('Reason for rejecting this invoice:'); if (r) rejectInvoiceAtRegistration(inv.id, r) }}><XCircle size={15} /> Reject</button>}
        </>} />
      <div className="card mb-6 px-5 py-4"><ProcessTracker current="invoice" failed={inv.status === 'rejected'} complete={inv.status === 'paid'} /></div>

      {inv.status === 'pending_approval' && <div className="mb-6"><DecisionPanel chain={inv.approvalChain} docLabel={`${inv.number} (${fmtMoney(t.total, inv.currency)})`} onDecide={(d, c, del) => decideInvoice(inv.id, d, c, del)} /></div>}
      {inv.status === 'exception' && <div className="mb-6"><Alert tone="danger"><b>3-way match failed — {blocks.length} blocking exception(s).</b> Post the missing goods receipt, correct the invoice, or have Finance override with a reason.</Alert></div>}
      {inv.status === 'matched' && <div className="mb-6"><Alert tone="success"><b>3-way match passed.</b>{inv.matchOverrideReason ? ` Exceptions overridden: ${inv.matchOverrideReason}` : ' Order, receipt and invoice agree within tolerance.'} Ready to submit for approval.</Alert></div>}
      {inv.status === 'returned' && <div className="mb-6"><Alert tone="warning"><b>Returned.</b> {inv.approvalChain.find((s) => s.status === 'returned')?.comment}</Alert></div>}
      {inv.status === 'rejected' && <div className="mb-6"><Alert tone="danger"><b>Rejected.</b> {inv.approvalChain.find((s) => s.status === 'rejected')?.comment}</Alert></div>}
      {inv.status === 'approved' && <div className="mb-6"><Alert tone="success"><b>Approved for payment.</b> Finance can now record the payment.</Alert></div>}
      {inv.status === 'paid' && inv.payment && <div className="mb-6"><Alert tone="success"><b>Paid</b> {fmtMoney(inv.payment.amount, inv.currency)} on {fmtDate(inv.payment.paidAt)} via {inv.payment.method.replace('_', ' ')} · ref {inv.payment.reference} · by {inv.payment.paidByName}.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Three-way match" description={`PO × goods receipt × invoice · price tolerance ±${settings.priceTolerancePct}%`} padded={false}>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead><tr><th className="table-th">Line</th><th className="table-th text-right">PO qty</th><th className="table-th text-right">PO price</th><th className="table-th text-right">Received</th><th className="table-th text-right">Prev. invoiced</th><th className="table-th text-right">This invoice</th><th className="table-th text-right">Inv. price</th><th className="table-th text-right">Variance</th><th className="table-th">Result</th></tr></thead>
                <tbody>{inv.lines.map((l) => { const pl = po?.lines.find((x) => x.id === l.lineItemId); const rec = po ? receivedQty(grns, po.id, l.lineItemId) : 0; const prev = po ? invoicedQty(invoices, po.id, l.lineItemId, inv.id) : 0; const v = pl?.unitPrice ? ((l.unitPrice - pl.unitPrice) / pl.unitPrice) * 100 : 0; const li = inv.matchIssues.filter((i) => i.lineItemId === l.lineItemId); return (
                  <tr key={l.lineItemId} className={cx(li.some((i) => i.severity === 'block') && 'bg-danger-50/50')}>
                    <td className="table-td font-medium text-ink-900">{l.description}</td>
                    <td className="table-td text-right tabular-nums">{pl?.quantity ?? '—'}</td>
                    <td className="table-td text-right tabular-nums">{pl ? fmtMoney(pl.unitPrice, inv.currency) : '—'}</td>
                    <td className="table-td text-right tabular-nums text-brand-700">{rec}</td>
                    <td className="table-td text-right tabular-nums text-ink-500">{prev}</td>
                    <td className="table-td text-right tabular-nums font-semibold">{l.quantity}</td>
                    <td className="table-td text-right tabular-nums">{fmtMoney(l.unitPrice, inv.currency)}</td>
                    <td className={cx('table-td text-right tabular-nums', Math.abs(v) > settings.priceTolerancePct ? 'font-semibold text-accent-700' : 'text-ink-500')}>{v === 0 ? '0%' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}</td>
                    <td className="table-td">{li.length === 0 ? <span className="font-medium text-brand-700">✓ OK</span> : li.some((i) => i.severity === 'block') ? <span className="font-medium text-accent-700">✕ Exception</span> : <span className="font-medium text-sun-700">⚠ Warning</span>}</td>
                  </tr>) })}</tbody>
              </table>
            </div>
            {inv.matchIssues.length > 0 && (
              <ul className="space-y-1.5 border-t border-line p-4">{inv.matchIssues.map((i, k) => <li key={k} className={cx('flex items-start gap-2 text-[13px]', i.severity === 'block' ? 'text-danger-700' : 'text-warning-700')}><span className="mt-0.5">{i.severity === 'block' ? '✕' : '⚠'}</span>{i.message}</li>)}</ul>
            )}
            {warns.length > 0 && blocks.length === 0 && <div className="border-t border-line px-4 py-2 text-[12px] text-ink-500">Warnings do not block approval but are visible to approvers.</div>}
          </Card>

          <Card padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4"><Logo size="sm" /><div className="text-right text-[12.5px] text-ink-600"><div className="text-[16px] font-semibold text-ink-900">VENDOR INVOICE</div><div className="font-mono">{inv.vendorInvoiceNo}</div><div>Internal ref {inv.number}</div></div></div>
            <div className="grid gap-x-8 px-5 py-4 sm:grid-cols-2"><KV k="Vendor" v={inv.vendorName} /><KV k="Purchase order" v={inv.poNumber} /><KV k="Invoice date" v={fmtDate(inv.invoiceDate)} /><KV k="Due date" v={fmtDate(inv.dueDate)} /><KV k="Registered by" v={inv.registeredByName} /><KV k="Registered" v={fmtDateTime(inv.createdAt)} /></div>
            <div className="border-t border-line bg-surface-muted px-5 py-3"><div className="ml-auto max-w-xs space-y-1 text-[13px]"><div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="tabular-nums">{fmtMoney(t.subtotal, inv.currency)}</span></div><div className="flex justify-between"><span className="text-ink-500">Tax ({inv.taxRate}%)</span><span className="tabular-nums">{fmtMoney(t.tax, inv.currency)}</span></div><div className="flex justify-between border-t border-line pt-1 text-[15px] font-semibold"><span>Total payable</span><span className="tabular-nums">{fmtMoney(t.total, inv.currency)}</span></div></div></div>
          </Card>

          <Card title="Attachments"><AttachmentList items={inv.attachments} readOnly={!isAP} onAdd={(a) => updateInvoice(inv.id, { attachments: [...inv.attachments, a] })} onRemove={(aid) => updateInvoice(inv.id, { attachments: inv.attachments.filter((a) => a.id !== aid) })} /></Card>
          <Card title="Discussion"><CommentThread comments={inv.comments} onAdd={(tx) => addInvoiceComment(inv.id, tx)} /></Card>
        </div>
        <div className="space-y-6">
          <Card title="Amount payable"><div className="text-[26px] font-semibold text-ink-900">{fmtMoney(t.total, inv.currency)}</div><div className="text-[12.5px] text-ink-500">incl. {inv.taxRate}% tax · due {fmtDate(inv.dueDate)}</div></Card>
          <Card title="Approval chain"><ApprovalChain chain={inv.approvalChain} users={users} /></Card>
          <Card title="Document control"><KV k="Document owner" v={inv.ownerName} /><KV k="Purchase order" v={<Link className="text-brand-700 hover:underline" to={`/orders/${inv.poId}`}>{inv.poNumber}</Link>} /><KV k="Goods receipts" v={<Link className="text-brand-700 hover:underline" to={`/receiving/${inv.poId}`}>{grns.filter((g) => g.poId === inv.poId).length} posted</Link>} /><KV k="Match override" v={inv.matchOverrideReason ?? '—'} /><KV k="Last updated" v={fmtDateTime(inv.updatedAt)} /></Card>
        </div>
      </div>

      <Modal open={overrideOpen} onClose={() => setOverrideOpen(false)} title="Override match exceptions"
        footer={<><button className="btn-secondary" onClick={() => setOverrideOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => { const r = overrideMatch(inv.id, reason); if (!r.ok) return setErr(r.error ?? 'Failed'); setOverrideOpen(false) }}>Override & mark matched</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        <ul className="mb-3 space-y-1 text-[13px] text-danger-700">{blocks.map((b, k) => <li key={k}>✕ {b.message}</li>)}</ul>
        <Field label="Override reason" required hint="Recorded in the audit trail and shown to approvers."><textarea className="input min-h-[96px]" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment"
        footer={<><button className="btn-secondary" onClick={() => setPayOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => { const r = payInvoice(inv.id, pay); if (!r.ok) return setErr(r.error ?? 'Failed'); setPayOpen(false) }}><Banknote size={14} /> Confirm {fmtMoney(t.total, inv.currency)} paid</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment method"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as typeof pay.method })}><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option></select></Field>
          <Field label="Payment date"><input type="date" className="input" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} /></Field>
          <Field label="Bank / cheque reference" required className="sm:col-span-2"><input className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="e.g. TRF-2025-00931" /></Field>
        </div>
      </Modal>
    </>
  )
}

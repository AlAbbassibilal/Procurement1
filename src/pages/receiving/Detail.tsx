import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck, Receipt, ShoppingCart } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, StatusPill, KV, Alert, Field } from '@/components/ui'
import { AttachmentList, ProcessTracker } from '@/components/workflow'
import { fmtDate, fmtDateTime, cx } from '@/lib/format'
import { receiptProgress, receivedQty } from '@/lib/match'
import type { Attachment, GoodsReceiptLine } from '@/types'

export default function ReceivingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { pos, grns, invoices, settings, postGoodsReceipt } = useStore()
  const po = pos.find((p) => p.id === id)
  const [form, setForm] = useState<{ deliveryNoteRef: string; location: string; notes: string; attachments: Attachment[]; lines: Record<string, GoodsReceiptLine> }>(() => ({
    deliveryNoteRef: '', location: po?.deliveryAddress ?? settings.address, notes: '', attachments: [] as Attachment[], lines: {},
  }))
  const [err, setErr] = useState<string | null>(null)
  const [posted, setPosted] = useState<string | null>(null)
  if (!po) return <Alert tone="danger">Purchase order not found.</Alert>
  const poGrns = grns.filter((g) => g.poId === po.id)
  const prog = receiptProgress(po, grns)
  const canReceive = ['issued', 'contracted', 'partially_received'].includes(po.status)
  const attachments = form.attachments

  const setLine = (lineItemId: string, patch: Partial<GoodsReceiptLine>) =>
    setForm((f) => { const prev = f.lines[lineItemId] as GoodsReceiptLine | undefined; return { ...f, lines: { ...f.lines, [lineItemId]: { lineItemId, quantity: prev?.quantity ?? 0, condition: prev?.condition ?? 'good', notes: prev?.notes, ...patch } } } })
  const receiveAll = () => po.lines.forEach((l) => setLine(l.id, { quantity: Math.max(0, l.quantity - receivedQty(grns, po.id, l.id)) }))
  const submit = () => {
    const r = postGoodsReceipt(po.id, { deliveryNoteRef: form.deliveryNoteRef, location: form.location, notes: form.notes, attachments, lines: Object.values(form.lines) })
    if (!r.ok) return setErr(r.error ?? 'Failed')
    setErr(null); setPosted(r.grnId!); setForm((f) => ({ ...f, deliveryNoteRef: '', notes: '', attachments: [], lines: {} }))
  }

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{po.number} · Goods receipt</span>} title={po.title}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={po.status} /><span>{po.vendorName}</span><span>· expected {fmtDate(po.deliveryDate)}</span><span>· Owner {po.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <Link to={`/orders/${po.id}`} className="btn-secondary"><ShoppingCart size={15} /> View PO</Link>
          {prog.received > 0 && <Link to={`/invoices/new?po=${po.id}`} className="btn-secondary"><Receipt size={15} /> Register invoice</Link>}
        </>} />
      <div className="card mb-6 px-5 py-4"><ProcessTracker current="receipt" /></div>
      {posted && <div className="mb-6"><Alert tone="success"><b>Goods receipt {grns.find((g) => g.id === posted)?.number} posted.</b> {prog.complete ? 'This purchase order is now fully received.' : `${prog.received} of ${prog.ordered} units received to date.`}</Alert></div>}
      {!canReceive && !posted && <div className="mb-6"><Alert tone={po.status === 'received' || po.status === 'closed' ? 'success' : 'warning'}>{po.status === 'received' || po.status === 'closed' ? 'All lines on this purchase order have been received in full.' : 'This purchase order is not in a receivable state.'}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Receive against order lines" description="Enter the quantity physically received today. Outstanding = ordered − received to date." padded={false}
            actions={canReceive && <button className="btn-secondary btn-sm" onClick={receiveAll}>Receive all outstanding</button>}>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead><tr><th className="table-th">Line</th><th className="table-th w-20 text-right">Ordered</th><th className="table-th w-24 text-right">Received</th><th className="table-th w-24 text-right">Outstanding</th><th className="table-th w-28">Receive now</th><th className="table-th w-36">Condition</th><th className="table-th">Notes</th></tr></thead>
                <tbody>{po.lines.map((l) => { const rec = receivedQty(grns, po.id, l.id); const out = Math.max(0, l.quantity - rec); const f = form.lines[l.id]; return (
                  <tr key={l.id}>
                    <td className="table-td"><div className="font-medium text-ink-900">{l.description}</div><div className="text-[11.5px] text-ink-500">{l.unit} · {l.costCenter}</div></td>
                    <td className="table-td text-right tabular-nums">{l.quantity}</td>
                    <td className="table-td text-right tabular-nums text-brand-700 font-medium">{rec}</td>
                    <td className={cx('table-td text-right tabular-nums', out > 0 ? 'text-sun-700 font-medium' : 'text-ink-400')}>{out}</td>
                    <td className="table-td"><input type="number" min={0} max={out} className="input" disabled={!canReceive || out === 0} value={f?.quantity ?? ''} placeholder="0" onChange={(e) => setLine(l.id, { quantity: Number(e.target.value) })} /></td>
                    <td className="table-td"><select className="input" disabled={!canReceive || out === 0} value={f?.condition ?? 'good'} onChange={(e) => setLine(l.id, { condition: e.target.value as GoodsReceiptLine['condition'] })}><option value="good">Good</option><option value="damaged">Damaged</option><option value="partial">Partial / short</option></select></td>
                    <td className="table-td"><input className="input" disabled={!canReceive || out === 0} value={f?.notes ?? ''} placeholder="Batch, serials, remarks…" onChange={(e) => setLine(l.id, { notes: e.target.value })} /></td>
                  </tr>) })}</tbody>
              </table>
            </div>
          </Card>

          {canReceive && (
            <Card title="Delivery details">
              {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vendor delivery note / job card ref."><input className="input" value={form.deliveryNoteRef} onChange={(e) => setForm({ ...form, deliveryNoteRef: e.target.value })} /></Field>
                <Field label="Received at (location)"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
                <Field label="Inspection notes" className="sm:col-span-2"><textarea className="input min-h-[72px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condition on arrival, discrepancies, who inspected…" /></Field>
              </div>
              <div className="mt-4"><div className="label">Signed delivery note / photos</div><AttachmentList items={attachments} onAdd={(a) => setForm({ ...form, attachments: [...attachments, a] })} onRemove={(aid) => setForm({ ...form, attachments: attachments.filter((a) => a.id !== aid) })} /></div>
              <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={submit}><PackageCheck size={15} /> Post goods receipt</button></div>
            </Card>
          )}

          <Card title="Goods receipt history" padded={false}>
            {poGrns.length === 0 ? <div className="px-5 py-6 text-center text-[13px] text-ink-500">No receipts posted for this order yet.</div> : (
              <ul className="divide-y divide-line">{poGrns.map((g) => (
                <li key={g.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[12.5px] font-semibold text-brand-700">{g.number}</span><span className="text-[12px] text-ink-500">{fmtDateTime(g.receivedAt)} · {g.receivedByName}</span></div>
                  <div className="mt-1 text-[12.5px] text-ink-700">{g.lines.map((l) => { const pl = po.lines.find((x) => x.id === l.lineItemId); return <span key={l.lineItemId} className="mr-3">{pl?.description}: <b>{l.quantity}</b> <span className={l.condition === 'good' ? 'text-brand-700' : 'text-accent-700'}>({l.condition})</span></span> })}</div>
                  <div className="text-[12px] text-ink-500">DN {g.deliveryNoteRef || '—'} · {g.location}{g.notes && ` · ${g.notes}`}{g.attachments.length > 0 && ` · ${g.attachments.length} file(s)`}</div>
                </li>))}</ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Receipt progress">
            <div className="text-[26px] font-semibold text-ink-900">{prog.pct}%</div>
            <div className="mb-3 text-[12.5px] text-ink-500">{prog.received} of {prog.ordered} units received</div>
            <div className="h-2 w-full rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', prog.complete ? 'bg-brand-600' : 'bg-sun-500')} style={{ width: `${prog.pct}%` }} /></div>
          </Card>
          <Card title="Invoices on this order">
            {invoices.filter((i) => i.poId === po.id).length === 0 ? <div className="text-[13px] text-ink-500">None registered.</div> : (
              <ul className="space-y-2">{invoices.filter((i) => i.poId === po.id).map((i) => <li key={i.id}><Link to={`/invoices/${i.id}`} className="flex items-center justify-between text-[13px] hover:underline"><span className="font-mono text-brand-700">{i.number}</span><StatusPill status={i.status} /></Link></li>)}</ul>
            )}
          </Card>
          <Card title="Order"><KV k="Vendor" v={po.vendorName} /><KV k="Requisition" v={<Link to={`/requisitions/${po.prId}`} className="text-brand-700 hover:underline">{po.prNumber}</Link>} /><KV k="Incoterms" v={po.incoterms} /><KV k="Deliver to" v={po.deliveryAddress} /><KV k="Issued" v={fmtDate(po.issuedAt)} /></Card>
        </div>
      </div>
    </>
  )
}

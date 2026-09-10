import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Receipt } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Field, Alert, KV } from '@/components/ui'
import { AttachmentList, ProcessTracker } from '@/components/workflow'
import { fmtMoney, toInputDate, addDays } from '@/lib/format'
import { invoiceTotals, invoicedQty, receivedQty, runMatch } from '@/lib/match'
import type { Attachment, InvoiceLine } from '@/types'

export default function InvoiceNew() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const user = useCurrentUser()!
  const { pos, grns, invoices, settings, registerInvoice } = useStore()
  const eligible = pos.filter((p) => ['issued', 'contracted', 'partially_received', 'received'].includes(p.status))
  const [poId, setPoId] = useState(sp.get('po') ?? '')
  const po = pos.find((p) => p.id === poId)
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(toInputDate(new Date()))
  const [dueDate, setDueDate] = useState(toInputDate(addDays(new Date(), settings.paymentTermsDays)))
  const [taxRate, setTaxRate] = useState(po?.taxRate ?? settings.taxRate)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [lines, setLines] = useState<Record<string, InvoiceLine>>({})
  const [err, setErr] = useState<string | null>(null)

  const pickPO = (id: string) => {
    setPoId(id); setLines({}); const p = pos.find((x) => x.id === id); if (p) setTaxRate(p.taxRate)
  }
  const setLine = (l: { id: string; description: string; unitPrice: number }, patch: Partial<InvoiceLine>) =>
    setLines((ls) => { const prev = ls[l.id] as InvoiceLine | undefined; return { ...ls, [l.id]: { lineItemId: l.id, description: l.description, quantity: prev?.quantity ?? 0, unitPrice: prev?.unitPrice ?? l.unitPrice, ...patch } } })
  const fillReceived = () => po?.lines.forEach((l) => setLine(l, { quantity: Math.max(0, receivedQty(grns, po.id, l.id) - invoicedQty(invoices, po.id, l.id)) }))

  const draftLines = Object.values(lines).filter((l) => l.quantity > 0)
  const totals = invoiceTotals(draftLines, taxRate)
  const preview = useMemo(() => (po ? runMatch({ id: '__new', poId: po.id, lines: draftLines, taxRate, vendorInvoiceNo, vendorId: po.vendorId }, po, grns, invoices, settings.priceTolerancePct) : []), [po, draftLines, taxRate, vendorInvoiceNo, grns, invoices, settings.priceTolerancePct])

  const submit = () => {
    if (!po) return setErr('Select a purchase order.')
    const r = registerInvoice({ poId: po.id, vendorInvoiceNo, invoiceDate, dueDate, lines: draftLines, taxRate, attachments })
    if (!r.ok) return setErr(r.error ?? 'Failed')
    nav(`/invoices/${r.invoiceId}`)
  }

  return (
    <>
      <PageHeader eyebrow="New document" title="Register vendor invoice" subtitle={`Captured by ${user.name} · Owner Bilal Abbassi`}
        actions={<><button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={submit} disabled={!po}><Receipt size={15} /> Register & run 3-way match</button></>} />
      <div className="card mb-6 px-5 py-4"><ProcessTracker current="invoice" /></div>
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Invoice header">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purchase order" required className="sm:col-span-2"><select className="input" value={poId} onChange={(e) => pickPO(e.target.value)}><option value="">Select an issued purchase order…</option>{eligible.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.vendorName} · {p.title}</option>)}</select></Field>
              <Field label="Vendor" ><input className="input" disabled value={po?.vendorName ?? ''} /></Field>
              <Field label="Vendor invoice number" required><input className="input" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="As printed on the invoice" /></Field>
              <Field label="Invoice date"><input type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
              <Field label="Due date"><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              <Field label="Tax rate %"><input type="number" className="input" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></Field>
            </div>
          </Card>
          <Card title="Invoice lines" description="Quantities default to what has been received but not yet invoiced." padded={false}
            actions={po && <button className="btn-secondary btn-sm" onClick={fillReceived}>Fill from receipts</button>}>
            {!po ? <div className="px-5 py-8 text-center text-[13px] text-ink-500">Select a purchase order to load its lines.</div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[760px] text-[13px]">
                  <thead><tr><th className="table-th">PO line</th><th className="table-th w-20 text-right">Ordered</th><th className="table-th w-20 text-right">Received</th><th className="table-th w-20 text-right">Invoiced</th><th className="table-th w-28">Invoice qty</th><th className="table-th w-32">Unit price</th><th className="table-th w-32 text-right">Line total</th></tr></thead>
                  <tbody>{po.lines.map((l) => { const f = lines[l.id]; return (
                    <tr key={l.id}>
                      <td className="table-td"><div className="font-medium text-ink-900">{l.description}</div><div className="text-[11.5px] text-ink-500">PO price {fmtMoney(l.unitPrice, po.currency)} / {l.unit}</div></td>
                      <td className="table-td text-right tabular-nums">{l.quantity}</td>
                      <td className="table-td text-right tabular-nums text-brand-700">{receivedQty(grns, po.id, l.id)}</td>
                      <td className="table-td text-right tabular-nums text-ink-500">{invoicedQty(invoices, po.id, l.id)}</td>
                      <td className="table-td"><input type="number" min={0} className="input" value={f?.quantity ?? ''} placeholder="0" onChange={(e) => setLine(l, { quantity: Number(e.target.value) })} /></td>
                      <td className="table-td"><input type="number" step="0.01" className="input" value={f?.unitPrice ?? l.unitPrice} onChange={(e) => setLine(l, { unitPrice: Number(e.target.value) })} /></td>
                      <td className="table-td text-right tabular-nums">{fmtMoney((f?.quantity ?? 0) * (f?.unitPrice ?? l.unitPrice), po.currency)}</td>
                    </tr>) })}</tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Invoice document" description="Scanned vendor invoice (PDF/image)"><AttachmentList items={attachments} onAdd={(a) => setAttachments([...attachments, a])} onRemove={(id) => setAttachments(attachments.filter((a) => a.id !== id))} /></Card>
        </div>
        <div className="space-y-6">
          <Card title="Invoice total">
            <div className="text-[26px] font-semibold text-ink-900">{fmtMoney(totals.total, po?.currency ?? settings.defaultCurrency)}</div>
            <KV k="Subtotal" v={fmtMoney(totals.subtotal, po?.currency ?? settings.defaultCurrency)} /><KV k={`Tax ${taxRate}%`} v={fmtMoney(totals.tax, po?.currency ?? settings.defaultCurrency)} />
          </Card>
          <Card title="Match preview" description="Live 3-way check against PO and receipts">
            {!po || draftLines.length === 0 ? <div className="text-[13px] text-ink-500">Enter invoice lines to preview the match.</div> : preview.length === 0 ? <Alert tone="success">✓ All lines match the purchase order and goods receipts.</Alert> : (
              <ul className="space-y-2">{preview.map((i, k) => <li key={k}><Alert tone={i.severity === 'block' ? 'danger' : 'warning'}>{i.message}</Alert></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trophy, Trash2, Pencil, ShoppingCart, UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, Field, Modal, Alert, KV, EmptyState } from '@/components/ui'
import { AttachmentList, ProcessTracker, CommentThread } from '@/components/workflow'
import { fmtMoney, fmtDate, linesSubtotal, toInputDate, addDays, cx } from '@/lib/format'
import type { Quotation, Attachment } from '@/types'

const blankQuote = (prLines: { id: string; unitPrice: number }[], ccy: Quotation['currency'], tax: number): Omit<Quotation, 'id'> => ({
  vendorId: '', vendorName: '', reference: '', receivedAt: new Date().toISOString(), validUntil: toInputDate(addDays(new Date(), 30)),
  currency: ccy, subtotal: 0, taxRate: tax, deliveryDays: 14, paymentTerms: '30 days net', warranty: '12 months', notes: '', attachments: [],
  lines: prLines.map((l) => ({ lineItemId: l.id, unitPrice: l.unitPrice })), compliant: true,
})

export default function SourcingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { prs, vendors, users, settings, takeSourcing, addQuotation, updateQuotation, removeQuotation, awardQuotation, createPOFromAward, addPRComment } = useStore()
  const pr = prs.find((p) => p.id === id)
  const [editing, setEditing] = useState<null | { qid?: string; q: Omit<Quotation, 'id'> }>(null)
  const [awardOpen, setAwardOpen] = useState<null | string>(null)
  const [just, setJust] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (!pr) return <Alert tone="danger">Requisition not found.</Alert>
  const isProc = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const amount = linesSubtotal(pr.lines)
  const need = amount >= settings.quotationThreshold ? settings.quotationMinimum : 1
  const enough = pr.quotations.length >= need
  const canEdit = isProc && ['approved', 'sourcing'].includes(pr.status)
  const awarded = pr.quotations.find((q) => q.id === pr.awardedQuotationId)

  // scoring: 60% price, 25% delivery, 15% compliance/warranty
  const ranked = useMemo(() => {
    const qs = pr.quotations.filter((q) => q.subtotal > 0)
    const minP = Math.min(...qs.map((q) => q.subtotal)), minD = Math.min(...qs.map((q) => q.deliveryDays))
    return pr.quotations.map((q) => {
      if (q.subtotal <= 0) return { ...q, score: 0 }
      const p = (minP / q.subtotal) * 60, d = (minD / Math.max(q.deliveryDays, 1)) * 25, c = (q.compliant ? 15 : 0)
      return { ...q, score: Math.round(p + d + c) }
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }, [pr.quotations])
  const best = ranked[0]

  const openNew = () => setEditing({ q: blankQuote(pr.lines, pr.currency, settings.taxRate) })
  const openEdit = (q: Quotation) => { const { id: qid, ...rest } = q; setEditing({ qid, q: rest }) }
  const recalc = (q: Omit<Quotation, 'id'>) => ({ ...q, subtotal: q.lines.reduce((s, l) => s + (pr.lines.find((x) => x.id === l.lineItemId)?.quantity ?? 0) * l.unitPrice, 0) })
  const saveQuote = () => {
    if (!editing) return
    const q = recalc(editing.q)
    if (!q.vendorId) return setErr('Select a vendor.')
    if (!q.reference.trim()) return setErr('Vendor quotation reference is required.')
    if (editing.qid) updateQuotation(pr.id, editing.qid, q); else addQuotation(pr.id, q)
    setEditing(null); setErr(null)
  }
  const doAward = () => {
    const r = awardQuotation(pr.id, awardOpen!, just)
    if (!r.ok) return setErr(r.error ?? 'Failed')
    setAwardOpen(null); setJust(''); setErr(null)
  }
  const raisePO = () => { const r = createPOFromAward(pr.id); if (!r.ok) return alert(r.error); nav(`/orders/${r.poId}`) }

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{pr.number} · Sourcing</span>} title={pr.title}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={pr.status} /><span>{pr.department} · needed by {fmtDate(pr.neededBy)}</span><span>· Owner {pr.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <Link to={`/requisitions/${pr.id}`} className="btn-secondary">View requisition</Link>
          {isProc && pr.status === 'approved' && <button className="btn-primary" onClick={() => takeSourcing(pr.id)}><UserCheck size={15} /> Start sourcing (assign to me)</button>}
          {canEdit && <button className="btn-primary" onClick={openNew}><Plus size={15} /> Add quotation</button>}
          {isProc && pr.status === 'awarded' && !pr.poId && <button className="btn-primary" onClick={raisePO}><ShoppingCart size={15} /> Raise purchase order</button>}
          {pr.poId && <Link to={`/orders/${pr.poId}`} className="btn-secondary"><ShoppingCart size={15} /> Open PO</Link>}
        </>} />

      <div className="card mb-6 px-5 py-4"><ProcessTracker current={pr.status === 'awarded' ? 'po' : pr.status === 'ordered' ? 'po_approval' : 'sourcing'} /></div>

      {/* Quotation requirement banner */}
      <div className={cx('mb-6 flex items-center gap-3 rounded-card border px-4 py-3 text-[13.5px]', enough ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-sun-300 bg-sun-50 text-sun-700')}>
        {enough ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        <div className="flex-1">
          <b>{pr.quotations.length} of {need} required quotation(s) recorded.</b>{' '}
          {need > 1 ? `Requisitions at or above ${fmtMoney(settings.quotationThreshold, pr.currency)} require ${settings.quotationMinimum} competitive quotations before award.` : 'Single quotation is acceptable below the threshold.'}
        </div>
        <div className="flex gap-1">{Array.from({ length: need }).map((_, i) => <span key={i} className={cx('h-2.5 w-7 rounded-sm', i < pr.quotations.length ? 'bg-brand-600' : 'bg-ink-200')} />)}</div>
      </div>

      {awarded && (
        <div className="mb-6"><Alert tone="success"><Trophy size={14} className="inline mr-1" /> <b>Awarded to {awarded.vendorName}</b> ({awarded.reference}) — {fmtMoney(awarded.subtotal, awarded.currency)}. {pr.awardJustification}</Alert></div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Comparison table */}
          <Card title="Quotation comparison" description="Score = 60% price · 25% delivery · 15% compliance. Lowest compliant price highlighted." padded={false}>
            {pr.quotations.length === 0 ? <div className="p-5"><EmptyState title="No quotations yet" body="Record each vendor's quotation to build the comparison." action={canEdit && <button className="btn-primary btn-sm" onClick={openNew}><Plus size={14} /> Add quotation</button>} /></div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead><tr>
                    <th className="table-th">Criteria</th>
                    {ranked.map((q) => <th key={q.id} className={cx('table-th', q.id === pr.awardedQuotationId && 'bg-brand-50 text-brand-800')}>{q.vendorName}<div className="font-normal normal-case tracking-normal text-ink-500">{q.reference}</div></th>)}
                  </tr></thead>
                  <tbody>
                    {pr.lines.map((l) => (
                      <tr key={l.id}><td className="table-td text-ink-600">{l.description} <span className="text-ink-400">× {l.quantity}</span></td>
                        {ranked.map((q) => { const up = q.lines.find((x) => x.lineItemId === l.id)?.unitPrice ?? 0; return <td key={q.id} className="table-td tabular-nums">{fmtMoney(up, q.currency)} <span className="text-ink-400">/ {l.unit}</span></td> })}</tr>
                    ))}
                    <tr className="bg-surface-muted"><td className="table-td font-semibold">Subtotal (excl. tax)</td>{ranked.map((q) => <td key={q.id} className={cx('table-td font-semibold tabular-nums', q.subtotal === Math.min(...ranked.filter((x) => x.compliant).map((x) => x.subtotal)) && 'text-brand-700')}>{fmtMoney(q.subtotal, q.currency)}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Total incl. {settings.taxRate}% tax</td>{ranked.map((q) => <td key={q.id} className="table-td tabular-nums">{fmtMoney(q.subtotal * (1 + q.taxRate / 100), q.currency)}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Delivery lead time</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.deliveryDays} days</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Payment terms</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.paymentTerms}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Warranty</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.warranty}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Valid until</td>{ranked.map((q) => <td key={q.id} className={cx('table-td', new Date(q.validUntil) < new Date() && 'text-accent-700')}>{fmtDate(q.validUntil)}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Technically compliant</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.compliant ? <span className="text-brand-700 font-medium">Yes</span> : <span className="text-accent-700 font-medium">No</span>}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Attachments</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.attachments.length} file(s)</td>)}</tr>
                    <tr className="bg-surface-muted"><td className="table-td font-semibold">Evaluation score</td>{ranked.map((q) => <td key={q.id} className="table-td"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-pill bg-ink-200"><div className="h-full rounded-pill bg-brand-600" style={{ width: `${q.score ?? 0}%` }} /></div><b>{q.score}</b>{q.id === best?.id && <span className="rounded-pill bg-sun-100 px-1.5 text-[10.5px] font-bold text-sun-700">BEST</span>}</div></td>)}</tr>
                    {canEdit && <tr><td className="table-td" />{ranked.map((q) => <td key={q.id} className="table-td"><div className="flex gap-1">
                      <button className="btn-secondary btn-sm" onClick={() => openEdit(q)}><Pencil size={13} /></button>
                      <button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Remove quotation?') && removeQuotation(pr.id, q.id)}><Trash2 size={13} /></button>
                      <button className="btn-primary btn-sm" disabled={!enough} onClick={() => { setAwardOpen(q.id); setErr(null) }}><Trophy size={13} /> Award</button>
                    </div></td>)}</tr>}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Quotation cards with attachments */}
          {pr.quotations.map((q) => (
            <Card key={q.id} title={<span className="flex items-center gap-2">{q.vendorName} {q.id === pr.awardedQuotationId && <StatusPill status="awarded" />}</span>} description={`Ref ${q.reference} · received ${fmtDate(q.receivedAt)}`}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>{q.notes && <p className="mb-3 text-[13px] text-ink-700">{q.notes}</p>}<KV k="Vendor contact" v={vendors.find((v) => v.id === q.vendorId)?.contactName} /><KV k="Vendor rating" v={'★'.repeat(vendors.find((v) => v.id === q.vendorId)?.rating ?? 0)} /></div>
                <div><div className="label">Quotation documents</div><AttachmentList items={q.attachments} readOnly={!canEdit} onAdd={(a: Attachment) => updateQuotation(pr.id, q.id, { attachments: [...q.attachments, a] })} onRemove={(aid) => updateQuotation(pr.id, q.id, { attachments: q.attachments.filter((a) => a.id !== aid) })} /></div>
              </div>
            </Card>
          ))}

          <Card title="Sourcing notes"><CommentThread comments={pr.comments} onAdd={(t) => addPRComment(pr.id, t)} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Requisition summary">
            <div className="text-[22px] font-semibold text-ink-900">{fmtMoney(amount, pr.currency)}</div>
            <div className="mb-3 text-[12.5px] text-ink-500">Estimated · {pr.lines.length} line(s)</div>
            <KV k="Requester" v={pr.requesterName} /><KV k="Department" v={pr.department} /><KV k="Sourcing officer" v={users.find((u) => u.id === pr.sourcingOwnerId)?.name ?? 'Unassigned'} /><KV k="Approved" v={fmtDate(pr.approvedAt)} />
          </Card>
          <Card title="Line items">
            <ul className="space-y-2 text-[13px]">{pr.lines.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="text-ink-800">{l.description}</span><span className="shrink-0 text-ink-500">{l.quantity} {l.unit}</span></li>)}</ul>
          </Card>
          <Card title="Sourcing checklist">
            <ul className="space-y-2 text-[13px]">
              {[
                { ok: !!pr.sourcingOwnerId, t: 'Sourcing officer assigned' },
                { ok: pr.quotations.length >= 1, t: 'First quotation recorded' },
                { ok: enough, t: `${need} quotation(s) recorded` },
                { ok: pr.quotations.every((q) => q.attachments.length > 0) && pr.quotations.length > 0, t: 'All quotations have documents attached' },
                { ok: !!pr.awardedQuotationId, t: 'Vendor awarded with justification' },
                { ok: !!pr.poId, t: 'Purchase order raised' },
              ].map((c) => <li key={c.t} className="flex items-center gap-2"><span className={cx('flex h-4.5 w-4.5 h-[18px] w-[18px] items-center justify-center rounded-full text-[10px]', c.ok ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-500')}>{c.ok ? '✓' : ''}</span><span className={c.ok ? 'text-ink-800' : 'text-ink-500'}>{c.t}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>

      {/* Quotation modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.qid ? 'Edit quotation' : 'Record vendor quotation'} width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={saveQuote}>Save quotation</button></>}>
        {editing && (
          <div className="space-y-4">
            {err && <Alert tone="danger">{err}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor" required><select className="input" value={editing.q.vendorId} onChange={(e) => { const v = vendors.find((x) => x.id === e.target.value); setEditing({ ...editing, q: { ...editing.q, vendorId: e.target.value, vendorName: v?.name ?? '' } }) }}><option value="">Select vendor…</option>{vendors.filter((v) => v.status !== 'blocked').map((v) => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}</select></Field>
              <Field label="Vendor quotation ref." required><input className="input" value={editing.q.reference} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, reference: e.target.value } })} /></Field>
              <Field label="Valid until"><input type="date" className="input" value={editing.q.validUntil} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, validUntil: e.target.value } })} /></Field>
              <Field label="Delivery lead time (days)"><input type="number" className="input" value={editing.q.deliveryDays} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, deliveryDays: Number(e.target.value) } })} /></Field>
              <Field label="Payment terms"><input className="input" value={editing.q.paymentTerms} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, paymentTerms: e.target.value } })} /></Field>
              <Field label="Warranty"><input className="input" value={editing.q.warranty} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, warranty: e.target.value } })} /></Field>
              <Field label="Tax rate %"><input type="number" className="input" value={editing.q.taxRate} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, taxRate: Number(e.target.value) } })} /></Field>
              <Field label="Technically compliant"><select className="input" value={editing.q.compliant ? '1' : '0'} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, compliant: e.target.value === '1' } })}><option value="1">Yes — meets specification</option><option value="0">No — deviations noted</option></select></Field>
            </div>
            <div>
              <div className="label">Quoted unit prices</div>
              <table className="w-full text-[13px]"><thead><tr><th className="table-th">Line</th><th className="table-th w-24">Qty</th><th className="table-th w-40">Unit price</th><th className="table-th w-32 text-right">Total</th></tr></thead>
                <tbody>{pr.lines.map((l) => { const ql = editing.q.lines.find((x) => x.lineItemId === l.id); const up = ql?.unitPrice ?? 0; return (
                  <tr key={l.id}><td className="table-td">{l.description}</td><td className="table-td">{l.quantity} {l.unit}</td>
                    <td className="table-td"><input type="number" step="0.01" className="input" value={up} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, lines: editing.q.lines.map((x) => (x.lineItemId === l.id ? { ...x, unitPrice: Number(e.target.value) } : x)) } })} /></td>
                    <td className="table-td text-right tabular-nums">{fmtMoney(up * l.quantity, editing.q.currency)}</td></tr>) })}</tbody>
                <tfoot><tr><td colSpan={3} className="px-4 py-2 text-right text-[12px] uppercase text-ink-500">Subtotal</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtMoney(recalc(editing.q).subtotal, editing.q.currency)}</td></tr></tfoot>
              </table>
            </div>
            <Field label="Notes / deviations"><textarea className="input min-h-[72px]" value={editing.q.notes} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, notes: e.target.value } })} /></Field>
            <div><div className="label">Quotation document (PDF / scan)</div><AttachmentList items={editing.q.attachments} onAdd={(a) => setEditing({ ...editing, q: { ...editing.q, attachments: [...editing.q.attachments, a] } })} onRemove={(aid) => setEditing({ ...editing, q: { ...editing.q, attachments: editing.q.attachments.filter((a) => a.id !== aid) } })} /></div>
          </div>
        )}
      </Modal>

      {/* Award modal */}
      <Modal open={!!awardOpen} onClose={() => setAwardOpen(null)} title="Award quotation"
        footer={<><button className="btn-secondary" onClick={() => setAwardOpen(null)}>Cancel</button><button className="btn-primary" onClick={doAward}><Trophy size={14} /> Confirm award</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        {awardOpen && (() => { const q = pr.quotations.find((x) => x.id === awardOpen)!; return (
          <div className="mb-4 rounded-control border border-brand-200 bg-brand-50 px-3 py-2 text-[13px]"><b>{q.vendorName}</b> · {q.reference} · {fmtMoney(q.subtotal, q.currency)} · {q.deliveryDays} days{q.id !== best?.id && <div className="mt-1 text-sun-700">Note: this is not the highest-scoring quotation — a justification is mandatory and will be recorded in the audit trail.</div>}</div>) })()}
        <Field label="Award justification" required hint="Recorded on the requisition and visible to PO approvers."><textarea className="input min-h-[110px]" value={just} onChange={(e) => setJust(e.target.value)} placeholder="e.g. Lowest compliant price; shortest lead time; proven track record with RHS…" /></Field>
      </Modal>
    </>
  )
}

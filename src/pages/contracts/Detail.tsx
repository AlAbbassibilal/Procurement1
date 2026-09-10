import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Scale, PenLine, Plus, Trash2, Printer, CheckCircle2, Undo2 } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, KV, Alert, Field, Modal } from '@/components/ui'
import { CommentThread, AttachmentList, ProcessTracker } from '@/components/workflow'
import { fmtMoney, fmtDate, fmtDateTime, uid, cx } from '@/lib/format'
import { STANDARD_CLAUSES } from '@/data/seed'
import { Logo } from '@/components/Logo'
import type { Contract } from '@/types'

export default function ContractDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { contracts, users, vendors, settings, updateContract, sendContractToLegal, legalDecision, signContract, addContractComment } = useStore()
  const ct = contracts.find((c) => c.id === id)
  const [legalOpen, setLegalOpen] = useState<null | boolean>(null)
  const [notes, setNotes] = useState('')
  if (!ct) return <Alert tone="danger">Contract not found.</Alert>

  const isProc = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const isLegal = user.role === 'legal' || user.role === 'admin'
  const canSignRHS = ['executive_director', 'admin'].includes(user.role)
  const editable = isProc && ct.status === 'drafting'
  const vendor = vendors.find((v) => v.id === ct.vendorId)
  const set = (patch: Partial<Contract>) => updateContract(ct.id, patch)
  const stage = 'contract'

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{ct.number}</span>} title={ct.title}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={ct.status} /><span>{ct.vendorName}</span><span>· from <Link to={`/orders/${ct.poId}`} className="text-brand-700 hover:underline">{ct.poNumber}</Link></span><span>· Owner {ct.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {editable && <button className="btn-primary" onClick={() => sendContractToLegal(ct.id)}><Scale size={15} /> Send to Legal</button>}
          {isLegal && ct.status === 'legal_review' && <>
            <button className="btn-secondary" onClick={() => { setLegalOpen(false); setNotes('') }}><Undo2 size={15} /> Return with comments</button>
            <button className="btn-primary" onClick={() => { setLegalOpen(true); setNotes('') }}><CheckCircle2 size={15} /> Clear for signature</button>
          </>}
          {ct.status === 'pending_signature' && canSignRHS && !ct.signatories.find((s) => s.party === 'RHS')?.signedAt && <button className="btn-primary" onClick={() => confirm('Record RHS signature?') && signContract(ct.id, 'RHS')}><PenLine size={15} /> Sign for RHS</button>}
          {ct.status === 'pending_signature' && isProc && !ct.signatories.find((s) => s.party === 'Vendor')?.signedAt && <button className="btn-secondary" onClick={() => confirm('Record vendor countersignature?') && signContract(ct.id, 'Vendor')}><PenLine size={15} /> Record vendor signature</button>}
        </>} />

      <div className="card mb-6 px-5 py-4"><ProcessTracker current={stage} /></div>

      {ct.status === 'drafting' && ct.legalNotes && <div className="mb-6"><Alert tone="warning"><b>Returned by Legal:</b> {ct.legalNotes}</Alert></div>}
      {ct.status === 'legal_review' && <div className="mb-6"><Alert tone="info"><Scale size={14} className="inline mr-1" /> Under legal review by {users.find((u) => u.id === ct.legalReviewer)?.name ?? 'Legal'}.</Alert></div>}
      {ct.status === 'pending_signature' && <div className="mb-6"><Alert tone="success"><b>Cleared by Legal.</b> {ct.legalNotes} Awaiting signatures.</Alert></div>}
      {ct.status === 'active' && <div className="mb-6"><Alert tone="success"><b>Contract fully executed and active.</b></Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4">
              <Logo size="sm" />
              <div className="text-right text-[12.5px] text-ink-600"><div className="text-[16px] font-semibold text-ink-900 uppercase">{ct.type} agreement</div><div className="font-mono">{ct.number}</div></div>
            </div>
            <div className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-800">
              This Agreement is made between <b>{settings.orgName}</b> ({settings.address}) (“RHS”) and <b>{ct.vendorName}</b>{vendor && <> ({vendor.country}, Tax ID {vendor.taxId})</>} (“the Vendor”) with reference to Purchase Order <b>{ct.poNumber}</b> and Requisition <b>{ct.prNumber}</b>, for a total contract value of <b>{fmtMoney(ct.value, ct.currency)}</b>, effective from <b>{fmtDate(ct.startDate)}</b> to <b>{fmtDate(ct.endDate)}</b>.
            </div>
          </Card>

          <Card title="Key terms">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contract title" className="sm:col-span-2"><input className="input" disabled={!editable} value={ct.title} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Type"><select className="input" disabled={!editable} value={ct.type} onChange={(e) => set({ type: e.target.value as Contract['type'] })}><option value="supply">Supply</option><option value="service">Service</option><option value="framework">Framework</option><option value="works">Works</option></select></Field>
              <Field label="Contract value"><input type="number" className="input" disabled={!editable} value={ct.value} onChange={(e) => set({ value: Number(e.target.value) })} /></Field>
              <Field label="Start date"><input type="date" className="input" disabled={!editable} value={ct.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
              <Field label="End date"><input type="date" className="input" disabled={!editable} value={ct.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
            </div>
          </Card>

          <Card title="Clauses" description="Mandatory clauses are locked; optional clauses can be added from the library."
            actions={editable && (
              <select className="input w-auto text-[12.5px]" value="" onChange={(e) => { const c = STANDARD_CLAUSES.find((x) => x.id === e.target.value); if (c && !ct.clauses.some((x) => x.id === c.id)) set({ clauses: [...ct.clauses, c] }) }}>
                <option value="">+ Add from library…</option>{STANDARD_CLAUSES.filter((c) => !ct.clauses.some((x) => x.id === c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>)}>
            <ol className="space-y-4">
              {ct.clauses.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13.5px] font-semibold text-ink-900">{c.title} {c.mandatory && <span className="ml-1 rounded-pill bg-ink-100 px-1.5 text-[10px] font-medium uppercase text-ink-500">mandatory</span>}</div>
                    {editable && !c.mandatory && <button className="btn-ghost btn-sm text-accent-700" onClick={() => set({ clauses: ct.clauses.filter((x) => x.id !== c.id) })}><Trash2 size={13} /></button>}
                  </div>
                  {editable ? <textarea className="input mt-1 min-h-[80px] text-[13px]" value={c.body} onChange={(e) => set({ clauses: ct.clauses.map((x) => (x.id === c.id ? { ...x, body: e.target.value } : x)) })} /> : <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{c.body}</p>}
                </li>
              ))}
              {editable && <li><button className="btn-secondary btn-sm" onClick={() => set({ clauses: [...ct.clauses, { id: uid('c_'), title: `${ct.clauses.length + 1}. Special condition`, body: '', mandatory: false }] })}><Plus size={13} /> Custom clause</button></li>}
            </ol>
          </Card>

          <Card title="Milestones & payment schedule" padded={false}>
            <table className="w-full text-[13px]">
              <thead><tr><th className="table-th">Milestone</th><th className="table-th w-40">Due</th><th className="table-th w-36 text-right">Amount</th><th className="table-th w-32">Status</th>{editable && <th className="table-th w-10" />}</tr></thead>
              <tbody>{ct.milestones.map((m) => (
                <tr key={m.id}>
                  <td className="table-td">{editable ? <input className="input" value={m.title} onChange={(e) => set({ milestones: ct.milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)) })} /> : m.title}</td>
                  <td className="table-td">{editable ? <input type="date" className="input" value={m.dueDate} onChange={(e) => set({ milestones: ct.milestones.map((x) => (x.id === m.id ? { ...x, dueDate: e.target.value } : x)) })} /> : fmtDate(m.dueDate)}</td>
                  <td className="table-td text-right tabular-nums">{editable ? <input type="number" className="input text-right" value={m.amount} onChange={(e) => set({ milestones: ct.milestones.map((x) => (x.id === m.id ? { ...x, amount: Number(e.target.value) } : x)) })} /> : fmtMoney(m.amount, ct.currency)}</td>
                  <td className="table-td">{ct.status === 'active' && isProc ? <select className="input" value={m.status} onChange={(e) => set({ milestones: ct.milestones.map((x) => (x.id === m.id ? { ...x, status: e.target.value as typeof m.status } : x)) })}><option value="pending">Pending</option><option value="completed">Completed</option><option value="invoiced">Invoiced</option><option value="paid">Paid</option></select> : <StatusPill status={m.status} />}</td>
                  {editable && <td className="table-td"><button className="btn-ghost btn-sm text-accent-700" onClick={() => set({ milestones: ct.milestones.filter((x) => x.id !== m.id) })}><Trash2 size={13} /></button></td>}
                </tr>))}</tbody>
              <tfoot><tr><td colSpan={2} className="px-4 py-2 text-right text-[12px] uppercase text-ink-500">Scheduled total</td><td className={cx('px-4 py-2 text-right font-semibold tabular-nums', Math.abs(ct.milestones.reduce((s, m) => s + m.amount, 0) - ct.value) > 0.01 && 'text-accent-700')}>{fmtMoney(ct.milestones.reduce((s, m) => s + m.amount, 0), ct.currency)}</td><td colSpan={2} /></tr></tfoot>
            </table>
            {editable && <div className="p-3"><button className="btn-secondary btn-sm" onClick={() => set({ milestones: [...ct.milestones, { id: uid('m_'), title: '', dueDate: ct.endDate, amount: 0, status: 'pending' }] })}><Plus size={13} /> Add milestone</button></div>}
          </Card>

          <Card title="Signatures">
            <div className="grid gap-4 sm:grid-cols-2">
              {ct.signatories.map((s) => (
                <div key={s.party} className={cx('rounded-card border p-4', s.signedAt ? 'border-brand-200 bg-brand-50' : 'border-dashed border-ink-300')}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">For {s.party === 'RHS' ? settings.orgName : ct.vendorName}</div>
                  <div className="mt-1 text-[14px] font-semibold text-ink-900">{s.name}</div>
                  <div className="text-[12.5px] text-ink-600">{s.title}</div>
                  <div className="mt-3 text-[12.5px]">{s.signedAt ? <span className="text-brand-700 font-medium">✓ Signed {fmtDateTime(s.signedAt)}</span> : <span className="text-ink-400">Awaiting signature</span>}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Attachments" description="Signed copies, annexes, vendor registration documents"><AttachmentList items={ct.attachments} readOnly={!isProc && !isLegal} onAdd={(a) => set({ attachments: [...ct.attachments, a] })} onRemove={(aid) => set({ attachments: ct.attachments.filter((a) => a.id !== aid) })} /></Card>
          <Card title="Discussion"><CommentThread comments={ct.comments} onAdd={(t) => addContractComment(ct.id, t)} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Contract value"><div className="text-[26px] font-semibold text-ink-900">{fmtMoney(ct.value, ct.currency)}</div><div className="text-[12.5px] text-ink-500">{fmtDate(ct.startDate)} → {fmtDate(ct.endDate)}</div></Card>
          <Card title="Workflow">
            <ol className="space-y-2 text-[13px]">
              {[['drafting', 'Drafting by Procurement'], ['legal_review', 'Legal review'], ['pending_signature', 'Signatures'], ['active', 'Active']].map(([s, l], i) => {
                const order = ['drafting', 'legal_review', 'pending_signature', 'active']
                const cur = order.indexOf(ct.status), me = order.indexOf(s!)
                return <li key={s} className="flex items-center gap-3"><span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', me < cur ? 'bg-brand-600 text-white' : me === cur ? 'bg-sun-100 text-sun-700 ring-2 ring-sun-500' : 'bg-ink-100 text-ink-400')}>{me < cur ? '✓' : i + 1}</span><span className={me <= cur ? 'text-ink-900' : 'text-ink-400'}>{l}</span></li>
              })}
            </ol>
          </Card>
          <Card title="Document control">
            <KV k="Document owner" v={ct.ownerName} /><KV k="Drafted by" v={ct.draftedByName} /><KV k="Legal reviewer" v={users.find((u) => u.id === ct.legalReviewer)?.name ?? '—'} />
            <KV k="Purchase order" v={<Link className="text-brand-700 hover:underline" to={`/orders/${ct.poId}`}>{ct.poNumber}</Link>} /><KV k="Created" v={fmtDateTime(ct.createdAt)} /><KV k="Updated" v={fmtDateTime(ct.updatedAt)} />
          </Card>
        </div>
      </div>

      <Modal open={legalOpen !== null} onClose={() => setLegalOpen(null)} title={legalOpen ? 'Clear contract for signature' : 'Return contract to Procurement'}
        footer={<><button className="btn-secondary" onClick={() => setLegalOpen(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!legalOpen && !notes.trim()) return alert('Comments are required when returning.'); legalDecision(ct.id, !!legalOpen, notes); setLegalOpen(null) }}>{legalOpen ? 'Clear' : 'Return'}</button></>}>
        <Field label={legalOpen ? 'Legal notes (optional)' : 'Required changes'} required={!legalOpen}><textarea className="input min-h-[110px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Modal>
    </>
  )
}

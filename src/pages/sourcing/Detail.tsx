import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trophy, Trash2, Pencil, ShoppingCart, UserCheck, AlertTriangle, CheckCircle2, ShieldAlert, Users, FileCheck2, Gavel } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, Field, Modal, Alert, KV, EmptyState } from '@/components/ui'
import { AttachmentList, ProcessTracker, CommentThread } from '@/components/workflow'
import { MethodBadge, TierCard } from '@/components/tier'
import { fmtMoney, fmtDate, fmtDateTime, linesSubtotal, toInputDate, addDays, cx } from '@/lib/format'
import { EXCEPTION_LABEL, METHOD_DESC, METHOD_SOP, isBidMethod, sourcingRequirements, workingDaysBetween, blockingFailures } from '@/lib/tiers'
import type { Quotation, Attachment, ExceptionType, CommitteeMember } from '@/types'

const blankQuote = (prLines: { id: string; unitPrice: number }[], ccy: Quotation['currency'], tax: number): Omit<Quotation, 'id'> => ({
  vendorId: '', vendorName: '', reference: '', receivedAt: new Date().toISOString(), validUntil: toInputDate(addDays(new Date(), 30)),
  currency: ccy, subtotal: 0, taxRate: tax, deliveryDays: 14, paymentTerms: '30 days net', warranty: '12 months', notes: '', attachments: [],
  lines: prLines.map((l) => ({ lineItemId: l.id, unitPrice: l.unitPrice })), compliant: true,
})

export default function SourcingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { prs, vendors, users, settings, takeSourcing, addQuotation, updateQuotation, removeQuotation, awardQuotation, createPOFromAward, addPRComment,
    updateSourcing, requestException, clearException, decideException, approveFewerQuotes, signEvaluationReport, markDonorNotified } = useStore()
  const pr = prs.find((p) => p.id === id)
  const [editing, setEditing] = useState<null | { qid?: string; q: Omit<Quotation, 'id'> }>(null)
  const [awardOpen, setAwardOpen] = useState<null | string>(null)
  const [just, setJust] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [exOpen, setExOpen] = useState(false)
  const [exType, setExType] = useState<ExceptionType>('sole_source')
  const [exJust, setExJust] = useState('')
  const [exComment, setExComment] = useState('')
  const [newMember, setNewMember] = useState<{ userId: string; role: CommitteeMember['role'] }>({ userId: '', role: 'member' })

  if (!pr) return <Alert tone="danger">Requisition not found.</Alert>
  const isProc = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const isED = ['executive_director', 'admin'].includes(user.role)
  const isSupervisor = ['procurement_manager', 'finance_director', 'programs_director', 'executive_director', 'admin'].includes(user.role)
  const src = pr.sourcing
  const { tier, amountUSD, reqs } = sourcingRequirements(pr, settings, users)
  const method = tier?.method ?? 'rfq'
  const bid = isBidMethod(method)
  const exception = src.exception
  const competitive = !exception
  const live = pr.quotations.filter((q) => !q.late)
  const enough = blockingFailures(reqs).length === 0
  const canEdit = isProc && ['approved', 'sourcing'].includes(pr.status)
  const awarded = pr.quotations.find((q) => q.id === pr.awardedQuotationId)
  const passMark = src.technicalPassMark
  const disqualified = (q: Quotation) => bid && competitive && typeof q.technicalScore === 'number' && q.technicalScore < passMark
  const wd = src.issuedAt && src.deadline ? workingDaysBetween(src.issuedAt, src.deadline) : 0

  // scoring: 60% price, 25% delivery, 15% compliance — bids: technical score replaces the compliance component
  const ranked = useMemo(() => {
    const qs = live.filter((q) => q.subtotal > 0 && !disqualified(q))
    const minP = Math.min(...qs.map((q) => q.subtotal)), minD = Math.min(...qs.map((q) => q.deliveryDays))
    return pr.quotations.map((q) => {
      if (q.subtotal <= 0 || q.late || disqualified(q)) return { ...q, score: 0 }
      const p = (minP / q.subtotal) * 60, d = (minD / Math.max(q.deliveryDays, 1)) * 25
      const c = bid ? ((q.technicalScore ?? 0) / 100) * 15 : (q.compliant ? 15 : 0)
      return { ...q, score: Math.round(p + d + c) }
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }, [pr.quotations, bid, passMark, competitive]) // eslint-disable-line react-hooks/exhaustive-deps
  const best = ranked.find((q) => (q.score ?? 0) > 0)

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
  const toggleInvited = (vid: string) => updateSourcing(pr.id, { invitedVendorIds: src.invitedVendorIds.includes(vid) ? src.invitedVendorIds.filter((x) => x !== vid) : [...src.invitedVendorIds, vid] })
  const addMember = () => {
    const u = users.find((x) => x.id === newMember.userId); if (!u) return
    if (src.committee.some((m) => m.userId === u.id)) return
    updateSourcing(pr.id, { committee: [...src.committee, { userId: u.id, name: u.name, role: newMember.role, ndaSigned: false, coiDeclared: false }] })
    setNewMember({ userId: '', role: 'member' })
  }
  const setMember = (uid: string, patch: Partial<CommitteeMember>) => updateSourcing(pr.id, { committee: src.committee.map((m) => (m.userId === uid ? { ...m, ...patch } : m)) })
  const quoteLabel = method === 'direct' ? 'supplier price' : bid ? 'bid' : 'quotation'

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{pr.number} · Sourcing</span>} title={pr.title}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={pr.status} /><span>{pr.department} · needed by {fmtDate(pr.neededBy)}</span><span>· Owner {pr.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <Link to={`/requisitions/${pr.id}`} className="btn-secondary">View requisition</Link>
          {isProc && pr.status === 'approved' && <button className="btn-primary" onClick={() => takeSourcing(pr.id)}><UserCheck size={15} /> Start sourcing (assign to me)</button>}
          {canEdit && <button className="btn-primary" onClick={openNew}><Plus size={15} /> Record {quoteLabel}</button>}
          {isProc && pr.status === 'awarded' && !pr.poId && <button className="btn-primary" onClick={raisePO}><ShoppingCart size={15} /> Raise purchase order</button>}
          {pr.poId && <Link to={`/orders/${pr.poId}`} className="btn-secondary"><ShoppingCart size={15} /> Open PO</Link>}
        </>} />

      <div className="card mb-6 px-5 py-4"><ProcessTracker current={pr.status === 'awarded' ? 'po' : pr.status === 'ordered' ? 'po_approval' : 'sourcing'} /></div>

      {/* Method banner */}
      {tier && (
        <div className={cx('mb-6 rounded-card border px-4 py-3 text-[13.5px]', exception ? 'border-accent-200 bg-accent-50 text-accent-700' : enough ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-sun-300 bg-sun-50 text-sun-700')}>
          <div className="flex flex-wrap items-center gap-3">
            {exception ? <ShieldAlert size={18} /> : enough ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2"><b>{tier.name}</b><span className="text-ink-400">·</span>{exception ? <span className="font-semibold">Exception route — {EXCEPTION_LABEL[exception.type]}</span> : <MethodBadge method={method} />}<span className="text-[12px] opacity-80">≈ USD {Math.round(amountUSD).toLocaleString()} · {exception ? 'SOP-PRO-09' : METHOD_SOP[method]}</span></div>
              <div className="mt-0.5 text-[12.5px] opacity-90">{exception ? 'Competitive requirements are waived only with a written justification and the required pre-approval. Negotiate best terms and document them.' : METHOD_DESC[method]}</div>
            </div>
            {!exception && tier.minQuotations > 0 && <div className="flex items-center gap-2 text-[12.5px]"><div className="flex gap-1">{Array.from({ length: tier.minQuotations }).map((_, i) => <span key={i} className={cx('h-2.5 w-7 rounded-sm', i < live.length ? 'bg-brand-600' : 'bg-ink-200')} />)}</div><b>{live.length}/{tier.minQuotations}</b></div>}
          </div>
        </div>
      )}

      {awarded && <div className="mb-6"><Alert tone="success"><Trophy size={14} className="inline mr-1" /> <b>Awarded to {awarded.vendorName}</b> ({awarded.reference}) — {fmtMoney(awarded.subtotal, awarded.currency)}. {pr.awardJustification}</Alert></div>}
      {exception && exception.decision === undefined && <div className="mb-6"><Alert tone="warning"><b>Awaiting Executive Director pre-approval</b> of the {EXCEPTION_LABEL[exception.type].toLowerCase()} justification (value above USD {settings.soleSourceEdThresholdUSD.toLocaleString()}). No order may be placed before approval.</Alert></div>}
      {exception?.decision === 'rejected' && <div className="mb-6"><Alert tone="danger"><b>Exception rejected by {exception.approvedByName}.</b> {exception.comment} — withdraw the exception and run the competitive process.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">

          {/* ---- Method panel ------------------------------------------------ */}
          {competitive && method === 'direct' && (
            <Card title="Direct purchase" description="Petty cash / direct purchase — no formal quotation required">
              <p className="text-[13px] text-ink-700">Record the supplier and the agreed price as a single entry, attach the receipt or pro-forma, then award. The Department Head approves the purchase order.</p>
            </Card>
          )}

          {competitive && (method === 'rfq' || method === 'rfq_formal') && (
            <Card title="Request for Quotation" description="SOP-PRO-03 — same RFQ, to all suppliers, at the same time">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="RFQ issued on"><input type="date" className="input" disabled={!canEdit} value={src.issuedAt ?? ''} onChange={(e) => updateSourcing(pr.id, { issuedAt: e.target.value })} /></Field>
                <Field label="Quotation deadline"><input type="date" className="input" disabled={!canEdit} value={src.deadline ?? ''} onChange={(e) => updateSourcing(pr.id, { deadline: e.target.value })} /></Field>
                <Field label="Opening witness" hint="Second staff member present at opening"><select className="input" disabled={!canEdit} value={src.openingWitnessId ?? ''} onChange={(e) => updateSourcing(pr.id, { openingWitnessId: e.target.value || undefined, openedAt: e.target.value ? (src.openedAt ?? new Date().toISOString()) : undefined })}><option value="">Select…</option>{users.filter((u) => u.active && u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}</select></Field>
              </div>
              <div className="mt-4"><div className="label">Suppliers invited ({src.invitedVendorIds.length} of min. {tier?.invitedSuppliersMin})</div>
                <div className="grid gap-1.5 sm:grid-cols-2">{vendors.filter((v) => v.status !== 'blocked').map((v) => <label key={v.id} className={cx('flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-[13px]', src.invitedVendorIds.includes(v.id) ? 'border-brand-300 bg-brand-50' : 'border-line')}><input type="checkbox" disabled={!canEdit} checked={src.invitedVendorIds.includes(v.id)} onChange={() => toggleInvited(v.id)} /><span className="flex-1 truncate">{v.name}</span><span className="text-[11px] text-ink-400">{v.category}</span>{v.status === 'pending' && <span className="text-[11px] text-sun-700">not yet vetted</span>}</label>)}</div>
              </div>
              {live.length < (tier?.minQuotations ?? 3) && src.deadline && new Date(src.deadline) < new Date() && (
                <div className="mt-4 rounded-card border border-sun-300 bg-sun-50 p-3">
                  <div className="mb-2 text-[13px] font-semibold text-sun-700">Fewer than {tier?.minQuotations} quotations received by the deadline</div>
                  <Field label="Reason (non-response, market limitation…)"><textarea className="input min-h-[60px]" disabled={!canEdit || !!src.fewerQuotesApprovedBy} value={src.fewerQuotesReason ?? ''} onChange={(e) => updateSourcing(pr.id, { fewerQuotesReason: e.target.value })} /></Field>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px]">{src.fewerQuotesApprovedBy ? <span className="text-brand-700">✓ Approved by {src.fewerQuotesApprovedByName} on {fmtDate(src.fewerQuotesApprovedAt)}</span> : <span className="text-ink-600">Do not solicit additional quotations after the deadline. Supervisor approval is required to proceed.</span>}{isSupervisor && !src.fewerQuotesApprovedBy && <button className="btn-secondary btn-sm" onClick={() => { const r = approveFewerQuotes(pr.id); if (!r.ok) alert(r.error) }}>Approve proceeding</button>}</div>
                </div>
              )}
            </Card>
          )}

          {competitive && bid && (
            <>
              <Card title={method === 'open_bid' ? 'Open tender (ICB)' : 'Closed bid — RFP / ITB'} description="SOP-PRO-04 — sealed bids, formal opening, technical then financial evaluation">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Tender issued / advertised on"><input type="date" className="input" disabled={!canEdit} value={src.issuedAt ?? ''} onChange={(e) => updateSourcing(pr.id, { issuedAt: e.target.value })} /></Field>
                  <Field label="Submission deadline" hint={src.issuedAt && src.deadline ? `${wd} working days (min. ${tier?.deadlineWorkingDays})` : `Min. ${tier?.deadlineWorkingDays} working days`}><input type="date" className="input" disabled={!canEdit} value={src.deadline ?? ''} onChange={(e) => updateSourcing(pr.id, { deadline: e.target.value })} /></Field>
                  <Field label="Technical pass mark (of 100)"><input type="number" min={0} max={100} className="input" disabled={!canEdit} value={passMark} onChange={(e) => updateSourcing(pr.id, { technicalPassMark: Number(e.target.value) })} /></Field>
                  {method === 'open_bid' && <Field label="Public advertisement reference" className="sm:col-span-3" hint="Newspaper, RHS website, donor platform — and ITB reference"><input className="input" disabled={!canEdit} value={src.advertisementRef ?? ''} onChange={(e) => updateSourcing(pr.id, { advertisementRef: e.target.value })} /></Field>}
                  {tier?.donorApproval && <Field label="Donor approval / no-objection reference" className="sm:col-span-3"><input className="input" disabled={!canEdit} value={src.donorApprovalRef ?? ''} onChange={(e) => updateSourcing(pr.id, { donorApprovalRef: e.target.value })} placeholder="Required before the purchase order is raised" /></Field>}
                </div>
                {method === 'closed_bid' && (
                  <div className="mt-4"><div className="label">Qualified suppliers invited ({src.invitedVendorIds.length} of min. {tier?.invitedSuppliersMin})</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">{vendors.filter((v) => v.status !== 'blocked').map((v) => <label key={v.id} className={cx('flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-[13px]', src.invitedVendorIds.includes(v.id) ? 'border-brand-300 bg-brand-50' : 'border-line')}><input type="checkbox" disabled={!canEdit} checked={src.invitedVendorIds.includes(v.id)} onChange={() => toggleInvited(v.id)} /><span className="flex-1 truncate">{v.name}</span><span className="text-[11px] text-ink-400">{v.country}</span></label>)}</div>
                  </div>
                )}
              </Card>

              <Card title={<span className="flex items-center gap-2"><Users size={16} /> Evaluation committee</span>} description={`Minimum ${tier?.committeeMin} members incl. one technical member; NDA and conflict-of-interest declaration before any bid is opened`} padded={false}>
                <table className="w-full text-[13px]">
                  <thead><tr><th className="table-th">Member</th><th className="table-th">Role</th><th className="table-th">NDA signed</th><th className="table-th">COI declared</th>{canEdit && <th className="table-th w-12" />}</tr></thead>
                  <tbody>
                    {src.committee.length === 0 && <tr><td colSpan={5} className="px-5 py-5 text-center text-[13px] text-ink-500">No committee members yet — the Director of Programs establishes the committee.</td></tr>}
                    {src.committee.map((m) => (
                      <tr key={m.userId}><td className="table-td font-medium text-ink-900">{m.name}<div className="text-[11.5px] font-normal text-ink-500">{users.find((u) => u.id === m.userId)?.title}</div></td>
                        <td className="table-td"><select className="input" disabled={!canEdit} value={m.role} onChange={(e) => setMember(m.userId, { role: e.target.value as CommitteeMember['role'] })}><option value="chair">Chair</option><option value="technical">Technical member</option><option value="member">Member</option></select></td>
                        <td className="table-td"><label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={m.ndaSigned} onChange={(e) => setMember(m.userId, { ndaSigned: e.target.checked })} />{m.ndaSigned ? 'Yes' : 'No'}</label></td>
                        <td className="table-td"><label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={m.coiDeclared} onChange={(e) => setMember(m.userId, { coiDeclared: e.target.checked })} />{m.coiDeclared ? 'Yes' : 'No'}</label></td>
                        {canEdit && <td className="table-td"><button className="btn-ghost btn-sm text-accent-700" onClick={() => updateSourcing(pr.id, { committee: src.committee.filter((x) => x.userId !== m.userId) })}><Trash2 size={13} /></button></td>}
                      </tr>))}
                  </tbody>
                </table>
                {canEdit && <div className="flex flex-wrap items-end gap-2 border-t border-line p-4">
                  <Field label="Add member" className="flex-1 min-w-[220px]"><select className="input" value={newMember.userId} onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}><option value="">Select staff…</option>{users.filter((u) => u.active && !src.committee.some((m) => m.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}</select></Field>
                  <Field label="Role"><select className="input" value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value as CommitteeMember['role'] })}><option value="chair">Chair</option><option value="technical">Technical</option><option value="member">Member</option></select></Field>
                  <button className="btn-secondary" onClick={addMember} disabled={!newMember.userId}><Plus size={14} /> Add</button>
                </div>}
              </Card>
            </>
          )}

          {/* ---- Comparison / evaluation table ------------------------------- */}
          <Card title={bid && competitive ? 'Bid evaluation' : 'Quotation comparison'} description={bid && competitive ? `Technical scores first; financial comparison only for bids scoring ≥ ${passMark}. Score = 60% price · 25% delivery · 15% technical.` : 'Score = 60% price · 25% delivery · 15% compliance. Lowest compliant price highlighted.'} padded={false}>
            {pr.quotations.length === 0 ? <div className="p-5"><EmptyState title={`No ${quoteLabel}s yet`} body={method === 'direct' ? 'Record the supplier price to proceed.' : `Record each ${quoteLabel} as it is opened to build the comparison.`} action={canEdit && <button className="btn-primary btn-sm" onClick={openNew}><Plus size={14} /> Record {quoteLabel}</button>} /></div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead><tr>
                    <th className="table-th">Criteria</th>
                    {ranked.map((q) => <th key={q.id} className={cx('table-th', q.id === pr.awardedQuotationId && 'bg-brand-50 text-brand-800', (q.late || disqualified(q)) && 'opacity-60')}>{q.vendorName}<div className="font-normal normal-case tracking-normal text-ink-500">{q.reference}{q.late && <span className="ml-1 text-accent-700">· LATE</span>}</div></th>)}
                  </tr></thead>
                  <tbody>
                    {bid && competitive && <tr className="bg-surface-muted"><td className="table-td font-semibold">Technical score (pass ≥ {passMark})</td>{ranked.map((q) => <td key={q.id} className="table-td">{typeof q.technicalScore === 'number' ? <span className={cx('font-semibold', q.technicalScore >= passMark ? 'text-brand-700' : 'text-accent-700')}>{q.technicalScore}{q.technicalScore < passMark && ' · disqualified'}</span> : <span className="text-sun-700">not scored</span>}</td>)}</tr>}
                    {pr.lines.map((l) => (
                      <tr key={l.id}><td className="table-td text-ink-600">{l.description} <span className="text-ink-400">× {l.quantity}</span></td>
                        {ranked.map((q) => { const up = q.lines.find((x) => x.lineItemId === l.id)?.unitPrice ?? 0; return <td key={q.id} className="table-td tabular-nums">{disqualified(q) || q.late ? <span className="text-ink-400">— not opened</span> : <>{fmtMoney(up, q.currency)} <span className="text-ink-400">/ {l.unit}</span></>}</td> })}</tr>
                    ))}
                    <tr className="bg-surface-muted"><td className="table-td font-semibold">Subtotal (excl. tax)</td>{ranked.map((q) => <td key={q.id} className={cx('table-td font-semibold tabular-nums', (q.score ?? 0) > 0 && q.subtotal === Math.min(...ranked.filter((x) => (x.score ?? 0) > 0 && x.compliant).map((x) => x.subtotal)) && 'text-brand-700')}>{disqualified(q) || q.late ? '—' : fmtMoney(q.subtotal, q.currency)}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Total incl. tax</td>{ranked.map((q) => <td key={q.id} className="table-td tabular-nums">{disqualified(q) || q.late ? '—' : fmtMoney(q.subtotal * (1 + q.taxRate / 100), q.currency)}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Delivery lead time</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.deliveryDays} days</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Payment terms</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.paymentTerms}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Warranty</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.warranty}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Valid until</td>{ranked.map((q) => <td key={q.id} className={cx('table-td', new Date(q.validUntil) < new Date() && 'text-accent-700')}>{fmtDate(q.validUntil)}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Technically compliant</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.compliant ? <span className="text-brand-700 font-medium">Yes</span> : <span className="text-accent-700 font-medium">No</span>}</td>)}</tr>
                    <tr><td className="table-td text-ink-600">Documents</td>{ranked.map((q) => <td key={q.id} className="table-td">{q.attachments.length} file(s)</td>)}</tr>
                    <tr className="bg-surface-muted"><td className="table-td font-semibold">Evaluation score</td>{ranked.map((q) => <td key={q.id} className="table-td"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-pill bg-ink-200"><div className="h-full rounded-pill bg-brand-600" style={{ width: `${q.score ?? 0}%` }} /></div><b>{q.score}</b>{q.id === best?.id && <span className="rounded-pill bg-sun-100 px-1.5 text-[10.5px] font-bold text-sun-700">BEST</span>}</div></td>)}</tr>
                    {canEdit && <tr><td className="table-td" />{ranked.map((q) => <td key={q.id} className="table-td"><div className="flex gap-1">
                      <button className="btn-secondary btn-sm" onClick={() => openEdit(q)}><Pencil size={13} /></button>
                      <button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Remove?') && removeQuotation(pr.id, q.id)}><Trash2 size={13} /></button>
                      <button className="btn-primary btn-sm" disabled={!enough || q.late || disqualified(q)} title={!enough ? 'SOP checklist incomplete' : undefined} onClick={() => { setAwardOpen(q.id); setErr(null) }}><Trophy size={13} /> Award</button>
                    </div></td>)}</tr>}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {bid && competitive && (
            <Card title={<span className="flex items-center gap-2"><FileCheck2 size={16} /> Evaluation report</span>} description="Full evaluation process, scores, rationale and recommendation — signed by the committee before approval">
              <textarea className="input min-h-[120px]" disabled={!canEdit && !src.committee.some((m) => m.userId === user.id)} value={src.evaluationReport ?? ''} onChange={(e) => updateSourcing(pr.id, { evaluationReport: e.target.value, evaluationSignedAt: undefined })} placeholder="Bids received, opening record, technical scores and rationale, financial comparison of compliant bids, recommendation…" />
              <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px]">{src.evaluationSignedAt ? <span className="text-brand-700">✓ Signed {fmtDateTime(src.evaluationSignedAt)}</span> : <span className="text-ink-500">Not yet signed.</span>}{!src.evaluationSignedAt && <button className="btn-secondary btn-sm" onClick={() => { const r = signEvaluationReport(pr.id); if (!r.ok) alert(r.error) }}><Gavel size={13} /> Sign as committee member</button>}</div>
            </Card>
          )}

          {pr.quotations.map((q) => (
            <Card key={q.id} title={<span className="flex items-center gap-2">{q.vendorName} {q.id === pr.awardedQuotationId && <StatusPill status="awarded" />}</span>} description={`Ref ${q.reference} · received ${fmtDate(q.receivedAt)}`}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>{q.notes && <p className="mb-3 text-[13px] text-ink-700">{q.notes}</p>}<KV k="Vendor contact" v={vendors.find((v) => v.id === q.vendorId)?.contactName} /><KV k="Vendor rating" v={'★'.repeat(vendors.find((v) => v.id === q.vendorId)?.rating ?? 0)} /></div>
                <div><div className="label">{bid ? 'Bid documents' : 'Quotation documents'}</div><AttachmentList items={q.attachments} readOnly={!canEdit} onAdd={(a: Attachment) => updateQuotation(pr.id, q.id, { attachments: [...q.attachments, a] })} onRemove={(aid) => updateQuotation(pr.id, q.id, { attachments: q.attachments.filter((a) => a.id !== aid) })} /></div>
              </div>
            </Card>
          ))}

          {/* ---- Exception (SOP-PRO-09) -------------------------------------- */}
          <Card title={<span className="flex items-center gap-2"><ShieldAlert size={16} /> Emergency & sole-source exception</span>} description="SOP-PRO-09 — permitted only for genuine emergency, sole source / monopoly, proprietary requirement, or donor-specified supplier">
            {!exception ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-700"><span>Competitive process applies. Each exception must be individually justified, approved and documented — repeated use is flagged at audit.</span>{canEdit && method !== 'direct' && <button className="btn-secondary btn-sm" onClick={() => { setExJust(''); setErr(null); setExOpen(true) }}>Request exception</button>}</div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-x-8 sm:grid-cols-2"><KV k="Type" v={EXCEPTION_LABEL[exception.type]} /><KV k="Requested by" v={`${exception.requestedByName} · ${fmtDate(exception.requestedAt)}`} /><KV k="Status" v={exception.decision === 'approved' ? <span className="font-medium text-brand-700">Approved{exception.approvedByName ? ` by ${exception.approvedByName}` : ' (below ED threshold)'}</span> : exception.decision === 'rejected' ? <span className="font-medium text-accent-700">Rejected</span> : <span className="font-medium text-sun-700">Awaiting Executive Director</span>} />{pr.donorCode && <KV k="Donor notified" v={src.donorNotifiedAt ? fmtDate(src.donorNotifiedAt) : 'Not yet'} />}</div>
                <div className="rounded-control bg-surface-sunken p-3 text-[13px] text-ink-800 whitespace-pre-wrap"><b>Justification memo:</b> {exception.justification}</div>
                {isED && exception.decision === undefined && (
                  <div className="rounded-card border border-sun-300 bg-sun-50 p-3">
                    <Field label="Executive Director decision comment"><input className="input" value={exComment} onChange={(e) => setExComment(e.target.value)} placeholder="Optional for approval, required for rejection" /></Field>
                    <div className="mt-2 flex gap-2"><button className="btn-primary btn-sm" onClick={() => { const r = decideException(pr.id, 'approved', exComment); if (!r.ok) alert(r.error) }}>Approve exception</button><button className="btn-danger-soft btn-sm" onClick={() => { const r = decideException(pr.id, 'rejected', exComment); if (!r.ok) alert(r.error) }}>Reject</button></div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">{pr.donorCode && !src.donorNotifiedAt && canEdit && <button className="btn-secondary btn-sm" onClick={() => markDonorNotified(pr.id)}>Mark donor notified</button>}{canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Withdraw the exception and resume competitive sourcing?') && clearException(pr.id)}>Withdraw exception</button>}</div>
              </div>
            )}
          </Card>

          <Card title="Sourcing notes"><CommentThread comments={pr.comments} onAdd={(t) => addPRComment(pr.id, t)} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Requisition summary">
            <div className="text-[22px] font-semibold text-ink-900">{fmtMoney(linesSubtotal(pr.lines), pr.currency)}</div>
            <div className="mb-3 text-[12.5px] text-ink-500">Estimated · {pr.lines.length} line(s) · {pr.procurementType}{pr.donorCode ? ` · ${pr.donorCode}` : ''}</div>
            <KV k="Requester" v={pr.requesterName} /><KV k="Department" v={pr.department} /><KV k="Sourcing officer" v={users.find((u) => u.id === pr.sourcingOwnerId)?.name ?? 'Unassigned'} /><KV k="Approved" v={fmtDate(pr.approvedAt)} />
          </Card>
          <Card title="Procurement tier" description="Based on the higher of the estimate and the best quotation"><TierCard compact amount={Math.max(linesSubtotal(pr.lines), ...live.filter((q) => q.compliant).map((q) => q.subtotal))} currency={pr.currency} procurementType={pr.procurementType} donorCode={pr.donorCode} /></Card>
          <Card title="SOP checklist" description={enough ? 'All mandatory steps complete — award can proceed' : 'Mandatory steps outstanding'}>
            <ul className="space-y-2 text-[13px]">
              {reqs.map((c) => <li key={c.label} className="flex items-start gap-2"><span className={cx('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]', c.ok ? 'bg-brand-600 text-white' : c.blocking ? 'bg-ink-200 text-ink-500' : 'bg-sun-100 text-sun-700')}>{c.ok ? '✓' : c.blocking ? '' : '!'}</span><span><span className={c.ok ? 'text-ink-800' : 'text-ink-600'}>{c.label}</span>{!c.blocking && !c.ok && <span className="ml-1 text-[11px] text-sun-700">recommended</span>}{c.hint && <div className="text-[11.5px] text-ink-500">{c.hint}</div>}</span></li>)}
              <li className="flex items-start gap-2"><span className={cx('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]', pr.awardedQuotationId ? 'bg-brand-600 text-white' : 'bg-ink-200')}>{pr.awardedQuotationId ? '✓' : ''}</span><span className={pr.awardedQuotationId ? 'text-ink-800' : 'text-ink-600'}>Vendor awarded with justification</span></li>
              <li className="flex items-start gap-2"><span className={cx('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]', pr.poId ? 'bg-brand-600 text-white' : 'bg-ink-200')}>{pr.poId ? '✓' : ''}</span><span className={pr.poId ? 'text-ink-800' : 'text-ink-600'}>Purchase order raised</span></li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Quotation / bid modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.qid ? `Edit ${quoteLabel}` : method === 'direct' ? 'Record supplier price' : bid ? 'Record bid' : 'Record vendor quotation'} width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={saveQuote}>Save</button></>}>
        {editing && (
          <div className="space-y-4">
            {err && <Alert tone="danger">{err}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor" required><select className="input" value={editing.q.vendorId} onChange={(e) => { const v = vendors.find((x) => x.id === e.target.value); setEditing({ ...editing, q: { ...editing.q, vendorId: e.target.value, vendorName: v?.name ?? '' } }) }}><option value="">Select vendor…</option>{vendors.filter((v) => v.status !== 'blocked').map((v) => <option key={v.id} value={v.id}>{v.name} ({v.code}){competitive && method !== 'direct' && method !== 'open_bid' && !src.invitedVendorIds.includes(v.id) ? ' — not invited' : ''}</option>)}</select></Field>
              <Field label={bid ? 'Bid reference' : 'Vendor quotation ref.'} required><input className="input" value={editing.q.reference} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, reference: e.target.value } })} /></Field>
              <Field label="Received on"><input type="date" className="input" value={editing.q.receivedAt.slice(0, 10)} onChange={(e) => { const late = !!src.deadline && e.target.value > src.deadline; setEditing({ ...editing, q: { ...editing.q, receivedAt: new Date(e.target.value).toISOString(), late } }) }} /></Field>
              <Field label="Valid until"><input type="date" className="input" value={editing.q.validUntil} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, validUntil: e.target.value } })} /></Field>
              <Field label="Delivery lead time (days)"><input type="number" className="input" value={editing.q.deliveryDays} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, deliveryDays: Number(e.target.value) } })} /></Field>
              <Field label="Payment terms"><input className="input" value={editing.q.paymentTerms} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, paymentTerms: e.target.value } })} /></Field>
              <Field label="Warranty"><input className="input" value={editing.q.warranty} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, warranty: e.target.value } })} /></Field>
              <Field label="Tax rate %"><input type="number" className="input" value={editing.q.taxRate} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, taxRate: Number(e.target.value) } })} /></Field>
              <Field label="Technically compliant"><select className="input" value={editing.q.compliant ? '1' : '0'} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, compliant: e.target.value === '1' } })}><option value="1">Yes — meets specification</option><option value="0">No — deviations noted</option></select></Field>
              {bid && competitive && <Field label={`Technical score (0–100, pass ≥ ${passMark})`} hint="Committee score against the stated criteria, before price"><input type="number" min={0} max={100} className="input" value={editing.q.technicalScore ?? ''} onChange={(e) => setEditing({ ...editing, q: { ...editing.q, technicalScore: e.target.value === '' ? undefined : Number(e.target.value) } })} /></Field>}
            </div>
            {editing.q.late && <Alert tone="danger">Received after the deadline ({fmtDate(src.deadline)}) — this {quoteLabel} must be rejected and cannot be awarded. It is kept on file for the record.</Alert>}
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
            <div><div className="label">{bid ? 'Bid document (sealed submission scan)' : 'Quotation document (PDF / scan)'}</div><AttachmentList items={editing.q.attachments} onAdd={(a) => setEditing({ ...editing, q: { ...editing.q, attachments: [...editing.q.attachments, a] } })} onRemove={(aid) => setEditing({ ...editing, q: { ...editing.q, attachments: editing.q.attachments.filter((a) => a.id !== aid) } })} /></div>
          </div>
        )}
      </Modal>

      {/* Award modal */}
      <Modal open={!!awardOpen} onClose={() => setAwardOpen(null)} title="Award"
        footer={<><button className="btn-secondary" onClick={() => setAwardOpen(null)}>Cancel</button><button className="btn-primary" onClick={doAward}><Trophy size={14} /> Confirm award</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        {awardOpen && (() => { const q = pr.quotations.find((x) => x.id === awardOpen)!; return (
          <div className="mb-4 rounded-control border border-brand-200 bg-brand-50 px-3 py-2 text-[13px]"><b>{q.vendorName}</b> · {q.reference} · {fmtMoney(q.subtotal, q.currency)} · {q.deliveryDays} days{q.id !== best?.id && <div className="mt-1 text-sun-700">Note: this is not the highest-scoring {quoteLabel} — the lowest price is not automatically the best option, but the selection rationale must be documented.</div>}</div>) })()}
        <Field label="Selection rationale" required hint="Recorded on the requisition, in the audit trail, and visible to the approving authority."><textarea className="input min-h-[110px]" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Best value for money considering price, quality, delivery and risk…" /></Field>
      </Modal>

      {/* Exception modal */}
      <Modal open={exOpen} onClose={() => setExOpen(false)} title="Request sole-source / emergency exception"
        footer={<><button className="btn-secondary" onClick={() => setExOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => { const r = requestException(pr.id, exType, exJust); if (!r.ok) return setErr(r.error ?? 'Failed'); setExOpen(false); setErr(null) }}>Submit justification</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        <Field label="Exception type" required><select className="input" value={exType} onChange={(e) => setExType(e.target.value as ExceptionType)}>{(Object.keys(EXCEPTION_LABEL) as ExceptionType[]).map((t) => <option key={t} value={t}>{EXCEPTION_LABEL[t]}</option>)}</select></Field>
        <div className="mt-4"><Field label="Justification memo" required hint={amountUSD > settings.soleSourceEdThresholdUSD ? `Value above USD ${settings.soleSourceEdThresholdUSD.toLocaleString()} — the Executive Director must pre-approve before any order is placed.` : 'Below the ED pre-approval threshold; the memo is still filed and audited.'}><textarea className="input min-h-[130px]" value={exJust} onChange={(e) => setExJust(e.target.value)} placeholder="Why competitive procurement is not possible: emergency circumstances, market evidence of sole source, manufacturer/agent exclusivity, or the donor instruction…" /></Field></div>
      </Modal>
    </>
  )
}

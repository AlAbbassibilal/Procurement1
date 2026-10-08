import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, PenLine, XCircle, Ban, CheckCircle2, ShieldCheck, FileText, Printer } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, KV, Alert, Field, Modal } from '@/components/ui'
import { PageView, AdoptSignatureModal } from '@/components/esign'
import { renderPages, finalizeEnvelope, recipientTurn, fmtStamp, FIELD_LABEL, typedSignaturePng, type RenderedPage } from '@/lib/esign'
import { getFile, putFile } from '@/lib/fileStore'
import { fmtDateTime, cx } from '@/lib/format'
import type { EnvelopeField } from '@/types'

export default function EnvelopeDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { envelopes, settings, markEnvelopeViewed, completeRecipient, declineEnvelope, voidEnvelope, updateEnvelope, adoptSignature, setInitials: saveInitials } = useStore()
  const env = envelopes.find((e) => e.id === id)
  const [pages, setPages] = useState<RenderedPage[] | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [adopt, setAdopt] = useState<null | { field: EnvelopeField }>(null)
  const [textField, setTextField] = useState<null | EnvelopeField>(null)
  const [textVal, setTextVal] = useState('')
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<'drawn' | 'typed' | undefined>(user.signature?.method)

  const me = env?.recipients.find((r) => r.userId === user.id)
  const myTurn = !!env && env.status === 'sent' && !!me && recipientTurn(env).some((r) => r.id === me.id)
  const myFields = useMemo(() => (env && me ? env.fields.filter((f) => f.recipientId === me.id) : []), [env, me])
  const canVoid = !!env && (env.createdBy === user.id || user.role === 'admin') && ['draft', 'sent'].includes(env.status)

  useEffect(() => { let on = true; (async () => { if (!env) return; const b = await getFile(env.fileKey); if (!b || !on) return; setBytes(b); try { setPages(await renderPages(b, 1.3)) } catch (e) { setErr(`Preview unavailable: ${(e as Error).message}`) } })(); return () => { on = false } }, [env?.fileKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (env && me && myTurn && me.status === 'sent') markEnvelopeViewed(env.id, me.id) }, [env?.id, me?.id, myTurn]) // eslint-disable-line react-hooks/exhaustive-deps
  // pre-fill name / title / date fields
  useEffect(() => { if (!me) return; const v: Record<string, string> = {}; for (const f of myFields) { if (f.value) continue; if (f.type === 'name') v[f.id] = me.name; if (f.type === 'title') v[f.id] = me.title ?? user.title; if (f.type === 'date') v[f.id] = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); if (f.type === 'signature' && user.signature) v[f.id] = user.signature.dataUrl; if (f.type === 'initials' && user.initials) v[f.id] = typedSignaturePng(user.initials, 'serif') } setValues((x) => ({ ...v, ...x })) }, [me?.id, myFields.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!env) return <Alert tone="danger">Envelope not found. <Link to="/esign" className="underline">Back</Link></Alert>
  const fieldClick = (f: EnvelopeField) => {
    if (f.type === 'signature' || f.type === 'initials') setAdopt({ field: f })
    else if (f.type === 'checkbox') setValues((v) => ({ ...v, [f.id]: v[f.id] === 'true' ? 'false' : 'true' }))
    else if (f.type === 'date') setValues((v) => ({ ...v, [f.id]: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }))
    else { setTextField(f); setTextVal(values[f.id] ?? f.value ?? '') }
  }
  const remaining = myFields.filter((f) => f.required && !(values[f.id] ?? f.value))
  const finish = async () => {
    if (!me) return
    setBusy(true); setErr(null)
    const r = completeRecipient(env.id, me.id, values, method)
    if (!r.ok) { setErr(r.error ?? 'Failed'); setBusy(false); return }
    if (r.completed && bytes) {
      try { const fresh = useStore.getState().envelopes.find((e) => e.id === env.id)!; const out = await finalizeEnvelope(bytes, fresh, settings.orgName); const key = `${env.fileKey}__completed.pdf`; await putFile(key, out); updateEnvelope(env.id, { completedFileKey: key }) }
      catch (e) { setErr(`Signed, but the completed PDF could not be generated: ${(e as Error).message}`) }
    }
    setBusy(false)
  }
  const download = async (which: 'original' | 'completed') => {
    const key = which === 'completed' ? env.completedFileKey : env.fileKey; if (!key) return
    let b = await getFile(key)
    if (!b && which === 'completed' && bytes) { b = await finalizeEnvelope(bytes, env, settings.orgName); await putFile(key, b) }
    if (!b) return setErr('File not available in this browser (files are stored locally in the demo).')
    const url = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = which === 'completed' ? `${env.number}-signed.pdf` : env.documentName.replace(/\.(png|jpe?g)$/i, '.pdf'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  const regenerate = async () => { if (!bytes) return; setBusy(true); try { const out = await finalizeEnvelope(bytes, env, settings.orgName); const key = `${env.fileKey}__completed.pdf`; await putFile(key, out); updateEnvelope(env.id, { completedFileKey: key }) } catch (e) { setErr((e as Error).message) } setBusy(false) }
  const progress = env.recipients.filter((r) => r.role !== 'cc'); const done = progress.filter((r) => ['signed', 'approved'].includes(r.status)).length

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{env.number}</span>} title={env.subject}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={env.status === 'sent' ? (myTurn ? 'action_required' : 'out_for_signature') : env.status} /><span>{env.documentName} · {env.pageCount} page(s)</span><span>· from {env.createdByName}</span>{env.linkedDoc && <span>· linked to {env.linkedDoc.number}</span>}<span>· Owner {env.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-secondary" onClick={() => download('original')}><FileText size={15} /> Original</button>
          {env.status === 'completed' && <button className="btn-primary" onClick={() => download('completed')}><Download size={15} /> Signed PDF + certificate</button>}
          {env.status === 'completed' && <button className="btn-ghost" onClick={regenerate} disabled={busy}><Printer size={15} /> Regenerate</button>}
          {myTurn && <button className="btn-danger-soft" onClick={() => { setReason(''); setDeclineOpen(true) }}><XCircle size={15} /> Decline</button>}
          {canVoid && <button className="btn-danger-soft" onClick={() => { const r = prompt('Reason for voiding this envelope:'); if (r) { const res = voidEnvelope(env.id, r); if (!res.ok) alert(res.error) } }}><Ban size={15} /> Void</button>}
        </>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      {myTurn && me && (
        <div className="mb-6 rounded-card border border-sun-300 bg-sun-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <PenLine size={18} className="text-sun-700" />
            <div className="flex-1 text-[13.5px] text-ink-800"><b>{me.role === 'approver' ? 'Your approval is required.' : 'Your signature is required.'}</b> {env.message} {myFields.length > 0 && <span className="text-ink-600">— {myFields.length - remaining.length} of {myFields.length} field(s) complete; click a highlighted field on the page.</span>}</div>
            <button className="btn-primary" disabled={remaining.length > 0 || busy} onClick={finish}><CheckCircle2 size={15} /> {me.role === 'approver' ? 'Approve' : 'Finish signing'}</button>
          </div>
          {remaining.length > 0 && <div className="mt-2 text-[12px] text-sun-700">Still required: {remaining.map((f) => `${f.label ?? FIELD_LABEL[f.type]} (p${f.page + 1})`).join(', ')}</div>}
        </div>
      )}
      {env.status === 'completed' && <div className="mb-6"><Alert tone="success"><ShieldCheck size={14} className="mr-1 inline" /><b>Completed</b> on {fmtStamp(env.completedAt!)}. The signed PDF carries every signature with its name, title, date-time stamp and envelope fingerprint, plus the certificate of completion.</Alert></div>}
      {env.status === 'declined' && <div className="mb-6"><Alert tone="danger"><b>Declined</b> — {env.recipients.find((r) => r.status === 'declined')?.name}: {env.recipients.find((r) => r.status === 'declined')?.declineReason}</Alert></div>}
      {env.status === 'voided' && <div className="mb-6"><Alert tone="warning"><b>Voided</b> by the sender — {env.events[env.events.length - 1]?.detail}</Alert></div>}
      {env.status === 'draft' && <div className="mb-6"><Alert tone="info">Draft — not yet sent. {canVoid && <Link to={`/esign/new`} className="underline">Create a new envelope</Link>} or send this one from the register.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-4">
        <div className="xl:col-span-3">
          {pages ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-ink-500">Page</span>{pages.map((p) => <button key={p.index} className={cx('rounded-control border px-2 py-0.5', pageIdx === p.index ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-600')} onClick={() => setPageIdx(p.index)}>{p.index + 1}{myFields.some((f) => f.page === p.index && f.required && !(values[f.id] ?? f.value)) && <span className="ml-1 text-accent-600">•</span>}</button>)}</div>
              <PageView page={pages[pageIdx]!} fields={env.fields} recipients={env.recipients} mode={myTurn ? 'sign' : 'view'} activeRecipientId={me?.id} onFieldClick={fieldClick} values={values} hasTurn={myTurn} />
            </>
          ) : <div className="card flex h-96 items-center justify-center text-[13px] text-ink-500">{err ? 'Preview unavailable' : 'Loading document…'}</div>}
        </div>
        <div className="space-y-6">
          <Card title="Recipients" description={`${done} of ${progress.length} completed`}>
            <div className="mb-3 h-1.5 w-full rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-brand-600" style={{ width: `${progress.length ? (done / progress.length) * 100 : 0}%` }} /></div>
            <ol className="space-y-3">{[...env.recipients].sort((a, b) => a.order - b.order).map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-[13px]">
                <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', ['signed', 'approved'].includes(r.status) ? 'bg-brand-600 text-white' : r.status === 'declined' ? 'bg-accent-600 text-white' : ['sent', 'viewed'].includes(r.status) ? 'bg-sun-500 text-ink-900' : 'bg-ink-200 text-ink-600')}>{['signed', 'approved'].includes(r.status) ? '✓' : r.order}</span>
                <span className="min-w-0 flex-1"><span className="block font-medium text-ink-900">{r.name}{r.userId === user.id && ' (you)'}</span><span className="block text-[11.5px] text-ink-500">{r.title ? `${r.title} · ` : ''}{r.role}</span><span className="block text-[11.5px] text-ink-500">{r.status === 'signed' || r.status === 'approved' ? `${r.status} ${fmtDateTime(r.signedAt)}` : r.status === 'viewed' ? `viewed ${fmtDateTime(r.viewedAt)}` : r.status === 'declined' ? `declined: ${r.declineReason}` : r.status === 'sent' ? 'notified — not yet viewed' : 'waiting for turn'}</span></span>
              </li>))}</ol>
          </Card>
          <Card title="Envelope"><KV k="Fingerprint" v={<span className="font-mono text-[11px] break-all">{env.hash.slice(0, 32)}…</span>} /><KV k="Signing order" v={env.signingOrder} /><KV k="Sent" v={fmtDateTime(env.sentAt)} /><KV k="Completed" v={fmtDateTime(env.completedAt)} /><KV k="Document owner" v={env.ownerName} /></Card>
          <Card title="Audit trail" padded={false}><ul className="divide-y divide-line">{[...env.events].reverse().map((e) => <li key={e.id} className="px-5 py-2 text-[12.5px]"><div className="font-medium text-ink-900">{e.action}{e.detail && <span className="font-normal text-ink-600"> — {e.detail}</span>}</div><div className="text-[11px] text-ink-500">{e.actorName} · {fmtStamp(e.at)}</div></li>)}</ul></Card>
        </div>
      </div>

      <AdoptSignatureModal open={!!adopt} onClose={() => setAdopt(null)} name={me?.name ?? user.name} initialsMode={adopt?.field.type === 'initials'}
        onAdopt={(dataUrl, m) => { if (!adopt) return; setValues((v) => ({ ...v, [adopt.field.id]: dataUrl })); if (adopt.field.type === 'signature') { adoptSignature(dataUrl, m); setMethod(m) } else saveInitials(me?.name.split(' ').map((p) => p[0]).join('').toUpperCase() ?? ''); setAdopt(null) }} />
      <Modal open={!!textField} onClose={() => setTextField(null)} title={textField?.label ?? 'Text'} footer={<><button className="btn-secondary" onClick={() => setTextField(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (textField) setValues((v) => ({ ...v, [textField.id]: textVal })); setTextField(null) }}>Apply</button></>}>
        <Field label={textField?.label ?? 'Value'}><input className="input" value={textVal} onChange={(e) => setTextVal(e.target.value)} autoFocus /></Field>
      </Modal>
      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline to sign" footer={<><button className="btn-secondary" onClick={() => setDeclineOpen(false)}>Cancel</button><button className="btn-danger-soft" onClick={() => { if (!me) return; const r = declineEnvelope(env.id, me.id, reason); if (!r.ok) return setErr(r.error ?? 'Failed'); setDeclineOpen(false) }}>Decline</button></>}>
        <Field label="Reason" required hint="Sent to the sender and recorded in the audit trail"><textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  )
}

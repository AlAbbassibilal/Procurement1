import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Upload, FileText, Plus, Trash2, Send, Wand2, PenLine } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { PageView } from '@/components/esign'
import { toPdfBytes, sha256Hex, renderPages, FIELD_LABEL, DEFAULT_SIZE, type RenderedPage } from '@/lib/esign'
import { putFile } from '@/lib/fileStore'
import { uid, cx } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/workflow'
import type { EnvelopeField, EnvelopeRecipient, RecipientRole } from '@/types'

const TYPES = Object.keys(FIELD_LABEL) as EnvelopeField['type'][]

export default function EnvelopeNew() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const user = useCurrentUser()!
  const { users, createEnvelope, sendEnvelope } = useStore()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; hash: string; pages: RenderedPage[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [subject, setSubject] = useState(sp.get('subject') ?? '')
  const [message, setMessage] = useState('Please review and sign this document.')
  const [order, setOrder] = useState<'sequential' | 'parallel'>('sequential')
  const [recipients, setRecipients] = useState<EnvelopeRecipient[]>([{ id: uid('rc_'), userId: user.id, name: user.name, email: user.email, title: user.title, role: 'signer', order: 1, status: 'pending' }])
  const [fields, setFields] = useState<EnvelopeField[]>([])
  const [activeRecipient, setActiveRecipient] = useState<string>(recipients[0]!.id)
  const [tool, setTool] = useState<EnvelopeField['type']>('signature')
  const [selected, setSelected] = useState<string | undefined>()
  const [err, setErr] = useState<string | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const linked = sp.get('link') ? { type: sp.get('link') as 'CONTRACT' | 'PO', id: sp.get('id') ?? '', number: sp.get('number') ?? '' } : undefined

  const onFile = async (f: File) => {
    setErr(null); setLoading(true)
    try { const bytes = await toPdfBytes(f); const [hash, pages] = await Promise.all([sha256Hex(bytes), renderPages(bytes)]); setFile({ name: f.name, bytes, hash, pages }); if (!subject) setSubject(f.name.replace(/\.(pdf|png|jpe?g)$/i, '')); setFields([]) }
    catch (e) { setErr(`Could not read the file: ${(e as Error).message}`) }
    setLoading(false)
  }
  const addRecipient = (u?: typeof users[number]) => setRecipients((rs) => [...rs, { id: uid('rc_'), userId: u?.id, name: u?.name ?? '', email: u?.email ?? '', title: u?.title, role: 'signer', order: rs.length + 1, status: 'pending' }])
  const setR = (id: string, p: Partial<EnvelopeRecipient>) => setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const removeR = (id: string) => { setRecipients((rs) => rs.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i + 1 }))); setFields((fs) => fs.filter((f) => f.recipientId !== id)) }
  const place = (x: number, y: number) => { const s = DEFAULT_SIZE[tool]; const f: EnvelopeField = { id: uid('fld_'), recipientId: activeRecipient, type: tool, page: pageIdx, x: Math.max(0, Math.min(1 - s.w, x - s.w / 2)), y: Math.max(0, Math.min(1 - s.h, y - s.h / 2)), w: s.w, h: s.h, required: tool !== 'text' && tool !== 'checkbox', label: FIELD_LABEL[tool] }; setFields((fs) => [...fs, f]); setSelected(f.id) }
  const autoPlace = () => {
    if (!file) return
    const last = file.pages.length - 1; const signers = recipients.filter((r) => r.role === 'signer')
    const fs: EnvelopeField[] = []
    signers.forEach((r, i) => { const col = i % 2, row = Math.floor(i / 2); const x = 0.08 + col * 0.46, y = 0.72 + row * 0.12
      fs.push({ id: uid('fld_'), recipientId: r.id, type: 'signature', page: last, x, y, w: 0.34, h: 0.075, required: true, label: 'Signature' }, { id: uid('fld_'), recipientId: r.id, type: 'name', page: last, x, y: y + 0.08, w: 0.2, h: 0.028, required: true, label: 'Name' }, { id: uid('fld_'), recipientId: r.id, type: 'date', page: last, x: x + 0.21, y: y + 0.08, w: 0.14, h: 0.028, required: true, label: 'Date signed' }) })
    setFields(fs); setPageIdx(last)
  }
  const sel = fields.find((f) => f.id === selected)
  const validRecipients = recipients.every((r) => r.name.trim() && r.email.trim())
  const readyToSend = useMemo(() => !!file && validRecipients && recipients.filter((r) => r.role === 'signer').every((r) => fields.some((f) => f.recipientId === r.id && f.type === 'signature')), [file, validRecipients, recipients, fields])

  const send = async (asDraft = false) => {
    if (!file) return setErr('Upload a document first.')
    if (!subject.trim()) return setErr('Subject is required.')
    if (!validRecipients) return setErr('Every recipient needs a name and an email.')
    const key = `env_${uid()}_${file.name}`; await putFile(key, file.bytes)
    const env = createEnvelope({ subject: subject.trim(), message, documentName: file.name, pageCount: file.pages.length, hash: file.hash, fileKey: key, signingOrder: order, recipients, fields, linkedDoc: linked })
    if (!asDraft) { const r = sendEnvelope(env.id); if (!r.ok) return setErr(r.error ?? 'Could not send') }
    nav(`/esign/${env.id}`)
  }

  return (
    <>
      <PageHeader eyebrow="New envelope" title={step === 1 ? 'Add document & details' : step === 2 ? 'Add recipients' : 'Place fields'} subtitle={`Prepared by ${user.name} · Owner Bilal Abbassi${linked ? ` · linked to ${linked.number}` : ''}`}
        actions={<>
          <button className="btn-ghost" onClick={() => (step === 1 ? nav(-1) : setStep((s) => (s - 1) as 1 | 2 | 3))}><ArrowLeft size={15} /> {step === 1 ? 'Back' : 'Previous'}</button>
          {step < 3 ? <button className="btn-primary" disabled={step === 1 ? !file : !validRecipients} onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>Next <ArrowRight size={15} /></button>
            : <><button className="btn-secondary" onClick={() => send(true)}>Save draft</button><button className="btn-primary" disabled={!readyToSend} onClick={() => send(false)}><Send size={15} /> Send for signature</button></>}
        </>} />
      <ol className="mb-6 flex flex-wrap gap-2 text-[12.5px]">{['Document', 'Recipients', 'Fields'].map((l, i) => <li key={l} className={cx('flex items-center gap-2 rounded-pill px-3 py-1', step === i + 1 ? 'bg-brand-600 text-white' : step > i + 1 ? 'bg-brand-50 text-brand-800' : 'bg-surface-sunken text-ink-500')}><span className="font-bold">{i + 1}</span>{l}</li>)}</ol>
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}

      {step === 1 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2"><Card title="Document" description="PDF, PNG or JPEG. Images are converted to a single-page PDF. A SHA-256 fingerprint is recorded so any later change is detectable.">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-300 px-4 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40">
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
              {loading ? <div className="text-[13.5px] text-ink-600">Reading document…</div> : file ? <><FileText size={28} className="text-brand-600" /><div className="text-[13.5px] font-medium text-ink-900">{file.name}</div><div className="text-[12px] text-ink-500">{file.pages.length} page(s) · SHA-256 {file.hash.slice(0, 16)}… · click to replace</div></> : <><Upload size={28} className="text-ink-400" /><div className="text-[13.5px] font-medium text-ink-900">Drop the document here or click to browse</div><div className="text-[12px] text-ink-500">Contracts, MoUs, letters, approvals — anything that needs a signature</div></>}
            </label>
            {file && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{file.pages.slice(0, 10).map((p) => <img key={p.index} src={p.dataUrl} alt="" className="rounded-control border border-line" />)}{file.pages.length > 10 && <div className="flex items-center justify-center text-[12px] text-ink-500">+{file.pages.length - 10} more</div>}</div>}
          </Card></div>
          <Card title="Envelope details">
            <div className="space-y-4">
              <Field label="Subject" required><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Service contract — Amman Fleet & Logistics" /></Field>
              <Field label="Message to recipients"><textarea className="input min-h-[90px]" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
              <Field label="Signing order"><select className="input" value={order} onChange={(e) => setOrder(e.target.value as typeof order)}><option value="sequential">Sequential — one after the other</option><option value="parallel">Parallel — everyone at once</option></select></Field>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2"><Card title="Recipients" description="Signers sign, approvers approve without signing, CC recipients receive the completed document." padded={false}
            actions={<div className="flex gap-2"><select className="input w-56" value="" onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (u) addRecipient(u) }}><option value="">Add platform user…</option>{users.filter((u) => u.active && !recipients.some((r) => r.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABEL[u.role]}</option>)}</select><button className="btn-secondary btn-sm" onClick={() => addRecipient()}><Plus size={13} /> External</button></div>}>
            <table className="w-full text-[13px]">
              <thead><tr><th className="table-th w-12">#</th><th className="table-th">Name</th><th className="table-th">Email</th><th className="table-th w-40">Title</th><th className="table-th w-32">Role</th><th className="table-th w-10" /></tr></thead>
              <tbody>{recipients.map((r) => (
                <tr key={r.id}><td className="table-td"><input type="number" min={1} className="input w-14" value={r.order} onChange={(e) => setR(r.id, { order: Number(e.target.value) })} disabled={order === 'parallel'} /></td>
                  <td className="table-td"><input className="input" value={r.name} onChange={(e) => setR(r.id, { name: e.target.value })} placeholder="Full name" />{r.userId && <div className="text-[11px] text-ink-500">Platform user — will be notified in-app</div>}{!r.userId && <div className="text-[11px] text-sun-700">External — email delivery needs the backend; sign in-person for now</div>}</td>
                  <td className="table-td"><input className="input" value={r.email} onChange={(e) => setR(r.id, { email: e.target.value })} placeholder="email@…" /></td>
                  <td className="table-td"><input className="input" value={r.title ?? ''} onChange={(e) => setR(r.id, { title: e.target.value })} placeholder="Title" /></td>
                  <td className="table-td"><select className="input" value={r.role} onChange={(e) => setR(r.id, { role: e.target.value as RecipientRole })}><option value="signer">Needs to sign</option><option value="approver">Needs to approve</option><option value="cc">Receives a copy</option></select></td>
                  <td className="table-td"><button className="btn-ghost btn-sm text-accent-700" onClick={() => removeR(r.id)} disabled={recipients.length === 1}><Trash2 size={13} /></button></td></tr>))}</tbody>
            </table>
          </Card></div>
          <Card title="How it will flow">
            <ol className="space-y-2 text-[13px]">{[...recipients].sort((a, b) => a.order - b.order).map((r) => <li key={r.id} className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">{r.order}</span><span className="flex-1 truncate">{r.name || <i className="text-ink-400">unnamed</i>}</span><span className="text-[11px] text-ink-500">{r.role}</span></li>)}</ol>
            <p className="mt-3 text-[12px] text-ink-500">{order === 'sequential' ? 'Each recipient is notified only when the previous one has finished.' : 'All recipients are notified at once.'} When everyone is done, the completed PDF with its certificate is issued to all parties.</p>
          </Card>
        </div>
      )}

      {step === 3 && file && (
        <div className="grid gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select className="input w-56" value={activeRecipient} onChange={(e) => setActiveRecipient(e.target.value)}>{recipients.filter((r) => r.role !== 'cc').map((r) => <option key={r.id} value={r.id}>{r.order}. {r.name || 'unnamed'}</option>)}</select>
              <div className="flex flex-wrap gap-1 rounded-control bg-surface-sunken p-1">{TYPES.map((t) => <button key={t} className={cx('rounded-control px-2.5 py-1 text-[12.5px] font-medium', tool === t ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-800')} onClick={() => setTool(t)}>{FIELD_LABEL[t]}</button>)}</div>
              <button className="btn-secondary btn-sm" onClick={autoPlace}><Wand2 size={13} /> Auto-place signature blocks</button>
              <span className="ml-auto text-[12px] text-ink-500">Click on the page to place a <b>{FIELD_LABEL[tool]}</b> field for the selected recipient</span>
            </div>
            <div className="mb-3 flex items-center gap-2 text-[12.5px]"><span className="text-ink-500">Page</span>{file.pages.map((p) => <button key={p.index} className={cx('rounded-control border px-2 py-0.5', pageIdx === p.index ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-600')} onClick={() => setPageIdx(p.index)}>{p.index + 1}{fields.some((f) => f.page === p.index) && <span className="ml-1 text-brand-600">•</span>}</button>)}</div>
            <PageView page={file.pages[pageIdx]!} fields={fields} recipients={recipients} mode="place" activeRecipientId={activeRecipient} onPlace={place} onSelect={setSelected} selectedId={selected} />
          </div>
          <div className="space-y-4">
            <Card title="Fields" description={`${fields.length} placed`}>
              {fields.length === 0 ? <p className="text-[12.5px] text-ink-500">No fields yet. Each signer needs at least one signature field. Use auto-place for a standard signature block on the last page.</p> : (
                <ul className="space-y-1 text-[12.5px]">{fields.map((f) => <li key={f.id} className={cx('flex cursor-pointer items-center gap-2 rounded-control px-2 py-1', selected === f.id ? 'bg-sun-50' : 'hover:bg-surface-muted')} onClick={() => { setSelected(f.id); setPageIdx(f.page) }}><span className="flex-1 truncate">{FIELD_LABEL[f.type]} · p{f.page + 1} · {recipients.find((r) => r.id === f.recipientId)?.name.split(' ')[0]}</span>{f.required && <span className="text-accent-700">*</span>}</li>)}</ul>
              )}
            </Card>
            {sel && <Card title="Selected field">
              <div className="space-y-3">
                <Field label="Type"><select className="input" value={sel.type} onChange={(e) => { const t = e.target.value as EnvelopeField['type']; setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, type: t, label: FIELD_LABEL[t], ...DEFAULT_SIZE[t] } : f))) }}>{TYPES.map((t) => <option key={t} value={t}>{FIELD_LABEL[t]}</option>)}</select></Field>
                <Field label="Recipient"><select className="input" value={sel.recipientId} onChange={(e) => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, recipientId: e.target.value } : f)))}>{recipients.filter((r) => r.role !== 'cc').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
                <Field label="Label"><input className="input" value={sel.label ?? ''} onChange={(e) => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, label: e.target.value } : f)))} /></Field>
                <div className="grid grid-cols-2 gap-2"><Field label="Width %"><input type="number" min={2} max={100} className="input" value={Math.round(sel.w * 100)} onChange={(e) => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, w: Number(e.target.value) / 100 } : f)))} /></Field><Field label="Height %"><input type="number" min={1} max={40} className="input" value={Math.round(sel.h * 100)} onChange={(e) => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, h: Number(e.target.value) / 100 } : f)))} /></Field></div>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={sel.required} onChange={(e) => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, required: e.target.checked } : f)))} /> Required</label>
                <div className="flex gap-2"><button className="btn-secondary btn-sm" onClick={() => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, x: Math.max(0, f.x - 0.02) } : f)))}>←</button><button className="btn-secondary btn-sm" onClick={() => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, x: Math.min(1 - f.w, f.x + 0.02) } : f)))}>→</button><button className="btn-secondary btn-sm" onClick={() => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, y: Math.max(0, f.y - 0.02) } : f)))}>↑</button><button className="btn-secondary btn-sm" onClick={() => setFields((fs) => fs.map((f) => (f.id === sel.id ? { ...f, y: Math.min(1 - f.h, f.y + 0.02) } : f)))}>↓</button><button className="btn-danger-soft btn-sm ml-auto" onClick={() => { setFields((fs) => fs.filter((f) => f.id !== sel.id)); setSelected(undefined) }}><Trash2 size={13} /></button></div>
              </div>
            </Card>}
            <Card title="Ready to send?"><ul className="space-y-1.5 text-[12.5px]">{recipients.filter((r) => r.role !== 'cc').map((r) => { const ok = r.role === 'approver' || fields.some((f) => f.recipientId === r.id && f.type === 'signature'); return <li key={r.id} className="flex items-center gap-2"><span className={cx('flex h-4 w-4 items-center justify-center rounded-full text-[10px]', ok ? 'bg-brand-600 text-white' : 'bg-ink-200')}>{ok ? '✓' : ''}</span>{r.name} — {r.role === 'approver' ? 'approves (no field needed)' : ok ? 'signature placed' : 'needs a signature field'}</li> })}</ul>{readyToSend && <div className="mt-3 flex items-center gap-1 text-[12.5px] text-brand-700"><PenLine size={13} /> All set — send for signature.</div>}</Card>
          </div>
        </div>
      )}
    </>
  )
}

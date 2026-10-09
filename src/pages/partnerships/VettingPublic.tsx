import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, ShieldCheck, CheckCircle2, Clock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Logo } from '@/components/Logo'
import { Field, Alert } from '@/components/ui'
import { DD_VETTING_QUESTIONS, DD_PLATFORMS } from '@/data/dueDiligence'
import { emptyKeyPerson } from '@/lib/partners'
import { fmtDateTime, cx } from '@/lib/format'
import { useUiTheme } from '@/lib/ui-theme'
import type { KeyPerson, PartnerDeclaration, YesNo } from '@/types'

/**
 * Partner-facing vetting form — opened from the link RHS shares; no sign-in.
 * Only this page is exposed: the partner confirms its legal identity, lists key
 * personnel, gives its online presence, last audit and self-declarations, then
 * signs and submits. RHS is notified and continues the ATC / checks internally.
 */
export default function VettingPublic() {
  useUiTheme()
  const { token = '' } = useParams()
  const { partners, settings, submitPartnerVetting } = useStore()
  const partner = partners.find((p) => p.dueDiligence.vetting.share?.token === token)
  const share = partner?.dueDiligence.vetting.share
  const v = partner?.dueDiligence.vetting
  const [f, setF] = useState(() => ({
    legalName: partner?.name ?? '', registrationNo: '', registrationCountry: partner?.country ?? '', legalForm: '',
    byName: partner?.focalName ?? '', byTitle: partner?.focalTitle ?? '', byEmail: partner?.focalEmail ?? '',
    keyPersonnel: (v?.keyPersonnel.length ? v.keyPersonnel.map((k) => ({ ...k, verification: '', atcClear: '' as const, atcIssues: '' })) : [emptyKeyPerson()]) as KeyPerson[],
    online: DD_PLATFORMS.filter((p) => p !== 'Google').map((platform) => ({ platform, url: v?.online.find((o) => o.platform === platform)?.url ?? '' })),
    auditFirm: '', auditYear: '', auditIssues: '',
    declarations: DD_VETTING_QUESTIONS.map((q) => ({ key: q.key, answer: '' as YesNo, explanation: '' })) as PartnerDeclaration[],
    notes: '', signature: '', confirm: false,
  }))
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const setKp = (id: string, p: Partial<KeyPerson>) => setF({ ...f, keyPersonnel: f.keyPersonnel.map((k) => (k.id === id ? { ...k, ...p } : k)) })
  const setDecl = (key: string, p: Partial<PartnerDeclaration>) => setF({ ...f, declarations: f.declarations.map((d) => (d.key === key ? { ...d, ...p } : d)) })

  const submit = () => {
    const people = f.keyPersonnel.filter((k) => k.name.trim())
    if (!f.legalName.trim() || !f.registrationNo.trim()) return setErr('Please give the legal name and registration number.')
    if (!people.length) return setErr('Please list at least one key person (CEO / President, programme and finance leads).')
    if (people.some((k) => !k.title.trim() || !k.dob || !k.countryOfBirth.trim())) return setErr('Each key person needs a title, date of birth and country of birth.')
    if (f.declarations.some((d) => !d.answer)) return setErr('Please answer every declaration (Yes / No).')
    if (f.declarations.some((d) => d.answer === 'yes' && !d.explanation.trim())) return setErr('Please explain each declaration answered "Yes".')
    if (!f.byName.trim() || !f.byEmail.trim() || !f.signature.trim() || !f.confirm) return setErr('Please complete the declaration block: name, e-mail, typed signature and the confirmation box.')
    const { confirm: _c, ...rest } = f
    const r = submitPartnerVetting(token, { ...rest, keyPersonnel: people })
    if (!r.ok) return setErr(r.error ?? 'Could not submit.')
    setErr(''); setDone(true)
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-surface-sunken">
      <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-[1000px] items-center justify-between px-4 py-3 lg:px-6"><Logo size="sm" /><span className="rounded-pill bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-800">Partner vetting form</span></div></header>
      <main className="mx-auto max-w-[1000px] px-4 py-6 lg:px-6">{children}</main>
      <footer className="px-6 pb-8 pt-2 text-center text-[11.5px] text-ink-400">{settings.orgName} · {settings.address} · {settings.email} · Documents owned by Bilal Abbassi</footer>
    </div>
  )

  if (!partner || !share || !v) return <Shell><div className="card p-8 text-center"><h1 className="text-[20px] font-semibold">This link is not valid</h1><p className="mt-2 text-[13.5px] text-ink-600">Ask your {settings.orgShort} focal point for a new vetting link.</p></div></Shell>
  if (share.status === 'revoked') return <Shell><div className="card p-8 text-center"><h1 className="text-[20px] font-semibold">This form has been closed</h1><p className="mt-2 text-[13.5px] text-ink-600">{settings.orgShort} closed this vetting link. Contact your focal point if you still need to submit.</p></div></Shell>
  if (share.status === 'submitted' || done) {
    const s = v.submission
    return <Shell><div className="card p-8 text-center"><CheckCircle2 size={40} className="mx-auto text-brand-600" /><h1 className="mt-3 text-[20px] font-semibold">Thank you — your vetting form was submitted</h1>
      {s && <p className="mt-2 text-[13.5px] text-ink-600">Submitted by <b>{s.byName}</b> ({s.byTitle}) on <b>{fmtDateTime(s.submittedAt)}</b> · reference <span className="font-mono">{partner.code}</span> · {s.keyPersonnel.length} key personnel listed.</p>}
      <p className="mt-2 text-[13px] text-ink-500">{settings.orgShort} will review the submission as part of its pre-contract due diligence and come back to you through your focal point.</p></div></Shell>
  }

  return (
    <Shell>
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-700">Pre-contract due diligence · vetting</div><h1 className="text-[22px] font-semibold text-ink-900">{partner.name}{partner.acronym && ` (${partner.acronym})`}</h1>
            <p className="mt-1 max-w-[720px] text-[13.5px] text-ink-600">{settings.orgName} works with partners to identify, analyse and manage material risks to delivering safe, effective and compliant programmes together. Please complete this form on behalf of your organisation. Everything you enter is used only for the vetting of this partnership.</p></div>
          <div className="rounded-control bg-surface-muted px-3 py-2 text-[12px] text-ink-600"><div className="flex items-center gap-1"><Clock size={12} /> Shared {fmtDateTime(share.sharedAt)}</div><div>by {share.sharedByName}, {settings.orgShort}</div></div>
        </div>
        {share.message && <div className="mt-3 rounded-control border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-900">{share.message}</div>}
      </div>

      <Section n={1} title="Organisation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name (as registered)" required><input className="input" value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
          <Field label="Registration number" required><input className="input" value={f.registrationNo} onChange={(e) => setF({ ...f, registrationNo: e.target.value })} /></Field>
          <Field label="Country of registration"><input className="input" value={f.registrationCountry} onChange={(e) => setF({ ...f, registrationCountry: e.target.value })} /></Field>
          <Field label="Legal form" hint="e.g. association, foundation, non-profit company"><input className="input" value={f.legalForm} onChange={(e) => setF({ ...f, legalForm: e.target.value })} /></Field>
        </div>
      </Section>

      <Section n={2} title="Key personnel" hint="CEO / President, relevant technical and programme directors, financial controllers / finance directors, and board members. Required for the anti-terrorism (ATC) screening.">
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-[13px]">
          <thead><tr><th className="table-th">Full name</th><th className="table-th">Title</th><th className="table-th w-36">Country of birth</th><th className="table-th w-36">Date of birth</th><th className="table-th w-28">Gender</th><th className="table-th w-40">ID / passport no.</th><th className="table-th w-10" /></tr></thead>
          <tbody>{f.keyPersonnel.map((k) => <tr key={k.id}>
            <td className="table-td py-1.5"><input className="input" value={k.name} onChange={(e) => setKp(k.id, { name: e.target.value })} /></td>
            <td className="table-td py-1.5"><input className="input" value={k.title} onChange={(e) => setKp(k.id, { title: e.target.value })} /></td>
            <td className="table-td py-1.5"><input className="input" value={k.countryOfBirth} onChange={(e) => setKp(k.id, { countryOfBirth: e.target.value })} /></td>
            <td className="table-td py-1.5"><input type="date" className="input" value={k.dob} onChange={(e) => setKp(k.id, { dob: e.target.value })} /></td>
            <td className="table-td py-1.5"><select className="input" value={k.gender} onChange={(e) => setKp(k.id, { gender: e.target.value })}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></td>
            <td className="table-td py-1.5"><input className="input" value={k.idNumber ?? ''} onChange={(e) => setKp(k.id, { idNumber: e.target.value })} /></td>
            <td className="table-td py-1.5"><button className="btn-ghost btn-sm text-accent-700" onClick={() => setF({ ...f, keyPersonnel: f.keyPersonnel.filter((x) => x.id !== k.id) })}><Trash2 size={13} /></button></td>
          </tr>)}</tbody>
        </table></div>
        <button className="btn-secondary btn-sm mt-2" onClick={() => setF({ ...f, keyPersonnel: [...f.keyPersonnel, emptyKeyPerson()] })}><Plus size={13} /> Add person</button>
      </Section>

      <Section n={3} title="Online presence" hint="Your organisation's official pages — leave blank where you have none.">
        <div className="grid gap-3 sm:grid-cols-2">{f.online.map((o) => <Field key={o.platform} label={o.platform}><input className="input" placeholder="https://…" value={o.url} onChange={(e) => setF({ ...f, online: f.online.map((x) => (x.platform === o.platform ? { ...x, url: e.target.value } : x)) })} /></Field>)}</div>
      </Section>

      <Section n={4} title="External audit">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Audit firm (last external audit)"><input className="input" value={f.auditFirm} onChange={(e) => setF({ ...f, auditFirm: e.target.value })} /></Field>
          <Field label="Financial year audited"><input className="input" value={f.auditYear} onChange={(e) => setF({ ...f, auditYear: e.target.value })} placeholder="2025" /></Field>
          <Field label="Material findings or qualifications"><input className="input" value={f.auditIssues} onChange={(e) => setF({ ...f, auditIssues: e.target.value })} placeholder="None / describe" /></Field>
        </div>
      </Section>

      <Section n={5} title="Self-declaration" hint='Answer each statement for your organisation and its senior staff. Where the answer is "Yes", please explain.'>
        <div className="space-y-3">{DD_VETTING_QUESTIONS.map((q, i) => { const d = f.declarations.find((x) => x.key === q.key)!; return (
          <div key={q.key} className={cx('rounded-control border p-3', d.answer === 'yes' ? 'border-sun-300 bg-sun-50' : 'border-line')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-[13px]"><span className="font-semibold text-ink-900">{i + 1}. {q.topic}</span> <span className="text-ink-700">— {q.question}</span></div>
              <div className="flex gap-1">{(['yes', 'no'] as const).map((a) => <button key={a} onClick={() => setDecl(q.key, { answer: a })} className={cx('rounded-pill px-3 py-1 text-[12px] font-semibold', d.answer === a ? (a === 'yes' ? 'bg-sun-500 text-ink-900' : 'bg-brand-600 text-white') : 'bg-surface text-ink-600 ring-1 ring-inset ring-line hover:bg-surface-muted')}>{a === 'yes' ? 'Yes' : 'No'}</button>)}</div>
            </div>
            {d.answer === 'yes' && <textarea className="input mt-2 min-h-[56px]" placeholder="Please explain" value={d.explanation} onChange={(e) => setDecl(q.key, { explanation: e.target.value })} />}
          </div>) })}</div>
        <Field label="Anything else RHS should know" className="mt-4"><textarea className="input min-h-[64px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </Section>

      <Section n={6} title="Declaration & signature">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Your name" required><input className="input" value={f.byName} onChange={(e) => setF({ ...f, byName: e.target.value })} /></Field>
          <Field label="Title"><input className="input" value={f.byTitle} onChange={(e) => setF({ ...f, byTitle: e.target.value })} /></Field>
          <Field label="E-mail" required><input className="input" type="email" value={f.byEmail} onChange={(e) => setF({ ...f, byEmail: e.target.value })} /></Field>
        </div>
        <label className="mt-4 flex items-start gap-2 text-[13px] text-ink-800"><input type="checkbox" className="mt-0.5" checked={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.checked })} /><span>I confirm that I am authorised to submit this form on behalf of {f.legalName || 'the organisation'} and that the information given is complete and accurate to the best of my knowledge. I understand {settings.orgShort} will use it for vetting, including anti-terrorism screening of the persons listed.</span></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Type your full name as signature" required><input className="input font-display text-[20px] italic" value={f.signature} onChange={(e) => setF({ ...f, signature: e.target.value })} placeholder={f.byName} /></Field>
          <div className="pb-1 text-[12px] text-ink-500">Date & time are stamped on submission.</div>
        </div>
        {err && <div className="mt-4"><Alert tone="danger">{err}</Alert></div>}
        <div className="mt-5 flex items-center justify-end gap-3"><span className="text-[12px] text-ink-500">Reference {partner.code}</span><button className="btn-primary btn-lg" onClick={submit}><ShieldCheck size={16} /> Submit to {settings.orgShort}</button></div>
      </Section>
    </Shell>
  )
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-5 p-5">
      <div className="mb-4 flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-brand-600 text-[13px] font-bold text-white">{n}</span><div><h2 className="text-[16px] font-semibold">{title}</h2>{hint && <p className="text-[12.5px] text-ink-500">{hint}</p>}</div></div>
      {children}
    </section>
  )
}

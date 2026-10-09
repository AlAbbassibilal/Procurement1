import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Upload, CheckCircle2, Send, MapPin, CalendarDays } from 'lucide-react'
import { useStore, attachmentFromFile } from '@/store/useStore'
import { Logo } from '@/components/Logo'
import { Field, Alert } from '@/components/ui'
import { extractText } from '@/lib/recruitment'
import { CONTRACT_LABEL } from '@/lib/salary'
import { fmtDate } from '@/lib/format'
import { useUiTheme } from '@/lib/ui-theme'
import type { Attachment } from '@/types'

/** Public application page — reachable by anyone with the link, no sign-in. */
export default function Apply() {
  useUiTheme()
  const { token = '' } = useParams()
  const { vacancies, settings, applyToVacancy } = useStore()
  const v = vacancies.find((x) => x.advert?.token === token)
  const [f, setF] = useState({ name: '', email: '', phone: '', country: '', yearsExperience: 0, coverLetter: '' })
  const [cv, setCv] = useState<{ att: Attachment; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null)
  if (!v || !v.advert) return <Shell><div className="card p-8 text-center"><h1 className="text-[20px] font-semibold">This vacancy is not available</h1><p className="mt-2 text-[13.5px] text-ink-600">The link may have expired. Contact {settings.email} for current opportunities.</p></div></Shell>
  const closed = v.status !== 'advertised' || (v.advert.closingDate && v.advert.closingDate < new Date().toISOString().slice(0, 10))
  const onFile = async (file: File | undefined) => { if (!file) return; setBusy(true); setErr(''); try { const att = await attachmentFromFile(file, f.name || 'applicant'); const text = await extractText(file).catch(() => ''); setCv({ att, text }) } finally { setBusy(false) } }
  const submit = () => {
    if (!f.name.trim() || !f.email.trim()) return setErr('Name and e-mail are required.')
    if (!cv) return setErr('Please attach your CV (PDF, Word or text).')
    const r = applyToVacancy(token, { ...f, cv: cv.att, cvText: cv.text })
    if (!r.ok) return setErr(r.error ?? 'Could not submit.')
    setDone(r.applicant!.number)
  }
  if (done) return <Shell><div className="card p-8 text-center"><CheckCircle2 size={40} className="mx-auto text-brand-600" /><h1 className="mt-3 text-[20px] font-semibold">Thank you — your application was received</h1><p className="mt-2 text-[13.5px] text-ink-600">Reference <span className="font-mono">{done}</span> · {v.title}. Only shortlisted candidates will be contacted.</p></div></Shell>
  return (
    <Shell>
      <div className="card mb-5 p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-700">Vacancy · {v.number}</div>
        <h1 className="text-[24px] font-semibold text-ink-900">{v.title}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-600"><span className="flex items-center gap-1"><MapPin size={13} /> {v.advert.location}</span><span>{CONTRACT_LABEL[v.contractType]}{v.duration && ` · ${v.duration}`}</span>{v.salaryRange && <span>{v.salaryRange}</span>}<span className="flex items-center gap-1"><CalendarDays size={13} /> Closing {fmtDate(v.advert.closingDate)}</span></div>
        <p className="mt-4 text-[14px] text-ink-800">{v.advert.summary}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2"><div><h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-500">Responsibilities</h2><p className="whitespace-pre-line text-[13px] text-ink-800">{v.advert.responsibilities}</p></div><div><h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-500">Requirements</h2><p className="whitespace-pre-line text-[13px] text-ink-800">{v.advert.requirements}</p></div></div>
        <p className="mt-4 rounded-control bg-surface-muted px-3 py-2 text-[12.5px] text-ink-700">{v.advert.howToApply}</p>
      </div>
      {closed ? <Alert tone="warning">Applications for this vacancy have closed.</Alert> : (
        <div className="card p-6">
          <h2 className="mb-4 text-[16px] font-semibold">Apply</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><input className="input" data-testid="ap-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="E-mail" required><input type="email" className="input" data-testid="ap-email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Country of residence"><input className="input" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
            <Field label="Years of relevant experience" required><input type="number" min={0} className="input" data-testid="ap-years" value={f.yearsExperience} onChange={(e) => setF({ ...f, yearsExperience: Number(e.target.value) })} /></Field>
            <Field label="CV (PDF, Word or text)" required><label className="btn-secondary w-full cursor-pointer justify-start"><Upload size={14} /> {busy ? 'Reading your CV…' : cv ? cv.att.name : 'Choose file'}<input type="file" className="hidden" data-testid="ap-cv" accept=".pdf,.docx,.txt" onChange={(e) => onFile(e.target.files?.[0])} /></label>{cv && <div className="mt-1 text-[11.5px] text-ink-500">{cv.text ? `${cv.text.split(/\s+/).length} words read from your CV` : 'We could not read text from this file — please also fill the cover letter.'}</div>}</Field>
            <Field label="Cover letter (optional)" className="sm:col-span-2"><textarea className="input min-h-[100px]" value={f.coverLetter} onChange={(e) => setF({ ...f, coverLetter: e.target.value })} /></Field>
          </div>
          {err && <div className="mt-4"><Alert tone="danger">{err}</Alert></div>}
          <p className="mt-4 text-[12px] text-ink-500">By submitting you agree that {settings.orgShort} stores your application for this recruitment only.</p>
          <div className="mt-4 flex justify-end"><button className="btn-primary btn-lg" data-testid="ap-submit" disabled={busy} onClick={submit}><Send size={15} /> Submit application</button></div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings)
  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-3 lg:px-6"><Logo size="sm" /><span className="rounded-pill bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-800">Careers</span></div></header>
      <main className="mx-auto max-w-[960px] px-4 py-6 lg:px-6">{children}</main>
      <footer className="px-6 pb-8 pt-2 text-center text-[11.5px] text-ink-400">{settings.orgName} · {settings.address} · {settings.email}</footer>
    </div>
  )
}

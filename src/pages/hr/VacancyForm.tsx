import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, Save, Upload, X, Wand2 } from 'lucide-react'
import { useStore, useCurrentUser, attachmentFromFile } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { extractText, parseKeywords } from '@/lib/recruitment'
import { CONTRACT_LABEL } from '@/lib/salary'
import { cx } from '@/lib/format'
import type { Vacancy, StaffMember } from '@/types'

/** Line manager's recruitment request: position, funding, keywords for CV screening, and the job description (written or uploaded). */
export default function VacancyForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { vacancies, projects, staff, settings, saveVacancy, submitVacancy } = useStore()
  const existing = id ? vacancies.find((v) => v.id === id) : undefined
  const me = staff.find((s) => s.userId === user.id)
  const [v, setV] = useState<Partial<Vacancy>>(existing ?? { title: '', department: me?.department ?? user.department, country: settings.countries[0], contractType: 'full_time', headcount: 1, salaryRange: '', startDate: '', duration: '12 months', reason: '', keywords: [], minYears: 2, jd: { purpose: '', responsibilities: '', qualifications: '' } })
  const [kw, setKw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const jd = v.jd!
  const setJd = (p: Partial<Vacancy['jd']>) => setV({ ...v, jd: { ...jd, ...p } })
  const addKw = () => { const ks = parseKeywords(kw); if (ks.length) setV({ ...v, keywords: Array.from(new Set([...(v.keywords ?? []), ...ks])) }); setKw('') }
  const suggest = () => { const text = `${jd.purpose} ${jd.responsibilities} ${jd.qualifications} ${jd.extractedText ?? ''}`.toLowerCase(); const stop = new Set(['the', 'and', 'with', 'for', 'of', 'to', 'in', 'a', 'an', 'or', 'on', 'at', 'by', 'as', 'is', 'are', 'be', 'will', 'this', 'that', 'from', 'years', 'year', 'experience', 'work', 'team', 'support', 'other', 'all', 'per', 'under', 'into']); const freq: Record<string, number> = {}; for (const w of text.match(/[a-z][a-z-]{3,}/g) ?? []) if (!stop.has(w)) freq[w] = (freq[w] ?? 0) + 1; const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w); setV({ ...v, keywords: Array.from(new Set([...(v.keywords ?? []), ...top])) }) }
  const upload = async (f: File | undefined) => { if (!f) return; setBusy(true); try { const att = await attachmentFromFile(f, user.name); const text = await extractText(f).catch(() => ''); setJd({ attachment: att, extractedText: text }); } finally { setBusy(false) } }
  const persist = () => { if (!v.title?.trim()) { setErr('Position title is required.'); return null } const saved = saveVacancy({ ...v, id: existing?.id, title: v.title.trim(), projectCode: projects.find((p) => p.id === v.projectId)?.code }); return saved }
  const save = () => { const s = persist(); if (s) nav(`/hr/recruitment/${s.id}`) }
  const submit = () => { const s = persist(); if (!s) return; const r = submitVacancy(s.id); if (!r.ok) return setErr(r.error ?? ''); nav(`/hr/recruitment/${s.id}`) }
  const planned = staff.filter((s: StaffMember) => s.status === 'planned')
  return (
    <>
      <PageHeader eyebrow={existing?.number ?? 'New'} title={existing ? `Edit ${existing.title}` : 'Recruitment request'} subtitle="Raised by the line manager. After submission it goes to your line manager (director) and then to the Director of Finance & Support; once approved, HR & Admin prepare the advertisement."
        actions={<div className="flex gap-2"><Link to="/hr/recruitment" className="btn-secondary"><ArrowLeft size={15} /> Back</Link><button className="btn-secondary" onClick={save}><Save size={15} /> Save draft</button><button className="btn-primary" data-testid="submit-vacancy" onClick={submit}><Send size={15} /> Submit for approval</button></div>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Position">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Position title" required className="sm:col-span-2"><input className="input" data-testid="vac-title" value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
              <Field label="Headcount"><input type="number" min={1} className="input" value={v.headcount ?? 1} onChange={(e) => setV({ ...v, headcount: Number(e.target.value) })} /></Field>
              <Field label="Department"><input className="input" value={v.department ?? ''} onChange={(e) => setV({ ...v, department: e.target.value })} /></Field>
              <Field label="Country / duty station"><input className="input" list="vac-countries" value={v.country ?? ''} onChange={(e) => setV({ ...v, country: e.target.value })} /><datalist id="vac-countries">{settings.countries.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <Field label="Contract"><select className="input" value={v.contractType ?? 'full_time'} onChange={(e) => setV({ ...v, contractType: e.target.value as Vacancy['contractType'] })}>{(Object.keys(CONTRACT_LABEL) as Vacancy['contractType'][]).map((c) => <option key={c} value={c}>{CONTRACT_LABEL[c]}</option>)}</select></Field>
              <Field label="Salary range"><input className="input" value={v.salaryRange ?? ''} onChange={(e) => setV({ ...v, salaryRange: e.target.value })} placeholder="JOD 900 – 1,100" /></Field>
              <Field label="Expected start"><input type="date" className="input" value={v.startDate ?? ''} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></Field>
              <Field label="Duration"><input className="input" value={v.duration ?? ''} onChange={(e) => setV({ ...v, duration: e.target.value })} /></Field>
              <Field label="Funding project" hint="Finance checks the budget against this project"><select className="input" value={v.projectId ?? ''} onChange={(e) => setV({ ...v, projectId: e.target.value || undefined })}><option value="">Core / unrestricted</option>{projects.filter((p) => ['granted', 'active', 'submitted'].includes(p.stage)).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title.slice(0, 40)}</option>)}</select></Field>
              <Field label="Planned position (salary plan)" hint="A 'to recruit' position created by an approved budget" className="sm:col-span-2"><select className="input" value={v.plannedStaffId ?? ''} onChange={(e) => setV({ ...v, plannedStaffId: e.target.value || undefined })}><option value="">— none —</option>{planned.map((s) => <option key={s.id} value={s.id}>{s.rhsNumber} · {s.position} ({s.sourceProjectCode})</option>)}</select></Field>
              <Field label="Justification" required className="sm:col-span-3"><textarea className="input min-h-[72px]" data-testid="vac-reason" value={v.reason ?? ''} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="Why the position is needed, workload, what happens without it" /></Field>
            </div>
          </Card>
          <Card title="Job description" description="Write it here or upload the file — the text of an uploaded PDF / Word file is read so keywords can be suggested from it" actions={<label className={cx('btn-secondary btn-sm cursor-pointer', busy && 'opacity-50')}><Upload size={13} /> {busy ? 'Reading…' : 'Upload JD'}<input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => upload(e.target.files?.[0])} /></label>}>
            {jd.attachment && <div className="mb-3 flex items-center justify-between rounded-control border border-brand-200 bg-brand-50 px-3 py-2 text-[12.5px]"><span><b>{jd.attachment.name}</b> · {Math.round(jd.attachment.size / 1024)} KB{jd.extractedText ? ` · ${jd.extractedText.split(/\s+/).length} words read` : ' · text could not be read'}</span><button className="btn-ghost btn-sm" onClick={() => setJd({ attachment: undefined, extractedText: undefined })}><X size={13} /></button></div>}
            <div className="space-y-3"><Field label="Purpose of the position"><textarea className="input min-h-[60px]" data-testid="jd-purpose" value={jd.purpose} onChange={(e) => setJd({ purpose: e.target.value })} /></Field><Field label="Key responsibilities"><textarea className="input min-h-[100px]" value={jd.responsibilities} onChange={(e) => setJd({ responsibilities: e.target.value })} placeholder="• one per line" /></Field><Field label="Qualifications & experience"><textarea className="input min-h-[80px]" value={jd.qualifications} onChange={(e) => setJd({ qualifications: e.target.value })} placeholder="• one per line" /></Field></div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="CV screening" description="Applications are matched against these keywords and the minimum years of experience; the best matches rank first.">
            <Field label="Keywords" hint="Press Enter or comma to add"><div className="flex gap-2"><input className="input" data-testid="kw-input" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKw() } }} placeholder="physiotherapy, Kobo, amputee" /><button className="btn-secondary" onClick={addKw}>Add</button></div></Field>
            <div className="mt-2 flex flex-wrap gap-1.5">{(v.keywords ?? []).map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-pill bg-brand-100 px-2.5 py-0.5 text-[12px] font-medium text-brand-800">{k}<button onClick={() => setV({ ...v, keywords: v.keywords!.filter((x) => x !== k) })} aria-label={`Remove ${k}`}><X size={11} /></button></span>)}{(v.keywords ?? []).length === 0 && <span className="text-[12px] text-ink-400">No keywords yet.</span>}</div>
            <button className="btn-ghost btn-sm mt-2" onClick={suggest}><Wand2 size={13} /> Suggest from the job description</button>
            <Field label="Minimum years of experience" className="mt-3"><input type="number" min={0} className="input" data-testid="min-years" value={v.minYears ?? 0} onChange={(e) => setV({ ...v, minYears: Number(e.target.value) })} /></Field>
          </Card>
          <Card title="Approval route"><ol className="space-y-2 text-[13px] text-ink-700"><li><b>1.</b> Your line manager (director) — need and fit</li><li><b>2.</b> Director of Finance & Support — budget / funding project</li><li><b>3.</b> HR & Admin — advertisement and the public application page</li></ol></Card>
        </div>
      </div>
    </>
  )
}

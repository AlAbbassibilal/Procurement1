import { useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Megaphone, Copy, ExternalLink, Pencil, Download, Paperclip, Lock } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, KV, Alert, Field, Modal, Stat } from '@/components/ui'
import { VACANCY_STATUS_LABEL, VACANCY_STATUS_TONE, canDecideVacancy, currentVacancyStep, applyLink, APPLICANT_STATUS_LABEL, APPLICANT_STATUS_TONE } from '@/lib/recruitment'
import { CONTRACT_LABEL } from '@/lib/salary'
import { fmtDate, fmtDateTime, cx } from '@/lib/format'
import { useHrContext } from './shared'
import type { Applicant, ApplicantStatus, Advertisement } from '@/types'

type Tab = 'request' | 'advert' | 'applicants'

export default function VacancyPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { hrManage } = useHrContext()
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'request'
  const { vacancies, applicants, projects, settings, decideVacancy, publishVacancy, closeVacancy, setApplicantStatus } = useStore()
  const v = vacancies.find((x) => x.id === id)
  const [decide, setDecide] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [adv, setAdv] = useState<Omit<Advertisement, 'token' | 'publishedAt' | 'publishedBy' | 'publishedByName'> | null>(null)
  const [view, setView] = useState<Applicant | null>(null)
  if (!v) return <div className="card p-8 text-center text-ink-500">Request not found. <Link to="/hr/recruitment" className="text-brand-700 hover:underline">Back</Link></div>
  const apps = applicants.filter((a) => a.vacancyId === v.id).sort((a, b) => b.score.total - a.score.total)
  const step = currentVacancyStep(v)
  const mine = v.requestedBy === user.id
  const link = v.advert ? applyLink(v.advert.token) : ''
  const copy = async () => { try { await navigator.clipboard.writeText(link) } catch { /* viewer may block */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const startAdvert = () => setAdv({ summary: `${settings.orgName} is recruiting a ${v.title} (${v.department}, ${v.country}).${v.jd.purpose ? ' ' + v.jd.purpose : ''}`, responsibilities: v.jd.responsibilities, requirements: v.jd.qualifications || `${v.minYears}+ years of relevant experience`, howToApply: 'Apply through this page with your CV (PDF or Word). Only shortlisted candidates will be contacted.', location: v.country, closingDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) })
  const project = projects.find((p) => p.id === v.projectId)
  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{v.number}</span>} title={<span className="flex flex-wrap items-center gap-3">{v.title}<span className={cx('rounded-pill px-2 py-0.5 text-[11.5px] font-semibold', VACANCY_STATUS_TONE[v.status])}>{VACANCY_STATUS_LABEL[v.status]}</span></span>}
        subtitle={`${v.headcount} × ${CONTRACT_LABEL[v.contractType]} · ${v.department} · ${v.country} · raised by ${v.requestedByName} ${fmtDate(v.createdAt)} · Owner ${v.ownerName}`}
        actions={<div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => nav('/hr/recruitment')}><ArrowLeft size={15} /> Recruitment</button>
          {(mine || hrManage) && ['draft', 'rejected'].includes(v.status) && <Link to={`/hr/recruitment/${v.id}/edit`} className="btn-secondary"><Pencil size={15} /> Edit</Link>}
          {canDecideVacancy(v, user) && <><button className="btn-primary" data-testid="vac-approve" onClick={() => { setNote(''); setDecide(true) }}><Check size={15} /> Approve</button><button className="btn-danger-soft" onClick={() => { setNote(''); setDecide(false) }}><X size={15} /> Reject</button></>}
          {hrManage && v.status === 'approved' && <button className="btn-primary" data-testid="create-advert" onClick={() => { startAdvert(); setSp({ tab: 'advert' }) }}><Megaphone size={15} /> Create advertisement</button>}
          {hrManage && v.status === 'advertised' && <button className="btn-secondary" onClick={() => { if (confirm('Close the vacancy? The application page stops accepting applications.')) closeVacancy(v.id) }}><Lock size={15} /> Close vacancy</button>}
        </div>} />
      <div className="mb-5 flex gap-1 border-b border-line">{([['request', 'Request & approvals'], ['advert', 'Advertisement'], ['applicants', `Applicants (${apps.length})`]] as [Tab, string][]).map(([t, l]) => <button key={t} className={cx('-mb-px border-b-2 px-3 py-2 text-[13px] font-medium', tab === t ? 'border-brand-600 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-800')} onClick={() => setSp(t === 'request' ? {} : { tab: t })}>{l}</button>)}</div>

      {tab === 'request' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Request"><KV k="Justification" v={v.reason} /><KV k="Salary range" v={v.salaryRange || '—'} /><KV k="Expected start · duration" v={`${v.startDate ? fmtDate(v.startDate) : '—'} · ${v.duration || '—'}`} /><KV k="Funding" v={project ? <Link to={`/grants/${project.id}?tab=budget`} className="text-brand-700 hover:underline">{project.code} · {project.title}</Link> : 'Core / unrestricted'} />{v.plannedStaffId && <KV k="Planned position" v={<Link to="/finance/salary-plan" className="text-brand-700 hover:underline">on the master salary plan</Link>} />}<KV k="Screening keywords" v={<span className="flex flex-wrap justify-end gap-1">{v.keywords.map((k) => <span key={k} className="rounded-pill bg-brand-100 px-2 py-0.5 text-[11.5px] font-medium text-brand-800">{k}</span>)}</span>} /><KV k="Minimum experience" v={`${v.minYears} year(s)`} /></Card>
            <Card title="Job description" actions={v.jd.attachment?.dataUrl && <a className="btn-secondary btn-sm" href={v.jd.attachment.dataUrl} download={v.jd.attachment.name}><Paperclip size={13} /> {v.jd.attachment.name}</a>}>
              {v.jd.purpose && <><div className="label">Purpose</div><p className="mb-3 whitespace-pre-line text-[13px] text-ink-800">{v.jd.purpose}</p></>}
              {v.jd.responsibilities && <><div className="label">Key responsibilities</div><p className="mb-3 whitespace-pre-line text-[13px] text-ink-800">{v.jd.responsibilities}</p></>}
              {v.jd.qualifications && <><div className="label">Qualifications & experience</div><p className="whitespace-pre-line text-[13px] text-ink-800">{v.jd.qualifications}</p></>}
              {!v.jd.purpose && !v.jd.responsibilities && v.jd.extractedText && <p className="whitespace-pre-line text-[12.5px] text-ink-700">{v.jd.extractedText.slice(0, 3000)}</p>}
            </Card>
          </div>
          <Card title="Approvals" description="Line manager (director) then Finance">
            {v.approvals.length === 0 ? <p className="text-[13px] text-ink-500">Not submitted yet.</p> : <ol className="space-y-3">{v.approvals.map((a, i) => <li key={a.key} className="flex gap-3"><span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[12px] font-bold', a.status === 'approved' ? 'bg-brand-600 text-white' : a.status === 'rejected' ? 'bg-accent-600 text-white' : step?.key === a.key ? 'bg-sun-500 text-ink-900' : 'bg-ink-100 text-ink-500')}>{a.status === 'approved' ? <Check size={14} /> : a.status === 'rejected' ? <X size={14} /> : i + 1}</span><div className="text-[13px]"><div className="font-medium text-ink-900">{a.label}</div><div className="text-[12px] text-ink-500">{a.approverName ?? 'by role'}{a.decidedAt && ` · ${a.status} ${fmtDateTime(a.decidedAt)} by ${a.decidedByName}`}{a.note && <div className="text-ink-700">“{a.note}”</div>}</div></div></li>)}</ol>}
            {v.status === 'approved' && <div className="mt-3"><Alert tone="success">Approved — HR & Admin prepare the advertisement.</Alert></div>}
            {v.status === 'rejected' && <div className="mt-3"><Alert tone="danger">Rejected. The requester can edit and resubmit.</Alert></div>}
          </Card>
        </div>
      )}

      {tab === 'advert' && (
        v.advert && !adv ? (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2"><Card title={v.title} description={`${v.advert.location} · closing ${fmtDate(v.advert.closingDate)} · published ${fmtDate(v.advert.publishedAt)} by ${v.advert.publishedByName}`}>
              <p className="mb-3 text-[13.5px] text-ink-800">{v.advert.summary}</p><div className="label">Responsibilities</div><p className="mb-3 whitespace-pre-line text-[13px] text-ink-800">{v.advert.responsibilities}</p><div className="label">Requirements</div><p className="mb-3 whitespace-pre-line text-[13px] text-ink-800">{v.advert.requirements}</p><div className="label">How to apply</div><p className="text-[13px] text-ink-800">{v.advert.howToApply}</p>
            </Card></div>
            <Card title="Public application page" description="Anyone with the link can read the advertisement and apply — no account needed">
              <div className="flex gap-2"><input className="input font-mono text-[12px]" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /><button className="btn-secondary" onClick={copy}><Copy size={14} /> {copied ? 'Copied' : 'Copy'}</button></div>
              <a className="btn-primary mt-3 w-full" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open the application page</a>
              {hrManage && v.status === 'advertised' && <button className="btn-ghost btn-sm mt-3 w-full" onClick={() => setAdv({ summary: v.advert!.summary, responsibilities: v.advert!.responsibilities, requirements: v.advert!.requirements, howToApply: v.advert!.howToApply, location: v.advert!.location, closingDate: v.advert!.closingDate })}><Pencil size={13} /> Edit advertisement</button>}
            </Card>
          </div>
        ) : adv && hrManage ? (
          <Card title="Advertisement" description="Prefilled from the job description — edit the public text, set the closing date and publish" actions={<div className="flex gap-2"><button className="btn-secondary btn-sm" onClick={() => setAdv(null)}>Cancel</button><button className="btn-primary btn-sm" data-testid="publish-advert" onClick={() => { if (!adv.summary.trim() || !adv.closingDate) return alert('Summary and closing date are required.'); publishVacancy(v.id, adv); setAdv(null) }}><Megaphone size={13} /> Publish & create application page</button></div>}>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Summary" className="sm:col-span-2"><textarea className="input min-h-[72px]" value={adv.summary} onChange={(e) => setAdv({ ...adv, summary: e.target.value })} /></Field><Field label="Responsibilities"><textarea className="input min-h-[120px]" value={adv.responsibilities} onChange={(e) => setAdv({ ...adv, responsibilities: e.target.value })} /></Field><Field label="Requirements"><textarea className="input min-h-[120px]" value={adv.requirements} onChange={(e) => setAdv({ ...adv, requirements: e.target.value })} /></Field><Field label="How to apply"><input className="input" value={adv.howToApply} onChange={(e) => setAdv({ ...adv, howToApply: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Location"><input className="input" value={adv.location} onChange={(e) => setAdv({ ...adv, location: e.target.value })} /></Field><Field label="Closing date" required><input type="date" className="input" value={adv.closingDate} onChange={(e) => setAdv({ ...adv, closingDate: e.target.value })} /></Field></div></div>
          </Card>
        ) : <Alert tone="info">{v.status === 'approved' ? (hrManage ? 'Create the advertisement from the button above.' : 'Approved — waiting for HR & Admin to advertise.') : 'The advertisement is prepared by HR & Admin once the request is approved.'}</Alert>
      )}

      {tab === 'applicants' && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-4"><Stat label="Applications" value={apps.length} /><Stat label={`Meeting ${v.minYears}+ years`} value={apps.filter((a) => a.score.meetsYears).length} tone="brand" /><Stat label="Full keyword match" value={apps.filter((a) => a.score.keywordPct === 100).length} /><Stat label="Shortlisted / interview" value={apps.filter((a) => ['shortlisted', 'interview', 'offered'].includes(a.status)).length} tone="sun" /></div>
          <Card padded={false} description="Ranked by match: 70 % keywords found in the CV and cover letter, 30 % years of experience (declared or detected in the CV)." title="Candidates" actions={<button className="btn-secondary btn-sm" onClick={async () => { const X = await import('xlsx'); const aoa = [['Rank', 'Applicant', 'E-mail', 'Phone', 'Country', 'Years declared', 'Years detected', 'Keyword match %', ...v.keywords, 'Total score', 'Status', 'Submitted'], ...apps.map((a, i) => [i + 1, a.name, a.email, a.phone, a.country, a.yearsExperience, a.score.yearsDetected ?? '', a.score.keywordPct, ...v.keywords.map((k) => (a.score.matched.includes(k) ? 'yes' : '')), a.score.total, a.status, a.submittedAt.slice(0, 10)])]; const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Applicants'); X.writeFile(wb, `${v.number}_applicants.xlsx`) }}><Download size={13} /> Export</button>}>
            <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]">
              <thead><tr><th className="table-th w-10">#</th><th className="table-th">Applicant</th><th className="table-th w-44">Match</th><th className="table-th">Keywords found</th><th className="table-th">Experience</th><th className="table-th">Status</th><th className="table-th w-40" /></tr></thead>
              <tbody>{apps.length === 0 && <tr><td colSpan={7} className="table-td text-ink-500">No applications yet{v.advert ? ' — share the application link.' : '.'}</td></tr>}{apps.map((a, i) => (
                <tr key={a.id} className="hover:bg-surface-muted"><td className="table-td text-ink-400">{i + 1}</td>
                  <td className="table-td"><button className="font-medium text-ink-900 hover:text-brand-700" onClick={() => setView(a)}>{a.name}</button><div className="text-[12px] text-ink-500">{a.email} · {a.phone}</div><div className="text-[11px] text-ink-400">{a.number} · {fmtDateTime(a.submittedAt)}</div></td>
                  <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', a.score.total >= 70 ? 'bg-brand-600' : a.score.total >= 40 ? 'bg-sun-500' : 'bg-accent-600')} style={{ width: `${a.score.total}%` }} /></div><b className="w-10 text-right">{a.score.total}</b></div><div className="text-[11px] text-ink-500">keywords {a.score.keywordPct}%</div></td>
                  <td className="table-td"><div className="flex flex-wrap gap-1">{v.keywords.map((k) => <span key={k} className={cx('rounded-pill px-1.5 py-0.5 text-[10.5px] font-medium', a.score.matched.includes(k) ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-400 line-through')}>{k}</span>)}</div></td>
                  <td className="table-td"><span className={cx('font-semibold', a.score.meetsYears ? 'text-brand-800' : 'text-accent-700')}>{Math.max(a.yearsExperience, a.score.yearsDetected ?? 0)} yrs</span><div className="text-[11px] text-ink-500">declared {a.yearsExperience}{a.score.yearsDetected !== null && ` · CV ${a.score.yearsDetected}`}</div></td>
                  <td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', APPLICANT_STATUS_TONE[a.status])}>{APPLICANT_STATUS_LABEL[a.status]}</span></td>
                  <td className="table-td">{(hrManage || mine) && <select className="input text-[12px]" value={a.status} onChange={(e) => { const s = e.target.value as ApplicantStatus; if (s === 'hired' && !confirm(`Mark ${a.name} as hired?${v.plannedStaffId ? ' The planned position on the salary plan will be filled.' : ''}`)) return; setApplicantStatus(a.id, s) }}>{(Object.keys(APPLICANT_STATUS_LABEL) as ApplicantStatus[]).map((s) => <option key={s} value={s}>{APPLICANT_STATUS_LABEL[s]}</option>)}</select>}</td></tr>))}</tbody></table></div>
          </Card>
        </>
      )}

      <Modal open={decide !== null} onClose={() => setDecide(null)} title={decide ? `Approve ${v.number}` : `Reject ${v.number}`} footer={<><button className="btn-secondary" onClick={() => setDecide(null)}>Cancel</button><button className={decide ? 'btn-primary' : 'btn-danger'} data-testid="vac-confirm" onClick={() => { decideVacancy(v.id, !!decide, note || undefined); setDecide(null) }}>Confirm</button></>}>
        <p className="mb-3 text-[13px] text-ink-700">{step?.label}{step?.key === 'finance' && project && <> · funding project <b>{project.code}</b></>}</p><Field label="Note (optional)"><textarea className="input min-h-[64px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} width="max-w-3xl" title={view ? `${view.name} · ${view.number}` : ''} footer={<button className="btn-secondary" onClick={() => setView(null)}>Close</button>}>
        {view && <div className="space-y-3 text-[13px]"><div className="grid gap-3 sm:grid-cols-4"><Stat label="Total score" value={view.score.total} tone="brand" /><Stat label="Keywords" value={`${view.score.keywordPct}%`} hint={`${view.score.matched.length} of ${v.keywords.length}`} /><Stat label="Years (declared / CV)" value={`${view.yearsExperience} / ${view.score.yearsDetected ?? '—'}`} tone={view.score.meetsYears ? 'default' : 'accent'} /><Stat label="Country" value={view.country} /></div>{view.cv?.dataUrl && <a className="btn-secondary btn-sm" href={view.cv.dataUrl} download={view.cv.name}><Paperclip size={13} /> {view.cv.name}</a>}{view.coverLetter && <><div className="label">Cover letter</div><p className="whitespace-pre-line text-ink-800">{view.coverLetter}</p></>}<div className="label">CV text (as read by the system)</div><p className="max-h-72 overflow-y-auto whitespace-pre-line rounded-control bg-surface-muted p-3 text-[12.5px] text-ink-700 scrollbar-thin">{view.cvText || 'No text could be read from the CV.'}</p></div>}
      </Modal>
    </>
  )
}

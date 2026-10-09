import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, Award, Play, Archive, Undo2, PenLine, Plus, Paperclip, Download, Users, MessageSquare, CheckCircle2 } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, StatusPill, KV, Alert, Field, Modal } from '@/components/ui'
import { AttachmentList } from '@/components/workflow'
import { computeBvA } from '@/lib/budget'
import { STAGE_LABEL, STAGE_DESC, STAGE_INDEX, PROJECT_STAGES_LIST, ipttProgress, workplanProgress, reportLiveStatus, allIndicators, monthsOf, planTotal } from '@/lib/grants'
import { accessOf } from '@/lib/departments'
import { fmtMoney, fmtDate, fmtDateTime, timeAgo, cx, uid } from '@/lib/format'
import { StagePill } from './Overview'
import { LogframeTab, WorkplanTab, BudgetTab, SpendingTab, IPTTTab } from './ProjectPlanning'
import { TaskModal, TaskList } from '@/pages/Tasks'
import type { ProjectStage, ProjectReport, Attachment } from '@/types'

type Tab = 'dashboard' | 'proposal' | 'logframe' | 'workplan' | 'budget' | 'spending' | 'iptt' | 'reports' | 'tasks' | 'team'
const TABS: { id: Tab; label: string }[] = [{ id: 'dashboard', label: 'Dashboard' }, { id: 'proposal', label: 'Proposal' }, { id: 'logframe', label: 'Logframe' }, { id: 'workplan', label: 'Work plan' }, { id: 'budget', label: 'Budget' }, { id: 'spending', label: 'Spending plan' }, { id: 'iptt', label: 'IPTT' }, { id: 'reports', label: 'Reports' }, { id: 'tasks', label: 'Tasks' }, { id: 'team', label: 'Team & discussion' }]

export default function ProjectPage() {
  const { id } = useParams(); const nav = useNavigate(); const [sp, setSp] = useSearchParams()
  const user = useCurrentUser()!
  const { projects, budgets, prs, pos, invoices, users, tasks, advanceProject, updateProject, addProjectComment, addReport, updateReport, submitReport } = useStore()
  const p = projects.find((x) => x.id === id)
  const tab = (sp.get('tab') as Tab) || 'dashboard'
  const setTab = (t: Tab) => setSp({ tab: t })
  const [stageModal, setStageModal] = useState<ProjectStage | null>(null)
  const [note, setNote] = useState(''); const [award, setAward] = useState(''); const [dates, setDates] = useState({ start: '', end: '' })
  const [err, setErr] = useState<string | null>(null)
  const [taskOpen, setTaskOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [reportModal, setReportModal] = useState<ProjectReport | null>(null); const [repFiles, setRepFiles] = useState<Attachment[]>([]); const [repNote, setRepNote] = useState('')
  const [newReport, setNewReport] = useState<{ title: string; type: ProjectReport['type']; dueDate: string; reminderDays: number } | null>(null)
  if (!p) return <Alert tone="danger">Project not found. <Link to="/grants" className="underline">Back</Link></Alert>
  const budget = budgets.find((b) => b.id === p.budgetId)
  const bva = budget ? computeBvA(budget, prs, pos, invoices) : undefined
  const lvl = accessOf(user, 'grants'); const isTeam = p.managerId === user.id || p.teamIds.includes(user.id)
  const canEdit = lvl === 'manage' || (lvl === 'edit' && isTeam) || user.role === 'admin'
  const canStage = lvl === 'manage' || user.role === 'admin'
  const ip = ipttProgress(p), wpp = workplanProgress(p)
  const reports = p.reports.map((r) => ({ ...r, live: reportLiveStatus(r) })).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const projTasks = tasks.filter((t) => t.projectId === p.id)
  const next: Partial<Record<ProjectStage, ProjectStage>> = { development: 'submitted', submitted: 'granted', granted: 'active', active: 'closed' }
  const openStage = (s: ProjectStage) => { setErr(null); setNote(''); setAward(String(p.requestedAmount ?? budget?.lines.reduce((x, l) => x + l.amount, 0) ?? '')); setDates({ start: p.startDate ?? '', end: p.endDate ?? '' }); setStageModal(s) }
  const confirmStage = () => { if (!stageModal) return; const r = advanceProject(p.id, stageModal, { note, awardedAmount: award ? Number(award) : undefined, startDate: dates.start || undefined, endDate: dates.end || undefined, outcome: stageModal === 'closed' && ['development', 'submitted'].includes(p.stage) ? 'not_funded' : undefined }); if (!r.ok) return setErr(r.error ?? 'Failed'); setStageModal(null) }
  const months = monthsOf(p.startDate, p.endDate); const thisMonth = new Date().toISOString().slice(0, 7)
  const elapsed = Math.max(0, Math.min(months.length, months.indexOf(thisMonth) + 1))

  return (
    <>
      <PageHeader eyebrow={<span className="flex items-center gap-2"><span className="font-mono">{p.code}</span>· <StagePill stage={p.stage} />{p.outcome === 'not_funded' && <span className="text-accent-700">not funded</span>}</span>} title={p.title}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{p.donorName}</span>{p.duration && <span>· {p.duration}</span>}{(p.startDate || p.endDate) && <span>· {fmtDate(p.startDate)} – {fmtDate(p.endDate)}</span>}<span>· PM {p.managerName}</span><span>· Owner {p.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav('/grants')}><ArrowLeft size={15} /> Grants</button>
          <button className="btn-secondary" onClick={() => setTaskOpen(true)}><Plus size={15} /> Assign task</button>
          {['granted', 'active'].includes(p.stage) && <Link to={`/esign/new?subject=${encodeURIComponent(`Grant agreement — ${p.code} ${p.donorName}`)}&link=CONTRACT&id=${p.id}&number=${p.code}`} className="btn-secondary"><PenLine size={15} /> Send agreement for e-signature</Link>}
          {canStage && p.stage === 'submitted' && <button className="btn-ghost" onClick={() => openStage('development')}><Undo2 size={15} /> Back to development</button>}
          {canStage && p.stage === 'submitted' && <button className="btn-danger-soft" onClick={() => openStage('closed')}><Archive size={15} /> Not funded</button>}
          {canStage && next[p.stage] && <button className="btn-primary" onClick={() => openStage(next[p.stage]!)}>{p.stage === 'development' ? <><Send size={15} /> Submit to donor</> : p.stage === 'submitted' ? <><Award size={15} /> Mark as granted</> : p.stage === 'granted' ? <><Play size={15} /> Activate project</> : <><Archive size={15} /> Close project</>}</button>}
        </>} />

      {/* Stage stepper */}
      <div className="card mb-5 px-5 py-4"><ol className="flex flex-wrap items-center gap-2">{PROJECT_STAGES_LIST.map((s, i) => { const done = STAGE_INDEX(p.stage) > i, cur = p.stage === s; const h = p.stageHistory.filter((x) => x.stage === s).pop(); return (
        <li key={s} className="flex items-center gap-2"><span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', done ? 'bg-brand-600 text-white' : cur ? 'bg-sun-500 text-ink-900 ring-4 ring-sun-100' : 'bg-ink-200 text-ink-500')}>{done ? '✓' : i + 1}</span><span><span className={cx('block text-[13px] font-medium', cur ? 'text-ink-900' : done ? 'text-ink-700' : 'text-ink-400')}>{STAGE_LABEL[s]}</span>{h && <span className="block text-[11px] text-ink-400">{fmtDate(h.at)}</span>}</span>{i < 4 && <span className="mx-1 h-px w-6 bg-ink-200" />}</li>) })}</ol><div className="mt-2 text-[12px] text-ink-500">{STAGE_DESC[p.stage]}</div></div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-line">{TABS.map((t) => <button key={t.id} className={cx('-mb-px border-b-2 px-3 py-2 text-[13px] font-medium', tab === t.id ? 'border-brand-600 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-800')} onClick={() => setTab(t.id)}>{t.label}{t.id === 'reports' && reports.some((r) => r.live === 'overdue' || r.live === 'due') && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-600" />}{t.id === 'tasks' && projTasks.filter((x) => x.status !== 'done').length > 0 && <span className="ml-1 rounded-pill bg-surface-sunken px-1.5 text-[10.5px]">{projTasks.filter((x) => x.status !== 'done').length}</span>}</button>)}</div>

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label={p.stage === 'development' || p.stage === 'submitted' ? 'Requested budget' : 'Awarded budget'} value={fmtMoney((['development', 'submitted'].includes(p.stage) ? p.requestedAmount : p.awardedAmount) ?? budget?.lines.reduce((s, l) => s + l.amount, 0) ?? 0, p.currency)} tone="brand" />
            <Stat label="Spent + committed" value={bva ? fmtMoney(bva.totals.actual + bva.totals.commitments, p.currency) : '—'} hint={bva ? `${bva.approvedTotal.burnWithCommitPct}% burn · ${fmtMoney(bva.approvedTotal.remainingWithCommit, p.currency)} left` : undefined} tone="sun" />
            <Stat label="Time elapsed" value={`${months.length ? Math.round((elapsed / months.length) * 100) : 0}%`} hint={`${elapsed} of ${months.length} months`} />
            <Stat label="IPTT — indicators on track" value={`${ip.pct}%`} hint={`${ip.onTrack} of ${ip.count} ≥ 50% of target`} />
            <Stat label="Work plan progress" value={`${wpp.pct}%`} hint={`${wpp.completed} done · ${wpp.ongoing} ongoing · ${wpp.planned} planned`} />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card title="Budget vs spending" description={bva ? 'Approved budget · planned (spending plan) · actual + committed' : 'Budget under development'} padded={false}>
                {bva ? (
                  <div className="overflow-x-auto scrollbar-thin"><table className="w-full text-[12.5px]"><thead><tr><th className="table-th">Line</th><th className="table-th text-right">Budget</th><th className="table-th text-right">Planned to date</th><th className="table-th text-right">Actual + committed</th><th className="table-th w-44">Burn</th></tr></thead>
                    <tbody>{bva.rows.map((r) => { const planned = planTotal(p.spendingPlan, (e) => e.lineCode === r.code && e.period <= thisMonth); return <tr key={r.code} className="border-t border-line"><td className="table-td"><span className="font-mono text-[11px] text-brand-700">{r.code}</span> {r.description.slice(0, 48)}</td><td className="table-td text-right tabular-nums">{fmtMoney(r.budget, p.currency)}</td><td className="table-td text-right tabular-nums text-ink-500">{fmtMoney(planned, p.currency)}</td><td className="table-td text-right tabular-nums font-medium">{fmtMoney(r.actual + r.commitments, p.currency)}</td><td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', r.burnWithCommitPct > 100 ? 'bg-accent-600' : r.burnWithCommitPct > 90 ? 'bg-sun-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, r.burnWithCommitPct)}%` }} /></div><span className="w-9 text-right tabular-nums">{r.burnWithCommitPct}%</span></div></td></tr> })}</tbody>
                    <tfoot><tr className="bg-surface-muted font-semibold"><td className="table-td">TOTAL</td><td className="table-td text-right tabular-nums">{fmtMoney(bva.approvedTotal.budget, p.currency)}</td><td className="table-td text-right tabular-nums">{fmtMoney(planTotal(p.spendingPlan, (e) => e.period <= thisMonth), p.currency)}</td><td className="table-td text-right tabular-nums">{fmtMoney(bva.approvedTotal.actual + bva.approvedTotal.commitments, p.currency)}</td><td className="table-td tabular-nums">{bva.approvedTotal.burnWithCommitPct}%</td></tr></tfoot></table></div>
                ) : <div className="px-5 py-6 text-[13px] text-ink-500">Lines: {budget?.lines.length ?? 0} · total {fmtMoney(budget?.lines.reduce((s, l) => s + l.amount, 0) ?? 0, p.currency)}. BvA starts once the project is granted.</div>}
              </Card>
              <Card title="Indicator progress (IPTT)" padded={false}>
                {allIndicators(p.logframe).length === 0 ? <div className="px-5 py-6 text-[13px] text-ink-500">No indicators yet — add them on the Logframe tab.</div> : (
                  <ul className="divide-y divide-line">{allIndicators(p.logframe).map((i) => { const ach = p.iptt.filter((e) => e.indicatorId === i.id).reduce((s, e) => s + e.male + e.female + e.other, 0); const pct = i.target ? Math.min(100, Math.round((ach / i.target) * 100)) : 0; return <li key={i.id} className="flex items-center gap-3 px-5 py-2 text-[12.5px]"><span className="w-10 font-mono text-[11px] text-brand-700">{i.code}</span><span className="min-w-0 flex-1 truncate text-ink-800">{i.text}</span><span className="w-28 text-right tabular-nums text-ink-600">{ach} / {i.target}{i.unit === '%' ? '%' : ''}</span><div className="h-2 w-32 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', pct >= 75 ? 'bg-brand-600' : pct >= 40 ? 'bg-sun-500' : 'bg-accent-600')} style={{ width: `${pct}%` }} /></div><span className="w-9 text-right tabular-nums">{pct}%</span></li> })}</ul>
                )}
              </Card>
            </div>
            <div className="space-y-6">
              <Card title="Reporting" description="Next obligations" actions={<button className="text-[12px] text-brand-700 hover:underline" onClick={() => setTab('reports')}>All</button>}>
                {reports.filter((r) => !['submitted', 'approved'].includes(r.status)).length === 0 ? <div className="text-[13px] text-ink-500">Nothing outstanding.</div> : <ul className="space-y-2">{reports.filter((r) => !['submitted', 'approved'].includes(r.status)).slice(0, 4).map((r) => <li key={r.id} className="flex items-start gap-2 text-[13px]"><span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.live === 'overdue' ? 'bg-accent-600' : r.live === 'due' ? 'bg-sun-500' : 'bg-ink-300')} /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink-900">{r.title}</span><span className="block text-[11.5px] text-ink-500">due {fmtDate(r.dueDate)} · <StatusPill status={r.live} /></span></span></li>)}</ul>}
              </Card>
              <Card title="Work plan" description="Activity status" actions={<button className="text-[12px] text-brand-700 hover:underline" onClick={() => setTab('workplan')}>Open</button>}>
                {p.workplan.length === 0 ? <div className="text-[13px] text-ink-500">No activities yet.</div> : <ul className="space-y-1.5">{p.workplan.slice(0, 7).map((a) => <li key={a.id} className="flex items-center gap-2 text-[12.5px]"><span className={cx('h-2 w-2 shrink-0 rounded-full', a.status === 'completed' ? 'bg-brand-600' : a.status === 'ongoing' ? 'bg-sun-500' : 'bg-info-500')} /><span className="min-w-0 flex-1 truncate text-ink-800">{a.title}</span><span className="text-[11px] tabular-nums text-ink-500">{a.status === 'completed' ? '100' : a.progress}%</span></li>)}{p.workplan.length > 7 && <li className="text-[11.5px] text-ink-400">+{p.workplan.length - 7} more</li>}</ul>}
              </Card>
              <Card title="Open tasks" actions={<button className="text-[12px] text-brand-700 hover:underline" onClick={() => setTab('tasks')}>All</button>}>
                {projTasks.filter((t) => t.status !== 'done').length === 0 ? <div className="text-[13px] text-ink-500">None.</div> : <ul className="space-y-1.5">{projTasks.filter((t) => t.status !== 'done').slice(0, 5).map((t) => <li key={t.id} className="text-[12.5px]"><span className="font-medium text-ink-900">{t.title}</span><span className="block text-[11px] text-ink-500">{t.assigneeName}{t.dueDate && ` · due ${fmtDate(t.dueDate)}`}</span></li>)}</ul>}
              </Card>
              <Card title="Project facts"><KV k="Donor" v={p.donorName} /><KV k="Sectors" v={p.sectors.join(', ') || '—'} /><KV k="Countries" v={p.countries.join(', ') || '—'} /><KV k="Locations" v={p.locations ?? '—'} /><KV k="Team" v={[p.managerName, ...p.teamIds.map((u) => users.find((x) => x.id === u)?.name)].filter(Boolean).join(', ')} /><KV k="Submitted" v={fmtDate(p.submittedAt)} /><KV k="Granted" v={fmtDate(p.grantedAt)} /><KV k="Closed" v={fmtDate(p.closedAt)} />{budget && <KV k="Budget record" v={<Link to={`/budgets/${budget.id}`} className="text-brand-700 hover:underline">{budget.donorCode} · {budget.status}</Link>} />}</Card>
            </div>
          </div>
        </div>
      )}

      {tab === 'proposal' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            {p.proposal.sections.map((s) => <Card key={s.id} title={s.title}><textarea className="input min-h-[110px]" value={s.content} disabled={!canEdit} placeholder="Write this section…" onChange={(e) => updateProject(p.id, { proposal: { ...p.proposal, sections: p.proposal.sections.map((x) => (x.id === s.id ? { ...x, content: e.target.value } : x)) } })} /></Card>)}
            {canEdit && <button className="btn-secondary btn-sm" onClick={() => { const t = prompt('Section title'); if (t) updateProject(p.id, { proposal: { ...p.proposal, sections: [...p.proposal.sections, { id: uid('ps_'), title: t, content: '' }] } }) }}><Plus size={13} /> Add section</button>}
          </div>
          <div className="space-y-6">
            <Card title="Submission"><div className="space-y-3"><Field label="Submitted to"><input className="input" value={p.proposal.submittedTo ?? ''} disabled={!canEdit} onChange={(e) => updateProject(p.id, { proposal: { ...p.proposal, submittedTo: e.target.value } })} /></Field><Field label="Reference"><input className="input" value={p.proposal.reference ?? ''} disabled={!canEdit} onChange={(e) => updateProject(p.id, { proposal: { ...p.proposal, reference: e.target.value } })} /></Field><Field label="Version"><input className="input" value={p.proposal.version ?? ''} disabled={!canEdit} onChange={(e) => updateProject(p.id, { proposal: { ...p.proposal, version: e.target.value } })} /></Field><Field label="Submission deadline"><input type="date" className="input" value={p.proposal.submissionDeadline ?? ''} disabled={!canEdit} onChange={(e) => updateProject(p.id, { proposal: { ...p.proposal, submissionDeadline: e.target.value } })} /></Field><Field label="Requested amount"><input type="number" className="input" value={p.requestedAmount ?? ''} disabled={!canEdit} onChange={(e) => updateProject(p.id, { requestedAmount: Number(e.target.value) || undefined })} /></Field></div></Card>
            <Card title="Proposal files" description="Concept note, full proposal, donor templates"><AttachmentList items={p.proposal.attachments} readOnly={!canEdit} onAdd={(a) => updateProject(p.id, { proposal: { ...p.proposal, attachments: [...p.proposal.attachments, a] } })} onRemove={(aid) => updateProject(p.id, { proposal: { ...p.proposal, attachments: p.proposal.attachments.filter((a) => a.id !== aid) } })} /></Card>
            <Card title="Package downloads"><div className="space-y-2 text-[13px]"><button className="btn-secondary btn-sm w-full justify-start" onClick={() => setTab('budget')}><Download size={13} /> Budget — RHS template</button><button className="btn-secondary btn-sm w-full justify-start" onClick={() => setTab('logframe')}><Download size={13} /> Annex 2 — Logframe (Word)</button><button className="btn-secondary btn-sm w-full justify-start" onClick={() => setTab('workplan')}><Download size={13} /> Work plan</button><button className="btn-secondary btn-sm w-full justify-start" onClick={() => setTab('iptt')}><Download size={13} /> Annex — IPTT</button></div></Card>
          </div>
        </div>
      )}
      {tab === 'logframe' && <LogframeTab p={p} canEdit={canEdit} />}
      {tab === 'workplan' && <WorkplanTab p={p} budget={budget} canEdit={canEdit} />}
      {tab === 'budget' && <BudgetTab p={p} budget={budget} canEdit={canEdit} />}
      {tab === 'spending' && <SpendingTab p={p} budget={budget} canEdit={canEdit} />}
      {tab === 'iptt' && <IPTTTab p={p} canEdit={canEdit} />}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[13px] text-ink-600">Reminders are sent to the project team {p.reports[0]?.reminderDays ?? 14} days before each due date and again when overdue.</div>{canEdit && <button className="btn-primary btn-sm" onClick={() => setNewReport({ title: '', type: 'narrative', dueDate: '', reminderDays: 14 })}><Plus size={13} /> Add report</button>}</div>
          <Card padded={false}>
            {reports.length === 0 ? <div className="px-5 py-8 text-center text-[13px] text-ink-500">The reporting calendar is generated when the grant is approved (quarterly narrative + financial, and final reports). You can add reports manually.</div> : (
              <table className="w-full text-[13px]"><thead><tr><th className="table-th">Report</th><th className="table-th">Type</th><th className="table-th">Period</th><th className="table-th">Due</th><th className="table-th">Status</th><th className="table-th">Submitted</th><th className="table-th w-40" /></tr></thead>
                <tbody>{reports.map((r) => <tr key={r.id} className={cx('border-t border-line', r.live === 'overdue' && 'bg-danger-50/40', r.live === 'due' && 'bg-sun-50/40')}><td className="table-td font-medium text-ink-900">{r.title}{r.attachments.length > 0 && <span className="ml-2 text-[11px] text-ink-500"><Paperclip size={11} className="inline" /> {r.attachments.length}</span>}</td><td className="table-td text-ink-600">{r.type}</td><td className="table-td text-ink-600">{r.period ?? '—'}</td><td className="table-td">{fmtDate(r.dueDate)}<div className="text-[11px] text-ink-400">remind {r.reminderDays}d before</div></td><td className="table-td"><StatusPill status={r.live} /></td><td className="table-td text-ink-600">{r.submittedAt ? `${fmtDate(r.submittedAt)} · ${r.submittedByName}` : '—'}</td><td className="table-td"><div className="flex gap-1">{!['submitted', 'approved'].includes(r.status) && canEdit && <button className="btn-primary btn-sm" onClick={() => { setRepFiles([]); setRepNote(''); setReportModal(r) }}><CheckCircle2 size={13} /> Submit</button>}{r.status === 'submitted' && canStage && <button className="btn-secondary btn-sm" onClick={() => updateReport(p.id, r.id, { status: 'approved' })}>Donor approved</button>}</div></td></tr>)}</tbody></table>
            )}
          </Card>
        </div>
      )}

      {tab === 'tasks' && (<Card title="Project tasks" description="Assigned tasks appear on each person's profile and notify them" padded={false} actions={<button className="btn-primary btn-sm" onClick={() => setTaskOpen(true)}><Plus size={13} /> Assign task</button>}><TaskList tasks={[...projTasks].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))} /></Card>)}

      {tab === 'team' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2"><Card title={<span className="flex items-center gap-2"><MessageSquare size={16} /> Discussion</span>} description="Mention a colleague with @FirstName to notify them">
            <ul className="mb-4 space-y-3">{p.comments.length === 0 && <li className="text-[13px] text-ink-500">No comments yet.</li>}{p.comments.map((c) => <li key={c.id} className="rounded-control bg-surface-muted px-3 py-2 text-[13px]"><div className="mb-0.5 flex items-center justify-between text-[11.5px] text-ink-500"><span className="font-medium text-ink-800">{c.authorName}</span><span>{timeAgo(c.at)}</span></div><div className="text-ink-800">{c.text.split(/(@\w+)/g).map((part, i) => (part.startsWith('@') ? <span key={i} className="rounded bg-brand-100 px-1 font-medium text-brand-800">{part}</span> : part))}</div></li>)}</ul>
            <div className="flex gap-2"><input className="input" placeholder="Write a comment… use @Name to tag" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) { addProjectComment(p.id, comment.trim()); setComment('') } }} /><button className="btn-primary" disabled={!comment.trim()} onClick={() => { addProjectComment(p.id, comment.trim()); setComment('') }}>Post</button></div>
          </Card></div>
          <Card title={<span className="flex items-center gap-2"><Users size={16} /> Team</span>}>
            <div className="space-y-3"><Field label="Project manager"><select className="input" value={p.managerId ?? ''} disabled={!canStage} onChange={(e) => updateProject(p.id, { managerId: e.target.value, managerName: users.find((u) => u.id === e.target.value)?.name })}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <div><div className="label">Members</div><div className="space-y-1">{users.filter((u) => u.active && u.id !== p.managerId).map((u) => <label key={u.id} className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" disabled={!canEdit} checked={p.teamIds.includes(u.id)} onChange={(e) => updateProject(p.id, { teamIds: e.target.checked ? [...p.teamIds, u.id] : p.teamIds.filter((x) => x !== u.id) })} />{u.name} <span className="text-[11px] text-ink-400">{u.title}</span></label>)}</div></div></div>
            <div className="mt-4 border-t border-line pt-3"><div className="label">Stage history</div><ul className="space-y-1 text-[12px] text-ink-600">{p.stageHistory.map((h, i) => <li key={i}><b className="text-ink-800">{STAGE_LABEL[h.stage]}</b> · {fmtDateTime(h.at)} · {h.byName}{h.note && <div className="text-ink-500">{h.note}</div>}</li>)}</ul></div>
          </Card>
        </div>
      )}

      {/* Stage modal */}
      <Modal open={!!stageModal} onClose={() => setStageModal(null)} title={stageModal ? `${STAGE_LABEL[stageModal]} — confirm` : ''} footer={<><button className="btn-secondary" onClick={() => setStageModal(null)}>Cancel</button><button className="btn-primary" onClick={confirmStage}>Confirm</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        {stageModal && <p className="mb-3 text-[13px] text-ink-700">{STAGE_DESC[stageModal]}</p>}
        {stageModal === 'submitted' && <Alert tone="info">On submission the IPTT is generated from the {allIndicators(p.logframe).length} logframe indicator(s) and the requested amount is set to the budget total ({fmtMoney(budget?.lines.reduce((s, l) => s + l.amount, 0) ?? 0, p.currency)}).</Alert>}
        {stageModal === 'granted' && <div className="space-y-3"><Field label={`Awarded amount (${p.currency})`}><input type="number" className="input" value={award} onChange={(e) => setAward(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Start date"><input type="date" className="input" value={dates.start} onChange={(e) => setDates({ ...dates, start: e.target.value })} /></Field><Field label="End date"><input type="date" className="input" value={dates.end} onChange={(e) => setDates({ ...dates, end: e.target.value })} /></Field></div><Alert tone="success">The budget becomes the approved budget (open to requisitions and Budget-vs-Actual in Finance), the spending plan is spread over the project months, and the reporting calendar (quarterly + final) is created with reminders.</Alert></div>}
        <div className="mt-3"><Field label="Note (recorded in the stage history)"><textarea className="input min-h-[64px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder={stageModal === 'closed' ? 'Close-out summary, final report status…' : 'Optional'} /></Field></div>
      </Modal>
      {/* Report submit modal */}
      <Modal open={!!reportModal} onClose={() => setReportModal(null)} title={reportModal ? `Submit: ${reportModal.title}` : ''} footer={<><button className="btn-secondary" onClick={() => setReportModal(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (reportModal) submitReport(p.id, reportModal.id, repFiles, repNote); setReportModal(null) }}>Mark submitted</button></>}>
        <div className="space-y-3"><div><div className="label">Report files</div><AttachmentList items={repFiles} onAdd={(a) => setRepFiles([...repFiles, a])} onRemove={(aid) => setRepFiles(repFiles.filter((a) => a.id !== aid))} /></div><Field label="Notes"><textarea className="input min-h-[64px]" value={repNote} onChange={(e) => setRepNote(e.target.value)} placeholder="Submitted to … by email on …" /></Field></div>
      </Modal>
      <Modal open={!!newReport} onClose={() => setNewReport(null)} title="Add report" footer={<><button className="btn-secondary" onClick={() => setNewReport(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!newReport?.title || !newReport.dueDate) return alert('Title and due date are required'); addReport(p.id, { title: newReport.title, type: newReport.type, dueDate: newReport.dueDate, reminderDays: newReport.reminderDays }); setNewReport(null) }}>Add</button></>}>
        {newReport && <div className="space-y-3"><Field label="Title" required><input className="input" value={newReport.title} onChange={(e) => setNewReport({ ...newReport, title: e.target.value })} /></Field><div className="grid grid-cols-3 gap-3"><Field label="Type"><select className="input" value={newReport.type} onChange={(e) => setNewReport({ ...newReport, type: e.target.value as ProjectReport['type'] })}><option value="narrative">Narrative</option><option value="financial">Financial</option><option value="iptt">IPTT</option><option value="audit">Audit</option><option value="other">Other</option></select></Field><Field label="Due" required><input type="date" className="input" value={newReport.dueDate} onChange={(e) => setNewReport({ ...newReport, dueDate: e.target.value })} /></Field><Field label="Remind (days before)"><input type="number" className="input" value={newReport.reminderDays} onChange={(e) => setNewReport({ ...newReport, reminderDays: Number(e.target.value) })} /></Field></div></div>}
      </Modal>
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} projectId={p.id} projectCode={p.code} link={`/grants/${p.id}?tab=tasks`} />
    </>
  )
}

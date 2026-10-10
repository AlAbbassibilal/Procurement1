import { Link, useNavigate } from 'react-router-dom'
import { Plus, HandCoins, CalendarClock, ListChecks, ArrowRight } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, StatusPill } from '@/components/ui'
import { computeBvA } from '@/lib/budget'
import { STAGE_LABEL, reportLiveStatus, ipttProgress, workplanProgress } from '@/lib/grants'
import { ACCESS_LABEL, accessOf } from '@/lib/departments'
import { fmtMoney, fmtDate, cx } from '@/lib/format'
import type { ProjectStage } from '@/types'

export const STAGE_TONE: Record<ProjectStage, string> = { development: 'bg-ink-100 text-ink-700 ring-ink-200', submitted: 'bg-info-50 text-info-700 ring-info-500/30', granted: 'bg-sun-100 text-sun-700 ring-sun-300', active: 'bg-success-50 text-success-700 ring-brand-200', closed: 'bg-surface-sunken text-ink-500 ring-ink-200' }
export const StagePill = ({ stage }: { stage: ProjectStage }) => <span className={cx('inline-flex items-center rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', STAGE_TONE[stage])}>{STAGE_LABEL[stage]}</span>

export default function GrantsOverview() {
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { projects: allProjects, budgets, prs, pos, invoices, tasks, settings, country, trips } = useStore()
  const projects = allProjects.filter((p) => country === 'all' || p.countries.includes(country))
  const ccy = settings.defaultCurrency
  const by = (st: ProjectStage[]) => projects.filter((p) => st.includes(p.stage))
  const live = by(['granted', 'active'])
  const bva = (p: typeof projects[number]) => { const b = budgets.find((x) => x.id === p.budgetId); return b ? computeBvA(b, prs, pos, invoices, trips).totals : undefined }
  const portfolio = live.reduce((s, p) => s + (p.awardedAmount ?? 0), 0)
  const spent = live.reduce((s, p) => { const t = bva(p); return s + (t ? t.actual + t.commitments : 0) }, 0)
  const reportsDue = projects.filter((p) => ['granted', 'active'].includes(p.stage)).flatMap((p) => p.reports.map((r) => ({ p, r, live: reportLiveStatus(r) }))).filter((x) => x.live === 'due' || x.live === 'overdue').sort((a, b) => a.r.dueDate.localeCompare(b.r.dueDate))
  const myTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done').sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
  const year = new Date().getFullYear()
  const awardedThisYear = projects.filter((p) => p.grantedAt?.startsWith(String(year))).reduce((s, p) => s + (p.awardedAmount ?? 0), 0)

  return (
    <>
      <PageHeader eyebrow={`Grants workspace · your access: ${ACCESS_LABEL[accessOf(user, 'grants')]}`} title="Grants" subtitle="Project cycle management — from proposal to close-out. Every project carries its proposal, logframe, work plan, budget, spending plan, IPTT and reporting calendar; procurement and finance charge their work to it."
        actions={<><Link to="/grants/tracker" className="btn-secondary">Grants tracker</Link><Link to="/grants/new" className="btn-primary"><Plus size={15} /> New project / proposal</Link></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Under development" value={by(['development']).length} />
        <Stat label="Submitted — awaiting donor" value={by(['submitted']).length} tone="sun" hint={fmtMoney(by(['submitted']).reduce((s, p) => s + (p.requestedAmount ?? 0), 0), ccy) + ' requested'} />
        <Stat label="Active grants" value={live.length} tone="brand" hint={`${fmtMoney(portfolio, ccy)} portfolio`} />
        <Stat label="Portfolio burn (spent + committed)" value={portfolio ? `${Math.round((spent / portfolio) * 100)}%` : '—'} />
        <Stat label={`Awarded in ${year}`} value={fmtMoney(awardedThisYear, ccy)} tone="accent" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {(['development', 'submitted', 'granted', 'active'] as ProjectStage[]).map((st) => { const rows = by([st]); if (!rows.length) return null; return (
            <Card key={st} title={<span className="flex items-center gap-2">{STAGE_LABEL[st]} <span className="rounded-pill bg-surface-sunken px-1.5 text-[11px] text-ink-500">{rows.length}</span></span>} padded={false}>
              <table className="w-full text-[13px]">
                <thead><tr><th className="table-th">Project</th><th className="table-th">Donor</th><th className="table-th text-right">{st === 'development' || st === 'submitted' ? 'Requested' : 'Awarded'}</th><th className="table-th w-40">{st === 'development' ? 'Deadline' : st === 'submitted' ? 'Submitted' : 'Progress'}</th><th className="table-th w-8" /></tr></thead>
                <tbody>{rows.map((p) => { const t = bva(p); const ip = ipttProgress(p), wpp = workplanProgress(p); return (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/grants/${p.id}`)}>
                    <td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.code} · {p.managerName}</div></td>
                    <td className="table-td text-ink-600">{p.donorName}</td>
                    <td className="table-td text-right tabular-nums">{fmtMoney((st === 'development' || st === 'submitted' ? p.requestedAmount : p.awardedAmount) ?? (budgets.find((b) => b.id === p.budgetId)?.lines.reduce((s, l) => s + l.amount, 0) ?? 0), p.currency)}</td>
                    <td className="table-td text-[12px] text-ink-600">{st === 'development' ? (p.proposal.submissionDeadline ? `Due ${fmtDate(p.proposal.submissionDeadline)}` : '—') : st === 'submitted' ? fmtDate(p.submittedAt) : (
                      <div className="space-y-1"><div className="flex items-center gap-1"><span className="w-10 text-[10.5px] uppercase text-ink-400">Spend</span><div className="h-1.5 flex-1 rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-sun-500" style={{ width: `${Math.min(100, t?.burnWithCommitPct ?? 0)}%` }} /></div><span className="w-8 text-right tabular-nums">{t?.burnWithCommitPct ?? 0}%</span></div>
                        <div className="flex items-center gap-1"><span className="w-10 text-[10.5px] uppercase text-ink-400">IPTT</span><div className="h-1.5 flex-1 rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-brand-600" style={{ width: `${ip.pct}%` }} /></div><span className="w-8 text-right tabular-nums">{ip.pct}%</span></div>
                        <div className="flex items-center gap-1"><span className="w-10 text-[10.5px] uppercase text-ink-400">Plan</span><div className="h-1.5 flex-1 rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-info-500" style={{ width: `${wpp.pct}%` }} /></div><span className="w-8 text-right tabular-nums">{wpp.pct}%</span></div></div>
                    )}</td>
                    <td className="table-td"><ArrowRight size={15} className="text-ink-400" /></td>
                  </tr>) })}</tbody>
              </table>
            </Card>) })}
          {projects.length === 0 && <Card><div className="py-8 text-center text-[13px] text-ink-500">No projects yet — start with <Link to="/grants/new" className="text-brand-700 underline">New project / proposal</Link>.</div></Card>}
        </div>
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><CalendarClock size={16} /> Reports due</span>} description="Across active grants — reminders go to the project team">
            {reportsDue.length === 0 ? <div className="text-[13px] text-ink-500">Nothing due within the reminder window.</div> : (
              <ul className="space-y-2">{reportsDue.slice(0, 8).map(({ p, r, live }) => <li key={r.id}><Link to={`/grants/${p.id}?tab=reports`} className="flex items-start gap-2 text-[13px] hover:underline"><span className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', live === 'overdue' ? 'bg-accent-600' : 'bg-sun-500')} /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink-900">{r.title}</span><span className="block text-[11.5px] text-ink-500">{p.code} · due {fmtDate(r.dueDate)} · <StatusPill status={live} /></span></span></Link></li>)}</ul>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><ListChecks size={16} /> My tasks</span>} actions={<Link to="/tasks" className="text-[12.5px] text-brand-700 hover:underline">All</Link>}>
            {myTasks.length === 0 ? <div className="text-[13px] text-ink-500">No open tasks.</div> : <ul className="space-y-2">{myTasks.slice(0, 6).map((t) => <li key={t.id}><Link to={t.link ?? '/tasks'} className="block text-[13px] hover:underline"><span className="font-medium text-ink-900">{t.title}</span><span className="block text-[11.5px] text-ink-500">{t.projectCode ?? '—'}{t.dueDate && ` · due ${fmtDate(t.dueDate)}`} · from {t.createdByName}</span></Link></li>)}</ul>}
          </Card>
          <Card title={<span className="flex items-center gap-2"><HandCoins size={16} /> Closed grants</span>} description="Stay in the annual and overall dashboards">
            {by(['closed']).length === 0 ? <div className="text-[13px] text-ink-500">None yet.</div> : <ul className="space-y-2">{by(['closed']).map((p) => <li key={p.id}><Link to={`/grants/${p.id}`} className="block text-[13px] hover:underline"><span className="font-medium text-ink-900">{p.title}</span><span className="block text-[11.5px] text-ink-500">{p.code} · {p.donorName} · {fmtMoney(p.awardedAmount ?? 0, p.currency)} · closed {fmtDate(p.closedAt)}{p.outcome === 'not_funded' && ' · not funded'}</span></Link></li>)}</ul>}
          </Card>
        </div>
      </div>
    </>
  )
}

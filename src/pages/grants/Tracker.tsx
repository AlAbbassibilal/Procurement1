import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Tabs, Stat } from '@/components/ui'
import { computeBvA } from '@/lib/budget'
import { STAGE_LABEL, reportLiveStatus, ipttProgress } from '@/lib/grants'
import { fmtMoney, fmtDate, cx } from '@/lib/format'
import { StagePill } from './Overview'
import type { ProjectStage } from '@/types'

export default function GrantsTracker() {
  const nav = useNavigate()
  const { projects: allProjects, budgets, prs, pos, invoices, settings, country } = useStore()
  const projects = allProjects.filter((p) => country === 'all' || p.countries.includes(country))
  const [tab, setTab] = useState<'pipeline' | 'active' | 'closed' | 'all'>('all')
  const ccy = settings.defaultCurrency
  const stages: Record<typeof tab, ProjectStage[]> = { pipeline: ['development', 'submitted'], active: ['granted', 'active'], closed: ['closed'], all: ['development', 'submitted', 'granted', 'active', 'closed'] }
  const rows = projects.filter((p) => stages[tab].includes(p.stage)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const row = (p: typeof projects[number]) => { const b = budgets.find((x) => x.id === p.budgetId); const t = b ? computeBvA(b, prs, pos, invoices).totals : undefined; const next = p.reports.filter((r) => !['submitted', 'approved'].includes(r.status)).sort((a, c) => a.dueDate.localeCompare(c.dueDate))[0]; return { b, t, next, nextLive: next ? reportLiveStatus(next) : undefined, ip: ipttProgress(p) } }
  const years = [...new Set(projects.flatMap((p) => [p.grantedAt, p.submittedAt, p.closedAt].filter(Boolean).map((d) => d!.slice(0, 4))))].sort().reverse()
  const exportXlsx = () => {
    const aoa = [['Project code', 'Title', 'Donor', 'Stage', 'Outcome', 'Currency', 'Requested', 'Awarded', 'Start', 'End', 'Manager', 'Submitted', 'Granted', 'Closed', 'Spent + committed', 'Burn %', 'IPTT %', 'Next report', 'Next report due'], ...projects.map((p) => { const r = row(p); return [p.code, p.title, p.donorName, STAGE_LABEL[p.stage], p.outcome ?? '', p.currency, p.requestedAmount ?? '', p.awardedAmount ?? '', p.startDate ?? '', p.endDate ?? '', p.managerName ?? '', p.submittedAt?.slice(0, 10) ?? '', p.grantedAt?.slice(0, 10) ?? '', p.closedAt?.slice(0, 10) ?? '', r.t ? r.t.actual + r.t.commitments : '', r.t?.burnWithCommitPct ?? '', r.ip.pct, r.next?.title ?? '', r.next?.dueDate ?? ''] })]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Grants tracker'); XLSX.writeFile(wb, `Grants-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  return (
    <>
      <PageHeader title="Grants tracker" subtitle="Pipeline, active and closed grants in one register, with the annual view used for review meetings."
        actions={<><button className="btn-secondary" onClick={exportXlsx}><Download size={15} /> Export</button><Link to="/grants/new" className="btn-primary"><Plus size={15} /> New project</Link></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {years.slice(0, 4).map((y) => { const granted = projects.filter((p) => p.grantedAt?.startsWith(y)); const submitted = projects.filter((p) => p.submittedAt?.startsWith(y)); return <Stat key={y} label={`${y} · ${submitted.length} submitted · ${granted.length} granted`} value={fmtMoney(granted.reduce((s, p) => s + (p.awardedAmount ?? 0), 0), ccy)} hint={`success rate ${submitted.length ? Math.round((granted.length / submitted.length) * 100) : 0}% · ${projects.filter((p) => p.closedAt?.startsWith(y)).length} closed`} tone={y === String(new Date().getFullYear()) ? 'brand' : 'default'} /> })}
      </div>
      <Tabs tabs={[{ id: 'all', label: 'All', count: projects.length }, { id: 'pipeline', label: 'Pipeline', count: projects.filter((p) => stages.pipeline.includes(p.stage)).length }, { id: 'active', label: 'Active', count: projects.filter((p) => stages.active.includes(p.stage)).length }, { id: 'closed', label: 'Closed', count: projects.filter((p) => p.stage === 'closed').length }]} value={tab} onChange={setTab} />
      <div className="mt-5"><Card padded={false}>
        <div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[1100px] text-[13px]">
          <thead><tr><th className="table-th">Project</th><th className="table-th">Donor</th><th className="table-th">Stage</th><th className="table-th">Period</th><th className="table-th text-right">Requested</th><th className="table-th text-right">Awarded</th><th className="table-th text-right">Spent + committed</th><th className="table-th">IPTT</th><th className="table-th">Next report</th><th className="table-th">Manager</th></tr></thead>
          <tbody>{rows.map((p) => { const r = row(p); return (
            <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/grants/${p.id}`)}>
              <td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.code}</div></td>
              <td className="table-td text-ink-600">{p.donorName}</td>
              <td className="table-td"><StagePill stage={p.stage} />{p.outcome === 'not_funded' && <div className="text-[11px] text-accent-700">not funded</div>}</td>
              <td className="table-td whitespace-nowrap text-ink-600">{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</td>
              <td className="table-td text-right tabular-nums">{p.requestedAmount ? fmtMoney(p.requestedAmount, p.currency) : '—'}</td>
              <td className="table-td text-right tabular-nums font-medium">{p.awardedAmount ? fmtMoney(p.awardedAmount, p.currency) : '—'}</td>
              <td className="table-td text-right tabular-nums">{r.t ? <>{fmtMoney(r.t.actual + r.t.commitments, p.currency)} <span className={cx('text-[11px]', (r.t.burnWithCommitPct) > 90 ? 'text-accent-700' : 'text-ink-500')}>({r.t.burnWithCommitPct}%)</span></> : '—'}</td>
              <td className="table-td"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-brand-600" style={{ width: `${r.ip.pct}%` }} /></div><span className="tabular-nums">{r.ip.pct}%</span></div></td>
              <td className="table-td text-[12px]">{r.next ? <><span className={cx(r.nextLive === 'overdue' ? 'text-accent-700 font-medium' : r.nextLive === 'due' ? 'text-sun-700 font-medium' : 'text-ink-700')}>{r.next.title}</span><div className="text-ink-500">{fmtDate(r.next.dueDate)}</div></> : <span className="text-ink-400">—</span>}</td>
              <td className="table-td text-ink-600">{p.managerName}</td>
            </tr>) })}
            {rows.length === 0 && <tr><td colSpan={10} className="px-5 py-8 text-center text-ink-500">No projects in this view.</td></tr>}
          </tbody>
        </table></div>
      </Card></div>
    </>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Download, Wand2, Upload, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, Field, Alert } from '@/components/ui'
import { newLogframeRow, newIndicator, allIndicators, monthsOf, monthLabel, weekKeys, generateSpendingPlan, planTotal, ipttAchieved, exportBudgetTemplate, exportIPTT, exportWorkplan, exportLogframeDocx, download } from '@/lib/grants'
import { fmtMoney, uid, cx } from '@/lib/format'
import { isSalaryLine, headcount, unassignedSalaryLines } from '@/lib/salary'
import type { Project, LogframeRow, LogframeIndicator, WorkplanActivity, BudgetLine, ProjectBudget } from '@/types'

const LEVELS: LogframeRow['level'][] = ['goal', 'outcome', 'output', 'activity']
const LEVEL_TONE: Record<LogframeRow['level'], string> = { goal: 'bg-brand-800 text-white', outcome: 'bg-brand-600 text-white', output: 'bg-brand-100 text-brand-800', activity: 'bg-surface-sunken text-ink-700' }

// ---------------------------------------------------------------------------
// Logframe (Annex 2)
// ---------------------------------------------------------------------------
export function LogframeTab({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const { updateProject, settings } = useStore()
  const setRows = (rows: LogframeRow[]) => updateProject(p.id, { logframe: rows })
  const setRow = (id: string, patch: Partial<LogframeRow>) => setRows(p.logframe.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const setInd = (rid: string, iid: string, patch: Partial<LogframeIndicator>) => setRows(p.logframe.map((r) => (r.id === rid ? { ...r, indicators: r.indicators.map((i) => (i.id === iid ? { ...i, ...patch } : i)) } : r)))
  const add = (level: LogframeRow['level']) => { const n = p.logframe.filter((r) => r.level === level).length + 1; const code = level === 'goal' ? 'Goal' : level === 'outcome' ? `Outcome ${n}` : level === 'output' ? `Output ${n}` : `Activity ${n}`; setRows([...p.logframe, newLogframeRow(level, code)]) }
  const addInd = (r: LogframeRow) => { const n = r.indicators.length + 1; const base = r.code.replace(/^\D+/, '') || '1'; setRow(r.id, { indicators: [...r.indicators, newIndicator(`${base}.${n}`, r.level === 'outcome' || r.level === 'goal' ? 'outcome' : 'output')] }) }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-600">{p.logframe.length} result(s) · {allIndicators(p.logframe).length} indicator(s). Indicators and targets feed the IPTT automatically at submission.</div>
        <div className="flex flex-wrap gap-2">{canEdit && LEVELS.map((l) => <button key={l} className="btn-secondary btn-sm" onClick={() => add(l)}><Plus size={13} /> {l}</button>)}<button className="btn-primary btn-sm" onClick={async () => download(await exportLogframeDocx(p, settings), `${p.code}-Annex2-Logframe.docx`)}><Download size={13} /> Download Annex 2 (Word)</button></div>
      </div>
      {p.logframe.length === 0 && <Alert tone="info">Build the results chain: Goal → Outcomes → Outputs → Activities. Each row carries its narrative, indicators with baseline/target, means of verification and assumptions — exactly the Annex 2 columns.</Alert>}
      {p.logframe.map((r) => (
        <Card key={r.id} padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
            <span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-bold uppercase', LEVEL_TONE[r.level])}>{r.level}</span>
            <input className="input w-36 font-semibold" value={r.code} disabled={!canEdit} onChange={(e) => setRow(r.id, { code: e.target.value })} />
            <input className="input flex-1 min-w-[240px]" placeholder="Narrative summary" value={r.narrative} disabled={!canEdit} onChange={(e) => setRow(r.id, { narrative: e.target.value })} />
            {canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Remove this result and its indicators?') && setRows(p.logframe.filter((x) => x.id !== r.id))}><Trash2 size={13} /></button>}
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-1 flex items-center justify-between"><div className="label mb-0">Indicators & targets</div>{canEdit && <button className="btn-ghost btn-sm" onClick={() => addInd(r)}><Plus size={12} /> Indicator</button>}</div>
              {r.indicators.length === 0 ? <div className="text-[12px] text-ink-400">No indicators{r.level === 'activity' ? ' (activities usually carry none)' : ''}.</div> : (
                <div className="space-y-2">{r.indicators.map((i) => (
                  <div key={i.id} className="rounded-control border border-line p-2">
                    <div className="grid gap-2 sm:grid-cols-12">
                      <input className="input sm:col-span-1 font-mono text-[12px]" value={i.code} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { code: e.target.value })} />
                      <select className="input sm:col-span-2" value={i.type} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { type: e.target.value as LogframeIndicator['type'] })}><option value="impact">Impact</option><option value="outcome">Outcome</option><option value="output">Output</option></select>
                      <input className="input sm:col-span-5" placeholder="Indicator" value={i.text} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { text: e.target.value })} />
                      <input type="number" className="input sm:col-span-1" placeholder="Base" title="Baseline" value={i.baseline} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { baseline: Number(e.target.value) })} />
                      <input type="number" className="input sm:col-span-2" placeholder="Target" title="Target" value={i.target} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { target: Number(e.target.value) })} />
                      <select className="input sm:col-span-1" value={i.unit ?? '#'} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { unit: e.target.value })}><option value="#">#</option><option value="%">%</option></select>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3"><input className="input text-[12px]" placeholder="Means of verification" value={i.mov ?? ''} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { mov: e.target.value })} /><input className="input text-[12px]" placeholder="Definition / how to calculate" value={i.definition ?? ''} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { definition: e.target.value })} /><div className="flex gap-2"><input className="input text-[12px]" placeholder="Disaggregation" value={i.disaggregation ?? ''} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { disaggregation: e.target.value })} /><input className="input text-[12px]" placeholder="Responsible" value={i.responsible ?? ''} disabled={!canEdit} onChange={(e) => setInd(r.id, i.id, { responsible: e.target.value })} />{canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => setRow(r.id, { indicators: r.indicators.filter((x) => x.id !== i.id) })}><Trash2 size={12} /></button>}</div></div>
                  </div>))}</div>
              )}
            </div>
            <div className="space-y-2"><Field label="Means of verification (row)"><textarea className="input min-h-[56px] text-[12.5px]" value={r.mov ?? ''} disabled={!canEdit} onChange={(e) => setRow(r.id, { mov: e.target.value })} /></Field><Field label="Key assumptions"><textarea className="input min-h-[56px] text-[12.5px]" value={r.assumptions ?? ''} disabled={!canEdit} onChange={(e) => setRow(r.id, { assumptions: e.target.value })} /></Field></div>
          </div>
        </Card>))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Work plan (weeks grid)
// ---------------------------------------------------------------------------
export function WorkplanTab({ p, budget, canEdit }: { p: Project; budget?: ProjectBudget; canEdit: boolean }) {
  const { updateProject, users } = useStore()
  const months = monthsOf(p.startDate, p.endDate)
  const [newSection, setNewSection] = useState('')
  const setActs = (a: WorkplanActivity[]) => updateProject(p.id, { workplan: a })
  const setA = (id: string, patch: Partial<WorkplanActivity>) => setActs(p.workplan.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const sections = [...new Set(p.workplan.map((a) => a.section))]
  const addActivity = (section: string) => setActs([...p.workplan, { id: uid('wp_'), section, title: 'New activity', status: 'planned', weeks: {}, progress: 0 }])
  const toggle = (a: WorkplanActivity, key: string) => { if (!canEdit) return; const cur = a.weeks[key]; const next = cur === undefined ? 'P' : cur === 'P' ? 'O' : cur === 'O' ? 'C' : undefined; const weeks = { ...a.weeks }; if (next) weeks[key] = next; else delete weeks[key]; setA(a.id, { weeks }) }
  const CELL: Record<string, string> = { P: 'bg-info-50 text-info-700', O: 'bg-sun-100 text-sun-700', C: 'bg-brand-600 text-white' }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[12.5px] text-ink-600"><span>Key:</span><span className="rounded px-2 py-0.5 bg-brand-600 text-white">C Completed</span><span className="rounded px-2 py-0.5 bg-sun-100 text-sun-700">O Ongoing</span><span className="rounded px-2 py-0.5 bg-info-50 text-info-700">P Planned</span><span className="text-ink-400">· click a week cell to cycle</span></div>
        <div className="flex gap-2">{canEdit && <div className="flex gap-1"><input className="input w-56" placeholder="New section (e.g. SECTION 1: PREPARATORY PHASE)" value={newSection} onChange={(e) => setNewSection(e.target.value)} /><button className="btn-secondary btn-sm" disabled={!newSection.trim()} onClick={() => { addActivity(newSection.trim().toUpperCase()); setNewSection('') }}><Plus size={13} /> Section</button></div>}<button className="btn-primary btn-sm" onClick={() => exportWorkplan(p)}><Download size={13} /> Download work plan (Excel)</button></div>
      </div>
      <Card padded={false}>
        <div className="overflow-x-auto scrollbar-thin"><table className="w-full text-[12.5px]" style={{ minWidth: 640 + months.length * 4 * 26 }}>
          <thead>
            <tr><th className="table-th sticky left-0 z-10 bg-surface-muted min-w-[260px]">Project's activities</th><th className="table-th min-w-[90px]">Budget line</th><th className="table-th min-w-[110px]">Status</th><th className="table-th min-w-[70px]">%</th><th className="table-th min-w-[120px]">Responsible</th>{months.map((m) => <th key={m} colSpan={4} className="table-th border-l border-line text-center">{monthLabel(m)}</th>)}</tr>
            <tr><th className="sticky left-0 z-10 bg-surface-muted" /><th /><th /><th /><th />{months.flatMap((m) => [1, 2, 3, 4].map((w) => <th key={m + w} className={cx('px-0 py-1 text-center text-[9.5px] font-medium text-ink-400', w === 1 && 'border-l border-line')}>W{w}</th>))}</tr>
          </thead>
          <tbody>
            {sections.map((sec) => (<SectionRows key={sec} sec={sec} />))}
            {p.workplan.length === 0 && <tr><td colSpan={5 + months.length * 4} className="px-5 py-8 text-center text-ink-500">No activities yet. Add a section, then activities under it.</td></tr>}
          </tbody>
        </table></div>
      </Card>
    </div>
  )
  function SectionRows({ sec }: { sec: string }) {
    return (<>
      <tr className="bg-surface-muted"><td className="sticky left-0 z-10 bg-surface-muted px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-ink-700" colSpan={5}>{sec}{canEdit && <button className="btn-ghost btn-sm ml-2" onClick={() => addActivity(sec)}><Plus size={12} /> activity</button>}</td><td colSpan={months.length * 4} /></tr>
      {p.workplan.filter((a) => a.section === sec).map((a) => (
        <tr key={a.id} className="border-t border-line">
          <td className="sticky left-0 z-10 bg-surface px-3 py-1"><div className="flex items-center gap-1"><input className="input text-[12.5px]" value={a.title} disabled={!canEdit} onChange={(e) => setA(a.id, { title: e.target.value })} />{canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => setActs(p.workplan.filter((x) => x.id !== a.id))}><Trash2 size={12} /></button>}</div></td>
          <td className="px-2 py-1"><select className="input text-[12px]" value={a.budgetLine ?? ''} disabled={!canEdit} onChange={(e) => setA(a.id, { budgetLine: e.target.value })}><option value="">—</option>{(budget?.lines ?? []).map((l) => <option key={l.id} value={l.code}>{l.code}</option>)}<option value="HR">HR</option><option value="MEAL">MEAL</option><option value="Admin">Admin</option></select></td>
          <td className="px-2 py-1"><select className={cx('input text-[12px]', a.status === 'completed' && 'text-brand-700', a.status === 'ongoing' && 'text-sun-700')} value={a.status} disabled={!canEdit} onChange={(e) => setA(a.id, { status: e.target.value as WorkplanActivity['status'], progress: e.target.value === 'completed' ? 100 : a.progress })}><option value="planned">Planned</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></td>
          <td className="px-2 py-1"><input type="number" min={0} max={100} className="input text-[12px]" value={a.progress} disabled={!canEdit} onChange={(e) => setA(a.id, { progress: Number(e.target.value) })} /></td>
          <td className="px-2 py-1"><select className="input text-[12px]" value={a.responsibleId ?? ''} disabled={!canEdit} onChange={(e) => setA(a.id, { responsibleId: e.target.value || undefined })}><option value="">—</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>)}</select></td>
          {months.flatMap((m) => weekKeys(m).map((k, wi) => <td key={k} className={cx('h-7 w-[26px] cursor-pointer border-b border-line text-center text-[10px] font-bold', wi === 0 && 'border-l', a.weeks[k] ? CELL[a.weeks[k]!] : 'hover:bg-surface-muted')} onClick={() => toggle(a, k)}>{a.weeks[k] ?? ''}</td>))}
        </tr>))}
    </>)
  }
}

// ---------------------------------------------------------------------------
// Budget (RHS template lines) — editable while under development
// ---------------------------------------------------------------------------
export function BudgetTab({ p, budget, canEdit }: { p: Project; budget?: ProjectBudget; canEdit: boolean }) {
  const { upsertBudget, settings, masterBudgets, setBudgetLineMaster, staff } = useStore()
  const staffOpts = [...staff].filter((x) => x.status !== 'left').sort((a, b) => a.rhsNumber.localeCompare(b.rhsNumber))
  const mb = [...masterBudgets].sort((a, b) => b.year - a.year)[0]
  const masterOpts = mb ? [...mb.lines].sort((a, b) => a.code.localeCompare(b.code)) : []
  if (!budget) return <Alert tone="warning">No budget record is attached to this project.</Alert>
  const locked = budget.status !== 'draft'
  const lines = budget.lines
  const set = (ls: BudgetLine[]) => upsertBudget({ ...budget, lines: ls })
  const setL = (id: string, patch: Partial<BudgetLine>) => set(lines.map((l) => { if (l.id !== id) return l; const n = { ...l, ...patch }; if (['units', 'frequency', 'unitCost', 'pct'].some((k) => k in patch)) n.amount = Math.round((n.units ?? 1) * (n.frequency ?? 1) * (n.unitCost ?? 0) * (n.pct ?? 1) * 100) / 100; return n }))
  const add = (costType: 'direct' | 'admin') => { const n = lines.filter((l) => l.costType === costType).length + 1; set([...lines, { id: uid('bl_'), code: `${costType === 'direct' ? 'D' : 'A'}-${String(n).padStart(2, '0')}`, description: '', category: costType === 'direct' ? 'A. Personnel (Direct Cost)' : 'A. Amman Support Personnel (Indirect / Admin)', amount: 0, costType, units: 1, frequency: 1, unitCost: 0, pct: 1, unit: 'Person' }]) }
  const direct = lines.filter((l) => l.costType !== 'admin').reduce((s, l) => s + l.amount, 0), admin = lines.filter((l) => l.costType === 'admin').reduce((s, l) => s + l.amount, 0)
  const open = unassignedSalaryLines(lines)
  /** Salary lines: one RHS number per unit, or "new position" (joins the master salary plan when the project is granted). */
  const renderStaffCell = (l: BudgetLine, locked: boolean) => {
    const salary = isSalaryLine(l)
    if (!salary) return <button className="text-[11px] text-ink-400 hover:text-brand-700 hover:underline" disabled={locked} onClick={() => setL(l.id, { kind: 'salary' })} title="Treat this line as a salary line">not a salary line{!locked && ' · mark as salary'}</button>
    const n = headcount(l); const ids = l.staffIds ?? []
    if (l.newStaff) return <div className="flex items-center gap-1"><span className="rounded-pill bg-sun-100 px-2 py-0.5 text-[11px] font-semibold text-sun-700">New position{n > 1 ? ` ×${n}` : ''} — to recruit</span>{!locked && <button className="text-[11px] text-ink-400 hover:underline" onClick={() => setL(l.id, { newStaff: false })}>change</button>}</div>
    return (
      <div className="space-y-1">
        {Array.from({ length: n }, (_, i) => { const cur = ids[i] ?? ''; const st = staff.find((x) => x.id === cur); return (
          <select key={i} className={cx('input text-[11.5px]', cur ? 'text-brand-800' : 'border-sun-300 bg-sun-50 text-sun-700')} disabled={locked} value={cur} title={st ? `${st.rhsNumber} · ${st.name || '(to recruit)'} · ${st.position}` : 'Assign the staff member this line pays'}
            onChange={(e) => { const v = e.target.value; if (v === '__new') return setL(l.id, { kind: 'salary', newStaff: true, staffIds: [] }); if (v === '__none') return setL(l.id, { kind: 'other', newStaff: false, staffIds: [] }); const next = [...ids]; next[i] = v; setL(l.id, { kind: 'salary', staffIds: next.filter(Boolean) }) }}>
            <option value="">— assign staff (RHS no.) —</option>
            <option value="__new">New position — to recruit</option>
            {staffOpts.map((x) => <option key={x.id} value={x.id}>{x.rhsNumber} · {x.name || '(to recruit)'} · {x.position.slice(0, 26)}</option>)}
            {i === 0 && <option value="__none">Not a salary line</option>}
          </select>) })}
      </div>
    )
  }
  const renderSection = (costType: 'direct' | 'admin', title: string) => (
    <Card title={title} description={costType === 'admin' ? `Indirect / admin · ${direct ? Math.round((admin / direct) * 100) : 0}% of direct (ceiling ${15}%)` : 'Direct costs by section'} padded={false} actions={canEdit && !locked && <button className="btn-secondary btn-sm" onClick={() => add(costType)}><Plus size={13} /> Line</button>}>
      <div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[1680px] text-[12.5px]">
        <thead><tr><th className="table-th w-20">Code</th><th className="table-th w-24">Activity</th><th className="table-th w-20">Acct</th><th className="table-th w-24">Location</th><th className="table-th">Position / line item</th><th className="table-th w-40">Section</th><th className="table-th w-20">Unit</th><th className="table-th w-16"># units</th><th className="table-th w-16">Freq</th><th className="table-th w-24">Unit cost</th><th className="table-th w-16">{costType === 'direct' ? 'LoE %' : '% alloc'}</th><th className="table-th w-28 text-right">Total ({budget.currency})</th><th className="table-th w-56">Staff · RHS no.</th><th className="table-th w-44">Master line (MB)</th><th className="table-th w-8" /></tr></thead>
        <tbody>{lines.filter((l) => (l.costType ?? 'direct') === costType).map((l) => (
          <tr key={l.id}><td className="table-td"><input className="input font-mono text-[12px]" value={l.code} disabled={locked} onChange={(e) => setL(l.id, { code: e.target.value })} /></td><td className="table-td"><input className="input text-[12px]" value={l.activityCode ?? ''} disabled={locked} onChange={(e) => setL(l.id, { activityCode: e.target.value })} /></td><td className="table-td"><input className="input text-[12px]" value={l.accountNo ?? ''} disabled={locked} onChange={(e) => setL(l.id, { accountNo: e.target.value })} /></td><td className="table-td"><input className="input text-[12px]" value={l.location ?? ''} disabled={locked} onChange={(e) => setL(l.id, { location: e.target.value })} /></td><td className="table-td"><input className="input text-[12px]" value={l.description} disabled={locked} onChange={(e) => setL(l.id, { description: e.target.value })} /></td><td className="table-td"><input className="input text-[12px]" value={l.category ?? ''} disabled={locked} onChange={(e) => setL(l.id, { category: e.target.value })} /></td><td className="table-td"><input className="input text-[12px]" value={l.unit ?? ''} disabled={locked} onChange={(e) => setL(l.id, { unit: e.target.value })} /></td><td className="table-td"><input type="number" className="input text-[12px]" value={l.units ?? 1} disabled={locked} onChange={(e) => setL(l.id, { units: Number(e.target.value) })} /></td><td className="table-td"><input type="number" className="input text-[12px]" value={l.frequency ?? 1} disabled={locked} onChange={(e) => setL(l.id, { frequency: Number(e.target.value) })} /></td><td className="table-td"><input type="number" className="input text-[12px]" value={l.unitCost ?? 0} disabled={locked} onChange={(e) => setL(l.id, { unitCost: Number(e.target.value) })} /></td><td className="table-td"><input type="number" step="0.05" className="input text-[12px]" value={l.pct ?? 1} disabled={locked} onChange={(e) => setL(l.id, { pct: Number(e.target.value) })} /></td><td className="table-td text-right font-medium tabular-nums">{fmtMoney(l.amount, budget.currency)}</td><td className="table-td">{renderStaffCell(l, locked)}</td><td className="table-td"><select className={cx('input text-[11.5px]', l.masterLineId ? 'text-brand-800' : 'text-ink-400')} value={l.masterLineId ?? ''} disabled={!canEdit} title={masterOpts.find((m) => m.id === l.masterLineId)?.accountName} onChange={(e) => setBudgetLineMaster(budget.id, l.id, e.target.value || undefined)}><option value="">— not a running cost —</option>{masterOpts.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.accountName.slice(0, 28)}</option>)}</select></td><td className="table-td">{!locked && <button className="btn-ghost btn-sm text-accent-700" onClick={() => set(lines.filter((x) => x.id !== l.id))}><Trash2 size={12} /></button>}</td></tr>))}
        </tbody>
        <tfoot><tr className="bg-surface-muted"><td colSpan={11} className="px-4 py-2 text-right text-[11.5px] uppercase text-ink-500">Total {costType}</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtMoney(costType === 'direct' ? direct : admin, budget.currency)}</td><td className="px-4 py-2 text-[11px] text-ink-500">{lines.filter((l) => (l.costType ?? 'direct') === costType && l.masterLineId).length} mapped to master</td><td /></tr></tfoot>
      </table></div>
    </Card>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-600">{mb && <span className="mr-2 rounded-pill bg-info-50 px-2 py-0.5 text-[11.5px] text-info-700">Master budget {mb.year}: map each running-cost line to its MB code</span>}{locked ? <span className="text-brand-700 font-medium">Approved budget — locked. Changes go through a budget revision with the donor; spending is tracked in <Link to={`/budgets/${budget.id}`} className="underline">Budget vs Actual</Link>.</span> : 'Edit lines directly; totals recalculate from units × frequency × unit cost × %.'}</div>
        <div className="flex gap-2">{!locked && <Link to="/budgets/upload" className="btn-secondary btn-sm"><Upload size={13} /> Import from template</Link>}<Link to={`/budgets/${budget.id}`} className="btn-secondary btn-sm">Budget vs Actual</Link><button className="btn-primary btn-sm" onClick={() => exportBudgetTemplate(p, budget, settings)}><Download size={13} /> Download budget (RHS template)</button></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="card px-4 py-3"><div className="text-[11px] uppercase tracking-[0.05em] text-ink-500">Direct cost</div><div className="text-[18px] font-semibold">{fmtMoney(direct, budget.currency)}</div></div><div className="card px-4 py-3"><div className="text-[11px] uppercase tracking-[0.05em] text-ink-500">Admin / indirect</div><div className="text-[18px] font-semibold">{fmtMoney(admin, budget.currency)}</div></div><div className="card border-brand-200 px-4 py-3"><div className="text-[11px] uppercase tracking-[0.05em] text-ink-500">Total project budget</div><div className="text-[18px] font-semibold text-brand-800">{fmtMoney(direct + admin, budget.currency)}</div></div></div>
      {open.length > 0 && <Alert tone="warning">Salary lines need a staff RHS number or the "new position" flag before the proposal can be submitted: <b>{open.map((l) => l.code).join(', ')}</b>. New positions are added to the <Link to="/finance/salary-plan" className="underline">master salary plan</Link> when the project is granted.</Alert>}
      {renderSection('direct', 'Direct Cost')}{renderSection('admin', 'Admin / Indirect Cost')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spending plan (lines × months)
// ---------------------------------------------------------------------------
export function SpendingTab({ p, budget, canEdit }: { p: Project; budget?: ProjectBudget; canEdit: boolean }) {
  const { updateProject } = useStore()
  const months = monthsOf(p.startDate, p.endDate)
  const lines = budget?.lines ?? []
  const get = (code: string, m: string) => p.spendingPlan.find((e) => e.lineCode === code && e.period === m)?.amount ?? 0
  const setCell = (code: string, m: string, v: number) => updateProject(p.id, { spendingPlan: [...p.spendingPlan.filter((e) => !(e.lineCode === code && e.period === m)), { lineCode: code, period: m, amount: v }] })
  const regen = () => confirm('Spread each budget line evenly over the project months? Existing figures will be replaced.') && updateProject(p.id, { spendingPlan: generateSpendingPlan(lines, months) })
  const exportX = async () => { const X = await import('xlsx'); const aoa = [['Line', 'Description', 'Budget', ...months.map(monthLabel), 'Planned total', 'Variance'], ...lines.map((l) => { const row = months.map((m) => get(l.code, m)); const t = row.reduce((s, x) => s + x, 0); return [l.code, l.description, l.amount, ...row, t, l.amount - t] }), ['TOTAL', '', lines.reduce((s, l) => s + l.amount, 0), ...months.map((m) => planTotal(p.spendingPlan, (e) => e.period === m)), planTotal(p.spendingPlan), lines.reduce((s, l) => s + l.amount, 0) - planTotal(p.spendingPlan)]]; const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Spending plan'); X.writeFile(wb, `${p.code}-Spending-plan.xlsx`) }
  const total = planTotal(p.spendingPlan), budgetTotal = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-600">Planned {fmtMoney(total, p.currency)} of {fmtMoney(budgetTotal, p.currency)} budget{Math.abs(total - budgetTotal) > 1 && <span className={total > budgetTotal ? 'text-accent-700' : 'text-sun-700'}> · {total > budgetTotal ? 'over' : 'unallocated'} {fmtMoney(Math.abs(budgetTotal - total), p.currency)}</span>}. Monthly plan feeds the BvA forecast.</div>
        <div className="flex gap-2">{canEdit && <button className="btn-secondary btn-sm" onClick={regen}><RefreshCw size={13} /> Spread evenly</button>}<button className="btn-primary btn-sm" onClick={exportX}><Download size={13} /> Download (Excel)</button></div>
      </div>
      <Card padded={false}><div className="overflow-x-auto scrollbar-thin"><table className="w-full text-[12px]" style={{ minWidth: 420 + months.length * 86 }}>
        <thead><tr><th className="table-th sticky left-0 z-10 bg-surface-muted min-w-[220px]">Budget line</th><th className="table-th text-right">Budget</th>{months.map((m) => <th key={m} className="table-th text-right">{monthLabel(m)}</th>)}<th className="table-th text-right">Planned</th><th className="table-th text-right">Var.</th></tr></thead>
        <tbody>{lines.map((l) => { const t = months.reduce((s, m) => s + get(l.code, m), 0); return (
          <tr key={l.id} className="border-t border-line"><td className="sticky left-0 z-10 bg-surface px-3 py-1"><span className="font-mono text-[11px] text-brand-700">{l.code}</span> <span className="text-ink-800">{l.description.slice(0, 40)}</span></td><td className="px-2 py-1 text-right tabular-nums">{l.amount.toLocaleString()}</td>{months.map((m) => <td key={m} className="px-1 py-0.5"><input type="number" className="input px-1 py-0.5 text-right text-[12px]" value={get(l.code, m) || ''} placeholder="0" disabled={!canEdit} onChange={(e) => setCell(l.code, m, Number(e.target.value))} /></td>)}<td className="px-2 py-1 text-right font-medium tabular-nums">{t.toLocaleString()}</td><td className={cx('px-2 py-1 text-right tabular-nums', Math.abs(l.amount - t) > 1 && 'text-accent-700')}>{(l.amount - t).toLocaleString()}</td></tr>) })}</tbody>
        <tfoot><tr className="bg-surface-muted font-semibold"><td className="sticky left-0 z-10 bg-surface-muted px-3 py-1.5">TOTAL</td><td className="px-2 py-1.5 text-right tabular-nums">{budgetTotal.toLocaleString()}</td>{months.map((m) => <td key={m} className="px-2 py-1.5 text-right tabular-nums">{planTotal(p.spendingPlan, (e) => e.period === m).toLocaleString()}</td>)}<td className="px-2 py-1.5 text-right tabular-nums">{total.toLocaleString()}</td><td className="px-2 py-1.5 text-right tabular-nums">{(budgetTotal - total).toLocaleString()}</td></tr></tfoot>
      </table></div></Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// IPTT (indicators × months, M/F/O)
// ---------------------------------------------------------------------------
export function IPTTTab({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const { updateProject } = useStore()
  const inds = allIndicators(p.logframe); const months = monthsOf(p.startDate, p.endDate)
  const [period, setPeriod] = useState(months.find((m) => m === new Date().toISOString().slice(0, 7)) ?? months[0]!)
  const entry = (id: string, m: string) => p.iptt.find((e) => e.indicatorId === id && e.period === m)
  const setE = (id: string, m: string, patch: Partial<{ male: number; female: number; other: number; note: string }>) => { const cur = entry(id, m) ?? { indicatorId: id, period: m, male: 0, female: 0, other: 0 }; updateProject(p.id, { iptt: [...p.iptt.filter((e) => !(e.indicatorId === id && e.period === m)), { ...cur, ...patch }] }) }
  if (!inds.length) return <Alert tone="info">The IPTT is generated from the logframe indicators — add indicators and targets on the Logframe tab. It is filled in automatically when the proposal is submitted{p.stage === 'development' ? ' (you can also preview it now)' : ''}.</Alert>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] text-ink-600"><span>Enter achievements for</span><select className="input w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>{p.ipttGeneratedAt && <span className="text-[12px] text-ink-400">· indicators synced from the logframe</span>}</div>
        <button className="btn-primary btn-sm" onClick={() => exportIPTT(p)}><Download size={13} /> Download IPTT (Excel)</button>
      </div>
      <Card padded={false}><div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[1100px] text-[12.5px]">
        <thead><tr><th className="table-th w-16">#</th><th className="table-th">Indicator</th><th className="table-th w-20 text-right">Baseline</th><th className="table-th w-20 text-right">Target</th><th className="table-th w-24 text-right">Achieved</th><th className="table-th w-40">% progress</th><th className="table-th w-20 bg-brand-50">Male</th><th className="table-th w-20 bg-brand-50">Female</th><th className="table-th w-20 bg-brand-50">Other</th><th className="table-th bg-brand-50">Note ({monthLabel(period)})</th></tr></thead>
        <tbody>{inds.map((i) => { const ach = ipttAchieved(p, i.id); const pct = i.target ? Math.min(100, Math.round((ach / i.target) * 100)) : 0; const e = entry(i.id, period); return (
          <tr key={i.id} className="border-t border-line"><td className="table-td font-mono text-[11.5px] text-brand-700">{i.code}</td><td className="table-td"><div className="font-medium text-ink-900">{i.text}</div><div className="text-[11px] text-ink-500">{i.type}{i.mov ? ` · ${i.mov}` : ''}</div></td><td className="table-td text-right tabular-nums">{i.baseline}</td><td className="table-td text-right tabular-nums">{i.target}{i.unit === '%' && '%'}</td><td className="table-td text-right font-semibold tabular-nums">{ach}{i.unit === '%' && '%'}</td><td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', pct >= 75 ? 'bg-brand-600' : pct >= 40 ? 'bg-sun-500' : 'bg-accent-600')} style={{ width: `${pct}%` }} /></div><span className="w-9 text-right tabular-nums">{pct}%</span></div></td>
            <td className="table-td bg-brand-50/40"><input type="number" className="input text-[12px]" value={e?.male ?? ''} placeholder="0" disabled={!canEdit} onChange={(ev) => setE(i.id, period, { male: Number(ev.target.value) })} /></td><td className="table-td bg-brand-50/40"><input type="number" className="input text-[12px]" value={e?.female ?? ''} placeholder="0" disabled={!canEdit} onChange={(ev) => setE(i.id, period, { female: Number(ev.target.value) })} /></td><td className="table-td bg-brand-50/40"><input type="number" className="input text-[12px]" value={e?.other ?? ''} placeholder="0" disabled={!canEdit} onChange={(ev) => setE(i.id, period, { other: Number(ev.target.value) })} /></td><td className="table-td bg-brand-50/40"><input className="input text-[12px]" value={e?.note ?? ''} disabled={!canEdit} onChange={(ev) => setE(i.id, period, { note: ev.target.value })} /></td></tr>) })}</tbody>
      </table></div></Card>
      <Card title="Achievement by month" padded={false}><div className="overflow-x-auto scrollbar-thin"><table className="w-full text-[12px]" style={{ minWidth: 300 + months.length * 70 }}><thead><tr><th className="table-th sticky left-0 bg-surface-muted">Indicator</th>{months.map((m) => <th key={m} className="table-th text-right">{monthLabel(m)}</th>)}<th className="table-th text-right">Total</th></tr></thead><tbody>{inds.map((i) => <tr key={i.id} className="border-t border-line"><td className="sticky left-0 bg-surface px-3 py-1 font-mono text-[11px] text-brand-700">{i.code}</td>{months.map((m) => { const e = entry(i.id, m); const v = e ? e.male + e.female + e.other : 0; return <td key={m} className={cx('px-2 py-1 text-right tabular-nums', v ? 'text-ink-900' : 'text-ink-300')}>{v || '·'}</td> })}<td className="px-2 py-1 text-right font-semibold tabular-nums">{ipttAchieved(p, i.id)}</td></tr>)}</tbody></table></div></Card>
      {canEdit && <div className="text-[12px] text-ink-500"><Wand2 size={12} className="mr-1 inline" />Disaggregation follows the Annex IPTT (Male / Female / Other per month); totals, achieved and % progress are computed, and the Excel export carries the same formulas.</div>}
    </div>
  )
}

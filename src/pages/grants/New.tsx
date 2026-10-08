import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderPlus } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { SECTORS, DEFAULT_SECTIONS, STAGE_LABEL, STAGE_DESC } from '@/lib/grants'
import { uid } from '@/lib/format'
import type { Currency } from '@/types'

export default function ProjectNew() {
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { donors, users, projects, createProject, settings } = useStore()
  const year = new Date().getFullYear()
  const [f, setF] = useState({ code: `RH-${year}-${String(projects.length + 10).padStart(4, '0')}`, title: '', summary: '', donorId: '', donorName: '', currency: settings.defaultCurrency as Currency, startDate: '', endDate: '', duration: '', locations: '', sectors: [] as string[], managerId: user.id, teamIds: [] as string[], submissionDeadline: '', requestedAmount: '' })
  const [err, setErr] = useState<string | null>(null)
  const create = () => {
    if (!f.code.trim() || !f.title.trim()) return setErr('Project code and title are required.')
    if (projects.some((p) => p.code.toLowerCase() === f.code.trim().toLowerCase())) return setErr('A project with this code already exists.')
    const mgr = users.find((u) => u.id === f.managerId)
    const p = createProject({ code: f.code.trim(), title: f.title.trim(), summary: f.summary, donorId: f.donorId || undefined, donorName: f.donorName || donors.find((d) => d.id === f.donorId)?.name || '', currency: f.currency, startDate: f.startDate || undefined, endDate: f.endDate || undefined, duration: f.duration || undefined, locations: f.locations || undefined, sectors: f.sectors, managerId: f.managerId, managerName: mgr?.name, teamIds: f.teamIds, requestedAmount: f.requestedAmount ? Number(f.requestedAmount) : undefined, proposal: { sections: DEFAULT_SECTIONS.map((t) => ({ id: uid('ps_'), title: t, content: '' })), attachments: [], submissionDeadline: f.submissionDeadline || undefined, submittedTo: donors.find((d) => d.id === f.donorId)?.name, reference: f.code.trim(), version: `${year}_V0.1` } })
    nav(`/grants/${p.id}`)
  }
  return (
    <>
      <PageHeader eyebrow="Grants · new project" title="Open a new project / proposal" subtitle={`Starts under development with its proposal, logframe, work plan and budget workbooks. Prepared by ${user.name} · Owner Bilal Abbassi`}
        actions={<><button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={create}><FolderPlus size={15} /> Create project</button></>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Project identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project code" required hint="Used as the grant / budget code everywhere (requisitions, BvA, reports)"><input className="input font-mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
              <Field label="Donor" required><select className="input" value={f.donorId} onChange={(e) => setF({ ...f, donorId: e.target.value, donorName: donors.find((d) => d.id === e.target.value)?.name ?? '' })}><option value="">Select donor…</option>{donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}<option value="__other">Other / prospective (type below)</option></select>{f.donorId === '__other' && <input className="input mt-2" placeholder="Donor name" value={f.donorName} onChange={(e) => setF({ ...f, donorName: e.target.value })} />}</Field>
              <Field label="Project title" required className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Hands That Heal: Certifying Gaza's Next Generation of Prosthetists" /></Field>
              <Field label="Programme summary" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="One paragraph — what, for whom, where, how many" /></Field>
              <Field label="Locations"><input className="input" value={f.locations} onChange={(e) => setF({ ...f, locations: e.target.value })} placeholder="Gaza (field) & Amman (support)" /></Field>
              <Field label="Duration"><input className="input" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="18 Months" /></Field>
              <Field label="Planned start"><input type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
              <Field label="Planned end"><input type="date" className="input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
              <Field label="Currency"><select className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}><option>USD</option><option>JOD</option><option>EUR</option></select></Field>
              <Field label="Requested amount (optional)" hint="Defaults to the budget total at submission"><input type="number" className="input" value={f.requestedAmount} onChange={(e) => setF({ ...f, requestedAmount: e.target.value })} /></Field>
              <Field label="Submission deadline"><input type="date" className="input" value={f.submissionDeadline} onChange={(e) => setF({ ...f, submissionDeadline: e.target.value })} /></Field>
            </div>
            <div className="mt-4"><div className="label">Sectors</div><div className="flex flex-wrap gap-1.5">{SECTORS.map((s) => <button key={s} type="button" className={`rounded-pill px-2.5 py-1 text-[12px] ring-1 ring-inset ${f.sectors.includes(s) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface text-ink-700 ring-ink-200 hover:bg-surface-muted'}`} onClick={() => setF({ ...f, sectors: f.sectors.includes(s) ? f.sectors.filter((x) => x !== s) : [...f.sectors, s] })}>{s}</button>)}</div></div>
          </Card>
          <Card title="Team">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project manager"><select className="input" value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}</select></Field>
              <div><div className="label">Team members</div><div className="grid gap-1 sm:grid-cols-2">{users.filter((u) => u.active && u.id !== f.managerId).map((u) => <label key={u.id} className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={f.teamIds.includes(u.id)} onChange={(e) => setF({ ...f, teamIds: e.target.checked ? [...f.teamIds, u.id] : f.teamIds.filter((x) => x !== u.id) })} />{u.name}</label>)}</div></div>
            </div>
          </Card>
        </div>
        <Card title="Project cycle" description="Each stage unlocks the next step">
          <ol className="space-y-3">{(['development', 'submitted', 'granted', 'active', 'closed'] as const).map((s, i) => <li key={s} className="flex gap-3 text-[13px]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">{i + 1}</span><span><span className="font-medium text-ink-900">{STAGE_LABEL[s]}</span><span className="block text-[12px] text-ink-500">{STAGE_DESC[s]}</span></span></li>)}</ol>
        </Card>
      </div>
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Plus, Trash2, Search, ArrowRight, ShieldCheck, Clock } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, EmptyState } from '@/components/ui'
import { accessOf } from '@/lib/departments'
import { PARTNER_STAGE_LABEL, PARTNER_TYPE_LABEL, partnerProjects, ddProgress } from '@/lib/partners'
import { cx, fmtDate } from '@/lib/format'
import { PartnerStagePill, DdBar, ProjectChips } from './shared'
import type { Partner, PartnerStage, PartnerType } from '@/types'

const STAGES: (PartnerStage | 'all')[] = ['all', 'identified', 'due_diligence', 'approved', 'agreement', 'active', 'closed', 'declined']

export default function PartnerList() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const tracker = useLocation().pathname.endsWith('due-diligence')
  const { partners, projects, settings, createPartner, deletePartner, country } = useStore()
  const lvl = accessOf(user, 'partnerships')
  const canEdit = lvl === 'edit' || lvl === 'manage' || user.role === 'admin'
  const canManage = lvl === 'manage' || user.role === 'admin'
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<PartnerStage | 'all'>(tracker ? 'due_diligence' : 'all')
  const [adding, setAdding] = useState(false)
  const blank = { name: '', acronym: '', type: 'local_ngo' as PartnerType, country: settings.countries[0], focalName: '', focalTitle: '', focalEmail: '', focalPhone: '', website: '', sectors: '' }
  const [f, setF] = useState(blank)

  const list = useMemo(() => partners
    .filter((p) => stage === 'all' || p.stage === stage)
    .filter((p) => country === 'all' || p.country === country)
    .filter((p) => !q || [p.name, p.acronym, p.code, p.country, p.focalName].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [partners, stage, q, country])
  const counts = Object.fromEntries(STAGES.map((s) => [s, s === 'all' ? partners.length : partners.filter((p) => p.stage === s).length]))

  const remove = (p: Partner) => {
    const linked = partnerProjects(p, projects)
    if (confirm(`Remove ${p.name} from the partner register?${linked.length ? `\n\nIt is linked to ${linked.length} project(s); the links will be cleared.` : ''}\n\nThis also deletes its due-diligence file.`)) deletePartner(p.id)
  }
  const add = () => {
    if (!f.name.trim()) return alert('Partner name is required.')
    const p = createPartner({ ...f, name: f.name.trim(), sectors: f.sectors.split(',').map((s) => s.trim()).filter(Boolean) })
    setAdding(false); setF(blank); nav(`/partnerships/${p.id}`)
  }

  return (
    <>
      <PageHeader title={tracker ? 'Due diligence tracker' : 'Partner register'} subtitle={tracker ? 'Pre-contract due diligence in progress — scoping, vetting (including the partner form), capacity analysis, risks and decision.' : 'Every organisation RHS works with or is considering — where we are with each, their due diligence, and the projects implemented together.'}
        actions={canEdit && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add partner</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-400" /><input className="input w-64 pl-8" placeholder="Search partner, code, focal point…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1">{STAGES.map((s) => <button key={s} onClick={() => setStage(s)} className={cx('rounded-pill px-2.5 py-1 text-[12px] font-medium', stage === s ? 'bg-ink-900 text-white' : 'bg-surface text-ink-600 ring-1 ring-inset ring-line hover:bg-surface-muted')}>{s === 'all' ? 'All' : PARTNER_STAGE_LABEL[s]} <span className="opacity-60">{counts[s]}</span></button>)}</div>
      </div>
      <Card padded={false}>
        {list.length === 0 ? <EmptyState title="No partners here yet" body={canEdit ? 'Add a partner to open its due-diligence file.' : 'Nothing matches the current filter.'} action={canEdit && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add partner</button>} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-[13px]">
            <thead><tr><th className="table-th">Partner</th><th className="table-th">Type · country</th><th className="table-th">Stage</th><th className="table-th w-56">Due diligence</th><th className="table-th">Projects implemented together</th><th className="table-th">Focal point</th><th className="table-th w-24" /></tr></thead>
            <tbody>{list.map((p) => { const pr = ddProgress(p.dueDiligence); const linked = partnerProjects(p, projects); return (
              <tr key={p.id} className="hover:bg-surface-muted">
                <td className="table-td"><Link to={`/partnerships/${p.id}`} className="font-medium text-ink-900 hover:text-brand-700">{p.name}{p.acronym && <span className="text-ink-500"> ({p.acronym})</span>}</Link><div className="font-mono text-[11px] text-ink-400">{p.code} · updated {fmtDate(p.updatedAt)}</div></td>
                <td className="table-td text-ink-700">{PARTNER_TYPE_LABEL[p.type]}<div className="text-[12px] text-ink-500">{p.country}</div></td>
                <td className="table-td"><PartnerStagePill stage={p.stage} />{pr.partnerPending && <div className="mt-1 flex items-center gap-1 text-[11px] text-sun-700"><Clock size={11} /> awaiting partner form</div>}{p.dueDiligence.vetting.share?.status === 'submitted' && !p.dueDiligence.vetting.completedAt && <div className="mt-1 flex items-center gap-1 text-[11px] text-brand-700"><ShieldCheck size={11} /> partner form received</div>}</td>
                <td className="table-td"><DdBar partner={p} /></td>
                <td className="table-td"><ProjectChips projects={linked} empty="No linked project" /></td>
                <td className="table-td text-ink-700">{p.focalName || '—'}{p.focalTitle && <div className="text-[12px] text-ink-500">{p.focalTitle}</div>}</td>
                <td className="table-td"><div className="flex justify-end gap-1"><Link to={`/partnerships/${p.id}`} className="btn-ghost btn-sm" title="Open"><ArrowRight size={14} /></Link>{canManage && <button className="btn-ghost btn-sm text-accent-700" title="Remove partner" onClick={() => remove(p)}><Trash2 size={14} /></button>}</div></td>
              </tr>) })}</tbody>
          </table></div>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add partner" width="max-w-2xl" footer={<><button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary" onClick={add}>Add & open file</button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organisation name" required className="sm:col-span-2"><input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Acronym"><input className="input" value={f.acronym} onChange={(e) => setF({ ...f, acronym: e.target.value })} /></Field>
          <Field label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PartnerType })}>{(Object.keys(PARTNER_TYPE_LABEL) as PartnerType[]).map((t) => <option key={t} value={t}>{PARTNER_TYPE_LABEL[t]}</option>)}</select></Field>
          <Field label="Country"><input className="input" list="ptn-countries" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /><datalist id="ptn-countries">{settings.countries.map((c) => <option key={c} value={c} />)}</datalist></Field>
          <Field label="Website"><input className="input" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
          <Field label="Focal point"><input className="input" value={f.focalName} onChange={(e) => setF({ ...f, focalName: e.target.value })} /></Field>
          <Field label="Focal point title"><input className="input" value={f.focalTitle} onChange={(e) => setF({ ...f, focalTitle: e.target.value })} /></Field>
          <Field label="Focal point email"><input className="input" value={f.focalEmail} onChange={(e) => setF({ ...f, focalEmail: e.target.value })} /></Field>
          <Field label="Focal point phone"><input className="input" value={f.focalPhone} onChange={(e) => setF({ ...f, focalPhone: e.target.value })} /></Field>
          <Field label="Sectors (comma separated)" className="sm:col-span-2"><input className="input" value={f.sectors} onChange={(e) => setF({ ...f, sectors: e.target.value })} placeholder="Health, Physical rehabilitation" /></Field>
        </div>
        <p className="mt-3 text-[12px] text-ink-500">The partner starts at <b>Identified</b>; opening its file lets you start the due diligence (scoping, vetting, capacity analysis, risks and decision). Documents are owned by {settings.orgShort} · Bilal Abbassi.</p>
      </Modal>
    </>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Save, ArrowRight, Share2, Copy, ExternalLink, XCircle, RotateCcw, Plus, ShieldCheck, CheckCircle2, PenLine, Clock, Info } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, KV, Alert, Field, Modal, Stat } from '@/components/ui'
import { accessOf } from '@/lib/departments'
import { DD_CHECKLIST, DD_VETTING_QUESTIONS, DD_SEARCH_INSTRUCTIONS, PCA_SECTIONS, PCA_CATEGORY_LABELS, DD_RISK_GROUPS, DD_PURPOSE } from '@/data/dueDiligence'
import type { PcaKey } from '@/data/dueDiligence'
import { PARTNER_STAGE_LABEL, PARTNER_STAGE_DESC, PARTNER_TYPE_LABEL, AGREEMENT_LABEL, nextPartnerStage, ddProgress, partnerProjects, exportDueDiligence, vettingLink, emptyKeyPerson, emptyRisk, riskLevel, RISK_TONE, pcaSectionScores, pcaOverall, PCA_LEVEL_TONE } from '@/lib/partners'
import { fmtDate, fmtDateTime, fmtMoney, cx } from '@/lib/format'
import { PartnerStagePill, DdBar, ProjectChips } from './shared'
import type { Partner, PartnerStage, PartnerType, DueDiligence, KeyPerson, PartnerRisk, PcaScore, YesNoNa, Currency, PartnerAgreement } from '@/types'
import { PARTNER_STAGES } from '@/types'

type Tab = 'overview' | 'scoping' | 'vetting' | 'pca' | 'risks'
const TABS: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'scoping', label: 'Scoping' }, { id: 'vetting', label: 'Vetting' }, { id: 'pca', label: 'Capacity analysis' }, { id: 'risks', label: 'Risks & decision' }]

export default function PartnerPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'overview'
  const setTab = (t: Tab) => setSp(t === 'overview' ? {} : { tab: t })
  const { partners, projects, deletePartner, advancePartner, updateDueDiligence } = useStore()
  const p = partners.find((x) => x.id === id)
  const lvl = accessOf(user, 'partnerships')
  const canEdit = lvl === 'edit' || lvl === 'manage' || user.role === 'admin'
  const canManage = lvl === 'manage' || user.role === 'admin'
  const [stageModal, setStageModal] = useState<PartnerStage | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  if (!p) return <div className="card p-8 text-center text-ink-500">Partner not found. <Link to="/partnerships/partners" className="text-brand-700 hover:underline">Back to the register</Link></div>
  const dd = p.dueDiligence
  const pr = ddProgress(dd)
  const linked = partnerProjects(p, projects)
  const setDD = (fn: (d: DueDiligence) => DueDiligence) => updateDueDiligence(p.id, fn)
  const next = nextPartnerStage(p.stage)
  const confirmStage = () => { if (!stageModal) return; const r = advancePartner(p.id, stageModal, note || undefined); if (!r.ok) return setErr(r.error ?? ''); setErr(''); setNote(''); setStageModal(null) }

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{p.code}</span>} title={<span className="flex flex-wrap items-center gap-3">{p.name}{p.acronym && <span className="text-ink-400">({p.acronym})</span>}<PartnerStagePill stage={p.stage} /></span>}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{PARTNER_TYPE_LABEL[p.type]}</span><span>· {p.country}</span>{p.focalName && <span>· Focal point {p.focalName}</span>}<span>· Owner {p.ownerName}</span></span>}
        actions={<div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => nav('/partnerships/partners')}><ArrowLeft size={15} /> Register</button>
          <button className="btn-secondary" onClick={() => exportDueDiligence(p)} title="Download the due-diligence workbook (same layout as the RHS template)"><Download size={15} /> Export workbook</button>
          {canManage && next && p.stage !== 'declined' && <button className="btn-primary" onClick={() => { setErr(''); setStageModal(next) }}><ArrowRight size={15} /> Move to {PARTNER_STAGE_LABEL[next]}</button>}
          {canManage && <button className="btn-danger-soft" onClick={() => { if (confirm(`Remove ${p.name} and its due-diligence file?`)) { deletePartner(p.id); nav('/partnerships/partners') } }}><Trash2 size={15} /> Remove</button>}
        </div>} />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-line">{TABS.map((t) => { const pct = { overview: null, scoping: pr.scoping, vetting: pr.vetting, pca: pr.pca, risks: Math.round((pr.risks + pr.decision) / 2) }[t.id]; return (
        <button key={t.id} className={cx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium', tab === t.id ? 'border-brand-600 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-800')} onClick={() => setTab(t.id)}>
          {t.label}{pct !== null && <span className={cx('rounded-pill px-1.5 text-[10.5px]', pct === 100 ? 'bg-brand-100 text-brand-800' : 'bg-surface-sunken text-ink-500')}>{pct}%</span>}{t.id === 'vetting' && pr.partnerPending && <Clock size={12} className="text-sun-700" />}
        </button>) })}</div>

      {tab === 'overview' && <OverviewTab p={p} linked={linked} canEdit={canEdit} canManage={canManage} setTab={setTab} />}
      {tab === 'scoping' && <ScopingTab dd={dd} setDD={setDD} canEdit={canEdit} />}
      {tab === 'vetting' && <VettingTab p={p} setDD={setDD} canEdit={canEdit} canManage={canManage} />}
      {tab === 'pca' && <PcaTab dd={dd} setDD={setDD} canEdit={canEdit} />}
      {tab === 'risks' && <RisksTab p={p} setDD={setDD} canEdit={canEdit} canManage={canManage} />}

      <Modal open={!!stageModal} onClose={() => setStageModal(null)} title={stageModal ? `Move to ${PARTNER_STAGE_LABEL[stageModal]}` : ''} footer={<><button className="btn-secondary" onClick={() => setStageModal(null)}>Cancel</button><button className="btn-primary" onClick={confirmStage}>Confirm</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        {stageModal && <p className="mb-3 text-[13px] text-ink-700">{PARTNER_STAGE_DESC[stageModal]}</p>}
        {stageModal === 'approved' && pr.overall < 100 && <div className="mb-3"><Alert tone="warning">Due diligence is {pr.overall}% complete (scoping {pr.scoping}% · vetting {pr.vetting}% · capacity {pr.pca}% · risks {pr.risks}% · decision {pr.decision}%). A recorded approval decision is required; the rest is at your discretion.</Alert></div>}
        <Field label="Note (recorded in the stage history)"><textarea className="input min-h-[64px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </>
  )
}

// ---- Overview -----------------------------------------------------------
function OverviewTab({ p, linked, canEdit, canManage, setTab }: { p: Partner; linked: ReturnType<typeof partnerProjects>; canEdit: boolean; canManage: boolean; setTab: (t: Tab) => void }) {
  const { settings, updatePartner, setPartnerAgreement } = useStore()
  const pr = ddProgress(p.dueDiligence); const dd = p.dueDiligence
  const [f, setF] = useState({ name: p.name, acronym: p.acronym, type: p.type, country: p.country, address: p.address, website: p.website, focalName: p.focalName, focalTitle: p.focalTitle, focalEmail: p.focalEmail, focalPhone: p.focalPhone, sectors: p.sectors.join(', '), notes: p.notes })
  const [saved, setSaved] = useState(false)
  const [ag, setAg] = useState<PartnerAgreement>(p.agreement ?? { type: 'mou', reference: '', startDate: '', endDate: '', value: undefined, currency: settings.defaultCurrency, notes: '' })
  const dirty = JSON.stringify(f) !== JSON.stringify({ name: p.name, acronym: p.acronym, type: p.type, country: p.country, address: p.address, website: p.website, focalName: p.focalName, focalTitle: p.focalTitle, focalEmail: p.focalEmail, focalPhone: p.focalPhone, sectors: p.sectors.join(', '), notes: p.notes })
  const showAgreement = ['approved', 'agreement', 'active', 'closed'].includes(p.stage)
  const idx = PARTNER_STAGES.indexOf(p.stage)
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card title="Partnership stage" description={PARTNER_STAGE_DESC[p.stage]}>
          <ol className="flex flex-wrap items-center gap-2">{PARTNER_STAGES.map((s, i) => <li key={s} className="flex items-center gap-2"><span className={cx('flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold', p.stage === 'declined' ? 'bg-ink-100 text-ink-400' : i < idx ? 'bg-brand-100 text-brand-800' : i === idx ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-400')}>{i < idx && p.stage !== 'declined' && <CheckCircle2 size={12} />}{PARTNER_STAGE_LABEL[s]}</span>{i < PARTNER_STAGES.length - 1 && <span className="h-px w-3 bg-ink-300" />}</li>)}{p.stage === 'declined' && <li><PartnerStagePill stage="declined" /></li>}</ol>
          <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[12px] text-ink-600">{[...p.stageHistory].reverse().map((h, i) => <li key={i}><b className="text-ink-800">{PARTNER_STAGE_LABEL[h.stage]}</b> · {fmtDateTime(h.at)} · {h.byName}{h.note && <span className="text-ink-500"> — {h.note}</span>}</li>)}</ul>
        </Card>
        <Card title="Partner profile" actions={canEdit && <button className="btn-primary btn-sm" disabled={!dirty} onClick={() => { updatePartner(p.id, { ...f, sectors: f.sectors.split(',').map((s) => s.trim()).filter(Boolean) }); setSaved(true); setTimeout(() => setSaved(false), 1500) }}><Save size={13} /> {saved ? 'Saved' : 'Save'}</button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organisation name" className="sm:col-span-2"><input className="input" disabled={!canEdit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Acronym"><input className="input" disabled={!canEdit} value={f.acronym} onChange={(e) => setF({ ...f, acronym: e.target.value })} /></Field>
            <Field label="Type"><select className="input" disabled={!canEdit} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PartnerType })}>{(Object.keys(PARTNER_TYPE_LABEL) as PartnerType[]).map((t) => <option key={t} value={t}>{PARTNER_TYPE_LABEL[t]}</option>)}</select></Field>
            <Field label="Country"><input className="input" list="ptn-countries2" disabled={!canEdit} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /><datalist id="ptn-countries2">{settings.countries.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Website"><input className="input" disabled={!canEdit} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><input className="input" disabled={!canEdit} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Field label="Focal point"><input className="input" disabled={!canEdit} value={f.focalName} onChange={(e) => setF({ ...f, focalName: e.target.value })} /></Field>
            <Field label="Focal point title"><input className="input" disabled={!canEdit} value={f.focalTitle} onChange={(e) => setF({ ...f, focalTitle: e.target.value })} /></Field>
            <Field label="Focal point e-mail"><input className="input" disabled={!canEdit} value={f.focalEmail} onChange={(e) => setF({ ...f, focalEmail: e.target.value })} /></Field>
            <Field label="Focal point phone"><input className="input" disabled={!canEdit} value={f.focalPhone} onChange={(e) => setF({ ...f, focalPhone: e.target.value })} /></Field>
            <Field label="Sectors (comma separated)" className="sm:col-span-2"><input className="input" disabled={!canEdit} value={f.sectors} onChange={(e) => setF({ ...f, sectors: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[64px]" disabled={!canEdit} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          </div>
        </Card>
        {showAgreement && (
          <Card title="Agreement" description="MoU / sub-award / teaming agreement — reference and dates are required before the partnership is activated" actions={<div className="flex gap-2"><Link to={`/esign/new?subject=${encodeURIComponent(`${AGREEMENT_LABEL[ag.type]} — ${p.name}`)}&link=CONTRACT&id=${p.id}&number=${p.code}`} className="btn-secondary btn-sm"><PenLine size={13} /> Send for e-signature</Link>{canManage && <button className="btn-primary btn-sm" onClick={() => setPartnerAgreement(p.id, ag)}><Save size={13} /> Save</button>}</div>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type"><select className="input" disabled={!canManage} value={ag.type} onChange={(e) => setAg({ ...ag, type: e.target.value as PartnerAgreement['type'] })}>{(Object.keys(AGREEMENT_LABEL) as PartnerAgreement['type'][]).map((t) => <option key={t} value={t}>{AGREEMENT_LABEL[t]}</option>)}</select></Field>
              <Field label="Reference" required><input className="input" disabled={!canManage} value={ag.reference} onChange={(e) => setAg({ ...ag, reference: e.target.value })} placeholder="MOU-2026-001" /></Field>
              <Field label="Value"><div className="flex gap-2"><input type="number" className="input" disabled={!canManage} value={ag.value ?? ''} onChange={(e) => setAg({ ...ag, value: e.target.value === '' ? undefined : Number(e.target.value) })} /><select className="input w-24" disabled={!canManage} value={ag.currency} onChange={(e) => setAg({ ...ag, currency: e.target.value as Currency })}><option>JOD</option><option>USD</option><option>EUR</option></select></div></Field>
              <Field label="Start date"><input type="date" className="input" disabled={!canManage} value={ag.startDate} onChange={(e) => setAg({ ...ag, startDate: e.target.value })} /></Field>
              <Field label="End date"><input type="date" className="input" disabled={!canManage} value={ag.endDate} onChange={(e) => setAg({ ...ag, endDate: e.target.value })} /></Field>
              <Field label="Notes"><input className="input" disabled={!canManage} value={ag.notes} onChange={(e) => setAg({ ...ag, notes: e.target.value })} /></Field>
            </div>
            {p.agreement?.reference && <div className="mt-3 text-[12px] text-ink-500">On file: {AGREEMENT_LABEL[p.agreement.type]} <b className="text-ink-800">{p.agreement.reference}</b> · {fmtDate(p.agreement.startDate)} – {fmtDate(p.agreement.endDate)}{p.agreement.value !== undefined && ` · ${fmtMoney(p.agreement.value, p.agreement.currency)}`}</div>}
          </Card>
        )}
      </div>
      <div className="space-y-6">
        <Card title="Due diligence" description="Pre-contract workbook: scoping → vetting → capacity → risks → decision">
          <DdBar partner={p} className="mb-3" />
          <ul className="space-y-1.5 text-[13px]">{([['scoping', 'Scoping & document checklist', pr.scoping], ['vetting', 'Vetting (ATC, online presence, audit, analysis)', pr.vetting], ['pca', 'Full partner capacity analysis', pr.pca], ['risks', 'Risk table & decision', Math.round((pr.risks + pr.decision) / 2)]] as const).map(([t, l, v]) => <li key={t}><button className="flex w-full items-center justify-between rounded-control px-2 py-1.5 text-left hover:bg-surface-muted" onClick={() => setTab(t)}><span className="text-ink-800">{l}</span><span className={cx('rounded-pill px-2 text-[11px] font-semibold', v === 100 ? 'bg-brand-100 text-brand-800' : v > 0 ? 'bg-sun-100 text-sun-700' : 'bg-surface-sunken text-ink-500')}>{v}%</span></button></li>)}</ul>
          {pr.partnerPending && <div className="mt-3"><Alert tone="warning">Vetting form shared with the partner — waiting for their submission.</Alert></div>}
          {dd.decision.outcome && <div className="mt-3 text-[12.5px] text-ink-700">Decision: <b>{dd.decision.outcome === 'approved' ? 'Approved' : dd.decision.outcome === 'approved_conditions' ? 'Approved with conditions' : 'Declined'}</b> · {dd.decision.decidedByName} · {fmtDate(dd.decision.decidedAt)}</div>}
        </Card>
        <Card title="Projects implemented together" description="Linked from each project's Team & discussion tab">
          <ProjectChips projects={linked} empty="No project linked yet." />
          {linked.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-2 text-[12px] text-ink-600">{linked.map((x) => <li key={x.id} className="flex justify-between gap-2"><Link to={`/grants/${x.id}`} className="truncate hover:underline">{x.code}</Link><span className="shrink-0">{x.donorName}{x.awardedAmount ? ` · ${fmtMoney(x.awardedAmount, x.currency)}` : ''}</span></li>)}</ul>}
        </Card>
        <Card title="Record"><KV k="Code" v={<span className="font-mono">{p.code}</span>} /><KV k="Created" v={`${fmtDate(p.createdAt)} · ${p.createdByName}`} /><KV k="Updated" v={fmtDate(p.updatedAt)} /><KV k="Document owner" v={p.ownerName} /></Card>
      </div>
    </div>
  )
}

// ---- Scoping -------------------------------------------------------------
function ScopingTab({ dd, setDD, canEdit }: { dd: DueDiligence; setDD: (fn: (d: DueDiligence) => DueDiligence) => void; canEdit: boolean }) {
  const sc = dd.scoping
  const set = (patch: Partial<DueDiligence['scoping']>) => setDD((d) => ({ ...d, scoping: { ...d.scoping, ...patch } }))
  const done = Object.values(sc.checklist).filter((v) => v === 'yes').length, missing = Object.values(sc.checklist).filter((v) => v === 'no').length
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card title="Partnership overview" description="Relates to the overall partnership rather than a specific project">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New partner or existing partner"><select className="input" disabled={!canEdit} value={sc.newOrExisting} onChange={(e) => set({ newOrExisting: e.target.value as 'new' | 'existing' })}><option value="new">New</option><option value="existing">Existing</option></select></Field>
            <Field label="Due diligence completion date"><input type="date" className="input" disabled={!canEdit} value={sc.completionDate} onChange={(e) => set({ completionDate: e.target.value })} /></Field>
            <Field label="Partner's sector(s) of implementation"><input className="input" disabled={!canEdit} value={sc.partnerSectors} onChange={(e) => set({ partnerSectors: e.target.value })} /></Field>
            <Field label="Anticipated sectors for partnership with RHS"><input className="input" disabled={!canEdit} value={sc.anticipatedSectors} onChange={(e) => set({ anticipatedSectors: e.target.value })} /></Field>
            <Field label="Partner's geographic reach"><input className="input" disabled={!canEdit} value={sc.partnerReach} onChange={(e) => set({ partnerReach: e.target.value })} /></Field>
            <Field label="Anticipated geographic scope of partnership"><input className="input" disabled={!canEdit} value={sc.anticipatedScope} onChange={(e) => set({ anticipatedScope: e.target.value })} /></Field>
            <Field label="RHS partnership focal points (technical and partnership leads)" className="sm:col-span-2"><input className="input" disabled={!canEdit} value={sc.rhsFocalPoints} onChange={(e) => set({ rhsFocalPoints: e.target.value })} /></Field>
            <Field label="Anticipated donors for partnership (if known)"><input className="input" disabled={!canEdit} value={sc.anticipatedDonors} onChange={(e) => set({ anticipatedDonors: e.target.value })} /></Field>
            <Field label="Anticipated value of largest partnership agreement (approx.)"><input className="input" disabled={!canEdit} value={sc.anticipatedValue} onChange={(e) => set({ anticipatedValue: e.target.value })} /></Field>
            <Field label="Scoping notes" className="sm:col-span-2"><textarea className="input min-h-[64px]" disabled={!canEdit} value={sc.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </div>
        </Card>
        <Card title="Due diligence preparation — document review checklist" description={`${done} received · ${missing} missing · ${DD_CHECKLIST.length - done - missing} to confirm`} padded={false}>
          <table className="w-full text-[13px]"><thead><tr><th className="table-th">Document</th><th className="table-th w-56">Received</th></tr></thead>
            <tbody>{DD_CHECKLIST.map((c) => { const v = sc.checklist[c.key] ?? ''; return <tr key={c.key}><td className="table-td">{c.label}</td><td className="table-td"><div className="flex gap-1">{(['yes', 'no', 'na'] as YesNoNa[]).map((o) => <button key={o} disabled={!canEdit} onClick={() => set({ checklist: { ...sc.checklist, [c.key]: v === o ? '' : o } })} className={cx('rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold', v === o ? (o === 'yes' ? 'bg-brand-600 text-white' : o === 'no' ? 'bg-accent-600 text-white' : 'bg-ink-600 text-white') : 'bg-surface text-ink-600 ring-1 ring-inset ring-line hover:bg-surface-muted')}>{o === 'yes' ? 'Yes' : o === 'no' ? 'No' : 'N/A'}</button>)}</div></td></tr> })}</tbody></table>
        </Card>
      </div>
      <Card title="About this workbook"><p className="whitespace-pre-line text-[13px] text-ink-700">{DD_PURPOSE}</p><p className="mt-3 text-[12px] text-ink-500">Tabs follow the RHS Pre-Contract Due Diligence workbook: Scoping · Vetting · Full PCA (eight capacity sections) · Risk Analysis. Export at any time from the header.</p></Card>
    </div>
  )
}

// ---- Vetting -------------------------------------------------------------
function VettingTab({ p, setDD, canEdit, canManage }: { p: Partner; setDD: (fn: (d: DueDiligence) => DueDiligence) => void; canEdit: boolean; canManage: boolean }) {
  const { shareVetting, revokeVetting, reopenVetting, completeVetting } = useStore()
  const v = p.dueDiligence.vetting
  const share = v.share
  const [msg, setMsg] = useState(`Dear ${p.focalName || 'partner'}, as part of our pre-contract due diligence please complete and submit this vetting form on behalf of ${p.name}.`)
  const [copied, setCopied] = useState(false)
  const setV = (patch: Partial<typeof v>) => setDD((d) => ({ ...d, vetting: { ...d.vetting, ...patch } }))
  const setKp = (id: string, patch: Partial<KeyPerson>) => setV({ keyPersonnel: v.keyPersonnel.map((k) => (k.id === id ? { ...k, ...patch } : k)) })
  const link = share ? vettingLink(share.token) : ''
  const copy = async () => { try { await navigator.clipboard.writeText(link) } catch { /* viewer may block */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const sub = v.submission
  const locked = !!v.completedAt
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={<span className="flex items-center gap-2"><Share2 size={16} /> Share with the partner</span>} description="Only the vetting form is shared — the partner fills it online and submits; nothing else in the file is visible to them" className="xl:col-span-2">
          {!share || share.status === 'revoked' ? (
            <div className="space-y-3">
              {share?.status === 'revoked' && <Alert tone="warning">The previous link was closed{sub ? ' after a submission was received' : ''}. Sharing again issues a new link.</Alert>}
              <Field label="Message shown to the partner at the top of the form"><textarea className="input min-h-[64px]" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
              <button className="btn-primary" disabled={!canEdit} onClick={() => shareVetting(p.id, msg)}><Share2 size={15} /> Create partner link</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={cx('flex items-center gap-2 rounded-control px-3 py-2 text-[13px]', share.status === 'open' ? 'bg-sun-50 text-sun-700' : 'bg-brand-50 text-brand-800')}>{share.status === 'open' ? <><Clock size={14} /> Open — waiting for the partner · shared {fmtDateTime(share.sharedAt)} by {share.sharedByName}</> : <><CheckCircle2 size={14} /> Submitted by the partner {sub && `on ${fmtDateTime(sub.submittedAt)}`}</>}</div>
              <div className="flex gap-2"><input className="input font-mono text-[12px]" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /><button className="btn-secondary" onClick={copy}><Copy size={14} /> {copied ? 'Copied' : 'Copy link'}</button><a className="btn-secondary" href={link} target="_blank" rel="noreferrer" title="Open the form as the partner sees it"><ExternalLink size={14} /> Preview</a></div>
              <p className="text-[12px] text-ink-500">Send this link to {p.focalEmail || 'the partner focal point'}. Anyone with the link can open the form until it is submitted or closed.</p>
              <div className="flex gap-2">{share.status === 'open' && canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => revokeVetting(p.id)}><XCircle size={13} /> Close link</button>}{share.status === 'submitted' && canEdit && <button className="btn-ghost btn-sm" onClick={() => reopenVetting(p.id)} title="Let the partner edit and re-submit"><RotateCcw size={13} /> Re-open for the partner</button>}</div>
            </div>
          )}
        </Card>
        <Card title="Vetting">
          <div className="space-y-3">
            <Field label="RHS staff responsible for vetting (name & title)"><input className="input" disabled={!canEdit || locked} value={v.staffResponsible} onChange={(e) => setV({ staffResponsible: e.target.value })} /></Field>
            <Field label="Vetting level"><select className="input" disabled={!canEdit || locked} value={v.level} onChange={(e) => setV({ level: e.target.value as 'basic' | 'full' })}><option value="basic">Basic</option><option value="full">Full</option></select></Field>
            {locked ? <div className="rounded-control bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800"><CheckCircle2 size={13} className="mr-1 inline" /> Completed {fmtDateTime(v.completedAt)} by {v.completedByName}</div> : canManage && <button className="btn-primary w-full" onClick={() => { if (confirm('Mark the vetting as complete? Fields become read-only.')) completeVetting(p.id) }}><ShieldCheck size={15} /> Mark vetting complete</button>}
          </div>
        </Card>
      </div>

      {sub && (
        <Card title="Partner submission" description={`Submitted ${fmtDateTime(sub.submittedAt)} by ${sub.byName}${sub.byTitle ? ` (${sub.byTitle})` : ''} · ${sub.byEmail} · signature “${sub.signature}”`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div><KV k="Legal name" v={sub.legalName} /><KV k="Registration no." v={sub.registrationNo || '—'} /><KV k="Country · legal form" v={[sub.registrationCountry, sub.legalForm].filter(Boolean).join(' · ') || '—'} /><KV k="Last external audit" v={[sub.auditFirm, sub.auditYear].filter(Boolean).join(' · ') || '—'} /><KV k="Audit findings" v={sub.auditIssues || '—'} />{sub.notes && <KV k="Notes" v={sub.notes} />}</div>
            <div><div className="label">Self-declarations</div><ul className="space-y-1 text-[12.5px]">{DD_VETTING_QUESTIONS.map((q) => { const d = sub.declarations.find((x) => x.key === q.key); return <li key={q.key} className="flex gap-2"><span className={cx('shrink-0 rounded-pill px-2 text-[11px] font-semibold', d?.answer === 'yes' ? 'bg-sun-500 text-ink-900' : d?.answer === 'no' ? 'bg-brand-100 text-brand-800' : 'bg-surface-sunken text-ink-500')}>{d?.answer === 'yes' ? 'Yes' : d?.answer === 'no' ? 'No' : '—'}</span><span className="text-ink-700">{q.topic}{d?.explanation && <span className="text-ink-500"> — {d.explanation}</span>}</span></li> })}</ul></div>
          </div>
          <p className="mt-3 text-[12px] text-ink-500">The persons and links the partner provided were added to the tables below for ATC screening and checks.</p>
        </Card>
      )}

      <Card title="Key personnel" description="CEO / President, relevant technical and programme directors, financial controllers / finance directors" padded={false} actions={canEdit && !locked && <button className="btn-secondary btn-sm" onClick={() => setV({ keyPersonnel: [...v.keyPersonnel, emptyKeyPerson()] })}><Plus size={13} /> Add person</button>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-[13px]">
          <thead><tr><th className="table-th">Full name</th><th className="table-th">Title</th><th className="table-th w-32">Country of birth</th><th className="table-th w-36">Date of birth</th><th className="table-th w-24">Gender</th><th className="table-th w-28">Verification</th><th className="table-th w-32">ATC result</th><th className="table-th">Issues, if any</th><th className="table-th w-10" /></tr></thead>
          <tbody>{v.keyPersonnel.length === 0 && <tr><td className="table-td text-ink-500" colSpan={9}>No key personnel yet — add them here or share the form with the partner.</td></tr>}{v.keyPersonnel.map((k) => <tr key={k.id}>
            <td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={k.name} onChange={(e) => setKp(k.id, { name: e.target.value })} /></td>
            <td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={k.title} onChange={(e) => setKp(k.id, { title: e.target.value })} /></td>
            <td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={k.countryOfBirth} onChange={(e) => setKp(k.id, { countryOfBirth: e.target.value })} /></td>
            <td className="table-td py-1.5"><input type="date" className="input" disabled={!canEdit || locked} value={k.dob} onChange={(e) => setKp(k.id, { dob: e.target.value })} /></td>
            <td className="table-td py-1.5"><select className="input" disabled={!canEdit || locked} value={k.gender} onChange={(e) => setKp(k.id, { gender: e.target.value })}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></td>
            <td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={k.verification ?? ''} onChange={(e) => setKp(k.id, { verification: e.target.value })} placeholder="ATC" /></td>
            <td className="table-td py-1.5"><select className={cx('input', k.atcClear === 'clear' && 'text-brand-800', k.atcClear === 'flagged' && 'text-accent-700')} disabled={!canEdit || locked} value={k.atcClear ?? ''} onChange={(e) => setKp(k.id, { atcClear: e.target.value as KeyPerson['atcClear'] })}><option value="">—</option><option value="pending">Pending</option><option value="clear">Clear</option><option value="flagged">Flagged</option></select></td>
            <td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={k.atcIssues ?? ''} onChange={(e) => setKp(k.id, { atcIssues: e.target.value })} /></td>
            <td className="table-td py-1.5">{canEdit && !locked && <button className="btn-ghost btn-sm text-accent-700" onClick={() => setV({ keyPersonnel: v.keyPersonnel.filter((x) => x.id !== k.id) })}><Trash2 size={13} /></button>}</td>
          </tr>)}</tbody>
        </table></div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="ATC clearance" description="Anti-terrorism check of the organisation and its staff">
          {(['org', 'staff'] as const).map((k) => { const c = v.atc[k]; const set = (patch: Partial<typeof c>) => setV({ atc: { ...v.atc, [k]: { ...c, ...patch } } }); return (
            <div key={k} className="mb-3 rounded-control border border-line p-3"><div className="mb-2 text-[12.5px] font-semibold text-ink-900">{k === 'org' ? `Organisation — ${p.name}` : 'Organisation staff'}</div>
              <div className="grid gap-2 sm:grid-cols-4"><Field label="Done"><select className="input" disabled={!canEdit || locked} value={c.done} onChange={(e) => set({ done: e.target.value as typeof c.done })}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></Field><Field label="Checked by"><input className="input" disabled={!canEdit || locked} value={c.checkedBy} onChange={(e) => set({ checkedBy: e.target.value })} /></Field><Field label="Date"><input type="date" className="input" disabled={!canEdit || locked} value={c.date} onChange={(e) => set({ date: e.target.value })} /></Field><Field label="Issues, if any"><input className="input" disabled={!canEdit || locked} value={c.issues} onChange={(e) => set({ issues: e.target.value })} /></Field></div>
            </div>) })}
        </Card>
        <Card title="Audit review" description="For full vetting, where relevant">
          <div className="grid gap-2 sm:grid-cols-2"><Field label="Reviewed"><select className="input" disabled={!canEdit || locked} value={v.audit.done} onChange={(e) => setV({ audit: { ...v.audit, done: e.target.value as YesNoNa } })}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="na">N/A</option></select></Field><Field label="Checked by"><input className="input" disabled={!canEdit || locked} value={v.audit.checkedBy} onChange={(e) => setV({ audit: { ...v.audit, checkedBy: e.target.value } })} /></Field><Field label="Name of firm"><input className="input" disabled={!canEdit || locked} value={v.audit.firm} onChange={(e) => setV({ audit: { ...v.audit, firm: e.target.value } })} /></Field><Field label="Date of checking"><input type="date" className="input" disabled={!canEdit || locked} value={v.audit.date} onChange={(e) => setV({ audit: { ...v.audit, date: e.target.value } })} /></Field><Field label="Issues, if any" className="sm:col-span-2"><input className="input" disabled={!canEdit || locked} value={v.audit.issues} onChange={(e) => setV({ audit: { ...v.audit, issues: e.target.value } })} /></Field></div>
        </Card>
      </div>

      <Card title="Social media and internet presence" description={DD_SEARCH_INSTRUCTIONS.replace(/^Internet Search Instructions:\s*/, '')} padded={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-[13px]"><thead><tr><th className="table-th w-32">Platform</th><th className="table-th">URL</th><th className="table-th w-40">Checked by</th><th className="table-th w-40">Date of checking</th><th className="table-th">Issues, if any (copy URL where issues)</th></tr></thead>
          <tbody>{v.online.map((o) => { const set = (patch: Partial<typeof o>) => setV({ online: v.online.map((x) => (x.platform === o.platform ? { ...x, ...patch } : x)) }); return <tr key={o.platform}><td className="table-td font-medium">{o.platform}</td><td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={o.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></td><td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={o.checkedBy} onChange={(e) => set({ checkedBy: e.target.value })} /></td><td className="table-td py-1.5"><input type="date" className="input" disabled={!canEdit || locked} value={o.date} onChange={(e) => set({ date: e.target.value })} /></td><td className="table-td py-1.5"><input className="input" disabled={!canEdit || locked} value={o.issues} onChange={(e) => set({ issues: e.target.value })} /></td></tr> })}</tbody></table></div>
      </Card>

      <Card title="Vetting analysis" description="Answer each question with the basis for the answer, issues and risks — risks feed the risk table" padded={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]"><thead><tr><th className="table-th w-[34%]">Question</th><th className="table-th w-24">Answer</th><th className="table-th">Basis for answer</th><th className="table-th">Issues, if any</th><th className="table-th">Risks, if any</th></tr></thead>
          <tbody>{DD_VETTING_QUESTIONS.map((q) => { const a = v.analysis.find((x) => x.key === q.key) ?? { key: q.key, answer: '' as const, basis: '', issues: '', risks: '' }; const set = (patch: Partial<typeof a>) => setV({ analysis: v.analysis.some((x) => x.key === q.key) ? v.analysis.map((x) => (x.key === q.key ? { ...x, ...patch } : x)) : [...v.analysis, { ...a, ...patch }] }); const decl = sub?.declarations.find((d) => d.key === q.key); return (
            <tr key={q.key} className="align-top"><td className="table-td"><div className="font-semibold text-ink-900">{q.topic}</div><div className="text-[12.5px] text-ink-600">{q.question}</div>{decl?.answer && <div className={cx('mt-1 inline-block rounded-pill px-2 text-[10.5px] font-semibold', decl.answer === 'yes' ? 'bg-sun-100 text-sun-700' : 'bg-brand-50 text-brand-800')}>Partner declared: {decl.answer === 'yes' ? 'Yes' : 'No'}</div>}</td>
              <td className="table-td py-1.5"><select className={cx('input', a.answer === 'yes' && q.key !== 'vq_1' && 'text-accent-700 font-semibold')} disabled={!canEdit || locked} value={a.answer} onChange={(e) => set({ answer: e.target.value as typeof a.answer })}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></td>
              <td className="table-td py-1.5"><textarea className="input min-h-[40px]" disabled={!canEdit || locked} value={a.basis} onChange={(e) => set({ basis: e.target.value })} /></td><td className="table-td py-1.5"><textarea className="input min-h-[40px]" disabled={!canEdit || locked} value={a.issues} onChange={(e) => set({ issues: e.target.value })} /></td><td className="table-td py-1.5"><textarea className="input min-h-[40px]" disabled={!canEdit || locked} value={a.risks} onChange={(e) => set({ risks: e.target.value })} /></td></tr>) })}</tbody></table></div>
      </Card>
    </div>
  )
}

// ---- Capacity (Full PCA) ---------------------------------------------------
function PcaTab({ dd, setDD, canEdit }: { dd: DueDiligence; setDD: (fn: (d: DueDiligence) => DueDiligence) => void; canEdit: boolean }) {
  const [sec, setSec] = useState<PcaKey>('safe')
  const [showGuide, setShowGuide] = useState(false)
  const s = PCA_SECTIONS.find((x) => x.key === sec)!
  const scores = pcaSectionScores(dd); const cur = scores.find((x) => x.key === sec)!
  const overall = pcaOverall(dd)
  const setA = (key: string, patch: Partial<{ score?: PcaScore; notes: string; actions: string }>) => setDD((d) => ({ ...d, pca: { ...d.pca, answers: { ...d.pca.answers, [key]: { ...(d.pca.answers[key] ?? { notes: '', actions: '' }), ...patch } } } }))
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Overall capacity score" value={overall === null ? '—' : `${overall}%`} hint="Average of section scores × 33.34 % (workbook formula)" tone="brand" />
        <Stat label="Items scored" value={`${scores.reduce((t, x) => t + x.answered, 0)} / ${scores.reduce((t, x) => t + x.total, 0)}`} />
        <div className="sm:col-span-2"><Field label="PCA visit"><div className="grid grid-cols-2 gap-2"><input type="date" className="input" disabled={!canEdit} value={dd.pca.visitDate} onChange={(e) => setDD((d) => ({ ...d, pca: { ...d.pca, visitDate: e.target.value } }))} /><input className="input" placeholder="Assessors" disabled={!canEdit} value={dd.pca.assessors} onChange={(e) => setDD((d) => ({ ...d, pca: { ...d.pca, assessors: e.target.value } }))} /></div></Field></div>
      </div>
      <div className="flex flex-wrap gap-1.5">{scores.map((x) => <button key={x.key} onClick={() => setSec(x.key)} className={cx('flex items-center gap-2 rounded-pill px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset', sec === x.key ? 'bg-ink-900 text-white ring-ink-900' : 'bg-surface text-ink-700 ring-line hover:bg-surface-muted')}>{x.label}<span className={cx('rounded-pill px-1.5 text-[10.5px] font-semibold', x.level ? PCA_LEVEL_TONE[x.level] : 'bg-surface-sunken text-ink-500')}>{x.score ?? `${x.answered}/${x.total}`}</span></button>)}</div>
      <Card title={<span>{s.title} <span className={cx('ml-2 rounded-pill px-2 py-0.5 text-[11px] font-semibold', cur.level ? PCA_LEVEL_TONE[cur.level] : 'bg-surface-sunken text-ink-500')}>{cur.score !== null ? `${cur.score} / 3 · ${cur.level}` : 'not scored'}</span></span>} description={s.materials || undefined} padded={false}
        actions={<button className="btn-ghost btn-sm" onClick={() => setShowGuide((v) => !v)}><Info size={13} /> {showGuide ? 'Hide' : 'Show'} interview guide</button>}>
        {showGuide && <div className="whitespace-pre-line border-b border-line bg-info-50 px-5 py-3 text-[12.5px] text-info-700">{s.interview}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-[13px]"><thead><tr><th className="table-th w-36">Area</th><th className="table-th">High (3)</th><th className="table-th">Medium (2)</th><th className="table-th">Emerging (1)</th><th className="table-th w-36">Answer</th><th className="table-th w-52">Notes</th><th className="table-th w-52">Action points / documents to view</th></tr></thead>
          <tbody>{s.items.map((i, n) => { const a = dd.pca.answers[i.key]; return (
            <tr key={i.key} className={cx('align-top', a?.score === 1 && 'bg-accent-50/40', a?.score === 3 && 'bg-brand-50/40')}><td className="table-td"><div className="font-semibold text-ink-900">{i.area}</div><div className="text-[11px] text-ink-400">{n + 1}</div></td><td className="table-td text-[12.5px] text-ink-700">{i.high}</td><td className="table-td text-[12.5px] text-ink-700">{i.medium}</td><td className="table-td text-[12.5px] text-ink-700">{i.emerging}</td>
              <td className="table-td py-1.5"><select className={cx('input font-semibold', a?.score === 3 && 'text-brand-800', a?.score === 1 && 'text-accent-700')} disabled={!canEdit} value={a?.score ?? ''} onChange={(e) => setA(i.key, { score: e.target.value === '' ? undefined : e.target.value === 'na' ? 'na' : (Number(e.target.value) as 1 | 2 | 3) })}><option value="">—</option><option value="3">3 · High</option><option value="2">2 · Medium</option><option value="1">1 · Emerging</option><option value="na">N/A</option></select></td>
              <td className="table-td py-1.5"><textarea className="input min-h-[40px] text-[12.5px]" disabled={!canEdit} value={a?.notes ?? ''} onChange={(e) => setA(i.key, { notes: e.target.value })} /></td><td className="table-td py-1.5"><textarea className="input min-h-[40px] text-[12.5px]" disabled={!canEdit} value={a?.actions ?? ''} onChange={(e) => setA(i.key, { actions: e.target.value })} /></td></tr>) })}</tbody></table></div>
      </Card>
    </div>
  )
}

// ---- Risks & decision ----------------------------------------------------
function RisksTab({ p, setDD, canEdit, canManage }: { p: Partner; setDD: (fn: (d: DueDiligence) => DueDiligence) => void; canEdit: boolean; canManage: boolean }) {
  const { decidePartner } = useStore()
  const dd = p.dueDiligence
  const scores = pcaSectionScores(dd); const overall = pcaOverall(dd)
  const [outcome, setOutcome] = useState<'approved' | 'approved_conditions' | 'declined' | ''>(dd.decision.outcome)
  const [cond, setCond] = useState(dd.decision.conditions)
  const setRisk = (id: string, patch: Partial<PartnerRisk>) => setDD((d) => ({ ...d, risks: d.risks.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const high = dd.risks.filter((r) => ['High', 'Very High'].includes(riskLevel(r.likelihood, r.impact) ?? '')).length
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="PCA outcomes and issues identified" padded={false} className="xl:col-span-2">
          <table className="w-full text-[13px]"><thead><tr><th className="table-th">Category</th><th className="table-th w-28">Full PCA score</th><th className="table-th w-28">Level</th><th className="table-th">Significant issues (from action points)</th></tr></thead>
            <tbody>{scores.map((s) => { const issues = PCA_SECTIONS.find((x) => x.key === s.key)!.items.map((i) => dd.pca.answers[i.key]).filter((a) => a?.score === 1 && (a.notes || a.actions)).map((a) => a!.actions || a!.notes); return <tr key={s.key}><td className="table-td font-medium">{PCA_CATEGORY_LABELS[s.key]}</td><td className="table-td">{s.score ?? 'N/A'}</td><td className="table-td">{s.level && <span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', PCA_LEVEL_TONE[s.level])}>{s.level}</span>}</td><td className="table-td text-[12.5px] text-ink-600">{issues.join(' · ') || '—'}</td></tr> })}
              <tr className="bg-surface-muted"><td className="table-td font-semibold">Overall score</td><td className="table-td font-semibold">{overall === null ? 'N/A' : `${overall}%`}</td><td className="table-td" colSpan={2}><span className="text-[11.5px] text-ink-500">This score is not an assessment of the organisation. It is an assessment of the risk associated with the organisation's implementation of the proposed award.</span></td></tr></tbody></table>
        </Card>
        <Card title="Decision" description="Concludes the due diligence; an approval unlocks the Approved stage">
          {dd.decision.outcome && <div className={cx('mb-3 rounded-control px-3 py-2 text-[12.5px]', dd.decision.outcome === 'declined' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-800')}><b>{dd.decision.outcome === 'approved' ? 'Approved' : dd.decision.outcome === 'approved_conditions' ? 'Approved with conditions' : 'Declined'}</b> · {dd.decision.decidedByName} · {fmtDateTime(dd.decision.decidedAt)}{dd.decision.conditions && <div className="mt-1 text-ink-700">{dd.decision.conditions}</div>}</div>}
          <div className="space-y-3">
            <Field label="Outcome"><select className="input" disabled={!canManage} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}><option value="">—</option><option value="approved">Approved</option><option value="approved_conditions">Approved with conditions</option><option value="declined">Declined — do not partner</option></select></Field>
            <Field label={outcome === 'declined' ? 'Reasons' : 'Conditions / mitigation required before contracting'}><textarea className="input min-h-[80px]" disabled={!canManage} value={cond} onChange={(e) => setCond(e.target.value)} /></Field>
            {canManage && <button className="btn-primary w-full" disabled={!outcome} onClick={() => { if (outcome && confirm(`Record the decision "${outcome.replace('_', ' ')}"?${outcome === 'declined' ? ' The partner moves to Declined.' : ''}`)) decidePartner(p.id, outcome, cond) }}><ShieldCheck size={15} /> Record decision</button>}
            {high > 0 && <Alert tone="warning">{high} risk(s) rated High / Very High — focus mitigation on these before deciding.</Alert>}
          </div>
        </Card>
      </div>
      <Card title="Partnership collaborative risk management table" description="Focus mitigation on risks with a risk level of High / Very High (top-right quadrant of the likelihood × impact matrix)" padded={false}>
        {DD_RISK_GROUPS.map((g) => { const rows = dd.risks.filter((r) => r.group === g.key); return (
          <div key={g.key} className="border-b border-line last:border-0">
            <div className="flex items-start justify-between gap-3 bg-surface-muted px-5 py-2.5"><div><div className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-800">{g.title}</div><div className="text-[12px] text-ink-500">{g.desc}</div></div>{canEdit && <button className="btn-secondary btn-sm shrink-0" onClick={() => setDD((d) => ({ ...d, risks: [...d.risks, emptyRisk(g.key)] }))}><Plus size={13} /> Add risk</button>}</div>
            {rows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]"><thead><tr><th className="table-th w-8">#</th><th className="table-th">Risk</th><th className="table-th w-28">Likelihood (0–5)</th><th className="table-th w-28">Impact (0–5)</th><th className="table-th w-28">Risk level</th><th className="table-th">Mitigation</th><th className="table-th w-36">Owner</th><th className="table-th w-10" /></tr></thead>
              <tbody>{rows.map((r, i) => { const lv = riskLevel(r.likelihood, r.impact); return <tr key={r.id} className="align-top"><td className="table-td text-ink-400">{i + 1}.</td><td className="table-td py-1.5"><textarea className="input min-h-[40px]" disabled={!canEdit} value={r.description} onChange={(e) => setRisk(r.id, { description: e.target.value })} /></td>
                <td className="table-td py-1.5"><select className="input" disabled={!canEdit} value={r.likelihood ?? ''} onChange={(e) => setRisk(r.id, { likelihood: e.target.value === '' ? null : Number(e.target.value) })}><option value="">—</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 0 ? ' · Low' : n === 5 ? ' · Very high' : ''}</option>)}</select></td>
                <td className="table-td py-1.5"><select className="input" disabled={!canEdit} value={r.impact ?? ''} onChange={(e) => setRisk(r.id, { impact: e.target.value === '' ? null : Number(e.target.value) })}><option value="">—</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 0 ? ' · Low' : n === 5 ? ' · Very high' : ''}</option>)}</select></td>
                <td className="table-td">{lv ? <span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', RISK_TONE[lv])}>{lv}</span> : <span className="text-[11.5px] text-ink-400">No data</span>}</td>
                <td className="table-td py-1.5"><textarea className="input min-h-[40px]" disabled={!canEdit} value={r.mitigation} onChange={(e) => setRisk(r.id, { mitigation: e.target.value })} /></td><td className="table-td py-1.5"><input className="input" disabled={!canEdit} value={r.owner} onChange={(e) => setRisk(r.id, { owner: e.target.value })} /></td>
                <td className="table-td py-1.5">{canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => setDD((d) => ({ ...d, risks: d.risks.filter((x) => x.id !== r.id) }))}><Trash2 size={13} /></button>}</td></tr> })}</tbody></table></div>}
          </div>) })}
      </Card>
    </div>
  )
}

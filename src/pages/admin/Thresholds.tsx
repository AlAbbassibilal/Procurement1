import { useState } from 'react'
import { Pencil, Plus, Trash2, ArrowDown, Save } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Alert } from '@/components/ui'
import { MethodBadge } from '@/components/tier'
import { ROLE_LABEL } from '@/lib/workflow'
import { METHOD_LABEL, METHOD_DESC, fromUSD } from '@/lib/tiers'
import { fmtMoney, uid } from '@/lib/format'
import type { ProcurementTier, Role, SourcingMethod, OrgSettings } from '@/types'

const ROLES = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => !['requester', 'logistics', 'admin'].includes(r))
const METHODS = Object.keys(METHOD_LABEL) as SourcingMethod[]

export default function Thresholds() {
  const user = useCurrentUser()!
  const { settings, updateSettings } = useStore()
  const [edit, setEdit] = useState<ProcurementTier | null>(null)
  const [policy, setPolicy] = useState<Pick<OrgSettings, 'fxToUSD' | 'contractThresholdUSD' | 'legalReviewThresholdUSD' | 'soleSourceEdThresholdUSD' | 'dualAuthThresholdUSD'>>({ fxToUSD: settings.fxToUSD, contractThresholdUSD: settings.contractThresholdUSD, legalReviewThresholdUSD: settings.legalReviewThresholdUSD, soleSourceEdThresholdUSD: settings.soleSourceEdThresholdUSD, dualAuthThresholdUSD: settings.dualAuthThresholdUSD })
  const [saved, setSaved] = useState(false)
  const canEdit = user.role === 'admin'
  const ccy = settings.defaultCurrency
  const tiers = [...settings.tiers].sort((a, b) => a.minUSD - b.minUSD)
  const saveTier = () => {
    if (!edit) return
    if (!edit.name.trim() || !edit.approvers.length) return alert('Name and at least one approval step are required.')
    const others = settings.tiers.filter((t) => t.id !== edit.id)
    updateSettings({ tiers: [...others, edit] })
    setEdit(null)
  }
  const removeTier = (id: string) => confirm('Delete this tier?') && updateSettings({ tiers: settings.tiers.filter((t) => t.id !== id) })

  return (
    <>
      <PageHeader title="Procurement thresholds & methods" subtitle="RHS Procurement SOPs v1.0 §3 — thresholds apply to the total value of a single transaction and must not be split. The tier sets the sourcing method, minimum quotations and the approval authority."
        actions={canEdit && <button className="btn-primary" onClick={() => { updateSettings(policy); setSaved(true); setTimeout(() => setSaved(false), 2000) }}><Save size={15} /> Save policy parameters</button>} />
      {!canEdit && <div className="mb-4"><Alert tone="info">Read-only view. Only administrators can change thresholds.</Alert></div>}
      {saved && <div className="mb-4"><Alert tone="success">Policy parameters saved.</Alert></div>}

      <div className="space-y-6">
        <Card title="Value tiers" description={`Defined in USD; converted from ${ccy} at the rates below when a document is evaluated.`} padded={false}
          actions={canEdit && <button className="btn-secondary btn-sm" onClick={() => setEdit({ id: uid('t_'), name: '', minUSD: 0, maxUSD: null, method: 'rfq', minQuotations: 3, invitedSuppliersMin: 3, deadlineWorkingDays: 0, committeeMin: 0, donorApproval: false, approvers: [{ role: 'finance', label: ROLE_LABEL.finance }] })}><Plus size={13} /> Add tier</button>}>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead><tr><th className="table-th">Tier</th><th className="table-th">Value (USD)</th><th className="table-th">≈ {ccy}</th><th className="table-th">Method</th><th className="table-th">Min. quotes</th><th className="table-th">Issue to</th><th className="table-th">Period</th><th className="table-th">Committee</th><th className="table-th">Approval authority</th>{canEdit && <th className="table-th w-20" />}</tr></thead>
              <tbody>{tiers.map((t) => (
                <tr key={t.id} className="hover:bg-surface-muted align-top">
                  <td className="table-td font-medium text-ink-900">{t.name}</td>
                  <td className="table-td tabular-nums whitespace-nowrap">{t.minUSD.toLocaleString()} – {t.maxUSD === null ? <span className="text-ink-500">∞</span> : t.maxUSD.toLocaleString()}</td>
                  <td className="table-td tabular-nums whitespace-nowrap text-ink-500">{fmtMoney(fromUSD(t.minUSD, ccy, settings), ccy)} – {t.maxUSD === null ? '∞' : fmtMoney(fromUSD(t.maxUSD, ccy, settings), ccy)}</td>
                  <td className="table-td"><MethodBadge method={t.method} /><div className="mt-1 max-w-[260px] text-[11.5px] leading-snug text-ink-500">{METHOD_DESC[t.method]}</div></td>
                  <td className="table-td tabular-nums">{t.minQuotations || '—'}</td>
                  <td className="table-td tabular-nums">{t.method === 'open_bid' ? 'Public advert' : t.invitedSuppliersMin ? `≥ ${t.invitedSuppliersMin}` : '—'}</td>
                  <td className="table-td tabular-nums">{t.deadlineWorkingDays ? `≥ ${t.deadlineWorkingDays} wd` : '—'}</td>
                  <td className="table-td tabular-nums">{t.committeeMin ? `≥ ${t.committeeMin}` : '—'}</td>
                  <td className="table-td"><div className="flex flex-wrap gap-1">{t.approvers.map((a, i) => <span key={i} className="rounded-pill bg-brand-100 px-2 py-0.5 text-[11.5px] font-medium text-brand-800">{i + 1}. {a.label}</span>)}{t.donorApproval && <span className="rounded-pill bg-sun-100 px-2 py-0.5 text-[11.5px] font-medium text-sun-700">+ Donor</span>}</div></td>
                  {canEdit && <td className="table-td"><div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => setEdit(t)}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-accent-700" onClick={() => removeTier(t.id)}><Trash2 size={14} /></button></div></td>}
                </tr>))}</tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Policy parameters" description="Other value-based rules from the SOPs">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Formal contract above (USD)" hint="Services & works — SOP-PRO-05 step 6"><input type="number" className="input" disabled={!canEdit} value={policy.contractThresholdUSD} onChange={(e) => setPolicy({ ...policy, contractThresholdUSD: Number(e.target.value) })} /></Field>
              <Field label="Legal review of contracts above (USD)"><input type="number" className="input" disabled={!canEdit} value={policy.legalReviewThresholdUSD} onChange={(e) => setPolicy({ ...policy, legalReviewThresholdUSD: Number(e.target.value) })} /></Field>
              <Field label="Sole-source / emergency: ED pre-approval above (USD)" hint="SOP-PRO-09 step 2"><input type="number" className="input" disabled={!canEdit} value={policy.soleSourceEdThresholdUSD} onChange={(e) => setPolicy({ ...policy, soleSourceEdThresholdUSD: Number(e.target.value) })} /></Field>
              <Field label="PO dual authorisation above (USD)" hint="SOP-PRO-05 step 3; enhanced supplier due diligence"><input type="number" className="input" disabled={!canEdit} value={policy.dualAuthThresholdUSD} onChange={(e) => setPolicy({ ...policy, dualAuthThresholdUSD: Number(e.target.value) })} /></Field>
            </div>
          </Card>
          <Card title="Exchange rates to USD" description="Used only to place a document in its tier. JOD is pegged at 0.709 per USD.">
            <div className="grid gap-4 sm:grid-cols-3">
              {(['JOD', 'USD', 'EUR'] as const).map((c) => <Field key={c} label={`1 ${c} = USD`}><input type="number" step="0.001" className="input" disabled={!canEdit || c === 'USD'} value={policy.fxToUSD[c]} onChange={(e) => setPolicy({ ...policy, fxToUSD: { ...policy.fxToUSD, [c]: Number(e.target.value) } })} /></Field>)}
            </div>
            <div className="mt-4 rounded-control bg-surface-sunken px-3 py-2 text-[12px] text-ink-600">Source: RHS Procurement SOPs v1.0 — prepared by Shatha Homsi (Director of Finance & Support), reviewed by Bilal Abbassi (Director of Programs), approved by Fawaz Al Shakaa (Executive Director), effective 1 January 2026.</div>
          </Card>
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Procurement tier" width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveTier}>Save tier</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tier name" required className="sm:col-span-3"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="From (USD)"><input type="number" className="input" value={edit.minUSD} onChange={(e) => setEdit({ ...edit, minUSD: Number(e.target.value) })} /></Field>
              <Field label="To (USD)" hint="Empty = no upper limit"><input type="number" className="input" value={edit.maxUSD ?? ''} onChange={(e) => setEdit({ ...edit, maxUSD: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label="Sourcing method"><select className="input" value={edit.method} onChange={(e) => setEdit({ ...edit, method: e.target.value as SourcingMethod })}>{METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></Field>
              <Field label="Minimum quotations / bids"><input type="number" min={0} className="input" value={edit.minQuotations} onChange={(e) => setEdit({ ...edit, minQuotations: Number(e.target.value) })} /></Field>
              <Field label="Issue to at least (suppliers)"><input type="number" min={0} className="input" value={edit.invitedSuppliersMin} onChange={(e) => setEdit({ ...edit, invitedSuppliersMin: Number(e.target.value) })} /></Field>
              <Field label="Submission period (working days)"><input type="number" min={0} className="input" value={edit.deadlineWorkingDays} onChange={(e) => setEdit({ ...edit, deadlineWorkingDays: Number(e.target.value) })} /></Field>
              <Field label="Evaluation committee (min members)"><input type="number" min={0} className="input" value={edit.committeeMin} onChange={(e) => setEdit({ ...edit, committeeMin: Number(e.target.value) })} /></Field>
              <Field label="Donor approval before PO"><select className="input" value={edit.donorApproval ? '1' : '0'} onChange={(e) => setEdit({ ...edit, donorApproval: e.target.value === '1' })}><option value="0">Not required</option><option value="1">Required</option></select></Field>
            </div>
            <div>
              <div className="label">Approval authority (PO / award) — in order</div>
              <ol className="space-y-2">{edit.approvers.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[12px] font-bold text-ink-500">{i + 1}</span>
                  <select className="input flex-1" value={s.role} onChange={(e) => { const role = e.target.value as Role; setEdit({ ...edit, approvers: edit.approvers.map((x, j) => (j === i ? { role, label: ROLE_LABEL[role] } : x)) }) }}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                  <input className="input flex-1" value={s.label} onChange={(e) => setEdit({ ...edit, approvers: edit.approvers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <button className="btn-ghost btn-sm" disabled={i === edit.approvers.length - 1} onClick={() => { const st = [...edit.approvers]; [st[i], st[i + 1]] = [st[i + 1]!, st[i]!]; setEdit({ ...edit, approvers: st }) }}><ArrowDown size={14} /></button>
                  <button className="btn-ghost btn-sm text-accent-700" onClick={() => setEdit({ ...edit, approvers: edit.approvers.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                </li>))}</ol>
              <button className="btn-secondary btn-sm mt-2" onClick={() => setEdit({ ...edit, approvers: [...edit.approvers, { role: 'finance_director', label: ROLE_LABEL.finance_director }] })}><Plus size={13} /> Add step</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

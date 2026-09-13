import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Send, ArrowLeft, Info } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { LineItemsEditor, AttachmentList, newLine, ProcessTracker } from '@/components/workflow'
import { DEPARTMENTS } from '@/data/seed'
import { fmtMoney, linesSubtotal } from '@/lib/format'
import { findRule } from '@/lib/workflow'
import { TierCard } from '@/components/tier'
import type { PurchaseRequisition } from '@/types'

export default function RequisitionForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { prs, createPR, updatePR, submitPR, rules, settings } = useStore()
  const existing = id ? prs.find((p) => p.id === id) : undefined
  const [draft, setDraft] = useState<Partial<PurchaseRequisition>>(() => existing ?? {
    title: '', justification: '', department: user.department, priority: 'normal', procurementType: 'goods', donorCode: '', neededBy: '', currency: settings.defaultCurrency, lines: [newLine()], attachments: [],
  })
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (existing) setDraft(existing) }, [existing?.id])

  const amount = linesSubtotal(draft.lines ?? [])
  const rule = useMemo(() => findRule(rules, 'PR', amount), [rules, amount])
  const set = (patch: Partial<PurchaseRequisition>) => setDraft((d) => ({ ...d, ...patch }))
  const editable = !existing || ['draft', 'returned'].includes(existing.status)

  if (existing && !editable) return <Alert tone="warning">This requisition can no longer be edited (status: {existing.status}).</Alert>

  const persist = () => {
    if (existing) { updatePR(existing.id, draft); return existing.id }
    return createPR(draft).id
  }
  const save = () => { const pid = persist(); nav(`/requisitions/${pid}`) }
  const submit = () => {
    const pid = persist()
    const r = submitPR(pid)
    if (!r.ok) { setErr(r.error ?? 'Could not submit'); return }
    nav(`/requisitions/${pid}`)
  }

  return (
    <>
      <PageHeader eyebrow={existing ? existing.number : 'New document'} title={existing ? (existing.status === 'returned' ? 'Revise & re-submit requisition' : 'Edit requisition') : 'New purchase requisition'}
        subtitle={`Owner: ${settings.orgShort} · Prepared by ${user.name}`}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-secondary" onClick={save}><Save size={15} /> Save draft</button>
          <button className="btn-primary" onClick={submit}><Send size={15} /> Submit for approval</button>
        </>} />

      <div className="card mb-6 px-5 py-4"><ProcessTracker current="pr" /></div>
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      {existing?.status === 'returned' && (
        <div className="mb-4"><Alert tone="warning"><b>Returned for changes.</b> {existing.approvalChain.find((s) => s.status === 'returned')?.comment}</Alert></div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Request details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required className="sm:col-span-2"><input className="input" value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="What are you requesting?" /></Field>
              <Field label="Business justification" required className="sm:col-span-2"><textarea className="input min-h-[96px]" value={draft.justification ?? ''} onChange={(e) => set({ justification: e.target.value })} placeholder="Why is this needed, which programme/beneficiaries does it serve, and what happens if it is not procured?" /></Field>
              <Field label="Department" required><select className="input" value={draft.department} onChange={(e) => set({ department: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
              <Field label="Procurement type" required hint="Services and works above USD 2,500 need a formal contract"><select className="input" value={draft.procurementType ?? 'goods'} onChange={(e) => set({ procurementType: e.target.value as PurchaseRequisition['procurementType'] })}><option value="goods">Goods</option><option value="services">Services</option><option value="works">Works</option></select></Field>
              <Field label="Donor / project code" hint="Leave empty for core funds"><input className="input" value={draft.donorCode ?? ''} onChange={(e) => set({ donorCode: e.target.value })} placeholder="e.g. GR-2025-IRB-03" /></Field>
              <Field label="Priority"><select className="input" value={draft.priority} onChange={(e) => set({ priority: e.target.value as PurchaseRequisition['priority'] })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
              <Field label="Needed by" required><input type="date" className="input" value={draft.neededBy ?? ''} onChange={(e) => set({ neededBy: e.target.value })} /></Field>
              <Field label="Currency"><select className="input" value={draft.currency} onChange={(e) => set({ currency: e.target.value as PurchaseRequisition['currency'] })}><option>JOD</option><option>USD</option><option>EUR</option></select></Field>
            </div>
          </Card>

          <Card title="Line items" description="Estimated prices — Procurement will replace these with quoted prices." padded={false}>
            <div className="p-4"><LineItemsEditor lines={draft.lines ?? []} onChange={(lines) => set({ lines })} currency={draft.currency ?? 'JOD'} /></div>
          </Card>

          <Card title="Supporting documents" description="Specifications, screenshots, previous invoices, programme plans.">
            <AttachmentList items={draft.attachments ?? []} onAdd={(a) => set({ attachments: [...(draft.attachments ?? []), a] })} onRemove={(aid) => set({ attachments: (draft.attachments ?? []).filter((a) => a.id !== aid) })} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Summary">
            <div className="text-[12px] uppercase tracking-[0.05em] text-ink-500">Estimated total</div>
            <div className="text-[26px] font-semibold text-ink-900">{fmtMoney(amount, draft.currency)}</div>
            <div className="mt-1 text-[12.5px] text-ink-500">{(draft.lines ?? []).length} line(s) · excl. tax</div>
            <hr className="my-4 border-line" />
            <div className="flex items-start gap-2 text-[12.5px] text-ink-600"><Info size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <div>Document owner: <b>{settings.orgShort} — Bilal Abbassi</b>. Requester: <b>{user.name}</b>.</div></div>
          </Card>
          <Card title="Approval route" description="Predicted from the approval matrix">
            {rule ? (
              <ol className="space-y-2">
                {rule.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 text-[13px]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">{i + 1}</span>
                    <span className="text-ink-800">{s.label}</span>
                  </li>
                ))}
                <li className="pt-2 text-[12px] text-ink-500">Rule: {rule.name} ({fmtMoney(rule.minAmount, draft.currency)} – {rule.maxAmount === null ? 'no limit' : fmtMoney(rule.maxAmount, draft.currency)})</li>
              </ol>
            ) : <Alert tone="warning">No approval rule covers this amount. Contact the administrator.</Alert>}
          </Card>
          <Card title="Procurement method" description="Resolved from the SOP thresholds (§3) on the estimated value">
            <TierCard amount={amount} currency={draft.currency ?? settings.defaultCurrency} procurementType={draft.procurementType ?? 'goods'} donorCode={draft.donorCode} />
          </Card>
        </div>
      </div>
    </>
  )
}

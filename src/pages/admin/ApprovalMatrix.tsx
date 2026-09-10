import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowDown } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Alert } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/workflow'
import { fmtMoney, uid } from '@/lib/format'
import type { ApprovalRule, DocType, Role } from '@/types'

const ROLES = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== 'requester')

export default function ApprovalMatrix() {
  const user = useCurrentUser()!
  const { rules, upsertRule, deleteRule, settings } = useStore()
  const [edit, setEdit] = useState<ApprovalRule | null>(null)
  const canEdit = user.role === 'admin'
  const ccy = settings.defaultCurrency

  const Section = ({ docType, title }: { docType: DocType; title: string }) => {
    const rs = rules.filter((r) => r.docType === docType).sort((a, b) => a.minAmount - b.minAmount)
    return (
      <Card title={title} description="Value bands are evaluated on the document subtotal (excl. tax)" padded={false}
        actions={canEdit && <button className="btn-secondary btn-sm" onClick={() => setEdit({ id: uid('r_'), name: '', docType, minAmount: 0, maxAmount: null, steps: [{ role: 'dept_manager', label: 'Department Manager' }] })}><Plus size={13} /> Add band</button>}>
        <table className="w-full text-[13px]">
          <thead><tr><th className="table-th">Rule</th><th className="table-th">From</th><th className="table-th">To</th><th className="table-th">Approval steps (in order)</th>{canEdit && <th className="table-th w-20" />}</tr></thead>
          <tbody>{rs.map((r) => (
            <tr key={r.id} className="hover:bg-surface-muted">
              <td className="table-td font-medium text-ink-900">{r.name}</td>
              <td className="table-td tabular-nums">{fmtMoney(r.minAmount, ccy)}</td>
              <td className="table-td tabular-nums">{r.maxAmount === null ? <span className="text-ink-500">No limit</span> : fmtMoney(r.maxAmount, ccy)}</td>
              <td className="table-td"><div className="flex flex-wrap items-center gap-1.5">{r.steps.map((s, i) => <span key={i} className="flex items-center gap-1.5"><span className="rounded-pill bg-brand-100 px-2 py-0.5 text-[12px] font-medium text-brand-800">{i + 1}. {s.label}</span>{i < r.steps.length - 1 && <span className="text-ink-300">→</span>}</span>)}</div></td>
              {canEdit && <td className="table-td"><div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => setEdit(r)}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Delete rule?') && deleteRule(r.id)}><Trash2 size={14} /></button></div></td>}
            </tr>))}</tbody>
        </table>
      </Card>
    )
  }

  return (
    <>
      <PageHeader title="Approval matrix" subtitle="Configure who approves what, by document type and value band. Chains are generated at submission time." />
      {!canEdit && <div className="mb-4"><Alert tone="info">Read-only view. Only administrators can change the approval matrix.</Alert></div>}
      <div className="space-y-6"><Section docType="PR" title="Purchase requisitions" /><Section docType="PO" title="Purchase orders" /><Section docType="INVOICE" title="Vendor invoices (payment approval)" /></div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Approval rule" width="max-w-2xl"
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.name.trim() || !edit.steps.length) return alert('Name and at least one step are required.'); upsertRule(edit!); setEdit(null) }}>Save rule</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Rule name" required className="sm:col-span-3"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Document"><select className="input" value={edit.docType} onChange={(e) => setEdit({ ...edit, docType: e.target.value as DocType })}><option value="PR">Requisition</option><option value="PO">Purchase order</option><option value="INVOICE">Invoice</option></select></Field>
              <Field label={`From (${ccy})`}><input type="number" className="input" value={edit.minAmount} onChange={(e) => setEdit({ ...edit, minAmount: Number(e.target.value) })} /></Field>
              <Field label={`To (${ccy})`} hint="Leave empty for no upper limit"><input type="number" className="input" value={edit.maxAmount ?? ''} onChange={(e) => setEdit({ ...edit, maxAmount: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            </div>
            <div>
              <div className="label">Approval steps</div>
              <ol className="space-y-2">{edit.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[12px] font-bold text-ink-500">{i + 1}</span>
                  <select className="input flex-1" value={s.role} onChange={(e) => { const role = e.target.value as Role; setEdit({ ...edit, steps: edit.steps.map((x, j) => (j === i ? { role, label: ROLE_LABEL[role] } : x)) }) }}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                  <input className="input flex-1" value={s.label} placeholder="Step label" onChange={(e) => setEdit({ ...edit, steps: edit.steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <button className="btn-ghost btn-sm" disabled={i === edit.steps.length - 1} onClick={() => { const st = [...edit.steps]; [st[i], st[i + 1]] = [st[i + 1]!, st[i]!]; setEdit({ ...edit, steps: st }) }}><ArrowDown size={14} /></button>
                  <button className="btn-ghost btn-sm text-accent-700" onClick={() => setEdit({ ...edit, steps: edit.steps.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                </li>))}</ol>
              <button className="btn-secondary btn-sm mt-2" onClick={() => setEdit({ ...edit, steps: [...edit.steps, { role: 'finance', label: ROLE_LABEL.finance }] })}><Plus size={13} /> Add step</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

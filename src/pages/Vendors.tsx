import { useState } from 'react'
import { Plus, Building2, Pencil, Search as SearchIcon } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState, Modal, Field } from '@/components/ui'
import { CATEGORIES } from '@/data/seed'
import { fmtDate } from '@/lib/format'
import type { Vendor } from '@/types'

export default function Vendors() {
  const user = useCurrentUser()!
  const { vendors, upsertVendor, prs, pos } = useStore()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Vendor> | null>(null)
  const canEdit = ['procurement_officer', 'procurement_manager', 'admin'].includes(user.role)
  const rows = vendors.filter((v) => !q || `${v.name} ${v.code} ${v.category} ${v.contactName}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title="Vendors" subtitle="Approved supplier register used for quotations and purchase orders."
        actions={canEdit && <button className="btn-primary" onClick={() => setEdit({ status: 'pending', rating: 3, country: 'Jordan', category: CATEGORIES[0] })}><Plus size={15} /> Register vendor</button>} />
      <div className="relative mb-4 max-w-md"><SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9" placeholder="Search vendors…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No vendors" icon={<Building2 size={22} />} /></div> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead><tr><th className="table-th">Vendor</th><th className="table-th">Category</th><th className="table-th">Contact</th><th className="table-th">Country</th><th className="table-th">Rating</th><th className="table-th">Quotes</th><th className="table-th">POs</th><th className="table-th">Status</th><th className="table-th">Since</th>{canEdit && <th className="table-th w-10" />}</tr></thead>
              <tbody>{rows.map((v) => (
                <tr key={v.id} className="hover:bg-surface-muted">
                  <td className="table-td"><div className="font-medium text-ink-900">{v.name}</div><div className="font-mono text-[11.5px] text-ink-500">{v.code} · Tax {v.taxId}</div></td>
                  <td className="table-td">{v.category}</td>
                  <td className="table-td"><div>{v.contactName}</div><div className="text-[11.5px] text-ink-500">{v.email}</div></td>
                  <td className="table-td">{v.country}</td>
                  <td className="table-td text-sun-700">{'★'.repeat(v.rating)}<span className="text-ink-300">{'★'.repeat(5 - v.rating)}</span></td>
                  <td className="table-td">{prs.reduce((s, p) => s + p.quotations.filter((x) => x.vendorId === v.id).length, 0)}</td>
                  <td className="table-td">{pos.filter((p) => p.vendorId === v.id).length}</td>
                  <td className="table-td"><StatusPill status={v.status} /></td>
                  <td className="table-td text-ink-500">{fmtDate(v.registeredAt)}</td>
                  {canEdit && <td className="table-td"><button className="btn-ghost btn-sm" onClick={() => setEdit(v)}><Pencil size={14} /></button></td>}
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit vendor' : 'Register vendor'} width="max-w-2xl"
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.name?.trim()) return alert('Vendor name is required.'); upsertVendor(edit!); setEdit(null) }}>Save</button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" required className="sm:col-span-2"><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Category"><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Status"><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Vendor['status'] })}><option value="pending">Pending vetting</option><option value="active">Active</option><option value="blocked">Blocked</option></select></Field>
            <Field label="Contact name"><input className="input" value={edit.contactName ?? ''} onChange={(e) => setEdit({ ...edit, contactName: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Country"><input className="input" value={edit.country ?? ''} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></Field>
            <Field label="Tax ID"><input className="input" value={edit.taxId ?? ''} onChange={(e) => setEdit({ ...edit, taxId: e.target.value })} /></Field>
            <Field label="Rating (1–5)"><input type="number" min={1} max={5} className="input" value={edit.rating ?? 3} onChange={(e) => setEdit({ ...edit, rating: Math.max(1, Math.min(5, Number(e.target.value))) })} /></Field>
          </div>
        )}
      </Modal>
    </>
  )
}

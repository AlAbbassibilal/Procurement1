import { useState } from 'react'
import { Plus, Pencil, Trash2, Mail, Phone, Globe } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Modal, Field } from '@/components/ui'
import { uid, nowIso, fmtMoney } from '@/lib/format'
import type { Donor, DonorContact } from '@/types'

const TYPES: Donor['type'][] = ['bilateral', 'multilateral', 'un', 'foundation', 'ingo', 'private', 'other']

export default function Donors() {
  const user = useCurrentUser()!
  const { donors, projects, upsertDonor, deleteDonor, settings } = useStore()
  const [edit, setEdit] = useState<Donor | null>(null)
  const canEdit = ['grants', 'admin'].length > 0 && ['admin', 'programs_director', 'executive_director', 'finance_director', 'procurement_manager'].includes(user.role)
  const blank = (): Donor => ({ id: uid('don_'), name: '', type: 'foundation', country: '', contacts: [{ id: uid('dc_'), name: '', title: '', email: '', phone: '', primary: true }], createdAt: nowIso() })
  const setC = (id: string, p: Partial<DonorContact>) => setEdit((d) => d && ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...p } : c)) }))
  return (
    <>
      <PageHeader title="Donor contacts" subtitle="Who funds what, who to call, and what each donor expects — kept current by the grants team."
        actions={canEdit && <button className="btn-primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add donor</button>} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {donors.map((d) => { const ps = projects.filter((p) => p.donorId === d.id); const primary = d.contacts.find((c) => c.primary) ?? d.contacts[0]; return (
          <Card key={d.id} title={d.name} description={`${d.type} · ${d.country}`} actions={canEdit && <div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => setEdit(d)}><Pencil size={13} /></button><button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Remove donor?') && deleteDonor(d.id)}><Trash2 size={13} /></button></div>}>
            {d.focus && <p className="mb-3 text-[12.5px] text-ink-600">{d.focus}</p>}
            {primary && <div className="rounded-control bg-surface-muted p-3 text-[12.5px]"><div className="font-medium text-ink-900">{primary.name} <span className="font-normal text-ink-500">· {primary.title}</span></div>{primary.email && <div className="flex items-center gap-1 text-ink-600"><Mail size={12} /> {primary.email}</div>}{primary.phone && <div className="flex items-center gap-1 text-ink-600"><Phone size={12} /> {primary.phone}</div>}{d.contacts.length > 1 && <div className="mt-1 text-[11px] text-ink-400">+{d.contacts.length - 1} more contact(s)</div>}</div>}
            {d.website && <div className="mt-2 flex items-center gap-1 text-[12px] text-ink-500"><Globe size={12} /> {d.website}</div>}
            <div className="mt-3 border-t border-line pt-2 text-[12px] text-ink-600">{ps.length} project(s) · {fmtMoney(ps.reduce((s, p) => s + (p.awardedAmount ?? 0), 0), settings.defaultCurrency)} awarded{ps.filter((p) => ['granted', 'active'].includes(p.stage)).length > 0 && ` · ${ps.filter((p) => ['granted', 'active'].includes(p.stage)).length} active`}</div>
            {d.notes && <div className="mt-2 text-[11.5px] text-ink-500">{d.notes}</div>}
          </Card>) })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={donors.some((d) => d.id === edit?.id) ? 'Edit donor' : 'Add donor'} width="max-w-2xl"
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.name.trim()) return alert('Donor name is required.'); upsertDonor(edit!); setEdit(null) }}>Save</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Donor name" required className="sm:col-span-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Type"><select className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Donor['type'] })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
              <Field label="Country"><input className="input" value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></Field>
              <Field label="Website"><input className="input" value={edit.website ?? ''} onChange={(e) => setEdit({ ...edit, website: e.target.value })} /></Field>
              <Field label="Funding focus"><input className="input" value={edit.focus ?? ''} onChange={(e) => setEdit({ ...edit, focus: e.target.value })} /></Field>
              <Field label="Notes (reporting rules, preferences)" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            </div>
            <div><div className="mb-2 flex items-center justify-between"><div className="label mb-0">Contacts</div><button className="btn-secondary btn-sm" onClick={() => setEdit({ ...edit, contacts: [...edit.contacts, { id: uid('dc_'), name: '', title: '', email: '', phone: '', primary: false }] })}><Plus size={13} /> Add contact</button></div>
              <div className="space-y-2">{edit.contacts.map((c) => <div key={c.id} className="grid gap-2 rounded-control border border-line p-2 sm:grid-cols-5"><input className="input" placeholder="Name" value={c.name} onChange={(e) => setC(c.id, { name: e.target.value })} /><input className="input" placeholder="Title" value={c.title} onChange={(e) => setC(c.id, { title: e.target.value })} /><input className="input" placeholder="Email" value={c.email} onChange={(e) => setC(c.id, { email: e.target.value })} /><input className="input" placeholder="Phone" value={c.phone} onChange={(e) => setC(c.id, { phone: e.target.value })} /><div className="flex items-center gap-2"><label className="flex items-center gap-1 text-[12px]"><input type="radio" name="primary" checked={c.primary} onChange={() => setEdit({ ...edit, contacts: edit.contacts.map((x) => ({ ...x, primary: x.id === c.id })) })} /> Primary</label><button className="btn-ghost btn-sm text-accent-700" onClick={() => setEdit({ ...edit, contacts: edit.contacts.filter((x) => x.id !== c.id) })}><Trash2 size={12} /></button></div></div>)}</div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

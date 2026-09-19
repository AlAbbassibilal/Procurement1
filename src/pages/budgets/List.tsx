import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Wallet, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useStore, useCurrentUser, attachmentFromFile } from '@/store/useStore'
import { Card, PageHeader, EmptyState, Stat } from '@/components/ui'
import { fmtMoney, fmtDate, cx } from '@/lib/format'
import { computeBvA } from '@/lib/budget'
import type { Attachment } from '@/types'

function TemplateSlot({ kind, label, hint, file, canEdit }: { kind: 'budget' | 'bva'; label: string; hint: string; file?: Attachment; canEdit: boolean }) {
  const user = useCurrentUser()!
  const { setTemplate } = useStore()
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-control border border-line bg-surface-muted p-3">
      <div className="text-[12.5px] font-semibold text-ink-900">{label}</div>
      <div className="mb-2 text-[11.5px] text-ink-500">{hint}</div>
      {file ? (
        <div className="flex items-center gap-2 text-[13px]"><FileSpreadsheet size={15} className="text-brand-600" />{file.dataUrl ? <a href={file.dataUrl} download={file.name} className="truncate font-medium text-brand-700 hover:underline">{file.name}</a> : <span className="truncate">{file.name}</span>}<span className="text-[11px] text-ink-400">· {file.uploadedBy} · {fmtDate(file.uploadedAt)}</span>{canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => setTemplate(kind, undefined)}><Trash2 size={13} /></button>}</div>
      ) : <div className="text-[12.5px] text-ink-400">Not uploaded yet.</div>}
      {canEdit && <><input ref={ref} type="file" accept=".xlsx,.xls,.csv,.docx,.pdf" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setTemplate(kind, await attachmentFromFile(f, user.name)); e.target.value = '' }} /><button className="btn-secondary btn-sm mt-2" onClick={() => ref.current?.click()}><Upload size={13} /> {file ? 'Replace' : 'Upload'} template</button></>}
    </div>
  )
}

export default function BudgetList() {
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { budgets, prs, pos, invoices, settings, deleteBudget } = useStore()
  const canEdit = ['finance', 'finance_director', 'programs_director', 'admin'].includes(user.role)
  const rows = budgets.map((b) => ({ b, ...computeBvA(b, prs, pos, invoices) }))
  const totalBudget = rows.reduce((s, r) => s + r.totals.budget, 0), totalSpent = rows.reduce((s, r) => s + r.totals.actual, 0), totalCommitted = rows.reduce((s, r) => s + r.totals.committed, 0)

  return (
    <>
      <PageHeader title="Budgets & BvA" subtitle="Approved project and grant budgets. Requisitions are charged to a project's budget lines; Budget-vs-Actual tracks requested, committed and paid amounts against each line."
        actions={canEdit && <Link to="/budgets/upload" className="btn-primary"><Upload size={15} /> Upload approved budget</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Approved budgets (all projects)" value={fmtMoney(totalBudget, settings.defaultCurrency)} tone="brand" />
        <Stat label="Committed on open POs" value={fmtMoney(totalCommitted, settings.defaultCurrency)} tone="sun" />
        <Stat label="Actual paid" value={fmtMoney(totalSpent, settings.defaultCurrency)} hint={totalBudget ? `${Math.round(((totalSpent + totalCommitted) / totalBudget) * 100)}% burn incl. commitments` : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Projects & grants" padded={false}>
            {rows.length === 0 ? <div className="p-5"><EmptyState title="No budgets yet" body="Upload an approved budget to start charging requisitions to it." icon={<Wallet size={22} />} action={canEdit && <Link to="/budgets/upload" className="btn-primary btn-sm">Upload budget</Link>} /></div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[820px] text-[13px]">
                  <thead><tr><th className="table-th">Project / donor code</th><th className="table-th">Period</th><th className="table-th text-right">Approved</th><th className="table-th text-right">Committed</th><th className="table-th text-right">Actual</th><th className="table-th w-48">Burn</th><th className="table-th">Lines</th>{canEdit && <th className="table-th w-10" />}</tr></thead>
                  <tbody>{rows.map(({ b, totals }) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/budgets/${b.id}`)}>
                      <td className="table-td"><div className="font-mono text-[12px] font-semibold text-brand-700">{b.donorCode}</div><div className="font-medium text-ink-900">{b.name}</div><div className="text-[11.5px] text-ink-500">{b.donor}{b.status === 'closed' && ' · closed'}</div></td>
                      <td className="table-td whitespace-nowrap text-ink-600">{fmtDate(b.startDate)} – {fmtDate(b.endDate)}</td>
                      <td className="table-td text-right font-medium tabular-nums">{fmtMoney(totals.budget, b.currency)}</td>
                      <td className="table-td text-right tabular-nums text-sun-700">{fmtMoney(totals.committed, b.currency)}</td>
                      <td className="table-td text-right tabular-nums text-ink-900">{fmtMoney(totals.actual, b.currency)}</td>
                      <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', totals.burnPct > 90 ? 'bg-accent-600' : totals.burnPct > 70 ? 'bg-sun-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, totals.burnPct)}%` }} /></div><span className="w-10 text-right tabular-nums text-ink-700">{totals.burnPct}%</span></div></td>
                      <td className="table-td tabular-nums">{b.lines.length}</td>
                      {canEdit && <td className="table-td"><button className="btn-ghost btn-sm text-accent-700" onClick={(e) => { e.stopPropagation(); if (confirm(`Remove budget ${b.donorCode}?`)) deleteBudget(b.id) }}><Trash2 size={14} /></button></td>}
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <Card title="Organisation templates" description="Reference files used when budgets are uploaded and BvA reports are produced">
          <div className="space-y-3">
            <TemplateSlot kind="budget" label="Approved budget template" hint="The layout Finance uses for approved budgets — the extractor is tuned to it." file={settings.templates.budget} canEdit={canEdit} />
            <TemplateSlot kind="bva" label="BvA template" hint="The Budget-vs-Actual report layout the export follows." file={settings.templates.bva} canEdit={canEdit} />
          </div>
          <div className="mt-3 text-[11.5px] text-ink-500">Excel (.xlsx) preferred. Stored in the system so every upload and export uses the same layout.</div>
        </Card>
      </div>
    </>
  )
}

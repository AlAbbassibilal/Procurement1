import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Receipt } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState, Tabs, Stat } from '@/components/ui'
import { fmtMoney, fmtDate, timeAgo, cx } from '@/lib/format'
import { invoiceTotals } from '@/lib/match'
import type { InvoiceStatus } from '@/types'

export default function InvoiceList() {
  const nav = useNavigate()
  const { invoices, settings } = useStore()
  const [tab, setTab] = useState<'open' | 'approved' | 'paid' | 'all'>('open')
  const openSet: InvoiceStatus[] = ['registered', 'matched', 'exception', 'pending_approval', 'returned']
  const rows = [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((i) => tab === 'all' || (tab === 'open' ? openSet.includes(i.status) : i.status === tab))
  const sum = (st: InvoiceStatus[]) => invoices.filter((i) => st.includes(i.status)).reduce((s, i) => s + invoiceTotals(i.lines, i.taxRate).total, 0)
  const overdue = invoices.filter((i) => !['paid', 'rejected'].includes(i.status) && new Date(i.dueDate) < new Date()).length

  return (
    <>
      <PageHeader title="Invoices & payments" subtitle="Vendor invoices are matched three ways — order, receipt, invoice — before Finance approves and releases payment."
        actions={<Link to="/invoices/new" className="btn-primary"><Plus size={15} /> Register invoice</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Exceptions to resolve" value={invoices.filter((i) => i.status === 'exception').length} tone="accent" />
        <Stat label="Awaiting approval" value={fmtMoney(sum(['pending_approval']), settings.defaultCurrency)} tone="sun" />
        <Stat label="Approved — to pay" value={fmtMoney(sum(['approved']), settings.defaultCurrency)} tone="brand" />
        <Stat label="Overdue" value={overdue} hint="past due date, unpaid" tone={overdue ? 'accent' : 'default'} />
      </div>
      <Tabs tabs={[{ id: 'open', label: 'Open', count: invoices.filter((i) => openSet.includes(i.status)).length }, { id: 'approved', label: 'Ready to pay', count: invoices.filter((i) => i.status === 'approved').length }, { id: 'paid', label: 'Paid' }, { id: 'all', label: 'All' }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        <Card padded={false}>
          {rows.length === 0 ? <div className="p-5"><EmptyState title="No invoices here" icon={<Receipt size={22} />} /></div> : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead><tr><th className="table-th">Invoice</th><th className="table-th">Vendor</th><th className="table-th">PO</th><th className="table-th">Invoice date</th><th className="table-th">Due</th><th className="table-th text-right">Total</th><th className="table-th">Match</th><th className="table-th">Status</th><th className="table-th">Updated</th></tr></thead>
                <tbody>{rows.map((i) => { const t = invoiceTotals(i.lines, i.taxRate); const late = !['paid', 'rejected'].includes(i.status) && new Date(i.dueDate) < new Date(); const blocks = i.matchIssues.filter((x) => x.severity === 'block').length; return (
                  <tr key={i.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/invoices/${i.id}`)}>
                    <td className="table-td"><div className="font-medium text-ink-900">{i.vendorInvoiceNo}</div><div className="font-mono text-[11.5px] text-ink-500">{i.number}</div></td>
                    <td className="table-td">{i.vendorName}</td><td className="table-td font-mono text-[12px]">{i.poNumber}</td>
                    <td className="table-td">{fmtDate(i.invoiceDate)}</td>
                    <td className={cx('table-td', late && 'font-medium text-accent-700')}>{fmtDate(i.dueDate)}{late && ' · overdue'}</td>
                    <td className="table-td text-right font-medium tabular-nums">{fmtMoney(t.total, i.currency)}</td>
                    <td className="table-td">{i.status === 'registered' ? <span className="text-ink-500">—</span> : blocks && i.status === 'exception' ? <span className="font-medium text-accent-700">{blocks} exception(s)</span> : i.matchOverrideReason ? <span className="text-sun-700">Overridden</span> : <span className="text-brand-700">✓ 3-way</span>}</td>
                    <td className="table-td"><StatusPill status={i.status} /></td>
                    <td className="table-td text-ink-500">{timeAgo(i.updatedAt)}</td>
                  </tr>) })}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

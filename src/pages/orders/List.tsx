import { useNavigate } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, StatusPill, EmptyState } from '@/components/ui'
import { fmtMoney, fmtDate, linesSubtotal, timeAgo } from '@/lib/format'

export default function OrderList() {
  const nav = useNavigate()
  const pos = useStore((s) => s.pos)
  const rows = [...pos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <>
      <PageHeader title="Purchase orders" subtitle="Orders raised from awarded quotations, routed for approval and issued to vendors." />
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No purchase orders yet" body="Award a quotation in Sourcing to raise the first PO." icon={<ShoppingCart size={22} />} /></div> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead><tr><th className="table-th">Order</th><th className="table-th">Vendor</th><th className="table-th">From PR</th><th className="table-th">Delivery</th><th className="table-th text-right">Excl. tax</th><th className="table-th text-right">Incl. tax</th><th className="table-th">Status</th><th className="table-th">Updated</th></tr></thead>
              <tbody>{rows.map((p) => { const sub = linesSubtotal(p.lines); return (
                <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/orders/${p.id}`)}>
                  <td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.number}</div></td>
                  <td className="table-td">{p.vendorName}</td><td className="table-td font-mono text-[12px]">{p.prNumber}</td>
                  <td className="table-td">{fmtDate(p.deliveryDate)}</td>
                  <td className="table-td text-right tabular-nums">{fmtMoney(sub, p.currency)}</td>
                  <td className="table-td text-right font-medium tabular-nums">{fmtMoney(sub * (1 + p.taxRate / 100), p.currency)}</td>
                  <td className="table-td"><StatusPill status={p.status} /></td>
                  <td className="table-td text-ink-500">{timeAgo(p.updatedAt)}</td>
                </tr>) })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

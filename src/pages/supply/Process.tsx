import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'

const PROCESSES: { title: string; purpose: string; steps: { who: string; what: string; doc: string; link?: string }[]; controls: string[] }[] = [
  { title: '1. Procure to stock', purpose: 'Everything bought follows one documented path from request to shelf, so each item can be traced back to the project and budget line that paid for it.', steps: [
    { who: 'Requester', what: 'Raises a purchase requisition with the project code and budget line; the SOP tier sets the sourcing method.', doc: 'PR-YYYY-NNNN', link: '/requisitions' },
    { who: 'Approvers', what: 'Approve according to the approval matrix (budget holder, Finance, directors by value).', doc: 'Approval chain', link: '/approvals' },
    { who: 'Supply Chain', what: 'Collects quotations or runs the bid, awards, issues the purchase order or contract.', doc: 'PO-YYYY-NNNN · CT-', link: '/orders' },
    { who: 'Receiving officer', what: 'Posts the goods receipt against the PO, chooses the warehouse, ticks asset lines, records the inbound waybill (carrier, driver, vehicle).', doc: 'GRN-YYYY-NNNN · WB-', link: '/receiving' },
    { who: 'System', what: 'Books stock lines into the warehouse ledger at PO cost and registers each asset unit with tag, PO, GRN, vendor, cost, project and budget line.', doc: 'SM- movements · RHS-A- tags', link: '/warehouses' },
    { who: 'Finance', what: 'Registers the invoice; the 3-way match (PO · GRN · invoice) releases payment; the BvA shows the actual on the budget line.', doc: 'INV- · BvA', link: '/invoices' },
  ], controls: ['No stock or asset without a GRN', 'Quantities received cannot exceed the PO', 'Asset lines create one record per unit', 'Stock valued at weighted average cost'] },
  { title: '2. Stock release (taking items out of a warehouse)', purpose: 'Items leave a warehouse only against an approved request that says who, why, where to and on which project.', steps: [
    { who: 'Requester (RHS number)', what: 'Submits a stock release request: warehouse, items and quantities (only what is in stock), purpose, destination, needed-by date, project and budget line.', doc: 'SR-YYYY-NNNN', link: '/stock-requests' },
    { who: 'Line manager', what: 'Approves the need (first approval).', doc: 'Approval 1' },
    { who: 'Supply Chain Manager', what: 'Approves availability and compliance (second approval).', doc: 'Approval 2' },
    { who: 'Warehouse manager', what: 'Issues the items (full or partial), records carrier, driver and vehicle; the system posts the issue movements and prints the outbound waybill.', doc: 'SM- issue · WB-', link: '/waybills' },
    { who: 'Receiver at destination', what: 'Confirms receipt on the waybill.', doc: 'WB- received' },
  ], controls: ['Balance cannot go negative', 'Two approvals before any issue', 'Every issue has a waybill and a project code'] },
  { title: '3. Transfers between warehouses and countries', purpose: 'Stock moving between locations stays visible in both ledgers and in transit.', steps: [
    { who: 'Warehouse manager (source)', what: 'Dispatches a transfer: items, quantities, transport details, project if applicable.', doc: 'WB- transfer · SM- out', link: '/warehouses' },
    { who: 'Warehouse manager (destination)', what: 'Confirms receipt; the stock is already on the destination ledger at the source cost, the waybill closes.', doc: 'WB- received · SM- in', link: '/waybills' },
  ], controls: ['Transfer out and transfer in always balance', 'The destination manager is notified on dispatch'] },
  { title: '4. Asset lifecycle', purpose: 'Each asset is identifiable, traceable to its funding, and always has a known location and custodian.', steps: [
    { who: 'Receiving officer', what: 'Registers the asset from the GRN (or manually for donations and legacy items): tag, serial, model, category, PO, GRN, vendor, cost, project, budget line, warehouse.', doc: 'RHS-A-NNNN', link: '/assets' },
    { who: 'Supply Chain', what: 'Hands over to a staff member (handover form noted on the record); the asset shows in the custodian\'s My HR.', doc: 'Assigned event', link: '/hr/me' },
    { who: 'Custodian / Supply Chain', what: 'Returns, transfers (office, field, partner, another warehouse and country), sends for repair, reports loss.', doc: 'Returned · Transferred · Repair · Lost' },
    { who: 'Supply Chain', what: 'Verifies physically at least once a year; the registry flags assets not verified for more than a year.', doc: 'Verified event' },
    { who: 'Supply Chain + donor', what: 'Disposes with the donor\'s agreement for project-funded assets, recording the approval reference.', doc: 'Disposed event' },
  ], controls: ['One record per unit', 'Project and budget line kept for donor reporting', 'Full history with who, when, where, waybill', 'Export of the registry and history'] },
  { title: '5. Fleet and transport requests', purpose: 'Vehicle use is requested, approved, assigned and costed — whether the passengers are staff or beneficiaries — and the cost reaches the project.', steps: [
    { who: 'Requester (RHS number)', what: 'Submits the transport request: passengers (staff with RHS numbers, or beneficiaries with references), from, to, date and time, return, purpose, project and budget line.', doc: 'TR-YYYY-NNNN', link: '/fleet' },
    { who: 'Line manager', what: 'Approves the need.', doc: 'Approval 1' },
    { who: 'Supply Chain Manager', what: 'Approves and assigns an available vehicle and driver.', doc: 'Approval 2 · assignment' },
    { who: 'Driver / dispatcher', what: 'Starts the trip with the odometer reading; the vehicle shows as on the road.', doc: 'Start' },
    { who: 'Supply Chain', what: 'Closes the trip with the return odometer, the cost (fuel, per diem, tolls) and its breakdown.', doc: 'Close' },
    { who: 'System', what: 'Posts the cost as an actual on the project\'s budget line in the BvA and notifies Finance.', doc: 'BvA actual', link: '/budgets' },
  ], controls: ['Staff passengers always carry an RHS number', 'Two approvals before assignment', 'Cost cannot be added before closing', 'Vehicle odometer updated from trips'] },
]

export default function Process() {
  return (
    <>
      <PageHeader eyebrow="Supply Chain" title="Process documentation" subtitle="How goods, assets and vehicles move through Restoring Hope Society — the steps, who does them, the documents produced, and the controls the system enforces. Document owner: Bilal Abbassi."
        actions={<button className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>} />
      <div className="space-y-6">{PROCESSES.map((p) => (
        <Card key={p.title} title={p.title} description={p.purpose}>
          <ol className="space-y-2">{p.steps.map((s, i) => <li key={i} className="grid gap-2 rounded-control border border-line p-3 sm:grid-cols-[32px_180px_1fr_200px] sm:items-start"><span className="flex h-7 w-7 items-center justify-center rounded-pill bg-brand-600 text-[12px] font-bold text-white">{i + 1}</span><span className="text-[13px] font-semibold text-ink-900">{s.who}</span><span className="text-[13px] text-ink-700">{s.what}</span><span className="text-[12px] text-ink-500">{s.link ? <Link to={s.link} className="font-mono text-brand-700 hover:underline">{s.doc}</Link> : <span className="font-mono">{s.doc}</span>}</span></li>)}</ol>
          <div className="mt-3 flex flex-wrap gap-1.5">{p.controls.map((c) => <span key={c} className="rounded-pill bg-brand-50 px-2.5 py-0.5 text-[11.5px] font-medium text-brand-800">✓ {c}</span>)}</div>
        </Card>))}</div>
    </>
  )
}

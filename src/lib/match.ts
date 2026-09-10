// ---------------------------------------------------------------------------
// Three-way match: Purchase order × Goods receipts × Vendor invoice
// ---------------------------------------------------------------------------
import type { GoodsReceipt, Invoice, InvoiceLine, MatchIssue, PurchaseOrder } from '@/types'

export function receivedQty(grns: GoodsReceipt[], poId: string, lineItemId: string) {
  return grns.filter((g) => g.poId === poId).reduce((s, g) => s + (g.lines.find((l) => l.lineItemId === lineItemId)?.quantity ?? 0), 0)
}
export function invoicedQty(invoices: Invoice[], poId: string, lineItemId: string, excludeId?: string) {
  return invoices.filter((i) => i.poId === poId && i.id !== excludeId && i.status !== 'rejected')
    .reduce((s, i) => s + (i.lines.find((l) => l.lineItemId === lineItemId)?.quantity ?? 0), 0)
}

export function receiptProgress(po: PurchaseOrder, grns: GoodsReceipt[]) {
  const ordered = po.lines.reduce((s, l) => s + l.quantity, 0)
  const received = po.lines.reduce((s, l) => s + Math.min(receivedQty(grns, po.id, l.id), l.quantity), 0)
  return { ordered, received, pct: ordered ? Math.round((received / ordered) * 100) : 0, complete: ordered > 0 && received >= ordered }
}

export function invoiceTotals(lines: InvoiceLine[], taxRate: number) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  return { subtotal, tax: subtotal * taxRate / 100, total: subtotal * (1 + taxRate / 100) }
}

export function runMatch(inv: Pick<Invoice, 'id' | 'poId' | 'lines' | 'taxRate' | 'vendorInvoiceNo' | 'vendorId'>, po: PurchaseOrder, grns: GoodsReceipt[], invoices: Invoice[], tolerancePct: number): MatchIssue[] {
  const issues: MatchIssue[] = []
  if (invoices.some((i) => i.id !== inv.id && i.vendorId === inv.vendorId && i.vendorInvoiceNo.trim().toLowerCase() === inv.vendorInvoiceNo.trim().toLowerCase() && i.status !== 'rejected'))
    issues.push({ kind: 'duplicate_invoice', severity: 'block', message: `Vendor invoice ${inv.vendorInvoiceNo} has already been registered.` })
  for (const il of inv.lines) {
    const pl = po.lines.find((l) => l.id === il.lineItemId)
    if (!pl || il.quantity <= 0) continue
    const rec = receivedQty(grns, po.id, pl.id)
    const already = invoicedQty(invoices, po.id, pl.id, inv.id)
    if (rec === 0) issues.push({ lineItemId: pl.id, kind: 'no_receipt', severity: 'block', message: `${pl.description}: no goods receipt recorded yet.` })
    else if (already + il.quantity > rec) issues.push({ lineItemId: pl.id, kind: 'qty_over_received', severity: 'block', message: `${pl.description}: invoiced ${already + il.quantity} exceeds received ${rec}.` })
    if (already + il.quantity > pl.quantity) issues.push({ lineItemId: pl.id, kind: 'qty_over_ordered', severity: 'block', message: `${pl.description}: invoiced ${already + il.quantity} exceeds ordered ${pl.quantity}.` })
    const variance = pl.unitPrice ? ((il.unitPrice - pl.unitPrice) / pl.unitPrice) * 100 : 0
    if (variance > tolerancePct) issues.push({ lineItemId: pl.id, kind: 'price_variance', severity: 'block', message: `${pl.description}: unit price ${il.unitPrice.toFixed(2)} is ${variance.toFixed(1)}% above PO price ${pl.unitPrice.toFixed(2)} (tolerance ${tolerancePct}%).` })
    else if (variance < -tolerancePct) issues.push({ lineItemId: pl.id, kind: 'price_variance', severity: 'warn', message: `${pl.description}: unit price is ${Math.abs(variance).toFixed(1)}% below PO price — confirm credit/discount.` })
  }
  const poTotal = po.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * (1 + po.taxRate / 100)
  const invoicedSoFar = invoices.filter((i) => i.poId === po.id && i.id !== inv.id && i.status !== 'rejected').reduce((s, i) => s + invoiceTotals(i.lines, i.taxRate).total, 0)
  if (invoicedSoFar + invoiceTotals(inv.lines, inv.taxRate).total > poTotal * (1 + tolerancePct / 100))
    issues.push({ kind: 'total_over_po', severity: 'block', message: `Cumulative invoiced amount would exceed the PO total (${poTotal.toFixed(2)}).` })
  return issues
}

export const hasBlockingIssues = (issues: MatchIssue[]) => issues.some((i) => i.severity === 'block')

// ---------------------------------------------------------------------------
// Supply Chain engine — stock balances, two-step approvals (line manager →
// supply chain), asset tags and lifecycle labels, fleet costing into the BvA.
// ---------------------------------------------------------------------------
import type { Asset, AssetCategory, AssetStatus, StaffMember, StockMovement, TripRequest, TwoStepApproval, User, Warehouse, Vehicle } from '@/types'

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = { it: 'IT & computing', medical: 'Medical & rehabilitation', workshop: 'Workshop & P&O equipment', vehicle: 'Vehicle', furniture: 'Furniture & fixtures', communications: 'Communications & media', other: 'Other' }
export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = { in_store: 'In store', in_use: 'In use', under_repair: 'Under repair', lost: 'Lost / stolen', disposed: 'Disposed' }
export const ASSET_STATUS_TONE: Record<AssetStatus, string> = { in_store: 'bg-info-50 text-info-700', in_use: 'bg-brand-100 text-brand-800', under_repair: 'bg-sun-100 text-sun-700', lost: 'bg-danger-50 text-danger-700', disposed: 'bg-ink-100 text-ink-500' }
export const RELEASE_STATUS_LABEL = { pending_approval: 'Pending approval', approved: 'Approved — to issue', issued: 'Issued', rejected: 'Rejected', cancelled: 'Cancelled' } as const
export const RELEASE_STATUS_TONE = { pending_approval: 'bg-sun-100 text-sun-700', approved: 'bg-info-50 text-info-700', issued: 'bg-brand-100 text-brand-800', rejected: 'bg-danger-50 text-danger-700', cancelled: 'bg-ink-100 text-ink-500' } as const
export const TRIP_STATUS_LABEL = { pending_approval: 'Pending approval', approved: 'Approved — to assign', assigned: 'Vehicle assigned', in_progress: 'On the road', closed: 'Closed', rejected: 'Rejected', cancelled: 'Cancelled' } as const
export const TRIP_STATUS_TONE = { pending_approval: 'bg-sun-100 text-sun-700', approved: 'bg-info-50 text-info-700', assigned: 'bg-brand-100 text-brand-800', in_progress: 'bg-brand-600 text-white', closed: 'bg-ink-200 text-ink-700', rejected: 'bg-danger-50 text-danger-700', cancelled: 'bg-ink-100 text-ink-500' } as const
export const WAYBILL_STATUS_TONE = { dispatched: 'bg-sun-100 text-sun-700', received: 'bg-brand-100 text-brand-800', cancelled: 'bg-ink-100 text-ink-500' } as const
export const MOVEMENT_LABEL = { receipt: 'Receipt (GRN)', issue: 'Issue (release)', transfer_out: 'Transfer out', transfer_in: 'Transfer in', adjustment: 'Adjustment', return: 'Return' } as const
export const VEHICLE_STATUS_LABEL = { available: 'Available', on_trip: 'On a trip', maintenance: 'Maintenance', disposed: 'Disposed' } as const

/** Line manager of the requester (by staff record), then the Supply Chain Manager. */
export function twoStepChain(requester: User, staff: StaffMember[], users: User[]): TwoStepApproval[] {
  const me = staff.find((s) => s.userId === requester.id)
  const mgr = staff.find((s) => s.id === me?.lineManagerId)
  const mgrUser = users.find((u) => u.id === mgr?.userId && u.active)
  const manager: TwoStepApproval = mgrUser && mgrUser.id !== requester.id
    ? { key: 'manager', label: `Line manager — ${mgr!.position}`, role: mgrUser.role, approverId: mgrUser.id, approverName: mgrUser.name, status: 'pending' }
    : { key: 'manager', label: 'Department Head / Line Manager', role: 'dept_manager', status: 'pending' }
  return [manager, { key: 'supply', label: 'Supply Chain Manager', role: 'procurement_manager', status: 'pending' }]
}
export const currentTwoStep = (a: TwoStepApproval[]) => a.find((x) => x.status === 'pending')
export const canDecideTwoStep = (a: TwoStepApproval[], user: User) => {
  const step = currentTwoStep(a); if (!step) return false
  if (user.role === 'admin') return true
  return step.approverId ? step.approverId === user.id : user.role === step.role || (user.approverRoles?.includes(step.role) ?? false)
}
export const applyTwoStep = (a: TwoStepApproval[], user: User, approve: boolean, note?: string, at = new Date().toISOString()) => {
  const idx = a.findIndex((x) => x.status === 'pending')
  const next = a.map((x, i) => (i === idx ? { ...x, status: approve ? 'approved' as const : 'rejected' as const, decidedBy: user.id, decidedByName: user.name, decidedAt: at, note } : x))
  return { approvals: next, done: approve && next.every((x) => x.status === 'approved'), rejected: !approve, next: approve ? next[idx + 1] : undefined }
}

// ---- stock ------------------------------------------------------------------
export const warehouseCode = (country: string, n: number) => `WH-${country.replace(/\(.*\)/, '').trim().slice(0, 3).toUpperCase()}-${String(n).padStart(2, '0')}`
/** Balance per item in a warehouse (sum of signed movements). */
export const stockBalance = (movements: StockMovement[], warehouseId: string, itemId: string) => movements.filter((m) => m.warehouseId === warehouseId && m.itemId === itemId).reduce((s, m) => s + m.quantity, 0)
export const balancesFor = (movements: StockMovement[], warehouses: Warehouse[]) => {
  const map: Record<string, Record<string, number>> = {}
  for (const m of movements) { (map[m.warehouseId] ??= {})[m.itemId] = ((map[m.warehouseId] ??= {})[m.itemId] ?? 0) + m.quantity }
  return warehouses.map((w) => ({ warehouse: w, items: map[w.id] ?? {} }))
}
/** Weighted average unit cost of the item from receipts (for valuing issues). */
export const avgCost = (movements: StockMovement[], itemId: string) => { const r = movements.filter((m) => m.itemId === itemId && m.quantity > 0 && m.unitCost); const q = r.reduce((s, m) => s + m.quantity, 0); return q ? r.reduce((s, m) => s + m.quantity * m.unitCost!, 0) / q : 0 }

// ---- assets ------------------------------------------------------------------
export const nextAssetTag = (assets: Asset[]) => `RHS-A-${String(assets.reduce((m, a) => Math.max(m, Number(a.tag.replace(/\D/g, '')) || 0), 0) + 1).padStart(4, '0')}`
export const assetsOf = (assets: Asset[], staffId: string) => assets.filter((a) => a.custodianStaffId === staffId && a.status !== 'disposed')
export const guessAssetCategory = (text: string): AssetCategory => { const t = text.toLowerCase(); if (/laptop|computer|printer|server|tablet|phone|monitor|router/.test(t)) return 'it'; if (/van|vehicle|car|truck|bus|pick-?up/.test(t)) return 'vehicle'; if (/prosthe|orthot|workshop|oven|router|grinder|vacuum|lamination|align/.test(t)) return 'workshop'; if (/wheelchair|physio|ultrasound|bed|medical|clinic|stimulat/.test(t)) return 'medical'; if (/desk|chair|cabinet|shelf|furniture/.test(t)) return 'furniture'; if (/camera|microphone|projector|speaker/.test(t)) return 'communications'; return 'other' }

// ---- fleet -------------------------------------------------------------------
export const tripCost = (t: TripRequest) => (t.status === 'closed' ? t.cost ?? 0 : 0)
/** Closed trips charged to a project — fed into the BvA as actuals on the trip's budget line. */
export const fleetActuals = (trips: TripRequest[], donorCode: string) => trips.filter((t) => t.status === 'closed' && t.projectCode === donorCode && (t.cost ?? 0) > 0).map((t) => ({ budgetLine: t.budgetLine || 'Transport', amount: t.cost!, ref: t.number }))
export const availableVehicles = (vehicles: Vehicle[], country?: string) => vehicles.filter((v) => v.status === 'available' && (!country || v.country === country))

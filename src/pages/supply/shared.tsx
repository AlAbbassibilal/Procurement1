import { useStore, useCurrentUser } from '@/store/useStore'
import { can } from '@/lib/permissions'
import { cx } from '@/lib/format'
import type { TwoStepApproval } from '@/types'

/** Supply-chain rights: officers, managers, logistics and admin manage stock, waybills, assets and fleet. */
export function useSupplyContext() {
  const user = useCurrentUser()!
  const { staff, warehouses } = useStore()
  const me = staff.find((s) => s.userId === user.id)
  // Function-level rights (Users & access → Permissions)
  const canStock = can(user, 'supply.stock.manage')
  const canRelease = can(user, 'supply.release.issue')
  const canAssets = can(user, 'supply.assets.manage')
  const canFleet = can(user, 'supply.fleet.manage')
  const canWaybills = can(user, 'supply.waybills.manage')
  const supplyManage = canStock || canRelease || canAssets || canFleet || canWaybills
  const managedWarehouses = warehouses.filter((w) => canStock || (me && w.managerStaffId === me.id))
  /** Issue stock from a warehouse: the release function, or the warehouse's own manager. */
  const canIssue = (warehouseId: string) => (canRelease || (!!me && warehouses.some((w) => w.id === warehouseId && w.managerStaffId === me.id)))
  return { user, me, supplyManage, managedWarehouses, canIssue, canStock, canRelease, canAssets, canFleet, canWaybills }
}

export function TwoStepTrail({ approvals }: { approvals: TwoStepApproval[] }) {
  return <ol className="flex flex-wrap gap-2 text-[11.5px]">{approvals.map((a, i) => <li key={a.key} className={cx('rounded-pill px-2 py-0.5 font-medium', a.status === 'approved' ? 'bg-brand-100 text-brand-800' : a.status === 'rejected' ? 'bg-danger-50 text-danger-700' : 'bg-surface-sunken text-ink-500')} title={a.decidedByName ? `${a.status} by ${a.decidedByName}${a.note ? ' — ' + a.note : ''}` : 'pending'}>{i + 1}. {a.approverName ?? a.label}{a.status === 'approved' ? ' ✓' : a.status === 'rejected' ? ' ✗' : ''}</li>)}</ol>
}

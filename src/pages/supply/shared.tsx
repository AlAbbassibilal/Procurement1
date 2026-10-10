import { useStore, useCurrentUser } from '@/store/useStore'
import { accessOf } from '@/lib/departments'
import { cx } from '@/lib/format'
import type { TwoStepApproval } from '@/types'

/** Supply-chain rights: officers, managers, logistics and admin manage stock, waybills, assets and fleet. */
export function useSupplyContext() {
  const user = useCurrentUser()!
  const { staff, warehouses } = useStore()
  const me = staff.find((s) => s.userId === user.id)
  const supplyManage = user.role === 'admin' || ['procurement_manager', 'procurement_officer', 'logistics'].includes(user.role) || accessOf(user, 'procurement') === 'manage'
  const managedWarehouses = warehouses.filter((w) => supplyManage || (me && w.managerStaffId === me.id))
  return { user, me, supplyManage, managedWarehouses, canIssue: (warehouseId: string) => managedWarehouses.some((w) => w.id === warehouseId) }
}

export function TwoStepTrail({ approvals }: { approvals: TwoStepApproval[] }) {
  return <ol className="flex flex-wrap gap-2 text-[11.5px]">{approvals.map((a, i) => <li key={a.key} className={cx('rounded-pill px-2 py-0.5 font-medium', a.status === 'approved' ? 'bg-brand-100 text-brand-800' : a.status === 'rejected' ? 'bg-danger-50 text-danger-700' : 'bg-surface-sunken text-ink-500')} title={a.decidedByName ? `${a.status} by ${a.decidedByName}${a.note ? ' — ' + a.note : ''}` : 'pending'}>{i + 1}. {a.approverName ?? a.label}{a.status === 'approved' ? ' ✓' : a.status === 'rejected' ? ' ✗' : ''}</li>)}</ol>
}

import { useStore, useCurrentUser } from '@/store/useStore'
import { accessOf } from '@/lib/departments'
import { reportsOf } from '@/lib/hr'
import type { StaffMember } from '@/types'

/** The signed-in user's HR context: own staff record, reports they line-manage, HR-manage rights. */
export function useHrContext() {
  const user = useCurrentUser()!
  const { staff } = useStore()
  const me = staff.find((s) => s.userId === user.id)
  const reports = me ? reportsOf(me.id, staff) : []
  const hrManage = user.role === 'admin' || user.role === 'hr' || accessOf(user, 'hr') === 'manage'
  const hrView = hrManage || accessOf(user, 'hr') !== 'none'
  const isManager = reports.length > 0
  /** Staff this user may act on as line manager or HR. */
  const canActOn = (s: StaffMember) => hrManage || (!!me && s.lineManagerId === me.id)
  const visibleStaff = hrView ? staff : [...(me ? [me] : []), ...reports]
  return { user, me, reports, hrManage, hrView, isManager, canActOn, visibleStaff }
}

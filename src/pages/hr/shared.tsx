import { useStore, useCurrentUser } from '@/store/useStore'
import { accessOf } from '@/lib/departments'
import { can } from '@/lib/permissions'
import { reportsOf } from '@/lib/hr'
import type { StaffMember } from '@/types'

/** The signed-in user's HR context: own staff record, reports they line-manage, HR-manage rights. */
export function useHrContext() {
  const user = useCurrentUser()!
  const { staff } = useStore()
  const me = staff.find((s) => s.userId === user.id)
  const reports = me ? reportsOf(me.id, staff) : []
  // Function-level rights (Users & access → Permissions); role defaults keep HR & Admin and administrators in charge.
  const canStaff = can(user, 'hr.staff.manage')
  const canDecideAny = can(user, 'hr.requests.decide_any')
  const canApproveTimesheets = can(user, 'hr.timesheets.approve')
  const canAdvertise = can(user, 'hr.recruitment.advertise')
  const canRaise = can(user, 'hr.recruitment.raise')
  /** Umbrella "HR manages" flag — true when the person holds any HR management function. */
  const hrManage = canStaff || canDecideAny || canApproveTimesheets || canAdvertise
  const hrView = hrManage || accessOf(user, 'hr') !== 'none'
  const isManager = reports.length > 0
  /** Staff this user may act on: their own reports as line manager, or anyone when they may decide for anyone. */
  const canActOn = (s: StaffMember) => canDecideAny || (!!me && s.lineManagerId === me.id)
  const visibleStaff = hrView ? staff : [...(me ? [me] : []), ...reports]
  return { user, me, reports, hrManage, hrView, isManager, canActOn, visibleStaff, canStaff, canDecideAny, canApproveTimesheets, canAdvertise, canRaise }
}

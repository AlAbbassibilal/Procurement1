import { Link, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useCurrentUser } from '@/store/useStore'
import { deptForPath } from '@/lib/departments'

export default function NoAccess() {
  const user = useCurrentUser()!
  const { pathname } = useLocation()
  const d = deptForPath(pathname)
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-ink-500"><Lock size={24} /></span>
      <h1 className="text-[20px] font-semibold text-ink-900">No access to {d?.name ?? 'this workspace'}</h1>
      <p className="mt-2 text-[13.5px] text-ink-600">{user.name}, your account does not have access to the {d?.name ?? ''} workspace. Ask the administrator to grant it under Users &amp; roles.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  )
}

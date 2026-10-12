import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Field, Alert, Avatar, KV } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/workflow'
import { passwordProblem } from '@/lib/auth'
import { fmtDateTime } from '@/lib/format'

/** My account — profile summary and password change. First sign-in with a temporary password lands here. */
export default function Account() {
  const user = useCurrentUser()!
  const nav = useNavigate(); const [sp] = useSearchParams()
  const { changePassword, staff } = useStore()
  const me = staff.find((s) => s.userId === user.id)
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('')
  const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState(false)
  const first = sp.get('first') === '1' || user.mustChangePassword
  const submit = () => {
    setErr(null)
    if (next !== again) return setErr('The two new passwords do not match.')
    const p = passwordProblem(next); if (p) return setErr(p)
    const r = changePassword(cur, next); if (!r.ok) return setErr(r.error ?? 'Could not change the password')
    setDone(true); setCur(''); setNext(''); setAgain(''); setTimeout(() => nav('/'), 900)
  }
  return (
    <>
      <PageHeader title="My account" subtitle="Your profile and sign-in details." />
      {first && !done && <div className="mb-4"><Alert tone="warning"><b>Welcome.</b> You signed in with a temporary password — please choose your own password before continuing.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <div className="mb-3 flex items-center gap-3"><Avatar name={user.name} color={user.avatarColor} size="lg" /><div><div className="text-[15px] font-semibold text-ink-900">{user.name}</div><div className="text-[12.5px] text-ink-500">{user.title} · {user.department}</div></div></div>
          <KV k="Email" v={user.email} /><KV k="Role" v={ROLE_LABEL[user.role]} />{me && <KV k="RHS number" v={me.rhsNumber} mono />}{user.passwordChangedAt && <KV k="Password changed" v={fmtDateTime(user.passwordChangedAt)} />}
          <p className="mt-3 text-[12px] text-ink-500">Name, role, workspace access and function permissions are managed by the administrator (Users & access).</p>
        </Card>
        <Card title="Change password" description="At least 8 characters, letters and numbers.">
          {done ? <Alert tone="success"><ShieldCheck size={14} className="mr-1 inline" /> Password changed. Taking you home…</Alert> : (
            <div className="space-y-3">
              {err && <Alert tone="danger">{err}</Alert>}
              <Field label={first ? 'Temporary password' : 'Current password'}><input type="password" className="input" data-testid="pw-current" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
              <Field label="New password"><input type="password" className="input" data-testid="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
              <Field label="Repeat new password"><input type="password" className="input" data-testid="pw-again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
              <button className="btn-primary" data-testid="pw-save" onClick={submit}><KeyRound size={15} /> Change password</button>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Logo } from '@/components/Logo'
import { Alert } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/workflow'

export default function Login() {
  const nav = useNavigate()
  const { login, users, settings } = useStore()
  const [email, setEmail] = useState('AlAbbassi.bilal@icloud.com')
  const [password, setPassword] = useState('rhs2025')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setTimeout(() => {
      const r = login(email, password)
      setBusy(false)
      if (!r.ok) return setErr(r.error ?? 'Sign-in failed')
      nav('/')
    }, 350)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — RHS green, sun pattern at ≤10% per guideline §9 */}
      <div className="relative hidden overflow-hidden bg-brand-600 text-white lg:flex lg:flex-col lg:justify-between p-12 pattern-sun">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sun-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-900/40 blur-3xl" />
        <div className="relative"><Logo inverse size="lg" /></div>
        <div className="relative max-w-md">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">Procurement Suite</div>
          <h1 className="text-[34px] font-semibold leading-[1.15] text-white">Transparent procurement, from request to contract.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            Raise requisitions, route them through the right approvals, compare three quotations, issue purchase orders and draft
            contracts — with an audit trail for every decision. Integrity and dignity in every purchase.
          </p>
          <ul className="mt-8 space-y-2.5 text-[13.5px] text-white/85">
            {['Role-based approval matrix by value band', 'Mandatory three-quotation comparison', 'PO approvals & vendor issuance', 'Contract drafting with legal review'].map((t) => (
              <li key={t} className="flex items-center gap-2.5"><ShieldCheck size={16} className="text-sun-500" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="relative text-[12px] text-white/60">{settings.orgName} · {settings.website}</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden"><Logo size="md" /></div>
          <h2 className="text-[24px] font-semibold text-ink-900">Sign in</h2>
          <p className="mt-1 text-[13.5px] text-ink-500">Use your RHS account to access the procurement system.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {err && <Alert tone="danger">{err}</Alert>}
            <label className="block">
              <span className="label">Email</span>
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <div className="relative">
                <input className="input pr-10" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" onClick={() => setShow((v) => !v)} aria-label="Toggle password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            <div className="flex items-center justify-between text-[12.5px]">
              <label className="flex items-center gap-2 text-ink-600"><input type="checkbox" className="accent-brand-600" defaultChecked /> Keep me signed in</label>
              <a className="text-brand-700 hover:underline" href="#" onClick={(e) => e.preventDefault()}>Forgot password?</a>
            </div>
            <button className="btn-primary btn-lg w-full" type="submit" disabled={busy}><LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <div className="mt-8 rounded-card border border-line bg-surface-muted p-4">
            <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">Demo accounts · password <span className="kbd">rhs2025</span></div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {users.filter((u) => u.active).map((u) => (
                <button key={u.id} type="button" onClick={() => { setEmail(u.email); setPassword(u.password); setErr(null) }}
                  className="flex items-center justify-between rounded-control px-2 py-1.5 text-left text-[12.5px] hover:bg-surface">
                  <span className="truncate text-ink-800">{u.name}</span><span className="ml-2 shrink-0 text-[11px] text-ink-400">{ROLE_LABEL[u.role]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

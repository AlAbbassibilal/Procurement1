import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Star, Briefcase, User, Lock, LayoutGrid, ArrowRight, CheckSquare, ListChecks, PenLine } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { DEPARTMENTS, canEnter, accessOf, ACCESS_LABEL } from '@/lib/departments'
import { recipientTurn } from '@/lib/esign'
import { canApprove, ROLE_LABEL } from '@/lib/workflow'
import { Logo, SunMark } from '@/components/Logo'
import { NotificationBell, UserMenu } from '@/components/HeaderMenus'
import { Avatar } from '@/components/ui'
import { cx } from '@/lib/format'
import type { Department } from '@/types'

type View = 'favorites' | 'work' | 'profile'

/** Line-art tile icons (thin strokes, brand accents) in the spirit of the launcher mock-up. */
const TILE_ICON: Record<Department, React.ReactNode> = {
  grants: <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M38 20h22l12 12v30H38z" /><path d="M60 20v12h12" /><path d="M46 44h18M46 52h18" /><path d="M12 66c8-8 16-8 22-2l8 4c4 2 8 0 12-2l10-6" /><path d="M12 80c10 2 18 0 26-6l20-8" /><path className="stroke-sun-500 fill-sun-500/20" d="M52 56l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" /></svg>,
  partnerships: <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="48" cy="26" r="8" className="stroke-sun-500 fill-sun-500/25" /><path className="stroke-sun-500" d="M48 10v4M60 15l-3 3M36 15l3 3M64 26h-4M32 26h4" /><path d="M10 52l14-8 14 6 10-6 14 8 14-8" /><path d="M24 44l-8 10 14 16 10 2 8-6" /><path d="M72 44l10 10-16 16-10 2" /><path d="M38 60l8 6M44 54l8 6M50 48l8 6" /></svg>,
  hr: <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="32" cy="34" r="9" /><circle cx="54" cy="30" r="9" /><path d="M14 68c0-12 8-20 18-20s18 8 18 20" /><path d="M46 46c10 0 18 8 18 20" /><rect x="64" y="22" width="20" height="30" rx="2" /><path d="M70 20h8v4h-8z" /><path d="M69 32h10M69 38h10M69 44h6" /></svg>,
  finance: <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="24" cy="46" rx="12" ry="4" /><path d="M12 46v8c0 2 5 4 12 4s12-2 12-4v-8M12 54v8c0 2 5 4 12 4s12-2 12-4v-8M12 62v8c0 2 5 4 12 4s12-2 12-4v-8" /><path d="M48 74h36" /><rect x="50" y="52" width="8" height="22" /><rect x="63" y="42" width="8" height="32" /><rect x="76" y="32" width="8" height="42" /><path d="M48 36l16-10 12 6 12-14" /><path d="M80 18h8v8" /></svg>,
  procurement: <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 24h8l8 30h26l6-20H22" /><path d="M24 54l-2 8h28" /><circle cx="28" cy="70" r="3" /><circle cx="46" cy="70" r="3" /><rect x="58" y="22" width="26" height="50" rx="2" /><path d="M66 20h10v5H66z" /><path d="M64 38h14M64 48h14M64 58h14" /><path d="M64 38l2 2 3-4M64 48l2 2 3-4" /></svg>,
  media: <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="16" width="14" height="30" rx="7" /><path d="M12 40c0 8 6 14 13 14s13-6 13-14" /><path d="M25 54v12M17 66h16" /><path d="M46 26c8-4 16-4 20 0v40c-4-4-12-4-20 0z" /><path d="M66 26c8-4 16-4 20 0v40c-4-4-12-4-20 0" /><path d="M50 34h12M50 42h12M70 34h12M70 42h12" /></svg>,
}

/** Faint prosthetic-leg line drawing behind the tiles (brand symbol, guideline §9 — low opacity). */
function Watermark() {
  return (
    <svg viewBox="0 0 200 520" className="pointer-events-none absolute -right-6 top-6 h-[88%] w-auto text-ink-900 opacity-[0.06]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M60 20c20-10 60-10 80 0 10 30 8 70 0 100-18 10-62 10-80 0-8-30-10-70 0-100z" />
      <path d="M70 125c10 20 50 20 60 0" />
      <path d="M100 135v40" /><path d="M78 180h44v14H78z" />
      <path d="M100 194v120" /><circle cx="100" cy="250" r="9" /><path d="M94 260v40M106 260v40" />
      <path d="M86 314h28v14H86z" /><path d="M100 328v60" />
      <path d="M90 388h20l4 22H86z" />
      <path d="M86 410h28l6 24c18 4 36 12 50 24l-2 10H58c-6-16 6-40 28-58z" />
      <path d="M70 448c20-4 40-2 56 8" />
    </svg>
  )
}

export default function Launcher() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { settings, favorites, toggleFavorite, prs, pos, invoices, contracts, tasks, envelopes, projects, setHomeLayout } = useStore()
  const [view, setView] = useState<View>('work')
  const [q, setQ] = useState('')
  const approvals = prs.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
    + pos.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
    + invoices.filter((i) => i.status === 'pending_approval' && canApprove(i.approvalChain, user)).length
    + (user.role === 'legal' ? contracts.filter((c) => c.status === 'legal_review').length : 0)
  const myTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done').length
  const toSign = envelopes.filter((e) => e.status === 'sent' && recipientTurn(e).some((r) => r.userId === user.id)).length
  const badge: Partial<Record<Department, number>> = { procurement: approvals, grants: myTasks || projects.filter((p) => p.managerId === user.id && p.stage === 'development').length }
  const platform = [
    { key: '/approvals', to: '/approvals', name: 'My approvals', icon: <CheckSquare size={44} strokeWidth={1.6} />, count: approvals },
    { key: '/tasks', to: '/tasks', name: 'My tasks', icon: <ListChecks size={44} strokeWidth={1.6} />, count: myTasks },
    { key: '/esign', to: '/esign', name: 'E-Signature', icon: <PenLine size={44} strokeWidth={1.6} />, count: toSign },
  ]
  const modules = useMemo(() => DEPARTMENTS.flatMap((d) => d.modules.filter((m) => !m.soon && m.to !== d.home).map((m) => ({ dept: d, ...m }))), [])
  const ql = q.trim().toLowerCase()
  const apps = DEPARTMENTS.filter((d) => !ql || d.name.toLowerCase().includes(ql) || d.short.toLowerCase().includes(ql))
  const hits = ql ? modules.filter((m) => m.label.toLowerCase().includes(ql) || m.dept.name.toLowerCase().includes(ql)) : []
  const favApps = DEPARTMENTS.filter((d) => favorites.includes(d.id)); const favMods = modules.filter((m) => favorites.includes(m.to)); const favPlatform = platform.filter((p) => favorites.includes(p.key))

  const Tile = ({ d }: { d: (typeof DEPARTMENTS)[number] }) => {
    const ok = canEnter(user, d.id); const fav = favorites.includes(d.id); const n = badge[d.id] ?? 0
    return (
      <div className="group relative">
        <button disabled={!ok} onClick={() => nav(d.home)} data-testid={`app-${d.id}`}
          className={cx('card flex h-[270px] w-full flex-col items-center justify-center gap-5 px-4 text-center transition-all', ok ? 'hover:-translate-y-1 hover:shadow-raised' : 'cursor-not-allowed opacity-60')}>
          <span className={cx('text-ink-900', !ok && 'text-ink-400')}>{ok ? TILE_ICON[d.id] : <Lock size={64} strokeWidth={1.4} />}</span>
          <span className="font-display text-[22px] font-bold leading-[1.15]"><span className="block text-accent-600">{settings.orgShort}</span><span className="block text-brand-600">{d.name}</span></span>
        </button>
        {n > 0 && ok && <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-pill bg-sun-500 px-1.5 text-[11.5px] font-bold text-ink-900" title={d.id === 'procurement' ? 'Awaiting your approval' : 'Open tasks / proposals'}>{n}</span>}
        <button onClick={() => toggleFavorite(d.id)} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} className={cx('absolute left-3 top-3 rounded-pill p-1.5 transition-opacity', fav ? 'text-sun-500 opacity-100' : 'text-ink-300 opacity-0 hover:text-sun-500 group-hover:opacity-100')}><Star size={18} fill={fav ? 'currentColor' : 'none'} /></button>
      </div>
    )
  }
  const SmallTile = ({ k, to, name, icon, count, sub }: { k: string; to: string; name: string; icon: React.ReactNode; count?: number; sub?: string }) => { const fav = favorites.includes(k); return (
    <div className="group relative">
      <Link to={to} className="card flex h-[150px] flex-col items-center justify-center gap-3 px-3 text-center transition-all hover:-translate-y-1 hover:shadow-raised">
        <span className="text-ink-800">{icon}</span><span className="text-[14px] font-semibold leading-tight text-ink-900">{name}{sub && <span className="block text-[11.5px] font-medium text-ink-500">{sub}</span>}</span>
      </Link>
      {!!count && <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-pill bg-sun-500 px-1.5 text-[11px] font-bold text-ink-900">{count}</span>}
      <button onClick={() => toggleFavorite(k)} aria-label="Toggle favourite" className={cx('absolute left-2 top-2 rounded-pill p-1 transition-opacity', fav ? 'text-sun-500 opacity-100' : 'text-ink-300 opacity-0 hover:text-sun-500 group-hover:opacity-100')}><Star size={15} fill={fav ? 'currentColor' : 'none'} /></button>
    </div>) }

  const NavItem = ({ v, icon, label }: { v: View; icon: React.ReactNode; label: string }) => (
    <button onClick={() => { setView(v); setQ('') }} className={cx('flex w-full items-center gap-4 rounded-control px-4 py-3 text-[17px] transition-colors', view === v ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-800 hover:bg-surface-muted')}>{icon}{label}</button>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-sunken">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-line bg-surface lg:flex" data-launcher-rail>
        <div className="flex h-[92px] items-center px-6"><Logo size="md" /></div>
        <nav className="space-y-1 px-4 pt-12">
          <NavItem v="favorites" icon={<Star size={24} strokeWidth={1.6} />} label="Favorites" />
          <NavItem v="work" icon={<Briefcase size={24} strokeWidth={1.6} />} label="Work" />
          <NavItem v="profile" icon={<User size={24} strokeWidth={1.6} />} label="Profile" />
        </nav>
        <div className="mt-auto px-6 pb-6">
          <div className="mb-6 flex items-end gap-2"><SunMark size={44} /><span className="font-display text-[44px] font-black leading-none tracking-tight"><span className="text-accent-600">RH</span><span className="text-brand-600">S</span></span></div>
          <div className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-500">{settings.tagline}</div>
          <button onClick={() => setHomeLayout('dashboard')} className="mt-5 flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-700 hover:underline"><LayoutGrid size={13} /> Back to the original home</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[92px] shrink-0 items-center gap-4 border-b border-line bg-surface px-5 lg:px-10">
          <div className="lg:hidden"><Logo size="sm" /></div>
          <label className="relative mx-auto w-full max-w-[660px]">
            <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input h-12 rounded-control pl-12 text-[16px]" placeholder={`Search for your ${settings.orgShort} apps.`} value={q} onChange={(e) => { setQ(e.target.value); if (view !== 'work') setView('work') }} aria-label="Search apps" />
          </label>
          <NotificationBell />
          <UserMenu />
        </header>

        <main className="relative flex-1 overflow-y-auto scrollbar-thin">
          <Watermark />
          <div className="relative mx-auto max-w-[1400px] px-5 py-8 lg:px-10">
            {view === 'work' && (
              <>
                <h2 className="mb-5 text-[20px] font-bold uppercase tracking-[0.02em] text-ink-900">{ql ? 'Search results' : 'My apps'}</h2>
                {apps.length > 0 && <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{apps.map((d) => <Tile key={d.id} d={d} />)}</div>}
                {ql && hits.length > 0 && <><h3 className="mb-3 mt-8 text-[14px] font-semibold uppercase tracking-[0.05em] text-ink-500">Pages</h3><div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{hits.map((m) => <SmallTile key={m.to} k={m.to} to={m.to} name={m.label} sub={m.dept.name} icon={<ArrowRight size={32} strokeWidth={1.6} />} />)}</div></>}
                {ql && apps.length === 0 && hits.length === 0 && <div className="card px-6 py-10 text-center text-[14px] text-ink-500">Nothing matches “{q}”.</div>}
                {!ql && <><h2 className="mb-5 mt-10 text-[20px] font-bold uppercase tracking-[0.02em] text-ink-900">My work</h2><div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{platform.map((p) => <SmallTile key={p.key} k={p.key} to={p.to} name={p.name} icon={p.icon} count={p.count} />)}</div></>}
              </>
            )}
            {view === 'favorites' && (
              <>
                <h2 className="mb-5 text-[20px] font-bold uppercase tracking-[0.02em] text-ink-900">Favorites</h2>
                {favApps.length === 0 && favMods.length === 0 && favPlatform.length === 0 ? <div className="card px-6 py-12 text-center text-[14px] text-ink-500"><Star size={28} className="mx-auto mb-2 text-sun-500" />No favourites yet — hover an app and click the star.</div> : (
                  <>
                    {favApps.length > 0 && <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{favApps.map((d) => <Tile key={d.id} d={d} />)}</div>}
                    {(favMods.length > 0 || favPlatform.length > 0) && <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{favPlatform.map((p) => <SmallTile key={p.key} k={p.key} to={p.to} name={p.name} icon={p.icon} count={p.count} />)}{favMods.map((m) => <SmallTile key={m.to} k={m.to} to={m.to} name={m.label} sub={m.dept.name} icon={<ArrowRight size={32} strokeWidth={1.6} />} />)}</div>}
                  </>
                )}
              </>
            )}
            {view === 'profile' && (
              <>
                <h2 className="mb-5 text-[20px] font-bold uppercase tracking-[0.02em] text-ink-900">Profile</h2>
                <div className="grid gap-6 xl:grid-cols-3">
                  <div className="card flex items-center gap-5 p-6 xl:col-span-1"><Avatar name={user.name} color={user.avatarColor} size="lg" /><div><div className="text-[18px] font-semibold text-ink-900">{user.name}</div><div className="text-[13px] text-ink-600">{user.title} · {user.department}</div><div className="text-[13px] text-ink-500">{user.email}</div><div className="mt-1 text-[12px] text-ink-500">{ROLE_LABEL[user.role]}{user.approverRoles?.length ? ` · also approves as ${user.approverRoles.map((r) => ROLE_LABEL[r]).join(', ')}` : ''}</div></div></div>
                  <div className="card p-6 xl:col-span-2"><div className="mb-3 text-[14px] font-semibold text-ink-900">Workspace access</div><ul className="divide-y divide-line">{DEPARTMENTS.map((d) => <li key={d.id} className="flex items-center justify-between py-2 text-[13.5px]"><span className="text-ink-800">{settings.orgShort} {d.name}</span><span className={cx('rounded-pill px-2 py-0.5 text-[11.5px] font-semibold', canEnter(user, d.id) ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-500')}>{ACCESS_LABEL[accessOf(user, d.id)]}</span></li>)}</ul><p className="mt-3 text-[12px] text-ink-500">Access is set by the administrator under Users & access.</p></div>
                </div>
              </>
            )}
          </div>
          <footer className="relative border-t border-line px-5 py-5 text-[13px] text-ink-600 lg:px-10">© {new Date().getFullYear()} {settings.orgShort} · Documents owned by Bilal Abbassi</footer>
        </main>
      </div>
    </div>
  )
}

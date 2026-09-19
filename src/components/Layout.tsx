import { useState, useMemo } from 'react'
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, FileText, CheckSquare, Search, ShoppingCart, FileSignature, Building2, Users, SlidersHorizontal,
  History, Bell, LogOut, ChevronDown, Menu, Settings, RotateCcw, ChevronsUpDown, PackageCheck, Receipt, Scale, Wallet,
} from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Logo, SunMark } from './Logo'
import { Avatar } from './ui'
import { cx, timeAgo } from '@/lib/format'
import { ROLE_LABEL, canApprove } from '@/lib/workflow'
import type { Role } from '@/types'

interface NavItem { to: string; label: string; icon: React.ReactNode; roles?: Role[]; badge?: number }

export default function Layout() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { logout, prs, pos, contracts, invoices, notifications, markRead, markAllRead, users, switchUser, settings, resetDemo } = useStore()
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const myApprovals = useMemo(
    () => prs.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
        + pos.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
        + invoices.filter((i) => i.status === 'pending_approval' && canApprove(i.approvalChain, user)).length
        + (user.role === 'legal' ? contracts.filter((c) => c.status === 'legal_review').length : 0),
    [prs, pos, contracts, invoices, user],
  )
  const sourcingCount = prs.filter((p) => p.status === 'approved' || p.status === 'sourcing').length
  const myNotifs = notifications.filter((n) => n.userId === user.id)
  const unread = myNotifs.filter((n) => !n.read).length

  const groups: { title: string; items: NavItem[] }[] = [
    { title: 'Overview', items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
      { to: '/approvals', label: 'My approvals', icon: <CheckSquare size={17} />, badge: myApprovals },
    ] },
    { title: 'Procure-to-pay', items: [
      { to: '/requisitions', label: 'Requisitions', icon: <FileText size={17} /> },
      { to: '/sourcing', label: 'Sourcing & quotations', icon: <Search size={17} />, roles: ['procurement_officer', 'procurement_manager', 'admin', 'executive_director', 'finance', 'finance_director', 'programs_director', 'dept_manager'], badge: sourcingCount },
      { to: '/orders', label: 'Purchase orders', icon: <ShoppingCart size={17} /> },
      { to: '/contracts', label: 'Contracts', icon: <FileSignature size={17} /> },
      { to: '/receiving', label: 'Goods receipt', icon: <PackageCheck size={17} />, badge: pos.filter((p) => ['issued', 'contracted', 'partially_received'].includes(p.status)).length },
      { to: '/invoices', label: 'Invoices & payments', icon: <Receipt size={17} />, roles: ['finance', 'finance_director', 'procurement_officer', 'procurement_manager', 'admin', 'executive_director', 'programs_director'], badge: invoices.filter((i) => i.status === 'exception').length },
    ] },
    { title: 'Masters', items: [
      { to: '/vendors', label: 'Vendors', icon: <Building2 size={17} /> },
      { to: '/budgets', label: 'Budgets & BvA', icon: <Wallet size={17} /> },
    ] },
    { title: 'Administration', items: [
      { to: '/admin/users', label: 'Users & roles', icon: <Users size={17} />, roles: ['admin'] },
      { to: '/admin/thresholds', label: 'Procurement thresholds', icon: <Scale size={17} />, roles: ['admin', 'procurement_manager', 'procurement_officer', 'finance', 'finance_director', 'programs_director', 'executive_director'] },
      { to: '/admin/approval-matrix', label: 'Approval matrix', icon: <SlidersHorizontal size={17} />, roles: ['admin', 'procurement_manager', 'finance', 'finance_director', 'programs_director'] },
      { to: '/admin/settings', label: 'Settings', icon: <Settings size={17} />, roles: ['admin'] },
      { to: '/audit', label: 'Audit trail', icon: <History size={17} />, roles: ['admin', 'finance', 'finance_director', 'programs_director', 'procurement_manager', 'executive_director', 'legal'] },
    ] },
  ]

  const Sidebar = (
    <aside className="flex h-full w-sidebar flex-col bg-ink-900 text-white">
      <div className="flex h-topbar items-center border-b border-white/10 px-5">
        <Logo inverse size="sm" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {groups.map((g) => {
          const items = g.items.filter((i) => !i.roles || i.roles.includes(user.role))
          if (!items.length) return null
          return (
            <div key={g.title} className="mb-5">
              <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/40">{g.title}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={() => setOpen(false)}
                  className={({ isActive }) => cx('group mb-0.5 flex items-center gap-2.5 rounded-control px-3 py-2 text-[13.5px] font-medium transition-colors',
                    isActive ? 'bg-brand-600 text-white' : 'text-white/75 hover:bg-white/8 hover:text-white')}>
                  <span className="opacity-90">{i.icon}</span>
                  <span className="flex-1">{i.label}</span>
                  {!!i.badge && <span className="rounded-pill bg-sun-500 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-900">{i.badge}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="rounded-control bg-white/5 px-3 py-2.5 text-[11.5px] text-white/60">
          <div className="font-semibold text-white/80">{settings.orgName}</div>
          <div>{settings.website}</div>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block shrink-0">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={18} /></button>
          <div className="hidden items-center gap-2 text-[13px] text-ink-500 sm:flex">
            <SunMark size={16} /> <span className="font-medium text-ink-700">Procurement Suite</span>
          </div>
          <div className="flex-1" />

          {/* Notifications */}
          <div className="relative">
            <button className="btn-ghost btn-sm relative" onClick={() => { setNotifOpen((v) => !v); setUserOpen(false) }} aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 z-40 mt-2 w-[360px] max-w-[92vw] rounded-card border border-line bg-surface shadow-raised animate-slide-up">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <div className="text-[13.5px] font-semibold">Notifications</div>
                    <button className="text-[12px] text-brand-700 hover:underline" onClick={markAllRead}>Mark all read</button>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
                    {myNotifs.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-ink-500">You're all caught up.</div>}
                    {myNotifs.slice(0, 30).map((n) => (
                      <button key={n.id} onClick={() => { markRead(n.id); setNotifOpen(false); nav(n.link) }}
                        className={cx('flex w-full gap-3 border-b border-line px-4 py-3 text-left hover:bg-surface-muted', !n.read && 'bg-brand-50/60')}>
                        <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', { approval: 'bg-sun-500', info: 'bg-info-500', success: 'bg-brand-600', warning: 'bg-accent-600' }[n.kind])} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-ink-900">{n.title}</span>
                          <span className="block truncate text-[12.5px] text-ink-600">{n.body}</span>
                          <span className="block text-[11px] text-ink-400">{timeAgo(n.at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button className="flex items-center gap-2.5 rounded-control px-2 py-1.5 hover:bg-ink-100" onClick={() => { setUserOpen((v) => !v); setNotifOpen(false) }}>
              <Avatar name={user.name} color={user.avatarColor} />
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-semibold leading-tight text-ink-900">{user.name}</span>
                <span className="block text-[11.5px] leading-tight text-ink-500">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronDown size={14} className="text-ink-400" />
            </button>
            {userOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserOpen(false)} />
                <div className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-line bg-surface shadow-raised animate-slide-up">
                  <div className="border-b border-line px-4 py-3">
                    <div className="text-[13.5px] font-semibold text-ink-900">{user.name}</div>
                    <div className="text-[12px] text-ink-500">{user.title} · {user.department}</div>
                    <div className="text-[12px] text-ink-500">{user.email}</div>
                  </div>
                  <div className="border-b border-line px-2 py-2">
                    <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400 flex items-center gap-1"><ChevronsUpDown size={11} /> Switch account (demo)</div>
                    <div className="max-h-52 overflow-y-auto scrollbar-thin">
                      {users.filter((u) => u.active).map((u) => (
                        <button key={u.id} onClick={() => { switchUser(u.id); setUserOpen(false); nav('/') }}
                          className={cx('flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-muted', u.id === user.id && 'bg-brand-50')}>
                          <Avatar name={u.name} color={u.avatarColor} size="sm" />
                          <span className="flex-1 truncate">{u.name}</span>
                          <span className="text-[11px] text-ink-400">{ROLE_LABEL[u.role]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-2">
                    <button className="btn-ghost btn-sm w-full justify-start" onClick={() => { if (confirm('Reset all demo data to the initial state?')) { resetDemo(); setUserOpen(false); nav('/') } }}><RotateCcw size={14} /> Reset demo data</button>
                    <button className="btn-ghost btn-sm w-full justify-start text-accent-700" onClick={() => { logout(); nav('/login') }}><LogOut size={14} /> Sign out</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
            <Outlet />
          </div>
          <footer className="px-6 pb-6 pt-2 text-center text-[11.5px] text-ink-400">
            {settings.orgName} · Procurement Suite · Documents owned by <Link to="/admin/settings" className="text-ink-600 hover:underline">Bilal Abbassi</Link>
          </footer>
        </main>
      </div>
    </div>
  )
}

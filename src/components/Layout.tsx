import { useState, useMemo, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid, FileText, CheckSquare, Search, ShoppingCart, FileSignature, Building2, Users, SlidersHorizontal,
  History, Menu, Settings, ChevronsUpDown, PackageCheck, Receipt, Scale, Wallet, Gauge, Lock, PenLine, ListChecks, HandCoins, Building, FolderPlus, Table2, Landmark, Globe2, PanelLeftClose, PanelLeftOpen, Handshake, ShieldCheck, IdCard, UserRound, CalendarDays, Clock, MapPin, Banknote,
} from 'lucide-react'
import { DEPARTMENTS, deptForPath, canEnter, ACCESS_LABEL, accessOf } from '@/lib/departments'
import { DEPT_ICON } from '@/pages/Home'
import { recipientTurn } from '@/lib/esign'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Logo, SunMark } from './Logo'
import { useUiTheme } from '@/lib/ui-theme'
import { NotificationBell, UserMenu } from './HeaderMenus'
import Launcher from '@/pages/Launcher'
import { cx } from '@/lib/format'
import { canApprove } from '@/lib/workflow'
import type { Role } from '@/types'

interface NavItem { to: string; label: string; icon: React.ReactNode; roles?: Role[]; badge?: number; soon?: boolean }

export default function Layout() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { pathname } = useLocation()
  const dept = deptForPath(pathname)
  const { prs, pos, contracts, invoices, envelopes, tasks, runReminders, country, setCountry, masterBudgets, settings, uiTheme, sidebarCollapsed, toggleSidebar, homeLayout, staff } = useStore()
  useUiTheme()
  const modern = uiTheme === 'modern'
  const [open, setOpen] = useState(false)

  const myApprovals = useMemo(
    () => prs.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
        + pos.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
        + invoices.filter((i) => i.status === 'pending_approval' && canApprove(i.approvalChain, user)).length
        + (user.role === 'legal' ? contracts.filter((c) => c.status === 'legal_review').length : 0),
    [prs, pos, contracts, invoices, user],
  )
  const sourcingCount = prs.filter((p) => p.status === 'approved' || p.status === 'sourcing').length

  const ICONS: Record<string, React.ReactNode> = {
    '/requisitions': <FileText size={17} />, '/sourcing': <Search size={17} />, '/orders': <ShoppingCart size={17} />, '/contracts': <FileSignature size={17} />,
    '/receiving': <PackageCheck size={17} />, '/vendors': <Building2 size={17} />, '/admin/thresholds': <Scale size={17} />, '/invoices': <Receipt size={17} />,
    '/budgets': <Wallet size={17} />, '/admin/approval-matrix': <SlidersHorizontal size={17} />,
    '/finance/master-budget': <Landmark size={17} />, '/partnerships/partners': <Handshake size={17} />, '/finance/salary-plan': <IdCard size={17} />, '/hr/me': <UserRound size={17} />, '/hr/staff': <Users size={17} />, '/hr/requests': <CalendarDays size={17} />, '/hr/timesheets': <Clock size={17} />, '/hr/attendance': <MapPin size={17} />, '/hr/payroll': <Banknote size={17} />, '/partnerships/due-diligence': <ShieldCheck size={17} />, '/grants/tracker': <Table2 size={17} />, '/grants/new': <FolderPlus size={17} />, '/grants/donors': <Building size={17} />, '/grants': <HandCoins size={17} />,
  }
  const BADGES: Record<string, number> = {
    '/sourcing': sourcingCount, '/receiving': pos.filter((p) => ['issued', 'contracted', 'partially_received'].includes(p.status)).length, '/invoices': invoices.filter((i) => i.status === 'exception').length,
  }
  // Users without workspace access who reach a shared page (My HR, team pages for line managers) only see the pages they can open
  const myStaff = staff.find((x) => x.userId === user.id)
  const lineManager = !!myStaff && staff.some((x) => x.lineManagerId === myStaff.id)
  const allowedWithoutAccess = new Set(['/hr/me', ...(lineManager ? ['/hr/requests', '/hr/timesheets', '/hr/attendance'] : [])])
  const deptItems: NavItem[] = dept ? dept.modules.filter((m, i, arr) => arr.findIndex((x) => x.to === m.to) === i).filter((m) => canEnter(user, dept.id) || allowedWithoutAccess.has(m.to)).map((m) => ({
    to: m.to, label: m.to === dept.home ? 'Overview' : m.label, icon: m.to === dept.home ? <Gauge size={17} /> : (ICONS[m.to] ?? <FileText size={17} />), badge: BADGES[m.to], soon: m.soon,
  })) : []
  const groups: { title: string; items: NavItem[] }[] = [
    { title: 'Platform', items: [
      { to: '/', label: 'Home', icon: <LayoutGrid size={17} /> },
      { to: '/approvals', label: 'My approvals', icon: <CheckSquare size={17} />, badge: myApprovals },
      { to: '/esign', label: 'E-Signature', icon: <PenLine size={17} />, badge: envelopes.filter((e) => e.status === 'sent' && recipientTurn(e).some((r) => r.userId === user.id)).length },
      { to: '/tasks', label: 'My tasks', icon: <ListChecks size={17} />, badge: tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done').length },
      ...(dept?.id === 'hr' ? [] : [{ to: '/hr/me', label: 'My HR', icon: <UserRound size={17} /> }]),
      ...(masterBudgets.some((m) => m.lines.some((l) => l.budgetHolderId === user.id)) && !canEnter(user, 'finance') ? [{ to: '/finance/master-budget', label: 'My budget lines', icon: <Landmark size={17} /> }] : []),
    ] },
    ...(dept ? [{ title: dept.name, items: deptItems }] : []),
    { title: 'Administration', items: [
      { to: '/admin/users', label: 'Users & access', icon: <Users size={17} />, roles: ['admin'] },
      { to: '/admin/settings', label: 'Settings', icon: <Settings size={17} />, roles: ['admin'] },
      { to: '/audit', label: 'Audit trail', icon: <History size={17} />, roles: ['admin', 'finance', 'finance_director', 'programs_director', 'procurement_manager', 'executive_director', 'legal'] },
    ] },
  ]
  const [deptOpen, setDeptOpen] = useState(false)
  useEffect(() => { runReminders(); const t = setInterval(runReminders, 30 * 60 * 1000); return () => clearInterval(t) }, [runReminders])

  // Ctrl/⌘ + B toggles the sidebar (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) { e.preventDefault(); toggleSidebar() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  // Skin-specific classes for the sidebar chrome. Classic = dark navy rail (original), Modern = light rail.
  const S = modern ? {
    aside: 'bg-surface text-ink-800 border-r border-line', logoInverse: false, logoBar: 'border-b border-line',
    switcher: 'bg-surface-muted hover:bg-ink-100', switcherTitle: 'text-ink-900', switcherSub: 'text-ink-500', chevron: 'text-ink-400', neutralTile: 'bg-ink-100 text-ink-700',
    group: 'text-ink-400', divider: 'border-line', soon: 'text-ink-400', soonPill: 'border-ink-300',
    active: 'bg-brand-600 text-white shadow-raised', idle: 'text-ink-600 hover:bg-brand-50 hover:text-ink-900',
    foot: 'border-t border-line', footBox: 'bg-surface-muted text-ink-500', footTitle: 'text-ink-700', collapse: 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
  } : {
    aside: 'bg-ink-900 text-white', logoInverse: true, logoBar: 'border-b border-white/10',
    switcher: 'bg-white/8 hover:bg-white/12', switcherTitle: 'text-white', switcherSub: 'text-white/50', chevron: 'text-white/50', neutralTile: 'bg-white/15 text-white',
    group: 'text-white/40', divider: 'border-white/10', soon: 'text-white/35', soonPill: 'border-white/25',
    active: 'bg-brand-600 text-white', idle: 'text-white/75 hover:bg-white/8 hover:text-white',
    foot: 'border-t border-white/10', footBox: 'bg-white/5 text-white/60', footTitle: 'text-white/80', collapse: 'text-white/60 hover:bg-white/10 hover:text-white',
  }

  const renderSidebar = (collapsed: boolean) => (
    <aside data-sidebar className={cx('flex h-full flex-col transition-[width] duration-200', collapsed ? 'w-[68px]' : 'w-sidebar', S.aside)}>
      <div className={cx('flex h-topbar shrink-0 items-center', S.logoBar, collapsed ? 'justify-center' : 'px-5')}>
        {collapsed ? <SunMark size={24} /> : <Logo inverse={S.logoInverse} size="sm" />}
      </div>
      <div className={cx('relative pt-3', collapsed ? 'px-2.5' : 'px-3')}>
        <button className={cx('flex w-full items-center gap-2.5 rounded-control text-left', S.switcher, collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2')} onClick={() => setDeptOpen((v) => !v)}
          title={collapsed ? (dept ? `${dept.name} — switch workspace` : 'Choose a workspace') : undefined} aria-label="Switch workspace">
          <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-control [&>svg]:h-4 [&>svg]:w-4', dept ? dept.tone.tile : S.neutralTile)}>{dept ? DEPT_ICON[dept.id] : <LayoutGrid size={16} />}</span>
          {!collapsed && <>
            <span className="min-w-0 flex-1"><span className={cx('block truncate text-[13px] font-semibold', S.switcherTitle)}>{dept ? dept.name : 'All workspaces'}</span><span className={cx('block truncate text-[11px]', S.switcherSub)}>{dept ? `Workspace · ${ACCESS_LABEL[accessOf(user, dept.id)]}` : 'Choose a workspace'}</span></span>
            <ChevronsUpDown size={14} className={S.chevron} />
          </>}
        </button>
        {deptOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDeptOpen(false)} />
            <div className={cx('absolute z-40 mt-1 rounded-card border border-line bg-surface p-1.5 text-ink-900 shadow-overlay animate-slide-up', collapsed ? 'left-2 w-64' : 'left-3 right-3')}>
              {DEPARTMENTS.map((d) => { const ok = canEnter(user, d.id); return (
                <button key={d.id} disabled={!ok} onClick={() => { setDeptOpen(false); setOpen(false); nav(d.home) }}
                  className={cx('flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-[12.5px]', ok ? 'hover:bg-surface-muted' : 'cursor-not-allowed opacity-50', dept?.id === d.id && 'bg-brand-50')}>
                  <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-control [&>svg]:h-3.5 [&>svg]:w-3.5', ok ? d.tone.tile : 'bg-ink-200 text-ink-500')}>{ok ? DEPT_ICON[d.id] : <Lock size={12} />}</span>
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <span className="text-[10.5px] text-ink-400">{ACCESS_LABEL[accessOf(user, d.id)]}</span>
                </button>) })}
            </div>
          </>
        )}
      </div>
      <nav className={cx('flex-1 overflow-y-auto py-4 scrollbar-thin', collapsed ? 'px-2.5' : 'px-3')}>
        {groups.map((g, gi) => {
          const items = g.items.filter((i) => !i.roles || i.roles.includes(user.role))
          if (!items.length) return null
          return (
            <div key={g.title} className={collapsed ? 'mb-3' : 'mb-5'}>
              {collapsed
                ? gi > 0 && <div className={cx('mx-2 mb-3 border-t', S.divider)} />
                : <div className={cx('mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em]', S.group)}>{g.title}</div>}
              {items.map((i) => i.soon ? (
                <div key={i.to} title={collapsed ? `${i.label} (soon)` : undefined} className={cx('mb-0.5 flex items-center rounded-control font-medium', S.soon, collapsed ? 'h-10 justify-center' : 'gap-2.5 px-3 py-2 text-[13.5px]')}>
                  <span className="opacity-70">{i.icon}</span>
                  {!collapsed && <><span className="flex-1">{i.label}</span><span className={cx('rounded-pill border border-dashed px-1.5 text-[10px]', S.soonPill)}>soon</span></>}
                </div>
              ) : (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={() => setOpen(false)} title={collapsed ? i.label : undefined} aria-label={i.label}
                  className={({ isActive }) => cx('group relative mb-0.5 flex items-center rounded-control font-medium transition-colors', collapsed ? 'h-10 justify-center' : 'gap-2.5 px-3 py-2 text-[13.5px]', isActive ? S.active : S.idle)}>
                  <span className="opacity-90">{i.icon}</span>
                  {!collapsed && <span className="flex-1">{i.label}</span>}
                  {!!i.badge && <span className={cx('rounded-pill bg-sun-500 font-bold text-ink-900', collapsed ? 'absolute right-1 top-1 min-w-[16px] px-1 text-center text-[9.5px] leading-4' : 'px-1.5 py-0.5 text-[10.5px]')}>{i.badge}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
      <div className={cx('p-3', S.foot)}>
        {!collapsed && (
          <div className={cx('mb-2 rounded-control px-3 py-2.5 text-[11.5px]', S.footBox)}>
            <div className={cx('font-semibold', S.footTitle)}>{settings.orgName}</div>
            <div>{settings.website}</div>
          </div>
        )}
        <button onClick={toggleSidebar} data-testid="sidebar-toggle" title={`${collapsed ? 'Show' : 'Hide'} sidebar (Ctrl+B)`} aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
          className={cx('hidden w-full items-center rounded-control text-[12.5px] font-medium transition-colors lg:flex', S.collapse, collapsed ? 'h-9 justify-center' : 'gap-2 px-3 py-2')}>
          {collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /><span className="flex-1 text-left">Hide sidebar</span><span className="text-[10.5px] opacity-60">Ctrl+B</span></>}
        </button>
      </div>
    </aside>
  )

  if (homeLayout === 'launcher' && pathname === '/') return <Launcher />

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block shrink-0">{renderSidebar(sidebarCollapsed)}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{renderSidebar(false)}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-topbar className="flex h-topbar shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={18} /></button>
          <button className="btn-ghost btn-sm hidden lg:inline-flex" onClick={toggleSidebar} title={`${sidebarCollapsed ? 'Show' : 'Hide'} sidebar (Ctrl+B)`} aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}>
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="hidden items-center gap-2 text-[13px] text-ink-500 sm:flex">
            <SunMark size={16} /> <span className="font-medium text-ink-700">PCM & Grants Management Platform</span>{dept && <span className="text-ink-400">/ {dept.name}</span>}
          </div>
          <div className="flex-1" />

          {/* Country context */}
          <label className="hidden items-center gap-1.5 rounded-control border border-line bg-surface-muted px-2 py-1 text-[12.5px] text-ink-700 md:flex" title="Country context — filters master budget, projects and tracker">
            <Globe2 size={14} className="text-ink-500" />
            <select className="bg-transparent text-[12.5px] font-medium outline-none" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">All countries</option>
              {settings.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <NotificationBell />
          <UserMenu />
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
            <Outlet />
          </div>
          <footer className="px-6 pb-6 pt-2 text-center text-[11.5px] text-ink-400">
            {settings.orgName} · PCM & Grants Management Platform · Documents owned by <Link to="/admin/settings" className="text-ink-600 hover:underline">Bilal Abbassi</Link>
          </footer>
        </main>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, ChevronDown, RotateCcw, ChevronsUpDown, Sparkles, Monitor, LayoutGrid, Grid2x2 } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Avatar } from './ui'
import { cx, timeAgo } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/workflow'

/** Notification bell + dropdown — shared by the classic shell and the app launcher. */
export function NotificationBell() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { notifications, markRead, markAllRead } = useStore()
  const [open, setOpen] = useState(false)
  const myNotifs = notifications.filter((n) => n.userId === user.id)
  const unread = myNotifs.filter((n) => !n.read).length
  return (
    <div className="relative">
      <button className="btn-ghost btn-sm relative" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[360px] max-w-[92vw] rounded-card border border-line bg-surface shadow-raised animate-slide-up">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="text-[13.5px] font-semibold">Notifications</div>
              <button className="text-[12px] text-brand-700 hover:underline" onClick={markAllRead}>Mark all read</button>
            </div>
            <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
              {myNotifs.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-ink-500">You're all caught up.</div>}
              {myNotifs.slice(0, 30).map((n) => (
                <button key={n.id} onClick={() => { markRead(n.id); setOpen(false); nav(n.link) }}
                  className={cx('flex w-full gap-3 border-b border-line px-4 py-3 text-left hover:bg-surface-muted', !n.read && 'bg-brand-50/60')}>
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', { approval: 'bg-sun-500', info: 'bg-info-500', success: 'bg-brand-600', warning: 'bg-accent-600', task: 'bg-brand-800', reminder: 'bg-accent-600' }[n.kind])} />
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
  )
}

/** Account menu: switch account (demo), interface skin, home screen, reset, sign out. */
export function UserMenu() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { users, switchUser, logout, resetDemo, uiTheme, setUiTheme, homeLayout, setHomeLayout } = useStore()
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="flex items-center gap-2.5 rounded-control px-2 py-1.5 hover:bg-ink-100" onClick={() => setOpen((v) => !v)} aria-label="Account menu">
        <Avatar name={user.name} color={user.avatarColor} />
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold leading-tight text-ink-900">{user.name}</span>
          <span className="block text-[11.5px] leading-tight text-ink-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-line bg-surface shadow-raised animate-slide-up">
            <div className="border-b border-line px-4 py-3">
              <div className="text-[13.5px] font-semibold text-ink-900">{user.name}</div>
              <div className="text-[12px] text-ink-500">{user.title} · {user.department}</div>
              <div className="text-[12px] text-ink-500">{user.email}</div>
            </div>
            <div className="border-b border-line px-2 py-2">
              <div className="flex items-center gap-1 px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400"><ChevronsUpDown size={11} /> Switch account (demo)</div>
              <div className="max-h-52 overflow-y-auto scrollbar-thin">
                {users.filter((u) => u.active).map((u) => (
                  <button key={u.id} onClick={() => { switchUser(u.id); setOpen(false); nav('/') }}
                    className={cx('flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-muted', u.id === user.id && 'bg-brand-50')}>
                    <Avatar name={u.name} color={u.avatarColor} size="sm" />
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="text-[11px] text-ink-400">{ROLE_LABEL[u.role]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-b border-line px-4 py-2.5">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">Interface</div>
              <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-muted p-1" role="radiogroup" aria-label="Interface">
                {(['classic', 'modern'] as const).map((t) => (
                  <button key={t} role="radio" aria-checked={uiTheme === t} onClick={() => setUiTheme(t)}
                    className={cx('flex items-center justify-center gap-1.5 rounded-control px-2 py-1.5 text-[12px] font-medium transition-colors', uiTheme === t ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-800')}>
                    {t === 'classic' ? <Monitor size={13} /> : <Sparkles size={13} />}{t === 'classic' ? 'Classic' : 'Modern'}
                  </button>
                ))}
              </div>
              <div className="mb-1.5 mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">Home screen</div>
              <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-muted p-1" role="radiogroup" aria-label="Home screen">
                {(['dashboard', 'launcher'] as const).map((t) => (
                  <button key={t} role="radio" aria-checked={homeLayout === t} onClick={() => { setHomeLayout(t); setOpen(false); nav('/') }}
                    className={cx('flex items-center justify-center gap-1.5 rounded-control px-2 py-1.5 text-[12px] font-medium transition-colors', homeLayout === t ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-800')}>
                    {t === 'dashboard' ? <LayoutGrid size={13} /> : <Grid2x2 size={13} />}{t === 'dashboard' ? 'Dashboard' : 'App launcher'}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-2">
              <button className="btn-ghost btn-sm w-full justify-start" onClick={() => { if (confirm('Reset all demo data to the initial state?')) { resetDemo(); setOpen(false); nav('/') } }}><RotateCcw size={14} /> Reset demo data</button>
              <button className="btn-ghost btn-sm w-full justify-start text-accent-700" onClick={() => { logout(); nav('/login') }}><LogOut size={14} /> Sign out</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { Link, useNavigate } from 'react-router-dom'
import { CheckSquare, ListChecks, FileText, Lock, ArrowRight, PenLine, HandCoins, Handshake, ShoppingCart, Landmark, Users, Megaphone, LayoutGrid } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { PageHeader } from '@/components/ui'
import { DEPARTMENTS, ACCESS_LABEL, effectiveAccess } from '@/lib/departments'
import { ROLE_LABEL, canApprove } from '@/lib/workflow'
import { computeBvA } from '@/lib/budget'
import { recipientTurn } from '@/lib/esign'
import { fmtMoney, cx } from '@/lib/format'
import type { Department } from '@/types'

export const DEPT_ICON: Record<Department, React.ReactNode> = {
  grants: <HandCoins size={22} />, partnerships: <Handshake size={22} />, procurement: <ShoppingCart size={22} />, finance: <Landmark size={22} />, hr: <Users size={22} />, media: <Megaphone size={22} />,
}

export default function Home() {
  const user = useCurrentUser()!
  const nav = useNavigate()
  const { prs, pos, invoices, contracts, budgets, envelopes, tasks, projects, settings, partners, setHomeLayout, trips } = useStore()
  const access = effectiveAccess(user)
  const approvals = prs.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
    + pos.filter((p) => p.status === 'pending_approval' && canApprove(p.approvalChain, user)).length
    + invoices.filter((i) => i.status === 'pending_approval' && canApprove(i.approvalChain, user)).length
    + (user.role === 'legal' ? contracts.filter((c) => c.status === 'legal_review').length : 0)
  const myTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done').length
  const toSign = envelopes.filter((e) => e.status === 'sent' && recipientTurn(e).some((r) => r.userId === user.id)).length
  const myOpen = prs.filter((p) => p.requesterId === user.id && !['closed', 'cancelled', 'rejected'].includes(p.status)).length
  const active = budgets.filter((b) => b.status === 'active')
  const bvas = active.map((b) => computeBvA(b, prs, pos, invoices, trips).totals)
  const approvedTotal = bvas.reduce((s, t) => s + t.budget, 0), spentTotal = bvas.reduce((s, t) => s + t.actual + t.commitments, 0)
  const ccy = settings.defaultCurrency
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const stats: Record<Department, { label: string; value: string }[]> = {
    grants: [{ label: 'Pipeline', value: String(projects.filter((p) => ['development', 'submitted'].includes(p.stage)).length) }, { label: 'Active grants', value: String(projects.filter((p) => ['granted', 'active'].includes(p.stage)).length) }, { label: 'Portfolio burn', value: approvedTotal ? `${Math.round((spentTotal / approvedTotal) * 100)}%` : '—' }],
    partnerships: [{ label: 'Partners', value: String(partners.length) }, { label: 'In due diligence', value: String(partners.filter((p) => p.stage === 'due_diligence').length) }, { label: 'Active agreements', value: String(partners.filter((p) => p.stage === 'active').length) }],
    procurement: [{ label: 'Open requisitions', value: String(prs.filter((p) => ['pending_approval', 'approved', 'sourcing', 'awarded'].includes(p.status)).length) }, { label: 'POs in progress', value: String(pos.filter((p) => ['draft', 'pending_approval', 'approved', 'issued', 'contracted', 'partially_received'].includes(p.status)).length) }, { label: 'Contracts', value: String(contracts.filter((c) => c.status === 'active' || c.status === 'pending_signature').length) }],
    finance: [{ label: 'Invoices awaiting approval', value: String(invoices.filter((i) => i.status === 'pending_approval').length) }, { label: 'Match exceptions', value: String(invoices.filter((i) => i.status === 'exception').length) }, { label: 'Ready to pay', value: fmtMoney(invoices.filter((i) => i.status === 'approved').reduce((s, i) => s + i.lines.reduce((t, l) => t + l.quantity * l.unitPrice, 0) * (1 + i.taxRate / 100), 0), ccy) }],
    hr: [{ label: 'Staff', value: '—' }, { label: 'Open requests', value: '—' }],
    media: [{ label: 'Scheduled content', value: '—' }, { label: 'Visibility items', value: '—' }],
  }

  return (
    <>
      <PageHeader eyebrow={`${ROLE_LABEL[user.role]} · ${user.department}`} title={`${greet}, ${user.name.split(' ')[0]}`}
        subtitle={`${settings.orgShort} management platform — choose a workspace. Your access to each is set by the administrator.`}
        actions={<button className="btn-secondary btn-sm" onClick={() => setHomeLayout('launcher')} title="Switch the home screen to the app launcher (you can switch back from the account menu or Settings)"><LayoutGrid size={14} /> Try the app launcher</button>} />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/approvals" className={cx('card flex items-center gap-4 px-5 py-4 hover:shadow-raised', approvals > 0 && 'border-sun-300')}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-sun-100 text-sun-700"><CheckSquare size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[22px] font-semibold leading-tight text-ink-900">{approvals}</span><span className="block text-[12.5px] text-ink-500">Awaiting my approval</span></span>
          <ArrowRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/tasks" className={cx('card flex items-center gap-4 px-5 py-4 hover:shadow-raised', myTasks > 0 && 'border-info-500/40')}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-info-50 text-info-700"><ListChecks size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[22px] font-semibold leading-tight text-ink-900">{myTasks}</span><span className="block text-[12.5px] text-ink-500">My open tasks</span></span>
          <ArrowRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/esign" className={cx('card flex items-center gap-4 px-5 py-4 hover:shadow-raised', toSign > 0 && 'border-accent-200')}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent-50 text-accent-700"><PenLine size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[22px] font-semibold leading-tight text-ink-900">{toSign}</span><span className="block text-[12.5px] text-ink-500">Waiting for my signature</span></span>
          <ArrowRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/requisitions" className="card flex items-center gap-4 px-5 py-4 hover:shadow-raised">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700"><FileText size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[22px] font-semibold leading-tight text-ink-900">{myOpen}</span><span className="block text-[12.5px] text-ink-500">My open requests</span></span>
          <ArrowRight size={16} className="text-ink-400" />
        </Link>
      </div>

      <div className="mb-3 flex items-end justify-between"><h2 className="text-[15px] font-semibold text-ink-900">Workspaces</h2><span className="text-[12px] text-ink-500">{DEPARTMENTS.filter((d) => access[d.id] !== 'none').length} of {DEPARTMENTS.length} open to you</span></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((d) => {
          const lvl = access[d.id]; const locked = lvl === 'none'
          const live = d.modules.filter((m) => !m.soon).length, soon = d.modules.filter((m) => m.soon).length
          return (
            <div key={d.id} role={locked ? undefined : 'button'} tabIndex={locked ? -1 : 0} onClick={() => !locked && nav(d.home)} onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) nav(d.home) }}
              className={cx('card group relative flex flex-col p-5 transition-shadow', locked ? 'opacity-70' : 'cursor-pointer hover:shadow-raised focus:outline-none focus:ring-2 focus:ring-brand-400')}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-control', locked ? 'bg-ink-200 text-ink-500' : d.tone.tile)}>{locked ? <Lock size={20} /> : DEPT_ICON[d.id]}</span>
                <span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', locked ? 'bg-ink-100 text-ink-500 ring-ink-200' : lvl === 'manage' ? 'bg-brand-50 text-brand-800 ring-brand-200' : lvl === 'edit' ? 'bg-info-50 text-info-700 ring-info-500/30' : 'bg-surface-muted text-ink-600 ring-ink-200')}>{ACCESS_LABEL[lvl]}</span>
              </div>
              <div className="text-[17px] font-semibold text-ink-900">{d.name}</div>
              <div className="mb-3 text-[12.5px] text-ink-500">{d.short}</div>
              <p className="mb-4 flex-1 text-[12.5px] leading-relaxed text-ink-600">{d.description}</p>
              <dl className="mb-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
                {stats[d.id].map((s) => <div key={s.label}><dt className="truncate text-[10.5px] uppercase tracking-[0.05em] text-ink-400">{s.label}</dt><dd className="truncate text-[14px] font-semibold tabular-nums text-ink-900">{s.value}</dd></div>)}
              </dl>
              <div className="flex flex-wrap items-center gap-1.5">
                {d.modules.filter((m) => !m.soon && m.label !== 'Overview').slice(0, 4).map((m) => <span key={m.label} className="rounded-pill bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-700">{m.label}</span>)}
                {soon > 0 && <span className="rounded-pill border border-dashed border-ink-300 px-2 py-0.5 text-[11px] text-ink-400">{soon} module{soon > 1 ? 's' : ''} to define</span>}
                {live === 1 && soon > 0 && <span className="text-[11px] text-ink-400">· setup pending</span>}
              </div>
              {locked && <div className="mt-3 text-[11.5px] text-ink-500">Ask the administrator for access to this workspace.</div>}
              {!locked && <span className="absolute right-4 top-16 text-ink-300 transition-transform group-hover:translate-x-0.5"><ArrowRight size={18} /></span>}
            </div>
          )
        })}
      </div>
    </>
  )
}

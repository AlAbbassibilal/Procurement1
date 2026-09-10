import { type ReactNode, useEffect } from 'react'
import { X, Inbox } from 'lucide-react'
import { cx, initials } from '@/lib/format'
import type { ContractStatus, POStatus, PRStatus } from '@/types'

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------
type AnyStatus = PRStatus | POStatus | ContractStatus | 'pending' | 'current' | 'skipped' | 'active' | 'blocked' | 'completed' | 'invoiced' | 'paid'
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:             { label: 'Draft',              cls: 'bg-ink-100 text-ink-700 ring-ink-200' },
  pending_approval:  { label: 'Pending approval',   cls: 'bg-warning-50 text-warning-700 ring-sun-300' },
  returned:          { label: 'Returned',           cls: 'bg-sun-50 text-sun-700 ring-sun-300' },
  rejected:          { label: 'Rejected',           cls: 'bg-danger-50 text-danger-700 ring-accent-200' },
  approved:          { label: 'Approved',           cls: 'bg-success-50 text-success-700 ring-brand-200' },
  sourcing:          { label: 'Sourcing',           cls: 'bg-info-50 text-info-700 ring-info-500/20' },
  awarded:           { label: 'Awarded',            cls: 'bg-brand-100 text-brand-800 ring-brand-300' },
  ordered:           { label: 'PO issued',          cls: 'bg-brand-600 text-white ring-brand-700' },
  issued:            { label: 'Issued',             cls: 'bg-brand-600 text-white ring-brand-700' },
  contracted:        { label: 'Contracted',         cls: 'bg-ink-800 text-white ring-ink-900' },
  received:          { label: 'Received',           cls: 'bg-success-50 text-success-700 ring-brand-200' },
  closed:            { label: 'Closed',             cls: 'bg-ink-200 text-ink-700 ring-ink-300' },
  cancelled:         { label: 'Cancelled',          cls: 'bg-ink-100 text-ink-500 ring-ink-200 line-through' },
  drafting:          { label: 'Drafting',           cls: 'bg-ink-100 text-ink-700 ring-ink-200' },
  legal_review:      { label: 'Legal review',       cls: 'bg-info-50 text-info-700 ring-info-500/20' },
  pending_signature: { label: 'Pending signature',  cls: 'bg-warning-50 text-warning-700 ring-sun-300' },
  active:            { label: 'Active',             cls: 'bg-success-50 text-success-700 ring-brand-200' },
  expired:           { label: 'Expired',            cls: 'bg-ink-200 text-ink-700 ring-ink-300' },
  terminated:        { label: 'Terminated',         cls: 'bg-danger-50 text-danger-700 ring-accent-200' },
  pending:           { label: 'Pending',            cls: 'bg-ink-100 text-ink-600 ring-ink-200' },
  current:           { label: 'Awaiting',           cls: 'bg-warning-50 text-warning-700 ring-sun-300' },
  skipped:           { label: 'Skipped',            cls: 'bg-ink-100 text-ink-500 ring-ink-200' },
  blocked:           { label: 'Blocked',            cls: 'bg-danger-50 text-danger-700 ring-accent-200' },
  completed:         { label: 'Completed',          cls: 'bg-success-50 text-success-700 ring-brand-200' },
  invoiced:          { label: 'Invoiced',           cls: 'bg-info-50 text-info-700 ring-info-500/20' },
  paid:              { label: 'Paid',               cls: 'bg-brand-600 text-white ring-brand-700' },
}
export function StatusPill({ status, className }: { status: AnyStatus | string; className?: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-ink-100 text-ink-700 ring-ink-200' }
  return <span className={cx('inline-flex items-center rounded-pill px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset whitespace-nowrap', m.cls, className)}>{m.label}</span>
}

export function PriorityDot({ p }: { p: 'low' | 'normal' | 'high' | 'urgent' }) {
  const cls = { low: 'bg-ink-400', normal: 'bg-info-500', high: 'bg-sun-500', urgent: 'bg-accent-600' }[p]
  return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-700 capitalize"><span className={cx('h-2 w-2 rounded-full', cls)} />{p}</span>
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export function Avatar({ name, color = 'bg-ink-600', size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-[12px]', lg: 'h-12 w-12 text-[16px]' }[size]
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', color, s)}>{initials(name)}</span>
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function PageHeader({ title, subtitle, eyebrow, actions, children }: { title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.06em] text-brand-700">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-ink-500">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-[14px] font-semibold text-ink-900">{title}</h2>}
            {description && <p className="text-[12.5px] text-ink-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'default', icon }: { label: string; value: ReactNode; hint?: string; tone?: 'default' | 'brand' | 'accent' | 'sun' | 'ink'; icon?: ReactNode }) {
  const ring = { default: 'border-line', brand: 'border-brand-200', accent: 'border-accent-200', sun: 'border-sun-300', ink: 'border-ink-300' }[tone]
  const iconBg = { default: 'bg-ink-100 text-ink-600', brand: 'bg-brand-100 text-brand-700', accent: 'bg-accent-100 text-accent-700', sun: 'bg-sun-100 text-sun-700', ink: 'bg-ink-800 text-white' }[tone]
  return (
    <div className={cx('card flex items-center gap-4 p-4', ring)}>
      {icon && <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-control', iconBg)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-500">{label}</div>
        <div className="mt-0.5 text-[22px] font-semibold leading-none text-ink-900">{value}</div>
        {hint && <div className="mt-1 text-[12px] text-ink-500">{hint}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink-300 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">{icon ?? <Inbox size={22} />}</div>
      <div className="text-[15px] font-semibold text-ink-900">{title}</div>
      {body && <div className="mt-1 max-w-sm text-[13px] text-ink-500">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------
export function Field({ label, children, hint, required, className }: { label: string; children: ReactNode; hint?: string; required?: boolean; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}{required && <span className="ml-0.5 text-accent-600">*</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-500">{hint}</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative w-full rounded-card bg-surface shadow-overlay animate-slide-up flex max-h-[90vh] flex-col', width)}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
          <button className="btn-ghost btn-sm -mr-2" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 bg-surface-muted rounded-b-card">{footer}</footer>}
      </div>
    </div>
  )
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  const cls = {
    info: 'bg-info-50 text-info-700 border-info-500/20',
    success: 'bg-success-50 text-success-700 border-brand-200',
    warning: 'bg-warning-50 text-warning-700 border-sun-300',
    danger: 'bg-danger-50 text-danger-700 border-accent-200',
  }[tone]
  return <div className={cx('rounded-control border px-3.5 py-2.5 text-[13px]', cls)}>{children}</div>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx('relative -mb-px px-3.5 py-2.5 text-[13.5px] font-medium transition-colors border-b-2', value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800')}>
          {t.label}
          {t.count !== undefined && <span className={cx('ml-1.5 rounded-pill px-1.5 py-0.5 text-[11px]', value === t.id ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-ink-500 shrink-0">{k}</span>
      <span className={cx('text-right text-ink-900 font-medium', mono && 'font-mono')}>{v ?? '—'}</span>
    </div>
  )
}

import type { Currency } from '@/types'

export const fmtMoney = (n: number, ccy: Currency = 'JOD') =>
  new Intl.NumberFormat('en-JO', { style: 'currency', currency: ccy, minimumFractionDigits: 2 }).format(n || 0)

export const fmtNumber = (n: number) => new Intl.NumberFormat('en').format(n || 0)

export const fmtDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—'

export const fmtDateTime = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : '—'

export const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(iso)
}

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10)
export const nowIso = () => new Date().toISOString()
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
export const toInputDate = (d: Date) => d.toISOString().slice(0, 10)

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('')

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const lineTotal = (l: { quantity: number; unitPrice: number }) => (l.quantity || 0) * (l.unitPrice || 0)
export const linesSubtotal = (lines: { quantity: number; unitPrice: number }[]) => lines.reduce((s, l) => s + lineTotal(l), 0)

export const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`)

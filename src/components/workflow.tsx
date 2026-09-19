import { useState, useRef } from 'react'
import { Check, X, Undo2, UserPlus, Clock, Circle, Paperclip, Trash2, Send, Upload, FileText } from 'lucide-react'
import type { ApprovalStep, Attachment, Comment, LineItem, User } from '@/types'
import { useStore, useCurrentUser, attachmentFromFile } from '@/store/useStore'
import { cx, fmtBytes, fmtDateTime, timeAgo, uid } from '@/lib/format'
import { canApprove, chainProgress, currentStep } from '@/lib/workflow'
import { Avatar, Alert, Field, Modal } from './ui'
import { CATEGORIES, COST_CENTERS, UNITS } from '@/data/seed'
import type { BudgetLine } from '@/types'

// ---------------------------------------------------------------------------
// Process tracker — the end-to-end procure-to-contract journey
// ---------------------------------------------------------------------------
export type Stage = 'pr' | 'pr_approval' | 'sourcing' | 'po' | 'po_approval' | 'contract' | 'receipt' | 'invoice'
const STAGES: { id: Stage; label: string }[] = [
  { id: 'pr', label: 'Requisition' },
  { id: 'pr_approval', label: 'PR approvals' },
  { id: 'sourcing', label: '3 quotations' },
  { id: 'po', label: 'Purchase order' },
  { id: 'po_approval', label: 'PO approvals' },
  { id: 'contract', label: 'Contract' },
  { id: 'receipt', label: 'Goods receipt' },
  { id: 'invoice', label: 'Invoice & pay' },
]
export function ProcessTracker({ current, failed, complete }: { current: Stage; failed?: boolean; complete?: boolean }) {
  const idx = complete ? STAGES.length : STAGES.findIndex((s) => s.id === current)
  return (
    <ol className="flex w-full items-center gap-0 overflow-x-auto scrollbar-thin">
      {STAGES.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? (failed ? 'failed' : 'current') : 'todo'
        return (
          <li key={s.id} className="flex flex-1 items-center min-w-[110px]">
            <div className="flex items-center gap-2">
              <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2',
                state === 'done' && 'bg-brand-600 text-white ring-brand-600',
                state === 'current' && 'bg-surface text-brand-700 ring-brand-600',
                state === 'failed' && 'bg-accent-600 text-white ring-accent-600',
                state === 'todo' && 'bg-surface text-ink-400 ring-ink-300')}>
                {state === 'done' ? <Check size={13} /> : state === 'failed' ? <X size={13} /> : i + 1}
              </span>
              <span className={cx('text-[12.5px] font-medium whitespace-nowrap', state === 'todo' ? 'text-ink-400' : 'text-ink-900')}>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && <div className={cx('mx-3 h-px flex-1', i < idx ? 'bg-brand-600' : 'bg-ink-300')} />}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Approval chain stepper
// ---------------------------------------------------------------------------
export function ApprovalChain({ chain, users }: { chain: ApprovalStep[]; users: User[] }) {
  const prog = chainProgress(chain)
  if (!chain.length) return <div className="text-[13px] text-ink-500">Approval chain is generated on submission based on the approval matrix.</div>
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[12px] text-ink-500">
        <span>{prog.done} of {prog.total} approvals</span><span>{prog.pct}%</span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-pill bg-ink-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${prog.pct}%` }} /></div>
      <ol className="space-y-3">
        {chain.map((s) => {
          const approver = users.find((u) => u.id === (s.delegatedTo ?? s.approverId))
          const decider = users.find((u) => u.id === s.decidedBy)
          const icon = {
            approved: <Check size={13} />, rejected: <X size={13} />, returned: <Undo2 size={13} />,
            current: <Clock size={13} />, pending: <Circle size={9} />, skipped: <Circle size={9} />,
          }[s.status]
          const ring = {
            approved: 'bg-brand-600 text-white', rejected: 'bg-accent-600 text-white', returned: 'bg-sun-500 text-ink-900',
            current: 'bg-sun-100 text-sun-700 ring-2 ring-sun-500', pending: 'bg-ink-100 text-ink-400', skipped: 'bg-ink-100 text-ink-400',
          }[s.status]
          return (
            <li key={s.id} className="flex gap-3">
              <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ring)}>{icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink-900">Step {s.order} · {s.label}</span>
                  <span className={cx('text-[11.5px] font-medium capitalize', s.status === 'current' ? 'text-sun-700' : 'text-ink-500')}>{s.status === 'current' ? 'Awaiting decision' : s.status}</span>
                </div>
                <div className="text-[12.5px] text-ink-600">
                  {s.delegatedTo && approver ? <>Delegated to <b>{approver.name}</b></> : approver ? approver.name : 'Any user with this role'}
                  {decider && s.decidedAt && <> · decided by {decider.name} on {fmtDateTime(s.decidedAt)}</>}
                </div>
                {s.comment && <div className="mt-1 rounded-control bg-surface-muted px-3 py-2 text-[12.5px] text-ink-700 border border-line">“{s.comment}”</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Decision panel — approve / reject / return / delegate
// ---------------------------------------------------------------------------
export function DecisionPanel({ chain, onDecide, docLabel }: {
  chain: ApprovalStep[]
  docLabel: string
  onDecide: (d: 'approved' | 'rejected' | 'returned' | 'delegated', comment: string, delegateTo?: string) => { ok: boolean; error?: string }
}) {
  const user = useCurrentUser()!
  const users = useStore((s) => s.users)
  const [mode, setMode] = useState<null | 'approved' | 'rejected' | 'returned' | 'delegated'>(null)
  const [comment, setComment] = useState('')
  const [delegate, setDelegate] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const step = currentStep(chain)
  if (!step || !canApprove(chain, user)) return null

  const titles = { approved: 'Approve', rejected: 'Reject', returned: 'Return for changes', delegated: 'Delegate approval' }
  const submit = () => {
    const r = onDecide(mode!, comment, delegate || undefined)
    if (!r.ok) { setErr(r.error ?? 'Failed'); return }
    setMode(null); setComment(''); setDelegate(''); setErr(null)
  }
  return (
    <div className="rounded-card border-2 border-sun-500 bg-sun-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-sun-700"><Clock size={13} /> Your decision is required</div>
      <div className="text-[13.5px] text-ink-800">Step {step.order} · <b>{step.label}</b> for {docLabel}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setMode('approved')}><Check size={15} /> Approve</button>
        <button className="btn-secondary" onClick={() => setMode('returned')}><Undo2 size={15} /> Return</button>
        <button className="btn-danger-soft" onClick={() => setMode('rejected')}><X size={15} /> Reject</button>
        <button className="btn-ghost" onClick={() => setMode('delegated')}><UserPlus size={15} /> Delegate</button>
      </div>

      <Modal open={!!mode} onClose={() => setMode(null)} title={mode ? titles[mode] : ''}
        footer={<>
          <button className="btn-secondary" onClick={() => setMode(null)}>Cancel</button>
          <button className={mode === 'rejected' ? 'btn-danger' : 'btn-primary'} onClick={submit}>{mode ? titles[mode] : ''}</button>
        </>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        {mode === 'delegated' && (
          <Field label="Delegate to" required>
            <select className="input" value={delegate} onChange={(e) => setDelegate(e.target.value)}>
              <option value="">Select a colleague…</option>
              {users.filter((u) => u.active && u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}
            </select>
          </Field>
        )}
        <Field label={mode === 'approved' ? 'Comment (optional)' : 'Comment'} required={mode !== 'approved'} className="mt-3">
          <textarea className="input min-h-[96px]" value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={mode === 'returned' ? 'Tell the requester what needs to change…' : mode === 'rejected' ? 'Reason for rejection…' : 'Add a note for the record…'} />
        </Field>
        {mode === 'approved' && <p className="mt-3 text-[12.5px] text-ink-500">Approving moves the document to the next step in the chain, or completes the approval if this is the final step.</p>}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export function CommentThread({ comments, onAdd }: { comments: Comment[]; onAdd: (t: string) => void }) {
  const users = useStore((s) => s.users)
  const [text, setText] = useState('')
  return (
    <div>
      <div className="space-y-3">
        {comments.length === 0 && <div className="text-[13px] text-ink-500">No comments yet.</div>}
        {comments.map((c) => {
          const u = users.find((x) => x.id === c.authorId)
          return (
            <div key={c.id} className="flex gap-3">
              <Avatar name={c.authorName} color={u?.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px]"><b className="text-ink-900">{c.authorName}</b> <span className="text-ink-400">· {timeAgo(c.at)}</span></div>
                <div className="text-[13px] text-ink-700 whitespace-pre-wrap">{c.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText('') } }}>
        <input className="input" placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary btn-sm shrink-0" type="submit" disabled={!text.trim()}><Send size={14} /></button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------
export function AttachmentList({ items, onAdd, onRemove, readOnly }: { items: Attachment[]; onAdd?: (a: Attachment) => void; onRemove?: (id: string) => void; readOnly?: boolean }) {
  const user = useCurrentUser()!
  const ref = useRef<HTMLInputElement>(null)
  const handle = async (files: FileList | null) => {
    if (!files || !onAdd) return
    for (const f of Array.from(files)) onAdd(await attachmentFromFile(f, user.name))
    if (ref.current) ref.current.value = ''
  }
  return (
    <div>
      <ul className="space-y-1.5">
        {items.length === 0 && <li className="text-[13px] text-ink-500">No attachments.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-control border border-line bg-surface-muted px-3 py-2">
            <FileText size={16} className="text-brand-600 shrink-0" />
            <div className="min-w-0 flex-1">
              {a.dataUrl ? <a href={a.dataUrl} download={a.name} className="block truncate text-[13px] font-medium text-ink-900 hover:underline">{a.name}</a> : <span className="block truncate text-[13px] font-medium text-ink-900">{a.name}</span>}
              <span className="text-[11.5px] text-ink-500">{fmtBytes(a.size)} · {a.uploadedBy} · {timeAgo(a.uploadedAt)}</span>
            </div>
            {!readOnly && onRemove && <button className="btn-ghost btn-sm text-ink-400 hover:text-accent-700" onClick={() => onRemove(a.id)} aria-label="Remove"><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      {!readOnly && onAdd && (
        <div className="mt-3">
          <input ref={ref} type="file" multiple className="hidden" onChange={(e) => handle(e.target.files)} />
          <button className="btn-secondary btn-sm" onClick={() => ref.current?.click()}><Upload size={14} /> Attach files</button>
          <span className="ml-2 text-[11.5px] text-ink-400"><Paperclip size={11} className="inline" /> PDF, images, spreadsheets</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Line items editor
// ---------------------------------------------------------------------------
export function newLine(): LineItem {
  return { id: uid('l_'), description: '', category: CATEGORIES[0]!, quantity: 1, unit: 'each', unitPrice: 0, costCenter: COST_CENTERS[0]!, budgetLine: '', }
}
export function LineItemsEditor({ lines, onChange, currency, readOnly, priceLabel = 'Est. unit price', budgetLines }: { lines: LineItem[]; onChange?: (l: LineItem[]) => void; currency: string; readOnly?: boolean; priceLabel?: string; budgetLines?: BudgetLine[] }) {
  const { budgets } = useStore()
  const upd = (id: string, patch: Partial<LineItem>) => onChange?.(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const lineLabel = (code: string) => { const bl = (budgetLines ?? budgets.flatMap((b) => b.lines)).find((x) => x.code === code); return bl ? `${bl.code} · ${bl.description}` : code || '—' }
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[1280px] table-fixed text-[13px]">
        <thead><tr>
          <th className="table-th w-10">#</th><th className="table-th">Description</th><th className="table-th w-44">Category</th>
          <th className="table-th w-28">Qty</th><th className="table-th w-32">Unit</th><th className="table-th w-40">{priceLabel}</th>
          <th className="table-th w-52">Cost centre</th><th className="table-th w-72">Budget line</th><th className="table-th w-32 text-right">Total</th>{!readOnly && <th className="table-th w-10" />}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} className="align-top">
              <td className="table-td text-ink-400">{i + 1}</td>
              <td className="table-td">{readOnly ? l.description : <input className="input" value={l.description} placeholder="Item / service description" onChange={(e) => upd(l.id, { description: e.target.value })} />}</td>
              <td className="table-td">{readOnly ? l.category : <select className="input" value={l.category} onChange={(e) => upd(l.id, { category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}</td>
              <td className="table-td">{readOnly ? l.quantity : <input type="number" min={0} className="input" value={l.quantity} onChange={(e) => upd(l.id, { quantity: Number(e.target.value) })} />}</td>
              <td className="table-td">{readOnly ? l.unit : <select className="input" value={l.unit} onChange={(e) => upd(l.id, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>}</td>
              <td className="table-td">{readOnly ? l.unitPrice.toFixed(2) : <input type="number" min={0} step="0.01" className="input" value={l.unitPrice} onChange={(e) => upd(l.id, { unitPrice: Number(e.target.value) })} />}</td>
              <td className="table-td">{readOnly ? l.costCenter : <select className="input" value={l.costCenter} onChange={(e) => upd(l.id, { costCenter: e.target.value })}>{COST_CENTERS.map((c) => <option key={c}>{c}</option>)}</select>}</td>
              <td className="table-td">{readOnly ? lineLabel(l.budgetLine) : budgetLines ? <select className="input" value={l.budgetLine} onChange={(e) => upd(l.id, { budgetLine: e.target.value })}><option value="">Select budget line…</option>{budgetLines.map((bl) => <option key={bl.id} value={bl.code}>{bl.code} · {bl.description}</option>)}</select> : <input className="input" value={l.budgetLine} placeholder="Select a project first" disabled />}</td>
              <td className="table-td text-right font-medium tabular-nums">{(l.quantity * l.unitPrice).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
              {!readOnly && <td className="table-td"><button className="btn-ghost btn-sm text-ink-400 hover:text-accent-700" onClick={() => onChange?.(lines.filter((x) => x.id !== l.id))}><Trash2 size={14} /></button></td>}
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={10} className="table-td text-center text-ink-500 py-6">No line items yet.</td></tr>}
        </tbody>
        <tfoot><tr>
          <td colSpan={8} className="px-4 py-3 text-right text-[12.5px] font-medium uppercase tracking-[0.04em] text-ink-500">Subtotal ({currency})</td>
          <td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums text-ink-900">{subtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
          {!readOnly && <td />}
        </tr></tfoot>
      </table>
      {!readOnly && <button className="btn-secondary btn-sm mt-3" onClick={() => onChange?.([...lines, newLine()])}>+ Add line</button>}
    </div>
  )
}

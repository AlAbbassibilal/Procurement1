import { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2, Plus, FileText, Loader2, Pencil } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Alert } from '@/components/ui'
import { cx } from '@/lib/format'
import { buildProposalDocx } from '@/lib/proposalDocx'
import { saveFile } from '@/lib/download'
import type { Project, ProposalSection } from '@/types'

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** Proposal sections as an accordion: click a section to open a full-height writing area; the others stay collapsed with a preview. */
export function ProposalSections({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const { updateProject } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const secs = p.proposal.sections
  const save = (sections: ProposalSection[]) => updateProject(p.id, { proposal: { ...p.proposal, sections } })
  const patch = (id: string, ch: Partial<ProposalSection>) => save(secs.map((s) => (s.id === id ? { ...s, ...ch } : s)))
  const move = (i: number, d: -1 | 1) => { const n = [...secs]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; save(n) }
  const add = () => { const t = prompt('Section title'); if (!t) return; const id = `ps_${Date.now().toString(36)}`; save([...secs, { id, title: t, content: '' }]); setOpen(id) }
  const total = secs.reduce((s, x) => s + words(x.content), 0)
  return (
    <div className="space-y-2" data-testid="proposal-sections">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-500"><span>{secs.length} section{secs.length === 1 ? '' : 's'} · {total.toLocaleString()} words · click a section to write</span><span>Formatting: <code className="rounded bg-surface-sunken px-1">## </code> sub-heading · <code className="rounded bg-surface-sunken px-1">### </code> sub-sub-heading · <code className="rounded bg-surface-sunken px-1">• </code> bullet</span></div>
      {secs.length === 0 && <Alert tone="info">No sections yet — add one or import the proposal document.</Alert>}
      {secs.map((s, i) => { const isOpen = open === s.id; const w = words(s.content); return (
        <div key={s.id} className={cx('rounded-card border bg-surface transition-shadow', isOpen ? 'border-brand-300 shadow-raised' : 'border-line hover:border-ink-300')} data-testid={`section-${i + 1}`}>
          <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
            <span className="mt-0.5 text-ink-400">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-ink-400">{i + 1}.</span><span className="text-[14px] font-semibold text-ink-900">{s.title}</span><span className={cx('rounded-pill px-2 py-0.5 text-[10.5px] font-semibold', w ? 'bg-brand-50 text-brand-800' : 'bg-sun-50 text-sun-700')}>{w ? `${w.toLocaleString()} words` : 'empty'}</span></span>
              {!isOpen && s.content.trim() && <span className="mt-1 line-clamp-2 block text-[12.5px] text-ink-500">{s.content.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').slice(0, 260)}</span>}
            </span>
          </button>
          {isOpen && (
            <div className="border-t border-line px-4 pb-4 pt-3">
              {canEdit && <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                {renaming === s.id ? <input autoFocus className="input w-96" defaultValue={s.title} onBlur={(e) => { if (e.target.value.trim()) patch(s.id, { title: e.target.value.trim() }); setRenaming(null) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null) }} /> : <button className="btn-ghost btn-sm" onClick={() => setRenaming(s.id)}><Pencil size={13} /> Rename</button>}
                <div className="flex gap-1"><button className="btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} title="Move up"><ArrowUp size={13} /></button><button className="btn-ghost btn-sm" disabled={i === secs.length - 1} onClick={() => move(i, 1)} title="Move down"><ArrowDown size={13} /></button><button className="btn-ghost btn-sm text-accent-700" onClick={() => { if (confirm(`Remove the section “${s.title}”?`)) { save(secs.filter((x) => x.id !== s.id)); setOpen(null) } }} title="Remove section"><Trash2 size={13} /></button></div>
              </div>}
              <textarea className="input min-h-[55vh] w-full resize-y text-[14px] leading-7" data-testid={`section-text-${i + 1}`} value={s.content} disabled={!canEdit} placeholder={`Write “${s.title}”…\n\nUse “## ” for a sub-heading, “### ” for a sub-sub-heading and “• ” for bullets — they become Word headings and bullets on the RHS template.`} onChange={(e) => patch(s.id, { content: e.target.value })} spellCheck />
            </div>
          )}
        </div>) })}
      {canEdit && <button className="btn-secondary btn-sm" onClick={add}><Plus size={13} /> Add section</button>}
    </div>
  )
}

/** Export the proposal on the RHS Word template (cover, About RHS, table of contents, general information, headers and footers). */
export function ExportProposalButton({ p, totalBudget }: { p: Project; totalBudget?: number }) {
  const { settings, users } = useStore()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async () => {
    setBusy(true); setErr(null)
    try {
      const mgr = users.find((u) => u.id === p.managerId)
      const blob = await buildProposalDocx(p, settings, totalBudget, mgr ? { name: mgr.name, email: mgr.email } : undefined)
      await saveFile(`${p.code}_Proposal_RHS.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (<>
    <button className="btn-primary btn-sm" data-testid="export-proposal" disabled={busy} onClick={run}>{busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} {busy ? 'Building…' : 'Export on RHS template (Word)'}</button>
    {err && <div className="mt-2"><Alert tone="danger">{err}</Alert></div>}
  </>)
}

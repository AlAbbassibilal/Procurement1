import { useRef, useState } from 'react'
import { FileInput, Wand2, Loader2 } from 'lucide-react'
import { useStore, useCurrentUser, attachmentFromFile } from '@/store/useStore'
import { Modal, Alert, Field } from '@/components/ui'
import { extractProposal, suggestMapping, type ExtractedDoc } from '@/lib/proposalExtract'
import { uid, cx } from '@/lib/format'
import type { Project, ProposalSection } from '@/types'

type Row = { include: boolean; target: string; mode: 'replace' | 'append' }
const NEW = '__new__'; const SKIP = ''

/** "Import from document": attach a proposal file and pull its sections into the project proposal after review. */
export function ProposalImportButton({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const user = useCurrentUser()!
  const { updateProject } = useStore()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [doc, setDoc] = useState<{ file: File; ex: ExtractedDoc; rows: Row[]; facts: Record<string, boolean> } | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true); setErr(null)
    try {
      const ex = await extractProposal(f)
      if (!ex.parts.length) throw new Error('No readable text found in this file. Scanned PDFs need OCR first.')
      const suggested = suggestMapping(ex.parts, p.proposal.sections)
      const rows: Row[] = ex.parts.map((pt, i) => { const t = suggested[i]; const target = t ?? (pt.body.length >= 200 ? NEW : SKIP); const has = !!p.proposal.sections.find((s) => s.id === t)?.content.trim(); return { include: target !== SKIP, target, mode: has ? 'append' : 'replace' } })
      setDoc({ file: f, ex, rows, facts: { requestedAmount: !!ex.facts.requestedAmount && !p.requestedAmount, submittedTo: !!ex.facts.submittedTo && !p.proposal.submittedTo, reference: !!ex.facts.reference && !p.proposal.reference } })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }

  const apply = async () => {
    if (!doc) return
    let sections: ProposalSection[] = p.proposal.sections.map((s) => ({ ...s }))
    doc.rows.forEach((r, i) => {
      if (!r.include || r.target === SKIP) return
      const pt = doc.ex.parts[i]!
      if (r.target === NEW) { sections.push({ id: uid('ps_'), title: pt.heading, content: pt.body }); return }
      sections = sections.map((s) => s.id !== r.target ? s : { ...s, content: r.mode === 'append' && s.content.trim() ? `${s.content.trim()}\n\n${pt.body}` : pt.body })
    })
    const att = await attachmentFromFile(doc.file, user.name)
    const f = doc.ex.facts
    updateProject(p.id, {
      proposal: { ...p.proposal, sections, attachments: [...p.proposal.attachments, att], submittedTo: doc.facts.submittedTo && f.submittedTo ? f.submittedTo : p.proposal.submittedTo, reference: doc.facts.reference && f.reference ? f.reference : p.proposal.reference },
      ...(doc.facts.requestedAmount && f.requestedAmount ? { requestedAmount: f.requestedAmount } : {}),
    })
    setDoc(null)
  }

  if (!canEdit) return null
  const used = doc ? doc.rows.filter((r) => r.include && r.target !== SKIP).length : 0
  return (
    <>
      <input ref={ref} type="file" accept=".docx,.pdf,.txt,.md" className="hidden" data-testid="proposal-file" onChange={(e) => onFile(e.target.files?.[0])} />
      <button className="btn-secondary btn-sm" data-testid="proposal-import" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <FileInput size={13} />} {busy ? 'Reading document…' : 'Import from document'}</button>
      {err && <div className="mt-2"><Alert tone="danger">{err}</Alert></div>}
      <Modal open={!!doc} onClose={() => setDoc(null)} width="max-w-4xl" title={doc ? `Import — ${doc.file.name}` : ''}
        footer={<><button className="btn-secondary" onClick={() => setDoc(null)}>Cancel</button><button className="btn-primary" data-testid="proposal-apply" disabled={!used} onClick={apply}><Wand2 size={15} /> Fill {used} section{used === 1 ? '' : 's'} & attach</button></>}>
        {doc && (
          <div className="space-y-4">
            <Alert tone="info">{doc.ex.parts.length} part{doc.ex.parts.length === 1 ? '' : 's'} found under the document's headings. Check where each one goes; the file is attached to the proposal either way. Existing text is kept when you choose <b>Append</b>.</Alert>
            <div className="rounded-card border border-line">
              <table className="w-full text-[12.5px]">
                <thead><tr><th className="table-th w-8" /><th className="table-th">Found in the document</th><th className="table-th w-64">Goes to</th><th className="table-th w-28">If not empty</th></tr></thead>
                <tbody>{doc.ex.parts.map((pt, i) => { const r = doc.rows[i]!; const tgt = p.proposal.sections.find((s) => s.id === r.target); const words = pt.body.split(/\s+/).length; return (
                  <tr key={i} className={cx('border-t border-line align-top', !r.include && 'opacity-50')}>
                    <td className="table-td"><input type="checkbox" data-testid={`imp-include-${i}`} checked={r.include} onChange={(e) => setDoc({ ...doc, rows: doc.rows.map((x, j) => (j === i ? { ...x, include: e.target.checked, target: e.target.checked && x.target === SKIP ? NEW : x.target } : x)) })} /></td>
                    <td className="table-td"><div className="font-medium text-ink-900">{pt.heading}</div><div className="text-[11.5px] text-ink-500">{words} words</div><div className={cx('mt-1 whitespace-pre-wrap text-ink-700', open !== i && 'line-clamp-2')}>{pt.body}</div><button className="mt-1 text-[11.5px] text-brand-700 hover:underline" onClick={() => setOpen(open === i ? null : i)}>{open === i ? 'Show less' : 'Show all'}</button></td>
                    <td className="table-td"><select className="input text-[12px]" data-testid={`imp-target-${i}`} value={r.target} onChange={(e) => { const t = e.target.value; const has = !!p.proposal.sections.find((s) => s.id === t)?.content.trim(); setDoc({ ...doc, rows: doc.rows.map((x, j) => (j === i ? { ...x, target: t, include: t !== SKIP, mode: has ? 'append' : 'replace' } : x)) }) }}>
                      <option value={SKIP}>— skip —</option>{p.proposal.sections.map((s) => <option key={s.id} value={s.id}>{s.title}{s.content.trim() ? ' ·' : ''}</option>)}<option value={NEW}>+ New section “{pt.heading}”</option></select></td>
                    <td className="table-td">{tgt?.content.trim() ? <select className="input text-[12px]" value={r.mode} onChange={(e) => setDoc({ ...doc, rows: doc.rows.map((x, j) => (j === i ? { ...x, mode: e.target.value as Row['mode'] } : x)) })}><option value="append">Append</option><option value="replace">Replace</option></select> : <span className="text-ink-400">empty</span>}</td>
                  </tr>) })}</tbody>
              </table>
            </div>
            {(doc.ex.facts.requestedAmount || doc.ex.facts.submittedTo || doc.ex.facts.reference || doc.ex.facts.durationMonths) && (
              <Field label="Also found" hint="Tick what should go to the submission card.">
                <div className="flex flex-wrap gap-4 text-[12.5px]">
                  {doc.ex.facts.requestedAmount && <label className="flex items-center gap-2"><input type="checkbox" checked={doc.facts.requestedAmount} onChange={(e) => setDoc({ ...doc, facts: { ...doc.facts, requestedAmount: e.target.checked } })} /> Requested amount: <b>{doc.ex.facts.currency ?? ''} {doc.ex.facts.requestedAmount.toLocaleString()}</b></label>}
                  {doc.ex.facts.submittedTo && <label className="flex items-center gap-2"><input type="checkbox" checked={doc.facts.submittedTo} onChange={(e) => setDoc({ ...doc, facts: { ...doc.facts, submittedTo: e.target.checked } })} /> Submitted to: <b>{doc.ex.facts.submittedTo}</b></label>}
                  {doc.ex.facts.reference && <label className="flex items-center gap-2"><input type="checkbox" checked={doc.facts.reference} onChange={(e) => setDoc({ ...doc, facts: { ...doc.facts, reference: e.target.checked } })} /> Reference: <b>{doc.ex.facts.reference}</b></label>}
                  {doc.ex.facts.durationMonths && <span className="text-ink-600">Duration mentioned: {doc.ex.facts.durationMonths} months</span>}
                </div>
              </Field>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine, Type } from 'lucide-react'
import { Field, Modal } from './ui'
import { cx } from '@/lib/format'
import { typedSignaturePng, FIELD_LABEL, type RenderedPage } from '@/lib/esign'
import type { EnvelopeField, EnvelopeRecipient } from '@/types'

// ---------------------------------------------------------------------------
// Signature pad — draw with mouse / touch, or type
// ---------------------------------------------------------------------------
export function SignaturePad({ onChange, height = 180 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false); const dirty = useRef(false)
  useEffect(() => { const c = ref.current!; const ctx = c.getContext('2d')!; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#152b38' }, [])
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * (ref.current!.width / r.width), y: (e.clientY - r.top) * (ref.current!.height / r.height) } }
  const down = (e: React.PointerEvent) => { drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ref.current!.setPointerCapture(e.pointerId) }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true }
  const up = () => { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(ref.current!.toDataURL('image/png')) }
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null) }
  return (
    <div>
      <div className="relative rounded-control border-2 border-dashed border-ink-300 bg-white">
        <canvas ref={ref} width={900} height={Math.round(height * 900 / 520)} className="block w-full touch-none" style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-ink-300" />
        <span className="pointer-events-none absolute bottom-2 left-6 text-[11px] text-ink-400">Sign here</span>
        <button type="button" className="btn-ghost btn-sm absolute right-2 top-2" onClick={clear}><Eraser size={13} /> Clear</button>
      </div>
    </div>
  )
}

export function AdoptSignatureModal({ open, onClose, onAdopt, name, initialsMode }: { open: boolean; onClose: () => void; onAdopt: (dataUrl: string, method: 'drawn' | 'typed') => void; name: string; initialsMode?: boolean }) {
  const [tab, setTab] = useState<'draw' | 'type'>('draw')
  const [drawn, setDrawn] = useState<string | null>(null)
  const [typed, setTyped] = useState(initialsMode ? name.split(' ').map((p) => p[0]).join('').toUpperCase() : name)
  const [style, setStyle] = useState<'script' | 'serif'>('script')
  const [agree, setAgree] = useState(true)
  const preview = tab === 'type' && typed.trim() ? typedSignaturePng(typed.trim(), style) : drawn
  return (
    <Modal open={open} onClose={onClose} title={initialsMode ? 'Adopt your initials' : 'Adopt your signature'} width="max-w-2xl"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!preview || !agree} onClick={() => preview && onAdopt(preview, tab === 'draw' ? 'drawn' : 'typed')}><PenLine size={14} /> Adopt and {initialsMode ? 'initial' : 'sign'}</button></>}>
      <div className="mb-3 flex gap-1 rounded-control bg-surface-sunken p-1">
        <button className={cx('flex-1 rounded-control px-3 py-1.5 text-[13px] font-medium', tab === 'draw' ? 'bg-surface shadow-card text-ink-900' : 'text-ink-500')} onClick={() => setTab('draw')}><PenLine size={13} className="mr-1 inline" /> Draw</button>
        <button className={cx('flex-1 rounded-control px-3 py-1.5 text-[13px] font-medium', tab === 'type' ? 'bg-surface shadow-card text-ink-900' : 'text-ink-500')} onClick={() => setTab('type')}><Type size={13} className="mr-1 inline" /> Type</button>
      </div>
      {tab === 'draw' ? <SignaturePad onChange={setDrawn} /> : (
        <div className="space-y-3">
          <Field label={initialsMode ? 'Your initials' : 'Your full name'}><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
          <div className="flex gap-2">{(['script', 'serif'] as const).map((s) => <button key={s} className={cx('flex-1 rounded-control border p-2', style === s ? 'border-brand-500 bg-brand-50' : 'border-line')} onClick={() => setStyle(s)}>{typed.trim() && <img src={typedSignaturePng(typed.trim(), s)} alt="" className="mx-auto h-10" />}</button>)}</div>
        </div>
      )}
      {preview && <div className="mt-3 rounded-control border border-line bg-surface-muted p-2 text-center"><div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-ink-500">Preview</div><img src={preview} alt="signature preview" className="mx-auto h-12" /></div>}
      <label className="mt-3 flex items-start gap-2 text-[12px] text-ink-600"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />I agree that this electronic {initialsMode ? 'initial' : 'signature'} is the legally binding equivalent of my handwritten one, and that the platform will record my name, the date and time, and the document fingerprint with it.</label>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Page viewer with field overlay (placement + signing)
// ---------------------------------------------------------------------------
export const FIELD_TONE: Record<EnvelopeField['type'], string> = { signature: 'border-brand-600 bg-brand-100/70', initials: 'border-brand-600 bg-brand-50/80', date: 'border-info-500 bg-info-50/80', name: 'border-ink-500 bg-ink-100/70', title: 'border-ink-500 bg-ink-100/70', text: 'border-sun-500 bg-sun-50/80', checkbox: 'border-ink-500 bg-white' }

export function PageView({ page, fields, recipients, mode, activeRecipientId, onPlace, onSelect, selectedId, onFieldClick, values, hasTurn }: {
  page: RenderedPage; fields: EnvelopeField[]; recipients: EnvelopeRecipient[]; mode: 'place' | 'sign' | 'view'
  activeRecipientId?: string; onPlace?: (xFrac: number, yFrac: number) => void; onSelect?: (id: string) => void; selectedId?: string
  onFieldClick?: (f: EnvelopeField) => void; values?: Record<string, string>; hasTurn?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const click = (e: React.MouseEvent) => {
    if (mode !== 'place' || !onPlace) return
    if ((e.target as HTMLElement).closest('[data-field]')) return
    const r = ref.current!.getBoundingClientRect(); onPlace((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }
  const rIndex = (id: string) => recipients.findIndex((r) => r.id === id)
  const colors = ['border-brand-600', 'border-info-500', 'border-accent-600', 'border-sun-500', 'border-ink-700']
  return (
    <div ref={ref} className={cx('relative mx-auto w-full overflow-hidden rounded-control border border-line bg-white shadow-card', mode === 'place' && 'cursor-crosshair')} style={{ aspectRatio: `${page.width} / ${page.height}` }} onClick={click}>
      <img src={page.dataUrl} alt={`Page ${page.index + 1}`} className="block h-full w-full select-none" draggable={false} />
      {fields.filter((f) => f.page === page.index).map((f) => {
        const mine = f.recipientId === activeRecipientId
        const v = values?.[f.id] ?? f.value
        const owner = recipients.find((r) => r.id === f.recipientId)
        const interactive = mode === 'sign' && mine && hasTurn
        return (
          <div key={f.id} data-field onClick={(e) => { e.stopPropagation(); if (mode === 'place') onSelect?.(f.id); if (interactive) onFieldClick?.(f) }}
            className={cx('absolute flex items-center justify-center overflow-hidden rounded-[3px] border-2 text-[10px] leading-none', FIELD_TONE[f.type], colors[rIndex(f.recipientId) % colors.length], mode === 'place' && selectedId === f.id && 'ring-2 ring-sun-500', interactive && 'cursor-pointer hover:brightness-95', mode === 'sign' && !mine && 'opacity-50')}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }} title={`${FIELD_LABEL[f.type]} · ${owner?.name ?? ''}`}>
            {v ? (f.type === 'signature' || f.type === 'initials' ? <img src={v} alt="" className="h-full w-full object-contain" /> : f.type === 'checkbox' ? <span className="font-bold">{v === 'true' ? '✓' : ''}</span> : <span className="truncate px-1 text-[11px] text-ink-900">{v}</span>)
              : <span className={cx('truncate px-1 font-semibold', interactive ? 'text-brand-800' : 'text-ink-600')}>{interactive ? (f.type === 'signature' ? 'Sign here' : f.type === 'initials' ? 'Initial' : FIELD_LABEL[f.type]) : `${FIELD_LABEL[f.type]}${mode === 'place' ? ` · ${owner?.name.split(' ')[0] ?? ''}` : ''}`}{f.required && !v && <span className="text-accent-700"> *</span>}</span>}
          </div>
        )
      })}
    </div>
  )
}

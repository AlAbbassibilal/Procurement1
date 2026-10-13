import { useMemo, useState, useRef } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Download, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import type { StaffMember, User } from '@/types'
import { saveFile } from '@/lib/download'
import { cx } from '@/lib/format'

// ---------------------------------------------------------------------------
// Visual organogram — boxed top-down tree in the style of the RHS organogram
// deck: green for the Amman regional office, pink / red for the Gaza country
// office, amber for vacant positions, light green for acting assignments.
// ---------------------------------------------------------------------------
const BOX_W = 176, BOX_H = 62, H_GAP = 16, V_GAP = 54, PAD = 24
const COLORS = {
  amman: { fill: '#3A7C22', text: '#FFFFFF', sub: '#E8F5E1' },
  ammanLight: { fill: '#A9D18E', text: '#1C2833', sub: '#1C2833' },
  gaza: { fill: '#FD95A9', text: '#1C2833', sub: '#7A0C20' },
  gazaTeam: { fill: '#ED0531', text: '#FFFFFF', sub: '#FFE3E8' },
  vacant: { fill: '#FFC000', text: '#1C2833', sub: '#1C2833' },
}
export type NodeTone = keyof typeof COLORS
export const toneOf = (s: StaffMember): NodeTone => {
  if (!s.name.trim() || s.status === 'planned') return 'vacant'
  if (s.acting) return 'ammanLight'
  if (/gaza/i.test(s.country)) return /assistant|security|cleaner|mobile/i.test(s.position) ? 'gazaTeam' : 'gaza'
  return 'amman'
}

interface Laid { s: StaffMember; x: number; y: number; depth: number; children: Laid[]; width: number; collapsed: boolean; hidden: number }

function layout(staff: StaffMember[], roots: StaffMember[], collapsed: Set<string>): { nodes: Laid[]; width: number; height: number } {
  const kids = (id: string) => staff.filter((x) => x.lineManagerId === id).sort((a, b) => (toneOf(a) === 'vacant' ? 1 : 0) - (toneOf(b) === 'vacant' ? 1 : 0) || (a.name || a.position).localeCompare(b.name || b.position))
  const count = (id: string): number => kids(id).reduce((n, k) => n + 1 + count(k.id), 0)
  const build = (s: StaffMember, depth: number): Laid => {
    const isCol = collapsed.has(s.id)
    const children = isCol ? [] : kids(s.id).map((k) => build(k, depth + 1))
    const width = Math.max(BOX_W, children.reduce((w, c) => w + c.width, 0) + Math.max(0, children.length - 1) * H_GAP)
    return { s, x: 0, y: depth * (BOX_H + V_GAP), depth, children, width, collapsed: isCol, hidden: isCol ? count(s.id) : 0 }
  }
  const trees = roots.map((r) => build(r, 0))
  const place = (n: Laid, left: number) => {
    n.x = left + n.width / 2 - BOX_W / 2
    let cur = left + (n.width - (n.children.reduce((w, c) => w + c.width, 0) + Math.max(0, n.children.length - 1) * H_GAP)) / 2
    for (const c of n.children) { place(c, cur); cur += c.width + H_GAP }
  }
  let left = 0; for (const t of trees) { place(t, left); left += t.width + H_GAP * 3 }
  const flat: Laid[] = []; const walk = (n: Laid) => { flat.push(n); n.children.forEach(walk) }; trees.forEach(walk)
  const depth = flat.reduce((d, n) => Math.max(d, n.depth), 0)
  return { nodes: flat, width: Math.max(left - H_GAP * 3, BOX_W), height: (depth + 1) * BOX_H + depth * V_GAP }
}

const wrap = (text: string, max: number): string[] => { const words = text.split(/\s+/); const lines: string[] = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() } if (cur) lines.push(cur); return lines.slice(0, 2) }

export function OrgChartSvg({ staff, roots, users, title, onSelect, canEdit }: { staff: StaffMember[]; roots: StaffMember[]; users: User[]; title: string; onSelect?: (s: StaffMember) => void; canEdit?: boolean }) {
  // Start like the deck's Amman slide: teams two levels below the top are folded (click the circle to open them)
  const deep = (): Set<string> => { const depthOf = (s: StaffMember, d = 0): number => (s.lineManagerId && staff.some((x) => x.id === s.lineManagerId) ? depthOf(staff.find((x) => x.id === s.lineManagerId)!, d + 1) : d); return new Set(staff.filter((s) => depthOf(s) >= 3 && staff.some((k) => k.lineManagerId === s.id)).map((s) => s.id)) }
  const [collapsed, setCollapsed] = useState<Set<string>>(deep)
  const [scale, setScale] = useState(0.8)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { nodes, width, height } = useMemo(() => layout(staff, roots, collapsed), [staff, roots, collapsed])
  const W = width + PAD * 2, H = height + PAD * 2 + 70
  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n })
  const fit = () => { const el = wrapRef.current; if (!el) return; setScale(Math.min(1, Math.max(0.25, (el.clientWidth - 8) / W))) }
  const png = async () => {
    const svg = svgRef.current; if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement; clone.setAttribute('width', String(W)); clone.setAttribute('height', String(H))
    const xml = new XMLSerializer().serializeToString(clone)
    const img = new Image(); const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('render')); img.src = url })
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png')); if (blob) await saveFile(`${title.replace(/\W+/g, '_')}.png`, blob, 'image/png')
  }
  const legend: { tone: NodeTone; label: string }[] = [{ tone: 'amman', label: 'Regional office staff (Amman)' }, { tone: 'ammanLight', label: 'Acting' }, { tone: 'gaza', label: 'Gaza country office staff' }, { tone: 'gazaTeam', label: 'Mobile team / centre staff' }, { tone: 'vacant', label: 'Vacant' }]
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-[11.5px] text-ink-700">{legend.map((l) => <span key={l.tone} className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: COLORS[l.tone].fill }} />{l.label}</span>)}</div>
        <div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => setScale((s) => Math.max(0.25, s - 0.1))} title="Zoom out"><ZoomOut size={14} /></button><span className="self-center font-mono text-[11px] text-ink-500">{Math.round(scale * 100)}%</span><button className="btn-ghost btn-sm" onClick={() => setScale((s) => Math.min(2, s + 0.1))} title="Zoom in"><ZoomIn size={14} /></button><button className="btn-ghost btn-sm" onClick={fit} title="Fit to width"><Maximize2 size={14} /></button><button className="btn-secondary btn-sm" data-testid="org-png" onClick={png}><Download size={13} /> PNG</button><button className="btn-ghost btn-sm" onClick={() => window.print()} title="Print"><Printer size={14} /></button></div>
      </div>
      <div ref={wrapRef} className="overflow-auto rounded-card border border-line bg-white scrollbar-thin" style={{ maxHeight: '70vh' }}>
        <div style={{ width: W * scale, height: H * scale }}>
          <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif', display: 'block' }} data-testid="org-svg">
            <defs><marker id="org-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 z" fill="#1C2833" /></marker></defs>
            <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
            <text x={PAD} y={34} fontSize={22} fontWeight={600} fill="#1C2833">{title}</text>
            <line x1={0} y1={H - 6} x2={W} y2={H - 6} stroke="#3A7C22" strokeWidth={4} />
            <g transform={`translate(${PAD}, ${PAD + 50})`}>
              {nodes.map((n) => n.children.map((c) => { const x1 = n.x + BOX_W / 2, y1 = n.y + BOX_H, x2 = c.x + BOX_W / 2, y2 = c.y, ym = y1 + V_GAP / 2; return <path key={n.s.id + c.s.id} d={`M${x1},${y1} L${x1},${ym} L${x2},${ym} L${x2},${y2 - 1}`} fill="none" stroke="#1C2833" strokeWidth={1.4} markerEnd="url(#org-arrow)" /> }))}
              {nodes.map((n) => { const t = COLORS[toneOf(n.s)]; const u = users.find((x) => x.id === n.s.userId); const pos = wrap(n.s.position, 24); const name = n.s.name.trim() ? (n.s.acting ? `Acting · ${n.s.name}` : n.s.name) : 'Vacant'; const hasKids = staff.some((x) => x.lineManagerId === n.s.id); return (
                <g key={n.s.id} transform={`translate(${n.x}, ${n.y})`} className={onSelect ? 'cursor-pointer' : undefined} onClick={() => onSelect?.(n.s)} data-testid={`org-box-${n.s.rhsNumber}`}>
                  <rect width={BOX_W} height={BOX_H} rx={3} fill={t.fill} stroke="#1C2833" strokeWidth={0.8} />
                  {pos.map((l, i) => <text key={i} x={BOX_W / 2} y={pos.length === 1 ? 20 : 15 + i * 13} textAnchor="middle" fontSize={11.5} fill={t.text}>{l}</text>)}
                  <text x={BOX_W / 2} y={pos.length === 1 ? 40 : 46} textAnchor="middle" fontSize={12} fontWeight={700} fill={t.sub}>{name.length > 26 ? name.slice(0, 25) + '…' : name}</text>
                  {u && <title>{`${n.s.rhsNumber} · ${n.s.name} · ${n.s.position}\n${u.email}`}</title>}
                  {hasKids && <g onClick={(e) => { e.stopPropagation(); toggle(n.s.id) }} className="cursor-pointer" data-testid={`org-toggle-${n.s.rhsNumber}`}><circle cx={BOX_W - 12} cy={BOX_H - 12} r={8} fill="#ffffff" stroke="#1C2833" strokeWidth={0.8} /><text x={BOX_W - 12} y={BOX_H - 8.5} textAnchor="middle" fontSize={10} fill="#1C2833" style={{ pointerEvents: 'none' }}>{n.collapsed ? `+${n.hidden}` : '−'}</text></g>}
                </g>) })}
            </g>
          </svg>
        </div>
      </div>
      <div className="mt-1 text-[11.5px] text-ink-500">{nodes.length} position{nodes.length === 1 ? '' : 's'} shown{collapsed.size ? ` · ${collapsed.size} branch${collapsed.size === 1 ? '' : 'es'} collapsed (click the circle to expand)` : ''}{canEdit ? ' · click a box to edit' : ''} <span className={cx('ml-2 inline-flex items-center gap-0.5')}>{collapsed.size ? <button className="text-brand-700 hover:underline" onClick={() => setCollapsed(new Set())}><ChevronDown size={11} className="inline" /> expand all</button> : <button className="text-brand-700 hover:underline" onClick={() => setCollapsed(new Set(staff.filter((s) => s.lineManagerId && staff.some((k) => k.lineManagerId === s.id) && staff.some((k) => k.lineManagerId === s.id && staff.some((g) => g.lineManagerId === k.id))).map((s) => s.id)))}><ChevronUp size={11} className="inline" /> collapse deep branches</button>}</span></div>
    </div>
  )
}

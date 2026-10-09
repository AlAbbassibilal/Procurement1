// ---------------------------------------------------------------------------
// E-Signature — envelopes, field tags, PDF rendering (pdf.js) and completion
// (pdf-lib): burns every field into the PDF, stamps name / title / date-time /
// envelope ID / fingerprint under each signature and appends a Certificate
// of Completion page with the audit trail.
// ---------------------------------------------------------------------------
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import workerGz from 'virtual:pdf-worker-gz'
import type { Envelope, EnvelopeField, EnvelopeRecipient, SignatureEvent } from '@/types'

let workerReady: Promise<void> | undefined
/** The worker ships gzipped inside the bundle; inflate it once with the browser's DecompressionStream and serve it from a blob URL. */
function ensureWorker() {
  if (!workerReady) workerReady = (async () => {
    try {
      const bin = Uint8Array.from(atob(workerGz), (c) => c.charCodeAt(0))
      const text = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }))
    } catch { /* viewer without DecompressionStream — pdf.js falls back to its fake worker */ }
  })()
  return workerReady
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Accept PDF as-is; wrap PNG/JPEG into a single-page PDF. */
export async function toPdfBytes(file: File): Promise<Uint8Array> {
  const buf = new Uint8Array(await file.arrayBuffer())
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return buf
  const doc = await PDFDocument.create()
  const img = file.type === 'image/png' || /\.png$/i.test(file.name) ? await doc.embedPng(buf) : await doc.embedJpg(buf)
  const w = 595.28, h = 841.89, margin = 36
  const scale = Math.min((w - 2 * margin) / img.width, (h - 2 * margin) / img.height)
  const page = doc.addPage([w, h])
  page.drawImage(img, { x: (w - img.width * scale) / 2, y: h - margin - img.height * scale, width: img.width * scale, height: img.height * scale })
  return doc.save()
}

export interface RenderedPage { index: number; dataUrl: string; width: number; height: number }

/** Render every page to a PNG data URL for on-screen placement / signing. */
export async function renderPages(bytes: Uint8Array, scale = 1.4): Promise<RenderedPage[]> {
  await ensureWorker()
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const out: RenderedPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    out.push({ index: i - 1, dataUrl: canvas.toDataURL('image/png'), width: vp.width, height: vp.height })
  }
  await doc.destroy()
  return out
}

export const FIELD_LABEL: Record<EnvelopeField['type'], string> = { signature: 'Signature', initials: 'Initials', date: 'Date signed', name: 'Name', title: 'Title', text: 'Text', checkbox: 'Checkbox' }
export const DEFAULT_SIZE: Record<EnvelopeField['type'], { w: number; h: number }> = { signature: { w: 0.28, h: 0.075 }, initials: { w: 0.09, h: 0.05 }, date: { w: 0.18, h: 0.035 }, name: { w: 0.26, h: 0.035 }, title: { w: 0.26, h: 0.035 }, text: { w: 0.3, h: 0.035 }, checkbox: { w: 0.03, h: 0.03 } }

export const fmtStamp = (iso: string) => {
  const d = new Date(iso)
  const local = d.toLocaleString('en-GB', { timeZone: 'Asia/Amman', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${local} (Amman) · ${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`
}

/** Typed signature → PNG data URL (used when the signer types instead of drawing). */
export function typedSignaturePng(text: string, style: 'script' | 'serif' = 'script'): string {
  const c = document.createElement('canvas'); c.width = 900; c.height = 240
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#152b38'; ctx.textBaseline = 'middle'
  ctx.font = style === 'script' ? 'italic 500 96px "Brush Script MT", "Segoe Script", "Apple Chancery", "URW Chancery L", cursive' : 'italic 600 84px Georgia, "Times New Roman", serif'
  let w = ctx.measureText(text).width; let size = 96
  while (w > 860 && size > 30) { size -= 6; ctx.font = ctx.font.replace(/\d+px/, `${size}px`); w = ctx.measureText(text).width }
  ctx.fillText(text, 20, 120)
  return c.toDataURL('image/png')
}

const dataUrlBytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1]!), (c) => c.charCodeAt(0))

const wrap = (text: string, font: PDFFont, size: number, maxW: number) => {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = ''
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (font.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w } else cur = t }
  if (cur) lines.push(cur); return lines
}

/** Burn all completed fields into the PDF and append the Certificate of Completion. */
export async function finalizeEnvelope(original: Uint8Array, env: Envelope, orgName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original)
  const helv = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), mono = await doc.embedFont(StandardFonts.Courier)
  const pages = doc.getPages()
  const ink = rgb(0.08, 0.17, 0.22), green = rgb(0, 0.52, 0.25), grey = rgb(0.4, 0.46, 0.52)
  for (const f of env.fields) {
    const page: PDFPage | undefined = pages[f.page]; if (!page || !f.value) continue
    const { width: W, height: H } = page.getSize()
    const x = f.x * W, w = f.w * W, h = f.h * H, yTop = H - f.y * H, y = yTop - h
    const r = env.recipients.find((rc) => rc.id === f.recipientId)
    if (f.type === 'signature' || f.type === 'initials') {
      const png = await doc.embedPng(dataUrlBytes(f.value))
      const reserve = f.type === 'signature' ? 20 : 2
      const s = Math.min((w - 4) / png.width, (h - reserve) / png.height)
      page.drawImage(png, { x: x + 2, y: y + reserve - 1, width: png.width * s, height: png.height * s })
      page.drawLine({ start: { x, y: y + reserve - 2 }, end: { x: x + w, y: y + reserve - 2 }, thickness: 0.6, color: ink })
      if (f.type === 'signature' && r) {
        const when = r.signedAt ?? new Date().toISOString()
        const fit = (t: string, size: number, fnt: PDFFont) => { let out = t; while (fnt.widthOfTextAtSize(out, size) > w && out.length > 8) out = out.slice(0, -2); return out === t ? t : out.slice(0, -1) + '…' }
        page.drawText(fit(`Signed by ${r.name}${r.title ? `, ${r.title}` : ''}`, 5.6, bold), { x, y: y + 12, size: 5.6, font: bold, color: green })
        page.drawText(fit(fmtStamp(when), 4.8, helv), { x, y: y + 6.5, size: 4.8, font: helv, color: green })
        page.drawText(fit(`${env.number} · SHA-256 ${env.hash.slice(0, 20)}…`, 4.4, mono), { x, y: y + 1.5, size: 4.4, font: mono, color: grey })
      }
    } else if (f.type === 'checkbox') {
      page.drawRectangle({ x, y, width: w, height: h, borderColor: ink, borderWidth: 0.8 })
      if (f.value === 'true') page.drawText('X', { x: x + w * 0.22, y: y + h * 0.18, size: h * 0.7, font: bold, color: ink })
    } else {
      const size = Math.min(10, h * 0.62)
      page.drawText(f.value, { x: x + 2, y: y + (h - size) / 2 + 1, size, font: helv, color: ink, maxWidth: w })
    }
  }
  // ---- Certificate of Completion ------------------------------------------
  const cert = doc.addPage([595.28, 841.89]); const { width: W } = cert.getSize(); let cy = 800
  const line = (t: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) => { cert.drawText(t, { x: opts.x ?? 48, y: cy, size: opts.size ?? 9.5, font: opts.font ?? helv, color: opts.color ?? ink }); cy -= (opts.size ?? 9.5) + 5 }
  cert.drawRectangle({ x: 0, y: 812, width: W, height: 30, color: rgb(0, 0.52, 0.25) })
  cert.drawText(`${orgName} — Certificate of Completion`, { x: 48, y: 822, size: 12, font: bold, color: rgb(1, 1, 1) })
  cy = 780
  line('Envelope summary', { size: 12, font: bold }); cy -= 2
  for (const [k, v] of [['Envelope ID', env.number], ['Subject', env.subject], ['Document', `${env.documentName} · ${env.pageCount} page(s)`], ['Original fingerprint (SHA-256)', env.hash], ['Sent by', `${env.createdByName} · ${fmtStamp(env.sentAt ?? env.createdAt)}`], ['Signing order', env.signingOrder === 'sequential' ? 'Sequential' : 'Parallel (any order)'], ['Status', `${env.status.toUpperCase()}${env.completedAt ? ` · ${fmtStamp(env.completedAt)}` : ''}`]] as [string, string][]) {
    cert.drawText(k, { x: 48, y: cy, size: 8.5, font: bold, color: grey }); const lines = wrap(v, k.includes('SHA') ? mono : helv, 8.5, 360); lines.forEach((l, i) => cert.drawText(l, { x: 215, y: cy - i * 11, size: 8.5, font: k.includes('SHA') ? mono : helv, color: ink })); cy -= 11 * lines.length + 3
  }
  cy -= 10; line('Recipients', { size: 12, font: bold }); cy -= 2
  for (const r of env.recipients) {
    line(`${r.order}. ${r.name}${r.title ? ` — ${r.title}` : ''} · ${r.email} · ${r.role.toUpperCase()}`, { font: bold, size: 9 })
    for (const l of wrap(`Status: ${r.status}${r.viewedAt ? ` · viewed ${fmtStamp(r.viewedAt)}` : ''}${r.signedAt ? ` · ${r.role === 'approver' ? 'approved' : 'signed'} ${fmtStamp(r.signedAt)}` : ''}${r.declineReason ? ` · declined: ${r.declineReason}` : ''}`, helv, 8.5, W - 120)) line(l, { size: 8.5, color: grey, x: 62 })
    const sig = env.fields.find((f) => f.recipientId === r.id && f.type === 'signature' && f.value)
    if (sig) { const png = await doc.embedPng(dataUrlBytes(sig.value!)); const s = Math.min(120 / png.width, 34 / png.height); cert.drawImage(png, { x: 62, y: cy - 30, width: png.width * s, height: png.height * s }); cert.drawText(`Signature adopted: ${r.signatureMethod ?? 'drawn'}`, { x: 200, y: cy - 16, size: 8, font: helv, color: grey }); cy -= 40 }
    cy -= 4
  }
  cy -= 8; line('Audit trail', { size: 12, font: bold }); cy -= 2
  for (const e of env.events) { if (cy < 60) break; for (const l of wrap(`${fmtStamp(e.at)}  ·  ${e.actorName}  ·  ${e.action}${e.detail ? ` — ${e.detail}` : ''}`, helv, 8, W - 96)) line(l, { size: 8, font: e.action.toLowerCase().includes('complete') ? bold : helv }) }
  cert.drawText('This certificate is generated by the RHS PCM & Grants Management Platform and forms part of the signed document. Timestamps are recorded by the platform at the moment of each action.', { x: 48, y: 30, size: 7, font: helv, color: grey, maxWidth: W - 96 })
  return doc.save()
}

export const newEvent = (actorId: string, actorName: string, action: string, detail?: string): SignatureEvent => ({ id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), actorId, actorName, action, detail })
export const recipientTurn = (env: Envelope): EnvelopeRecipient[] => {
  const open = env.recipients.filter((r) => ['sent', 'viewed'].includes(r.status) && r.role !== 'cc')
  if (env.signingOrder === 'parallel') return open
  const minOrder = Math.min(...open.map((r) => r.order)); return open.filter((r) => r.order === minOrder)
}

/** Plain text of every page (used by recruitment to read CVs). */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  await ensureWorker()
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) { const page = await doc.getPage(i); const c = await page.getTextContent(); out.push(c.items.map((it) => ('str' in it ? it.str : '')).join(' ')) }
  return out.join('\n')
}

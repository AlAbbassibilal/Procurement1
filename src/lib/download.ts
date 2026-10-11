// ---------------------------------------------------------------------------
// File downloads — one path for every export. Inside the claude.ai viewer the
// page asks the host to save the file (downloads capability); in a normal
// browser it falls back to an anchor download.
// ---------------------------------------------------------------------------
import type * as XLSXType from 'xlsx'

declare global { interface Window { claude?: { use?: (name: string) => Promise<unknown> } } }

type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> }
let hostDownloads: Promise<Downloads | null> | undefined
const host = () => {
  if (hostDownloads) return hostDownloads
  hostDownloads = (async () => {
    try {
      if (typeof window === 'undefined' || !window.claude?.use) return null
      const ns = await Promise.race([window.claude.use('downloads'), new Promise<null>((r) => setTimeout(() => r(null), 4000))])
      return (ns && typeof (ns as Downloads).save === 'function') ? (ns as Downloads) : null
    } catch { return null }
  })()
  return hostDownloads
}

export type SaveOutcome = 'saved' | 'declined' | 'browser'
/** Offer a generated file to the person: host save surface when available, otherwise a browser download. */
export async function saveFile(filename: string, data: Blob | Uint8Array | ArrayBuffer | string, type = 'application/octet-stream'): Promise<SaveOutcome> {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type })
  const dl = await host()
  if (dl) {
    try { await dl.save({ filename, data: blob }); return 'saved' } catch (e) { if ((e as { code?: string })?.code === 'declined') return 'declined' /* any other failure: fall back */ }
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'browser'
}
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** Replaces XLSX.writeFile so workbooks go through saveFile. */
export const saveWorkbook = (X: typeof XLSXType, wb: XLSXType.WorkBook, filename: string) => saveFile(filename, new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' }) as BlobPart], { type: XLSX_MIME }), XLSX_MIME)

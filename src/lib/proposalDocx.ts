// ---------------------------------------------------------------------------
// Export a proposal on the RHS template (public/templates/RHS_Proposal_Template.docx)
// exactly as designed — cover page, "About RHS" page, table of contents, general
// information table, headers, footers and logos — with the project's sections as
// the body. The template's usage-policy page is left out.
//
// Section text conventions (also produced by the document importer):
//   "## Title"  → Heading 2      "### Title" → Heading 3
//   "• item" / "- item" → bullet  anything else → body paragraph
// ---------------------------------------------------------------------------
import type { Project, OrgSettings } from '@/types'

// The hosted single-page build cannot serve .docx files, so the template travels as base64 text (public/templates/*.b64.txt)
const TEMPLATE_PATH = 'templates/RHS_Proposal_Template.b64.txt'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const unesc = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

/** Fetch the template next to the application (works for the hosted single-page build and the dev server). */
export async function loadProposalTemplate(): Promise<ArrayBuffer> {
  const url = new URL(TEMPLATE_PATH, document.baseURI).toString()
  const r = await fetch(url)
  if (!r.ok) throw new Error(`The RHS proposal template could not be loaded (${r.status}).`)
  const b64 = (await r.text()).trim()
  const bin = atob(b64); const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

const topLevel = (body: string) => body.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>|<w:sectPr[\s\S]*?<\/w:sectPr>|<w:sdt>[\s\S]*?<\/w:sdt>/g) ?? []
const textOf = (xml: string) => unesc(xml.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
const pPrOf = (p: string) => /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p)?.[0] ?? ''
const firstRPr = (p: string) => /<w:r(?: [^>]*)?>(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(p)?.[1] ?? ''
/** Replace the text of every <w:t> whose content matches `from` (exact) with `to`. */
const replaceText = (xml: string, from: string, to: string) => xml.replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (m, a, t, c) => (unesc(t) === from ? `${a.replace('<w:t>', '<w:t xml:space="preserve">')}${esc(to)}${c}` : m))

type Kind = 'h2' | 'h3' | 'bullet' | 'body'
export function classifyLine(line: string): { kind: Kind; text: string } | null {
  const t = line.trim()
  if (!t) return null
  if (/^###\s+/.test(t)) return { kind: 'h3', text: t.replace(/^###\s+/, '') }
  if (/^##\s+/.test(t)) return { kind: 'h2', text: t.replace(/^##\s+/, '') }
  if (/^[•\-*]\s+/.test(t)) return { kind: 'bullet', text: t.replace(/^[•\-*]\s+/, '') }
  if (t.length <= 120 && t === t.toUpperCase() && /[A-Z]{3}/.test(t) && !/[.:;]$/.test(t)) return { kind: 'h2', text: t }
  return { kind: 'body', text: t }
}

export async function buildProposalDocx(p: Project, settings: OrgSettings, totalBudget?: number, contact?: { name: string; email: string }): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await loadProposalTemplate())
  const doc = await zip.file('word/document.xml')!.async('string')
  const bodyStart = doc.indexOf('<w:body>') + 8, bodyEnd = doc.lastIndexOf('</w:body>')
  const parts = topLevel(doc.slice(bodyStart, bodyEnd))

  // ---- locate the template's landmarks by content, not by position -----------
  const idx = (pred: (t: string, i: number) => boolean) => parts.findIndex(pred)
  const iCover = 0
  const iUsage = idx((t) => /^<w:p/.test(t) && textOf(t) === 'Usage Policy')
  const iAbout = idx((t) => /^<w:p/.test(t) && /About Restoring Hope Society/.test(textOf(t)))
  const iToc = idx((t) => t.startsWith('<w:sdt>') && /Table of Contents/.test(t))
  const iInfo = idx((t) => t.startsWith('<w:tbl>') && /General Information/.test(textOf(t)))
  const iH1 = idx((t) => /<w:pStyle w:val="Heading1"\/>/.test(t))
  const iH2 = idx((t) => /<w:pStyle w:val="Heading2"\/>/.test(t))
  const iH3 = idx((t) => /<w:pStyle w:val="Heading3"\/>/.test(t))
  const iBullet = idx((t) => /<w:pStyle w:val="ListBullet"\/>/.test(t))
  const iBody = idx((t, i) => i > iH1 && /^<w:p/.test(t) && !/<w:pStyle/.test(t) && textOf(t).length > 80)
  const iSect = parts.length - 1
  if ([iUsage, iAbout, iToc, iInfo, iH1, iH2, iBullet, iBody].some((i) => i < 0)) throw new Error('The RHS proposal template layout was not recognised.')

  // ---- paragraph factories from the template's own formatting -----------------
  const H1 = pPrOf(parts[iH1]!), H2 = pPrOf(parts[iH2]!), H3 = iH3 >= 0 ? pPrOf(parts[iH3]!) : H2, BUL = pPrOf(parts[iBullet]!), BODY = pPrOf(parts[iBody]!)
  const rH1 = firstRPr(parts[iH1]!), rH2 = firstRPr(parts[iH2]!), rH3 = iH3 >= 0 ? firstRPr(parts[iH3]!) : rH2, rBul = firstRPr(parts[iBullet]!), rBody = firstRPr(parts[iBody]!)
  const para = (pPr: string, rPr: string, text: string) => `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
  const blank = `<w:p>${BODY}</w:p>`

  // ---- cover page: title and donor ------------------------------------------
  let cover = parts[iCover]!
  const coverTitle = textOf(parts[iCover]!.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g)?.slice(1).find((t) => textOf(t).length > 20) ?? '')
  if (coverTitle) cover = replaceText(cover, coverTitle, p.title)
  cover = replaceText(cover, 'Potential donor name', p.donorName || 'Donor')
  cover = replaceText(cover, 'Communication Standards & System ', 'Project Proposal ')
  cover = replaceText(cover, '2026_V0.1', `${new Date().getFullYear()}_${p.proposal.version || 'V1.0'}`)

  // ---- "About RHS" heading paragraph without the copyright line ----------------
  const about = parts[iAbout]!.replace(/<w:r(?: [^>]*)?>(?:(?!<\/w:r>)[\s\S])*?All Rights Reserved[\s\S]*?<\/w:r>/, '').replace(/<w:r(?: [^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:br\/><\/w:r>/, '')

  // ---- general information table --------------------------------------------
  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
  let info = parts[iInfo]!
  info = replaceText(info, 'Donor', p.donorName || '')
  info = replaceText(info, 'Date', fmtDate(p.proposal.submissionDeadline) || fmtDate(new Date().toISOString()))
  const infoTitleRuns = info.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g)?.map(textOf) ?? []
  const ti = infoTitleRuns.indexOf('Project Title')
  if (ti >= 0 && infoTitleRuns[ti + 1]) { info = replaceText(info, infoTitleRuns[ti + 1]!, p.title); if (infoTitleRuns[ti + 2] && infoTitleRuns[ti + 2] !== 'Project Duration') info = replaceText(info, infoTitleRuns[ti + 2]!, '') }
  const di = infoTitleRuns.indexOf('Project Duration'); if (di >= 0 && infoTitleRuns[di + 1] && infoTitleRuns[di + 1] !== 'Total Budget') info = replaceText(info, infoTitleRuns[di + 1]!, p.duration ?? '')
  info = replaceText(info, 'USD', totalBudget != null ? `${p.currency} ${totalBudget.toLocaleString('en', { maximumFractionDigits: 0 })}` : p.currency)
  if (contact) { info = replaceText(info, 'Contact Person', `Contact Person: ${contact.name}`); info = replaceText(info, 'E-mail', `E-mail: ${contact.email}`) }

  // ---- body from the project's sections --------------------------------------
  const sections: string[] = []
  for (const s of p.proposal.sections) {
    sections.push(para(H1, rH1, s.title))
    for (const line of s.content.split(/\r?\n/)) {
      const c = classifyLine(line); if (!c) continue
      sections.push(c.kind === 'h2' ? para(H2, rH2, c.text) : c.kind === 'h3' ? para(H3, rH3, c.text) : c.kind === 'bullet' ? para(BUL, rBul, c.text) : para(BODY, rBody, c.text))
    }
    sections.push(blank)
  }

  const front = [cover, ...parts.slice(iAbout + 1, iToc).filter((_, k) => k + iAbout + 1 !== iUsage), parts[iToc]!, ...parts.slice(iToc + 1, iInfo), info, blank]
  const out: string[] = [cover === parts[iCover] ? cover : cover, about, ...front.slice(1), ...sections, parts[iSect]!]
  const newDoc = doc.slice(0, bodyStart) + out.join('') + doc.slice(bodyEnd)
  zip.file('word/document.xml', newDoc)

  // Word refreshes the table of contents when the file is opened
  const settingsXml = await zip.file('word/settings.xml')?.async('string')
  if (settingsXml && !/updateFields/.test(settingsXml)) { const anchor = ['<w:hdrShapeDefaults', '<w:footnotePr', '<w:endnotePr', '<w:compat'].map((a) => settingsXml.indexOf(a)).find((i) => i >= 0); if (anchor !== undefined) zip.file('word/settings.xml', settingsXml.slice(0, anchor) + '<w:updateFields w:val="true"/>' + settingsXml.slice(anchor)) }
  // document properties
  const core = await zip.file('docProps/core.xml')?.async('string')
  if (core) zip.file('docProps/core.xml', core.replace(/<dc:title>[^<]*<\/dc:title>/, `<dc:title>${esc(p.title)}</dc:title>`).replace(/<dc:creator>[^<]*<\/dc:creator>/, `<dc:creator>${esc(settings.orgName)} — Bilal Abbassi</dc:creator>`))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

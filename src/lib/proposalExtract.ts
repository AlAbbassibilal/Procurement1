// ---------------------------------------------------------------------------
// Proposal import — read a proposal document (Word, PDF or text), detect its
// headings, and map each part onto the project's proposal sections.
// Runs entirely in the browser: Word via the document XML (heading styles and
// bold one-liners), PDF via pdf.js (larger / bold text as headings), text via
// Markdown-style or numbered headings. The administrator reviews the mapping
// before anything is written to the project.
// ---------------------------------------------------------------------------
import type { ProposalSection } from '@/types'

export interface DocPart { heading: string; body: string }
export interface ExtractedDoc { parts: DocPart[]; facts: { requestedAmount?: number; currency?: string; durationMonths?: number; submittedTo?: string; reference?: string }; text: string }

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")

/** Does this line look like a heading? Short, no final full stop, numbered / title-case / upper-case. */
export function looksLikeHeading(line: string): boolean {
  const t = clean(line)
  if (!t || t.length > 90 || /[.:;,]$/.test(t)) return false
  if (/^(\d+(\.\d+)*[.)]?|[IVX]+[.)]|[A-Z][.)])\s+\S/.test(t)) return true
  if (/^#{1,4}\s+/.test(t)) return true
  const words = t.split(' ')
  if (words.length <= 8 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true
  if (words.length <= 7 && words.filter((w) => /^[A-Z&(]/.test(w) || w.length <= 3).length === words.length) return true
  return false
}

/** Word: paragraphs with their style — Heading styles and short bold paragraphs are headings. */
async function wordParagraphs(file: File): Promise<{ text: string; heading: boolean }[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? ''
  const out: { text: string; heading: boolean }[] = []
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const p = m[0]
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? ''
    const text = clean(decode(p.replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '')))
    if (!text) continue
    const runs = [...p.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].map((r) => r[0])
    const allBold = runs.length > 0 && runs.every((r) => /<w:b\/>|<w:b w:val="(1|true)"/.test(r) || !/<w:t/.test(r))
    const heading = /heading|title|subtitle/i.test(style) || (allBold && text.length <= 90 && !/[.]$/.test(text)) || looksLikeHeading(text) && text.length <= 60
    out.push({ text, heading })
  }
  return out
}

/** PDF: lines rebuilt from text items; a line set noticeably larger than the body text is a heading. */
async function pdfParagraphs(file: File): Promise<{ text: string; heading: boolean }[]> {
  const { pdfLines } = await import('./esign')
  const lines = await pdfLines(new Uint8Array(await file.arrayBuffer()))
  const sizes = lines.map((l) => l.size).filter((s) => s > 0).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] ?? 10
  return lines.filter((l) => clean(l.text)).map((l) => ({ text: clean(l.text), heading: (l.size > body * 1.15 && l.text.length <= 90) || (l.bold && l.text.length <= 70 && !/[.]$/.test(l.text)) || looksLikeHeading(l.text) }))
}

function textParagraphs(text: string): { text: string; heading: boolean }[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => ({ text: l.replace(/^#{1,4}\s+/, ''), heading: looksLikeHeading(l) }))
}

/** Group paragraphs under their headings. Lines before the first heading become "Introduction". */
export function groupParts(paras: { text: string; heading: boolean }[]): DocPart[] {
  const parts: DocPart[] = []
  let cur: DocPart | null = null
  for (const p of paras) {
    if (p.heading) { if (cur && cur.body.trim()) parts.push(cur); cur = { heading: p.text.replace(/^(\d+(\.\d+)*[.)]?|[IVX]+[.)]|[A-Z][.)])\s+/, ''), body: '' } }
    else { if (!cur) cur = { heading: 'Introduction', body: '' }; cur.body += (cur.body ? '\n' : '') + p.text }
  }
  if (cur && cur.body.trim()) parts.push(cur)
  // merge tiny consecutive parts (sub-headings) into the previous one
  const merged: DocPart[] = []
  for (const pt of parts) {
    const prev = merged[merged.length - 1]
    if (prev && pt.body.length < 120 && merged.length) prev.body += `\n\n${pt.heading}\n${pt.body}`
    else merged.push({ ...pt })
  }
  return merged
}

/** Facts worth pulling into the submission card. */
export function detectFacts(text: string): ExtractedDoc['facts'] {
  const facts: ExtractedDoc['facts'] = {}
  const amt = /(total (?:project )?(?:budget|cost|amount)|amount requested|requested amount|funding request(?:ed)?|grant request(?:ed)?)[^\d]{0,40}(USD|US\$|\$|EUR|€|JOD|JD)?\s?([\d,]+(?:\.\d+)?)\s?(USD|EUR|JOD|JD)?/i.exec(text)
  if (amt) { const n = Number(amt[3]!.replace(/,/g, '')); if (n > 0) { facts.requestedAmount = n; const c = (amt[2] ?? amt[4] ?? '').toUpperCase(); facts.currency = c.includes('€') || c === 'EUR' ? 'EUR' : c.startsWith('JD') || c === 'JOD' ? 'JOD' : c ? 'USD' : undefined } }
  const dur = /(?:duration|period|implementation period)[^\d]{0,30}(\d{1,2})\s*months?/i.exec(text) ?? /(\d{1,2})[- ]months?\s+(?:project|programme|program|intervention)/i.exec(text)
  if (dur) facts.durationMonths = Number(dur[1])
  const to = /(?:submitted to|prepared for|proposal to|addressed to)[:\s]+([A-Z][^\n.;]{2,60})/i.exec(text)
  if (to) facts.submittedTo = clean(to[1]!)
  const ref = /(?:call|reference|ref\.?|grant no\.?|RFP|RFA)[:\s#]+([A-Z0-9][A-Z0-9/_-]{3,30})/i.exec(text)
  if (ref) facts.reference = ref[1]!
  return facts
}

export async function extractProposal(file: File): Promise<ExtractedDoc> {
  const name = file.name.toLowerCase()
  const paras = name.endsWith('.docx') ? await wordParagraphs(file) : (name.endsWith('.pdf') || file.type === 'application/pdf') ? await pdfParagraphs(file) : textParagraphs(await file.text())
  const text = paras.map((p) => p.text).join('\n')
  return { parts: groupParts(paras), facts: detectFacts(text), text }
}

// ---- mapping onto proposal sections -------------------------------------------
const KEYWORDS: Record<string, string[]> = {
  'Background & problem statement': ['background', 'context', 'problem', 'rationale', 'situation', 'need', 'needs', 'introduction', 'justification', 'analysis', 'overview', 'summary'],
  'Objectives & expected results': ['objective', 'objectives', 'goal', 'goals', 'outcome', 'outcomes', 'result', 'results', 'purpose', 'aim', 'aims', 'outputs', 'theory of change', 'impact'],
  'Approach & activities': ['approach', 'activities', 'activity', 'methodology', 'method', 'strategy', 'implementation', 'intervention', 'interventions', 'description', 'work plan', 'workplan', 'components', 'design'],
  'Target beneficiaries & locations': ['beneficiaries', 'beneficiary', 'target', 'targets', 'location', 'locations', 'geographic', 'geography', 'area', 'areas', 'participants', 'population', 'coverage', 'who'],
  'Partners & coordination': ['partner', 'partners', 'partnership', 'coordination', 'stakeholder', 'stakeholders', 'collaboration', 'consortium', 'cooperation'],
  'Monitoring, evaluation & learning': ['monitoring', 'evaluation', 'meal', 'm&e', 'learning', 'indicators', 'indicator', 'reporting', 'accountability', 'logframe', 'measurement'],
  'Risks & mitigation': ['risk', 'risks', 'mitigation', 'assumptions', 'assumption', 'challenges', 'constraints', 'safeguarding', 'security'],
  'Sustainability & exit': ['sustainability', 'sustainable', 'exit', 'handover', 'continuation', 'ownership', 'phase-out', 'legacy'],
  'Organisational capacity': ['capacity', 'organisation', 'organization', 'about', 'experience', 'track record', 'applicant', 'profile', 'who we are', 'team', 'staff', 'management'],
}
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['and', 'the', 'for', 'with', 'our'].includes(w))

/** Score how well a document heading fits a proposal section title. */
export function matchScore(heading: string, section: string): number {
  const h = heading.toLowerCase(); const ht = tokens(heading); const st = tokens(section)
  let score = 0
  if (h === section.toLowerCase()) return 100
  for (const w of st) if (ht.includes(w)) score += 20
  for (const k of KEYWORDS[section] ?? []) if (h.includes(k)) score += k.length > 5 ? 15 : 10
  for (const w of ht) if (section.toLowerCase().includes(w)) score += 8
  return score
}

/** Best target section for each document part (undefined = no good match → new section). */
export function suggestMapping(parts: DocPart[], sections: ProposalSection[]): (string | undefined)[] {
  const used = new Set<string>()
  return parts.map((pt) => {
    const ranked = sections.map((s) => ({ id: s.id, score: matchScore(pt.heading, s.title) })).filter((x) => x.score >= 15 && !used.has(x.id)).sort((a, b) => b.score - a.score)
    const best = ranked[0]; if (best) used.add(best.id)
    return best?.id
  })
}

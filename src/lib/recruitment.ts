// ---------------------------------------------------------------------------
// Recruitment engine — approval chain, CV text extraction (PDF / Word / text),
// keyword matching and years-of-experience detection, applicant scoring.
// ---------------------------------------------------------------------------
import type { Applicant, ApplicantScore, StaffMember, User, Vacancy, VacancyApproval, VacancyStatus } from '@/types'
import { uid } from './format'

export const VACANCY_STATUS_LABEL: Record<VacancyStatus, string> = { draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved — to advertise', advertised: 'Advertised', closed: 'Closed', rejected: 'Rejected' }
export const VACANCY_STATUS_TONE: Record<VacancyStatus, string> = { draft: 'bg-ink-100 text-ink-700', pending_approval: 'bg-sun-100 text-sun-700', approved: 'bg-info-50 text-info-700', advertised: 'bg-brand-600 text-white', closed: 'bg-ink-200 text-ink-600', rejected: 'bg-danger-50 text-danger-700' }
export const APPLICANT_STATUS_LABEL = { new: 'New', shortlisted: 'Shortlisted', interview: 'Interview', offered: 'Offered', hired: 'Hired', rejected: 'Rejected' } as const
export const APPLICANT_STATUS_TONE = { new: 'bg-ink-100 text-ink-700', shortlisted: 'bg-info-50 text-info-700', interview: 'bg-sun-100 text-sun-700', offered: 'bg-brand-100 text-brand-800', hired: 'bg-brand-600 text-white', rejected: 'bg-danger-50 text-danger-700' } as const

/** Approval chain: the requester's own line manager (director) first, then the Director of Finance & Support. */
export function buildVacancyChain(requester: User, staff: StaffMember[], users: User[]): VacancyApproval[] {
  const me = staff.find((s) => s.userId === requester.id)
  const mgr = staff.find((s) => s.id === me?.lineManagerId)
  const mgrUser = users.find((u) => u.id === mgr?.userId && u.active)
  const director: VacancyApproval = mgrUser && mgrUser.id !== requester.id
    ? { key: 'director', label: `Line manager — ${mgr!.position}`, role: mgrUser.role, approverId: mgrUser.id, approverName: mgrUser.name, status: 'pending' }
    : { key: 'director', label: 'Director of Programs', role: 'programs_director', status: 'pending' }
  return [director, { key: 'finance', label: 'Director of Finance & Support — budget check', role: 'finance_director', status: 'pending' }]
}
export const currentVacancyStep = (v: Vacancy) => v.approvals.find((a) => a.status === 'pending')
export const canDecideVacancy = (v: Vacancy, user: User) => {
  const step = currentVacancyStep(v); if (!step || v.status !== 'pending_approval') return false
  if (user.role === 'admin') return true
  return step.approverId ? step.approverId === user.id : user.role === step.role || (user.approverRoles?.includes(step.role) ?? false)
}

// ---- keywords ----------------------------------------------------------------
export const parseKeywords = (s: string) => Array.from(new Set(s.split(/[,;\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean)))
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const keywordHits = (text: string, keywords: string[]) => {
  const t = text.toLowerCase()
  const matched = keywords.filter((k) => new RegExp(`(^|[^a-z0-9])${esc(k)}(s|es|ing|ed)?([^a-z0-9]|$)`, 'i').test(t))
  return { matched, missing: keywords.filter((k) => !matched.includes(k)) }
}
/** Highest "N years" figure found in the CV text (e.g. "5+ years", "7 yrs of experience", "over 4 years"). */
export const detectYears = (text: string): number | null => {
  const re = /(\d{1,2})(?:\s*\+|\s*plus)?\s*(?:years?|yrs?)\b/gi
  let best: number | null = null; let m: RegExpExecArray | null
  while ((m = re.exec(text))) { const n = Number(m[1]); if (n > 0 && n <= 45 && (best === null || n > best)) best = n }
  // date ranges like 2016 – 2024 / 2019-present
  const ranges = /(?:19|20)(\d{2})\s*[–-]\s*((?:19|20)\d{2}|present|current|now|to date)/gi
  let span = 0
  while ((m = ranges.exec(text))) { const a = Number('20' + m[1]) > new Date().getFullYear() ? Number('19' + m[1]) : Number('20' + m[1]); const bRaw = m[2]!.toLowerCase(); const b = /^\d{4}$/.test(bRaw) ? Number(bRaw) : new Date().getFullYear(); if (b >= a && b - a <= 45) span += b - a }
  if (span && (best === null || span > best)) best = span
  return best
}
export function scoreApplicant(v: Vacancy, cvText: string, coverLetter: string, yearsDeclared: number): ApplicantScore {
  const { matched, missing } = keywordHits(`${cvText}\n${coverLetter}`, v.keywords)
  const keywordPct = v.keywords.length ? Math.round((matched.length / v.keywords.length) * 100) : 100
  const yearsDetected = detectYears(cvText)
  const years = Math.max(yearsDeclared, yearsDetected ?? 0)
  const meetsYears = years >= v.minYears
  const total = Math.round(keywordPct * 0.7 + (meetsYears ? 30 : Math.min(30, (years / Math.max(1, v.minYears)) * 30)))
  return { matched, missing, keywordPct, yearsDetected, yearsDeclared, meetsYears, total }
}
export const rescore = (v: Vacancy, a: Applicant): Applicant => ({ ...a, score: scoreApplicant(v, a.cvText, a.coverLetter, a.yearsExperience) })

// ---- CV text extraction -------------------------------------------------------
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { pdfText } = await import('./esign')
    return pdfText(new Uint8Array(await file.arrayBuffer()))
  }
  if (name.endsWith('.docx')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const xml = await zip.file('word/document.xml')?.async('string')
    return (xml ?? '').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim()
  }
  return (await file.text()).trim()
}
export const applyLink = (token: string) => `${location.origin}${location.pathname}#/apply/${token}`
export const newApplicantId = () => uid('app_')

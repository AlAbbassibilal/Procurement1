// ---------------------------------------------------------------------------
// Partnerships engine — partner stages, due-diligence scaffolding, progress,
// capacity (PCA) scoring, risk levels and the workbook export.
// Mirrors the "RHS Pre-Contract Due Diligence" workbook (src/data/dueDiligence.ts).
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import { DD_CHECKLIST, DD_PLATFORMS, DD_VETTING_QUESTIONS, PCA_SECTIONS, PCA_CATEGORY_LABELS, RISK_MATRIX, DD_RISK_GROUPS } from '@/data/dueDiligence'
import type { PcaKey } from '@/data/dueDiligence'
import { uid } from './format'
import type { DueDiligence, Partner, PartnerStage, PartnerType, PartnerRisk, PcaScore, Project, Vetting, KeyPerson } from '@/types'

export const PARTNER_STAGE_LABEL: Record<PartnerStage, string> = {
  identified: 'Identified', due_diligence: 'Due diligence', approved: 'Approved', agreement: 'Agreement / MoU', active: 'Active', closed: 'Closed', declined: 'Declined',
}
export const PARTNER_STAGE_DESC: Record<PartnerStage, string> = {
  identified: 'Potential partner recorded — no due diligence started yet.',
  due_diligence: 'Scoping, vetting, capacity analysis and risk review in progress.',
  approved: 'Due diligence concluded with an approval decision — ready to agree terms.',
  agreement: 'MoU / sub-award / teaming agreement being negotiated and signed.',
  active: 'Agreement signed — partnership implementing.',
  closed: 'Partnership ended — kept for the record and history.',
  declined: 'Due diligence concluded that RHS should not partner.',
}
export const PARTNER_STAGE_TONE: Record<PartnerStage, string> = {
  identified: 'bg-ink-100 text-ink-700', due_diligence: 'bg-sun-100 text-sun-700', approved: 'bg-brand-100 text-brand-800', agreement: 'bg-info-50 text-info-700',
  active: 'bg-brand-600 text-white', closed: 'bg-ink-200 text-ink-600', declined: 'bg-danger-50 text-danger-700',
}
export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  local_ngo: 'National / local NGO', ingo: 'International NGO', cbo: 'Community-based organisation', government: 'Government counterpart', academic: 'Academic / research', private: 'Private sector', un: 'UN agency', other: 'Other',
}
export const AGREEMENT_LABEL = { mou: 'Memorandum of Understanding', subaward: 'Sub-award agreement', teaming: 'Teaming / consortium agreement', service: 'Service agreement', other: 'Other' } as const

/** Next stage in the normal flow (declined is reached from a decision, not from here). */
export const nextPartnerStage = (s: PartnerStage): PartnerStage | null =>
  ({ identified: 'due_diligence', due_diligence: 'approved', approved: 'agreement', agreement: 'active', active: 'closed', closed: null, declined: null } as Record<PartnerStage, PartnerStage | null>)[s]

// ---- scaffolding -----------------------------------------------------------
export const emptyKeyPerson = (): KeyPerson => ({ id: uid('kp_'), name: '', title: '', countryOfBirth: '', dob: '', gender: '', idNumber: '', verification: '', atcClear: '', atcIssues: '' })
export const emptyVetting = (): Vetting => ({
  staffResponsible: '', level: 'full', keyPersonnel: [],
  atc: { org: { done: '', checkedBy: '', date: '', issues: '' }, staff: { done: '', checkedBy: '', date: '', issues: '' } },
  online: DD_PLATFORMS.map((platform) => ({ platform, url: '', checkedBy: '', date: '', issues: '' })),
  audit: { done: '', checkedBy: '', firm: '', date: '', issues: '' },
  analysis: DD_VETTING_QUESTIONS.map((q) => ({ key: q.key, answer: '', basis: '', issues: '', risks: '' })),
})
export const emptyDueDiligence = (): DueDiligence => ({
  scoping: { newOrExisting: 'new', completionDate: '', partnerSectors: '', anticipatedSectors: '', partnerReach: '', anticipatedScope: '', rhsFocalPoints: '', anticipatedDonors: '', anticipatedValue: '', checklist: Object.fromEntries(DD_CHECKLIST.map((c) => [c.key, ''])), notes: '' },
  vetting: emptyVetting(),
  pca: { answers: {}, visitDate: '', assessors: '' },
  risks: [],
  decision: { outcome: '', conditions: '' },
  attachments: [],
})
export const emptyRisk = (group: PartnerRisk['group']): PartnerRisk => ({ id: uid('rk_'), group, description: '', likelihood: null, impact: null, mitigation: '', owner: '' })

// ---- risk ------------------------------------------------------------------
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Very High'
export const riskLevel = (likelihood: number | null, impact: number | null): RiskLevel | null =>
  likelihood === null || impact === null ? null : RISK_MATRIX[`${likelihood}${impact}`] ?? null
export const RISK_TONE: Record<RiskLevel, string> = { Low: 'bg-brand-100 text-brand-800', Medium: 'bg-sun-100 text-sun-700', High: 'bg-accent-100 text-accent-700', 'Very High': 'bg-accent-600 text-white' }
export const RISK_GROUP = Object.fromEntries(DD_RISK_GROUPS.map((g) => [g.key, g])) as Record<PartnerRisk['group'], (typeof DD_RISK_GROUPS)[number]>

// ---- capacity (PCA) scoring ----------------------------------------------
export interface PcaSectionScore { key: PcaKey; label: string; answered: number; total: number; na: number; score: number | null; level: 'High' | 'Medium' | 'Emerging' | null }
/** Section score = average of scored items (3 / 2 / 1; N/A excluded), as in the workbook's "Capacity" row. */
export const pcaSectionScores = (dd: DueDiligence): PcaSectionScore[] =>
  PCA_SECTIONS.map((s) => {
    const scores = s.items.map((i) => dd.pca.answers[i.key]?.score).filter((x): x is PcaScore => x !== undefined)
    const na = scores.filter((x) => x === 'na').length
    const nums = scores.filter((x): x is 1 | 2 | 3 => typeof x === 'number')
    const score = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null
    return { key: s.key, label: PCA_CATEGORY_LABELS[s.key], answered: scores.length, total: s.items.length, na, score, level: score === null ? null : score >= 2.5 ? 'High' : score >= 1.75 ? 'Medium' : 'Emerging' }
  })
/** Overall = ROUND(AVERAGE(category scores),1) × 33.34 % — the workbook's "Overall score" cell. */
export const pcaOverall = (dd: DueDiligence): number | null => {
  const s = pcaSectionScores(dd).map((x) => x.score).filter((x): x is number => x !== null)
  if (!s.length) return null
  return Math.round((Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10) * 33.34)
}
export const PCA_LEVEL_TONE = { High: 'bg-brand-100 text-brand-800', Medium: 'bg-sun-100 text-sun-700', Emerging: 'bg-accent-100 text-accent-700' } as const

// ---- progress --------------------------------------------------------------
export interface DdProgress { scoping: number; vetting: number; pca: number; risks: number; decision: number; overall: number; partnerPending: boolean }
export const ddProgress = (dd: DueDiligence): DdProgress => {
  const sc = dd.scoping
  const scFields = [sc.completionDate, sc.partnerSectors, sc.anticipatedSectors, sc.partnerReach, sc.anticipatedScope, sc.rhsFocalPoints, sc.anticipatedDonors, sc.anticipatedValue]
  const scDone = scFields.filter(Boolean).length + Object.values(sc.checklist).filter(Boolean).length
  const scoping = Math.round((scDone / (scFields.length + DD_CHECKLIST.length)) * 100)
  const v = dd.vetting
  const vParts = [
    !!v.staffResponsible, v.keyPersonnel.length > 0, !!v.atc.org.done, !!v.atc.staff.done, v.online.some((o) => o.checkedBy || o.issues), !!v.audit.done,
    ...v.analysis.map((a) => !!a.answer),
  ]
  const vetting = v.completedAt ? 100 : Math.round((vParts.filter(Boolean).length / vParts.length) * 100)
  const secs = pcaSectionScores(dd)
  const pca = Math.round((secs.reduce((s, x) => s + x.answered, 0) / secs.reduce((s, x) => s + x.total, 0)) * 100)
  const risks = dd.risks.length === 0 ? 0 : Math.round((dd.risks.filter((r) => r.description && r.likelihood !== null && r.impact !== null).length / dd.risks.length) * 100)
  const decision = dd.decision.outcome ? 100 : 0
  const overall = Math.round((scoping + vetting + pca + risks + decision) / 5)
  return { scoping, vetting, pca, risks, decision, overall, partnerPending: v.share?.status === 'open' }
}

export const partnerProjects = (p: Partner, projects: Project[]) => projects.filter((x) => x.partnerIds?.includes(p.id))

/** Public link the partner opens to fill the vetting form — no sign-in required. */
export const vettingLink = (token: string) => `${location.origin}${location.pathname}#/partner-vetting/${token}`

// ---- workbook export -------------------------------------------------------
const YN = (v: string) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'na' ? 'N/A' : '')
export function exportDueDiligence(p: Partner) {
  const dd = p.dueDiligence
  const wb = XLSX.utils.book_new()
  const sc = dd.scoping
  const scoping: (string | number)[][] = [
    ['', 'Partnership Due Diligence Workbook', 'Restoring Hope Society — generated by the PCM & Grants Management Platform · Document owner: ' + p.ownerName],
    ['', 'Partnership overview', 'Note: this relates to the overall partnership rather than a specific partnership project'],
    ['', 'Organization name', p.name + (p.acronym ? ` (${p.acronym})` : '')],
    ['', 'Organization focal point & contact', [p.focalName, p.focalTitle, p.focalPhone, p.focalEmail].filter(Boolean).join(' · ')],
    ['', 'Address', [p.address, p.website].filter(Boolean).join(' · ')],
    ['', 'New partner or existing partner', sc.newOrExisting === 'new' ? 'New' : 'Existing'],
    ['', 'Due diligence completion date', sc.completionDate],
    ['', "Partner's Sector(s) of Implementation", sc.partnerSectors],
    ['', 'Anticipated Sectors for Partnership with RHS', sc.anticipatedSectors],
    ['', "Partner's geographic reach", sc.partnerReach],
    ['', 'Anticipated geographic scope of partnership', sc.anticipatedScope],
    ['', 'RHS partnership focal points (technical and partnership leads)', sc.rhsFocalPoints],
    ['', 'Anticipated donors for partnership (if known)', sc.anticipatedDonors],
    ['', 'Anticipated value of largest partnership agreement (approx.)', sc.anticipatedValue],
    ['', 'Due diligence preparation document review checklist', ''],
    ...DD_CHECKLIST.map((c) => ['', c.label, YN(sc.checklist[c.key] ?? '')]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scoping), 'Scoping')

  const v = dd.vetting
  const vet: (string | number)[][] = [
    ['VETTING'],
    ['RHS staff responsible for vetting (Name & Title)', v.staffResponsible],
    ['Vetting level', v.level === 'full' ? 'Full' : 'Basic'],
    ['Key personnel: Includes CEO/President, Relevant Technical/Program Directors, Financial Controllers/Finance Directors'],
    ['First Name and Last Name', 'Title', 'Country of Birth', 'Date of Birth', 'Gender', 'Verification Method', 'ATC result', 'Issues'],
    ...v.keyPersonnel.map((k) => [k.name, k.title, k.countryOfBirth, k.dob, k.gender, k.verification ?? '', k.atcClear ?? '', k.atcIssues ?? '']),
    [],
    ['ATC Clearance Done', 'Yes/No', 'Checked By', 'Date of Checking', 'Issues, if any'],
    [`Organisation Name (${p.name})`, YN(v.atc.org.done), v.atc.org.checkedBy, v.atc.org.date, v.atc.org.issues],
    ['Organisation Staff', YN(v.atc.staff.done), v.atc.staff.checkedBy, v.atc.staff.date, v.atc.staff.issues],
    [],
    ['Social media and internet presence', 'URL', 'Checked By', 'Date of Checking', 'Issues, if any'],
    ...v.online.map((o) => [o.platform, o.url, o.checkedBy, o.date, o.issues]),
    [],
    ['Audit review (for full vetting, where relevant)', 'Checked By', 'Name of Firm', 'Date of Checking', 'Issues, if any'],
    [YN(v.audit.done), v.audit.checkedBy, v.audit.firm, v.audit.date, v.audit.issues],
    [],
    ['Vetting Analysis', 'Answer', 'Basis for answer', 'Issues, if any', 'Risks, if any'],
    ...DD_VETTING_QUESTIONS.map((q) => { const a = v.analysis.find((x) => x.key === q.key); return [`${q.topic}: ${q.question}`, YN(a?.answer ?? ''), a?.basis ?? '', a?.issues ?? '', a?.risks ?? ''] }),
  ]
  if (v.submission) {
    const s = v.submission
    vet.push([], ['PARTNER SUBMISSION (self-declaration submitted online)'], ['Submitted by', `${s.byName} · ${s.byTitle} · ${s.byEmail}`, 'Submitted at', s.submittedAt, 'Signature', s.signature],
      ['Legal name', s.legalName, 'Registration no.', s.registrationNo, 'Country', s.registrationCountry, 'Legal form', s.legalForm],
      ['Last external audit', s.auditFirm, 'Year', s.auditYear, 'Material issues', s.auditIssues],
      ['Declaration', 'Answer', 'Explanation'],
      ...DD_VETTING_QUESTIONS.map((q) => { const d = s.declarations.find((x) => x.key === q.key); return [`${q.topic}: ${q.question}`, YN(d?.answer ?? ''), d?.explanation ?? ''] }),
      ['Notes', s.notes])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vet), 'Vetting')

  const secs = pcaSectionScores(dd)
  const risk: (string | number)[][] = [
    ['PCA OUTCOMES AND ISSUES IDENTIFIED'],
    ['Category', 'Full PCA scores', 'Any significant issues identified'],
    ...secs.map((s) => [s.label, s.score ?? 'N/A', s.level ?? '']),
    ['Overall score', pcaOverall(dd) !== null ? `${pcaOverall(dd)}%` : 'N/A', "NOTE: This score is not an assessment of the organization. It is an assessment of the risk associated with the organization's implementation of the proposed award."],
    [],
    ['PARTNERSHIP COLLABORATIVE RISK MANAGEMENT TABLE'],
    ['Risk type', 'Description', 'Likelihood (0 Low - 5 Very High)', 'Impact (0 Low - 5 Very High)', 'Risk Level', 'Mitigation', 'Owner'],
  ]
  for (const g of DD_RISK_GROUPS) {
    risk.push([g.title.toUpperCase(), g.desc])
    dd.risks.filter((r) => r.group === g.key).forEach((r, i) => risk.push([`${i + 1}.`, r.description, r.likelihood ?? '', r.impact ?? '', riskLevel(r.likelihood, r.impact) ?? 'No Data', r.mitigation, r.owner]))
  }
  risk.push([], ['DECISION', dd.decision.outcome === 'approved' ? 'Approved' : dd.decision.outcome === 'approved_conditions' ? 'Approved with conditions' : dd.decision.outcome === 'declined' ? 'Declined' : 'Pending', dd.decision.conditions, dd.decision.decidedByName ?? '', dd.decision.decidedAt ?? ''])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(risk), 'Risk Analysis')

  for (const s of PCA_SECTIONS) {
    const rows: (string | number)[][] = [
      [s.title.toUpperCase(), s.materials],
      ['Area', 'High (3)', 'Medium (2)', 'Emerging (1)', 'Answer (High = 3, Medium = 2, Emerging = 1, N/A = never applicable)', 'Notes', 'Action Points / Documents to View'],
      ...s.items.map((i) => { const a = dd.pca.answers[i.key]; return [i.area, i.high, i.medium, i.emerging, a?.score === 'na' ? 'N/A' : a?.score ?? '', a?.notes ?? '', a?.actions ?? ''] }),
      [],
      ['Capacity', secs.find((x) => x.key === s.key)?.score ?? 'N/A'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Full - ${PCA_CATEGORY_LABELS[s.key]}`.slice(0, 31))
  }
  XLSX.writeFile(wb, `${p.code}_Due_Diligence_${p.acronym || p.name.replace(/\W+/g, '_')}.xlsx`)
}

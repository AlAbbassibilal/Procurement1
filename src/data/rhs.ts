// ---------------------------------------------------------------------------
// RHS setup — the real starting point of the platform (every clean start):
// Bilal's colleagues with their RHS.jo accounts and staff records, the Humanity
// donor and the "In Hands That Heal" project (proposal, budget, logframe, work
// plan, spending plan, reporting calendar) prepared for testing.
// ---------------------------------------------------------------------------
import type { User, StaffMember, Donor, Project, ProjectBudget, BudgetLine, LogframeRow, WorkplanActivity } from '@/types'
import { generateReportingCalendar, generateSpendingPlan, monthsOf } from '@/lib/grants'
import { CORE_USER, DOC_OWNER } from './seed'
import PROPOSAL from './humanity-proposal.json'
import BUDGET_LINES from './humanity-budget.json'

const T0 = '2026-10-12T08:00:00Z'
const U = (id: string, name: string, email: string, role: User['role'], department: string, title: string, color: string, extra: Partial<User> = {}): User =>
  ({ id, name, email, password: 'rhs2025', mustChangePassword: true, invitedAt: T0, role, department, title, avatarColor: color, active: true, ...extra })

/** Colleagues — email = first letter of the first name + family name @rhs.jo; temporary password rhs2025, replaced at first sign-in. */
export const RHS_USERS: User[] = [
  U('u_shomsi', 'Shatha Homsi', 'shomsi@rhs.jo', 'finance_director', 'Finance', 'Finance Director', 'bg-sun-700'),
  U('u_malissa', 'Mohammad Alissa', 'malissa@rhs.jo', 'procurement_officer', 'Supply Chain', 'Supply Chain Senior Officer', 'bg-brand-800'),
  U('u_dmohammad', "Dua'a Mohammad", 'dmohammad@rhs.jo', 'requester', 'Programs', 'Grants and Partnership Senior Officer', 'bg-accent-600',
    { access: { grants: 'manage', partnerships: 'manage', procurement: 'edit', finance: 'view' }, permissions: { 'grants.project.create': true, 'grants.project.edit': true, 'grants.project.stage': true, 'grants.donors.edit': true, 'grants.budget.edit': true, 'partners.edit': true, 'partners.manage': true } }),
  U('u_aduwakiat', 'Alaa Duwakiat', 'aduwakiat@rhs.jo', 'dept_manager', 'Communication & Advocacy', 'Communication and Advocacy Team Leader', 'bg-info-700', { access: { grants: 'view', procurement: 'edit', hr: 'view', media: 'manage' } }),
  U('u_mrawahneh', 'Majd Rawahneh', 'mrawahneh@rhs.jo', 'hr', 'HR & Admin', 'HR and Admin Officer', 'bg-info-500'),
  U('u_tsharaan', 'Tala Sharaan', 'tsharaan@rhs.jo', 'requester', 'Communication & Advocacy', 'Content Creator', 'bg-brand-500', { access: { grants: 'view', procurement: 'edit', media: 'edit' } }),
  U('u_mrimawi', 'Mohammad Rimawi', 'mrimawi@rhs.jo', 'dept_manager', 'Digital Innovation Hub', 'Lead Programmer', 'bg-ink-700'),
  U('u_rmohammad', 'Refaa Mohammad', 'rmohammad@rhs.jo', 'dept_manager', 'Technical Unit', 'Technical Unit Manager', 'bg-ink-900'),
]

const S = (n: number, userId: string, name: string, position: string, department: string, monthlySalary: number, extra: Partial<StaffMember> = {}): StaffMember => ({
  id: `stf_${n}`, rhsNumber: `RHS-${String(n).padStart(4, '0')}`, name, position, department, country: 'Amman (Regional Office)', contractType: 'full_time', monthlySalary, currency: 'USD', startDate: '2025-01-01', status: 'active', userId, lineManagerId: 'stf_2', createdAt: T0, updatedAt: T0, ...extra,
})
/** Executive Director position, held in an acting capacity by Bilal (no separate account — Bilal signs in as Director of Programs). */
export const RHS_ED: StaffMember = { id: 'stf_1', rhsNumber: 'RHS-0001', name: '', position: 'Executive Director', department: 'Executive Office', country: 'Amman (Regional Office)', contractType: 'full_time', monthlySalary: 0, currency: 'USD', startDate: '2025-01-01', status: 'active', acting: true, actingStaffId: 'stf_2', budgetHolder: true, createdAt: T0, updatedAt: T0 }
const V = (n: number, position: string, department: string, lineManagerId: string, country = 'Amman (Regional Office)', name = '', extra: Partial<StaffMember> = {}): StaffMember => ({ id: `stf_${n}`, rhsNumber: `RHS-${String(n).padStart(4, '0')}`, name, position, department, country, contractType: 'full_time', monthlySalary: 0, currency: 'USD', startDate: '2026-10-01', status: name ? 'active' : 'planned', lineManagerId, createdAt: T0, updatedAt: T0, ...extra })
/** Positions from the RHS organogram deck: colleagues without platform accounts and the Gaza country office.
 *  Teams still to be recruited (6 rehabilitation assistants, 6 MHPSS assistants) are planned under their officers, not staff records. */
export const RHS_POSITIONS: StaffMember[] = [
  V(11, 'MEAL Officer', 'Programs', 'stf_2', 'Amman (Regional Office)', 'Ahmad Gharaibeh'),
  V(12, 'Program Manager (Overall Operations Manager)', 'Gaza Country Office', 'stf_2', 'Gaza', 'Rami Basheer'),
  V(13, 'Logistic Officer', 'Gaza Country Office', 'stf_3', 'Gaza', 'Yehya Abo Qara'),
  V(14, 'Videographer', 'Gaza Country Office', 'stf_12', 'Gaza', 'AbdAlrahman Albaba'),
  V(15, 'Rehabilitation Officer', 'Mobile & Rehabilitation Centre Team', 'stf_12', 'Gaza', '', { plannedTeam: [{ position: 'Rehabilitation Assistant', count: 6 }] }),
  V(16, 'MHPSS Officer', 'Mobile & Rehabilitation Centre Team', 'stf_12', 'Gaza', 'Rafat Alsalem', { plannedTeam: [{ position: 'MHPSS Assistant', count: 6 }] }),
]
/** Ids of earlier seeded records superseded by the list above (old ids / vacancies) — cleaned up on upgrade when still unnamed. */
export const RHS_DROPPED_POSITIONS = ['stf_12', 'stf_13', 'stf_14', 'stf_15', 'stf_16', 'stf_22', 'stf_24', 'stf_27', 'stf_28', 'stf_29', 'stf_30', 'stf_31', 'stf_32', 'stf_33', 'stf_34', 'stf_35', 'stf_36', 'stf_37', 'stf_38', 'stf_39', 'stf_40', 'stf_41', 'stf_42', 'stf_43', 'stf_44', 'stf_45']
/** Old id → new record, for upgrading the earlier seed (Gaza office used ids 20/21/23/25/26). */
export const RHS_RENUMBER: Record<string, string> = { stf_20: 'stf_12', stf_21: 'stf_13', stf_23: 'stf_14', stf_25: 'stf_15', stf_26: 'stf_16' }
/** Staff records (org chart): everyone reports to Bilal except Tala, who reports to Alaa. Salaries from the budget narrative (USD/month). */
export const RHS_STAFF: StaffMember[] = [
  S(3, 'u_shomsi', 'Shatha Homsi', 'Finance Director', 'Finance', 4935, { budgetHolder: true, approvalLimitUSD: 25000 }),
  S(4, 'u_malissa', 'Mohammad Alissa', 'Supply Chain Senior Officer', 'Supply Chain', 1200),
  S(5, 'u_dmohammad', "Dua'a Mohammad", 'Grants and Partnership Senior Officer', 'Programs', 2115),
  S(6, 'u_aduwakiat', 'Alaa Duwakiat', 'Communication and Advocacy Team Leader', 'Communication & Advocacy', 1762.5, { budgetHolder: true, approvalLimitUSD: 2500 }),
  S(7, 'u_mrawahneh', 'Majd Rawahneh', 'HR and Admin Officer', 'HR & Admin', 1269),
  S(8, 'u_tsharaan', 'Tala Sharaan', 'Content Creator', 'Communication & Advocacy', 1000, { lineManagerId: 'stf_6' }),
  S(9, 'u_mrimawi', 'Mohammad Rimawi', 'Lead Programmer', 'Digital Innovation Hub', 2200, { budgetHolder: true, approvalLimitUSD: 2500 }),
  S(10, 'u_rmohammad', 'Refaa Mohammad', 'Technical Unit Manager', 'Technical Unit', 3000, { budgetHolder: true, approvalLimitUSD: 2500 }),
]

export const HUMANITY_DONOR: Donor = { id: 'don_humanity', name: 'Humanity', type: 'foundation', country: '', focus: 'Rehabilitation, prosthetics and integrated care for persons with disabilities in Gaza', contacts: [], notes: 'Grant for "In Hands That Heal" — 1 October 2026 to 30 September 2027.', createdAt: T0 }

export const HUMANITY_CODE = 'RHS-2026-HUM-001'
const START = '2026-10-01', END = '2027-09-30'
const months = monthsOf(START, END)

export const HUMANITY_BUDGET: ProjectBudget = {
  id: 'bud_humanity', donorCode: HUMANITY_CODE, name: 'In Hands That Heal — Integrated Rehabilitation and Prosthetic Services for Persons with Disabilities in Gaza', donor: 'Humanity', currency: 'USD',
  startDate: START, endDate: END, duration: '12 Months', locations: 'Gaza (field implementation) & Amman (technical and administrative support)', status: 'draft',
  lines: BUDGET_LINES as BudgetLine[], sourceSheet: 'Direct Cost + Admin Cost', uploadedBy: 'u_bilal', uploadedByName: 'Bilal Abbassi', uploadedAt: T0, ownerName: DOC_OWNER,
  notes: 'Imported from RHS_Project_Budget_Template_300_Cases_draft.xlsx. Personnel unit costs taken from the Budget Narrative sheet (the draft left them at 0). The template basis is 18 months; the grant period entered is 12 months — review frequencies before submission.',
}

const ind = (code: string, type: 'outcome' | 'output', text: string, target: number, unit = '#', mov = 'Kobo Toolbox case records') => ({ id: 'ind_hum_' + code.replace(/\W/g, ''), code, type, text, baseline: 0, target, unit, mov, definition: '', calculation: '', disaggregation: 'Sex, age, disability type', responsible: 'MEAL Officer', method: 'Kobo Toolbox / digital monitoring platform', frequency: 'Monthly' })
const lf = (level: LogframeRow['level'], code: string, narrative: string, indicators: ReturnType<typeof ind>[], assumptions?: string): LogframeRow => ({ id: 'lf_hum_' + code.replace(/\W/g, ''), level, code, narrative, indicators, mov: indicators.map((i) => i.mov).filter(Boolean).join('; '), assumptions })

export const HUMANITY_LOGFRAME: LogframeRow[] = [
  lf('goal', 'Goal', 'To restore function, dignity, and independence to conflict-affected persons with disabilities in Gaza, with a special focus on amputees, alongside traumatic brain injury and spinal cord injury cases, through an integrated rehabilitation and prosthetic care programme.', []),
  lf('outcome', 'Outcome 1', 'An integrated rehabilitation service network (fixed rehabilitation points, mobile teams and a central prosthetics centre) provides equitable access across Gaza.', [ind('1.1', 'outcome', '# of fixed rehabilitation points operational', 3), ind('1.2', 'outcome', '# of multidisciplinary mobile teams deployed', 6), ind('1.3', 'outcome', 'Central prosthetics centre equipped and operational (yes/no)', 1)], 'Access and security conditions allow field operations; facilities remain available.'),
  lf('output', 'Output 1.1', 'Fixed rehabilitation points and the central prosthetics centre furnished, equipped and staffed.', [ind('1.1.1', 'output', '# of workshop machinery and fabrication equipment sets installed', 1, '#', 'Asset registry, delivery notes'), ind('1.1.2', 'output', '# of field staff recruited and onboarded', 13, '#', 'HR contracts')]),
  lf('outcome', 'Outcome 2', 'All beneficiaries are identified, assessed and case-managed through a structured data collection and case-management workflow with an individual care plan.', [ind('2.1', 'outcome', '% of beneficiaries registered through KOBO data collection', 100, '%'), ind('2.2', 'outcome', '% of beneficiaries with a multidisciplinary assessment and an individualised care plan', 100, '%')]),
  lf('output', 'Output 2.1', '300 persons with disabilities identified, registered and assessed.', [ind('2.1.1', 'output', '# of beneficiaries registered', 300), ind('2.1.2', 'output', '# of individual service plans produced', 300)]),
  lf('outcome', 'Outcome 3', 'Amputees receive high-quality prosthetic devices fitted, aligned and followed up by qualified professionals at the central prosthetics centre.', [ind('3.1', 'outcome', '% of fitted beneficiaries reporting improved mobility (PLUS-M)', 80, '%', 'PLUS-M survey at fitting and 6 months'), ind('3.2', 'outcome', '% device retention at 6 months', 85, '%', 'Follow-up visits'), ind('3.3', 'outcome', '% completing structured gait training and post-fitting follow-up', 100, '%')], 'Prosthetic components and fabrication materials enter Gaza through the agreed shipment pipeline.'),
  lf('output', 'Output 3.1', 'Prosthetic devices fabricated, fitted and delivered with gait training.', [ind('3.1.1', 'output', '# of prosthetic devices fitted', 300, '#', 'Fitting records'), ind('3.1.2', 'output', '# of gait-training courses completed', 300)]),
  lf('output', 'Output 3.2', 'Sixteen P&O technicians trained and certified (two cohorts of eight).', [ind('3.2.1', 'output', '# of trainees enrolled in the certification course', 16, '#', 'University enrolment records'), ind('3.2.2', 'output', '# of trainees certified', 16, '#', 'Certificates')]),
  lf('outcome', 'Outcome 4', 'Every beneficiary receives the full integrated care package: physical rehabilitation, MHPSS including caregiver support, surgical referral where needed, nutritional assessment and support, transport.', [ind('4.1', 'outcome', '% enrolled in the integrated care pathway', 100, '%'), ind('4.2', 'outcome', '% completing the minimum physiotherapy and MHPSS sessions', 80, '%'), ind('4.3', 'outcome', '% receiving a nutritional assessment', 100, '%')]),
  lf('output', 'Output 4.1', 'Rehabilitation, MHPSS, caregiver care-education, nutrition and transport services delivered.', [ind('4.1.1', 'output', '# of physiotherapy sessions delivered', 3600, '#', 'Session attendance records'), ind('4.1.2', 'output', '# of MHPSS sessions delivered (individual and group)', 2400), ind('4.1.3', 'output', '# of caregivers attending care-education sessions', 300), ind('4.1.4', 'output', '# of households receiving nutritional support / food vouchers', 300, '#', 'Voucher distribution records')]),
  lf('outcome', 'Outcome 5', '20% of beneficiaries are supported with livelihood activities informed by a rapid market assessment.', [ind('5.1', 'outcome', '% of beneficiaries launching livelihood projects', 20, '%'), ind('5.2', 'outcome', '% of supported projects active at 6-month follow-up', 70, '%', 'Follow-up survey')]),
  lf('output', 'Output 5.1', 'Rapid market assessment completed and livelihood grants delivered.', [ind('5.1.1', 'output', 'Rapid market assessment completed (yes/no)', 1), ind('5.1.2', 'output', '# of livelihood projects launched', 60)]),
  lf('outcome', 'Outcome 6', 'School-aged beneficiaries are reintegrated into education in coordination with Save the Children International and NRC.', [ind('6.1', 'outcome', '% of eligible children registered at educational points', 100, '%', 'Partner registration records')]),
  lf('output', 'Output 6.1', 'Rehabilitation and MHPSS points established in partner temporary learning spaces; teachers trained.', [ind('6.1.1', 'output', '# of partner learning spaces with rehabilitation / MHPSS points', 4), ind('6.1.2', 'output', '# of teachers trained on inclusion of children with disabilities', 40, '#', 'Training attendance sheets')]),
]

let wpN = 0
const wp = (section: string, title: string, budgetLine: string, from: number, to: number, description = ''): WorkplanActivity => {
  const ms = months.slice(from - 1, to)
  return { id: `wp_hum_${String(++wpN).padStart(2, '0')}`, section, title, description, budgetLine, status: 'planned', progress: 0, weeks: Object.fromEntries(ms.flatMap((m) => [1, 2, 3, 4].map((w) => [`${m}-W${w}`, 'P' as const]))) }
}
/** Work plan — phases from the proposal (mobilisation months 1-2, core delivery months 3-12), by activity stream. */
export const HUMANITY_WORKPLAN: WorkplanActivity[] = [
  wp('PHASE 1 — MOBILISATION (Months 1-2)', 'Recruit and onboard the Gaza field team (13 staff)', 'D-01', 1, 2, 'Project manager, programme officers, mobile team members, MEAL, visibility, support staff.'),
  wp('PHASE 1 — MOBILISATION (Months 1-2)', 'Procure and ship prosthetic components and fabrication materials', 'D-16', 1, 3, 'Framework agreements with Jordanian suppliers; shipment through the agreed pipeline (WHO / WFP / JHCO).'),
  wp('PHASE 1 — MOBILISATION (Months 1-2)', 'Install workshop machinery and furnish the rehabilitation / MHPSS zone', 'D-19', 1, 2),
  wp('PHASE 1 — MOBILISATION (Months 1-2)', 'Set up KOBO data collection and the digital monitoring platform', 'B-02', 1, 2),
  wp('PHASE 1 — MOBILISATION (Months 1-2)', 'Open fixed rehabilitation points and deploy mobile teams', 'D-04', 2, 2),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Beneficiary identification, registration and multidisciplinary assessment (300 cases)', 'D-06', 2, 10),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Home visits and pre-fitting services', 'D-04', 3, 11),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Prosthetic fabrication, fitting and gait training at the central centre', 'D-16', 3, 12),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Physical rehabilitation and MHPSS sessions (fixed points and mobile teams)', 'D-05', 3, 12),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Caregiver care-education and MHPSS support', 'D-05', 3, 12),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Nutritional assessment and food vouchers (300 households)', 'D-17', 3, 12),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Patient transport and accompaniment', 'D-18', 2, 12),
  wp('PHASE 2 — CORE DELIVERY (Months 3-12)', 'Surgical referrals to the partner hospital', 'D-18', 3, 12),
  wp('CAPACITY BUILDING', 'P&O certification course — cohort 1 (8 trainees)', 'D-14a', 1, 12),
  wp('CAPACITY BUILDING', 'P&O certification course — cohort 2 (8 trainees)', 'D-14b', 6, 12),
  wp('CAPACITY BUILDING', 'Expatriate specialist trainers on site', 'D-15', 3, 5),
  wp('INCLUSIVITY', 'Rapid market assessment', 'D-21', 3, 4),
  wp('INCLUSIVITY', 'Livelihood projects for 20% of beneficiaries (60)', 'D-21', 5, 12),
  wp('INCLUSIVITY', 'Education reintegration with Save the Children International and NRC', 'D-05', 4, 12),
  wp('MEAL & REPORTING', 'Field data quality monitoring and patient outcome measurement (PLUS-M, SIGAM)', 'D-06', 2, 12),
  wp('MEAL & REPORTING', 'Mid-term internal evaluation (Month 9)', 'D-06', 9, 9),
  wp('MEAL & REPORTING', 'Quarterly narrative and financial reports to Humanity', 'A-08', 3, 12),
  wp('COMMUNICATION & VISIBILITY', 'Patient journey documentation and visibility materials', 'D-21', 2, 12),
]

export const HUMANITY_PROJECT: Project = {
  id: 'prj_humanity', code: HUMANITY_CODE, title: 'In Hands That Heal: Integrated Rehabilitation and Prosthetic Services for Persons with Disabilities in Gaza',
  summary: 'Integrated rehabilitation and prosthetic care for 300 persons with disabilities in Gaza — fixed rehabilitation points, six mobile teams and a central prosthetics centre delivering prosthetic fitting, physiotherapy, MHPSS, nutrition, surgical referral, transport, livelihood support and education reintegration, plus certification of 16 P&O technicians.',
  donorId: HUMANITY_DONOR.id, donorName: 'Humanity', stage: 'development', currency: 'USD', startDate: START, endDate: END, duration: '12 Months',
  locations: 'Gaza (field implementation) & Amman (technical and administrative support)', countries: ['Gaza', 'Amman (Regional Office)'], sectors: ['Prosthetics & Orthotics', 'Physical rehabilitation', 'MHPSS', 'Nutrition', 'Livelihoods', 'Education'],
  managerId: 'u_bilal', managerName: 'Bilal Abbassi', teamIds: RHS_USERS.map((u) => u.id), partnerIds: [], requestedAmount: Math.round(HUMANITY_BUDGET.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, budgetId: HUMANITY_BUDGET.id,
  proposal: { sections: (PROPOSAL as { title: string; content: string }[]).map((s, i) => ({ id: `ps_hum_${i + 1}`, title: s.title, content: s.content })), attachments: [], submittedTo: 'Humanity', version: 'Draft B.A' },
  logframe: HUMANITY_LOGFRAME, workplan: HUMANITY_WORKPLAN, spendingPlan: generateSpendingPlan(HUMANITY_BUDGET.lines, months), iptt: [],
  reports: generateReportingCalendar({ startDate: START, endDate: END } as Project), comments: [],
  stageHistory: [{ stage: 'development', at: T0, byName: 'Bilal Abbassi' }], createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: T0, updatedAt: T0, ownerName: DOC_OWNER,
}
export const RHS_ALL_USERS: User[] = [CORE_USER, ...RHS_USERS]

import type { ApprovalRule, Contract, OrgSettings, PurchaseOrder, PurchaseRequisition, User, Vendor, ContractClause, GoodsReceipt, Invoice, ProcurementTier, ProjectBudget, Donor, Project, Task, MasterBudget, Partner, StaffMember, LeaveRequest, Timesheet, Payslip, AttendanceRecord } from '@/types'
import { generateReportingCalendar, generateSpendingPlan, monthsOf } from '@/lib/grants'
import { emptySourcing } from '@/lib/tiers'
import { emptyDueDiligence } from '@/lib/partners'
import { addDays, toInputDate } from '@/lib/format'

export const DOC_OWNER = 'Bilal Abbassi'

export const SEED_SETTINGS: OrgSettings = {
  orgName: 'Restoring Hope Society',
  orgShort: 'RHS',
  tagline: 'A Jordanian Society to Support Amputees',
  address: 'Amman, Jordan',
  email: 'info@RHS.JO',
  phone: '+962 7 9998 8979',
  website: 'www.restoringhopejo.org',
  defaultCurrency: 'JOD',
  taxRate: 16,
  fxToUSD: { JOD: 1.41, USD: 1, EUR: 1.08 },
  tiers: [] as ProcurementTier[],   // filled below (SEED_TIERS)
  contractThresholdUSD: 2500,
  legalReviewThresholdUSD: 10000,
  soleSourceEdThresholdUSD: 2500,
  dualAuthThresholdUSD: 10000,
  countries: ['Amman (Regional Office)', 'Gaza', 'West Bank', 'Lebanon', 'Syria', 'Sudan', 'Egypt'],
  templates: {
    budget: { id: 'tpl_budget', name: 'RHS_Project_Budget_Template.xlsx', size: 39782, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedBy: 'Bilal Abbassi', uploadedAt: '2026-10-04T09:00:00Z', dataUrl: '/templates/RHS_Project_Budget_Template.xlsx' },
    bva: { id: 'tpl_bva', name: 'Annex1_Project_Budget_BvA_Template.xlsx', size: 61299, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedBy: 'Bilal Abbassi', uploadedAt: '2026-10-04T09:00:00Z', dataUrl: '/templates/RHS_BvA_Template_Annex1.xlsx' },
  },
  priceTolerancePct: 2,
  paymentTermsDays: 30,
  fiscalYearStart: '01-01',
  hr: { annualLeaveDays: 14, wfhDays: 14, weekend: [5, 6], socialSecurityPct: 7.5, incomeTaxPct: 0, checkInStart: '08:00', checkInEnd: '10:00' },
}

/** Procurement SOPs §3 — thresholds apply to the total value of a single transaction and must not be split. */
export const SEED_TIERS: ProcurementTier[] = [
  { id: 't0', name: 'Petty cash / Direct purchase', minUSD: 0, maxUSD: 500, method: 'direct', minQuotations: 0, invitedSuppliersMin: 0, deadlineWorkingDays: 0, committeeMin: 0, donorApproval: false,
    approvers: [{ role: 'dept_manager', label: 'Department Head' }] },
  { id: 't1', name: 'Tier 1 — Small purchase', minUSD: 500.01, maxUSD: 2500, method: 'rfq', minQuotations: 3, invitedSuppliersMin: 3, deadlineWorkingDays: 0, committeeMin: 0, donorApproval: false,
    approvers: [{ role: 'procurement_officer', label: 'Procurement Officer' }, { role: 'finance', label: 'Finance Manager' }] },
  { id: 't2', name: 'Tier 2 — Medium purchase', minUSD: 2500.01, maxUSD: 10000, method: 'rfq_formal', minQuotations: 3, invitedSuppliersMin: 3, deadlineWorkingDays: 0, committeeMin: 0, donorApproval: false,
    approvers: [{ role: 'programs_director', label: 'Director of Programs' }, { role: 'finance_director', label: 'Director of Finance & Support' }] },
  { id: 't3', name: 'Tier 3 — Large purchase', minUSD: 10000.01, maxUSD: 50000, method: 'closed_bid', minQuotations: 3, invitedSuppliersMin: 5, deadlineWorkingDays: 14, committeeMin: 3, donorApproval: false,
    approvers: [{ role: 'programs_director', label: 'Director of Programs' }, { role: 'executive_director', label: 'Executive Director' }] },
  { id: 't4', name: 'Tier 4 — High value / Works', minUSD: 50000.01, maxUSD: null, method: 'open_bid', minQuotations: 5, invitedSuppliersMin: 0, deadlineWorkingDays: 14, committeeMin: 3, donorApproval: true,
    approvers: [{ role: 'programs_director', label: 'Director of Programs' }, { role: 'executive_director', label: 'Executive Director' }, { role: 'finance_director', label: 'Director of Finance & Support' }] },
]
SEED_SETTINGS.tiers = SEED_TIERS

export const DEPARTMENTS = ['Procurement', 'Finance', 'Medical Programs', 'Operations', 'Field Services', 'Executive Office', 'Legal', 'IT']
export const CATEGORIES = ['Medical Equipment', 'Prosthetic Components', 'Rehabilitation Supplies', 'IT & Software', 'Vehicles & Fleet', 'Office Supplies', 'Professional Services', 'Logistics', 'Facilities']
export const UNITS = ['each', 'box', 'set', 'kg', 'litre', 'hour', 'day', 'month', 'pack']
export const COST_CENTERS = ['CC-100 Executive', 'CC-200 Medical', 'CC-210 Prosthetics Lab', 'CC-300 Field Ops', 'CC-400 Admin', 'CC-500 IT']
export const BUDGET_LINES = ['BL-01 Program Delivery', 'BL-02 Medical Supplies', 'BL-03 Capital Equipment', 'BL-04 Admin & Overheads', 'BL-05 Logistics', 'BL-06 Technology']

export const SEED_USERS: User[] = [
  { id: 'u_bilal',  name: 'Bilal Abbassi',   email: 'AlAbbassi.bilal@icloud.com', password: 'rhs2025', role: 'admin', approverRoles: ['programs_director'], department: 'Programs', title: 'Director of Programs', avatarColor: 'bg-brand-600',  active: true },
  { id: 'u_shatha', name: 'Shatha Homsi',    email: 'shatha.homsi@rhs.jo',       password: 'rhs2025', role: 'finance_director',    department: 'Finance',           title: 'Director of Finance & Support', avatarColor: 'bg-sun-700',    active: true },
  { id: 'u_khalid', name: 'Khalid Mansour',  email: 'khalid.mansour@rhs.jo',     password: 'rhs2025', role: 'logistics',           department: 'Operations',        title: 'Logistics & Warehouse Officer', avatarColor: 'bg-ink-600',    active: true },
  { id: 'u_lina',   name: 'Lina Haddad',     email: 'lina.haddad@rhs.jo',        password: 'rhs2025', role: 'requester',           department: 'Medical Programs',  title: 'Program Coordinator',           avatarColor: 'bg-accent-600', active: true },
  { id: 'u_omar',   name: 'Omar Khalil',     email: 'omar.khalil@rhs.jo',        password: 'rhs2025', role: 'dept_manager',        department: 'Medical Programs',  title: 'Medical Programs Manager',      avatarColor: 'bg-ink-700',    active: true },
  { id: 'u_rana',   name: 'Rana Suleiman',   email: 'rana.suleiman@rhs.jo',      password: 'rhs2025', role: 'finance',             department: 'Finance',           title: 'Finance Manager',               avatarColor: 'bg-sun-700',    active: true },
  { id: 'u_yousef', name: 'Yousef Nasser',   email: 'yousef.nasser@rhs.jo',      password: 'rhs2025', role: 'procurement_officer', department: 'Procurement',       title: 'Procurement Officer',           avatarColor: 'bg-brand-800',  active: true },
  { id: 'u_maha',   name: 'Maha Al-Rawi',    email: 'maha.alrawi@rhs.jo',        password: 'rhs2025', role: 'procurement_manager', department: 'Procurement',       title: 'Procurement Manager',           avatarColor: 'bg-info-700',   active: true },
  { id: 'u_fawaz',  name: 'Fawaz Al Shakaa', email: 'fawaz.alshakaa@rhs.jo',     password: 'rhs2025', role: 'executive_director',  department: 'Executive Office',  title: 'Executive Director / Board Chairperson', avatarColor: 'bg-ink-900', active: true },
  { id: 'u_dana',   name: 'Dana Qasem',      email: 'dana.qasem@rhs.jo',         password: 'rhs2025', role: 'legal',               department: 'Legal',             title: 'Legal Counsel',                 avatarColor: 'bg-accent-700', active: true },
  { id: 'u_hani',   name: 'Hani Odeh',       email: 'hani.odeh@rhs.jo',          password: 'rhs2025', role: 'dept_manager',        department: 'Operations',        title: 'Operations Manager',            avatarColor: 'bg-ink-600',    active: true },
  { id: 'u_reem',   name: 'Reem Nasser',     email: 'reem.nasser@rhs.jo',        password: 'rhs2025', role: 'hr',                  department: 'HR & Admin',        title: 'HR & Admin Officer',            avatarColor: 'bg-info-500',   active: true },
  { id: 'u_nour',   name: 'Nour Saleh',      email: 'nour.saleh@rhs.jo',         password: 'rhs2025', role: 'requester',           department: 'Field Services',    title: 'Field Coordinator',             avatarColor: 'bg-brand-500',  active: true },
]

/** Approval matrix — amount bands drive the chain. Editable from Admin → Approval Matrix. */
export const SEED_RULES: ApprovalRule[] = [
  { id: 'r_pr_1', name: 'PR — all values (SOP-PRO-01)', docType: 'PR', minAmount: 0, maxAmount: null, steps: [{ role: 'finance', label: 'Finance — Budget verification & budget code' }, { role: 'dept_manager', label: 'Line Manager — Operational justification' }] },
  { id: 'r_inv_1', name: 'Invoice payment — all values (SOP-PRO-07)', docType: 'INVOICE', minAmount: 0, maxAmount: null, steps: [{ role: 'finance_director', label: 'Finance Director — Payment authorisation' }, { role: 'executive_director', label: 'Executive Director — Second signatory' }] },
]

export const SEED_VENDORS: Vendor[] = [
  { id: 'v_1', name: 'Ottobock Middle East FZE',      code: 'VEN-0001', category: 'Prosthetic Components', contactName: 'Karim Fares',   email: 'sales@ottobock-me.example', phone: '+971 4 000 0001', country: 'UAE',    taxId: 'AE-10039', rating: 5, status: 'active',  registeredAt: '2024-02-10T09:00:00Z' },
  { id: 'v_2', name: 'Össur Regional Distributors',  code: 'VEN-0002', category: 'Prosthetic Components', contactName: 'Hala Mansour',  email: 'orders@ossur-rd.example',   phone: '+962 6 500 0002', country: 'Jordan', taxId: 'JO-22011', rating: 4, status: 'active',  registeredAt: '2024-03-01T09:00:00Z' },
  { id: 'v_3', name: 'Al-Shifa Medical Supplies',    code: 'VEN-0003', category: 'Medical Equipment',     contactName: 'Tariq Awad',    email: 'info@alshifa.example',      phone: '+962 6 500 0003', country: 'Jordan', taxId: 'JO-18877', rating: 4, status: 'active',  registeredAt: '2023-11-15T09:00:00Z' },
  { id: 'v_4', name: 'Jordan Rehab Solutions',       code: 'VEN-0004', category: 'Rehabilitation Supplies', contactName: 'Salma Nabil', email: 'sales@jrs.example',         phone: '+962 6 500 0004', country: 'Jordan', taxId: 'JO-30215', rating: 3, status: 'active',  registeredAt: '2024-06-20T09:00:00Z' },
  { id: 'v_5', name: 'TechNova IT Services',         code: 'VEN-0005', category: 'IT & Software',         contactName: 'Fadi Hourani',  email: 'hello@technova.example',    phone: '+962 6 500 0005', country: 'Jordan', taxId: 'JO-41190', rating: 4, status: 'active',  registeredAt: '2024-01-05T09:00:00Z' },
  { id: 'v_6', name: 'Amman Fleet & Logistics',      code: 'VEN-0006', category: 'Vehicles & Fleet',      contactName: 'Rami Zayed',    email: 'ops@ammanfleet.example',    phone: '+962 6 500 0006', country: 'Jordan', taxId: 'JO-27760', rating: 3, status: 'active',  registeredAt: '2024-08-12T09:00:00Z' },
  { id: 'v_7', name: 'MedCare Equipment Co.',        code: 'VEN-0007', category: 'Medical Equipment',     contactName: 'Layla Tahir',   email: 'sales@medcare.example',     phone: '+962 6 500 0007', country: 'Jordan', taxId: 'JO-33420', rating: 4, status: 'active',  registeredAt: '2024-04-18T09:00:00Z' },
  { id: 'v_8', name: 'Global Ortho Trading',         code: 'VEN-0008', category: 'Prosthetic Components', contactName: 'Nabil Saad',    email: 'info@globalortho.example',  phone: '+20 2 000 0008',  country: 'Egypt',  taxId: 'EG-55801', rating: 2, status: 'pending', registeredAt: '2025-07-02T09:00:00Z' },
]

export const STANDARD_CLAUSES: ContractClause[] = [
  { id: 'c_scope',   title: '1. Scope of Supply / Services', mandatory: true,  body: 'The Vendor shall supply the goods and/or services described in the Purchase Order and its annexes, in accordance with the specifications, quantities and delivery schedule set out therein.' },
  { id: 'c_price',   title: '2. Contract Price & Payment',   mandatory: true,  body: 'The total contract price is fixed and inclusive of all taxes, duties and delivery charges unless expressly stated otherwise. Payment shall be made within thirty (30) days of receipt of a valid invoice and acceptance of the deliverables.' },
  { id: 'c_deliv',   title: '3. Delivery & Acceptance',      mandatory: true,  body: 'Delivery shall be made to the RHS location stated in the Purchase Order. RHS shall inspect deliverables within ten (10) working days. Non-conforming items may be rejected and replaced at the Vendor’s cost.' },
  { id: 'c_warr',    title: '4. Warranty',                   mandatory: true,  body: 'The Vendor warrants that all goods are new, free from defects, and fit for purpose for a period of no less than twelve (12) months from acceptance, or as stated in the accepted quotation, whichever is longer.' },
  { id: 'c_ethics',  title: '5. Ethics, Anti-Corruption & Safeguarding', mandatory: true, body: 'The Vendor confirms adherence to RHS’s humanitarian principles, including zero tolerance for fraud, corruption, child labour and exploitation, and agrees to RHS’s Safeguarding Policy.' },
  { id: 'c_conf',    title: '6. Confidentiality & Data Protection', mandatory: true, body: 'Each party shall keep confidential all non-public information of the other party, including beneficiary personal and medical data, and shall process such data only as necessary to perform this Contract.' },
  { id: 'c_term',    title: '7. Termination',                mandatory: true,  body: 'Either party may terminate this Contract for material breach not remedied within fourteen (14) days of written notice. RHS may terminate for convenience with thirty (30) days’ notice, paying only for work satisfactorily completed.' },
  { id: 'c_law',     title: '8. Governing Law & Disputes',   mandatory: true,  body: 'This Contract is governed by the laws of the Hashemite Kingdom of Jordan. Disputes shall first be addressed through good-faith negotiation and, failing that, the competent courts of Amman.' },
  { id: 'c_sla',     title: '9. Service Levels',             mandatory: false, body: 'Where services are provided, the Vendor shall meet the service levels defined in Annex B. Persistent failure to meet service levels entitles RHS to service credits and/or termination.' },
  { id: 'c_ip',      title: '10. Intellectual Property',     mandatory: false, body: 'All deliverables created specifically for RHS under this Contract shall vest in RHS upon payment. The Vendor retains ownership of its pre-existing IP and grants RHS a perpetual licence to use it as part of the deliverables.' },
]

// ---------------------------------------------------------------------------
// Sample documents at different stages so every screen has content on first run
// ---------------------------------------------------------------------------
const d = (n: number) => addDays(new Date(), n).toISOString()
const ago = (n: number) => d(-n)

export const SEED_PRS: PurchaseRequisition[] = [
  {
    id: 'pr_1', number: 'PR-2025-0041', title: 'Modular prosthetic knee joints — Q4 fitting program',
    justification: 'Replenishment of prosthetic components for the Q4 Mobile Amputee Support Unit fitting programme (est. 24 beneficiaries).',
    department: 'Medical Programs', requesterId: 'u_lina', requesterName: 'Lina Haddad', ownerName: DOC_OWNER,
    procurementType: 'goods', priority: 'high', neededBy: toInputDate(addDays(new Date(), 30)), currency: 'JOD',
    lines: [
      { id: 'l1', description: 'Modular polycentric knee joint (adult)', category: 'Prosthetic Components', quantity: 24, unit: 'each', unitPrice: 620, costCenter: 'CC-210 Prosthetics Lab', budgetLine: 'BL-02' },
      { id: 'l2', description: 'Pylon tube adapter set 30mm', category: 'Prosthetic Components', quantity: 24, unit: 'set', unitPrice: 85, costCenter: 'CC-210 Prosthetics Lab', budgetLine: 'BL-02' },
    ],
    attachments: [], status: 'sourcing',
    approvalChain: [
      { id: 's1', order: 1, label: 'Department Manager', role: 'dept_manager', approverId: 'u_omar', status: 'approved', decidedBy: 'u_omar', decidedAt: ago(9), comment: 'Aligned with Q4 plan.' },
      { id: 's2', order: 2, label: 'Finance — Budget Check', role: 'finance', approverId: 'u_rana', status: 'approved', decidedBy: 'u_rana', decidedAt: ago(8), comment: 'Budget available under BL-02.' },
      { id: 's3', order: 3, label: 'Executive Director', role: 'executive_director', approverId: 'u_fawaz', status: 'approved', decidedBy: 'u_fawaz', decidedAt: ago(7), comment: 'Approved.' },
    ],
    createdAt: ago(11), updatedAt: ago(2), submittedAt: ago(10), approvedAt: ago(7), sourcingOwnerId: 'u_yousef',
    quotations: [
      { id: 'q1', vendorId: 'v_1', vendorName: 'Ottobock Middle East FZE', reference: 'OB-Q-88213', receivedAt: ago(4), validUntil: d(26), currency: 'JOD', subtotal: 16680, taxRate: 16, deliveryDays: 21, paymentTerms: '50% advance, 50% on delivery', warranty: '24 months', notes: 'Includes training session for lab technicians.', attachments: [], lines: [{ lineItemId: 'l1', unitPrice: 610 }, { lineItemId: 'l2', unitPrice: 85 }], compliant: true },
      { id: 'q2', vendorId: 'v_2', vendorName: 'Össur Regional Distributors', reference: 'OSS-2025-1174', receivedAt: ago(3), validUntil: d(30), currency: 'JOD', subtotal: 15960, taxRate: 16, deliveryDays: 28, paymentTerms: '30 days net', warranty: '18 months', notes: '', attachments: [], lines: [{ lineItemId: 'l1', unitPrice: 585 }, { lineItemId: 'l2', unitPrice: 80 }], compliant: true },
    ],
    comments: [{ id: 'cm1', authorId: 'u_yousef', authorName: 'Yousef Nasser', at: ago(2), text: 'Two quotations received; awaiting Global Ortho response by Thursday.' }],
    sourcing: { ...emptySourcing(), issuedAt: toInputDate(addDays(new Date(), -20)), deadline: toInputDate(addDays(new Date(), 2)), invitedVendorIds: ['v_1', 'v_2', 'v_8', 'v_3', 'v_7'],
      committee: [{ userId: 'u_maha', name: 'Maha Al-Rawi', role: 'chair', ndaSigned: true, coiDeclared: true }, { userId: 'u_omar', name: 'Omar Khalil', role: 'technical', ndaSigned: true, coiDeclared: true }, { userId: 'u_rana', name: 'Rana Suleiman', role: 'member', ndaSigned: true, coiDeclared: false }] },
  },
  {
    id: 'pr_2', number: 'PR-2025-0042', title: 'Laptops for field coordinators (6 units)',
    justification: 'Replace end-of-life devices used by MASU field teams for beneficiary intake and reporting.',
    department: 'Field Services', requesterId: 'u_nour', requesterName: 'Nour Saleh', ownerName: DOC_OWNER,
    procurementType: 'goods', priority: 'normal', neededBy: toInputDate(addDays(new Date(), 45)), currency: 'JOD',
    lines: [{ id: 'l1', description: 'Business laptop 14", 16GB RAM, 512GB SSD, 3yr warranty', category: 'IT & Software', quantity: 6, unit: 'each', unitPrice: 780, costCenter: 'CC-300 Field Ops', budgetLine: 'BL-06' }],
    attachments: [], status: 'pending_approval',
    approvalChain: [
      { id: 's1', order: 1, label: 'Department Manager', role: 'dept_manager', approverId: 'u_hani', status: 'approved', decidedBy: 'u_hani', decidedAt: ago(1), comment: 'Needed for field intake.' },
      { id: 's2', order: 2, label: 'Finance — Budget Check', role: 'finance', approverId: 'u_rana', status: 'current' },
    ],
    createdAt: ago(3), updatedAt: ago(1), submittedAt: ago(2), quotations: [], comments: [], sourcing: emptySourcing(),
  },
  {
    id: 'pr_3', number: 'PR-2025-0043', title: 'Physiotherapy consumables — resistance bands & mats',
    justification: 'Monthly rehabilitation supplies for the Amman centre.',
    department: 'Medical Programs', requesterId: 'u_lina', requesterName: 'Lina Haddad', ownerName: DOC_OWNER,
    procurementType: 'goods', priority: 'low', neededBy: toInputDate(addDays(new Date(), 20)), currency: 'JOD',
    lines: [
      { id: 'l1', description: 'Resistance band set (5 levels)', category: 'Rehabilitation Supplies', quantity: 40, unit: 'set', unitPrice: 9.5, costCenter: 'CC-200 Medical', budgetLine: 'BL-02' },
      { id: 'l2', description: 'Exercise mat 180x60cm', category: 'Rehabilitation Supplies', quantity: 20, unit: 'each', unitPrice: 14, costCenter: 'CC-200 Medical', budgetLine: 'BL-02' },
    ],
    attachments: [], status: 'pending_approval',
    approvalChain: [{ id: 's1', order: 1, label: 'Department Manager', role: 'dept_manager', approverId: 'u_omar', status: 'current' }],
    createdAt: ago(1), updatedAt: ago(1), submittedAt: ago(1), quotations: [], comments: [], sourcing: emptySourcing(),
  },
  {
    id: 'pr_4', number: 'PR-2025-0039', title: 'Annual maintenance — MASU vehicle fleet',
    justification: 'Scheduled maintenance contract for 3 Mobile Amputee Support Unit vans.',
    department: 'Operations', requesterId: 'u_hani', requesterName: 'Hani Odeh', ownerName: DOC_OWNER,
    procurementType: 'services', priority: 'normal', neededBy: toInputDate(addDays(new Date(), 10)), currency: 'JOD',
    lines: [{ id: 'l1', description: 'Fleet maintenance & servicing — 12 months, 3 vans', category: 'Vehicles & Fleet', quantity: 12, unit: 'month', unitPrice: 640, costCenter: 'CC-300 Field Ops', budgetLine: 'BL-05' }],
    attachments: [], status: 'ordered',
    approvalChain: [
      { id: 's1', order: 1, label: 'Department Manager', role: 'dept_manager', approverId: 'u_hani', status: 'approved', decidedBy: 'u_hani', decidedAt: ago(30) },
      { id: 's2', order: 2, label: 'Finance — Budget Check', role: 'finance', approverId: 'u_rana', status: 'approved', decidedBy: 'u_rana', decidedAt: ago(29) },
    ],
    createdAt: ago(34), updatedAt: ago(12), submittedAt: ago(33), approvedAt: ago(29), sourcingOwnerId: 'u_yousef',
    quotations: [
      { id: 'q1', vendorId: 'v_6', vendorName: 'Amman Fleet & Logistics', reference: 'AFL-2211', receivedAt: ago(25), validUntil: d(5), currency: 'JOD', subtotal: 7680, taxRate: 16, deliveryDays: 7, paymentTerms: 'Monthly in arrears', warranty: '90 days on parts', notes: '', attachments: [], lines: [{ lineItemId: 'l1', unitPrice: 640 }], compliant: true },
      { id: 'q2', vendorId: 'v_3', vendorName: 'Al-Shifa Medical Supplies', reference: 'ASM-F-019', receivedAt: ago(24), validUntil: d(2), currency: 'JOD', subtotal: 8400, taxRate: 16, deliveryDays: 10, paymentTerms: '30 days net', warranty: '60 days', notes: 'Sub-contracted workshop.', attachments: [], lines: [{ lineItemId: 'l1', unitPrice: 700 }], compliant: false },
      { id: 'q3', vendorId: 'v_5', vendorName: 'TechNova IT Services', reference: 'TN-FLT-04', receivedAt: ago(23), validUntil: d(8), currency: 'JOD', subtotal: 8040, taxRate: 16, deliveryDays: 14, paymentTerms: '30 days net', warranty: '90 days', notes: '', attachments: [], lines: [{ lineItemId: 'l1', unitPrice: 670 }], compliant: true },
    ],
    awardedQuotationId: 'q1', awardJustification: 'Lowest compliant price; strongest fleet-specific track record; monthly billing matches cash-flow.',
    poId: 'po_1', comments: [], sourcing: emptySourcing(),
  },
  {
    id: 'pr_5', number: 'PR-2025-0044', title: 'Office chairs — Amman rehabilitation centre reception',
    justification: 'Replace damaged reception seating.',
    department: 'Operations', requesterId: 'u_nour', requesterName: 'Nour Saleh', ownerName: DOC_OWNER,
    procurementType: 'goods', priority: 'low', neededBy: toInputDate(addDays(new Date(), 60)), currency: 'JOD',
    lines: [{ id: 'l1', description: 'Waiting-area chair, 4-seat bench', category: 'Office Supplies', quantity: 3, unit: 'each', unitPrice: 210, costCenter: 'CC-400 Admin', budgetLine: 'BL-04' }],
    attachments: [], status: 'draft', approvalChain: [], createdAt: ago(0.2), updatedAt: ago(0.2), quotations: [], comments: [], sourcing: emptySourcing(),
  },
  {
    id: 'pr_6', number: 'PR-2025-0038', title: 'Beneficiary case-management software licence',
    justification: 'Annual licence renewal for the case-management platform.',
    department: 'IT', requesterId: 'u_lina', requesterName: 'Lina Haddad', ownerName: DOC_OWNER,
    procurementType: 'services', priority: 'urgent', neededBy: toInputDate(addDays(new Date(), 5)), currency: 'JOD',
    lines: [{ id: 'l1', description: 'Case management SaaS — 25 seats, 12 months', category: 'IT & Software', quantity: 1, unit: 'each', unitPrice: 4200, costCenter: 'CC-500 IT', budgetLine: 'BL-06' }],
    attachments: [], status: 'returned',
    approvalChain: [
      { id: 's1', order: 1, label: 'Department Manager', role: 'dept_manager', approverId: 'u_omar', status: 'approved', decidedBy: 'u_omar', decidedAt: ago(5) },
      { id: 's2', order: 2, label: 'Finance — Budget Check', role: 'finance', approverId: 'u_rana', status: 'returned', decidedBy: 'u_rana', decidedAt: ago(4), comment: 'Please attach last year’s invoice and confirm seat count — we had 20 seats previously.' },
    ],
    createdAt: ago(6), updatedAt: ago(4), submittedAt: ago(6), quotations: [], comments: [], sourcing: emptySourcing(),
  },
  {
    id: 'pr_7', number: 'PR-2025-0045', title: 'Printer toner cartridges — HQ admin office',
    justification: 'Replacement toner for the two shared HQ printers; stock exhausted.',
    department: 'Operations', requesterId: 'u_nour', requesterName: 'Nour Saleh', ownerName: DOC_OWNER, donorCode: 'CORE-2026', procurementType: 'goods', priority: 'normal', neededBy: toInputDate(addDays(new Date(), 7)), currency: 'JOD',
    lines: [{ id: 'l1', description: 'Toner cartridge, black, HP 26A compatible', category: 'Office Supplies', quantity: 4, unit: 'each', unitPrice: 55, costCenter: 'CC-400 Admin', budgetLine: 'BL-04' }],
    attachments: [], status: 'approved',
    approvalChain: [
      { id: 's1', order: 1, label: 'Finance — Budget verification & budget code', role: 'finance', approverId: 'u_rana', status: 'approved', decidedBy: 'u_rana', decidedAt: ago(1.5), comment: 'BL-04 confirmed.' },
      { id: 's2', order: 2, label: 'Line Manager — Operational justification', role: 'dept_manager', approverId: 'u_hani', status: 'approved', decidedBy: 'u_hani', decidedAt: ago(1) },
    ],
    createdAt: ago(2), updatedAt: ago(1), submittedAt: ago(2), approvedAt: ago(1), quotations: [], comments: [], sourcing: emptySourcing(),
  },
  {
    id: 'pr_8', number: 'PR-2025-0046', title: 'Construction of prosthetics workshop extension — Irbid centre',
    justification: 'Extension of the Irbid rehabilitation centre workshop (120 m²) to add two fitting rooms and a gait-training lane, funded under the Irbid Access grant.',
    department: 'Operations', requesterId: 'u_hani', requesterName: 'Hani Odeh', ownerName: DOC_OWNER, procurementType: 'works', donorCode: 'GR-2025-IRB-03', priority: 'high', neededBy: toInputDate(addDays(new Date(), 120)), currency: 'JOD',
    lines: [{ id: 'l1', description: 'Civil works — workshop extension per BoQ and drawings (Annex A)', category: 'Works', quantity: 1, unit: 'lot', unitPrice: 62000, costCenter: 'CC-300 Field Ops', budgetLine: 'BL-08' }],
    attachments: [], status: 'sourcing', sourcingOwnerId: 'u_yousef',
    approvalChain: [
      { id: 's1', order: 1, label: 'Finance — Budget verification & budget code', role: 'finance', approverId: 'u_rana', status: 'approved', decidedBy: 'u_rana', decidedAt: ago(12), comment: 'Grant budget line confirmed.' },
      { id: 's2', order: 2, label: 'Line Manager — Operational justification', role: 'dept_manager', approverId: 'u_hani', status: 'approved', decidedBy: 'u_hani', decidedAt: ago(11) },
    ],
    createdAt: ago(14), updatedAt: ago(6), submittedAt: ago(13), approvedAt: ago(11), quotations: [], comments: [],
    sourcing: { ...emptySourcing(), issuedAt: toInputDate(addDays(new Date(), -6)), deadline: toInputDate(addDays(new Date(), 16)), advertisementRef: 'Al-Rai daily + RHS website + donor portal, ref ITB-2025-003', committee: [] },
  },
]

export const SEED_POS: PurchaseOrder[] = [
  {
    id: 'po_1', number: 'PO-2025-0017', prId: 'pr_4', prNumber: 'PR-2025-0039', title: 'Annual maintenance — MASU vehicle fleet',
    vendorId: 'v_6', vendorName: 'Amman Fleet & Logistics', quotationId: 'q1', ownerName: DOC_OWNER, createdBy: 'u_yousef', createdByName: 'Yousef Nasser',
    currency: 'JOD',
    lines: [{ id: 'l1', description: 'Fleet maintenance & servicing — 12 months, 3 vans', category: 'Vehicles & Fleet', quantity: 12, unit: 'month', unitPrice: 640, costCenter: 'CC-300 Field Ops', budgetLine: 'BL-05' }],
    taxRate: 16, deliveryAddress: 'RHS Operations Yard, Amman', deliveryDate: toInputDate(addDays(new Date(), 7)), paymentTerms: 'Monthly in arrears', incoterms: 'DAP', notes: 'Service schedule to be agreed with Operations Manager.',
    status: 'issued',
    approvalChain: [
      { id: 's1', order: 1, label: 'Procurement Manager', role: 'procurement_manager', approverId: 'u_maha', status: 'approved', decidedBy: 'u_maha', decidedAt: ago(14), comment: 'OK.' },
      { id: 's2', order: 2, label: 'Finance — Commitment', role: 'finance', approverId: 'u_rana', status: 'approved', decidedBy: 'u_rana', decidedAt: ago(13), comment: 'Committed against BL-05.' },
    ],
    attachments: [], createdAt: ago(16), updatedAt: ago(12), issuedAt: ago(12), contractId: 'ct_1', comments: [],
  },
]

export const SEED_CONTRACTS: Contract[] = [
  {
    id: 'ct_1', number: 'CT-2025-0006', poId: 'po_1', poNumber: 'PO-2025-0017', prNumber: 'PR-2025-0039',
    title: 'Fleet Maintenance Services Agreement — MASU Vans', vendorId: 'v_6', vendorName: 'Amman Fleet & Logistics',
    ownerName: DOC_OWNER, draftedBy: 'u_yousef', draftedByName: 'Yousef Nasser', type: 'service',
    startDate: toInputDate(new Date()), endDate: toInputDate(addDays(new Date(), 365)), value: 7680, currency: 'JOD',
    clauses: STANDARD_CLAUSES.filter((c) => c.mandatory || c.id === 'c_sla'),
    milestones: [
      { id: 'm1', title: 'Q1 servicing complete', dueDate: toInputDate(addDays(new Date(), 90)), amount: 1920, status: 'pending' },
      { id: 'm2', title: 'Q2 servicing complete', dueDate: toInputDate(addDays(new Date(), 180)), amount: 1920, status: 'pending' },
      { id: 'm3', title: 'Q3 servicing complete', dueDate: toInputDate(addDays(new Date(), 270)), amount: 1920, status: 'pending' },
      { id: 'm4', title: 'Q4 servicing complete', dueDate: toInputDate(addDays(new Date(), 365)), amount: 1920, status: 'pending' },
    ],
    attachments: [], status: 'legal_review', legalReviewer: 'u_dana',
    signatories: [{ name: 'Sami Barakat', title: 'Executive Director', party: 'RHS' }, { name: 'Rami Zayed', title: 'General Manager', party: 'Vendor' }],
    createdAt: ago(10), updatedAt: ago(9), comments: [],
  },
]

export const SEED_BUDGETS: ProjectBudget[] = [
  { id: 'bud_heal', donorCode: 'RH-2026-0032', name: 'Prosthetic and Integrated Rehabilitation Support for Gazan Beneficiaries in Egypt', donor: 'HEAL Palestine', currency: 'USD', startDate: '2026-11-01', endDate: '2027-07-31', duration: '9 Months', status: 'draft',
    lines: [
      { id: 'bl_h1', code: 'D-01', description: 'Project Manager (Cairo)', category: 'A. Personnel — Field Team (Direct Cost)', amount: 27000, costType: 'direct', kind: 'salary', newStaff: true, activityCode: 'PM02', accountNo: '2602', location: 'Cairo', unit: 'Person', units: 1, frequency: 9, unitCost: 3000, pct: 1 },
      { id: 'bl_h2', code: 'D-02', description: 'P&O technicians (x3)', category: 'A. Personnel — Field Team (Direct Cost)', amount: 48600, costType: 'direct', kind: 'salary', newStaff: true, activityCode: 'P02', accountNo: '2601', location: 'Cairo', unit: 'Person', units: 3, frequency: 9, unitCost: 1800, pct: 1 },
      { id: 'bl_h3', code: 'D-10', description: 'Prosthetic components & fabrication materials (86 devices)', category: 'B. Prosthetic Fitting (Direct Cost)', amount: 215000, costType: 'direct', activityCode: 'P02', accountNo: '2611', location: 'Cairo', unit: 'Lump', units: 1, frequency: 1, unitCost: 215000, pct: 1 },
      { id: 'bl_h4', code: 'D-11', description: 'Physiotherapy & MHPSS sessions', category: 'B. Prosthetic Fitting (Direct Cost)', amount: 52560, costType: 'direct', activityCode: 'R02', accountNo: '2614', location: 'Cairo', unit: 'Session', units: 1460, frequency: 1, unitCost: 36, pct: 1 },
      { id: 'bl_h5', code: 'D-12', description: 'Patient transport & accommodation', category: 'B. Prosthetic Fitting (Direct Cost)', amount: 32850, costType: 'direct', activityCode: 'S02', accountNo: '2606', location: 'Cairo', unit: 'Person', units: 73, frequency: 1, unitCost: 450, pct: 1 },
      { id: 'bl_h6', masterLineId: 'ml_02', code: 'A-01', description: 'Amman support personnel (allocated)', category: 'A. Amman Support Personnel (Indirect / Admin)', amount: 21600, costType: 'admin', kind: 'salary', staffIds: ['stf_2'], activityCode: 'PM01', accountNo: '2603', location: 'Amman', unit: 'Person', units: 1, frequency: 9, unitCost: 12000, pct: 0.2 },
      { id: 'bl_h7', masterLineId: 'ml_11', code: 'B-01', description: 'Office, IT & communications share', category: 'B. Office, IT & Operational Costs (Indirect / Admin)', amount: 14390, costType: 'admin', activityCode: 'S01', accountNo: '2619', location: 'Amman', unit: 'Months', units: 9, frequency: 1, unitCost: 3997, pct: 0.4 },
    ], uploadedBy: 'u_bilal', uploadedByName: 'Bilal Abbassi', uploadedAt: '2026-08-10T09:00:00Z', ownerName: DOC_OWNER, notes: 'Proposal budget — submitted 7 Oct 2026' },
  { id: 'bud_edc', donorCode: 'RH-2026-0009', name: 'Inclusive Early Development Centre — Gaza', donor: 'HDF — Humanitarian Development Foundation', currency: 'USD', startDate: '2026-04-01', endDate: '2027-03-31', duration: '12 Months', status: 'draft',
    lines: [{ id: 'bl_e1', code: 'Prog_1', description: 'Site preparation and centre construction', category: 'A. Centre establishment (Direct Cost)', amount: 180000, costType: 'direct', location: 'Gaza', unit: 'Lump', units: 1, frequency: 1, unitCost: 180000, pct: 1 }, { id: 'bl_e2', code: 'Prog_5', description: 'Integrated service delivery (rehab, education, MHPSS, nutrition)', category: 'B. Services (Direct Cost)', amount: 264000, costType: 'direct', location: 'Gaza', unit: 'Month', units: 12, frequency: 1, unitCost: 22000, pct: 1 }], uploadedBy: 'u_bilal', uploadedByName: 'Bilal Abbassi', uploadedAt: '2026-09-18T09:00:00Z', ownerName: DOC_OWNER, notes: 'Under development' },
  { id: 'bud_qc', donorCode: 'RH-2025-0006', name: 'Prosthetics & assistive devices for Gaza amputees', donor: 'Qatar Charity', currency: 'USD', startDate: '2025-01-01', endDate: '2025-12-31', duration: '12 Months', approvedAt: '2024-12-20', status: 'closed',
    lines: [{ id: 'bl_q1', code: 'Prog_1', description: 'Prosthetics Cost', category: 'Programme', amount: 697066, costType: 'direct', location: 'Gaza' }, { id: 'bl_q2', code: 'Prog_2', description: 'Mental Health Sessions Cost', category: 'Programme', amount: 50760, costType: 'direct', location: 'Gaza' }, { id: 'bl_q3', code: 'Prog_3', description: 'Physical rehabilitation Sessions Cost', category: 'Programme', amount: 50760, costType: 'direct', location: 'Gaza' }, { id: 'bl_q4', code: 'Prog_5', description: 'Visibility', category: 'Programme', amount: 16652, costType: 'direct', location: 'Gaza' }], fundsReceived: 652210, uploadedBy: 'u_shatha', uploadedByName: 'Shatha Homsi', uploadedAt: '2024-12-21T09:00:00Z', ownerName: DOC_OWNER, notes: 'Closed — final report accepted' },
  {
    id: 'bud_core', donorCode: 'CORE-2026', name: 'Core operating budget 2026', donor: 'RHS unrestricted funds', currency: 'JOD', startDate: '2026-01-01', endDate: '2026-12-31', approvedAt: '2025-12-15', status: 'active',
    lines: [
      { id: 'bl_c1', code: 'BL-01', description: 'Program Delivery', category: 'Programs', amount: 120000 },
      { id: 'bl_c2', code: 'BL-02', description: 'Medical Supplies', category: 'Programs', amount: 85000 },
      { id: 'bl_c3', code: 'BL-03', description: 'Capital Equipment', category: 'Capital', amount: 40000 },
      { id: 'bl_c4', code: 'BL-04', description: 'Admin & Overheads', category: 'Support', amount: 32000, masterLineId: 'ml_12' },
      { id: 'bl_c5', code: 'BL-05', description: 'Logistics', category: 'Support', amount: 18000 },
      { id: 'bl_c6', code: 'BL-06', description: 'Technology', category: 'Support', amount: 15000 },
    ],
    uploadedBy: 'u_shatha', uploadedByName: 'Shatha Homsi', uploadedAt: '2025-12-16T09:00:00Z', ownerName: DOC_OWNER, notes: 'Board-approved annual budget.',
  },
  {
    id: 'bud_irb', donorCode: 'GR-2025-IRB-03', name: 'Irbid Access — prosthetics workshop & outreach', donor: 'Irbid Access Grant (bilateral donor)', currency: 'JOD', startDate: '2025-10-01', endDate: '2026-12-31', approvedAt: '2025-09-20', status: 'active',
    lines: [
      { id: 'bl_i1', code: 'BL-08', description: 'Capital Works — workshop extension', category: 'Capital', amount: 70000 },
      { id: 'bl_i2', code: 'BL-02', description: 'Medical Supplies — prosthetic components', category: 'Programs', amount: 45000 },
      { id: 'bl_i3', code: 'BL-09', description: 'Outreach & transport', category: 'Programs', amount: 12000 },
      { id: 'bl_i4', code: 'BL-10', description: 'Project staff — P&O technician & outreach officer', category: 'HR — Personnel', amount: 38000, masterLineId: 'ml_09', kind: 'salary', unit: 'Person', units: 2, staffIds: ['stf_12', 'stf_13'] },
      { id: 'bl_i5', code: 'BL-11', description: 'Indirect costs (7%)', category: 'Support', amount: 11550, masterLineId: 'ml_11' },
    ],
    uploadedBy: 'u_shatha', uploadedByName: 'Shatha Homsi', uploadedAt: '2025-09-22T09:00:00Z', ownerName: DOC_OWNER, notes: 'Approved donor budget, annex B of the grant agreement.',
  },
]

export const SEED_DONORS: Donor[] = [
  { id: 'don_qc', name: 'Qatar Charity', type: 'ingo', country: 'Qatar', website: 'www.qcharity.org', focus: 'Health, rehabilitation, humanitarian response', contacts: [{ id: 'dc1', name: 'Mohammed Al-Kuwari', title: 'Programmes Manager — Jordan', email: 'm.alkuwari@qcharity.example', phone: '+962 6 500 1100', primary: true }, { id: 'dc2', name: 'Sara Haddad', title: 'Grants Officer', email: 's.haddad@qcharity.example', phone: '+962 7 9000 1101', primary: false }], notes: 'Quarterly reporting; prior approval for reallocations above 10%.', createdAt: '2025-06-01T09:00:00Z' },
  { id: 'don_hdf', name: 'HDF — Humanitarian Development Foundation', type: 'foundation', country: 'United Kingdom', website: 'www.hdf.example', focus: 'Early childhood development, disability inclusion', contacts: [{ id: 'dc3', name: 'Emma Clarke', title: 'Head of Grants', email: 'e.clarke@hdf.example', phone: '+44 20 7000 0000', primary: true }], createdAt: '2025-11-10T09:00:00Z' },
  { id: 'don_heal', name: 'HEAL Palestine', type: 'ingo', country: 'USA', website: 'www.healpalestine.example', focus: 'Medical evacuation and rehabilitation of Gazan patients', contacts: [{ id: 'dc4', name: 'Dr. Lina Mansour', title: 'Director of Programs', email: 'l.mansour@heal.example', phone: '+1 202 000 0000', primary: true }], createdAt: '2026-03-01T09:00:00Z' },
  { id: 'don_irb', name: 'Irbid Access Grant (bilateral donor)', type: 'bilateral', country: 'Jordan', focus: 'Access to rehabilitation in the north', contacts: [{ id: 'dc5', name: 'Khalil Obeidat', title: 'Grant Focal Point', email: 'k.obeidat@donor.example', phone: '+962 2 700 0000', primary: true }], createdAt: '2025-08-01T09:00:00Z' },
]

const lf = (level: 'goal' | 'outcome' | 'output' | 'activity', code: string, narrative: string, inds: { code: string; type: 'outcome' | 'output'; text: string; target: number; unit?: string; mov?: string }[], assumptions?: string) => ({ id: 'lf_' + code.replace(/\W/g, ''), level, code, narrative, indicators: inds.map((i) => ({ id: 'ind_' + i.code.replace(/\W/g, ''), code: i.code, type: i.type, text: i.text, baseline: 0, target: i.target, unit: i.unit ?? '#', mov: i.mov, definition: '', calculation: '', disaggregation: 'Sex, age, disability', responsible: 'MEAL Officer', method: 'Kobo Toolbox', frequency: 'Monthly' })), mov: inds.map((i) => i.mov).filter(Boolean).join('; '), assumptions })
const irbMonths = monthsOf('2025-10-01', '2026-12-31')
const irbBudget = SEED_BUDGETS.find((b) => b.id === 'bud_irb')!
const wp = (section: string, title: string, budgetLine: string, status: 'planned' | 'ongoing' | 'completed', months: string[], progress = 0) => ({ id: 'wp_' + title.slice(0, 12).replace(/\W/g, ''), section, title, description: '', budgetLine, status, progress: status === 'completed' ? 100 : progress, weeks: Object.fromEntries(months.flatMap((m) => [1, 2, 3, 4].map((w) => [`${m}-W${w}`, status === 'completed' ? 'C' : status === 'ongoing' ? 'O' : 'P']))) as Record<string, 'P' | 'O' | 'C'> })

export const SEED_PROJECTS: Project[] = [
  {
    id: 'prj_irb', code: 'GR-2025-IRB-03', title: 'Irbid Access — prosthetics workshop & outreach', summary: 'Extend the Irbid rehabilitation centre workshop and run outreach fitting camps for amputees in the northern governorates.', donorId: 'don_irb', donorName: 'Irbid Access Grant (bilateral donor)', stage: 'active', outcome: 'funded', currency: 'JOD', startDate: '2025-10-01', endDate: '2026-12-31', duration: '15 Months', locations: 'Irbid, Mafraq', countries: ['Amman (Regional Office)'], sectors: ['Prosthetics & Orthotics', 'Physical rehabilitation'], managerId: 'u_bilal', managerName: 'Bilal Abbassi', teamIds: ['u_hani', 'u_lina', 'u_rana'], partnerIds: ['ptn_nrn'], requestedAmount: 176550, awardedAmount: 176550, budgetId: 'bud_irb',
    proposal: { sections: [{ id: 'ps1', title: 'Background & problem statement', content: 'Northern governorates host a growing number of amputees with no local P&O service; travel to Amman is a barrier for most households.' }, { id: 'ps2', title: 'Objectives & expected results', content: 'Establish a functioning P&O workshop in Irbid and fit 180 beneficiaries over 15 months.' }], attachments: [], submittedTo: 'Irbid Access Grant', reference: 'GR-2025-IRB-03', version: '2025_V1.0' },
    logframe: [
      lf('goal', 'Goal', 'People with limb loss in northern Jordan regain mobility and participate fully in community life.', []),
      lf('outcome', 'Outcome 1', 'Amputees in Irbid and Mafraq access quality prosthetic and rehabilitation services locally.', [{ code: '1.1', type: 'outcome', text: '% of fitted beneficiaries reporting improved functional independence at 3-month follow-up', target: 85, unit: '%', mov: 'Follow-up surveys (Kobo)' }], 'Beneficiaries remain reachable; components clear customs on time.'),
      lf('output', 'Output 1.1', 'Irbid workshop extension operational with two fitting rooms and a gait-training lane.', [{ code: '1.1.1', type: 'output', text: '# of prosthetic devices fitted', target: 180, mov: 'Fitting records' }, { code: '1.1.2', type: 'output', text: '# of outreach fitting camps held', target: 6, mov: 'Camp reports, attendance sheets' }]),
      lf('output', 'Output 1.2', 'Beneficiaries receive physiotherapy before and after fitting.', [{ code: '1.2.1', type: 'output', text: '# of beneficiaries completing a physiotherapy course', target: 180, mov: 'Session attendance records' }]),
    ],
    workplan: [
      wp('SECTION 1: PREPARATORY PHASE', 'Workshop extension civil works', 'BL-08', 'ongoing', irbMonths.slice(0, 6), 60),
      wp('SECTION 1: PREPARATORY PHASE', 'Procurement of prosthetic components', 'BL-02', 'completed', irbMonths.slice(1, 4)),
      wp('SECTION 2: SERVICE DELIVERY', 'Outreach fitting camps (6)', 'BL-09', 'ongoing', irbMonths.slice(4, 14), 33),
      wp('SECTION 2: SERVICE DELIVERY', 'Prosthetic fitting & follow-up', 'BL-02', 'ongoing', irbMonths.slice(5, 15), 40),
      wp('SECTION 3: MEAL & REPORTING', 'Baseline & 3-month follow-up surveys', 'BL-10', 'planned', irbMonths.slice(6, 15)),
      wp('SECTION 3: MEAL & REPORTING', 'Quarterly donor reports', 'BL-10', 'ongoing', irbMonths, 50),
    ],
    spendingPlan: generateSpendingPlan(irbBudget.lines, irbMonths),
    iptt: [{ indicatorId: 'ind_111', period: '2026-03', male: 14, female: 9, other: 0 }, { indicatorId: 'ind_111', period: '2026-04', male: 18, female: 11, other: 0 }, { indicatorId: 'ind_111', period: '2026-05', male: 21, female: 13, other: 0 }, { indicatorId: 'ind_112', period: '2026-04', male: 1, female: 0, other: 0 }, { indicatorId: 'ind_112', period: '2026-06', male: 1, female: 0, other: 0 }, { indicatorId: 'ind_121', period: '2026-04', male: 12, female: 8, other: 0 }, { indicatorId: 'ind_121', period: '2026-05', male: 16, female: 10, other: 0 }],
    ipttGeneratedAt: '2025-09-01T09:00:00Z',
    reports: generateReportingCalendar({ startDate: '2025-10-01', endDate: '2026-12-31' } as Project).map((r, i) => (i < 4 ? { ...r, status: 'submitted' as const, submittedAt: r.dueDate + 'T10:00:00Z', submittedBy: 'u_bilal', submittedByName: 'Bilal Abbassi' } : r)),
    comments: [{ id: 'pc1', authorId: 'u_bilal', authorName: 'Bilal Abbassi', at: ago(3), text: '@Hani please update the civil works progress before the review meeting on Thursday.', mentions: ['u_hani'] }],
    stageHistory: [{ stage: 'development', at: '2025-07-15T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'submitted', at: '2025-08-20T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'granted', at: '2025-09-20T09:00:00Z', byName: 'Bilal Abbassi', note: 'Agreement signed, annex B budget approved' }, { stage: 'active', at: '2025-10-01T09:00:00Z', byName: 'Bilal Abbassi' }],
    submittedAt: '2025-08-20T09:00:00Z', grantedAt: '2025-09-20T09:00:00Z', activatedAt: '2025-10-01T09:00:00Z', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: '2025-07-15T09:00:00Z', updatedAt: ago(3), ownerName: DOC_OWNER,
  },
  {
    id: 'prj_heal', code: 'RH-2026-0032', title: 'Prosthetic and Integrated Rehabilitation Support for Gazan Beneficiaries in Egypt', summary: '86 prosthetic devices fitted for 73 patients evacuated to Egypt, with physiotherapy and MHPSS.', donorId: 'don_heal', donorName: 'HEAL Palestine', stage: 'submitted', currency: 'USD', startDate: '2026-11-01', endDate: '2027-07-31', duration: '9 Months', locations: 'Cairo (Egypt)', countries: ['Egypt', 'Amman (Regional Office)'], sectors: ['Prosthetics & Orthotics', 'Physical rehabilitation', 'MHPSS'], managerId: 'u_bilal', managerName: 'Bilal Abbassi', teamIds: ['u_omar', 'u_lina'], requestedAmount: 412000, budgetId: 'bud_heal',
    proposal: { sections: [{ id: 'ps1', title: 'Background & problem statement', content: 'Gazan amputees evacuated to Egypt lack access to prosthetic fitting and rehabilitation.' }], attachments: [], submittedTo: 'HEAL Palestine', reference: 'RH-2026-0032', version: '2026_V0.1', submissionDeadline: '2026-10-07' },
    logframe: [
      lf('outcome', 'Outcome 1', 'Gazan persons with limb loss in Egypt regain functional mobility.', [{ code: '1.1', type: 'outcome', text: '% of prosthetic recipients reporting improved functional independence', target: 85, unit: '%', mov: '3-month follow-up satisfaction surveys; functional assessments' }], 'Prosthetic components can be procured and clear customs into Egypt.'),
      lf('output', 'Output 1.1', 'New, customized prosthetic devices cast, fabricated, fitted and delivered.', [{ code: '1.1.1', type: 'output', text: '# of prosthetic devices fitted', target: 86, mov: 'Casting, fitting & distribution records (Kobo Toolbox)' }, { code: '1.1.2', type: 'output', text: '# of patients fitted', target: 73, mov: 'Patient files' }], 'Components are delivered on schedule.'),
      lf('output', 'Output 1.2', 'Assistive devices and follow-up/adjustment services provided.', [{ code: '1.2.1', type: 'output', text: '# of beneficiaries provided with assistive devices', target: 73, mov: 'Distribution records' }]),
      lf('outcome', 'Outcome 2', 'Beneficiaries demonstrate improved mobility, functionality and psychosocial wellbeing.', [{ code: '2.1', type: 'outcome', text: '% of beneficiaries completing physiotherapy with an improved functional score', target: 80, unit: '%', mov: 'Pre/post functional assessments' }]),
      lf('output', 'Output 2.1', 'Individualized pre- and post-prosthetic physiotherapy delivered.', [{ code: '2.1.1', type: 'output', text: '# of beneficiaries receiving physiotherapy services', target: 73, mov: 'Session attendance records' }]),
    ],
    workplan: [], spendingPlan: [], iptt: [], ipttGeneratedAt: '2026-10-07T09:00:00Z', reports: [], comments: [],
    stageHistory: [{ stage: 'development', at: '2026-08-10T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'submitted', at: '2026-10-07T09:00:00Z', byName: 'Bilal Abbassi', note: 'Submitted to HEAL Palestine, V0.1' }],
    submittedAt: '2026-10-07T09:00:00Z', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: '2026-08-10T09:00:00Z', updatedAt: ago(1), ownerName: DOC_OWNER,
  },
  {
    id: 'prj_edc', code: 'RH-2026-0009', title: 'Inclusive Early Development Centre — Gaza', summary: 'An integrated early-development centre for 100 children with disabilities in Gaza: rehabilitation, adaptive education, MHPSS and caregiver support.', donorId: 'don_hdf', donorName: 'HDF — Humanitarian Development Foundation', stage: 'development', currency: 'USD', startDate: '2026-04-01', endDate: '2027-03-31', duration: '12 Months', locations: 'Gaza', countries: ['Gaza', 'Amman (Regional Office)'], sectors: ['Inclusive education', 'Physical rehabilitation', 'MHPSS', 'Nutrition'], managerId: 'u_bilal', managerName: 'Bilal Abbassi', teamIds: ['u_omar', 'u_nour'], budgetId: 'bud_edc',
    proposal: { sections: [], attachments: [], submissionDeadline: '2026-11-15' }, logframe: [lf('outcome', 'Outcome 1', 'Children with disabilities in Gaza access integrated early-development services.', [{ code: '1.1', type: 'outcome', text: '# of children enrolled and receiving individualized services', target: 100, mov: 'Enrolment register' }])],
    workplan: [wp('SECTION 1: PREPARATORY PHASE', 'Site preparation and centre construction', 'Prog_1', 'planned', monthsOf('2026-04-01', '2026-06-30')), wp('SECTION 1: PREPARATORY PHASE', 'Staff recruitment (28 positions)', 'HR', 'planned', monthsOf('2026-04-01', '2026-05-31')), wp('SECTION 4: INTEGRATED SERVICE DELIVERY', 'Physical rehabilitation services', 'Prog_5', 'planned', monthsOf('2026-07-01', '2027-03-31'))],
    spendingPlan: [], iptt: [], reports: [], comments: [], stageHistory: [{ stage: 'development', at: ago(20), byName: 'Bilal Abbassi' }], createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: ago(20), updatedAt: ago(2), ownerName: DOC_OWNER,
  },
  {
    id: 'prj_qc', code: 'RH-2025-0006', title: 'Prosthetics & assistive devices for Gaza amputees', summary: 'Prosthetic components, physiotherapy and MHPSS sessions for 640 beneficiaries; assistive devices distribution.', donorId: 'don_qc', donorName: 'Qatar Charity', stage: 'closed', outcome: 'funded', currency: 'USD', startDate: '2025-01-01', endDate: '2025-12-31', duration: '12 Months', locations: 'Gaza, Amman', countries: ['Gaza', 'Amman (Regional Office)'], sectors: ['Prosthetics & Orthotics', 'MHPSS'], managerId: 'u_bilal', managerName: 'Bilal Abbassi', teamIds: ['u_omar'], requestedAmount: 921200, awardedAmount: 921200, budgetId: 'bud_qc',
    proposal: { sections: [], attachments: [], submittedTo: 'Qatar Charity', reference: 'RH-2025-0006' }, logframe: [lf('outcome', 'Outcome 1', 'Beneficiaries regain mobility and psychosocial wellbeing.', [{ code: '1.1', type: 'outcome', text: '% of beneficiaries satisfied with the prosthetic service', target: 90, unit: '%' }, { code: '1.2', type: 'output', text: '# of prosthetic limbs provided', target: 640 }])],
    workplan: [], spendingPlan: [], iptt: [{ indicatorId: 'ind_12', period: '2025-06', male: 220, female: 140, other: 0 }, { indicatorId: 'ind_12', period: '2025-11', male: 170, female: 110, other: 0 }], reports: [], comments: [],
    stageHistory: [{ stage: 'development', at: '2024-10-01T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'submitted', at: '2024-11-14T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'granted', at: '2024-12-20T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'active', at: '2025-01-05T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'closed', at: '2026-02-15T09:00:00Z', byName: 'Bilal Abbassi', note: 'Final report accepted; 640 beneficiaries served.' }],
    submittedAt: '2024-11-14T09:00:00Z', grantedAt: '2024-12-20T09:00:00Z', activatedAt: '2025-01-05T09:00:00Z', closedAt: '2026-02-15T09:00:00Z', closeoutNote: 'Final narrative and financial reports accepted by Qatar Charity.', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: '2024-10-01T09:00:00Z', updatedAt: '2026-02-15T09:00:00Z', ownerName: DOC_OWNER,
  },
]

export const SEED_TASKS: Task[] = [
  { id: 'task_1', title: 'Update civil works progress on the Irbid work plan', description: 'Reflect the contractor\'s August–September progress and attach site photos.', projectId: 'prj_irb', projectCode: 'GR-2025-IRB-03', assigneeId: 'u_hani', assigneeName: 'Hani Odeh', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', dueDate: toInputDate(addDays(new Date(), 3)), priority: 'high', status: 'open', createdAt: ago(3), link: '/grants/prj_irb?tab=workplan' },
  { id: 'task_2', title: 'Enter September IPTT figures (fittings, physiotherapy)', projectId: 'prj_irb', projectCode: 'GR-2025-IRB-03', assigneeId: 'u_lina', assigneeName: 'Lina Haddad', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', dueDate: toInputDate(addDays(new Date(), 5)), priority: 'normal', status: 'in_progress', createdAt: ago(4), link: '/grants/prj_irb?tab=iptt' },
  { id: 'task_3', title: 'Draft budget narrative for the EDC proposal', projectId: 'prj_edc', projectCode: 'RH-2026-0009', assigneeId: 'u_bilal', assigneeName: 'Bilal Abbassi', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', dueDate: toInputDate(addDays(new Date(), 10)), priority: 'normal', status: 'open', createdAt: ago(2), link: '/grants/prj_edc?tab=budget' },
]

const ML = (n: number, accountNo: string, accountName: string, category: string, country: string, holder: [string, string] | null, amount: number, notes?: string) => ({ id: `ml_${String(n).padStart(2, '0')}`, code: `MB-2026-${String(n).padStart(3, '0')}`, accountNo, accountName, category, country, budgetHolderId: holder?.[0], budgetHolderName: holder?.[1], amount, notes, filledAt: '2025-12-10T09:00:00Z' })
// ---------------------------------------------------------------------------
// Partners — register + pre-contract due diligence (from the RHS workbook)
// ---------------------------------------------------------------------------
const sdiDD = emptyDueDiligence()
sdiDD.scoping = { ...sdiDD.scoping, newOrExisting: 'new', anticipatedSectors: 'Health', rhsFocalPoints: "Refa'a Mahmoud · Dua'a Mohammad", anticipatedDonors: 'MOU', anticipatedValue: 'MOU',
  checklist: { ...sdiDD.scoping.checklist, doc_1: 'yes', doc_2: 'yes', doc_3: 'yes', doc_4: 'yes', doc_5: 'yes', doc_6: 'yes', doc_7: 'yes', doc_8: 'yes', doc_9: 'yes', doc_10: 'yes', doc_11: 'yes', doc_12: 'no', doc_13: 'yes', doc_14: 'yes', doc_15: 'yes', doc_16: 'yes', doc_17: 'yes', doc_18: 'yes', doc_19: 'yes', doc_20: 'yes' } }
sdiDD.vetting = { ...sdiDD.vetting, staffResponsible: "Mohammad Issa, Dua'a Mohammad", level: 'full',
  keyPersonnel: [
    { id: 'kp_1', name: 'Mohammed Saadi Sukkaria', title: 'Chairman', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_2', name: 'Hussam Zaghloul', title: 'Chairman Assistant', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_3', name: 'Salah Eddin Kouki', title: 'Board Secretary', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_4', name: 'Mohamad Yasin Alajloni', title: 'Treasurer', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_5', name: 'Ahmad Obid', title: 'Member', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_6', name: 'Ahmad Alajlouni', title: 'CEO', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_7', name: 'Moneer Marai', title: 'Finance Manager', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_8', name: 'Bilal Bani Almarjeh', title: 'Health & Nutrition Programs Coordinator', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
    { id: 'kp_9', name: 'Mhd Wasim Ghazal', title: 'Partnerships Coordinator', countryOfBirth: 'Syria', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'pending', atcIssues: '' },
  ],
  audit: { done: 'yes', checkedBy: 'Shatha Homsi', firm: '', date: '', issues: '' } }

const nrnDD = emptyDueDiligence()
nrnDD.scoping = { ...nrnDD.scoping, newOrExisting: 'existing', completionDate: '2025-08-20', partnerSectors: 'Physical rehabilitation, community outreach', anticipatedSectors: 'Prosthetics & Orthotics outreach', partnerReach: 'Irbid, Mafraq, Ajloun', anticipatedScope: 'Northern governorates', rhsFocalPoints: 'Bilal Abbassi · Hani Odeh', anticipatedDonors: 'Irbid Access Grant', anticipatedValue: 'JOD 45,000', checklist: Object.fromEntries(Object.keys(nrnDD.scoping.checklist).map((k) => [k, 'yes'])) }
nrnDD.vetting = { ...nrnDD.vetting, staffResponsible: 'Dana Qasem, Legal Counsel', level: 'full', keyPersonnel: [{ id: 'kp_n1', name: 'Samar Khasawneh', title: 'Executive Director', countryOfBirth: 'Jordan', dob: '', gender: 'Female', verification: 'ATC', atcClear: 'clear', atcIssues: '' }, { id: 'kp_n2', name: 'Tareq Bataineh', title: 'Finance Officer', countryOfBirth: 'Jordan', dob: '', gender: 'Male', verification: 'ATC', atcClear: 'clear', atcIssues: '' }],
  atc: { org: { done: 'yes', checkedBy: 'Dana Qasem', date: '2025-08-12', issues: 'None' }, staff: { done: 'yes', checkedBy: 'Dana Qasem', date: '2025-08-12', issues: 'None' } },
  online: nrnDD.vetting.online.map((o) => ({ ...o, checkedBy: 'Dana Qasem', date: '2025-08-14', issues: 'None found' })),
  audit: { done: 'yes', checkedBy: 'Shatha Homsi', firm: 'Al-Nimer & Co.', date: '2025-08-15', issues: 'Unqualified opinion 2023 and 2024' },
  analysis: nrnDD.vetting.analysis.map((a) => ({ ...a, answer: a.key === 'vq_1' ? 'yes' : 'no', basis: a.key === 'vq_1' ? 'MoSD registration certificate no. 1180/2016' : 'Internet search, ATC and references — nothing found' })),
  completedAt: '2025-08-18T10:00:00Z', completedBy: 'u_dana', completedByName: 'Dana Qasem' }
nrnDD.pca = { visitDate: '2025-08-25', assessors: 'Bilal Abbassi, Shatha Homsi, Yousef Nasser', completedAt: '2025-08-28T12:00:00Z', answers: Object.fromEntries([
  ['safe_1', 3], ['safe_2', 3], ['safe_3', 2], ['safe_4', 3], ['safe_5', 2], ['safe_6', 3], ['safe_7', 3], ['safe_8', 2], ['safe_9', 2], ['safe_10', 2], ['safe_11', 2], ['safe_12', 1], ['safe_13', 3], ['safe_14', 2], ['safe_15', 2], ['safe_16', 'na'], ['safe_17', 3], ['safe_18', 3], ['safe_19', 2], ['safe_20', 2], ['safe_21', 2], ['safe_22', 2],
  ['quality_1', 2], ['quality_2', 3], ['quality_3', 2], ['quality_4', 2], ['quality_5', 3], ['quality_6', 3], ['quality_7', 2], ['quality_8', 3], ['quality_9', 3], ['quality_10', 2], ['quality_11', 2], ['quality_12', 2], ['quality_13', 3], ['quality_14', 2], ['quality_15', 2], ['quality_16', 2], ['quality_17', 2],
  ['meal_1', 2], ['meal_2', 2], ['meal_3', 2], ['meal_4', 1], ['meal_5', 3], ['meal_6', 2], ['meal_7', 1], ['meal_8', 2],
  ['grants_1', 2], ['grants_2', 3], ['grants_3', 3], ['grants_4', 2], ['grants_5', 2], ['grants_6', 2],
  ['finance_1', 3], ['finance_2', 3], ['finance_3', 'na'], ['finance_4', 3], ['finance_5', 2], ['finance_6', 2], ['finance_7', 3], ['finance_8', 2], ['finance_9', 3], ['finance_10', 3], ['finance_11', 3], ['finance_12', 3], ['finance_13', 3], ['finance_14', 2], ['finance_15', 3], ['finance_16', 3], ['finance_17', 3],
  ['hr_1', 3], ['hr_2', 2], ['hr_3', 2], ['hr_4', 3], ['hr_5', 3], ['hr_6', 2], ['hr_7', 2],
  ['supply_1', 2], ['supply_2', 2], ['supply_3', 2], ['supply_4', 3], ['supply_5', 1], ['supply_6', 3], ['supply_7', 2], ['supply_8', 2], ['supply_9', 2], ['supply_10', 3], ['supply_11', 2], ['supply_12', 2], ['supply_13', 2], ['supply_14', 2], ['supply_15', 3], ['supply_16', 3], ['supply_17', 2], ['supply_18', 2], ['supply_19', 'na'], ['supply_20', 'na'], ['supply_21', 'na'], ['supply_22', 2], ['supply_23', 2], ['supply_24', 2], ['supply_25', 2], ['supply_26', 2], ['supply_27', 2], ['supply_28', 2], ['supply_29', 3],
  ['subaward_1', 'na'], ['subaward_2', 'na'], ['subaward_3', 'na'], ['subaward_4', 'na'],
].map(([k, v]) => [k, { score: v as 1 | 2 | 3 | 'na', notes: '', actions: '' }])) }
nrnDD.risks = [
  { id: 'rk_n1', group: 'vetting', description: 'MEAL quality checks are informal — risk of weak outreach data for donor reporting', likelihood: 3, impact: 3, mitigation: 'RHS MEAL officer joins monthly data review; joint Kobo forms; quality-check SOP by month 3', owner: 'Lina Haddad' },
  { id: 'rk_n2', group: 'vetting', description: 'No procurement plan — risk of late camp supplies', likelihood: 2, impact: 3, mitigation: 'Camps supplied through RHS procurement under the Irbid grant', owner: 'Yousef Nasser' },
  { id: 'rk_n3', group: 'contextual', description: 'Seasonal access to Mafraq villages during winter', likelihood: 3, impact: 2, mitigation: 'Camp calendar front-loaded to Oct–Nov and Mar–May', owner: 'Hani Odeh' },
  { id: 'rk_n4', group: 'rhs', description: 'RHS technical supervision capacity for outreach camps while the workshop is under construction', likelihood: 2, impact: 2, mitigation: 'P&O technician rota agreed; second technician from Amman on call', owner: 'Bilal Abbassi' },
]
nrnDD.decision = { outcome: 'approved_conditions', conditions: 'Sub-award limited to outreach camps; MEAL SOP and procurement plan in place before the second tranche.', decidedBy: 'u_fawaz', decidedByName: 'Fawaz Mahmoud', decidedAt: '2025-09-02T09:30:00Z' }

// ---------------------------------------------------------------------------
// Staff — master salary plan (RHS numbers). Salaries are illustrative.
// ---------------------------------------------------------------------------
const ST = (n: number, name: string, position: string, department: string, country: string, monthlySalary: number, startDate: string, extra: Partial<StaffMember> = {}): StaffMember => ({
  id: `stf_${n}`, rhsNumber: `RHS-${String(n).padStart(4, '0')}`, name, position, department, country, contractType: 'full_time', monthlySalary, currency: 'JOD', startDate, status: 'active', createdAt: '2025-01-05T09:00:00Z', updatedAt: '2025-01-05T09:00:00Z', ...extra,
})
export const SEED_STAFF: StaffMember[] = [
  ST(1, 'Fawaz Al Shakaa', 'Executive Director', 'Executive Office', 'Amman (Regional Office)', 5000, '2018-01-01', { userId: 'u_fawaz' }),
  ST(2, 'Bilal Abbassi', 'Director of Programs', 'Programs', 'Amman (Regional Office)', 4000, '2019-03-01', { userId: 'u_bilal', lineManagerId: 'stf_1', contractRef: 'HR-C-2019-004' }),
  ST(3, 'Shatha Homsi', 'Director of Finance & Support', 'Finance', 'Amman (Regional Office)', 4000, '2019-06-01', { userId: 'u_shatha', lineManagerId: 'stf_1' }),
  ST(4, 'Rana Suleiman', 'Finance Manager', 'Finance', 'Amman (Regional Office)', 2200, '2021-02-01', { userId: 'u_rana', lineManagerId: 'stf_3' }),
  ST(5, 'Yousef Nasser', 'Procurement Officer', 'Procurement', 'Amman (Regional Office)', 1500, '2022-04-01', { userId: 'u_yousef', lineManagerId: 'stf_6' }),
  ST(6, 'Maha Al-Rawi', 'Procurement & Logistics Manager', 'Procurement', 'Amman (Regional Office)', 1700, '2020-09-01', { userId: 'u_maha', lineManagerId: 'stf_3' }),
  ST(7, 'Hani Odeh', 'Operations Manager', 'Operations', 'Amman (Regional Office)', 1900, '2020-01-15', { userId: 'u_hani', lineManagerId: 'stf_2' }),
  ST(8, 'Lina Haddad', 'MEAL Officer', 'Programs', 'Amman (Regional Office)', 1300, '2023-01-01', { userId: 'u_lina', lineManagerId: 'stf_2', endDate: '2026-12-31', contractRef: 'HR-C-2023-002' }),
  ST(9, 'Omar Khalil', 'Medical Programs Manager', 'Medical Programs', 'Gaza', 2000, '2021-05-01', { userId: 'u_omar', lineManagerId: 'stf_2' }),
  ST(10, 'Nour Saleh', 'Field Services Coordinator', 'Field Services', 'Amman (Regional Office)', 1200, '2024-02-01', { userId: 'u_nour', lineManagerId: 'stf_7', endDate: '2026-11-15', contractRef: 'HR-C-2024-001' }),
  ST(11, 'Khalid Mansour', 'Logistics / Warehouse Officer', 'Logistics', 'Amman (Regional Office)', 1100, '2022-08-01', { userId: 'u_khalid', lineManagerId: 'stf_6' }),
  ST(12, 'Samer Al-Zoubi', 'P&O Technician — Irbid', 'Field Services', 'Amman (Regional Office)', 1150, '2025-10-01', { sourceProjectId: 'prj_irb', sourceProjectCode: 'GR-2025-IRB-03', sourceLineCode: 'BL-10', notes: 'Recruited for the Irbid workshop', lineManagerId: 'stf_7', endDate: '2026-12-31' }),
  ST(13, 'Rawan Khasawneh', 'Outreach Officer — Irbid', 'Field Services', 'Amman (Regional Office)', 950, '2025-10-01', { sourceProjectId: 'prj_irb', sourceProjectCode: 'GR-2025-IRB-03', sourceLineCode: 'BL-10', lineManagerId: 'stf_7', endDate: '2026-12-31' }),
  ST(14, 'Reem Nasser', 'HR & Admin Officer', 'HR & Admin', 'Amman (Regional Office)', 1400, '2022-03-01', { userId: 'u_reem', lineManagerId: 'stf_3' }),
]

// ---------------------------------------------------------------------------
// HR & Admin — leave / WFH requests, timesheets, payslips, attendance
// ---------------------------------------------------------------------------
const ym = (offset = 0) => { const x = new Date(); x.setMonth(x.getMonth() + offset); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const Y = new Date().getFullYear()
export const SEED_LEAVE: LeaveRequest[] = [
  { id: 'lr_1', number: `LR-${Y}-0001`, staffId: 'stf_8', staffName: 'Lina Haddad', type: 'annual', startDate: `${Y}-03-09`, endDate: `${Y}-03-11`, days: 3, reason: 'Family travel', status: 'approved', submittedAt: `${Y}-02-20T09:00:00Z`, decidedBy: 'u_bilal', decidedByName: 'Bilal Abbassi', decidedAt: `${Y}-02-21T10:00:00Z` },
  { id: 'lr_2', number: `WFH-${Y}-0001`, staffId: 'stf_8', staffName: 'Lina Haddad', type: 'wfh', startDate: `${Y}-05-04`, endDate: `${Y}-05-05`, days: 2, reason: 'Report writing', status: 'approved', submittedAt: `${Y}-04-28T09:00:00Z`, decidedBy: 'u_bilal', decidedByName: 'Bilal Abbassi', decidedAt: `${Y}-04-28T12:00:00Z` },
  { id: 'lr_3', number: `LR-${Y}-0002`, staffId: 'stf_9', staffName: 'Omar Khalil', type: 'annual', startDate: toInputDate(addDays(new Date(), 12)), endDate: toInputDate(addDays(new Date(), 16)), days: 4, reason: 'Eid family visit', status: 'pending', submittedAt: ago(1) },
  { id: 'lr_4', number: `WFH-${Y}-0002`, staffId: 'stf_10', staffName: 'Nour Saleh', type: 'wfh', startDate: toInputDate(addDays(new Date(), 3)), endDate: toInputDate(addDays(new Date(), 3)), days: 1, reason: 'Home internet installation', status: 'pending', submittedAt: ago(0) },
  { id: 'lr_5', number: `LR-${Y}-0003`, staffId: 'stf_4', staffName: 'Rana Suleiman', type: 'sick', startDate: `${Y}-06-15`, endDate: `${Y}-06-16`, days: 2, reason: 'Medical certificate attached', status: 'approved', submittedAt: `${Y}-06-15T07:30:00Z`, decidedBy: 'u_shatha', decidedByName: 'Shatha Homsi', decidedAt: `${Y}-06-15T09:00:00Z` },
]
export const SEED_TIMESHEETS: Timesheet[] = [
  { id: 'ts_1', staffId: 'stf_8', period: ym(-1), workingDays: 22, leaveDays: 0, lines: [{ id: 'tl_1', projectId: 'prj_irb', projectCode: 'GR-2025-IRB-03', description: 'MEAL — outreach data review', days: 18 }, { id: 'tl_2', projectCode: 'CORE', description: 'Core / unrestricted', days: 4 }], status: 'submitted', createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: ago(3), updatedAt: ago(3), submittedAt: ago(3) },
  { id: 'ts_2', staffId: 'stf_12', period: ym(-1), workingDays: 22, leaveDays: 0, lines: [{ id: 'tl_3', projectId: 'prj_irb', projectCode: 'GR-2025-IRB-03', description: 'BL-10 · P&O technician', days: 22 }], status: 'approved', createdBy: 'u_hani', createdByName: 'Hani Odeh', createdAt: ago(5), updatedAt: ago(2), submittedAt: ago(5), acknowledgedAt: ago(4), approvedBy: 'u_reem', approvedByName: 'Reem Nasser', approvedAt: ago(2) },
]
export const SEED_PAYSLIPS: Payslip[] = ['stf_2', 'stf_8', 'stf_10'].map((id, i) => { const gross = { stf_2: 4000, stf_8: 1300, stf_10: 1200 }[id]!; const ss = Math.round(gross * 7.5) / 100; return { id: `ps_${i + 1}`, number: `PS-${ym(-1)}-${String(i + 1).padStart(3, '0')}`, staffId: id, period: ym(-1), currency: 'JOD' as const, gross, allowances: 0, socialSecurity: ss, tax: 0, unpaidDeduction: 0, otherDeductions: 0, net: gross - ss, workingDays: 22, leaveDays: 0, unpaidDays: 0, paidAt: ago(2), generatedBy: 'u_shatha', generatedByName: 'Shatha Homsi' } })
export const SEED_ATTENDANCE: AttendanceRecord[] = [
  { id: 'at_1', staffId: 'stf_4', date: toInputDate(new Date()), mode: 'office', checkInAt: new Date(new Date().setHours(8, 12, 0, 0)).toISOString(), lat: 31.9539, lng: 35.9106, accuracy: 25, locationStatus: 'captured' },
  { id: 'at_2', staffId: 'stf_14', date: toInputDate(new Date()), mode: 'office', checkInAt: new Date(new Date().setHours(8, 31, 0, 0)).toISOString(), lat: 31.9541, lng: 35.9102, accuracy: 18, locationStatus: 'captured' },
  { id: 'at_3', staffId: 'stf_8', date: toInputDate(addDays(new Date(), -1)), mode: 'office', checkInAt: new Date(addDays(new Date(), -1).setHours(8, 5, 0, 0)).toISOString(), checkOutAt: new Date(addDays(new Date(), -1).setHours(16, 40, 0, 0)).toISOString(), lat: 31.9538, lng: 35.9109, accuracy: 30, locationStatus: 'captured' },
]

export const SEED_PARTNERS: Partner[] = [
  {
    id: 'ptn_sdi', code: 'PT-2026-0002', name: 'Sustainable Development and Innovation Organization', acronym: 'SDI', type: 'local_ngo', country: 'Syria',
    address: 'Damascus city, Eastern Villas Neighborhood, Al Farabi Street, underground floor, real estate No. 2/4187. Cadastral area: Damascus, Mazzeh, Farabi', website: 'https://sdi.ngo/',
    focalName: 'Ahmad Al Ajlouni', focalTitle: 'CEO', focalEmail: 'ceo@sdi.ngo', focalPhone: '+963 986 77 22 11', sectors: ['Health'],
    stage: 'due_diligence', stageHistory: [{ stage: 'identified', at: ago(20), byName: 'Bilal Abbassi' }, { stage: 'due_diligence', at: ago(12), byName: 'Bilal Abbassi', note: 'Scoping started — document checklist received' }],
    dueDiligence: sdiDD, notes: 'Health partnership in Syria under an MoU; vetting shared with the partner for key-personnel confirmation.', ownerName: DOC_OWNER,
    createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: ago(20), updatedAt: ago(1),
  },
  {
    id: 'ptn_nrn', code: 'PT-2025-0001', name: 'Northern Rehabilitation Network', acronym: 'NRN', type: 'cbo', country: 'Amman (Regional Office)',
    address: 'Irbid, Al-Hashemi Street, Building 14', website: '', focalName: 'Samar Khasawneh', focalTitle: 'Executive Director', focalEmail: 's.khasawneh@nrn.example', focalPhone: '+962 2 7200 000', sectors: ['Physical rehabilitation', 'Community outreach'],
    stage: 'active', stageHistory: [{ stage: 'identified', at: '2025-07-30T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'due_diligence', at: '2025-08-05T09:00:00Z', byName: 'Bilal Abbassi' }, { stage: 'approved', at: '2025-09-02T09:30:00Z', byName: 'Fawaz Mahmoud', note: 'Approved with conditions' }, { stage: 'agreement', at: '2025-09-10T09:00:00Z', byName: 'Dana Qasem', note: 'Sub-award agreement drafted' }, { stage: 'active', at: '2025-10-01T09:00:00Z', byName: 'Bilal Abbassi', note: 'Agreement signed — outreach camps start' }],
    dueDiligence: nrnDD, agreement: { type: 'subaward', reference: 'SA-2025-001', startDate: '2025-10-01', endDate: '2026-12-31', value: 45000, currency: 'JOD', notes: 'Outreach fitting camps under GR-2025-IRB-03' },
    notes: '', ownerName: DOC_OWNER, createdBy: 'u_bilal', createdByName: 'Bilal Abbassi', createdAt: '2025-07-30T09:00:00Z', updatedAt: '2025-10-01T09:00:00Z',
  },
]

export const SEED_MASTER: MasterBudget[] = [
  { id: 'mb_2026', year: 2026, currency: 'USD', status: 'approved', createdBy: 'u_shatha', createdByName: 'Shatha Homsi', createdAt: '2025-11-20T09:00:00Z', approvedBy: 'u_shatha', approvedByName: 'Shatha Homsi', approvedAt: '2025-12-18T09:00:00Z', ownerName: DOC_OWNER, notes: 'Annual running costs of the organisation — reference for all project budgets.',
    lines: [
      ML(1, '2603', 'Executive Director', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_fawaz', 'Fawaz Al Shakaa'], 60000),
      ML(2, '2603', 'Program Director', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_bilal', 'Bilal Abbassi'], 48000),
      ML(3, '2603', 'Finance & Support Function Director', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 48000),
      ML(4, '2603', 'Grants & Compliance Officer', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_bilal', 'Bilal Abbassi'], 24000),
      ML(5, '2603', 'Supply Chain / Logistics Officer', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_maha', 'Maha Al-Rawi'], 20400),
      ML(6, '2603', 'HR & Admin Officer', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 18000),
      ML(7, '2603', 'Communications Team Leader + content', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_bilal', 'Bilal Abbassi'], 30000),
      ML(8, '2603', 'M&E / Reporting Officer (HQ oversight)', 'Personnel — Amman support', 'Amman (Regional Office)', ['u_bilal', 'Bilal Abbassi'], 21600),
      ML(9, '2601', 'Field programme staff — Gaza', 'Personnel — field', 'Gaza', ['u_omar', 'Omar Khalil'], 96000, 'Rehabilitation, MHPSS and P&O field teams'),
      ML(10, '2604', 'Support field staff — Gaza (guards, cleaners, logistics)', 'Personnel — field', 'Gaza', ['u_hani', 'Hani Odeh'], 28800),
      ML(11, '2619', 'Office running costs — Amman (rent, utilities, IT, comms)', 'Office, IT & operations', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 54000),
      ML(12, '2624', 'Insurance, social security & statutory (Amman)', 'Office, IT & operations', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 42000),
      ML(13, '2619', 'Centre rent — Gaza', 'Office, IT & operations', 'Gaza', ['u_hani', 'Hani Odeh'], 36000),
      ML(14, '2622', 'Audit, legal & compliance fees', 'Statutory, compliance & risk', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 18000),
      ML(15, '2623', 'Bank charges & transfers', 'Statutory, compliance & risk', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 11000),
      ML(16, '2615', 'Staff training & professional development', 'Programme support', 'Amman (Regional Office)', ['u_bilal', 'Bilal Abbassi'], 7500),
      ML(17, '2607', 'Vehicles, fuel & transport — regional office', 'Office, IT & operations', 'Amman (Regional Office)', ['u_hani', 'Hani Odeh'], 15000),
      ML(18, '2628', 'Contingency & reserve', 'Other', 'Amman (Regional Office)', ['u_shatha', 'Shatha Homsi'], 20000),
    ] },
]

export const SEED_GRNS: GoodsReceipt[] = [
  {
    id: 'grn_1', number: 'GRN-2025-0009', poId: 'po_1', poNumber: 'PO-2025-0017', vendorName: 'Amman Fleet & Logistics',
    receivedBy: 'u_hani', receivedByName: 'Hani Odeh', receivedAt: ago(3), deliveryNoteRef: 'AFL-SVC-0925', location: 'RHS Operations Yard, Amman',
    notes: 'Month 1 servicing of 3 MASU vans completed; job cards attached.', lines: [{ lineItemId: 'l1', quantity: 1, condition: 'good' }], attachments: [], createdAt: ago(3),
  },
]

export const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv_1', number: 'INV-2025-0012', vendorInvoiceNo: 'AFL/2025/1187', poId: 'po_1', poNumber: 'PO-2025-0017', vendorId: 'v_6', vendorName: 'Amman Fleet & Logistics',
    ownerName: DOC_OWNER, registeredBy: 'u_yousef', registeredByName: 'Yousef Nasser', invoiceDate: toInputDate(addDays(new Date(), -2)), dueDate: toInputDate(addDays(new Date(), 28)),
    currency: 'JOD', lines: [{ lineItemId: 'l1', description: 'Fleet maintenance & servicing — month 1', quantity: 1, unitPrice: 640 }], taxRate: 16,
    status: 'pending_approval', matchIssues: [],
    approvalChain: [{ id: 's1', order: 1, label: 'Finance — Invoice Approval', role: 'finance', approverId: 'u_rana', status: 'current' }],
    attachments: [], createdAt: ago(2), updatedAt: ago(2), comments: [],
  },
]

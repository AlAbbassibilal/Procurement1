import type { ApprovalRule, Contract, OrgSettings, PurchaseOrder, PurchaseRequisition, User, Vendor, ContractClause, GoodsReceipt, Invoice, ProcurementTier, ProjectBudget } from '@/types'
import { emptySourcing } from '@/lib/tiers'
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
  templates: {},
  priceTolerancePct: 2,
  paymentTermsDays: 30,
  fiscalYearStart: '01-01',
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
  {
    id: 'bud_core', donorCode: 'CORE-2026', name: 'Core operating budget 2026', donor: 'RHS unrestricted funds', currency: 'JOD', startDate: '2026-01-01', endDate: '2026-12-31', approvedAt: '2025-12-15', status: 'active',
    lines: [
      { id: 'bl_c1', code: 'BL-01', description: 'Program Delivery', category: 'Programs', amount: 120000 },
      { id: 'bl_c2', code: 'BL-02', description: 'Medical Supplies', category: 'Programs', amount: 85000 },
      { id: 'bl_c3', code: 'BL-03', description: 'Capital Equipment', category: 'Capital', amount: 40000 },
      { id: 'bl_c4', code: 'BL-04', description: 'Admin & Overheads', category: 'Support', amount: 32000 },
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
      { id: 'bl_i4', code: 'BL-10', description: 'Project staff', category: 'HR', amount: 38000 },
      { id: 'bl_i5', code: 'BL-11', description: 'Indirect costs (7%)', category: 'Support', amount: 11550 },
    ],
    uploadedBy: 'u_shatha', uploadedByName: 'Shatha Homsi', uploadedAt: '2025-09-22T09:00:00Z', ownerName: DOC_OWNER, notes: 'Approved donor budget, annex B of the grant agreement.',
  },
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

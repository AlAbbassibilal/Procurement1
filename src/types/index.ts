// ---------------------------------------------------------------------------
// Domain model — Procurement Suite (RHS)
// Flow: PR → PR approvals → Sourcing (3 quotations) → PO → PO approvals → Contract
// ---------------------------------------------------------------------------

export type Role =
  | 'requester'
  | 'dept_manager'          // Department Head / Line Manager / Budget Holder
  | 'finance'               // Finance Manager / Finance Officer
  | 'finance_director'      // Director of Finance and Support
  | 'procurement_officer'
  | 'procurement_manager'
  | 'programs_director'     // Director of Programs
  | 'executive_director'
  | 'legal'
  | 'logistics'             // Logistics / Warehouse Officer / Storekeeper
  | 'admin'

export interface User {
  id: string
  name: string
  email: string
  password: string // demo-only; replace with real auth
  role: Role
  approverRoles?: Role[]   // additional approval capacities this user holds (e.g. admin acting as Director of Programs)
  department: string
  title: string
  avatarColor: string
  active: boolean
}

// ---------------------------------------------------------------------------
// Procurement thresholds & methods — RHS Procurement SOPs §3
// ---------------------------------------------------------------------------
export type SourcingMethod =
  | 'direct'        // Petty cash / direct purchase — no formal quotation
  | 'rfq'           // Tier 1 — minimum 3 written quotations
  | 'rfq_formal'    // Tier 2 — RFQ with formal bid comparison table
  | 'closed_bid'    // Tier 3 — RFP / ITB issued to a shortlist (min 5 suppliers), evaluation committee
  | 'open_bid'      // Tier 4 — publicly advertised international competitive tender (ICB)

export interface ProcurementTier {
  id: string
  name: string
  minUSD: number
  maxUSD: number | null
  method: SourcingMethod
  minQuotations: number          // minimum quotations / bids to be received
  invitedSuppliersMin: number    // minimum suppliers the RFQ / RFP is issued to
  deadlineWorkingDays: number    // minimum submission period (0 = none)
  committeeMin: number           // evaluation committee size (0 = no committee)
  donorApproval: boolean         // donor approval required before PO
  approvers: { role: Role; label: string }[]   // approval authority for the PO / award
}

export type ExceptionType = 'emergency' | 'sole_source' | 'proprietary' | 'donor_restriction'

export interface CommitteeMember {
  userId: string
  name: string
  role: 'chair' | 'technical' | 'member'
  ndaSigned: boolean
  coiDeclared: boolean
}

/** Everything Procurement records while running the sourcing method for a requisition. */
export interface SourcingRecord {
  exception?: {
    type: ExceptionType
    justification: string
    requestedBy: string
    requestedByName: string
    requestedAt: string
    approvedBy?: string
    approvedByName?: string
    approvedAt?: string
    decision?: 'approved' | 'rejected'
    comment?: string
  }
  issuedAt?: string              // RFQ / tender issue date
  deadline?: string              // quotation / bid submission deadline
  invitedVendorIds: string[]
  advertisementRef?: string      // open bid: where it was advertised
  openedAt?: string
  openingWitnessId?: string
  committee: CommitteeMember[]
  technicalPassMark: number      // bids scoring below are disqualified from financial evaluation
  evaluationReport?: string
  evaluationSignedAt?: string
  fewerQuotesReason?: string
  fewerQuotesApprovedBy?: string
  fewerQuotesApprovedByName?: string
  fewerQuotesApprovedAt?: string
  donorApprovalRef?: string
  donorNotifiedAt?: string
}

export type DocType = 'PR' | 'PO' | 'CONTRACT' | 'INVOICE' | 'GRN'

export type PRStatus =
  | 'draft'
  | 'pending_approval'
  | 'returned'
  | 'rejected'
  | 'approved'          // approvals done → available to procurement
  | 'sourcing'          // procurement gathering quotations
  | 'awarded'           // quotation selected, PO can be raised
  | 'ordered'           // PO issued
  | 'closed'
  | 'cancelled'

export type POStatus =
  | 'draft'
  | 'pending_approval'
  | 'returned'
  | 'rejected'
  | 'approved'
  | 'issued'            // sent to vendor
  | 'contracted'
  | 'partially_received'
  | 'received'          // all lines received in full
  | 'closed'            // received, invoiced and paid
  | 'cancelled'

export type ContractStatus =
  | 'drafting'
  | 'legal_review'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'terminated'

export type Currency = 'JOD' | 'USD' | 'EUR'

export interface LineItem {
  id: string
  description: string
  category: string
  quantity: number
  unit: string
  unitPrice: number      // estimated on PR, actual on PO
  costCenter: string
  budgetLine: string
}

export interface Attachment {
  id: string
  name: string
  size: number
  type: string
  uploadedBy: string
  uploadedAt: string
  dataUrl?: string      // demo-only in-memory storage
}

export type ApprovalDecision = 'approved' | 'rejected' | 'returned' | 'delegated'

export interface ApprovalStep {
  id: string
  order: number
  label: string           // e.g. "Department Manager"
  role: Role
  approverId?: string     // resolved specific approver (optional)
  status: 'pending' | 'current' | 'approved' | 'rejected' | 'returned' | 'skipped'
  decidedBy?: string
  decidedAt?: string
  comment?: string
  delegatedTo?: string
}

export interface ApprovalRule {
  id: string
  name: string
  docType: DocType
  minAmount: number
  maxAmount: number | null   // null = no upper bound
  steps: { role: Role; label: string }[]
}

export interface AuditEvent {
  id: string
  at: string
  actorId: string
  actorName: string
  docType: DocType | 'SYSTEM' | 'VENDOR' | 'USER'
  docId?: string
  docNumber?: string
  action: string
  detail?: string
}

export interface Vendor {
  id: string
  name: string
  code: string
  category: string
  contactName: string
  email: string
  phone: string
  country: string
  taxId: string
  rating: number         // 1-5
  status: 'active' | 'blocked' | 'pending'
  registeredAt: string
}

export interface Quotation {
  id: string
  vendorId: string
  vendorName: string
  reference: string
  receivedAt: string
  validUntil: string
  currency: Currency
  subtotal: number
  taxRate: number
  deliveryDays: number
  paymentTerms: string
  warranty: string
  notes: string
  attachments: Attachment[]
  lines: { lineItemId: string; unitPrice: number }[]
  compliant: boolean
  technicalScore?: number   // 0-100, evaluation committee (bid methods)
  late?: boolean            // received after the deadline → must be rejected
  score?: number
}

export interface PurchaseRequisition {
  id: string
  number: string
  title: string
  justification: string
  department: string
  requesterId: string
  requesterName: string
  ownerName: string        // document owner (Bilal Abbassi)
  priority: 'low' | 'normal' | 'high' | 'urgent'
  procurementType: 'goods' | 'services' | 'works'
  donorCode?: string
  neededBy: string
  currency: Currency
  lines: LineItem[]
  attachments: Attachment[]
  status: PRStatus
  approvalChain: ApprovalStep[]
  createdAt: string
  updatedAt: string
  submittedAt?: string
  approvedAt?: string
  // sourcing
  quotations: Quotation[]
  awardedQuotationId?: string
  awardJustification?: string
  sourcingOwnerId?: string
  sourcing: SourcingRecord
  poId?: string
  comments: Comment[]
}

export interface Comment {
  id: string
  authorId: string
  authorName: string
  at: string
  text: string
}

export interface PurchaseOrder {
  id: string
  number: string
  prId: string
  prNumber: string
  title: string
  vendorId: string
  vendorName: string
  quotationId: string
  ownerName: string
  createdBy: string
  createdByName: string
  currency: Currency
  lines: LineItem[]
  taxRate: number
  deliveryAddress: string
  deliveryDate: string
  paymentTerms: string
  incoterms: string
  notes: string
  status: POStatus
  approvalChain: ApprovalStep[]
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
  issuedAt?: string
  contractId?: string
  comments: Comment[]
}

export interface ContractClause {
  id: string
  title: string
  body: string
  mandatory: boolean
}

export interface ContractMilestone {
  id: string
  title: string
  dueDate: string
  amount: number
  status: 'pending' | 'completed' | 'invoiced' | 'paid'
}

export interface Contract {
  id: string
  number: string
  poId: string
  poNumber: string
  prNumber: string
  title: string
  vendorId: string
  vendorName: string
  ownerName: string
  draftedBy: string
  draftedByName: string
  type: 'supply' | 'service' | 'framework' | 'works'
  startDate: string
  endDate: string
  value: number
  currency: Currency
  clauses: ContractClause[]
  milestones: ContractMilestone[]
  attachments: Attachment[]
  status: ContractStatus
  legalReviewer?: string
  legalNotes?: string
  signatories: { name: string; title: string; party: 'RHS' | 'Vendor'; signedAt?: string }[]
  createdAt: string
  updatedAt: string
  comments: Comment[]
}

// ---------------------------------------------------------------------------
// Procure-to-pay: goods receipt, invoices, payments
// ---------------------------------------------------------------------------
export interface GoodsReceiptLine {
  lineItemId: string
  quantity: number            // received in this GRN
  condition: 'good' | 'damaged' | 'partial'
  notes?: string
}

export interface GoodsReceipt {
  id: string
  number: string
  poId: string
  poNumber: string
  vendorName: string
  receivedBy: string
  receivedByName: string
  receivedAt: string
  deliveryNoteRef: string
  location: string
  notes: string
  lines: GoodsReceiptLine[]
  attachments: Attachment[]
  createdAt: string
}

export type InvoiceStatus =
  | 'registered'        // captured, not yet matched
  | 'matched'           // 3-way match passed, ready for approval
  | 'exception'         // variances found, needs resolution / override
  | 'pending_approval'
  | 'returned'
  | 'rejected'
  | 'approved'          // ready for payment
  | 'paid'

export interface InvoiceLine {
  lineItemId: string
  description: string
  quantity: number
  unitPrice: number
}

export interface MatchIssue {
  lineItemId?: string
  kind: 'qty_over_received' | 'qty_over_ordered' | 'price_variance' | 'total_over_po' | 'no_receipt' | 'duplicate_invoice'
  message: string
  severity: 'block' | 'warn'
}

export interface Invoice {
  id: string
  number: string              // internal INV-YYYY-NNNN
  vendorInvoiceNo: string
  poId: string
  poNumber: string
  vendorId: string
  vendorName: string
  ownerName: string
  registeredBy: string
  registeredByName: string
  invoiceDate: string
  dueDate: string
  currency: Currency
  lines: InvoiceLine[]
  taxRate: number
  status: InvoiceStatus
  matchIssues: MatchIssue[]
  matchOverrideReason?: string
  approvalChain: ApprovalStep[]
  attachments: Attachment[]
  payment?: { paidAt: string; reference: string; method: 'bank_transfer' | 'cheque' | 'cash'; paidBy: string; paidByName: string; amount: number }
  createdAt: string
  updatedAt: string
  comments: Comment[]
}

export interface Notification {
  id: string
  userId: string
  at: string
  title: string
  body: string
  link: string
  read: boolean
  kind: 'approval' | 'info' | 'success' | 'warning'
}

export interface OrgSettings {
  orgName: string
  orgShort: string
  tagline: string
  address: string
  email: string
  phone: string
  website: string
  defaultCurrency: Currency
  taxRate: number
  fxToUSD: Record<Currency, number>   // thresholds are defined in USD (SOP §3)
  tiers: ProcurementTier[]
  contractThresholdUSD: number        // services / works above this need a formal contract
  legalReviewThresholdUSD: number     // contracts above this need legal review
  soleSourceEdThresholdUSD: number    // sole-source / emergency above this needs ED pre-approval
  dualAuthThresholdUSD: number        // POs above this need dual authorisation
  priceTolerancePct: number      // invoice unit-price variance tolerated vs PO
  paymentTermsDays: number       // default invoice due date offset
  fiscalYearStart: string
}

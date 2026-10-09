import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ApprovalRule, Attachment, AuditEvent, Comment, Contract, ContractMilestone, LineItem, Notification, OrgSettings,
  PurchaseOrder, PurchaseRequisition, Quotation, User, Vendor, DocType, Role, GoodsReceipt, GoodsReceiptLine, Invoice, InvoiceLine, SourcingRecord, ExceptionType, ProjectBudget, Envelope, EnvelopeRecipient, EnvelopeField, Project, ProjectStage, Donor, Task, ProjectReport, ProjectComment, MasterBudget, MasterLine,
  UiTheme, Partner, PartnerStage, DueDiligence, PartnerSubmission, PartnerAgreement, StaffMember,
} from '@/types'
import { DOC_OWNER, SEED_PARTNERS, SEED_STAFF, SEED_BUDGETS, SEED_DONORS, SEED_PROJECTS, SEED_TASKS, SEED_MASTER, SEED_CONTRACTS, SEED_GRNS, SEED_INVOICES, SEED_POS, SEED_PRS, SEED_RULES, SEED_SETTINGS, SEED_USERS, SEED_VENDORS, STANDARD_CLAUSES } from '@/data/seed'
import { hasBlockingIssues, receiptProgress, runMatch, invoiceTotals } from '@/lib/match'
import { newEvent, recipientTurn } from '@/lib/esign'
import { generateIPTT, generateReportingCalendar, generateSpendingPlan, monthsOf, parseMentions, reportLiveStatus, allIndicators } from '@/lib/grants'
import { blockingFailures, emptySourcing, isBidMethod, sourcingRequirements, tierForPR, toUSD, resolveTier } from '@/lib/tiers'
import { applyDecision, buildChain, currentStep, resetChain, resolveApprover, chainFromSteps } from '@/lib/workflow'
import { linesSubtotal, nowIso, uid } from '@/lib/format'
import { emptyDueDiligence } from '@/lib/partners'
import { unassignedSalaryLines, isSalaryLine, headcount, nextRhsNumber } from '@/lib/salary'

type Decision = 'approved' | 'rejected' | 'returned' | 'delegated'

interface State {
  currentUserId: string | null
  users: User[]
  vendors: Vendor[]
  rules: ApprovalRule[]
  settings: OrgSettings
  prs: PurchaseRequisition[]
  pos: PurchaseOrder[]
  contracts: Contract[]
  grns: GoodsReceipt[]
  invoices: Invoice[]
  budgets: ProjectBudget[]
  envelopes: Envelope[]
  projects: Project[]
  donors: Donor[]
  tasks: Task[]
  masterBudgets: MasterBudget[]
  partners: Partner[]
  staff: StaffMember[]
  country: string            // current country context ('all' or a country name)
  uiTheme: UiTheme           // 'classic' (original interface) | 'modern'
  sidebarCollapsed: boolean  // desktop sidebar shown as an icon rail
  notifications: Notification[]
  audit: AuditEvent[]
  counters: Record<string, number>
}

interface Actions {
  // auth
  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  switchUser: (id: string) => void
  currentUser: () => User | null

  // PR
  createPR: (data: Partial<PurchaseRequisition>) => PurchaseRequisition
  updatePR: (id: string, patch: Partial<PurchaseRequisition>) => void
  submitPR: (id: string) => { ok: boolean; error?: string }
  decidePR: (id: string, decision: Decision, comment?: string, delegateTo?: string) => { ok: boolean; error?: string }
  cancelPR: (id: string) => void
  addPRComment: (id: string, text: string) => void

  // Sourcing
  takeSourcing: (prId: string) => void
  addQuotation: (prId: string, q: Omit<Quotation, 'id'>) => void
  updateQuotation: (prId: string, qId: string, patch: Partial<Quotation>) => void
  removeQuotation: (prId: string, qId: string) => void
  awardQuotation: (prId: string, qId: string, justification: string) => { ok: boolean; error?: string }
  updateSourcing: (prId: string, patch: Partial<SourcingRecord>) => void
  requestException: (prId: string, type: ExceptionType, justification: string) => { ok: boolean; error?: string }
  clearException: (prId: string) => void
  decideException: (prId: string, decision: 'approved' | 'rejected', comment: string) => { ok: boolean; error?: string }
  approveFewerQuotes: (prId: string) => { ok: boolean; error?: string }
  signEvaluationReport: (prId: string) => { ok: boolean; error?: string }
  markDonorNotified: (prId: string) => void

  // PO
  createPOFromAward: (prId: string) => { ok: boolean; poId?: string; error?: string }
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void
  submitPO: (id: string) => { ok: boolean; error?: string }
  decidePO: (id: string, decision: Decision, comment?: string, delegateTo?: string) => { ok: boolean; error?: string }
  issuePO: (id: string) => void
  cancelPO: (id: string) => void
  addPOComment: (id: string, text: string) => void

  // Contract
  createContractFromPO: (poId: string) => { ok: boolean; contractId?: string; error?: string }
  updateContract: (id: string, patch: Partial<Contract>) => void
  sendContractToLegal: (id: string) => void
  legalDecision: (id: string, approved: boolean, notes: string) => void
  signContract: (id: string, party: 'RHS' | 'Vendor') => void
  addContractComment: (id: string, text: string) => void

  // Goods receipt
  postGoodsReceipt: (poId: string, data: { deliveryNoteRef: string; location: string; notes: string; lines: GoodsReceiptLine[]; attachments: Attachment[] }) => { ok: boolean; grnId?: string; error?: string }

  // Invoices
  registerInvoice: (data: { poId: string; vendorInvoiceNo: string; invoiceDate: string; dueDate: string; lines: InvoiceLine[]; taxRate: number; attachments: Attachment[] }) => { ok: boolean; invoiceId?: string; error?: string }
  updateInvoice: (id: string, patch: Partial<Invoice>) => void
  rematchInvoice: (id: string) => void
  overrideMatch: (id: string, reason: string) => { ok: boolean; error?: string }
  submitInvoice: (id: string) => { ok: boolean; error?: string }
  decideInvoice: (id: string, decision: Decision, comment?: string, delegateTo?: string) => { ok: boolean; error?: string }
  payInvoice: (id: string, payment: { reference: string; method: 'bank_transfer' | 'cheque' | 'cash'; paidAt: string }) => { ok: boolean; error?: string }
  rejectInvoiceAtRegistration: (id: string, reason: string) => void
  addInvoiceComment: (id: string, text: string) => void

  // Budgets
  upsertBudget: (b: ProjectBudget) => void
  deleteBudget: (id: string) => void
  setTemplate: (kind: 'budget' | 'bva', file?: Attachment) => void

  // Master budget
  createMasterBudget: (year: number, copyFromId?: string) => MasterBudget
  upsertMasterLine: (mbId: string, line: MasterLine) => void
  deleteMasterLine: (mbId: string, lineId: string) => void
  approveMasterBudget: (mbId: string) => { ok: boolean; error?: string }
  reopenMasterBudget: (mbId: string) => void
  setBudgetLineMaster: (budgetId: string, lineId: string, masterLineId?: string) => void
  setCountry: (c: string) => void
  // Partnerships
  createPartner: (data: Partial<Partner> & { name: string }) => Partner
  updatePartner: (id: string, patch: Partial<Partner>) => void
  deletePartner: (id: string) => void
  advancePartner: (id: string, stage: PartnerStage, note?: string) => { ok: boolean; error?: string }
  updateDueDiligence: (id: string, fn: (dd: DueDiligence) => DueDiligence) => void
  decidePartner: (id: string, outcome: 'approved' | 'approved_conditions' | 'declined', conditions: string) => void
  shareVetting: (id: string, message?: string) => string
  revokeVetting: (id: string) => void
  reopenVetting: (id: string) => void
  submitPartnerVetting: (token: string, submission: Omit<PartnerSubmission, 'submittedAt'>) => { ok: boolean; error?: string }
  completeVetting: (id: string) => void
  setPartnerAgreement: (id: string, a: PartnerAgreement) => void
  // Master salary plan
  upsertStaff: (st: Partial<StaffMember> & { position: string }) => StaffMember
  deleteStaff: (id: string) => void
  confirmRecruitment: (id: string, name: string, startDate: string) => void
  // Appearance (per browser)
  setUiTheme: (t: UiTheme) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void

  // Grants / PCM
  createProject: (data: Partial<Project> & { code: string; title: string }) => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  advanceProject: (id: string, stage: ProjectStage, opts?: { note?: string; awardedAmount?: number; startDate?: string; endDate?: string; outcome?: 'funded' | 'not_funded' }) => { ok: boolean; error?: string }
  addProjectComment: (id: string, text: string) => void
  addReport: (projectId: string, r: Omit<ProjectReport, 'id' | 'status' | 'attachments'>) => void
  updateReport: (projectId: string, reportId: string, patch: Partial<ProjectReport>) => void
  submitReport: (projectId: string, reportId: string, attachments: Attachment[], notes?: string) => void
  runReminders: () => number
  upsertDonor: (d: Donor) => void
  deleteDonor: (id: string) => void
  createTask: (t: Omit<Task, 'id' | 'createdBy' | 'createdByName' | 'createdAt' | 'status'> & { status?: Task['status'] }) => Task
  updateTask: (id: string, patch: Partial<Task>) => void

  // E-Signature
  createEnvelope: (data: Pick<Envelope, 'subject' | 'message' | 'documentName' | 'pageCount' | 'hash' | 'fileKey' | 'signingOrder' | 'recipients' | 'fields' | 'linkedDoc'>) => Envelope
  updateEnvelope: (id: string, patch: Partial<Envelope>) => void
  sendEnvelope: (id: string) => { ok: boolean; error?: string }
  markEnvelopeViewed: (id: string, recipientId: string) => void
  completeRecipient: (id: string, recipientId: string, values: Record<string, string>, method?: 'drawn' | 'typed') => { ok: boolean; error?: string; completed?: boolean }
  declineEnvelope: (id: string, recipientId: string, reason: string) => { ok: boolean; error?: string }
  voidEnvelope: (id: string, reason: string) => { ok: boolean; error?: string }
  deleteEnvelope: (id: string) => void
  adoptSignature: (dataUrl: string, method: 'drawn' | 'typed') => void
  setInitials: (text: string) => void

  // masters / admin
  upsertVendor: (v: Partial<Vendor> & { id?: string }) => void
  upsertUser: (u: Partial<User> & { id?: string }) => void
  upsertRule: (r: ApprovalRule) => void
  deleteRule: (id: string) => void
  updateSettings: (patch: Partial<OrgSettings>) => void

  // notifications
  markRead: (id: string) => void
  markAllRead: () => void

  resetDemo: () => void
}

const initial = (): State => ({
  currentUserId: null,
  users: SEED_USERS,
  vendors: SEED_VENDORS,
  rules: SEED_RULES,
  settings: SEED_SETTINGS,
  prs: SEED_PRS,
  pos: SEED_POS,
  contracts: SEED_CONTRACTS,
  grns: SEED_GRNS,
  invoices: SEED_INVOICES,
  budgets: SEED_BUDGETS,
  envelopes: [],
  projects: SEED_PROJECTS,
  donors: SEED_DONORS,
  tasks: SEED_TASKS,
  masterBudgets: SEED_MASTER,
  partners: SEED_PARTNERS,
  staff: SEED_STAFF,
  country: 'all',
  uiTheme: 'classic',
  sidebarCollapsed: false,
  notifications: [
    { id: 'n5', userId: 'u_rana', at: nowIso(), title: 'Invoice approval required', body: 'INV-2025-0012 · Amman Fleet & Logistics · JOD 742.40', link: '/invoices/inv_1', read: false, kind: 'approval' },
    { id: 'n1', userId: 'u_rana', at: nowIso(), title: 'Approval required', body: 'PR-2025-0042 · Laptops for field coordinators', link: '/requisitions/pr_2', read: false, kind: 'approval' },
    { id: 'n2', userId: 'u_omar', at: nowIso(), title: 'Approval required', body: 'PR-2025-0043 · Physiotherapy consumables', link: '/requisitions/pr_3', read: false, kind: 'approval' },
    { id: 'n3', userId: 'u_dana', at: nowIso(), title: 'Legal review requested', body: 'CT-2025-0006 · Fleet Maintenance Services Agreement', link: '/contracts/ct_1', read: false, kind: 'approval' },
    { id: 'n4', userId: 'u_lina', at: nowIso(), title: 'Requisition returned', body: 'PR-2025-0038 was returned by Finance for changes', link: '/requisitions/pr_6', read: false, kind: 'warning' },
  ],
  audit: [
    { id: 'a1', at: nowIso(), actorId: 'u_bilal', actorName: DOC_OWNER, docType: 'SYSTEM', action: 'System initialised', detail: 'Demo dataset loaded' },
  ],
  counters: { PR: 44, PO: 17, CT: 6, GRN: 9, INV: 12, ENV: 0, PT: 2 },
})

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => {
      // ---- helpers -------------------------------------------------------
      const actor = () => get().users.find((u) => u.id === get().currentUserId)!
      const log = (docType: AuditEvent['docType'], action: string, doc?: { id: string; number: string }, detail?: string) => {
        const a = actor()
        set((s) => ({
          audit: [{ id: uid('a_'), at: nowIso(), actorId: a?.id ?? 'system', actorName: a?.name ?? 'System', docType, docId: doc?.id, docNumber: doc?.number, action, detail }, ...s.audit].slice(0, 500),
        }))
      }
      const fmtDue = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const notify = (userId: string | undefined, n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) => {
        if (!userId) return
        set((s) => ({ notifications: [{ id: uid('n_'), userId, at: nowIso(), read: false, ...n }, ...s.notifications] }))
      }
      const notifyRole = (role: Role, n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) => {
        get().users.filter((u) => u.active && u.role === role).forEach((u) => notify(u.id, n))
      }
      const nextNumber = (t: 'PR' | 'PO' | 'CT' | 'GRN' | 'INV' | 'ENV' | 'PT') => {
        const n = (get().counters[t] ?? 0) + 1
        set((s) => ({ counters: { ...s.counters, [t]: n } }))
        return `${t}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
      }
      const notifyCurrentApprover = (docType: DocType, doc: { id: string; number: string; title: string; approvalChain: PurchaseRequisition['approvalChain']; department?: string }) => {
        const step = currentStep(doc.approvalChain)
        if (!step) return
        const link = docType === 'PR' ? `/requisitions/${doc.id}` : docType === 'INVOICE' ? `/invoices/${doc.id}` : `/orders/${doc.id}`
        const target = step.delegatedTo ?? step.approverId ?? resolveApprover(get().users, step.role, doc.department)?.id
        if (target) notify(target, { kind: 'approval', title: 'Approval required', body: `${doc.number} · ${doc.title}`, link })
        else notifyRole(step.role, { kind: 'approval', title: 'Approval required', body: `${doc.number} · ${doc.title}`, link })
      }

      return {
        ...initial(),

        // ---- auth ----------------------------------------------------------
        login: (email, password) => {
          const u = get().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
          if (!u || u.password !== password) return { ok: false, error: 'Invalid email or password.' }
          if (!u.active) return { ok: false, error: 'This account is deactivated. Contact the administrator.' }
          set({ currentUserId: u.id })
          log('USER', 'Signed in')
          return { ok: true }
        },
        logout: () => { log('USER', 'Signed out'); set({ currentUserId: null }) },
        switchUser: (id) => set({ currentUserId: id }),
        currentUser: () => get().users.find((u) => u.id === get().currentUserId) ?? null,

        // ---- PR ------------------------------------------------------------
        createPR: (data) => {
          data = { ...data, procurementType: data.procurementType ?? 'goods', sourcing: data.sourcing ?? emptySourcing() }
          const a = actor()
          const pr: PurchaseRequisition = {
            id: uid('pr_'), number: nextNumber('PR'), title: '', justification: '', department: a.department,
            requesterId: a.id, requesterName: a.name, ownerName: DOC_OWNER, priority: 'normal', procurementType: 'goods',
            neededBy: '', currency: get().settings.defaultCurrency, lines: [], attachments: [], status: 'draft',
            approvalChain: [], createdAt: nowIso(), updatedAt: nowIso(), quotations: [], comments: [], sourcing: emptySourcing(),
            ...data,
          }
          set((s) => ({ prs: [pr, ...s.prs] }))
          log('PR', 'Requisition created', pr)
          return pr
        },
        updatePR: (id, patch) => {
          set((s) => ({ prs: s.prs.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p)) }))
        },
        submitPR: (id) => {
          const pr = get().prs.find((p) => p.id === id)
          if (!pr) return { ok: false, error: 'Not found' }
          if (!pr.title.trim()) return { ok: false, error: 'Title is required.' }
          if (!pr.lines.length) return { ok: false, error: 'Add at least one line item.' }
          if (pr.lines.some((l) => !l.description.trim() || l.quantity <= 0)) return { ok: false, error: 'Every line needs a description and quantity.' }
          if (!pr.neededBy) return { ok: false, error: 'Needed-by date is required.' }
          if (!pr.donorCode) return { ok: false, error: 'Select the project / donor code the requisition is charged to.' }
          if (pr.lines.some((l) => !l.budgetLine)) return { ok: false, error: 'Every line item needs a budget line.' }
          const amount = linesSubtotal(pr.lines)
          const chain = pr.status === 'returned' && pr.approvalChain.length ? resetChain(pr.approvalChain) : buildChain(get().rules, get().users, 'PR', amount, pr.department)
          if (!chain.length) return { ok: false, error: 'No approval rule matches this amount. Ask an administrator to configure the approval matrix.' }
          const upd = { ...pr, status: 'pending_approval' as const, approvalChain: chain, submittedAt: nowIso(), updatedAt: nowIso() }
          set((s) => ({ prs: s.prs.map((p) => (p.id === id ? upd : p)) }))
          log('PR', pr.status === 'returned' ? 'Requisition re-submitted' : 'Requisition submitted for approval', pr, `${chain.length}-step chain`)
          notifyCurrentApprover('PR', upd)
          return { ok: true }
        },
        decidePR: (id, decision, comment, delegateTo) => {
          const pr = get().prs.find((p) => p.id === id)
          const a = actor()
          if (!pr) return { ok: false, error: 'Not found' }
          if (pr.status !== 'pending_approval') return { ok: false, error: 'Requisition is not awaiting approval.' }
          if (decision !== 'approved' && !comment?.trim()) return { ok: false, error: 'A comment is required for this decision.' }
          const { chain, outcome } = applyDecision(pr.approvalChain, decision, a, comment, delegateTo)
          let status: PurchaseRequisition["status"] = pr.status
          if (outcome === 'completed') status = 'approved'
          if (outcome === 'rejected') status = 'rejected'
          if (outcome === 'returned') status = 'returned'
          const upd = { ...pr, approvalChain: chain, status, approvedAt: outcome === 'completed' ? nowIso() : pr.approvedAt, updatedAt: nowIso() }
          set((s) => ({ prs: s.prs.map((p) => (p.id === id ? upd : p)) }))
          log('PR', `Step ${decision}`, pr, comment)
          const link = `/requisitions/${pr.id}`
          if (outcome === 'advanced') notifyCurrentApprover('PR', upd)
          if (outcome === 'delegated') notify(delegateTo, { kind: 'approval', title: 'Approval delegated to you', body: `${pr.number} · ${pr.title}`, link })
          if (outcome === 'completed') {
            notify(pr.requesterId, { kind: 'success', title: 'Requisition approved', body: `${pr.number} is fully approved and handed to Procurement.`, link })
            notifyRole('procurement_officer', { kind: 'info', title: 'New requisition for sourcing', body: `${pr.number} · ${pr.title}`, link: `/sourcing/${pr.id}` })
          }
          if (outcome === 'rejected') notify(pr.requesterId, { kind: 'warning', title: 'Requisition rejected', body: `${pr.number}: ${comment}`, link })
          if (outcome === 'returned') notify(pr.requesterId, { kind: 'warning', title: 'Requisition returned for changes', body: `${pr.number}: ${comment}`, link })
          return { ok: true }
        },
        cancelPR: (id) => {
          const pr = get().prs.find((p) => p.id === id)
          if (!pr) return
          set((s) => ({ prs: s.prs.map((p) => (p.id === id ? { ...p, status: 'cancelled', updatedAt: nowIso() } : p)) }))
          log('PR', 'Requisition cancelled', pr)
        },
        addPRComment: (id, text) => {
          const a = actor()
          const c: Comment = { id: uid('c_'), authorId: a.id, authorName: a.name, at: nowIso(), text }
          set((s) => ({ prs: s.prs.map((p) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p)) }))
        },

        // ---- Sourcing ------------------------------------------------------
        takeSourcing: (prId) => {
          const a = actor()
          const pr = get().prs.find((p) => p.id === prId)
          if (!pr) return
          set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, status: 'sourcing', sourcingOwnerId: a.id, updatedAt: nowIso() } : p)) }))
          log('PR', 'Sourcing started', pr, `Assigned to ${a.name}`)
          notify(pr.requesterId, { kind: 'info', title: 'Sourcing started', body: `${pr.number} is now with Procurement (${a.name}).`, link: `/requisitions/${pr.id}` })
        },
        addQuotation: (prId, q) => {
          const pr = get().prs.find((p) => p.id === prId)
          if (!pr) return
          const quotation: Quotation = { ...q, id: uid('q_') }
          set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, quotations: [...p.quotations, quotation], updatedAt: nowIso() } : p)) }))
          log('PR', 'Quotation recorded', pr, `${q.vendorName} · ${q.reference}`)
        },
        updateQuotation: (prId, qId, patch) => {
          set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, quotations: p.quotations.map((q) => (q.id === qId ? { ...q, ...patch } : q)), updatedAt: nowIso() } : p)) }))
        },
        removeQuotation: (prId, qId) => {
          const pr = get().prs.find((p) => p.id === prId)
          set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, quotations: p.quotations.filter((q) => q.id !== qId), updatedAt: nowIso() } : p)) }))
          if (pr) log('PR', 'Quotation removed', pr)
        },
        awardQuotation: (prId, qId, justification) => {
          const pr = get().prs.find((p) => p.id === prId)
          if (!pr) return { ok: false, error: 'Not found' }
          const q = pr.quotations.find((x) => x.id === qId)
          if (!q) return { ok: false, error: 'Quotation not found' }
          if (q.late) return { ok: false, error: 'Quotations received after the deadline must be rejected (SOP-PRO-03 §3).' }
          const { tier, reqs } = sourcingRequirements(pr, get().settings, get().users)
          const fails = blockingFailures(reqs)
          if (fails.length) return { ok: false, error: `SOP requirement not met: ${fails[0]!.label}.` }
          if (!q.compliant) return { ok: false, error: 'Only technically compliant quotations can be awarded.' }
          if (tier && isBidMethod(tier.method) && !pr.sourcing.exception && (q.technicalScore ?? 0) < pr.sourcing.technicalPassMark)
            return { ok: false, error: `This bid scored ${q.technicalScore ?? 0} — below the technical pass mark of ${pr.sourcing.technicalPassMark} and is disqualified from financial evaluation.` }
          if (!justification.trim()) return { ok: false, error: 'Award justification is required.' }
          set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, status: 'awarded', awardedQuotationId: qId, awardJustification: justification, updatedAt: nowIso() } : p)) }))
          log('PR', 'Quotation awarded', pr, `${q.vendorName} · ${q.reference} · ${tier?.name ?? ''}`)
          notify(pr.requesterId, { kind: 'success', title: 'Vendor selected', body: `${pr.number}: awarded to ${q.vendorName}.`, link: `/requisitions/${pr.id}` })
          return { ok: true }
        },
        updateSourcing: (prId, patch) => set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, sourcing: { ...p.sourcing, ...patch }, updatedAt: nowIso() } : p)) })),
        requestException: (prId, type, justification) => {
          const pr = get().prs.find((p) => p.id === prId)
          const a = actor()
          if (!pr) return { ok: false, error: 'Not found' }
          if (justification.trim().length < 20) return { ok: false, error: 'Write the justification memo — why competitive procurement is not possible.' }
          const { amountUSD } = tierForPR(pr, get().settings)
          const needsED = amountUSD > get().settings.soleSourceEdThresholdUSD
          get().updateSourcing(prId, { exception: { type, justification, requestedBy: a.id, requestedByName: a.name, requestedAt: nowIso(), decision: needsED ? undefined : 'approved' } })
          log('PR', 'Sole-source / emergency exception requested', pr, `${type} · ${justification.slice(0, 80)}`)
          if (needsED) notifyRole('executive_director', { kind: 'approval', title: 'Sole-source / emergency pre-approval required', body: `${pr.number} · ${pr.title}`, link: `/sourcing/${pr.id}` })
          return { ok: true }
        },
        clearException: (prId) => { const pr = get().prs.find((p) => p.id === prId); get().updateSourcing(prId, { exception: undefined }); if (pr) log('PR', 'Exception withdrawn — competitive sourcing resumed', pr) },
        decideException: (prId, decision, comment) => {
          const pr = get().prs.find((p) => p.id === prId)
          const a = actor()
          if (!pr || !pr.sourcing.exception) return { ok: false, error: 'No exception pending' }
          if (!['executive_director', 'admin'].includes(a.role)) return { ok: false, error: 'Only the Executive Director can approve exceptions.' }
          if (decision === 'rejected' && !comment.trim()) return { ok: false, error: 'A comment is required to reject.' }
          get().updateSourcing(prId, { exception: { ...pr.sourcing.exception, decision, approvedBy: a.id, approvedByName: a.name, approvedAt: nowIso(), comment } })
          log('PR', `Exception ${decision} by Executive Director`, pr, comment)
          notify(pr.sourcingOwnerId ?? pr.requesterId, { kind: decision === 'approved' ? 'success' : 'warning', title: `Sole-source exception ${decision}`, body: `${pr.number}${comment ? `: ${comment}` : ''}`, link: `/sourcing/${pr.id}` })
          return { ok: true }
        },
        approveFewerQuotes: (prId) => {
          const pr = get().prs.find((p) => p.id === prId)
          const a = actor()
          if (!pr) return { ok: false, error: 'Not found' }
          if (!['procurement_manager', 'finance_director', 'programs_director', 'executive_director', 'admin'].includes(a.role)) return { ok: false, error: 'Supervisor approval required (Procurement Manager or a Director).' }
          if (!pr.sourcing.fewerQuotesReason?.trim()) return { ok: false, error: 'Document the reason first (non-response, market limitation…).' }
          get().updateSourcing(prId, { fewerQuotesApprovedBy: a.id, fewerQuotesApprovedByName: a.name, fewerQuotesApprovedAt: nowIso() })
          log('PR', 'Proceeding with fewer quotations approved', pr, pr.sourcing.fewerQuotesReason)
          return { ok: true }
        },
        signEvaluationReport: (prId) => {
          const pr = get().prs.find((p) => p.id === prId)
          const a = actor()
          if (!pr) return { ok: false, error: 'Not found' }
          if (!pr.sourcing.committee.some((m) => m.userId === a.id) && a.role !== 'admin') return { ok: false, error: 'Only a member of the evaluation committee can sign the report.' }
          if ((pr.sourcing.evaluationReport?.trim().length ?? 0) < 30) return { ok: false, error: 'Write the evaluation report first.' }
          get().updateSourcing(prId, { evaluationSignedAt: nowIso() })
          log('PR', 'Evaluation report signed', pr, `by ${a.name}`)
          return { ok: true }
        },
        markDonorNotified: (prId) => { const pr = get().prs.find((p) => p.id === prId); get().updateSourcing(prId, { donorNotifiedAt: nowIso() }); if (pr) log('PR', 'Donor notified', pr) },

        // ---- PO ------------------------------------------------------------
        createPOFromAward: (prId) => {
          const pr = get().prs.find((p) => p.id === prId)
          const a = actor()
          if (!pr || !pr.awardedQuotationId) return { ok: false, error: 'Requisition has no awarded quotation.' }
          if (pr.poId) return { ok: false, error: 'A purchase order already exists for this requisition.' }
          const q = pr.quotations.find((x) => x.id === pr.awardedQuotationId)!
          const lines: LineItem[] = pr.lines.map((l) => ({ ...l, unitPrice: q.lines.find((ql) => ql.lineItemId === l.id)?.unitPrice ?? l.unitPrice }))
          const po: PurchaseOrder = {
            id: uid('po_'), number: nextNumber('PO'), prId: pr.id, prNumber: pr.number, title: pr.title,
            vendorId: q.vendorId, vendorName: q.vendorName, quotationId: q.id, ownerName: DOC_OWNER, createdBy: a.id, createdByName: a.name,
            currency: q.currency, lines, taxRate: q.taxRate, deliveryAddress: `${get().settings.orgName}, ${get().settings.address}`,
            deliveryDate: pr.neededBy, paymentTerms: q.paymentTerms, incoterms: 'DAP', notes: '', status: 'draft', approvalChain: [], attachments: [],
            createdAt: nowIso(), updatedAt: nowIso(), comments: [],
          }
          set((s) => ({ pos: [po, ...s.pos], prs: s.prs.map((p) => (p.id === prId ? { ...p, poId: po.id, updatedAt: nowIso() } : p)) }))
          log('PO', 'Purchase order drafted from award', po, `From ${pr.number}`)
          return { ok: true, poId: po.id }
        },
        updatePO: (id, patch) => set((s) => ({ pos: s.pos.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p)) })),
        submitPO: (id) => {
          const po = get().pos.find((p) => p.id === id)
          if (!po) return { ok: false, error: 'Not found' }
          if (!po.deliveryDate) return { ok: false, error: 'Delivery date is required.' }
          const amount = linesSubtotal(po.lines)
          const pr = get().prs.find((p) => p.id === po.prId)
          const chain = po.status === 'returned' && po.approvalChain.length ? resetChain(po.approvalChain) : (() => { const t = resolveTier(toUSD(amount, po.currency, get().settings), get().settings.tiers); return t ? chainFromSteps(t.approvers, get().users, pr?.department) : [] })()
          if (!chain.length) return { ok: false, error: 'No PO approval rule matches this amount.' }
          const upd = { ...po, status: 'pending_approval' as const, approvalChain: chain, updatedAt: nowIso() }
          set((s) => ({ pos: s.pos.map((p) => (p.id === id ? upd : p)) }))
          log('PO', 'Purchase order submitted for approval', po)
          notifyCurrentApprover('PO', upd)
          return { ok: true }
        },
        decidePO: (id, decision, comment, delegateTo) => {
          const po = get().pos.find((p) => p.id === id)
          const a = actor()
          if (!po) return { ok: false, error: 'Not found' }
          if (po.status !== 'pending_approval') return { ok: false, error: 'PO is not awaiting approval.' }
          if (decision !== 'approved' && !comment?.trim()) return { ok: false, error: 'A comment is required for this decision.' }
          const { chain, outcome } = applyDecision(po.approvalChain, decision, a, comment, delegateTo)
          let status: PurchaseOrder["status"] = po.status
          if (outcome === 'completed') status = 'approved'
          if (outcome === 'rejected') status = 'rejected'
          if (outcome === 'returned') status = 'returned'
          const upd = { ...po, approvalChain: chain, status, updatedAt: nowIso() }
          set((s) => ({ pos: s.pos.map((p) => (p.id === id ? upd : p)) }))
          log('PO', `Step ${decision}`, po, comment)
          const link = `/orders/${po.id}`
          if (outcome === 'advanced') notifyCurrentApprover('PO', upd)
          if (outcome === 'delegated') notify(delegateTo, { kind: 'approval', title: 'Approval delegated to you', body: `${po.number} · ${po.title}`, link })
          if (outcome === 'completed') notify(po.createdBy, { kind: 'success', title: 'PO approved — ready to issue', body: `${po.number} · ${po.title}`, link })
          if (outcome === 'rejected' || outcome === 'returned') notify(po.createdBy, { kind: 'warning', title: `PO ${outcome}`, body: `${po.number}: ${comment}`, link })
          return { ok: true }
        },
        issuePO: (id) => {
          const po = get().pos.find((p) => p.id === id)
          if (!po) return
          set((s) => ({
            pos: s.pos.map((p) => (p.id === id ? { ...p, status: 'issued', issuedAt: nowIso(), updatedAt: nowIso() } : p)),
            prs: s.prs.map((p) => (p.id === po.prId ? { ...p, status: 'ordered', updatedAt: nowIso() } : p)),
          }))
          log('PO', 'Purchase order issued to vendor', po, po.vendorName)
          const pr = get().prs.find((p) => p.id === po.prId)
          if (pr) notify(pr.requesterId, { kind: 'success', title: 'Purchase order issued', body: `${po.number} issued to ${po.vendorName}.`, link: `/orders/${po.id}` })
        },
        cancelPO: (id) => {
          const po = get().pos.find((p) => p.id === id)
          if (!po) return
          set((s) => ({ pos: s.pos.map((p) => (p.id === id ? { ...p, status: 'cancelled', updatedAt: nowIso() } : p)), prs: s.prs.map((p) => (p.id === po.prId ? { ...p, poId: undefined, status: 'awarded' } : p)) }))
          log('PO', 'Purchase order cancelled', po)
        },
        addPOComment: (id, text) => {
          const a = actor()
          const c: Comment = { id: uid('c_'), authorId: a.id, authorName: a.name, at: nowIso(), text }
          set((s) => ({ pos: s.pos.map((p) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p)) }))
        },

        // ---- Contract ------------------------------------------------------
        createContractFromPO: (poId) => {
          const po = get().pos.find((p) => p.id === poId)
          const a = actor()
          if (!po) return { ok: false, error: 'Not found' }
          if (po.contractId) return { ok: false, error: 'A contract already exists for this PO.' }
          if (!['issued', 'partially_received', 'received'].includes(po.status)) return { ok: false, error: 'Contracts can only be drafted from issued purchase orders.' }
          const total = linesSubtotal(po.lines) * (1 + po.taxRate / 100)
          const vendor = get().vendors.find((v) => v.id === po.vendorId)
          const ed = get().users.find((u) => u.role === 'executive_director')
          const ms: ContractMilestone[] = [{ id: uid('m_'), title: 'Delivery & acceptance', dueDate: po.deliveryDate, amount: Math.round(total * 100) / 100, status: 'pending' }]
          const ct: Contract = {
            id: uid('ct_'), number: nextNumber('CT'), poId: po.id, poNumber: po.number, prNumber: po.prNumber,
            title: `${po.title} — Supply Agreement`, vendorId: po.vendorId, vendorName: po.vendorName, ownerName: DOC_OWNER,
            draftedBy: a.id, draftedByName: a.name, type: 'supply', startDate: new Date().toISOString().slice(0, 10), endDate: po.deliveryDate,
            value: Math.round(total * 100) / 100, currency: po.currency, clauses: STANDARD_CLAUSES.filter((c) => c.mandatory), milestones: ms,
            attachments: [], status: 'drafting',
            signatories: [{ name: ed?.name ?? 'Executive Director', title: ed?.title ?? 'Executive Director', party: 'RHS' }, { name: vendor?.contactName ?? 'Authorised Signatory', title: 'Authorised Signatory', party: 'Vendor' }],
            createdAt: nowIso(), updatedAt: nowIso(), comments: [],
          }
          set((s) => ({ contracts: [ct, ...s.contracts], pos: s.pos.map((p) => (p.id === poId ? { ...p, contractId: ct.id, status: p.status === 'issued' ? 'contracted' : p.status, updatedAt: nowIso() } : p)) }))
          log('CONTRACT', 'Contract drafted from PO', ct, `From ${po.number}`)
          return { ok: true, contractId: ct.id }
        },
        updateContract: (id, patch) => set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c)) })),
        sendContractToLegal: (id) => {
          const ct = get().contracts.find((c) => c.id === id)
          if (!ct) return
          const legal = get().users.find((u) => u.active && u.role === 'legal')
          set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, status: 'legal_review', legalReviewer: legal?.id, updatedAt: nowIso() } : c)) }))
          log('CONTRACT', 'Sent for legal review', ct)
          notify(legal?.id, { kind: 'approval', title: 'Legal review requested', body: `${ct.number} · ${ct.title}`, link: `/contracts/${ct.id}` })
        },
        legalDecision: (id, approved, notes) => {
          const ct = get().contracts.find((c) => c.id === id)
          if (!ct) return
          set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, status: approved ? 'pending_signature' : 'drafting', legalNotes: notes, updatedAt: nowIso() } : c)) }))
          log('CONTRACT', approved ? 'Legal review cleared' : 'Legal review — returned for changes', ct, notes)
          notify(ct.draftedBy, { kind: approved ? 'success' : 'warning', title: approved ? 'Contract cleared by Legal' : 'Contract returned by Legal', body: `${ct.number}: ${notes || 'See contract'}`, link: `/contracts/${ct.id}` })
        },
        signContract: (id, party) => {
          const ct = get().contracts.find((c) => c.id === id)
          if (!ct) return
          const signatories = ct.signatories.map((sg) => (sg.party === party ? { ...sg, signedAt: nowIso() } : sg))
          const all = signatories.every((sg) => sg.signedAt)
          set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, signatories, status: all ? 'active' : c.status, updatedAt: nowIso() } : c)) }))
          log('CONTRACT', `Signed by ${party}`, ct)
          if (all) { log('CONTRACT', 'Contract active', ct); notify(ct.draftedBy, { kind: 'success', title: 'Contract fully executed', body: `${ct.number} is now active.`, link: `/contracts/${ct.id}` }) }
        },
        addContractComment: (id, text) => {
          const a = actor()
          const c: Comment = { id: uid('c_'), authorId: a.id, authorName: a.name, at: nowIso(), text }
          set((s) => ({ contracts: s.contracts.map((x) => (x.id === id ? { ...x, comments: [...x.comments, c] } : x)) }))
        },

        // ---- Goods receipt -------------------------------------------------
        postGoodsReceipt: (poId, data) => {
          const po = get().pos.find((p) => p.id === poId)
          const a = actor()
          if (!po) return { ok: false, error: 'Not found' }
          if (!['issued', 'contracted', 'partially_received'].includes(po.status)) return { ok: false, error: 'Goods can only be received against an issued purchase order.' }
          const lines = data.lines.filter((l) => l.quantity > 0)
          if (!lines.length) return { ok: false, error: 'Enter a received quantity on at least one line.' }
          for (const l of lines) {
            const pl = po.lines.find((x) => x.id === l.lineItemId)
            if (!pl) continue
            const prior = get().grns.filter((g) => g.poId === poId).reduce((s2, g) => s2 + (g.lines.find((x) => x.lineItemId === l.lineItemId)?.quantity ?? 0), 0)
            if (prior + l.quantity > pl.quantity) return { ok: false, error: `${pl.description}: receiving ${l.quantity} would exceed the ordered quantity (${pl.quantity}, already received ${prior}).` }
          }
          const grn: GoodsReceipt = {
            id: uid('grn_'), number: nextNumber('GRN'), poId, poNumber: po.number, vendorName: po.vendorName, receivedBy: a.id, receivedByName: a.name,
            receivedAt: nowIso(), deliveryNoteRef: data.deliveryNoteRef, location: data.location, notes: data.notes, lines, attachments: data.attachments, createdAt: nowIso(),
          }
          const allGrns = [grn, ...get().grns]
          const prog = receiptProgress(po, allGrns)
          const status: PurchaseOrder['status'] = prog.complete ? 'received' : (po.status === 'contracted' ? 'contracted' : 'partially_received')
          set((s) => ({ grns: allGrns, pos: s.pos.map((p) => (p.id === poId ? { ...p, status, updatedAt: nowIso() } : p)) }))
          log('GRN', 'Goods receipt posted', grn, `${po.number} · ${prog.received}/${prog.ordered} received`)
          // re-evaluate any open invoices on this PO
          get().invoices.filter((i) => i.poId === poId && ['registered', 'exception', 'matched'].includes(i.status)).forEach((i) => get().rematchInvoice(i.id))
          notifyRole('finance', { kind: 'info', title: prog.complete ? 'PO fully received' : 'Goods receipt posted', body: `${grn.number} · ${po.number} · ${po.vendorName}`, link: `/receiving/${poId}` })
          const pr = get().prs.find((p) => p.id === po.prId)
          if (pr) notify(pr.requesterId, { kind: 'success', title: prog.complete ? 'Your order has been fully received' : 'Goods received', body: `${po.number} · ${prog.received}/${prog.ordered} units`, link: `/receiving/${poId}` })
          return { ok: true, grnId: grn.id }
        },

        // ---- Invoices ------------------------------------------------------
        registerInvoice: (data) => {
          const po = get().pos.find((p) => p.id === data.poId)
          const a = actor()
          if (!po) return { ok: false, error: 'Purchase order not found.' }
          if (!data.vendorInvoiceNo.trim()) return { ok: false, error: 'Vendor invoice number is required.' }
          const lines = data.lines.filter((l) => l.quantity > 0)
          if (!lines.length) return { ok: false, error: 'Enter at least one invoice line.' }
          const inv: Invoice = {
            id: uid('inv_'), number: nextNumber('INV'), vendorInvoiceNo: data.vendorInvoiceNo.trim(), poId: po.id, poNumber: po.number, vendorId: po.vendorId, vendorName: po.vendorName,
            ownerName: DOC_OWNER, registeredBy: a.id, registeredByName: a.name, invoiceDate: data.invoiceDate, dueDate: data.dueDate, currency: po.currency, lines, taxRate: data.taxRate,
            status: 'registered', matchIssues: [], approvalChain: [], attachments: data.attachments, createdAt: nowIso(), updatedAt: nowIso(), comments: [],
          }
          const issues = runMatch(inv, po, get().grns, get().invoices, get().settings.priceTolerancePct)
          inv.matchIssues = issues
          inv.status = hasBlockingIssues(issues) ? 'exception' : 'matched'
          set((s) => ({ invoices: [inv, ...s.invoices] }))
          log('INVOICE', 'Invoice registered', inv, `${po.vendorName} · ${inv.vendorInvoiceNo} · ${inv.status === 'matched' ? '3-way match OK' : `${issues.length} exception(s)`}`)
          return { ok: true, invoiceId: inv.id }
        },
        updateInvoice: (id, patch) => set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: nowIso() } : i)) })),
        rematchInvoice: (id) => {
          const inv = get().invoices.find((i) => i.id === id)
          const po = inv && get().pos.find((p) => p.id === inv.poId)
          if (!inv || !po || !['registered', 'exception', 'matched'].includes(inv.status)) return
          const issues = runMatch(inv, po, get().grns, get().invoices, get().settings.priceTolerancePct)
          const status: Invoice['status'] = hasBlockingIssues(issues) ? 'exception' : 'matched'
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, matchIssues: issues, status, matchOverrideReason: undefined, updatedAt: nowIso() } : i)) }))
        },
        overrideMatch: (id, reason) => {
          const inv = get().invoices.find((i) => i.id === id)
          if (!inv) return { ok: false, error: 'Not found' }
          if (!reason.trim()) return { ok: false, error: 'An override reason is required.' }
          if (inv.matchIssues.some((x) => x.kind === 'duplicate_invoice')) return { ok: false, error: 'Duplicate invoices cannot be overridden — reject this invoice instead.' }
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: 'matched', matchOverrideReason: reason, updatedAt: nowIso() } : i)) }))
          log('INVOICE', 'Match exceptions overridden', inv, reason)
          return { ok: true }
        },
        submitInvoice: (id) => {
          const inv = get().invoices.find((i) => i.id === id)
          if (!inv) return { ok: false, error: 'Not found' }
          if (!['matched', 'returned'].includes(inv.status)) return { ok: false, error: 'Invoice must pass the 3-way match (or be overridden) before approval.' }
          const amount = invoiceTotals(inv.lines, inv.taxRate).subtotal
          const chain = inv.status === 'returned' && inv.approvalChain.length ? resetChain(inv.approvalChain) : buildChain(get().rules, get().users, 'INVOICE', amount)
          if (!chain.length) return { ok: false, error: 'No invoice approval rule matches this amount.' }
          const upd = { ...inv, status: 'pending_approval' as const, approvalChain: chain, updatedAt: nowIso() }
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? upd : i)) }))
          log('INVOICE', 'Invoice submitted for approval', inv)
          notifyCurrentApprover('INVOICE', { ...upd, title: `${upd.vendorName} · ${upd.vendorInvoiceNo}` })
          return { ok: true }
        },
        decideInvoice: (id, decision, comment, delegateTo) => {
          const inv = get().invoices.find((i) => i.id === id)
          const a = actor()
          if (!inv) return { ok: false, error: 'Not found' }
          if (inv.status !== 'pending_approval') return { ok: false, error: 'Invoice is not awaiting approval.' }
          if (decision !== 'approved' && !comment?.trim()) return { ok: false, error: 'A comment is required for this decision.' }
          const { chain, outcome } = applyDecision(inv.approvalChain, decision, a, comment, delegateTo)
          let status: Invoice['status'] = inv.status
          if (outcome === 'completed') status = 'approved'
          if (outcome === 'rejected') status = 'rejected'
          if (outcome === 'returned') status = 'returned'
          const upd = { ...inv, approvalChain: chain, status, updatedAt: nowIso() }
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? upd : i)) }))
          log('INVOICE', `Step ${decision}`, inv, comment)
          const link = `/invoices/${inv.id}`
          if (outcome === 'advanced') notifyCurrentApprover('INVOICE', { ...upd, title: `${upd.vendorName} · ${upd.vendorInvoiceNo}` })
          if (outcome === 'delegated') notify(delegateTo, { kind: 'approval', title: 'Invoice approval delegated to you', body: `${inv.number} · ${inv.vendorName}`, link })
          if (outcome === 'completed') { notify(inv.registeredBy, { kind: 'success', title: 'Invoice approved for payment', body: `${inv.number} · ${inv.vendorName}`, link }); notifyRole('finance', { kind: 'info', title: 'Invoice ready for payment', body: `${inv.number} · ${inv.vendorName}`, link }) }
          if (outcome === 'rejected' || outcome === 'returned') notify(inv.registeredBy, { kind: 'warning', title: `Invoice ${outcome}`, body: `${inv.number}: ${comment}`, link })
          return { ok: true }
        },
        payInvoice: (id, payment) => {
          const inv = get().invoices.find((i) => i.id === id)
          const a = actor()
          if (!inv) return { ok: false, error: 'Not found' }
          if (inv.status !== 'approved') return { ok: false, error: 'Only approved invoices can be paid.' }
          if (!payment.reference.trim()) return { ok: false, error: 'Payment reference is required.' }
          const amount = invoiceTotals(inv.lines, inv.taxRate).total
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: 'paid', payment: { ...payment, paidBy: a.id, paidByName: a.name, amount }, updatedAt: nowIso() } : i)) }))
          log('INVOICE', 'Payment recorded', inv, `${payment.method} · ${payment.reference} · ${amount.toFixed(2)}`)
          // close PO when fully received and fully paid
          const po = get().pos.find((p) => p.id === inv.poId)
          if (po && po.status === 'received') {
            const paid = get().invoices.filter((i) => i.poId === po.id && i.status === 'paid').reduce((s2, i) => s2 + invoiceTotals(i.lines, i.taxRate).total, 0)
            const poTotal = po.lines.reduce((s2, l) => s2 + l.quantity * l.unitPrice, 0) * (1 + po.taxRate / 100)
            if (paid >= poTotal - 0.01) {
              set((s) => ({ pos: s.pos.map((p) => (p.id === po.id ? { ...p, status: 'closed', updatedAt: nowIso() } : p)), prs: s.prs.map((p) => (p.id === po.prId ? { ...p, status: 'closed', updatedAt: nowIso() } : p)) }))
              log('PO', 'Purchase order closed — fully received and paid', po)
            }
          }
          notify(inv.registeredBy, { kind: 'success', title: 'Invoice paid', body: `${inv.number} · ${inv.vendorName} · ${payment.reference}`, link: `/invoices/${inv.id}` })
          return { ok: true }
        },
        rejectInvoiceAtRegistration: (id, reason) => {
          const inv = get().invoices.find((i) => i.id === id)
          if (!inv) return
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: 'rejected', updatedAt: nowIso() } : i)) }))
          log('INVOICE', 'Invoice rejected', inv, reason)
        },
        addInvoiceComment: (id, text) => {
          const a = actor()
          const c: Comment = { id: uid('c_'), authorId: a.id, authorName: a.name, at: nowIso(), text }
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, comments: [...i.comments, c] } : i)) }))
        },

        // ---- Budgets -------------------------------------------------------
        upsertBudget: (b) => {
          const exists = get().budgets.some((x) => x.id === b.id)
          set((s) => ({ budgets: exists ? s.budgets.map((x) => (x.id === b.id ? b : x)) : [b, ...s.budgets] }))
          log('BUDGET', exists ? 'Budget updated' : 'Approved budget uploaded', { id: b.id, number: b.donorCode }, `${b.lines.length} line(s) · ${b.currency} ${b.lines.reduce((t, l) => t + l.amount, 0).toLocaleString()}`)
        },
        deleteBudget: (id) => { const b = get().budgets.find((x) => x.id === id); set((s) => ({ budgets: s.budgets.filter((x) => x.id !== id) })); if (b) log('BUDGET', 'Budget removed', { id: b.id, number: b.donorCode }) },
        setTemplate: (kind, file) => { set((s) => ({ settings: { ...s.settings, templates: { ...s.settings.templates, [kind]: file } } })); log('SETTINGS', file ? `${kind === 'bva' ? 'BvA' : 'Budget'} template uploaded` : `${kind === 'bva' ? 'BvA' : 'Budget'} template removed`, undefined, file?.name) },

        // ---- Master budget -------------------------------------------------
        createMasterBudget: (year, copyFromId) => {
          const a = actor(); const src = copyFromId ? get().masterBudgets.find((m) => m.id === copyFromId) : undefined
          const mb: MasterBudget = { id: uid('mb_'), year, currency: src?.currency ?? get().settings.defaultCurrency, status: 'draft', createdBy: a.id, createdByName: a.name, createdAt: nowIso(), ownerName: DOC_OWNER,
            lines: (src?.lines ?? []).map((l, i) => ({ ...l, id: uid('ml_'), code: `MB-${year}-${String(i + 1).padStart(3, '0')}`, filledAt: undefined })) }
          set((s) => ({ masterBudgets: [mb, ...s.masterBudgets] }))
          log('MASTER', `Master budget ${year} created`, { id: mb.id, number: `MB-${year}` }, src ? `copied from ${src.year}` : undefined)
          return mb
        },
        upsertMasterLine: (mbId, line) => {
          const a = actor()
          set((s) => ({ masterBudgets: s.masterBudgets.map((m) => (m.id === mbId ? { ...m, lines: m.lines.some((l) => l.id === line.id) ? m.lines.map((l) => (l.id === line.id ? { ...line, filledAt: nowIso() } : l)) : [...m.lines, { ...line, filledAt: nowIso() }] } : m)) }))
          log('MASTER', 'Master line updated', { id: mbId, number: line.code }, `${line.accountName} · ${line.amount} · by ${a.name}`)
        },
        deleteMasterLine: (mbId, lineId) => set((s) => ({ masterBudgets: s.masterBudgets.map((m) => (m.id === mbId ? { ...m, lines: m.lines.filter((l) => l.id !== lineId) } : m)), budgets: s.budgets.map((b) => ({ ...b, lines: b.lines.map((l) => (l.masterLineId === lineId ? { ...l, masterLineId: undefined } : l)) })) })),
        approveMasterBudget: (mbId) => {
          const a = actor(); const mb = get().masterBudgets.find((m) => m.id === mbId)
          if (!mb) return { ok: false, error: 'Not found' }
          if (!['finance_director', 'executive_director', 'admin'].includes(a.role)) return { ok: false, error: 'Only the Director of Finance & Support (or the ED) approves the master budget.' }
          if (!mb.lines.length) return { ok: false, error: 'Add lines first.' }
          set((s) => ({ masterBudgets: s.masterBudgets.map((m) => (m.id === mbId ? { ...m, status: 'approved', approvedBy: a.id, approvedByName: a.name, approvedAt: nowIso() } : m)) }))
          log('MASTER', `Master budget ${mb.year} approved`, { id: mb.id, number: `MB-${mb.year}` }, `${mb.lines.length} lines · ${mb.lines.reduce((t, l) => t + l.amount, 0).toLocaleString()} ${mb.currency}`)
          notifyRole('programs_director', { kind: 'info', title: `Master budget ${mb.year} approved`, body: 'Project budgets should reference its lines', link: '/finance/master-budget' })
          return { ok: true }
        },
        reopenMasterBudget: (mbId) => set((s) => ({ masterBudgets: s.masterBudgets.map((m) => (m.id === mbId ? { ...m, status: 'draft' } : m)) })),
        setBudgetLineMaster: (budgetId, lineId, masterLineId) => set((s) => ({ budgets: s.budgets.map((b) => (b.id === budgetId ? { ...b, lines: b.lines.map((l) => (l.id === lineId ? { ...l, masterLineId } : l)) } : b)) })),
        setCountry: (c) => set({ country: c }),
        // ---- Partnerships --------------------------------------------------
        createPartner: (data) => {
          const a = actor()
          const p: Partner = {
            id: uid('ptn_'), code: nextNumber('PT'), acronym: '', type: 'local_ngo', country: get().settings.countries[0], address: '', website: '', focalName: '', focalTitle: '', focalEmail: '', focalPhone: '', sectors: [],
            stage: 'identified', stageHistory: [{ stage: 'identified', at: nowIso(), byName: a.name }], dueDiligence: emptyDueDiligence(), notes: '', ownerName: DOC_OWNER,
            createdBy: a.id, createdByName: a.name, createdAt: nowIso(), updatedAt: nowIso(), ...data,
          }
          set((s) => ({ partners: [p, ...s.partners] }))
          log('PARTNER', 'Partner added', { id: p.id, number: p.code }, p.name)
          return p
        },
        updatePartner: (id, patch) => { set((s) => ({ partners: s.partners.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p)) })) },
        deletePartner: (id) => {
          const p = get().partners.find((x) => x.id === id); if (!p) return
          set((s) => ({ partners: s.partners.filter((x) => x.id !== id), projects: s.projects.map((pr) => (pr.partnerIds?.includes(id) ? { ...pr, partnerIds: pr.partnerIds.filter((x) => x !== id) } : pr)) }))
          log('PARTNER', 'Partner removed', { id: p.id, number: p.code }, p.name)
        },
        advancePartner: (id, stage, note) => {
          const p = get().partners.find((x) => x.id === id); if (!p) return { ok: false, error: 'Partner not found' }
          const a = actor()
          if (stage === 'approved' && !['approved', 'approved_conditions'].includes(p.dueDiligence.decision.outcome)) return { ok: false, error: 'Record an approval decision on the Risks & decision tab first.' }
          if (stage === 'active' && !p.agreement?.reference) return { ok: false, error: 'Enter the agreement reference and dates before activating the partnership.' }
          set((s) => ({ partners: s.partners.map((x) => (x.id === id ? { ...x, stage, stageHistory: [...x.stageHistory, { stage, at: nowIso(), byName: a.name, note }], updatedAt: nowIso() } : x)) }))
          log('PARTNER', `Partner moved to ${stage.replace('_', ' ')}`, { id: p.id, number: p.code }, note)
          return { ok: true }
        },
        updateDueDiligence: (id, fn) => set((s) => ({ partners: s.partners.map((p) => (p.id === id ? { ...p, dueDiligence: fn(p.dueDiligence), updatedAt: nowIso() } : p)) })),
        decidePartner: (id, outcome, conditions) => {
          const a = actor(); const p = get().partners.find((x) => x.id === id); if (!p) return
          set((s) => ({ partners: s.partners.map((x) => (x.id === id ? { ...x, dueDiligence: { ...x.dueDiligence, decision: { outcome, conditions, decidedBy: a.id, decidedByName: a.name, decidedAt: nowIso() } }, updatedAt: nowIso(), ...(outcome === 'declined' ? { stage: 'declined' as PartnerStage, stageHistory: [...x.stageHistory, { stage: 'declined' as PartnerStage, at: nowIso(), byName: a.name, note: conditions }] } : {}) } : x)) }))
          log('PARTNER', `Due diligence decision: ${outcome.replace('_', ' ')}`, { id: p.id, number: p.code }, conditions)
        },
        shareVetting: (id, message) => {
          const a = actor(); const token = uid('vt_') + uid('')
          set((s) => ({ partners: s.partners.map((p) => (p.id === id ? { ...p, dueDiligence: { ...p.dueDiligence, vetting: { ...p.dueDiligence.vetting, share: { token, sharedAt: nowIso(), sharedBy: a.id, sharedByName: a.name, status: 'open', message } } }, updatedAt: nowIso() } : p)) }))
          const p = get().partners.find((x) => x.id === id)!
          log('PARTNER', 'Vetting form shared with partner', { id: p.id, number: p.code }, p.focalEmail)
          return token
        },
        revokeVetting: (id) => set((s) => ({ partners: s.partners.map((p) => (p.id === id && p.dueDiligence.vetting.share ? { ...p, dueDiligence: { ...p.dueDiligence, vetting: { ...p.dueDiligence.vetting, share: { ...p.dueDiligence.vetting.share, status: 'revoked' } } } } : p)) })),
        reopenVetting: (id) => set((s) => ({ partners: s.partners.map((p) => (p.id === id && p.dueDiligence.vetting.share ? { ...p, dueDiligence: { ...p.dueDiligence, vetting: { ...p.dueDiligence.vetting, share: { ...p.dueDiligence.vetting.share, status: 'open' } } } } : p)) })),
        submitPartnerVetting: (token, sub) => {
          const p = get().partners.find((x) => x.dueDiligence.vetting.share?.token === token)
          if (!p || !p.dueDiligence.vetting.share) return { ok: false, error: 'This link is not valid.' }
          if (p.dueDiligence.vetting.share.status !== 'open') return { ok: false, error: 'This form is no longer open for submission.' }
          const submission: PartnerSubmission = { ...sub, submittedAt: nowIso() }
          set((s) => ({ partners: s.partners.map((x) => (x.id === p.id ? { ...x, updatedAt: nowIso(), dueDiligence: { ...x.dueDiligence, vetting: { ...x.dueDiligence.vetting, submission, share: { ...x.dueDiligence.vetting.share!, status: 'submitted' },
            // partner-provided key personnel and links pre-fill the RHS vetting tables (existing RHS entries are kept)
            keyPersonnel: [...x.dueDiligence.vetting.keyPersonnel.filter((k) => !submission.keyPersonnel.some((n) => n.name.trim().toLowerCase() === k.name.trim().toLowerCase())), ...submission.keyPersonnel.map((k) => ({ ...k, verification: k.verification || 'ATC', atcClear: 'pending' as const }))],
            online: x.dueDiligence.vetting.online.map((o) => ({ ...o, url: o.url || (submission.online.find((l) => l.platform === o.platform)?.url ?? '') })),
          } } } : x)) }))
          set((s) => ({ audit: [{ id: uid('a_'), at: nowIso(), actorId: 'partner', actorName: `${sub.byName} (${p.name})`, docType: 'PARTNER' as const, docId: p.id, docNumber: p.code, action: 'Partner submitted the vetting form', detail: `${sub.keyPersonnel.length} key personnel · signed ${sub.signature}` }, ...s.audit].slice(0, 500) }))
          const n = { kind: 'info' as const, title: `${p.acronym || p.name} submitted its vetting form`, body: `${sub.byName} · ${sub.keyPersonnel.length} key personnel listed — ready for ATC and checks`, link: `/partnerships/${p.id}?tab=vetting` }
          notify(p.dueDiligence.vetting.share.sharedBy, n); notifyRole('legal', n); notifyRole('programs_director', n)
          return { ok: true }
        },
        completeVetting: (id) => { const a = actor(); set((s) => ({ partners: s.partners.map((p) => (p.id === id ? { ...p, dueDiligence: { ...p.dueDiligence, vetting: { ...p.dueDiligence.vetting, completedAt: nowIso(), completedBy: a.id, completedByName: a.name } } } : p)) })); const p = get().partners.find((x) => x.id === id)!; log('PARTNER', 'Vetting completed', { id: p.id, number: p.code }) },
        setPartnerAgreement: (id, agreement) => { set((s) => ({ partners: s.partners.map((p) => (p.id === id ? { ...p, agreement, updatedAt: nowIso() } : p)) })); const p = get().partners.find((x) => x.id === id)!; log('PARTNER', 'Agreement details updated', { id: p.id, number: p.code }, agreement.reference) },

        // ---- Master salary plan ------------------------------------------------
        upsertStaff: (data) => {
          const exists = data.id ? get().staff.find((x) => x.id === data.id) : undefined
          const st: StaffMember = exists ? { ...exists, ...data, updatedAt: nowIso() } : { id: uid('stf_'), rhsNumber: data.rhsNumber || nextRhsNumber(get().staff), name: '', department: '', country: get().settings.countries[0], contractType: 'full_time', monthlySalary: 0, currency: get().settings.defaultCurrency, startDate: nowIso().slice(0, 10), status: 'active', createdAt: nowIso(), updatedAt: nowIso(), ...data } as StaffMember
          set((s) => ({ staff: exists ? s.staff.map((x) => (x.id === st.id ? st : x)) : [...s.staff, st] }))
          log('STAFF', exists ? 'Staff record updated' : 'Staff added to the master salary plan', { id: st.id, number: st.rhsNumber }, `${st.name || '(to recruit)'} · ${st.position}`)
          return st
        },
        deleteStaff: (id) => {
          const st = get().staff.find((x) => x.id === id); if (!st) return
          set((s) => ({ staff: s.staff.filter((x) => x.id !== id), budgets: s.budgets.map((b) => ({ ...b, lines: b.lines.map((l) => (l.staffIds?.includes(id) ? { ...l, staffIds: l.staffIds.filter((x) => x !== id) } : l)) })) }))
          log('STAFF', 'Staff removed from the master salary plan', { id: st.id, number: st.rhsNumber }, st.name || st.position)
        },
        confirmRecruitment: (id, name, startDate) => {
          set((s) => ({ staff: s.staff.map((x) => (x.id === id ? { ...x, name, startDate, status: 'active', updatedAt: nowIso() } : x)) }))
          const st = get().staff.find((x) => x.id === id)!; log('STAFF', 'Position filled', { id: st.id, number: st.rhsNumber }, `${name} · ${st.position}`)
        },

        setUiTheme: (t) => set({ uiTheme: t }),
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
        setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

        // ---- Grants / PCM --------------------------------------------------
        createProject: (data) => {
          const a = actor()
          const budget: ProjectBudget = { id: uid('bud_'), donorCode: data.code, name: data.title, donor: data.donorName ?? '', currency: data.currency ?? get().settings.defaultCurrency, startDate: data.startDate, endDate: data.endDate, duration: data.duration, locations: data.locations, status: 'draft', lines: [], uploadedBy: a.id, uploadedByName: a.name, uploadedAt: nowIso(), ownerName: DOC_OWNER, notes: 'Created with the project — under development' }
          const p: Project = {
            id: uid('prj_'), summary: '', donorName: '', stage: 'development', currency: get().settings.defaultCurrency, countries: [], sectors: [], teamIds: [], managerId: a.id, managerName: a.name,
            proposal: { sections: [], attachments: [] }, logframe: [], workplan: [], spendingPlan: [], iptt: [], reports: [], comments: [],
            stageHistory: [{ stage: 'development', at: nowIso(), byName: a.name }], createdBy: a.id, createdByName: a.name, createdAt: nowIso(), updatedAt: nowIso(), ownerName: DOC_OWNER,
            ...data, budgetId: budget.id,
          }
          set((s) => ({ projects: [p, ...s.projects], budgets: [budget, ...s.budgets] }))
          log('PROJECT', 'Project created', { id: p.id, number: p.code }, p.title)
          return p
        },
        updateProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p)) })),
        advanceProject: (id, stage, opts = {}) => {
          const p = get().projects.find((x) => x.id === id); const a = actor()
          if (!p) return { ok: false, error: 'Not found' }
          const budget = get().budgets.find((b) => b.id === p.budgetId)
          let patch: Partial<Project> = { stage, stageHistory: [...p.stageHistory, { stage, at: nowIso(), byName: a.name, note: opts.note }] }
          if (stage === 'submitted') {
            if (!allIndicators(p.logframe).length) return { ok: false, error: 'Add the logframe with at least one indicator before submitting — the IPTT is generated from it.' }
            if (!budget?.lines.length) return { ok: false, error: 'The budget has no lines yet.' }
            const open = unassignedSalaryLines(budget.lines)
            if (open.length) return { ok: false, error: `Salary lines must carry a staff RHS number or be marked as a new position before submission: ${open.map((l) => l.code).join(', ')} (Budget tab).` }
            patch = { ...patch, submittedAt: nowIso(), iptt: generateIPTT(p), ipttGeneratedAt: nowIso(), requestedAmount: p.requestedAmount ?? budget.lines.reduce((s2, l) => s2 + l.amount, 0) }
          }
          if (stage === 'granted') {
            if (!['submitted', 'development'].includes(p.stage)) return { ok: false, error: 'Only a submitted proposal can be granted.' }
            const start = opts.startDate ?? p.startDate, end = opts.endDate ?? p.endDate
            const months = monthsOf(start, end)
            patch = { ...patch, grantedAt: nowIso(), outcome: 'funded', awardedAmount: opts.awardedAmount ?? p.requestedAmount ?? budget?.lines.reduce((s2, l) => s2 + l.amount, 0), startDate: start, endDate: end,
              iptt: generateIPTT(p), ipttGeneratedAt: p.ipttGeneratedAt ?? nowIso(), spendingPlan: p.spendingPlan.length ? p.spendingPlan : generateSpendingPlan(budget?.lines ?? [], months), reports: p.reports.length ? p.reports : generateReportingCalendar({ ...p, startDate: start, endDate: end }) }
            if (budget) {
              // New positions in the approved budget join the master salary plan as "to recruit", one per unit, with an RHS number
              const created: StaffMember[] = []; const lineStaff: Record<string, string[]> = {}
              for (const l of budget.lines) {
                if (!isSalaryLine(l) || !l.newStaff) continue
                const ids: string[] = []
                for (let i = 0; i < headcount(l); i++) {
                  const n = nextRhsNumber([...get().staff, ...created])
                  const st: StaffMember = { id: uid('stf_'), rhsNumber: n, name: '', position: headcount(l) > 1 ? `${l.description} (${i + 1}/${headcount(l)})` : l.description, department: p.sectors[0] ?? 'Programs', country: p.countries[0] ?? get().settings.countries[0], contractType: 'full_time', monthlySalary: l.unitCost ?? Math.round(l.amount / headcount(l) / Math.max(1, l.frequency ?? 1)), currency: budget.currency, startDate: start ?? nowIso().slice(0, 10), endDate: end, status: 'planned', sourceProjectId: p.id, sourceProjectCode: p.code, sourceLineCode: l.code, notes: `New position from approved budget ${p.code} line ${l.code}`, createdAt: nowIso(), updatedAt: nowIso() }
                  created.push(st); ids.push(st.id)
                }
                lineStaff[l.id] = ids
              }
              set((s) => ({ staff: [...s.staff, ...created], budgets: s.budgets.map((b) => (b.id === budget.id ? { ...b, status: 'active', approvedAt: nowIso().slice(0, 10), startDate: start, endDate: end, notes: `Approved budget — granted ${nowIso().slice(0, 10)}`, lines: b.lines.map((l) => (lineStaff[l.id] ? { ...l, staffIds: lineStaff[l.id], newStaff: false } : l)) } : b)) }))
              if (created.length) { log('STAFF', `${created.length} new position(s) added to the master salary plan`, { id: p.id, number: p.code }, created.map((c) => `${c.rhsNumber} ${c.position}`).join(', ')); notifyRole('finance_director', { kind: 'task', title: `${created.length} new position(s) to recruit — ${p.code}`, body: created.map((c) => `${c.rhsNumber} ${c.position}`).join(', '), link: '/finance/salary-plan' }) }
            }
          }
          if (stage === 'active') { if (p.stage !== 'granted') return { ok: false, error: 'A project is activated after it is granted.' }; patch = { ...patch, activatedAt: nowIso() } }
          if (stage === 'closed') {
            patch = { ...patch, closedAt: nowIso(), closeoutNote: opts.note, outcome: opts.outcome ?? (['granted', 'active'].includes(p.stage) ? 'funded' : 'not_funded') }
            if (budget) set((s) => ({ budgets: s.budgets.map((b) => (b.id === budget.id ? { ...b, status: 'closed' } : b)) }))
          }
          if (stage === 'development' && p.stage !== 'submitted') return { ok: false, error: 'Only a submitted proposal can be returned to development.' }
          get().updateProject(id, patch)
          log('PROJECT', `Stage → ${stage}`, { id: p.id, number: p.code }, opts.note)
          const team = new Set([p.managerId, ...p.teamIds].filter(Boolean) as string[])
          team.forEach((u) => notify(u, { kind: 'info', title: `${p.code} is now ${stage}`, body: p.title, link: `/grants/${p.id}` }))
          if (stage === 'granted') notifyRole('finance_director', { kind: 'success', title: `Grant approved: ${p.code}`, body: `${p.title} — budget now open to requisitions and BvA`, link: `/budgets/${p.budgetId}` })
          return { ok: true }
        },
        addProjectComment: (id, text) => {
          const a = actor(); const p = get().projects.find((x) => x.id === id); if (!p) return
          const mentions = parseMentions(text, get().users).filter((u) => u !== a.id)
          const c: ProjectComment = { id: uid('c_'), authorId: a.id, authorName: a.name, at: nowIso(), text, mentions }
          set((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, comments: [...x.comments, c], updatedAt: nowIso() } : x)) }))
          mentions.forEach((u) => notify(u, { kind: 'info', title: `${a.name} mentioned you on ${p.code}`, body: text.slice(0, 120), link: `/grants/${p.id}?tab=team` }))
        },
        addReport: (projectId, r) => set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, reports: [...p.reports, { ...r, id: uid('rep_'), status: 'upcoming', attachments: [] }], updatedAt: nowIso() } : p)) })),
        updateReport: (projectId, reportId, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, reports: p.reports.map((r) => (r.id === reportId ? { ...r, ...patch } : r)), updatedAt: nowIso() } : p)) })),
        submitReport: (projectId, reportId, attachments, notes) => {
          const a = actor(); const p = get().projects.find((x) => x.id === projectId); if (!p) return
          get().updateReport(projectId, reportId, { status: 'submitted', submittedAt: nowIso(), submittedBy: a.id, submittedByName: a.name, attachments, notes })
          log('PROJECT', 'Report submitted', { id: p.id, number: p.code }, p.reports.find((r) => r.id === reportId)?.title)
        },
        runReminders: () => {
          let n = 0; const now = new Date()
          for (const p of get().projects.filter((x) => ['granted', 'active'].includes(x.stage))) for (const r of p.reports) {
            const live = reportLiveStatus(r, now)
            if ((live === 'due' || live === 'overdue') && (!r.remindedAt || (now.getTime() - new Date(r.remindedAt).getTime()) > 3 * 86400000)) {
              get().updateReport(p.id, r.id, { remindedAt: nowIso(), status: live })
              const team = new Set([p.managerId, ...p.teamIds].filter(Boolean) as string[])
              team.forEach((u) => notify(u, { kind: 'reminder', title: live === 'overdue' ? `OVERDUE: ${r.title}` : `Report due ${fmtDue(r.dueDate)}: ${r.title}`, body: `${p.code} · ${p.donorName}`, link: `/grants/${p.id}?tab=reports` })); n++
            } else if (live !== r.status && !['submitted', 'approved'].includes(r.status)) get().updateReport(p.id, r.id, { status: live })
          }
          return n
        },
        upsertDonor: (d) => { const exists = get().donors.some((x) => x.id === d.id); set((s) => ({ donors: exists ? s.donors.map((x) => (x.id === d.id ? d : x)) : [d, ...s.donors] })); log('DONOR', exists ? 'Donor updated' : 'Donor added', { id: d.id, number: d.name }) },
        deleteDonor: (id) => set((s) => ({ donors: s.donors.filter((d) => d.id !== id) })),
        createTask: (t) => {
          const a = actor()
          const task: Task = { ...t, id: uid('task_'), status: t.status ?? 'open', createdBy: a.id, createdByName: a.name, createdAt: nowIso() }
          set((s) => ({ tasks: [task, ...s.tasks] }))
          log('TASK', 'Task assigned', { id: task.id, number: task.projectCode ?? 'TASK' }, `${task.title} → ${task.assigneeName}`)
          if (task.assigneeId !== a.id) notify(task.assigneeId, { kind: 'task', title: `New task from ${a.name}: ${task.title}`, body: `${task.projectCode ? `${task.projectCode} · ` : ''}${task.dueDate ? `due ${fmtDue(task.dueDate)}` : 'no due date'}`, link: task.link ?? '/tasks' })
          return task
        },
        updateTask: (id, patch) => {
          const t = get().tasks.find((x) => x.id === id); const a = actor()
          set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch, completedAt: patch.status === 'done' ? nowIso() : patch.status ? undefined : x.completedAt } : x)) }))
          if (t && patch.status === 'done' && t.createdBy !== a.id) notify(t.createdBy, { kind: 'success', title: `Task completed: ${t.title}`, body: `by ${a.name}`, link: t.link ?? '/tasks' })
        },

        // ---- E-Signature ---------------------------------------------------
        createEnvelope: (data) => {
          const a = actor()
          const env: Envelope = { id: uid('env_'), number: nextNumber('ENV'), status: 'draft', events: [newEvent(a.id, a.name, 'Envelope created', data.documentName)], createdBy: a.id, createdByName: a.name, createdAt: nowIso(), ownerName: DOC_OWNER, ...data }
          set((s) => ({ envelopes: [env, ...s.envelopes] }))
          log('ESIGN', 'Envelope created', env, data.documentName)
          return env
        },
        updateEnvelope: (id, patch) => set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
        sendEnvelope: (id) => {
          const env = get().envelopes.find((e) => e.id === id)
          const a = actor()
          if (!env) return { ok: false, error: 'Not found' }
          if (env.status !== 'draft') return { ok: false, error: 'Envelope already sent.' }
          const actors = env.recipients.filter((r) => r.role !== 'cc')
          if (!actors.length) return { ok: false, error: 'Add at least one signer or approver.' }
          for (const r of env.recipients.filter((x) => x.role === 'signer')) if (!env.fields.some((f) => f.recipientId === r.id && f.type === 'signature')) return { ok: false, error: `${r.name} has no signature field — place one on the document.` }
          const firstOrder = Math.min(...actors.map((r) => r.order))
          const recipients: EnvelopeRecipient[] = env.recipients.map((r) => {
            const active = r.role === 'cc' ? false : env.signingOrder === 'parallel' || r.order === firstOrder
            return { ...r, status: active ? 'sent' : 'pending', sentAt: active ? nowIso() : undefined }
          })
          const upd: Envelope = { ...env, status: 'sent', sentAt: nowIso(), recipients, events: [...env.events, newEvent(a.id, a.name, 'Envelope sent', `${actors.length} recipient(s) · ${env.signingOrder}`)] }
          set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? upd : e)) }))
          log('ESIGN', 'Envelope sent', env, env.subject)
          recipients.filter((r) => r.status === 'sent' && r.userId).forEach((r) => notify(r.userId, { kind: 'approval', title: `${r.role === 'approver' ? 'Approval' : 'Signature'} requested: ${env.subject}`, body: `${env.number} · from ${a.name}`, link: `/esign/${env.id}` }))
          return { ok: true }
        },
        markEnvelopeViewed: (id, recipientId) => {
          const env = get().envelopes.find((e) => e.id === id); const r = env?.recipients.find((x) => x.id === recipientId)
          if (!env || !r || r.status !== 'sent') return
          const a = actor()
          set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? { ...e, recipients: e.recipients.map((x) => (x.id === recipientId ? { ...x, status: 'viewed', viewedAt: nowIso() } : x)), events: [...e.events, newEvent(a.id, a.name, 'Envelope viewed')] } : e)) }))
        },
        completeRecipient: (id, recipientId, values, method) => {
          const env = get().envelopes.find((e) => e.id === id)
          const a = actor()
          if (!env) return { ok: false, error: 'Not found' }
          if (env.status !== 'sent') return { ok: false, error: 'This envelope is not open for signing.' }
          const r = env.recipients.find((x) => x.id === recipientId)
          if (!r || !['sent', 'viewed'].includes(r.status)) return { ok: false, error: 'It is not your turn on this envelope.' }
          if (!recipientTurn(env).some((x) => x.id === recipientId)) return { ok: false, error: 'Waiting for an earlier recipient to sign first.' }
          const mine = env.fields.filter((f) => f.recipientId === recipientId)
          const missing = mine.filter((f) => f.required && !(values[f.id] ?? f.value))
          if (missing.length) return { ok: false, error: `Complete all required fields (${missing.map((f) => f.label ?? f.type).join(', ')}).` }
          const fields: EnvelopeField[] = env.fields.map((f) => (f.recipientId === recipientId && values[f.id] !== undefined ? { ...f, value: values[f.id] } : f))
          const done: EnvelopeRecipient['status'] = r.role === 'approver' ? 'approved' : 'signed'
          let recipients = env.recipients.map((x) => (x.id === recipientId ? { ...x, status: done, signedAt: nowIso(), signatureMethod: method } : x))
          const events = [...env.events, newEvent(a.id, a.name, r.role === 'approver' ? 'Approved' : 'Signed', `${mine.length} field(s) completed`)]
          // advance sequential order
          const remaining = recipients.filter((x) => x.role !== 'cc' && ['pending', 'sent', 'viewed'].includes(x.status))
          const toNotify: EnvelopeRecipient[] = []
          if (remaining.length && env.signingOrder === 'sequential') {
            const next = Math.min(...remaining.map((x) => x.order))
            recipients = recipients.map((x) => (x.status === 'pending' && x.order === next ? (toNotify.push({ ...x, status: 'sent' }), { ...x, status: 'sent' as const, sentAt: nowIso() }) : x))
          }
          const completed = remaining.length === 0
          const upd: Envelope = { ...env, fields, recipients: completed ? recipients.map((x) => (x.role === 'cc' ? { ...x, status: 'sent', sentAt: nowIso() } : x)) : recipients, status: completed ? 'completed' : env.status, completedAt: completed ? nowIso() : undefined, events: completed ? [...events, newEvent(a.id, a.name, 'Envelope completed', 'All recipients have signed')] : events }
          set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? upd : e)) }))
          log('ESIGN', r.role === 'approver' ? 'Envelope approved' : 'Envelope signed', env, `${r.name}${completed ? ' · completed' : ''}`)
          toNotify.filter((x) => x.userId).forEach((x) => notify(x.userId, { kind: 'approval', title: `${x.role === 'approver' ? 'Approval' : 'Signature'} requested: ${env.subject}`, body: `${env.number} · your turn`, link: `/esign/${env.id}` }))
          if (completed) { const ids = new Set([env.createdBy, ...env.recipients.map((x) => x.userId).filter(Boolean) as string[]]); ids.forEach((uidv) => notify(uidv, { kind: 'success', title: `Completed: ${env.subject}`, body: `${env.number} · all parties signed`, link: `/esign/${env.id}` })) }
          return { ok: true, completed }
        },
        declineEnvelope: (id, recipientId, reason) => {
          const env = get().envelopes.find((e) => e.id === id); const a = actor()
          if (!env) return { ok: false, error: 'Not found' }
          if (!reason.trim()) return { ok: false, error: 'A reason is required to decline.' }
          set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? { ...e, status: 'declined', recipients: e.recipients.map((x) => (x.id === recipientId ? { ...x, status: 'declined', declineReason: reason, signedAt: nowIso() } : x)), events: [...e.events, newEvent(a.id, a.name, 'Declined', reason)] } : e)) }))
          log('ESIGN', 'Envelope declined', env, reason)
          notify(env.createdBy, { kind: 'warning', title: `Declined: ${env.subject}`, body: `${a.name}: ${reason}`, link: `/esign/${env.id}` })
          return { ok: true }
        },
        voidEnvelope: (id, reason) => {
          const env = get().envelopes.find((e) => e.id === id); const a = actor()
          if (!env) return { ok: false, error: 'Not found' }
          if (env.createdBy !== a.id && a.role !== 'admin') return { ok: false, error: 'Only the sender can void an envelope.' }
          if (env.status === 'completed') return { ok: false, error: 'Completed envelopes cannot be voided.' }
          set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? { ...e, status: 'voided', events: [...e.events, newEvent(a.id, a.name, 'Voided', reason)] } : e)) }))
          log('ESIGN', 'Envelope voided', env, reason)
          env.recipients.filter((r) => r.userId && ['sent', 'viewed'].includes(r.status)).forEach((r) => notify(r.userId, { kind: 'warning', title: `Voided: ${env.subject}`, body: reason, link: `/esign/${env.id}` }))
          return { ok: true }
        },
        deleteEnvelope: (id) => { const env = get().envelopes.find((e) => e.id === id); set((s) => ({ envelopes: s.envelopes.filter((e) => e.id !== id) })); if (env) log('ESIGN', 'Envelope deleted', env) },
        adoptSignature: (dataUrl, method) => { const a = actor(); set((s) => ({ users: s.users.map((u) => (u.id === a.id ? { ...u, signature: { dataUrl, method, adoptedAt: nowIso() } } : u)) })); log('ESIGN', `Signature adopted (${method})`) },
        setInitials: (text) => { const a = actor(); set((s) => ({ users: s.users.map((u) => (u.id === a.id ? { ...u, initials: text } : u)) })) },

        // ---- masters -------------------------------------------------------
        upsertVendor: (v) => {
          const existing = v.id ? get().vendors.find((x) => x.id === v.id) : undefined
          if (existing) {
            set((s) => ({ vendors: s.vendors.map((x) => (x.id === v.id ? { ...x, ...v } : x)) }))
            log('VENDOR', 'Vendor updated', { id: existing.id, number: existing.code })
          } else {
            const code = `VEN-${String(get().vendors.length + 1).padStart(4, '0')}`
            const nv: Vendor = { id: uid('v_'), name: '', code, category: '', contactName: '', email: '', phone: '', country: 'Jordan', taxId: '', rating: 3, status: 'pending', registeredAt: nowIso(), ...v }
            set((s) => ({ vendors: [nv, ...s.vendors] }))
            log('VENDOR', 'Vendor registered', { id: nv.id, number: nv.code }, nv.name)
          }
        },
        upsertUser: (u) => {
          const existing = u.id ? get().users.find((x) => x.id === u.id) : undefined
          if (existing) set((s) => ({ users: s.users.map((x) => (x.id === u.id ? { ...x, ...u } : x)) }))
          else set((s) => ({ users: [...s.users, { id: uid('u_'), name: '', email: '', password: 'rhs2025', role: 'requester', department: 'Operations', title: '', avatarColor: 'bg-ink-600', active: true, ...u }] }))
          log('USER', existing ? 'User updated' : 'User created', undefined, u.name)
        },
        upsertRule: (r) => {
          const exists = get().rules.some((x) => x.id === r.id)
          set((s) => ({ rules: exists ? s.rules.map((x) => (x.id === r.id ? r : x)) : [...s.rules, r] }))
          log('SYSTEM', exists ? 'Approval rule updated' : 'Approval rule created', undefined, r.name)
        },
        deleteRule: (id) => { set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })); log('SYSTEM', 'Approval rule deleted') },
        updateSettings: (patch) => { set((s) => ({ settings: { ...s.settings, ...patch } })); log('SYSTEM', 'Settings updated') },

        // ---- notifications ------------------------------------------------
        markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllRead: () => { const me = get().currentUserId; set((s) => ({ notifications: s.notifications.map((n) => (n.userId === me ? { ...n, read: true } : n)) })) },

        resetDemo: () => set({ ...initial(), currentUserId: get().currentUserId, uiTheme: get().uiTheme, sidebarCollapsed: get().sidebarCollapsed }),
      }
    },
    { name: 'rhs-platform-v7', version: 7 },
  ),
)

// convenience selectors
export const useCurrentUser = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? null)
export const attachmentFromFile = (file: File, by: string): Promise<Attachment> =>
  new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res({ id: uid('att_'), name: file.name, size: file.size, type: file.type, uploadedBy: by, uploadedAt: nowIso(), dataUrl: file.size < 2_000_000 ? String(r.result) : undefined })
    r.readAsDataURL(file)
  })

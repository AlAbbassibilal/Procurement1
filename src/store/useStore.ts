import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ApprovalRule, Attachment, AuditEvent, Comment, Contract, ContractMilestone, LineItem, Notification, OrgSettings,
  PurchaseOrder, PurchaseRequisition, Quotation, User, Vendor, DocType, Role,
} from '@/types'
import { DOC_OWNER, SEED_CONTRACTS, SEED_POS, SEED_PRS, SEED_RULES, SEED_SETTINGS, SEED_USERS, SEED_VENDORS, STANDARD_CLAUSES } from '@/data/seed'
import { applyDecision, buildChain, currentStep, resetChain, resolveApprover } from '@/lib/workflow'
import { linesSubtotal, nowIso, uid } from '@/lib/format'

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
  notifications: [
    { id: 'n1', userId: 'u_rana', at: nowIso(), title: 'Approval required', body: 'PR-2025-0042 · Laptops for field coordinators', link: '/requisitions/pr_2', read: false, kind: 'approval' },
    { id: 'n2', userId: 'u_omar', at: nowIso(), title: 'Approval required', body: 'PR-2025-0043 · Physiotherapy consumables', link: '/requisitions/pr_3', read: false, kind: 'approval' },
    { id: 'n3', userId: 'u_dana', at: nowIso(), title: 'Legal review requested', body: 'CT-2025-0006 · Fleet Maintenance Services Agreement', link: '/contracts/ct_1', read: false, kind: 'approval' },
    { id: 'n4', userId: 'u_lina', at: nowIso(), title: 'Requisition returned', body: 'PR-2025-0038 was returned by Finance for changes', link: '/requisitions/pr_6', read: false, kind: 'warning' },
  ],
  audit: [
    { id: 'a1', at: nowIso(), actorId: 'u_bilal', actorName: DOC_OWNER, docType: 'SYSTEM', action: 'System initialised', detail: 'Demo dataset loaded' },
  ],
  counters: { PR: 44, PO: 17, CT: 6 },
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
      const notify = (userId: string | undefined, n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) => {
        if (!userId) return
        set((s) => ({ notifications: [{ id: uid('n_'), userId, at: nowIso(), read: false, ...n }, ...s.notifications] }))
      }
      const notifyRole = (role: Role, n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) => {
        get().users.filter((u) => u.active && u.role === role).forEach((u) => notify(u.id, n))
      }
      const nextNumber = (t: 'PR' | 'PO' | 'CT') => {
        const n = (get().counters[t] ?? 0) + 1
        set((s) => ({ counters: { ...s.counters, [t]: n } }))
        return `${t}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
      }
      const notifyCurrentApprover = (docType: DocType, doc: { id: string; number: string; title: string; approvalChain: PurchaseRequisition['approvalChain']; department?: string }) => {
        const step = currentStep(doc.approvalChain)
        if (!step) return
        const link = docType === 'PR' ? `/requisitions/${doc.id}` : `/orders/${doc.id}`
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
          const a = actor()
          const pr: PurchaseRequisition = {
            id: uid('pr_'), number: nextNumber('PR'), title: '', justification: '', department: a.department,
            requesterId: a.id, requesterName: a.name, ownerName: DOC_OWNER, priority: 'normal',
            neededBy: '', currency: get().settings.defaultCurrency, lines: [], attachments: [], status: 'draft',
            approvalChain: [], createdAt: nowIso(), updatedAt: nowIso(), quotations: [], comments: [],
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
          const { quotationMinimum, quotationThreshold } = get().settings
          if (!pr) return { ok: false, error: 'Not found' }
          const amount = linesSubtotal(pr.lines)
          if (amount >= quotationThreshold && pr.quotations.length < quotationMinimum)
            return { ok: false, error: `At least ${quotationMinimum} quotations are required for requisitions ≥ ${quotationThreshold} ${pr.currency}. Currently ${pr.quotations.length}.` }
          if (!justification.trim()) return { ok: false, error: 'Award justification is required.' }
          const q = pr.quotations.find((x) => x.id === qId)
          if (!q) return { ok: false, error: 'Quotation not found' }
          set((s) => ({ prs: s.prs.map((p) => (p.id === prId ? { ...p, status: 'awarded', awardedQuotationId: qId, awardJustification: justification, updatedAt: nowIso() } : p)) }))
          log('PR', 'Quotation awarded', pr, `${q.vendorName} · ${q.reference}`)
          notify(pr.requesterId, { kind: 'success', title: 'Vendor selected', body: `${pr.number}: awarded to ${q.vendorName}.`, link: `/requisitions/${pr.id}` })
          return { ok: true }
        },

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
          const chain = po.status === 'returned' && po.approvalChain.length ? resetChain(po.approvalChain) : buildChain(get().rules, get().users, 'PO', amount)
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
          set((s) => ({ contracts: [ct, ...s.contracts], pos: s.pos.map((p) => (p.id === poId ? { ...p, contractId: ct.id, status: 'contracted', updatedAt: nowIso() } : p)) }))
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

        resetDemo: () => set({ ...initial(), currentUserId: get().currentUserId }),
      }
    },
    { name: 'rhs-procurement-v1', version: 1 },
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

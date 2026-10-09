import { Navigate, Route, Routes, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/store/useStore'
import { deptForPath, canEnter } from '@/lib/departments'
import Home from '@/pages/Home'
import NoAccess from '@/pages/NoAccess'
import EnvelopeList from '@/pages/esign/List'
import EnvelopeNew from '@/pages/esign/New'
import EnvelopeDetail from '@/pages/esign/Detail'
import { FinanceHome, PartnershipsHome, HrHome, MediaHome } from '@/pages/departments'
import GrantsOverview from '@/pages/grants/Overview'
import GrantsTracker from '@/pages/grants/Tracker'
import Donors from '@/pages/grants/Donors'
import ProjectNew from '@/pages/grants/New'
import ProjectPage from '@/pages/grants/Project'
import Tasks from '@/pages/Tasks'
import MasterBudgetPage from '@/pages/finance/MasterBudget'
import { useStore } from '@/store/useStore'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Approvals from '@/pages/Approvals'
import RequisitionList from '@/pages/requisitions/List'
import RequisitionForm from '@/pages/requisitions/Form'
import RequisitionDetail from '@/pages/requisitions/Detail'
import SourcingList from '@/pages/sourcing/List'
import SourcingDetail from '@/pages/sourcing/Detail'
import OrderList from '@/pages/orders/List'
import OrderDetail from '@/pages/orders/Detail'
import ContractList from '@/pages/contracts/List'
import ContractDetail from '@/pages/contracts/Detail'
import Vendors from '@/pages/Vendors'
import Users from '@/pages/admin/Users'
import ApprovalMatrix from '@/pages/admin/ApprovalMatrix'
import Settings from '@/pages/admin/Settings'
import Audit from '@/pages/Audit'
import Thresholds from '@/pages/admin/Thresholds'
import BudgetList from '@/pages/budgets/List'
import BudgetUpload from '@/pages/budgets/Upload'
import BudgetDetail from '@/pages/budgets/Detail'
import ReceivingList from '@/pages/receiving/List'
import ReceivingDetail from '@/pages/receiving/Detail'
import InvoiceList from '@/pages/invoices/List'
import InvoiceNew from '@/pages/invoices/New'
import InvoiceDetail from '@/pages/invoices/Detail'

function RequireAuth() {
  const authed = useStore((s) => !!s.currentUserId)
  return authed ? <Outlet /> : <Navigate to="/login" replace />
}

/** Workspace gate: routes owned by a department require access to it. */
function RequireAccess() {
  const user = useCurrentUser()
  const { pathname } = useLocation()
  const masterBudgets = useStore((s) => s.masterBudgets)
  const d = deptForPath(pathname)
  // Budget holders may open the master budget to fill their own lines even without Financial workspace access
  const holder = !!user && masterBudgets.some((m) => m.lines.some((l) => l.budgetHolderId === user.id))
  if (user && d && !canEnter(user, d.id) && !(holder && pathname.startsWith('/finance/master-budget'))) return <NoAccess />
  return <Outlet />
}

export default function App() {
  const authed = useStore((s) => !!s.currentUserId)
  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
         <Route element={<RequireAccess />}>
          <Route index element={<Home />} />
          <Route path="procurement" element={<Dashboard />} />
          <Route path="grants" element={<GrantsOverview />} />
          <Route path="grants/tracker" element={<GrantsTracker />} />
          <Route path="grants/donors" element={<Donors />} />
          <Route path="grants/new" element={<ProjectNew />} />
          <Route path="grants/:id" element={<ProjectPage />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="finance" element={<FinanceHome />} />
          <Route path="finance/master-budget" element={<MasterBudgetPage />} />
          <Route path="partnerships" element={<PartnershipsHome />} />
          <Route path="hr" element={<HrHome />} />
          <Route path="media" element={<MediaHome />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="esign" element={<EnvelopeList />} />
          <Route path="esign/new" element={<EnvelopeNew />} />
          <Route path="esign/:id" element={<EnvelopeDetail />} />
          <Route path="requisitions" element={<RequisitionList />} />
          <Route path="requisitions/new" element={<RequisitionForm />} />
          <Route path="requisitions/:id/edit" element={<RequisitionForm />} />
          <Route path="requisitions/:id" element={<RequisitionDetail />} />
          <Route path="sourcing" element={<SourcingList />} />
          <Route path="sourcing/:id" element={<SourcingDetail />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="contracts" element={<ContractList />} />
          <Route path="contracts/:id" element={<ContractDetail />} />
          <Route path="receiving" element={<ReceivingList />} />
          <Route path="receiving/:id" element={<ReceivingDetail />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="invoices/new" element={<InvoiceNew />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="budgets" element={<BudgetList />} />
          <Route path="budgets/upload" element={<BudgetUpload />} />
          <Route path="budgets/:id" element={<BudgetDetail />} />
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/approval-matrix" element={<ApprovalMatrix />} />
          <Route path="admin/thresholds" element={<Thresholds />} />
          <Route path="admin/settings" element={<Settings />} />
          <Route path="audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
         </Route>
        </Route>
      </Route>
    </Routes>
  )
}

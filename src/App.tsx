import { Navigate, Route, Routes, Outlet } from 'react-router-dom'
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
import ReceivingList from '@/pages/receiving/List'
import ReceivingDetail from '@/pages/receiving/Detail'
import InvoiceList from '@/pages/invoices/List'
import InvoiceNew from '@/pages/invoices/New'
import InvoiceDetail from '@/pages/invoices/Detail'

function RequireAuth() {
  const authed = useStore((s) => !!s.currentUserId)
  return authed ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  const authed = useStore((s) => !!s.currentUserId)
  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="approvals" element={<Approvals />} />
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
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/approval-matrix" element={<ApprovalMatrix />} />
          <Route path="admin/settings" element={<Settings />} />
          <Route path="audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

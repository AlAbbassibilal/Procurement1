import { Link } from 'react-router-dom'
import { Plus, Users, Clock, Megaphone } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, EmptyState } from '@/components/ui'
import { VACANCY_STATUS_LABEL, VACANCY_STATUS_TONE, canDecideVacancy, currentVacancyStep } from '@/lib/recruitment'
import { fmtDate, cx } from '@/lib/format'
import { useHrContext } from './shared'

export default function Recruitment() {
  const user = useCurrentUser()!
  const { hrManage, isManager } = useHrContext()
  const { vacancies, applicants } = useStore()
  const canRaise = hrManage || isManager || ['dept_manager', 'programs_director', 'executive_director', 'finance_director', 'procurement_manager'].includes(user.role)
  const list = [...vacancies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const forMe = vacancies.filter((v) => canDecideVacancy(v, user))
  return (
    <>
      <PageHeader title="Recruitment" subtitle="Line managers raise a recruitment request with the job description and screening keywords; the director and Finance approve; HR & Admin advertise; candidates apply online and are screened automatically."
        actions={canRaise && <Link to="/hr/recruitment/new" className="btn-primary"><Plus size={15} /> New recruitment request</Link>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-4"><Stat label="Awaiting your approval" value={forMe.length} tone={forMe.length ? 'sun' : 'default'} /><Stat label="Pending approval" value={vacancies.filter((v) => v.status === 'pending_approval').length} /><Stat label="Approved — to advertise" value={vacancies.filter((v) => v.status === 'approved').length} tone={vacancies.some((v) => v.status === 'approved') ? 'brand' : 'default'} /><Stat label="Advertised" value={vacancies.filter((v) => v.status === 'advertised').length} hint={`${applicants.filter((a) => vacancies.find((v) => v.id === a.vacancyId)?.status === 'advertised').length} applications`} /></div>
      {list.length === 0 ? <EmptyState title="No recruitment requests yet" body="Line managers start here when a position needs to be filled." /> : (
        <Card padded={false}><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]">
          <thead><tr><th className="table-th">Request</th><th className="table-th">Department · project</th><th className="table-th">Raised by</th><th className="table-th">Status</th><th className="table-th">Next step</th><th className="table-th text-right">Applicants</th><th className="table-th">Closing</th></tr></thead>
          <tbody>{list.map((v) => { const apps = applicants.filter((a) => a.vacancyId === v.id); const step = currentVacancyStep(v); return (
            <tr key={v.id} className="hover:bg-surface-muted">
              <td className="table-td"><Link to={`/hr/recruitment/${v.id}`} className="font-medium text-ink-900 hover:text-brand-700">{v.title}</Link><div className="font-mono text-[11px] text-ink-400">{v.number} · {v.headcount} × {v.contractType.replace('_', '-')}</div></td>
              <td className="table-td text-ink-700">{v.department}{v.projectCode && <div className="text-[12px] text-ink-500">{v.projectCode}</div>}</td>
              <td className="table-td text-ink-700">{v.requestedByName}<div className="text-[12px] text-ink-500">{fmtDate(v.createdAt)}</div></td>
              <td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', VACANCY_STATUS_TONE[v.status])}>{VACANCY_STATUS_LABEL[v.status]}</span></td>
              <td className="table-td text-[12.5px] text-ink-600">{v.status === 'pending_approval' && step ? <span className="flex items-center gap-1"><Clock size={12} /> {step.approverName ?? step.label}{canDecideVacancy(v, user) && <span className="rounded-pill bg-sun-100 px-1.5 text-[10.5px] font-semibold text-sun-700">you</span>}</span> : v.status === 'approved' ? <span className="flex items-center gap-1"><Megaphone size={12} /> HR to advertise</span> : v.status === 'advertised' ? <span className="flex items-center gap-1"><Users size={12} /> receiving applications</span> : '—'}</td>
              <td className="table-td text-right">{apps.length ? <Link to={`/hr/recruitment/${v.id}?tab=applicants`} className="font-semibold text-brand-700 hover:underline">{apps.length}</Link> : '—'}</td>
              <td className="table-td text-ink-600">{v.advert?.closingDate ? fmtDate(v.advert.closingDate) : '—'}</td>
            </tr>) })}</tbody></table></div></Card>
      )}
    </>
  )
}

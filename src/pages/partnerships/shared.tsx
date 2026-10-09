import { Link } from 'react-router-dom'
import { cx } from '@/lib/format'
import { PARTNER_STAGE_LABEL, PARTNER_STAGE_TONE, ddProgress } from '@/lib/partners'
import { StagePill as ProjectStagePill } from '@/pages/grants/Overview'
import type { Partner, PartnerStage, Project } from '@/types'

export const PartnerStagePill = ({ stage, className }: { stage: PartnerStage; className?: string }) => (
  <span className={cx('inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[11.5px] font-semibold', PARTNER_STAGE_TONE[stage], className)}>{PARTNER_STAGE_LABEL[stage]}</span>
)

/** Compact due-diligence progress bar (5 segments: scoping · vetting · capacity · risks · decision). */
export function DdBar({ partner, className }: { partner: Partner; className?: string }) {
  const pr = ddProgress(partner.dueDiligence)
  const segs = [['Scoping', pr.scoping], ['Vetting', pr.vetting], ['Capacity', pr.pca], ['Risks', pr.risks], ['Decision', pr.decision]] as const
  return (
    <div className={cx('flex items-center gap-2', className)} title={segs.map(([l, v]) => `${l} ${v}%`).join(' · ')}>
      <div className="flex h-2 flex-1 gap-0.5 overflow-hidden rounded-pill bg-ink-100">
        {segs.map(([l, v]) => <div key={l} className="h-full flex-1 bg-ink-200"><div className={cx('h-full', v === 100 ? 'bg-brand-600' : 'bg-sun-500')} style={{ width: `${v}%` }} /></div>)}
      </div>
      <span className="w-9 text-right text-[11.5px] font-semibold text-ink-700">{pr.overall}%</span>
    </div>
  )
}

/** Clickable project chips for the partner register and partner file. */
export function ProjectChips({ projects, empty = '—' }: { projects: Project[]; empty?: string }) {
  if (!projects.length) return <span className="text-[12px] text-ink-400">{empty}</span>
  return (
    <div className="flex flex-wrap gap-1">
      {projects.map((p) => (
        <Link key={p.id} to={`/grants/${p.id}`} className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2 py-0.5 text-[11.5px] font-medium text-ink-800 hover:border-brand-300 hover:bg-brand-50" title={p.title}>
          <span className="font-mono text-[10.5px] text-ink-500">{p.code}</span><span className="max-w-[160px] truncate">{p.title}</span><ProjectStagePill stage={p.stage} />
        </Link>
      ))}
    </div>
  )
}

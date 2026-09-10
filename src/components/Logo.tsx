import { cx } from '@/lib/format'

/** RHS wordmark: "RESTORING" crimson + "HOPE" green, sun mark amber (brand guideline §3). */
export function SunMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="6.5" className="fill-sun-500" />
      <g className="stroke-sun-500" strokeWidth="2.2" strokeLinecap="round">
        <line x1="16" y1="3" x2="16" y2="6.5" /><line x1="16" y1="25.5" x2="16" y2="29" />
        <line x1="3" y1="16" x2="6.5" y2="16" /><line x1="25.5" y1="16" x2="29" y2="16" />
        <line x1="6.8" y1="6.8" x2="9.3" y2="9.3" /><line x1="22.7" y1="22.7" x2="25.2" y2="25.2" />
        <line x1="6.8" y1="25.2" x2="9.3" y2="22.7" /><line x1="22.7" y1="9.3" x2="25.2" y2="6.8" />
      </g>
    </svg>
  )
}

export function Wordmark({ inverse = false, size = 'md', tagline = true }: { inverse?: boolean; size?: 'sm' | 'md' | 'lg'; tagline?: boolean }) {
  const t = { sm: 'text-[13px]', md: 'text-[16px]', lg: 'text-[24px]' }[size]
  const tag = { sm: 'text-[8px]', md: 'text-[9px]', lg: 'text-[11px]' }[size]
  return (
    <div className="leading-none">
      <div className={cx('font-bold tracking-[0.02em]', t)}>
        <span className={inverse ? 'text-white' : 'text-accent-600'}>RESTORING</span>{' '}
        <span className={inverse ? 'text-white' : 'text-brand-600'}>HOPE</span>
      </div>
      {tagline && <div className={cx('mt-1 font-medium uppercase tracking-[0.14em]', tag, inverse ? 'text-white/80' : 'text-ink-600')}>A Jordanian Society to Support Amputees</div>}
    </div>
  )
}

export function Logo({ inverse = false, size = 'md', tagline = true }: { inverse?: boolean; size?: 'sm' | 'md' | 'lg'; tagline?: boolean }) {
  const s = { sm: 22, md: 30, lg: 44 }[size]
  return (
    <div className="flex items-center gap-2.5">
      <SunMark size={s} />
      <Wordmark inverse={inverse} size={size} tagline={tagline} />
    </div>
  )
}

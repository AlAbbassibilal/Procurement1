import { useState } from 'react'
import { Save, Check, Monitor, Sparkles, PanelLeftClose } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { Logo } from '@/components/Logo'
import { cx } from '@/lib/format'
import type { OrgSettings, UiTheme } from '@/types'

export default function Settings() {
  const { settings, updateSettings, uiTheme, setUiTheme, sidebarCollapsed, setSidebarCollapsed } = useStore()
  const [s, setS] = useState<OrgSettings>(settings)
  const [saved, setSaved] = useState(false)
  const set = (p: Partial<OrgSettings>) => setS((x) => ({ ...x, ...p }))
  return (
    <>
      <PageHeader title="Settings" subtitle="Organisation identity, procurement policy thresholds, appearance and document defaults."
        actions={<button className="btn-primary" onClick={() => { updateSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2000) }}><Save size={15} /> Save</button>} />
      {saved && <div className="mb-4"><Alert tone="success">Settings saved.</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Organisation">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organisation name"><input className="input" value={s.orgName} onChange={(e) => set({ orgName: e.target.value })} /></Field>
              <Field label="Short name"><input className="input" value={s.orgShort} onChange={(e) => set({ orgShort: e.target.value })} /></Field>
              <Field label="Tagline" className="sm:col-span-2"><input className="input" value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
              <Field label="Address" className="sm:col-span-2"><input className="input" value={s.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="Email"><input className="input" value={s.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Phone"><input className="input" value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="Website"><input className="input" value={s.website} onChange={(e) => set({ website: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Appearance" description="Choose the interface you prefer. Applies immediately and is remembered on this device — every user can also switch from their account menu.">
            <div className="grid gap-4 sm:grid-cols-2">
              {THEMES.map((t) => { const on = uiTheme === t.id; return (
                <button key={t.id} type="button" data-testid={`theme-${t.id}`} onClick={() => setUiTheme(t.id)} aria-pressed={on}
                  className={cx('group rounded-card border-2 p-3 text-left transition-all', on ? 'border-brand-600 bg-brand-50/50 shadow-card' : 'border-line hover:border-ink-300 hover:bg-surface-muted')}>
                  <ThemePreview id={t.id} />
                  <div className="mt-3 flex items-center gap-2">
                    <span className={cx('flex h-7 w-7 items-center justify-center rounded-control', on ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600')}>{t.icon}</span>
                    <span className="flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink-900">{t.name}{on && <span className="ml-2 rounded-pill bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Active</span>}</span>
                      <span className="block text-[12px] text-ink-500">{t.blurb}</span>
                    </span>
                    {on && <Check size={16} className="text-brand-700" />}
                  </div>
                </button>) })}
              <label className="flex items-start gap-3 rounded-control border border-line bg-surface-muted px-3 py-2.5 text-[13px] text-ink-700 sm:col-span-2">
                <input type="checkbox" className="mt-0.5" checked={sidebarCollapsed} onChange={(e) => setSidebarCollapsed(e.target.checked)} />
                <span><span className="flex items-center gap-1.5 font-medium text-ink-900"><PanelLeftClose size={14} /> Keep the sidebar hidden</span>Shows an icon rail instead of the full menu, leaving more room for what you are working on. Toggle any time with the sidebar button or <span className="kbd">Ctrl</span> + <span className="kbd">B</span>.</span>
              </label>
            </div>
          </Card>
          <Card title="Procurement policy">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-control border border-line bg-surface-muted px-3 py-2 text-[13px] text-ink-700">Value tiers, sourcing methods and approval authority are configured under <Link to="/admin/thresholds" className="font-medium text-brand-700 hover:underline">Procurement thresholds</Link> (SOP §3).</div>
              <Field label="Default currency"><select className="input" value={s.defaultCurrency} onChange={(e) => set({ defaultCurrency: e.target.value as OrgSettings['defaultCurrency'] })}><option>JOD</option><option>USD</option><option>EUR</option></select></Field>
              <Field label="Invoice price tolerance %" hint="Unit-price variance vs PO allowed by the 3-way match"><input type="number" step="0.5" className="input" value={s.priceTolerancePct} onChange={(e) => set({ priceTolerancePct: Number(e.target.value) })} /></Field>
              <Field label="Default payment terms (days)"><input type="number" className="input" value={s.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: Number(e.target.value) })} /></Field>
              <Field label="Default tax rate %"><input type="number" className="input" value={s.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) })} /></Field>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Brand preview" description="From RHS Brand Guideline 2025">
            <div className="rounded-card border border-line p-4"><Logo /></div>
            <div className="mt-3 rounded-card bg-brand-600 p-4"><Logo inverse /></div>
            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {[['bg-brand-600', '#00853f'], ['bg-accent-600', '#d21e47'], ['bg-sun-500', '#ffb32c'], ['bg-ink-900', '#152b38'], ['bg-black', '#000000']].map(([c, h]) => <div key={h}><div className={`h-10 rounded-control ${c}`} /><div className="mt-1 text-center font-mono text-[10px] text-ink-500">{h}</div></div>)}
            </div>
            <div className="mt-3 text-[12px] text-ink-500">Typeface: Helvetica Neue · Secondary: Myriad Pro · Arabic: Helvetica Neue W23</div>
          </Card>
          <Card title="Document ownership"><p className="text-[13px] text-ink-700">All documents generated by this system are owned and created by <b>Bilal Abbassi</b> on behalf of {s.orgName}.</p></Card>
        </div>
      </div>
    </>
  )
}

const THEMES: { id: UiTheme; name: string; blurb: string; icon: React.ReactNode }[] = [
  { id: 'classic', name: 'Classic', blurb: 'The original interface — navy sidebar, compact cards, square corners.', icon: <Monitor size={15} /> },
  { id: 'modern', name: 'Modern', blurb: 'Light sidebar, rounded cards, tinted canvas and gradient actions.', icon: <Sparkles size={15} /> },
]

/** Miniature of each skin, drawn with brand tokens so it stays in sync with the palette. */
function ThemePreview({ id }: { id: UiTheme }) {
  const modern = id === 'modern'
  return (
    <div className={cx('flex h-28 overflow-hidden border', modern ? 'rounded-2xl border-ink-200 bg-gradient-to-br from-brand-50 via-surface-sunken to-sun-50' : 'rounded-md border-ink-300 bg-surface-sunken')} aria-hidden>
      <div className={cx('flex w-[26%] flex-col gap-1 p-1.5', modern ? 'border-r border-line bg-surface' : 'bg-ink-900')}>
        <div className={cx('mb-1 h-1.5 w-8 rounded-pill', modern ? 'bg-accent-600' : 'bg-white/70')} />
        {[0, 1, 2, 3].map((i) => <div key={i} className={cx('h-2 rounded-sm', i === 1 ? 'bg-brand-600' : modern ? 'bg-ink-100' : 'bg-white/15', modern && i === 1 && 'rounded-md', i === 3 ? 'w-2/3' : 'w-full')} />)}
      </div>
      <div className="flex-1 p-2">
        <div className={cx('mb-1.5 flex items-center justify-between', modern ? 'rounded-lg bg-surface/80 px-1.5 py-1' : 'border-b border-line pb-1')}>
          <div className="h-1.5 w-10 rounded-pill bg-ink-300" />
          <div className={cx('h-2.5 w-6', modern ? 'rounded-md bg-gradient-to-r from-brand-500 to-brand-700' : 'rounded-sm bg-brand-600')} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => <div key={i} className={cx('h-7 bg-surface', modern ? 'rounded-lg border border-line/70 shadow-raised' : 'rounded-sm border border-line')} />)}
          <div className={cx('col-span-3 h-6 bg-surface', modern ? 'rounded-lg border border-line/70' : 'rounded-sm border border-line')} />
        </div>
      </div>
    </div>
  )
}

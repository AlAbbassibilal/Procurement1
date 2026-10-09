import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Mirrors the persisted interface choice onto <html data-ui="…"> so the skin
 * stylesheet (src/theme/modern.css) applies everywhere, including the login page.
 */
export function useUiTheme() {
  const theme = useStore((s) => s.uiTheme)
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'modern') el.dataset.ui = 'modern'
    else delete el.dataset.ui
  }, [theme])
  return theme
}

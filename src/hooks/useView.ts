import { useCallback, useEffect, useState } from 'react'

export type ViewId = 'race' | 'schedule' | 'standings' | 'seasons' | 'tracks'

const VALID: ViewId[] = ['race', 'schedule', 'standings', 'seasons', 'tracks']

function readHash(): ViewId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (VALID.includes(raw as ViewId)) return raw as ViewId
  return 'race'
}

export function useView() {
  const [view, setViewState] = useState<ViewId>(() =>
    typeof window !== 'undefined' ? readHash() : 'race',
  )

  const setView = useCallback((next: ViewId) => {
    setViewState(next)
    const hash = '#/' + next
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash)
    }
  }, [])

  useEffect(() => {
    const onPop = () => setViewState(readHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return { view, setView }
}

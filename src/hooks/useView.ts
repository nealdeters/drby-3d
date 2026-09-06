import { useCallback, useEffect, useState } from 'react'

export type ViewId = 'race' | 'schedule' | 'standings' | 'seasons' | 'tracks'

const VALID: ViewId[] = ['race', 'schedule', 'standings', 'seasons', 'tracks']

function readHash(): ViewId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const first = raw.split('/').filter(Boolean)[0] ?? ''
  if (VALID.includes(first as ViewId)) return first as ViewId
  return 'race'
}

/** Notify listeners after pushState hash changes (hashchange does not fire for pushState). */
export function emitHashChange() {
  window.dispatchEvent(new Event('drby-hash'))
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
      emitHashChange()
    }
  }, [])

  useEffect(() => {
    const onPop = () => setViewState(readHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    window.addEventListener('drby-hash', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onPop)
      window.removeEventListener('drby-hash', onPop)
    }
  }, [])

  return { view, setView }
}

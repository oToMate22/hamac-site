import { useEffect, useState } from 'react'
import { searchFrenchCommunes, type FrenchCommune } from '../utils/frenchCommunes'

export function useFrenchCommuneSearch(query: string, enabled: boolean, limit = 16) {
  const [results, setResults] = useState<FrenchCommune[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const timer = window.setTimeout(() => {
      void searchFrenchCommunes(trimmed, limit, controller.signal)
        .then((entries) => {
          if (!controller.signal.aborted) setResults(entries)
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 280)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
      setLoading(false)
    }
  }, [enabled, limit, query])

  return { results, loading }
}

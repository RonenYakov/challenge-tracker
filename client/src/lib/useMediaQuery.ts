import { useEffect, useState } from 'react'

/**
 * Matched synchronously on first render, so the layout never flashes the wrong
 * variant and then corrects itself.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const sync = () => setMatches(list.matches)
    sync()
    list.addEventListener('change', sync)
    return () => list.removeEventListener('change', sync)
  }, [query])

  return matches
}

/** Matches Tailwind's `lg`, the breakpoint where the dashboard grows its side rail. */
export const useIsWideScreen = () => useMediaQuery('(min-width: 1024px)')

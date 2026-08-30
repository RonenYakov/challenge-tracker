import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/api'
import { SignIn } from './screens/SignIn'
import { Today } from './screens/Today'
import { Challenges } from './screens/Challenges'
import { ChallengeEditor } from './screens/ChallengeEditor'
import { Stats } from './screens/Stats'
import { Skeleton } from './components/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export function App() {
  const session = useSession()

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (session === null) return <SignIn />

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/challenges/:id" element={<ChallengeEditor />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

/** `undefined` while the stored session is being restored, `null` when signed out. */
function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  return session
}

const NAV = [
  { to: '/', label: 'Today' },
  { to: '/stats', label: 'Stats' },
  { to: '/challenges', label: 'Challenges' },
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain min-h-dvh">
      <header className="sticky top-0 z-50 border-b border-mist/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className="press rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                  backgroundColor: isActive ? 'var(--color-cream-dark)' : 'transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="press ml-auto rounded-lg px-3 py-1.5 text-[13px] text-ink-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5">{children}</main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { api, supabase } from './lib/api'
import { SignIn, UpdatePassword, usePasswordRecovery } from './screens/SignIn'
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
  const [recovering, finishRecovery] = usePasswordRecovery()

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (session === null) return <SignIn />

  // Arriving from a reset link signs the user in, so this has to be checked after the
  // session exists. It takes over the whole screen until a new password is set.
  if (recovering) return <UpdatePassword onDone={finishRecovery} />

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

/**
 * The active challenge, named in the header so it is always visible that everything on
 * screen belongs to it. Tapping it goes to the manage-and-switch screen.
 */
function ChallengeMenu() {
  const { data } = useQuery({ queryKey: ['today'], queryFn: api.today })
  const challenge = data?.challenge

  return (
    <Link
      to="/challenges"
      className="press ms-auto flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-muted hover:bg-cream-dark hover:text-ink sm:min-h-0 sm:py-1.5"
      title="החלפה וניהול אתגרים"
    >
      <span
        className="max-w-[9rem] truncate sm:max-w-[16rem]"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {challenge ? challenge.name : 'אין אתגר פעיל'}
      </span>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <path
          d="M6 8l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
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

/*
  Only two peers here. "Challenges" used to sit alongside Today and Stats, which made
  three equal-looking tabs and read as if a challenge were a single item in a list, or
  worse, as if each rule were its own challenge. Switching challenges is a rare,
  settings-shaped action, so it hangs off the challenge name instead.
*/
const NAV = [
  { to: '/', label: 'Today' },
  { to: '/stats', label: 'Stats' },
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain min-h-dvh">
      <header className="sticky top-0 z-50 border-b border-mist/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-1.5 sm:py-2.5" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className="press flex min-h-11 items-center rounded-lg px-3 text-[14px] transition-colors duration-150 sm:min-h-0 sm:py-1.5 sm:text-[13px]"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                  backgroundColor: isActive ? 'var(--color-cream-dark)' : 'transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <ChallengeMenu />

          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="press flex min-h-11 items-center rounded-lg px-3 text-[14px] text-ink-muted hover:text-ink sm:min-h-0 sm:py-1.5 sm:text-[13px]"
          >
            התנתקות
          </button>
        </div>
      </header>

      <main
        className="mx-auto max-w-5xl px-4 pt-4 sm:pt-5"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
    </div>
  )
}

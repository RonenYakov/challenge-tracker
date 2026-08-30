import { useState } from 'react'
import { supabase } from '../lib/api'
import { Button, Card, Field, Input } from '../components/ui'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'google' | 'email' | null>(null)

  async function signInWithGoogle() {
    setPending('google')
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Land back on whichever origin the user started from, so this works
      // unchanged on localhost and in production.
      options: { redirectTo: window.location.origin },
    })

    // On success the browser navigates away, so this only runs on failure.
    if (error) {
      setError(error.message)
      setPending(null)
    }
  }

  async function sendEmailLink(event: React.FormEvent) {
    event.preventDefault()
    setPending('email')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    })

    setPending(null)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-center">Challenge</p>
        <h1 className="mt-2 text-center text-3xl">
          {sent ? 'Check your email' : 'Your rules, your run'}
        </h1>

        <Card className="mt-6">
          {sent ? (
            <div>
              <p className="text-sm text-ink-soft">
                A sign-in link is on its way to <span className="font-medium">{email}</span>. Open it
                on whichever device you want to log from.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="press mt-4 text-[13px] text-ink-muted underline hover:text-ink"
              >
                Use a different address
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={pending !== null}
                className="press flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-mist bg-paper px-4 text-[15px] font-medium text-ink hover:bg-cream-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GoogleMark />
                {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
              </button>

              {showEmail ? (
                <form onSubmit={sendEmailLink} className="grid gap-4">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-mist" />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">or</span>
                    <span className="h-px flex-1 bg-mist" />
                  </div>

                  <Field label="Email" hint="No password. We send you a link.">
                    <Input
                      type="email"
                      required
                      autoFocus
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>

                  <Button type="submit" variant="secondary" loading={pending === 'email'}>
                    {pending === 'email' ? 'Sending…' : 'Send me a link'}
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="press text-[13px] text-ink-muted underline hover:text-ink"
                >
                  or use an email link
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="shake mt-4 text-sm" style={{ color: 'var(--color-clay)' }}>
              {error}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

/** Google's mark, drawn inline so the strict CSP never has to fetch it. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

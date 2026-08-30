import { useState } from 'react'
import { supabase } from '../lib/api'
import { Button, Card, Field, Input } from '../components/ui'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    })

    setPending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-center">Challenge</p>
        <h1 className="mt-2 text-center text-3xl">
          {sent ? 'Check your email' : 'Your rules, your run'}
        </h1>

        <Card className="mt-6">
          {sent ? (
            <p className="text-sm text-ink-soft">
              A sign-in link is on its way to <span className="font-medium">{email}</span>. Open it on
              whichever device you want to log from.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <Field label="Email" hint="No password. We send you a link.">
                <Input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>

              {error && (
                <p className="shake text-sm" style={{ color: 'var(--color-clay)' }}>
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" loading={pending}>
                {pending ? 'Sending…' : 'Send me a link'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

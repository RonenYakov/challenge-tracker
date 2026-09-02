import { useEffect, useState } from 'react'
import { supabase } from '../lib/api'
import { Button, Card, Field, Input } from '../components/ui'

type Mode = 'signin' | 'signup' | 'forgot'
type Sent = { kind: 'link' | 'confirm' | 'reset'; email: string }

/**
 * Supabase answers in English, and its wording leaks implementation detail. The common
 * cases get a plain Hebrew sentence; anything unrecognised falls through untouched,
 * because a wrong translation would be worse than an English one.
 */
function hebrewError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'המייל או הסיסמה לא נכונים.',
    'Email not confirmed': 'צריך לאשר את המייל קודם. בדוק את תיבת הדואר.',
    'User already registered': 'כבר קיים חשבון עם המייל הזה. אפשר פשוט להתחבר.',
    'Email rate limit exceeded': 'נשלחו יותר מדי מיילים. נסה שוב בעוד כמה דקות.',
    'New password should be different from the old password.':
      'הסיסמה החדשה צריכה להיות שונה מהקודמת.',
  }
  if (map[message]) return map[message]!
  if (/password should be at least/i.test(message)) {
    const digits = message.match(/\d+/)?.[0] ?? '6'
    return `הסיסמה צריכה להיות באורך ${digits} תווים לפחות.`
  }
  return message
}

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sent, setSent] = useState<Sent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'password' | 'google' | 'link' | null>(null)

  const cleanEmail = () => email.trim().toLowerCase()
  const origin = () => window.location.origin

  function fail(message: string) {
    setError(hebrewError(message))
    setPending(null)
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirm) {
      setError('שתי הסיסמאות לא זהות.')
      return
    }

    setPending('password')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail(),
        password,
      })
      // On success onAuthStateChange swaps the whole screen out, so only failure lands here.
      if (error) fail(error.message)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail(),
      password,
      options: { emailRedirectTo: origin() },
    })
    setPending(null)
    if (error) {
      setError(hebrewError(error.message))
      return
    }
    // With email confirmation on, which it should be, there is no session yet and the
    // account is not usable until the link is opened.
    if (!data.session) setSent({ kind: 'confirm', email: cleanEmail() })
  }

  async function sendResetLink(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setPending('password')

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(), {
      redirectTo: origin(),
    })
    setPending(null)
    if (error) setError(hebrewError(error.message))
    else setSent({ kind: 'reset', email: cleanEmail() })
  }

  async function sendMagicLink() {
    setError(null)
    if (!cleanEmail()) {
      setError('צריך למלא כתובת מייל קודם.')
      return
    }
    setPending('link')

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail(),
      options: { emailRedirectTo: origin() },
    })
    setPending(null)
    if (error) setError(hebrewError(error.message))
    else setSent({ kind: 'link', email: cleanEmail() })
  }

  async function continueWithGoogle() {
    setError(null)
    setPending('google')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Land back on whichever origin the user started from, so this works
      // unchanged on localhost and in production.
      options: { redirectTo: origin() },
    })
    // On success the browser navigates away, so this only runs on failure.
    if (error) fail(error.message)
  }

  if (sent) {
    const body = {
      link: 'שלחנו קישור התחברות. פתח אותו במכשיר שממנו תרצה לתעד.',
      confirm: 'שלחנו מייל אימות. אחרי שתפתח את הקישור אפשר להתחבר עם הסיסמה שבחרת.',
      reset: 'שלחנו קישור לאיפוס סיסמה. פתח אותו ותוכל לבחור סיסמה חדשה.',
    }[sent.kind]

    return (
      <Screen heading="Check your email">
        <Card className="mt-6">
          <p dir="rtl" className="text-sm text-ink-soft">
            {body}
          </p>
          <p dir="ltr" className="mt-2 text-sm font-medium">
            {sent.email}
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(null)
              setPassword('')
              setConfirm('')
            }}
            className="press mt-4 text-[13px] text-ink-muted underline hover:text-ink"
          >
            חזרה
          </button>
        </Card>
      </Screen>
    )
  }

  if (mode === 'forgot') {
    return (
      <Screen heading="Reset your password">
        <Card className="mt-6">
          <form onSubmit={sendResetLink} className="grid gap-4">
            <Field label="מייל">
              <Input
                dir="ltr"
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
            <Button type="submit" variant="primary" loading={pending === 'password'}>
              {pending === 'password' ? 'שולח…' : 'שלחו לי קישור לאיפוס'}
            </Button>
          </form>
          <SubtleButton onClick={() => setMode('signin')}>חזרה להתחברות</SubtleButton>
          {error && <ErrorLine message={error} />}
        </Card>
      </Screen>
    )
  }

  const isSignUp = mode === 'signup'

  return (
    <Screen heading={isSignUp ? 'Start your run' : 'Your rules, your run'}>
      <p dir="rtl" className="mt-3 text-center text-[15px] leading-relaxed text-ink-soft">
        אתגר אישי בסגנון 75 Hard, רק שאת הכללים, האורך ורמת הקשיחות אתם קובעים.
      </p>

      <Card className="mt-6">
        <form onSubmit={submitPassword} className="grid gap-4">
          <Field label="מייל">
            <Input
              dir="ltr"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="סיסמה">
            <Input
              dir="ltr"
              type="password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {isSignUp && (
            <Field label="אימות סיסמה">
              <Input
                dir="ltr"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          )}

          <Button type="submit" variant="primary" loading={pending === 'password'}>
            {pending === 'password'
              ? isSignUp
                ? 'פותח חשבון…'
                : 'מתחבר…'
              : isSignUp
                ? 'פתיחת חשבון'
                : 'התחברות'}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <SubtleButton
            onClick={() => {
              setMode(isSignUp ? 'signin' : 'signup')
              setError(null)
              setConfirm('')
            }}
          >
            {isSignUp ? 'כבר יש לי חשבון' : 'אין לי חשבון עדיין'}
          </SubtleButton>
          {!isSignUp && <SubtleButton onClick={() => setMode('forgot')}>שכחתי סיסמה</SubtleButton>}
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-mist" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">or</span>
          <span className="h-px flex-1 bg-mist" />
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={pending !== null}
            className="press flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-mist bg-paper px-4 text-[15px] font-medium text-ink hover:bg-cream-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GoogleMark />
            {pending === 'google' ? 'פותח את גוגל…' : 'המשך עם Google'}
          </button>

          <button
            type="button"
            onClick={sendMagicLink}
            disabled={pending !== null}
            className="press flex min-h-12 w-full items-center justify-center rounded-lg border border-mist bg-paper px-4 text-[15px] font-medium text-ink hover:bg-cream-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending === 'link' ? 'שולח…' : 'שלחו לי קישור התחברות'}
          </button>
        </div>

        {error && <ErrorLine message={error} />}
      </Card>

      <About />
    </Screen>
  )
}

/**
 * What the app is, for anyone who arrived without knowing.
 *
 * Below the form on purpose: someone signing in for the hundredth time should not have
 * to scroll past a pitch, and someone who has never seen the app gets the one-line
 * version under the heading either way.
 */
function About() {
  const sections = [
    {
      heading: 'What it is',
      body: 'בוחרים כמה כללים, קובעים לכמה ימים, ומסמנים כל יום. יום נחשב רק אם כל הכללים בוצעו, אז אין ימים חצי מוצלחים.',
    },
    {
      heading: 'How it works',
      body: 'יוצרים אתגר ובוחרים אורך. מוסיפים את הכללים שלכם, כל אחד עם יעד משלו אם צריך. אחר כך פשוט מסמנים כל יום לפני שהיום נסגר.',
    },
    {
      heading: 'Why it works',
      body: 'הרצף הוא מה שמחזיק, וכאן הוא מוגן. יום שהוחמץ לא מוחק את מה שבניתם, ואפשר לכסות אותו באסימון חסד. ימים שבחרתם להשאיר פנויים, שבת למשל, לא נספרים נגדכם בכלל.',
    },
  ]

  return (
    <div className="mt-10 grid gap-6 border-t border-mist/70 pt-8">
      {sections.map((section) => (
        <section key={section.heading}>
          <p className="eyebrow">{section.heading}</p>
          <p dir="rtl" className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
            {section.body}
          </p>
        </section>
      ))}
    </div>
  )
}

/**
 * Choosing a new password after arriving from a reset link.
 *
 * Supabase has already created a session by this point, so this is not a sign-in screen.
 * It replaces the app until the password is set, because leaving the user inside the app
 * with a half-finished recovery is how people end up locked out again.
 */
export function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('שתי הסיסמאות לא זהות.')
      return
    }

    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) setError(hebrewError(error.message))
    else onDone()
  }

  return (
    <Screen heading="Choose a new password">
      <Card className="mt-6">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="סיסמה חדשה">
            <Input
              dir="ltr"
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="אימות סיסמה">
            <Input
              dir="ltr"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? 'שומר…' : 'שמירת הסיסמה'}
          </Button>
        </form>
        {error && <ErrorLine message={error} />}
      </Card>
    </Screen>
  )
}

/**
 * True while the user is here from a password reset link.
 *
 * Supabase fires PASSWORD_RECOVERY once, on load, and the listener has to be attached
 * before that happens, which is why this lives at the top of the tree.
 */
export function usePasswordRecovery(): [boolean, () => void] {
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return [recovering, () => setRecovering(false)]
}

function Screen({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-center">Challenge</p>
        <h1 className="mt-2 text-center text-3xl">{heading}</h1>
        {children}
      </div>
    </div>
  )
}

function SubtleButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press text-[13px] text-ink-muted underline hover:text-ink"
    >
      {children}
    </button>
  )
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p dir="auto" className="shake mt-4 text-sm" style={{ color: 'var(--color-clay)' }}>
      {message}
    </p>
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

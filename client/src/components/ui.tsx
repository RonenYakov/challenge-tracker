import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  // Orange is the 10% accent. One primary per screen, no exceptions.
  primary: 'bg-orange text-cream hover:bg-orange-dark shadow-sm',
  secondary: 'border border-mist bg-paper text-ink hover:bg-cream-dark',
  ghost: 'text-ink-soft hover:bg-cream-dark',
  danger: 'border border-clay/40 text-clay hover:bg-clay/8',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`press inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[15px] font-medium disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:text-sm ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-mist/70 bg-paper p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
    </label>
  )
}

/** Boxed input with a brand focus state, never a bare underline. */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-mist bg-cream px-3 py-2 text-[15px] text-ink transition-colors duration-150 placeholder:text-ink-muted/70 focus:border-orange focus:outline-none ${props.className ?? ''}`}
    />
  )
}

export function Stat({
  label,
  value,
  suffix,
  tone = 'ink',
}: {
  label: string
  value: ReactNode
  suffix?: string
  tone?: 'ink' | 'gold' | 'muted'
}) {
  const color =
    tone === 'gold' ? 'var(--color-gold)' : tone === 'muted' ? 'var(--color-ink-muted)' : 'var(--color-ink)'
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 font-mono text-2xl leading-none" style={{ color }}>
        {value}
        {suffix && <span className="ml-1 text-sm text-ink-muted">{suffix}</span>}
      </p>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

/**
 * Shown when a request fails. A screen that keeps showing skeletons after a failure
 * tells the user nothing and looks like the app is simply broken.
 */
export function ErrorCard({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: 'hsl(8 52% 52% / 0.35)' }}>
      <p className="eyebrow" style={{ color: 'var(--color-clay)' }}>
        Could not load
      </p>
      <p className="mt-2 text-[15px] text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  )
}

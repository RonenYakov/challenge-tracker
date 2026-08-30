interface RingProps {
  /** 0..1 */
  value: number
  size?: number
  stroke?: number
  children?: React.ReactNode
}

/**
 * The day's progress. The stroke eases to its new length rather than jumping, because
 * the ring is the one element that should feel like it responded to the tap.
 */
export function Ring({ value, size = 132, stroke = 9, children }: RingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, value))
  const complete = clamped === 1

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-cream-dark)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? 'var(--color-gold)' : 'var(--color-orange)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{
            transition:
              'stroke-dashoffset 620ms var(--ease-out-soft), stroke 320ms ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

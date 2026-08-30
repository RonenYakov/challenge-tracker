import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Challenge, Miss } from '@ct/shared'
import { api } from '../lib/api'
import { Button, Card } from './ui'

/**
 * Shown when a closed day was never completed. It is deliberately plain and deliberately
 * unskippable: the whole challenge means nothing if a missed day can be scrolled past.
 */
export function Reckoning({
  challenge,
  miss,
  tokensLeft,
}: {
  challenge: Challenge
  miss: Miss
  tokensLeft: number
}) {
  const queryClient = useQueryClient()
  const [confirmingReset, setConfirmingReset] = useState(false)

  const resolve = useMutation({
    mutationFn: (action: 'grace' | 'reset') => api.resolveMiss(challenge.id, action),
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })

  const hasGrace = tokensLeft > 0

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className="border-clay/30">
        <p className="eyebrow" style={{ color: 'var(--color-clay)' }}>
          Unfinished
        </p>

        <h1 className="mt-2 text-2xl">
          Day {miss.dayNumber} was not completed.
        </h1>

        <p className="mt-2 text-[15px] text-ink-soft">
          {miss.date} closed with tasks left undone. You set the rules, so this is your call
          to make, not the app&rsquo;s.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-mist bg-cream p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-medium">Spend a grace token</p>
              <p className="tnum font-mono text-sm text-ink-muted">
                {tokensLeft} left
              </p>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              {hasGrace
                ? 'The day counts as covered and your streak holds. The grid still shows it was grace, not a win.'
                : 'You have no tokens left for this attempt.'}
            </p>
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={!hasGrace || resolve.isPending}
              onClick={() => resolve.mutate('grace')}
            >
              {hasGrace ? 'Use a token' : 'None left'}
            </Button>
          </div>

          <div className="rounded-xl border border-mist p-4">
            <p className="font-medium">Take the reset</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Back to day 1, starting today. Your previous attempt stays in the grid.
            </p>

            {confirmingReset ? (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate('reset')}
                >
                  Yes, reset to day 1
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => setConfirmingReset(true)}
              >
                Reset the challenge
              </Button>
            )}
          </div>
        </div>

        {resolve.isError && (
          <p className="shake mt-4 text-sm" style={{ color: 'var(--color-clay)' }}>
            {(resolve.error as Error).message}
          </p>
        )}
      </Card>
    </div>
  )
}

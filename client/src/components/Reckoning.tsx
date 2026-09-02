import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Challenge, Miss } from '@ct/shared'
import { api } from '../lib/api'
import { Button, Card } from './ui'
import { formatDate } from '../lib/format'

/**
 * Shown when a closed day was never completed. It is deliberately plain and deliberately
 * unskippable: the whole challenge means nothing if a missed day can be scrolled past.
 */
export function Reckoning({
  challenge,
  miss,
  tokensLeft,
  bestEver,
}: {
  challenge: Challenge
  miss: Miss
  tokensLeft: number
  bestEver: number
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
          יום {miss.dayNumber} לא הושלם.
        </h1>

        <p className="mt-2 text-[15px] text-ink-soft">
          {formatDate(miss.date)} נסגר עם כללים שלא בוצעו. אתה קבעת את הכללים, אז ההחלטה
          הזאת שלך ולא של האפליקציה.
        </p>

        {/*
          This screen appears at the exact moment the abstinence violation effect does:
          one miss, then the "may as well quit" story. The research is genuinely
          reassuring here, so it is stated plainly rather than replaced with cheerleading.
          The point is to keep the decision in view, not to talk the user out of a reset.
        */}
        <p className="mt-3 rounded-lg bg-cream px-3 py-2.5 text-[13px] leading-relaxed text-ink-muted">
          כדאי לדעת: במחקר שממנו הגיע המספר של 66 יום לבניית הרגל, יום אחד שהוחמץ לא
          השפיע בכלל על קצב היווצרות ההרגל. יום אחד לא הורס את הרצף. ההחלטה שנכשלת היא
          זו שבדרך כלל כן.
        </p>

        {bestEver > 0 && (
          <p className="tnum mt-2 font-mono text-[12px] text-ink-muted">
            הרצף הארוך ביותר שלך עד היום: {bestEver} ימים. זה קרה, ואיפוס לא מוחק את זה.
          </p>
        )}

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-mist bg-cream p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-medium">שימוש באסימון חסד</p>
              <p className="tnum font-mono text-sm text-ink-muted">
                נותרו {tokensLeft}
              </p>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              {hasGrace
                ? 'היום ייחשב מכוסה והרצף נשמר. בלוח עדיין יסומן שזה חסד ולא יום שהושלם.'
                : 'לא נותרו לך אסימונים בניסיון הזה.'}
            </p>
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={!hasGrace || resolve.isPending}
              onClick={() => resolve.mutate('grace')}
            >
              {hasGrace ? 'שימוש באסימון' : 'לא נותרו אסימונים'}
            </Button>
          </div>

          <div className="rounded-xl border border-mist p-4">
            <p className="font-medium">איפוס האתגר</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              חזרה ליום 1, מהיום. הניסיון הקודם נשאר בלוח.
            </p>

            {confirmingReset ? (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate('reset')}
                >
                  כן, אפס ליום 1
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                  ביטול
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => setConfirmingReset(true)}
              >
                איפוס האתגר
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

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Challenge } from '@ct/shared'
import { api, type NewChallenge } from '../lib/api'
import { Button, Card, ErrorCard, Field, Input, Skeleton } from '../components/ui'
import { SHABBAT_PRESET, WeekdayPicker } from '../components/WeekdayPicker'
import { formatDateShort } from '../lib/format'

const STATUS_LABEL: Record<Challenge['status'], string> = {
  active: 'רץ',
  draft: 'טיוטה',
  completed: 'הסתיים',
  abandoned: 'הופסק',
}

export function Challenges() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['challenges'],
    queryFn: api.challenges,
  })

  const create = useMutation({
    mutationFn: api.createChallenge,
    onSuccess: ({ challenge }) => {
      void queryClient.invalidateQueries({ queryKey: ['challenges'] })
      navigate(`/challenges/${challenge.id}`)
    },
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="eyebrow">Your challenges</p>
          <h1 className="mt-1 text-2xl">Every run, past and planned</h1>
        </div>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            אתגר חדש
          </Button>
        )}
      </div>

      {creating && (
        <NewChallengeForm
          pending={create.isPending}
          error={create.error as Error | null}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values)}
        />
      )}

      {isError ? (
        <ErrorCard message={(error as Error).message} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[86px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {data?.challenges.map((challenge) => (
            <Link key={challenge.id} to={`/challenges/${challenge.id}`}>
              <Card className="transition-shadow duration-150 hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      {STATUS_LABEL[challenge.status]}
                      {challenge.attemptNo > 1 && ` · ניסיון ${challenge.attemptNo}`}
                    </p>
                    <p dir="auto" className="mt-1 truncate text-lg">
                      {challenge.name}
                    </p>
                    <p className="tnum mt-0.5 font-mono text-[12px] text-ink-muted">
                      {challenge.lengthDays} ימים · מ-{formatDateShort(challenge.startDate)} ·{' '}
                      {challenge.graceTokensTotal} חסד
                    </p>
                  </div>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        challenge.status === 'active' ? 'var(--color-gold)' : 'var(--color-mist)',
                    }}
                  />
                </div>
              </Card>
            </Link>
          ))}

          {data?.challenges.length === 0 && !creating && (
            <Card>
              <p className="text-sm text-ink-muted">
                עדיין אין כאן כלום. צור אתגר, הוסף את הכללים שלך, ואז תתחיל את יום 1.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function NewChallengeForm({
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  onSubmit: (values: NewChallenge) => void
  onCancel: () => void
  pending: boolean
  error: Error | null
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [lengthDays, setLengthDays] = useState(60)
  const [cutoff, setCutoff] = useState(4)
  const [grace, setGrace] = useState(3)
  const [restWeekdays, setRestWeekdays] = useState<number[]>([])

  return (
    <Card className="mb-5">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            name: name.trim(),
            startDate,
            lengthDays,
            dayCutoffHour: cutoff,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
            graceTokensTotal: grace,
            restWeekdays,
          })
        }}
      >
        <Field label="שם">
          <Input
            dir="auto"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="60 יום של קימה מוקדמת"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מתחיל">
            <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="אורך" hint="כל אורך שתרצה. 30, 60, 75, 100.">
            <Input
              type="number"
              min={1}
              max={1000}
              required
              value={lengthDays}
              onChange={(e) => setLengthDays(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="היום נגמר ב" hint="סיום ב-01:00 עדיין נחשב ליום הקודם.">
            <Input
              type="number"
              min={0}
              max={23}
              required
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
            />
          </Field>
          <Field label="אסימוני חסד" hint="ימים שהוחמצו שאפשר לכסות. 0 בשביל כללי 75 Hard מלאים.">
            <Input
              type="number"
              min={0}
              max={365}
              required
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
            />
          </Field>
        </div>

        <WeekdayPicker
          label="ימי מנוחה (לא חובה)"
          hint="לרוב אין צורך בזה. אם אתה שומר שבת, או שיש יום קבוע שבו אתה לא מתאמן, סמן אותו כאן: לא נדרש בו כלום, הוא לא נחשב החמצה, והרצף ממשיך מעליו. האורך נספר בימי עבודה, אז 60 יום עם שבתות פנויות נמשכים בערך 70 יום בלוח השנה."
          selected={restWeekdays}
          onChange={setRestWeekdays}
          presets={[SHABBAT_PRESET]}
        />

        {error && (
          <p className="shake text-sm" style={{ color: 'var(--color-clay)' }}>
            {error.message}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? 'יוצר…' : 'יצירה'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </form>
    </Card>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Challenge } from '@ct/shared'
import { api } from '../lib/api'
import { Button, Card, ErrorCard, Field, Input, Skeleton } from '../components/ui'

const STATUS_LABEL: Record<Challenge['status'], string> = {
  active: 'Running',
  draft: 'Draft',
  completed: 'Finished',
  abandoned: 'Stopped',
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
            New challenge
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
                      {challenge.attemptNo > 1 && ` · attempt ${challenge.attemptNo}`}
                    </p>
                    <p dir="auto" className="mt-1 truncate text-lg">
                      {challenge.name}
                    </p>
                    <p className="tnum mt-0.5 font-mono text-[12px] text-ink-muted">
                      {challenge.lengthDays} days · from {challenge.startDate} ·{' '}
                      {challenge.graceTokensTotal} grace
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
                Nothing here yet. Create a challenge, add your rules, then start day one.
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
  onSubmit: (values: {
    name: string
    startDate: string
    lengthDays: number
    dayCutoffHour: number
    timezone: string
    graceTokensTotal: number
  }) => void
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
          })
        }}
      >
        <Field label="Name">
          <Input
            dir="auto"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="60 days of getting up early"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Length" hint="Any length you want. 30, 60, 75, 100.">
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
          <Field label="Day ends at" hint="Finishing at 1am still counts for the day before.">
            <Input
              type="number"
              min={0}
              max={23}
              required
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
            />
          </Field>
          <Field label="Grace tokens" hint="Missed days you can cover. 0 for full 75 Hard rules.">
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

        {error && (
          <p className="shake text-sm" style={{ color: 'var(--color-clay)' }}>
            {error.message}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? 'Creating…' : 'Create'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

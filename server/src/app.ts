import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { corsOrigins } from './env.js'
import { authenticate } from './auth.js'
import { HttpError } from './errors.js'
import { challengeRoutes } from './routes/challenges.js'
import { taskRoutes } from './routes/tasks.js'
import { todayRoutes } from './routes/today.js'

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

  await app.register(cors, { origin: corsOrigins, credentials: true })

  // `fetch` sends a JSON content-type even on a bodyless POST or DELETE (activate,
  // delete, timer start/stop). Fastify's default parser rejects that as a bad body,
  // so treat an empty payload as an empty object instead of an error.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = typeof body === 'string' ? body.trim() : ''
    if (text === '') return done(null, {})
    try {
      done(null, JSON.parse(text))
    } catch {
      done(new HttpError(400, 'Body is not valid JSON'), undefined)
    }
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message })
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
    // A unique-index violation is a race we lost, not a server fault.
    if ((error as { code?: string }).code === '23505') {
      return reply.code(409).send({ error: 'That conflicts with something that already exists.' })
    }
    // Fastify's own client errors already carry the right status; do not bury them as 500.
    const status = (error as { statusCode?: number }).statusCode
    if (typeof status === 'number' && status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : 'Invalid request'
      return reply.code(status).send({ error: message })
    }
    request.log.error(error)
    return reply.code(500).send({ error: 'Something went wrong.' })
  })

  app.get('/health', async () => ({ ok: true }))

  // Everything below this line requires a verified token.
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('onRequest', authenticate)

    protectedRoutes.get('/api/me', async (request) => ({ user: request.user }))

    await protectedRoutes.register(challengeRoutes)
    await protectedRoutes.register(taskRoutes)
    await protectedRoutes.register(todayRoutes)
  })

  return app
}

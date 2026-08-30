import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../src/app.js'

/**
 * Vercel serverless entry point.
 *
 * `src/index.ts` calls `listen()`, which a serverless runtime never wants. Here the
 * Fastify instance is built once per warm container and handed each request through
 * its internal HTTP server, so routing, hooks and the error handler all behave exactly
 * as they do locally.
 */
let ready: Promise<Awaited<ReturnType<typeof buildApp>>> | null = null

async function getApp() {
  // Cached across invocations on a warm container; a cold start pays this once.
  if (!ready) {
    ready = buildApp().then(async (app) => {
      await app.ready()
      return app
    })
  }
  return ready
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const app = await getApp()
  app.server.emit('request', request, response)
}

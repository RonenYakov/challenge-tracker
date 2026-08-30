import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../server/src/app.js'

/**
 * Vercel serverless entry point for the whole API.
 *
 * It lives at the repository root rather than inside `server/` so the deployment can
 * see the npm workspaces: `@ct/shared` only resolves when the install runs from the
 * root. `server/src/index.ts` remains the local entry point and still calls `listen()`.
 *
 * The client is served from this same deployment, so requests are same-origin and CORS
 * never comes into it in production.
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

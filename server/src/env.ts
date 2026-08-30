import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// Local development reads server/.env. In production the platform supplies the
// variables directly, so a missing file is expected rather than an error.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const schema = z.object({
  /** Postgres connection string. Supabase: Settings -> Database -> Connection string (pooler). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Supabase project URL, used to locate the JWKS endpoint that signs user tokens. */
  SUPABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
})

function load() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid server environment:\n${missing}\n\nCopy server/.env.example to server/.env and fill it in.`)
  }
  return parsed.data
}

export const env = load()

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL)

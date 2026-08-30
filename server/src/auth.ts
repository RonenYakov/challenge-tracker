import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { env, jwksUrl } from './env.js'
import { sql } from './db.js'
import { HttpError } from './errors.js'

/**
 * Supabase signs user tokens with ES256 and publishes the public keys.
 * jose caches and refreshes the key set on its own, so this is one object for the process.
 */
const jwks = createRemoteJWKSet(jwksUrl)
const issuer = new URL('/auth/v1', env.SUPABASE_URL).toString()

export interface AuthUser {
  id: string
  email: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

/** User ids already written to `profiles` in this process, so we upsert once, not per request. */
const knownProfiles = new Set<string>()

async function ensureProfile(user: AuthUser): Promise<void> {
  if (knownProfiles.has(user.id)) return

  // Email is stored lowercased and trimmed so it agrees with the unique index on lower(email).
  await sql`
    insert into profiles (id, email)
    values (${user.id}, ${user.email})
    on conflict (id) do update set email = excluded.email
  `
  knownProfiles.add(user.id)
}

function bearerFrom(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing bearer token')
  }
  return header.slice('Bearer '.length).trim()
}

/**
 * Verifies the token and attaches the user. Everything downstream reads `request.user.id`
 * and never a user id from the body or query, which is what stops one account writing to another.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = bearerFrom(request)

  let payload
  try {
    ;({ payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' }))
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

  const id = typeof payload.sub === 'string' ? payload.sub : null
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null
  if (!id || !email) {
    throw new HttpError(401, 'Token is missing a subject or email')
  }

  request.user = { id, email }
  await ensureProfile(request.user)
}

// Signature HMAC-SHA256 des appels internes Supabase ⇄ Vercel (og-render, revalidate).
// Code pur WebCrypto : identique sous Deno et Node.
//   message = `${timestamp}.${METHOD}.${path}.${sha256(body)}`
//   en-têtes : x-hamac-timestamp (secondes), x-hamac-signature (hex)
import { sha256Hex } from './model.ts'

export const SIGNATURE_WINDOW_SECONDS = 300
const encoder = new TextEncoder()

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signRequest(secret: string, method: string, path: string, body: string, nowSeconds?: number) {
  const timestamp = String(nowSeconds ?? Math.floor(Date.now() / 1000))
  const message = `${timestamp}.${method.toUpperCase()}.${path}.${await sha256Hex(body)}`
  return { 'x-hamac-timestamp': timestamp, 'x-hamac-signature': await hmacHex(secret, message) }
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type VerifyResult = { ok: true } | { ok: false; reason: string }

export async function verifyRequest(
  secret: string | undefined,
  method: string,
  path: string,
  body: string,
  headers: { get(name: string): string | null },
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  if (!secret || secret.length < 32) return { ok: false, reason: 'secret absent ou trop court' }
  const timestamp = headers.get('x-hamac-timestamp') ?? ''
  const signature = (headers.get('x-hamac-signature') ?? '').toLowerCase()
  if (!/^\d{9,11}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return { ok: false, reason: 'en-têtes invalides' }
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_WINDOW_SECONDS) return { ok: false, reason: 'horodatage expiré' }
  const expected = await hmacHex(secret, `${timestamp}.${method.toUpperCase()}.${path}.${await sha256Hex(body)}`)
  return constantTimeEqual(expected, signature) ? { ok: true } : { ok: false, reason: 'signature invalide' }
}

/**
 * Jeton partagé de listing-feed, comparé à temps constant. LISTING_FEED_TOKEN peut contenir
 * plusieurs jetons séparés par des virgules (un pour la Preview, un pour la production) :
 * révoquer la Preview = retirer son jeton, sans toucher à la production.
 */
export function tokenMatches(expected: string | undefined, provided: string | null) {
  if (!expected || !provided) return false
  let ok = false
  for (const token of expected.split(',').map((t) => t.trim())) {
    if (token.length >= 32 && constantTimeEqual(token, provided)) ok = true
  }
  return ok
}

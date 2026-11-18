/** Same canonical string as OTOMATE: `OTO1\nMETHOD\nPATH\nQUERY\nSHA256\nTIMESTAMP\nNONCE`. */

export const SIGNATURE_PROTOCOL = "OTO1"
export const SIGNATURE_WINDOW_SECONDS = 60
export const SIGNED_PATH = "/dashboard-metrics"

export type SignatureInput = {
  method: string
  path: string
  query: Readonly<Record<string, string>>
  body: string
  timestamp: number
  nonce: string
}

export type VerifyKey = { id: string; secret: string }

const encoder = new TextEncoder()

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function sha256Hex(body: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(body)))
}

export function canonicalQuery(query: Readonly<Record<string, string>>): string {
  return Object.entries(query)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

export async function canonicalRequest(input: SignatureInput): Promise<string> {
  return [
    SIGNATURE_PROTOCOL,
    input.method.toUpperCase(),
    input.path,
    canonicalQuery(input.query),
    await sha256Hex(input.body),
    String(input.timestamp),
    input.nonce,
  ].join("\n")
}

export async function signHex(input: SignatureInput, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(await canonicalRequest(input)))
  return hex(signed)
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length || left.length === 0) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

export function rejectionBody(): { error: "rejected" } {
  return { error: "rejected" }
}

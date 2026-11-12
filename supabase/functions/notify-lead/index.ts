import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEXT_MAX = 4000
const DEFAULT_FROM = "Hamac — site <notifications@send.hamacpatrimoine.com>"

type FormTable = "leads" | "estimation_submissions" | "offmarket_submissions"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

function jwtRole(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (!header?.toLowerCase().startsWith("bearer ")) return null
  const token = header.slice(7).trim()
  const payloadPart = token.split(".")[1]
  if (!payloadPart) return null
  try {
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(padded)) as { role?: string }
    return payload.role ?? null
  } catch {
    return null
  }
}

function truncate(value: string): string {
  return value.length > TEXT_MAX ? value.slice(0, TEXT_MAX) : value
}

/** Champ affiché : tiret cadratin si absent, jamais null/undefined. */
function field(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number" && Number.isFinite(value)) return truncate(String(value))
  if (typeof value !== "string") return "—"
  const trimmed = value.trim()
  return trimmed ? truncate(trimmed) : "—"
}

function parseRecipients(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const email = part.trim()
    if (!email || !EMAIL_RE.test(email) || seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    out.push(email)
  }
  return out
}

function formatParisDate(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) return "—"
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return "—"
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  const day = get("day")
  const month = get("month")
  const year = get("year")
  const hour = get("hour")
  const minute = get("minute")
  if (!day || !month || !year || !hour || !minute) return "—"
  return `${day}/${month}/${year} ${hour}:${minute}`
}

function buildEmail(
  table: FormTable,
  record: Record<string, unknown>,
): { subject: string; text: string; replyTo: string | undefined } {
  const footer = "Répondre à ce mail écrit directement au prospect."
  const date = formatParisDate(record.created_at)

  if (table === "estimation_submissions") {
    const city = field(record.city)
    const email = field(record.email)
    const subject = `Nouvelle demande d'estimation — ${city}`
    const text = [
      `Prénom : ${field(record.prenom)}`,
      `Nom : ${field(record.nom)}`,
      `Email : ${email}`,
      `Téléphone : ${field(record.telephone)}`,
      `Type de bien : ${field(record.property_type)}`,
      `Commune : ${city}`,
      `Surface habitable (m²) : ${field(record.surface_habitable)}`,
      `Surface terrain (m²) : ${field(record.surface_terrain)}`,
      `Pièces : ${field(record.nombre_pieces)}`,
      `Chambres : ${field(record.nombre_chambres)}`,
      `Date : ${date}`,
      `Message : ${field(record.message)}`,
      "",
      footer,
    ].join("\n")
    const replyRaw = typeof record.email === "string" ? record.email.trim() : ""
    return { subject: truncate(subject), text, replyTo: EMAIL_RE.test(replyRaw) ? replyRaw : undefined }
  }

  if (table === "offmarket_submissions") {
    const sector = field(record.sector)
    const email = field(record.email)
    const subject = `Nouvelle demande off-market — ${sector}`
    const text = [
      `Prénom : ${field(record.first_name)}`,
      `Nom : ${field(record.last_name)}`,
      `Email : ${email}`,
      `Téléphone : ${field(record.phone)}`,
      `Type de bien : ${field(record.property_type)}`,
      `Secteur : ${sector}`,
      `Budget : ${field(record.budget)}`,
      `Date : ${date}`,
      "",
      footer,
    ].join("\n")
    const replyRaw = typeof record.email === "string" ? record.email.trim() : ""
    return { subject: truncate(subject), text, replyTo: EMAIL_RE.test(replyRaw) ? replyRaw : undefined }
  }

  // leads (défaut)
  const typeContact = field(record.type_contact)
  const bienRef = field(record.bien_ref)
  const email = field(record.email)
  let subject: string
  if (typeContact === "bien") {
    subject = `Nouvelle demande sur un bien — réf. ${bienRef}`
  } else if (typeContact === "contact") {
    subject = "Nouveau message depuis le formulaire de contact"
  } else {
    subject = `Nouveau contact — ${typeContact}`
  }

  const lines = [
    `Nom : ${field(record.nom)}`,
    `Email : ${email}`,
    `Téléphone : ${field(record.telephone)}`,
  ]
  if (typeContact === "bien") {
    lines.push(`Référence bien : ${bienRef}`)
  }
  lines.push(`Date : ${date}`, `Message : ${field(record.message)}`, "", footer)

  const replyRaw = typeof record.email === "string" ? record.email.trim() : ""
  return {
    subject: truncate(subject),
    text: lines.join("\n"),
    replyTo: EMAIL_RE.test(replyRaw) ? replyRaw : undefined,
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (jwtRole(req) !== "service_role") return json({ error: "forbidden" }, 403)

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
  const recipients = parseRecipients(Deno.env.get("LEAD_NOTIFY_TO"))
  const from = Deno.env.get("LEAD_NOTIFY_FROM")?.trim() || DEFAULT_FROM

  if (!apiKey) {
    console.error("[notify-lead] missing RESEND_API_KEY")
    return json({ error: "unavailable" }, 500)
  }
  if (recipients.length === 0) {
    console.error("[notify-lead] LEAD_NOTIFY_TO misconfigured")
    return json({ error: "misconfigured" }, 500)
  }

  let table: FormTable = "leads"
  let record: Record<string, unknown> = {}
  try {
    const payload = (await req.json()) as {
      table?: unknown
      record?: Record<string, unknown>
    }
    if (payload.table === "estimation_submissions" || payload.table === "offmarket_submissions" || payload.table === "leads") {
      table = payload.table
    } else if (payload.table === undefined || payload.table === null || payload.table === "") {
      table = "leads"
    } else {
      return json({ error: "invalid_table" }, 400)
    }
    record = payload.record && typeof payload.record === "object" ? payload.record : {}
  } catch {
    console.error("[notify-lead] invalid json")
    return json({ error: "invalid_body" }, 400)
  }

  const recordId = field(record.id)
  const { subject, text, replyTo } = buildEmail(table, record)

  const resendBody: Record<string, unknown> = {
    from,
    to: recipients,
    subject,
    text,
    headers: { "X-Entity-Ref-ID": recordId === "—" ? crypto.randomUUID() : recordId },
  }
  if (replyTo) resendBody.reply_to = replyTo

  try {
    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
      signal: AbortSignal.timeout(10_000),
    })
    console.log(
      `[notify-lead] table=${table} id=${recordId} to=${recipients.length} resend=${resend.status}`,
    )
    if (!resend.ok) {
      return json({ error: "send_failed" }, 502)
    }
  } catch (err) {
    console.error("[notify-lead] send error", err instanceof Error ? err.name : "unknown")
    return json({ error: "send_failed" }, 502)
  }

  return json({ ok: true, sent_to: recipients.length })
})

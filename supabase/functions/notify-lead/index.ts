import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEXT_MAX = 4000
const DEFAULT_FROM =
  "Hamac Investissements et Patrimoine <notifications@send.hamacpatrimoine.com>"
const DEFAULT_PROSPECT_FROM =
  "Hamac Investissements & Patrimoine <contact@send.hamacpatrimoine.com>"
const AGENCE_REPLY_TO = "agence@hamacpatrimoine.com"

type FormTable = "leads" | "estimation_submissions" | "offmarket_submissions"
type SendResult = { ok: boolean; status: number }

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

async function sendResend(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    console.error(
      "[notify-lead] send error",
      err instanceof Error ? err.name : "unknown",
    )
    return { ok: false, status: 0 }
  }
}

function buildEmail(
  table: FormTable,
  record: Record<string, unknown>,
): { subject: string; text: string; replyTo: string | undefined } {
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
  lines.push(`Date : ${date}`, `Message : ${field(record.message)}`)

  const replyRaw = typeof record.email === "string" ? record.email.trim() : ""
  return {
    subject: truncate(subject),
    text: lines.join("\n"),
    replyTo: EMAIL_RE.test(replyRaw) ? replyRaw : undefined,
  }
}

const SIGNATURE = [
  "",
  "Bien cordialement,",
  "",
  "L'équipe Hamac Investissements & Patrimoine",
  "19 Bd Baron du Marais, 69110 Sainte-Foy-lès-Lyon",
  "04 78 85 08 27 — agence@hamacpatrimoine.com",
].join("\n")

/** Premier mot d'un champ texte : sert au « Bonjour <prénom> ». */
function prenom(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(/\s+/)[0]
    }
  }
  return ""
}

function salutation(record: Record<string, unknown>, ...keys: string[]): string {
  const p = prenom(record, ...keys)
  return p ? `Bonjour ${p},` : "Bonjour,"
}

const LOGO_URL =
  "https://hamacpatrimoine.com/fr/images/Logo/logo-hamac-email.png"

const FONT = "font-family:Arial,Helvetica,sans-serif"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Signature d'agence : logo hébergé sur le site, jamais de pièce jointe. */
function signatureHtml(): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">',
    "<tr>",
    '<td style="padding:0 0 24px 0;">',
    '<div style="height:1px;background-color:#e3e0da;font-size:0;line-height:0;">&nbsp;</div>',
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:0 0 16px 0;">',
    `<img src="${LOGO_URL}" width="180" height="36" alt="HAMAC Investissements &amp; Patrimoine" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:36px;">`,
    "</td>",
    "</tr>",
    "<tr>",
    `<td style="${FONT};font-size:13px;line-height:22px;color:#6b6b6b;">`,
    '<strong style="color:#142a38;font-size:14px;">L&#39;équipe Hamac Investissements &amp; Patrimoine</strong><br>',
    '04 78 85 08 27 &middot; <a href="mailto:agence@hamacpatrimoine.com" style="color:#142a38;text-decoration:none;">agence@hamacpatrimoine.com</a><br>',
    "19 Bd Baron du Marais, 69110 Sainte-Foy-lès-Lyon<br>",
    '<a href="https://hamacpatrimoine.com" style="color:#142a38;text-decoration:none;">hamacpatrimoine.com</a>',
    "</td>",
    "</tr>",
    "</table>",
  ].join("\n")
}

/** Corps HTML : tables et styles en ligne uniquement — Outlook ignore `<style>`. */
function confirmationHtml(hello: string, paragraphs: string[]): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;${FONT};font-size:15px;line-height:24px;color:#1a1614;">${escapeHtml(p)}</p>`,
    )
    .join("\n")
  return [
    "<!DOCTYPE html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>Hamac Investissements &amp; Patrimoine</title>",
    "</head>",
    '<body style="margin:0;padding:0;background-color:#f7f4ef;">',
    '<div style="display:none;font-size:1px;color:#f7f4ef;line-height:1px;max-height:0;max-width:0;overflow:hidden;">Nous avons bien reçu votre demande.</div>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f4ef;">',
    "<tr>",
    '<td align="center" style="padding:24px 12px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">',
    "<tr>",
    '<td bgcolor="#142a38" height="4" style="background-color:#142a38;height:4px;font-size:0;line-height:0;">&nbsp;</td>',
    "</tr>",
    "<tr>",
    '<td style="padding:32px;">',
    `<p style="margin:0 0 16px 0;${FONT};font-size:15px;line-height:24px;color:#1a1614;">${escapeHtml(hello)}</p>`,
    body,
    `<p style="margin:0 0 24px 0;${FONT};font-size:15px;line-height:24px;color:#1a1614;">Bien cordialement,</p>`,
    signatureHtml(),
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("\n")
}

/** Version texte : même contenu, sans balise, pour les clients qui n'affichent pas le HTML. */
function confirmationText(hello: string, paragraphs: string[]): string {
  return [hello, "", paragraphs.join("\n\n"), SIGNATURE].join("\n")
}

function buildConfirmation(
  table: FormTable,
  record: Record<string, unknown>,
): { to: string; subject: string; text: string; html: string } | null {
  const rawEmail = typeof record.email === "string" ? record.email.trim() : ""
  if (!EMAIL_RE.test(rawEmail)) return null

  if (table === "estimation_submissions") {
    const city = field(record.city)
    const lieu = city === "—" ? "" : ` pour votre bien à ${city}`
    const hello = salutation(record, "prenom", "nom")
    const paragraphs = [
      `Nous avons bien reçu votre demande d'estimation${lieu} et nous vous en remercions.`,
      "Un membre de notre équipe vous contacte sous 24 heures ouvrées pour préciser votre projet et convenir, si vous le souhaitez, d'un rendez-vous sur place.",
      "Si vous avez une question d'ici là, notre agence répond au 04 78 85 08 27.",
    ]
    return {
      to: rawEmail,
      subject: truncate(
        city === "—"
          ? "Votre demande d'estimation — Hamac"
          : `Votre demande d'estimation — ${city}`,
      ),
      text: confirmationText(hello, paragraphs),
      html: confirmationHtml(hello, paragraphs),
    }
  }

  if (table === "offmarket_submissions") {
    const sector = field(record.sector)
    const secteur = sector === "—" ? "" : ` dans le secteur ${sector}`
    const hello = salutation(record, "first_name", "last_name")
    const paragraphs = [
      `Nous avons bien reçu votre inscription off-market${secteur} et nous vous en remercions.`,
      "Votre demande est traitée de façon confidentielle. Un membre de notre équipe vous contacte sous 24 heures ouvrées pour préciser votre recherche.",
      "Si vous avez une question d'ici là, notre agence répond au 04 78 85 08 27.",
    ]
    return {
      to: rawEmail,
      subject: truncate(
        sector === "—"
          ? "Votre inscription off-market — Hamac"
          : `Votre inscription off-market — ${sector}`,
      ),
      text: confirmationText(hello, paragraphs),
      html: confirmationHtml(hello, paragraphs),
    }
  }

  // leads — deux cas : demande sur un bien ou message de contact
  const typeContact = field(record.type_contact)
  if (typeContact === "bien") {
    const bienRef = field(record.bien_ref)
    const ref = bienRef === "—" ? "" : ` (réf. ${bienRef})`
    const hello = salutation(record, "nom")
    const paragraphs = [
      `Nous avons bien reçu votre demande concernant le bien${ref} et nous vous en remercions.`,
      "Un membre de notre équipe vous contacte sous 24 heures ouvrées pour vous répondre et, si vous le souhaitez, organiser une visite.",
      "Si vous avez une question d'ici là, notre agence répond au 04 78 85 08 27.",
    ]
    return {
      to: rawEmail,
      subject: truncate(`Votre demande sur un bien — réf. ${bienRef}`),
      text: confirmationText(hello, paragraphs),
      html: confirmationHtml(hello, paragraphs),
    }
  }

  const hello = salutation(record, "nom")
  const paragraphs = [
    "Nous avons bien reçu votre message et nous vous en remercions.",
    "Un membre de notre équipe vous répond sous 24 heures ouvrées.",
    "Si votre demande est urgente, vous pouvez nous joindre au 04 78 85 08 27.",
  ]
  return {
    to: rawEmail,
    subject: "Nous avons bien reçu votre message — Hamac",
    text: confirmationText(hello, paragraphs),
    html: confirmationHtml(hello, paragraphs),
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (jwtRole(req) !== "service_role") return json({ error: "forbidden" }, 403)

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
  const recipients = parseRecipients(Deno.env.get("LEAD_NOTIFY_TO"))
  // Resend refuse tout caractère non-ASCII dans `from` (422).
  // LEAD_NOTIFY_FROM peut encore contenir l'ancien tiret cadratin — on retombe alors sur DEFAULT_FROM.
  const fromEnv = Deno.env.get("LEAD_NOTIFY_FROM")?.trim()
  const from =
    fromEnv && /^[\x00-\x7F]+$/.test(fromEnv) ? fromEnv : DEFAULT_FROM

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
  const refId = recordId === "—" ? crypto.randomUUID() : recordId
  const { subject, text, replyTo } = buildEmail(table, record)

  const internalBody: Record<string, unknown> = {
    from,
    to: recipients,
    subject,
    text,
    headers: { "X-Entity-Ref-ID": refId },
  }
  if (replyTo) internalBody.reply_to = replyTo

  const confirmation = buildConfirmation(table, record)
  const prospectFrom =
    Deno.env.get("PROSPECT_FROM")?.trim() || DEFAULT_PROSPECT_FROM
  const prospectReplyTo =
    Deno.env.get("PROSPECT_REPLY_TO")?.trim() || AGENCE_REPLY_TO

  const prospectBody: Record<string, unknown> | null = confirmation
    ? {
        from: prospectFrom,
        to: [confirmation.to],
        subject: confirmation.subject,
        text: confirmation.text,
        html: confirmation.html,
        reply_to: prospectReplyTo,
        headers: { "X-Entity-Ref-ID": `${refId}-accuse` },
      }
    : null

  const [internal, prospect] = await Promise.all([
    sendResend(apiKey, internalBody),
    prospectBody
      ? sendResend(apiKey, prospectBody)
      : Promise.resolve<SendResult>({ ok: false, status: 0 }),
  ])

  console.log(
    `[notify-lead] table=${table} id=${refId} to=${recipients.length} resend=${internal.status} prospect=${prospectBody ? prospect.status : "skipped"}`,
  )

  if (!internal.ok) return json({ error: "send_failed" }, 502)

  return json({
    ok: true,
    sent_to: recipients.length,
    prospect: prospectBody ? (prospect.ok ? "sent" : "failed") : "skipped",
  })
})

/**
 * Décision de journalisation des échecs techniques d'envoi.
 * Aucune donnée personnelle, aucun message, aucune adresse IP.
 * Les refus de validation, Turnstile et quota ne produisent aucune entrée.
 */

export type DeliveryForm = "contact" | "bien" | "estimation" | "offmarket"

export type JournalStage = "record" | "agency_notify" | "prospect_confirm"

export type JournalReason =
  | "database_unreachable"
  | "insert_failed"
  | "send_failed"
  | "unconfigured"
  | "unreachable"

export type JournalEvent = { stage: JournalStage; reason: JournalReason }

const FORMS = new Set<DeliveryForm>(["contact", "bien", "estimation", "offmarket"])

/** Résultat de submit-form. Seul un INSERT déjà tenté est un échec technique. */
export type RecordOutcome =
  | "inserted"
  | "http"
  | "unreachable"
  | "invalid_body"
  | "invalid_form"
  | "invalid_payload"
  | "turnstile_failed"
  | "rate_limited"
  | "unavailable"

export function recordJournal(outcome: RecordOutcome): JournalEvent | null {
  if (outcome === "http") return { stage: "record", reason: "insert_failed" }
  if (outcome === "unreachable") return { stage: "record", reason: "database_unreachable" }
  return null
}

export function formOf(table: string, typeContact: unknown): DeliveryForm | null {
  if (table === "estimation_submissions") return "estimation"
  if (table === "offmarket_submissions") return "offmarket"
  if (table === "leads" && (typeContact === "bien" || typeContact === "contact")) return typeContact
  return null
}

export function notifyJournals(input: {
  configured: boolean
  agency: "ok" | "http" | "unreachable"
  prospect: "skipped" | "ok" | "http" | "unreachable"
}): JournalEvent[] {
  if (!input.configured) {
    const events: JournalEvent[] = [{ stage: "agency_notify", reason: "unconfigured" }]
    if (input.prospect !== "skipped") events.push({ stage: "prospect_confirm", reason: "unconfigured" })
    return events
  }
  const events: JournalEvent[] = []
  if (input.agency === "unreachable") events.push({ stage: "agency_notify", reason: "unreachable" })
  else if (input.agency === "http") events.push({ stage: "agency_notify", reason: "send_failed" })
  if (input.prospect === "unreachable") events.push({ stage: "prospect_confirm", reason: "unreachable" })
  else if (input.prospect === "http") events.push({ stage: "prospect_confirm", reason: "send_failed" })
  return events
}

export type JournalWrite = "recorded" | "unavailable" | "skipped"

/**
 * Écrit une ligne via delivery_failure_record.
 * Si la base est injoignable, retourne "unavailable" sans lever d'exception
 * et sans recopier le corps de la réponse.
 */
export async function postDeliveryFailure(input: {
  supabaseUrl: string | undefined
  serviceKey: string | undefined
  form: DeliveryForm | null
  stage: JournalStage
  reason: JournalReason
  source: "submit-form" | "notify-lead"
  fetchImpl?: typeof fetch
  log?: (line: string) => void
}): Promise<JournalWrite> {
  const log = input.log ?? (() => {})
  const prefix = `[${input.source}]`
  if (!input.form || !FORMS.has(input.form)) {
    log(`${prefix} journal skipped stage=${input.stage} reason=${input.reason}`)
    return "skipped"
  }
  const url = input.supabaseUrl?.trim()
  const key = input.serviceKey?.trim()
  if (!url || !key) {
    log(`${prefix} journal unavailable form=${input.form} stage=${input.stage} reason=${input.reason}`)
    return "unavailable"
  }
  try {
    const response = await (input.fetchImpl ?? fetch)(
      `${url.replace(/\/$/, "")}/rest/v1/rpc/delivery_failure_record`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: key,
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          p_form: input.form,
          p_stage: input.stage,
          p_reason: input.reason,
        }),
        signal: AbortSignal.timeout(3_000),
      },
    )
    if (!response.ok) {
      log(
        `${prefix} journal unavailable form=${input.form} stage=${input.stage} reason=${input.reason} status=${response.status}`,
      )
      return "unavailable"
    }
    return "recorded"
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown"
    log(
      `${prefix} journal unavailable form=${input.form} stage=${input.stage} reason=${input.reason} error=${name}`,
    )
    return "unavailable"
  }
}

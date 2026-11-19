/** Turns the aggregate read into the OTOMATE document. Identity fields are never copied. */

const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
]

const FORBIDDEN_KEYS = new Set([
  "email",
  "nom",
  "prenom",
  "telephone",
  "phone",
  "message",
  "budget",
  "first_name",
  "last_name",
  "user",
])

export type CountPair = { value: number; previous: number }

export type CatalogSource = {
  ref: string
  city: string
  surface: number | null
  price: number
  rental: boolean
  leads: number
  last: string | null
}

export type DeliveryRead = {
  since: string
  failed?: {
    value: number
    previous: number
    attempts: number
    rows: { label: string; count: number }[]
  }
}

export type MetricsRead = {
  received: CountPair
  estimations: CountPair
  byDay: {
    start: string
    bien: number[]
    contact: number[]
    estimation: number[]
    offmarket: number[]
  }
  weekly: { date: string; value: number }[]
  latest: { kind: string; label: string; detail: string; when: string }[]
  catalog: CatalogSource[] | null
  sends?: DeliveryRead
}

const STAGE_LABELS = new Set(["Enregistrement", "Notification agence", "Confirmation prospect"])

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

/** Accepte seulement la date de début et les comptes. Tout autre champ est rejeté. */
export function acceptDelivery(value: unknown): DeliveryRead | null {
  if (value === null || value === undefined) return null
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort().join(",")
  if (keys !== "since" && keys !== "failed,since") return null
  if (typeof record.since !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.since)) return null
  if (!("failed" in record)) return { since: record.since }
  const failed = record.failed
  if (!failed || typeof failed !== "object" || Array.isArray(failed)) return null
  const counts = failed as Record<string, unknown>
  if (Object.keys(counts).sort().join(",") !== "attempts,previous,rows,value") return null
  if (!whole(counts.value) || !whole(counts.previous) || !whole(counts.attempts)) return null
  if (!Array.isArray(counts.rows)) return null
  const rows: { label: string; count: number }[] = []
  for (const item of counts.rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null
    const entry = item as Record<string, unknown>
    if (Object.keys(entry).sort().join(",") !== "count,label") return null
    if (typeof entry.label !== "string" || !STAGE_LABELS.has(entry.label)) return null
    if (!whole(entry.count) || entry.count === 0) return null
    rows.push({ label: entry.label, count: entry.count })
  }
  return {
    since: record.since,
    failed: {
      value: counts.value,
      previous: counts.previous,
      attempts: counts.attempts,
      rows,
    },
  }
}

export function formatWhen(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return value
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return value
  return `${Number(match[3])} ${month} ${match[4]}:${match[5]}`
}

export function formatPrice(value: number, rental: boolean): string {
  const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
  return rental ? `${amount} € / mois` : `${amount} €`
}

export function catalogTitle(city: string, surface: number | null, ref: string): string {
  return surface === null ? ref : `${city} ${surface}m²`
}

const REFERENCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/i

/** A property reference may be numeric. Any other text with an address or a long number is withheld. */
export function containsIdentity(value: string): boolean {
  if (value.includes("@")) return true
  if (REFERENCE_RE.test(value)) return false
  return value.replace(/\D/g, "").length >= 9
}

function assertSafe(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertSafe)
    return
  }
  if (!value || typeof value !== "object") return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error("forbidden field")
    assertSafe(nested)
  }
}

export function buildDocument(
  period: { from: string; to: string },
  metrics: MetricsRead,
): Record<string, unknown> {
  assertSafe(metrics)
  const document: Record<string, unknown> = {
    version: 1,
    period,
    leads: {
      received: metrics.received,
      estimations: metrics.estimations,
      byDay: metrics.byDay,
      weekly: { points: metrics.weekly },
      latest: {
        items: metrics.latest.map((item) => {
          const label = containsIdentity(item.label) ? "Demande" : item.label
          return {
            kind: item.kind,
            label,
            detail: containsIdentity(item.detail) ? label : item.detail,
            when: formatWhen(item.when),
          }
        }),
      },
    },
  }
  if (metrics.sends) {
    const sends: Record<string, unknown> = { since: metrics.sends.since }
    if (metrics.sends.failed) {
      sends.failed = {
        value: metrics.sends.failed.value,
        previous: metrics.sends.failed.previous,
        attempts: metrics.sends.failed.attempts,
        rows: metrics.sends.failed.rows.map((row) => ({ label: row.label, count: row.count })),
      }
    }
    document.sends = sends
  }
  if (metrics.catalog) {
    document.catalog = metrics.catalog.flatMap((row) => {
      const title = catalogTitle(row.city, row.surface, row.ref)
      if (containsIdentity(row.city) || containsIdentity(row.ref) || containsIdentity(title)) return []
      const item: Record<string, unknown> = {
        title,
        city: row.city,
        ref: row.ref,
        kind: row.rental ? "Location" : "Vente",
        price: formatPrice(row.price, row.rental),
        leads: row.leads,
      }
      if (row.last) item.last = formatWhen(row.last)
      return [item]
    })
  }
  assertSafe(document)
  return document
}

// ─────────────────────────────────────────────
// supabase/functions/submit-form/validate.ts
// Validation serveur des 4 formulaires du site.
// Miroir exact des contraintes CHECK ajoutées en base (migration
// 20261116120000_form_throttle_and_checks.sql) : même règles, mêmes refus.
// Volontairement souple : accents, apostrophes, traits d'union, numéros
// internationaux et adresses exotiques passent. Seul le spam évident tombe.
// ─────────────────────────────────────────────

export type FormKind = "contact" | "bien" | "estimation" | "offmarket"
export type TargetTable = "leads" | "estimation_submissions" | "offmarket_submissions"
export type FieldError = { field: string; message: string }

export type Validated =
  | { ok: true; table: TargetTable; row: Record<string, unknown> }
  | { ok: false; fields: FieldError[] }

export const FORM_KINDS: FormKind[] = ["contact", "bien", "estimation", "offmarket"]

/** Lettres Unicode + apostrophes + traits d'union + espaces. Jamais de chiffre. */
const NAME_RE = /^[\p{L}][\p{L}'’\- ]*$/u
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const BIEN_REF_RE = /^[a-z0-9][a-z0-9-]{0,39}$/i
/** Domaines jetables déjà observés dans le spam Hamac. Extensible. */
const DISPOSABLE_RE = /@(probox\.my\.id|yopmail\.[a-z]+|mailinator\.[a-z]+|guerrillamail\.[a-z]+|sharklasers\.[a-z]+|tempmail\.[a-z]+)$/i

const MESSAGE_MAX = 2000
const NAME_MAX = 70
const EMAIL_MAX = 254
const LABEL_MAX = 80

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

const collapse = (value: string): string => value.replace(/\s+/g, " ")

function checkName(value: unknown, field: string, errors: FieldError[]): string {
  const clean = collapse(str(value))
  if (!clean) {
    errors.push({ field, message: "Ce champ est requis." })
    return ""
  }
  if (clean.length < 2 || clean.length > NAME_MAX) {
    errors.push({ field, message: `Entre 2 et ${NAME_MAX} caractères.` })
    return ""
  }
  if (/\d/.test(clean) || !NAME_RE.test(clean)) {
    errors.push({ field, message: "Nom invalide : lettres, espaces, apostrophes et traits d’union uniquement." })
    return ""
  }
  return clean
}

/** Canonicalise en `+33612345678` / `0612345678` : supprime espaces, points, tirets, parenthèses. */
function checkPhone(value: unknown, field: string, errors: FieldError[], required = true): string | null {
  const raw = str(value)
  if (!raw) {
    if (required) errors.push({ field, message: "Ce champ est requis." })
    return null
  }
  const clean = raw.replace(/[\s.\-()\u00a0]/g, "")
  if (!/^\+?\d{9,15}$/.test(clean)) {
    errors.push({ field, message: "Numéro invalide : 9 à 15 chiffres, format international accepté (+41, +32…)." })
    return null
  }
  return clean
}

function checkEmail(value: unknown, field: string, errors: FieldError[]): string {
  const clean = str(value).toLowerCase()
  if (!clean) {
    errors.push({ field, message: "L’adresse e-mail est requise." })
    return ""
  }
  if (
    clean.length > EMAIL_MAX ||
    !EMAIL_RE.test(clean) ||
    clean.includes("..") ||
    DISPOSABLE_RE.test(clean)
  ) {
    errors.push({ field, message: "Adresse e-mail invalide." })
    return ""
  }
  return clean
}

function checkMessage(value: unknown, field: string, errors: FieldError[]): string | null {
  const clean = str(value)
  if (!clean) return null
  if (clean.length > MESSAGE_MAX) {
    errors.push({ field, message: `Message trop long (${MESSAGE_MAX} caractères maximum).` })
    return null
  }
  return clean
}

/** Libellés (type de bien, secteur, budget) : texte court, pas de contrainte de forme. */
function checkLabel(value: unknown, field: string, errors: FieldError[]): string | null {
  const clean = collapse(str(value))
  if (!clean) return null
  if (clean.length > LABEL_MAX) {
    errors.push({ field, message: `Maximum ${LABEL_MAX} caractères.` })
    return null
  }
  return clean
}

function checkInt(value: unknown, field: string, errors: FieldError[]): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number.parseInt(str(value), 10)
  if (!Number.isFinite(n) || n < 0 || n > 10000) {
    errors.push({ field, message: "Valeur numérique invalide." })
    return null
  }
  return Math.trunc(n)
}

export function validateSubmission(form: FormKind, data: unknown): Validated {
  const src = (data ?? {}) as Record<string, unknown>
  const errors: FieldError[] = []

  if (form === "contact" || form === "bien") {
    const nom = checkName(src.nom, "nom", errors)
    const email = checkEmail(src.email, "email", errors)
    const telephone = checkPhone(src.telephone, "telephone", errors)
    const message = checkMessage(src.message, "message", errors)
    let bienRef: string | null = null
    if (form === "bien") {
      const ref = str(src.bien_ref)
      if (!ref) {
        errors.push({ field: "bien_ref", message: "Référence du bien manquante." })
      } else if (!BIEN_REF_RE.test(ref)) {
        errors.push({ field: "bien_ref", message: "Référence du bien invalide." })
      } else {
        bienRef = ref
      }
    }
    if (errors.length) return { ok: false, fields: errors }
    return {
      ok: true,
      table: "leads",
      row: {
        nom,
        email,
        telephone,
        message,
        type_contact: form === "bien" ? "bien" : "contact",
        bien_ref: bienRef,
      },
    }
  }

  if (form === "estimation") {
    const nom = checkName(src.nom, "nom", errors)
    const prenom = checkName(src.prenom, "prenom", errors)
    const email = checkEmail(src.email, "email", errors)
    const telephone = checkPhone(src.telephone, "telephone", errors)
    const message = checkMessage(src.message, "message", errors)
    const propertyType = checkLabel(src.property_type, "property_type", errors)
    const city = checkLabel(src.city, "city", errors)
    if (!propertyType) errors.push({ field: "property_type", message: "Type de bien manquant." })
    if (!city) errors.push({ field: "city", message: "Commune manquante." })
    const surface = checkInt(src.surface_habitable, "surface_habitable", errors)
    const pieces = checkInt(src.nombre_pieces, "nombre_pieces", errors)
    const chambres = checkInt(src.nombre_chambres, "nombre_chambres", errors)
    const terrain = checkInt(src.surface_terrain, "surface_terrain", errors)
    if (errors.length) return { ok: false, fields: errors }
    return {
      ok: true,
      table: "estimation_submissions",
      row: {
        nom,
        prenom,
        email,
        telephone,
        message,
        property_type: propertyType,
        city,
        surface_habitable: surface,
        nombre_pieces: pieces,
        nombre_chambres: chambres,
        surface_terrain: terrain,
      },
    }
  }

  // offmarket
  const firstName = checkName(src.first_name, "first_name", errors)
  const lastName = checkName(src.last_name, "last_name", errors)
  const email = checkEmail(src.email, "email", errors)
  const phone = checkPhone(src.phone, "phone", errors)
  const propertyType = checkLabel(src.property_type, "property_type", errors)
  const sector = checkLabel(src.sector, "sector", errors)
  const budget = checkLabel(src.budget, "budget", errors)
  if (errors.length) return { ok: false, fields: errors }
  return {
    ok: true,
    table: "offmarket_submissions",
    row: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      property_type: propertyType,
      sector,
      budget,
    },
  }
}

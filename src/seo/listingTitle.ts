const TYPE_LABELS: Record<string, string> = {
  appartement: 'appartement',
  maison: 'maison',
  terrain: 'terrain',
  commerce: 'commerce',
  bureau: 'bureau',
  garage: 'garage',
  immeuble: 'immeuble',
}

export function listingTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? 'bien'
}

export function listingDocumentTitle(property: {
  title: string
  city: string
  type: string
  slug: string
}) {
  const typeLabel = listingTypeLabel(property.type)
  return `${property.title} · ${typeLabel} · réf. ${property.slug} — Hamac Investissements & Patrimoine`
}

export function listingMetaDescription(property: {
  description?: string
  title: string
  city: string
  slug: string
}) {
  const base = (property.description ?? `${property.title} à ${property.city}. Contactez Hamac pour visiter ce bien.`)
    .replace(/\s+/g, ' ')
    .trim()
  const withRef = `${base} Réf. ${property.slug}.`
  if (withRef.length <= 155) return withRef
  return `${withRef.slice(0, 152).trimEnd()}…`
}

export function listingHeadline(property: { title: string; city: string; type: string; slug: string }) {
  return `${property.title} · ${listingTypeLabel(property.type)} · réf. ${property.slug} à ${property.city}`
}

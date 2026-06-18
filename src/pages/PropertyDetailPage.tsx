import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PropertyCard } from '../components/PropertyCard'
import type { Property } from '../data/properties'
import { submitLead } from '../services/leads'
import {
  getProperties,
  getPropertyById,
  getRentalProperties,
  type EnergyRating,
  type FeaturedProperty,
} from '../services/apimo'
import { usePageMeta } from '../utils/seo'
import { PagePlaceholder } from './PagePlaceholder'

const fallbackMainImage = '/images/Biens/maison-homepage.jpg'
const DESCRIPTION_PREVIEW_LIMIT = 300
const DEFAULT_CONTACT_MESSAGE = 'Je souhaite etre recontacte au sujet de ce bien...'

const ENERGY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

function EnergyRatingScale({
  rating,
  variant,
  unit,
}: {
  rating: EnergyRating
  variant: 'energy' | 'ges'
  unit: string
}) {
  const activeClass = rating.class?.toUpperCase()
  return (
    <div className={`energy-scale energy-scale--${variant}`}>
      <p className="energy-scale__caption">
        {variant === 'energy' ? 'Classe énergie' : 'Classe climat'}
      </p>
      {rating.value !== undefined ? (
        <p className="energy-scale__value">
          {new Intl.NumberFormat('fr-FR').format(rating.value)} <span>{unit}</span>
        </p>
      ) : null}
      <ul className="energy-scale__bars">
        {ENERGY_CLASSES.map((letter) => {
          const isActive = letter === activeClass
          return (
            <li
              key={letter}
              className={`energy-scale__bar energy-scale__bar--${letter} ${isActive ? 'is-active' : ''}`}
            >
              <span className="energy-scale__letter">{letter}</span>
              {isActive ? <span className="energy-scale__marker" aria-hidden>◄</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type RequiredContactField = 'name' | 'email' | 'phone'

function validateContactFields(
  name: string,
  email: string,
  phone: string,
): Partial<Record<RequiredContactField, string>> {
  const errors: Partial<Record<RequiredContactField, string>> = {}
  if (!name.trim()) errors.name = 'Le nom est requis.'
  if (!email.trim()) errors.email = "L'email est requis."
  if (!phone.trim()) errors.phone = 'Le téléphone est requis.'
  return errors
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function featuredToPropertyCard(p: FeaturedProperty): Property {
  return {
    slug: p.slug,
    title: p.title,
    city: p.city,
    type: p.type,
    price: p.price,
    surface: p.surface,
    rooms: p.rooms,
    bedrooms: p.bedrooms,
    badge: p.badge ?? 'Nouveau',
    reference: p.slug,
    description: p.description ?? '',
    heating: '',
    exposure: '',
    year: 0,
    dpe: '',
    lat: typeof p.lat === 'number' ? p.lat : Number.NaN,
    lng: typeof p.lng === 'number' ? p.lng : Number.NaN,
    amenities: p.amenities,
    images: p.images.length ? p.images : [fallbackMainImage],
  }
}

type DescriptionBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

function parseDescriptionBlocks(rawDescription: string): DescriptionBlock[] {
  const lines = rawDescription
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const blocks: DescriptionBlock[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (!listBuffer.length) return
    blocks.push({ kind: 'list', items: listBuffer })
    listBuffer = []
  }

  for (const line of lines) {
    const isListItem = line.startsWith('- ') || line.startsWith('• ')
    if (isListItem) {
      listBuffer.push(line.replace(/^(- |• )/, '').trim())
      continue
    }

    flushList()
    blocks.push({ kind: 'paragraph', text: line })
  }

  flushList()
  return blocks
}

export function PropertyDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams()
  const propertyId = slug ?? ''
  const isRentalRoute =
    (typeof window !== 'undefined' ? window.location.pathname : location.pathname).includes('/louer')
  const listingPath = isRentalRoute ? '/louer' : '/acheter'

  const [property, setProperty] = useState<FeaturedProperty | null>(null)
  const [similar, setSimilar] = useState<Property[]>([])
  const [activeImage, setActiveImage] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(DEFAULT_CONTACT_MESSAGE)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RequiredContactField, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const meta = useMemo(() => {
    if (!property) {
      return {
        title: 'Bien immobilier — Hamac Investissements & Patrimoine',
        description: 'Découvrez nos biens immobiliers dans l’Ouest lyonnais.',
      }
    }

    return {
      title: `${property.title} à ${property.city} — Hamac Investissements & Patrimoine`,
      description:
        property.description?.slice(0, 160) ??
        `${property.title} à ${property.city}. Contactez Hamac pour visiter ce bien.`,
    }
  }, [property])

  usePageMeta({ title: meta.title, description: meta.description })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setProperty(null)
      setSimilar([])
      setActiveImage(0)
      setIsLightboxOpen(false)

      if (!propertyId) {
        navigate(listingPath, { replace: true })
        return
      }

      try {
        let p = await getPropertyById(propertyId)
        if (!p) {
          const rentals = await getRentalProperties()
          p = rentals.find((entry) => entry.slug === propertyId) ?? null
        }
        if (cancelled) return

        if (!p) {
          setIsRedirecting(true)
          navigate(listingPath, { replace: true })
          return
        }

        setProperty(p)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isRentalRoute, listingPath, navigate, propertyId])

  useEffect(() => {
    if (!property) return

    let cancelled = false
    const loadSimilar = async () => {
      try {
        const all = await getProperties()
        if (cancelled) return
        const cityNorm = normalize(property.city)
        const next = all
          .filter((p) => normalize(p.city) === cityNorm && p.slug !== property.slug)
          .slice(0, 3)
          .map(featuredToPropertyCard)
        setSimilar(next)
      } catch {
        // Keep similar empty on error.
      }
    }

    void loadSimilar()
    return () => {
      cancelled = true
    }
  }, [property])

  useEffect(() => {
    if (!isLightboxOpen || !property?.images.length) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLightboxOpen(false)
        return
      }
      if (event.key === 'ArrowRight') {
        setActiveImage((prev) => (prev + 1) % property.images.length)
        return
      }
      if (event.key === 'ArrowLeft') {
        setActiveImage((prev) => (prev - 1 + property.images.length) % property.images.length)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isLightboxOpen, property?.images.length])

  useEffect(() => {
    setIsDescriptionExpanded(false)
  }, [property?.slug])

  useEffect(() => {
    setSubmitSuccess(false)
    setSubmitError(null)
    setFieldErrors({})
  }, [property?.slug])

  const agent = property?.agent
  const agentPicture = agent?.picture ?? '/images/team/anthony.jpg'
  const agentName = agent?.name ?? 'Équipe Hamac'

  const mapUrl = useMemo(() => {
    if (!property) return null
    if (!Number.isFinite(property.lat as number) || !Number.isFinite(property.lng as number)) return null
    return `https://maps.google.com/maps?q=${property.lat},${property.lng}&z=14&output=embed`
  }, [property])

  const clearFieldError = (field: RequiredContactField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!property || isSubmitting) return

    const errors = validateContactFields(name, email, phone)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSubmitError(null)
      return
    }

    setFieldErrors({})

    const bienRef = property.slug || propertyId

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await submitLead({
        nom: name.trim(),
        email: email.trim(),
        telephone: phone.trim(),
        message: message.trim() || null,
        type_contact: 'bien',
        bien_ref: bienRef,
      })

      setSubmitSuccess(true)
    } catch (err) {
      console.error('Erreur fiche bien:', err)
      setSubmitError('Une erreur est survenue, veuillez réessayer ou nous contacter directement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isRedirecting || loading) return <PagePlaceholder title="Chargement..." />
  if (error) return <PagePlaceholder title="Erreur de chargement" />
  if (!property) return <PagePlaceholder title="Bien introuvable" />

  const mainImage = property.images[activeImage] ?? property.images[0] ?? fallbackMainImage
  const imagesCount = property.images.length
  const fullDescription = property.description?.trim() ?? ''
  const hasLongDescription = fullDescription.length > DESCRIPTION_PREVIEW_LIMIT
  const visibleDescription =
    hasLongDescription && !isDescriptionExpanded
      ? `${fullDescription.slice(0, DESCRIPTION_PREVIEW_LIMIT).trimEnd()}…`
      : fullDescription
  const descriptionBlocks = parseDescriptionBlocks(visibleDescription)

  const details = property.details
  const summaryRows: Array<[string, string]> = [
    ...(details?.reference ? [['Référence', details.reference] as [string, string]] : []),
    ...(property.rooms ? [['Pièces', `${property.rooms} pièce${property.rooms > 1 ? 's' : ''}`] as [string, string]] : []),
    ...(property.surface ? [['Surface habitable', `${property.surface} m²`] as [string, string]] : []),
    ...(details?.surfaceTotal ? [['Surface totale', `${details.surfaceTotal} m²`] as [string, string]] : []),
    ...(property.bedrooms ? [['Chambres', String(property.bedrooms)] as [string, string]] : []),
    ...(details?.floorLabel
      ? [['Étage', details.floorsTotal ? `${details.floorLabel} / ${details.floorsTotal}` : details.floorLabel] as [string, string]]
      : []),
    ...(details?.condition ? [['État', details.condition] as [string, string]] : []),
    ...(details?.exposures?.length ? [['Exposition', details.exposures.join(', ')] as [string, string]] : []),
    ...(details?.view ? [['Vue', details.view] as [string, string]] : []),
    ...(details?.heatingType ? [['Type de chauffage', details.heatingType] as [string, string]] : []),
    ...(details?.heatingEnergy ? [['Énergie de chauffage', details.heatingEnergy] as [string, string]] : []),
    ...(details?.heatingMode ? [['Moyen de chauffage', details.heatingMode] as [string, string]] : []),
    ...(details?.hotWaterDevice ? [["Type d'eau chaude", details.hotWaterDevice] as [string, string]] : []),
    ...(details?.hotWaterMode ? [["Moyen d'eau chaude", details.hotWaterMode] as [string, string]] : []),
    ...(details?.wasteWater ? [['Eaux usées', details.wasteWater] as [string, string]] : []),
  ]

  const areaEntries = (property.areas ?? []).filter((entry) => entry.surface !== undefined)
  const proximities = property.proximities ?? []
  const hasEnergy = Boolean(property.energy?.class || property.energy?.value !== undefined)
  const hasGes = Boolean(property.ges?.class || property.ges?.value !== undefined)

  const goToPreviousImage = () => {
    if (!imagesCount) return
    setActiveImage((prev) => (prev - 1 + imagesCount) % imagesCount)
  }

  const goToNextImage = () => {
    if (!imagesCount) return
    setActiveImage((prev) => (prev + 1) % imagesCount)
  }

  return (
    <main className="detail-page section section--cream">
      <div className="container">
        <p className="detail-back">
          <Link to={listingPath}>← Retour aux biens</Link>
        </p>

        <div className="detail-layout">
          <div>
            <section className="detail-gallery">
              <div className="detail-gallery__main">
                <button
                  type="button"
                  className="detail-gallery__main-trigger"
                  onClick={() => setIsLightboxOpen(true)}
                  aria-label="Ouvrir la galerie en plein écran"
                >
                  <img src={mainImage} alt={`${property.title} à ${property.city}`} loading={activeImage === 0 ? 'eager' : 'lazy'} />
                </button>
              </div>

              <div className="detail-gallery__thumbs">
                {property.images.map((image, idx) => (
                  <button
                    key={`${image}-${idx}`}
                    type="button"
                    className={`detail-thumb ${activeImage === idx ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveImage(idx)
                      setIsLightboxOpen(true)
                    }}
                  >
                    <img src={image} alt={`Vue ${idx + 1} du bien ${property.title}`} loading="lazy" />
                  </button>
                ))}
              </div>
            </section>

            <section className="detail-card">
              <h2>Description</h2>
              <div className={`detail-description ${hasLongDescription && !isDescriptionExpanded ? 'detail-description--collapsed' : ''}`}>
                <div className="detail-description__content">
                  {descriptionBlocks.length ? descriptionBlocks.map((block, idx) => {
                    if (block.kind === 'list') {
                      return (
                        <ul key={`description-list-${idx}`} className="detail-description__list">
                          {block.items.map((item, itemIdx) => (
                            <li key={`description-list-item-${idx}-${itemIdx}`}>{item}</li>
                          ))}
                        </ul>
                      )
                    }

                    return (
                      <p key={`description-paragraph-${idx}`} className="detail-description__paragraph">
                        {block.text}
                      </p>
                    )
                  }) : (
                    <p className="detail-description__paragraph">Description indisponible.</p>
                  )}
                </div>
              </div>
              {hasLongDescription ? (
                <button
                  type="button"
                  className="detail-description__toggle"
                  onClick={() => setIsDescriptionExpanded((value) => !value)}
                >
                  {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                </button>
              ) : null}

            </section>

            {summaryRows.length ? (
              <section className="detail-card">
                <h2>Sommaire</h2>
                <dl className="detail-summary">
                  {summaryRows.map(([label, value]) => (
                    <div key={label} className="detail-summary__row">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {areaEntries.length ? (
              <section className="detail-card">
                <h2>Surfaces</h2>
                <ul className="detail-areas">
                  {areaEntries.map((entry, idx) => (
                    <li key={`${entry.label}-${idx}`} className="detail-areas__row">
                      <span>
                        {entry.count > 1 ? `${entry.count} ` : ''}
                        {entry.label}
                      </span>
                      <strong>{entry.surface} m²</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {proximities.length ? (
              <section className="detail-card">
                <h2>Proximités</h2>
                <ul className="detail-proximities">
                  {proximities.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {hasEnergy || hasGes ? (
              <section className="detail-card">
                <h2>Efficacité énergétique</h2>
                <div className="detail-energy">
                  {hasEnergy ? (
                    <EnergyRatingScale rating={property.energy!} variant="energy" unit="kWh/m².an" />
                  ) : null}
                  {hasGes ? (
                    <EnergyRatingScale rating={property.ges!} variant="ges" unit="kg CO₂/m².an" />
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="detail-card">
              <h2>Localisation</h2>
              {mapUrl ? (
                <iframe title="Localisation du bien" src={mapUrl} loading="lazy" className="detail-map" />
              ) : (
                <p>Aucune localisation disponible pour ce bien.</p>
              )}
            </section>
          </div>

          <aside className="detail-side">
            <section className="detail-card detail-price">
              <span className="detail-badge">{property.badge ?? ''}</span>
              <p className="detail-price__value">{new Intl.NumberFormat('fr-FR').format(property.price)} €</p>
              <h1>{property.title}</h1>
              <p>
                {property.type} · {property.city}
              </p>

              <div className="detail-stats">
                <div>
                  <span>Surface</span>
                  <strong>{property.surface} m²</strong>
                </div>
                <div>
                  <span>Pieces</span>
                  <strong>{property.rooms}</strong>
                </div>
                <div>
                  <span>Chambres</span>
                  <strong>{property.bedrooms}</strong>
                </div>
              </div>
            </section>

            <section className="detail-card">
              <h2>Interesse par ce bien ?</h2>

              <div className="detail-contact-agent">
                <img src={agentPicture} alt={`Portrait de ${agentName}`} loading="lazy" />
                <p>
                  <strong>{agentName}</strong>
                  {agent?.phone ? <a href={`tel:${agent.phone}`}>{agent.phone}</a> : null}
                  {agent?.email ? <a href={`mailto:${agent.email}`}>{agent.email}</a> : null}
                </p>
              </div>

              {submitSuccess ? (
                <p className="detail-contact__success" role="status">
                  Merci ! Un conseiller Hamac vous contactera très prochainement.
                </p>
              ) : (
                <form className="detail-contact" onSubmit={submit}>
                  <label className="detail-contact-field">
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        clearFieldError('name')
                        setSubmitError(null)
                      }}
                      placeholder="Nom"
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? 'detail-contact-name-error' : undefined}
                    />
                    {fieldErrors.name ? (
                      <span id="detail-contact-name-error" className="detail-contact-field__error" role="alert">
                        {fieldErrors.name}
                      </span>
                    ) : null}
                  </label>
                  <label className="detail-contact-field">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        clearFieldError('email')
                        setSubmitError(null)
                      }}
                      placeholder="Email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'detail-contact-email-error' : undefined}
                    />
                    {fieldErrors.email ? (
                      <span id="detail-contact-email-error" className="detail-contact-field__error" role="alert">
                        {fieldErrors.email}
                      </span>
                    ) : null}
                  </label>
                  <label className="detail-contact-field">
                    <input
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        clearFieldError('phone')
                        setSubmitError(null)
                      }}
                      placeholder="Telephone"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? 'detail-contact-phone-error' : undefined}
                    />
                    {fieldErrors.phone ? (
                      <span id="detail-contact-phone-error" className="detail-contact-field__error" role="alert">
                        {fieldErrors.phone}
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value)
                      setSubmitError(null)
                    }}
                    rows={5}
                    placeholder="Votre message"
                  />
                  {submitError ? (
                    <p className="detail-contact__error" role="alert">
                      {submitError}
                    </p>
                  ) : null}
                  <button className="search-card__submit" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
                  </button>
                </form>
              )}
            </section>
          </aside>
        </div>

        <section className="detail-similar">
          <header className="section-header">
            <h2 className="section-title">Biens similaires</h2>
          </header>
          <div className="catalog-grid">{similar.map((entry) => <PropertyCard key={entry.slug} property={entry} light />)}</div>
        </section>
      </div>

      {isLightboxOpen ? (
        <div
          className="detail-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie photo de ${property.title}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsLightboxOpen(false)
            }
          }}
        >
          <button type="button" className="detail-lightbox__close" onClick={() => setIsLightboxOpen(false)} aria-label="Fermer la galerie">
            ×
          </button>

          <button type="button" className="detail-lightbox__nav detail-lightbox__nav--prev" onClick={goToPreviousImage} aria-label="Image précédente">
            ←
          </button>

          <figure className="detail-lightbox__figure">
            <img src={mainImage} alt={`${property.title} - photo ${activeImage + 1}`} />
          </figure>

          <button type="button" className="detail-lightbox__nav detail-lightbox__nav--next" onClick={goToNextImage} aria-label="Image suivante">
            →
          </button>
        </div>
      ) : null}
    </main>
  )
}

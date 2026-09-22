import { Building2, Bus, Leaf, ShoppingBag } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PropertyCard } from '../components/PropertyCard'
import { getNeighborhoodBySlug, NEIGHBORHOODS } from '../data/neighborhoods'
import { useProperties } from '../hooks/useProperties'
import { realEstateAgentJsonLd } from '../seo/jsonld'
import { usePageMeta } from '../utils/seo'

export function NeighborhoodPage() {
  const { slug = '' } = useParams()
  const neighborhood = getNeighborhoodBySlug(slug)

  if (!neighborhood) return <Navigate to="/acheter" replace />

  usePageMeta({
    title: `Immobilier à ${neighborhood.name} — Hamac Investissements & Patrimoine`,
    description: `${neighborhood.tagline}. Prix moyen : ${neighborhood.pricePerSqm}. Découvrez nos biens disponibles à ${neighborhood.name} dans l'Ouest Lyonnais.`,
    ogImage: neighborhood.heroImage,
    jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd(neighborhood.name) }],
  })

  const properties = useProperties({ city: neighborhood.name }, 'recent')
  const neighbors = NEIGHBORHOODS.filter((entry) => entry.slug !== neighborhood.slug).slice(0, 3)

  return (
    <main className="neighborhood-page">
      <section className="neighborhood-hero">
        <img src={neighborhood.heroImage} alt={`Vue de ${neighborhood.name} dans l'Ouest lyonnais`} className="neighborhood-hero__image" loading="eager" />
        <div className="neighborhood-hero__overlay" />
        <div className="container neighborhood-hero__content">
          <h1>{neighborhood.name}</h1>
          <p>{neighborhood.tagline}</p>
          <span className="neighborhood-hero__price">{neighborhood.pricePerSqm}</span>
        </div>
        <div className="wave wave--hero-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" focusable="false">
            <path className="wave__path" d="M0,58 C230,44 470,70 760,50 C1010,34 1240,62 1440,46 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      <section className="section section--cream neighborhood-intro">
        <div className="container neighborhood-intro__grid">
          <div className="neighborhood-intro__copy">
            {neighborhood.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <aside className="neighborhood-stats">
            <h2>Chiffres clés</h2>
            <ul>
              <li><span>Prix moyen</span><strong>{neighborhood.pricePerSqm}</strong></li>
              <li><span>Évolution</span><strong>{neighborhood.priceEvolution}</strong></li>
              <li><span>Population</span><strong>{neighborhood.population}</strong></li>
              <li><span>Écoles</span><strong>{neighborhood.schools.length}</strong></li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="wave wave--cream-to-navy" aria-hidden="true">
        <svg viewBox="0 0 1440 72" preserveAspectRatio="none" focusable="false">
          <path className="wave__path wave__path--soft" d="M0,54 C220,42 500,62 760,46 C1020,30 1260,56 1440,40 L1440,72 L0,72 Z" />
        </svg>
      </div>

      <section className="section section--navy neighborhood-living">
        <div className="container">
          <header className="section-header section-header--on-dark">
            <h2 className="section-title">Vivre à {neighborhood.name}</h2>
          </header>
          <div className="neighborhood-living__grid">
            <article className="neighborhood-info-card">
              <Building2 size={18} />
              <h3>Écoles</h3>
              <ul>{neighborhood.schools.map((school) => <li key={school}>{school}</li>)}</ul>
            </article>
            <article className="neighborhood-info-card">
              <Bus size={18} />
              <h3>Transports</h3>
              <ul>{neighborhood.transport.map((line) => <li key={line}>{line}</li>)}</ul>
            </article>
            <article className="neighborhood-info-card">
              <ShoppingBag size={18} />
              <h3>Commerces & marchés</h3>
              <p>{neighborhood.shops}</p>
            </article>
            <article className="neighborhood-info-card">
              <Leaf size={18} />
              <h3>Espaces verts</h3>
              <p>{neighborhood.parks}</p>
            </article>
          </div>
        </div>
      </section>

      <div className="wave wave--navy-to-cream-footer" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false">
          <path className="wave__path wave__path--to-cream" d="M0,56 C260,44 520,64 840,48 C1090,36 1290,58 1440,46 L1440,80 L0,80 Z" />
        </svg>
      </div>

      <section className="section section--cream neighborhood-properties">
        <div className="container">
          <header className="section-header">
            <h2 className="section-title">Biens disponibles à {neighborhood.name}</h2>
          </header>
          {properties.length ? (
            <div className="neighborhood-properties__grid">
              {properties.map((property) => <PropertyCard key={property.slug} property={property} light />)}
            </div>
          ) : (
            <div className="neighborhood-empty">
              <p>Aucun bien disponible actuellement à {neighborhood.name} — inscrivez-vous pour être alerté.</p>
              <form onSubmit={(event) => event.preventDefault()}>
                <input type="email" placeholder="Votre email" />
                <button className="btn btn--navy" type="submit">Être alerté</button>
              </form>
            </div>
          )}
        </div>
      </section>

      <section className="section section--cream neighborhood-agent">
        <div className="container">
          <article className="neighborhood-agent__card">
            <img src={neighborhood.referentAgent.photo} alt={`Portrait de ${neighborhood.referentAgent.name}`} loading="lazy" />
            <div>
              <p className="eyebrow">Votre expert à {neighborhood.name}</p>
              <h3>{neighborhood.referentAgent.name}</h3>
              <p>{neighborhood.referentAgent.role}</p>
              <p className="neighborhood-agent__actions">
                <Link to={`/contact?town=${encodeURIComponent(neighborhood.name)}`} className="btn btn--gold">Contacter l&apos;agent</Link>
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="section section--cream neighborhood-neighbors">
        <div className="container">
          <header className="section-header">
            <h2 className="section-title">Explorer les communes voisines</h2>
          </header>
          <div className="neighborhood-neighbors__grid">
            {neighbors.map((entry) => (
              <Link key={entry.slug} to={`/quartiers/${entry.slug}`} className="neighborhood-neighbor-card">
                <img src={entry.heroImage} alt={`Ambiance du quartier ${entry.name}`} loading="lazy" />
                <span className="neighborhood-neighbor-card__overlay" />
                <div className="neighborhood-neighbor-card__content">
                  <h3>{entry.name}</h3>
                  <p>{entry.tagline}</p>
                  <strong>{entry.pricePerSqm}</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

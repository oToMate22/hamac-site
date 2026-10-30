import { Link } from 'react-router-dom'
import { NEIGHBORHOODS } from '../data/neighborhoods'
import { usePageMeta } from '../utils/seo'

export function QuartiersPage() {
  usePageMeta({
    title: 'Communes de l’Ouest Lyonnais — Hamac Investissements & Patrimoine',
    description:
      'Découvrez nos communes, leurs atouts et les biens disponibles dans chaque secteur de l’Ouest lyonnais.',
  })
  const featured = NEIGHBORHOODS.find((entry) => entry.slug === 'sainte-foy-les-lyon')
  const tassin = NEIGHBORHOODS.find((entry) => entry.slug === 'tassin-la-demi-lune')
  const ecully = NEIGHBORHOODS.find((entry) => entry.slug === 'ecully')
  const francheville = NEIGHBORHOODS.find((entry) => entry.slug === 'francheville')
  const craponne = NEIGHBORHOODS.find((entry) => entry.slug === 'craponne')
  const oullins = NEIGHBORHOODS.find((entry) => entry.slug === 'oullins')
  const mosaic = [featured, tassin, ecully, francheville, craponne, oullins].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  return (
    <main className="section section--cream quartiers-hub">
      <section className="container quartiers-hub__hero">
        <header className="section-header">
          <h1 className="section-title">L&apos;Ouest Lyonnais, quartier par quartier</h1>
          <p className="section-intro">Notre sélection de biens</p>
        </header>
      </section>

      <section className="container quartiers-hub__mosaic">
        <div className="bento quartiers-hub__bento">
          {mosaic.map((entry, idx) => (
            <Link
              key={entry.slug}
              className={`bento-card ${idx === 0 ? 'bento-card--featured' : ''} ${idx === 5 ? 'bento-card--wide' : ''}`}
              to={`/quartiers/${entry.slug}`}
            >
              <img src={entry.heroImage} alt={entry.heroAlt} loading="lazy" />
              <div className="bento-card__overlay"></div>
              <div className="bento-card__content">
                <h3>{entry.name}</h3>
                <p>{entry.tagline}</p>
                <p className="bento-card__meta">{entry.pricePerSqm}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="wave wave--cream-to-navy" aria-hidden="true">
        <svg viewBox="0 0 1440 72" preserveAspectRatio="none" focusable="false">
          <path
            className="wave__path wave__path--soft"
            d="M0,54 C220,42 500,62 760,46 C1020,30 1260,56 1440,40 L1440,72 L0,72 Z"
          />
        </svg>
      </div>

      <section
        className="section section--navy quartiers-hub__cta home-contact-cta"
        aria-labelledby="quartiers-hub-cta-title"
      >
        <div className="container home-contact-cta__inner section-header section-header--on-dark">
          <h2 id="quartiers-hub-cta-title" className="home-contact-cta__title section-title">
            Vous ne savez pas encore où chercher ?
          </h2>
          <p className="home-contact-cta__text section-intro">
            Parlez-nous de votre projet : nous vous orientons vers la commune et le quartier les plus adaptés à vos
            critères.
          </p>
          <p className="home-contact-cta__actions">
            <Link className="btn btn--gold home-contact-cta__button" to="/contact">
              Parlez-nous de votre projet
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

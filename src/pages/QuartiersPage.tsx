import { Link } from 'react-router-dom'
import { NEIGHBORHOODS } from '../data/neighborhoods'

export function QuartiersPage() {
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
          <p className="section-intro">
            Découvrez nos communes, leurs atouts et les biens disponibles dans chaque secteur.
          </p>
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
              <img src={entry.heroImage} alt={entry.name} loading="lazy" />
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

      <section className="section section--navy quartiers-hub__cta">
        <div className="container section-header section-header--on-dark">
          <h2 className="section-title">Vous ne savez pas encore où chercher ?</h2>
          <p className="biens-cta-wrap">
            <Link className="btn btn--gold" to="/contact">Parlez-nous de votre projet</Link>
          </p>
        </div>
      </section>
    </main>
  )
}

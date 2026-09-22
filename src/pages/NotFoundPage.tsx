import { Link } from 'react-router-dom'
import { usePageMeta } from '../utils/seo'

export function NotFoundPage() {
  usePageMeta({
    title: 'Page introuvable — Hamac Investissements & Patrimoine',
    description: 'Cette page n’existe pas. Revenez au catalogue des biens Hamac dans l’Ouest lyonnais.',
    robots: 'noindex,follow',
  })

  return (
    <main className="section section--cream">
      <div className="container" style={{ paddingBlock: '4rem', maxWidth: '40rem' }}>
        <p className="eyebrow">404</p>
        <h1 className="section-title">Page introuvable</h1>
        <p className="section-intro">
          L’adresse demandée n’existe pas ou n’est plus disponible. Explorez nos biens à vendre ou contactez l’agence.
        </p>
        <p>
          <Link className="btn btn--gold" to="/acheter">
            Voir les biens à vendre
          </Link>
        </p>
      </div>
    </main>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../utils/seo'

type LegalDocumentProps = {
  title: string
  metaDescription: string
  heading: string
  intro?: string
  lastUpdated?: string
  children: ReactNode
}

export function LegalDocument({ title, metaDescription, heading, intro, lastUpdated, children }: LegalDocumentProps) {
  usePageMeta({ title, description: metaDescription, robots: 'noindex,follow' })

  return (
    <main className="legal-page section section--cream">
      <div className="container legal-page__inner">
        <nav className="legal-page__breadcrumb" aria-label="Fil d'Ariane">
          <Link to="/">Accueil</Link>
          <span aria-hidden="true">/</span>
          <span>{heading}</span>
        </nav>

        <header className="legal-page__header">
          <p className="eyebrow">INFORMATIONS LÉGALES</p>
          <h1 className="section-title">{heading}</h1>
          {intro ? <p className="legal-page__intro">{intro}</p> : null}
          {lastUpdated ? <p className="legal-page__updated">Dernière mise à jour : {lastUpdated}</p> : null}
        </header>

        <article className="legal-document">{children}</article>

        <footer className="legal-page__footer">
          <p>Autres documents :</p>
          <ul>
            <li>
              <Link to="/mentions-legales">Mentions légales</Link>
            </li>
            <li>
              <Link to="/honoraires">Honoraires</Link>
            </li>
            <li>
              <Link to="/confidentialite">Politique de confidentialité</Link>
            </li>
          </ul>
          <p>
            <Link to="/contact">Nous contacter</Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return <p className="legal-placeholder">{children}</p>
}

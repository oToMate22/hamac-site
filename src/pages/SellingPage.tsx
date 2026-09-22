import { Link } from 'react-router-dom'
import { usePageMeta } from '../utils/seo'

const SELL_STEPS = [
  {
    title: 'Estimation precise',
    description: 'Nous analysons votre bien, le marche local et les transactions recentes pour fixer le juste prix.',
  },
  {
    title: 'Mise en valeur',
    description: "Photos professionnelles, visite virtuelle, redaction soignee de l'annonce.",
  },
  {
    title: 'Diffusion ciblee',
    description: 'Visibilite sur les portails immobiliers, notre site, nos reseaux sociaux et notre reseau off-market.',
  },
  {
    title: 'Selection des acquereurs',
    description: 'Nous qualifions chaque candidat : budget valide, projet serieux, visite organisee.',
  },
  {
    title: 'Negociation',
    description: 'Nous defendons vos interets avec diplomatie pour obtenir le meilleur prix.',
  },
  {
    title: "Accompagnement jusqu'a la signature",
    description: 'Suivi administratif, coordination avec le notaire, serenite totale.',
  },
]

export function SellingPage() {
  usePageMeta({
    title: 'Vendre avec Hamac — Hamac Investissements & Patrimoine',
    description: 'De l’estimation à la signature, Hamac vous accompagne pour vendre votre bien dans l’Ouest lyonnais.',
  })

  return (
    <main className="selling-page">
      <section className="selling-hero">
        <img
          src="/fr/images/Biens/maison-homepage.webp"
          alt="Maison familiale de standing dans l'Ouest lyonnais"
          className="selling-hero__image"
          loading="eager"
        />
        <div className="selling-hero__overlay" />
        <div className="container selling-hero__content">
          <p className="eyebrow">VENDRE AVEC HAMAC</p>
          <h1 className="selling-hero__title">Votre bien merite une mise en valeur a la hauteur de son caractere</h1>
          <p className="selling-hero__lead">
            De l&apos;estimation a la signature, nous vous accompagnons avec precision et transparence.
          </p>
        </div>
        <div className="wave wave--hero-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" focusable="false">
            <path className="wave__path" d="M0,58 C230,44 470,70 760,50 C1010,34 1240,62 1440,46 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      <section className="section section--cream selling-steps">
        <div className="container">
          <header className="section-header">
            <h2 className="section-title">Les etapes d&apos;une vente reussie</h2>
          </header>
          <div className="selling-steps__grid">
            {SELL_STEPS.map((step, index) => (
              <article key={step.title} className="selling-step-card">
                <span className="selling-step-card__number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="wave wave--cream-to-navy" aria-hidden="true">
        <svg viewBox="0 0 1440 72" preserveAspectRatio="none" focusable="false">
          <path className="wave__path wave__path--soft" d="M0,54 C220,42 500,62 760,46 C1020,30 1260,56 1440,40 L1440,72 L0,72 Z" />
        </svg>
      </div>

      <section className="section section--navy selling-advantages">
        <div className="container">
          <header className="section-header section-header--on-dark">
            <h2 className="section-title">Pourquoi vendre avec Hamac</h2>
          </header>
          <div className="selling-advantages__grid">
            <article className="selling-adv-card">
              <h3>Connaissance hyper-locale</h3>
              <p>Nous connaissons chaque rue, chaque ecole, chaque prix de l&apos;Ouest Lyonnais.</p>
            </article>
            <article className="selling-adv-card">
              <h3>Reseau off-market</h3>
              <p>Acces a des acheteurs qualifies avant meme la mise en ligne de votre bien.</p>
            </article>
            <article className="selling-adv-card">
              <h3>Transparence totale</h3>
              <p>Des rapports de visite detailles, un suivi regulier et des conseils honnetes.</p>
            </article>
          </div>
        </div>
      </section>

      <div className="wave wave--navy-to-cream-footer" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false">
          <path className="wave__path wave__path--to-cream" d="M0,56 C260,44 520,64 840,48 C1090,36 1290,58 1440,46 L1440,80 L0,80 Z" />
        </svg>
      </div>

      <section className="section section--cream selling-actions">
        <div className="container selling-actions__grid">
          <Link to="/estimation" className="selling-action-card">
            <img src="/fr/images/Biens/maison-moderne.webp" alt="Interieur contemporain pour estimer un bien" loading="lazy" />
            <span className="selling-action-card__overlay" />
            <strong>Estimer mon bien</strong>
          </Link>
          <Link to="/contact" className="selling-action-card">
            <img src="/fr/images/Biens/maison-piscine-1.webp" alt="Maison avec jardin pour prise de rendez-vous immobilier" loading="lazy" />
            <span className="selling-action-card__overlay" />
            <strong>Prendre rendez-vous</strong>
          </Link>
        </div>
      </section>

      <section className="section section--cream selling-testimonial">
        <div className="container">
          <blockquote className="selling-quote">
            <p>
              « Une vente menee avec calme, clarte et beaucoup de precision. Nous nous sommes sentis accompagnes du debut
              a la signature. »
            </p>
            <footer>— Claire &amp; Julien M., Vente maison a Sainte-Foy-les-Lyon.</footer>
          </blockquote>
        </div>
      </section>

      <section className="section section--navy agency-cta">
        <div className="container section-header section-header--on-dark">
          <p className="eyebrow eyebrow--muted">Parlons de votre projet</p>
          <h2 className="section-title">Un accompagnement sur-mesure, de la premiere visite a la signature</h2>
          <p className="section-intro">Contactez notre equipe pour une estimation, une vente ou un achat dans l&apos;Ouest Lyonnais.</p>
          <p className="biens-cta-wrap"><Link className="btn btn--outline-light" to="/contact">Nous contacter</Link></p>
        </div>
      </section>
    </main>
  )
}

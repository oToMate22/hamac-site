import { Link } from 'react-router-dom'
import { usePageMeta } from '../utils/seo'

export function AgencyPage() {
  usePageMeta({
    title: "L'agence Hamac — Hamac Investissements & Patrimoine",
    description: "Découvrez l'histoire, l'équipe et la vision de Hamac, agence immobilière spécialisée dans l’Ouest lyonnais.",
  })

  const team = [
    ['Sebastien Garnier', 'Gerant', '/images/team/sebastien.jpg'],
    ['Romain Monneri-Fons', 'Agent commercial independant', '/images/team/romain.jpg'],
    ['Victor Bonazza', 'Agent commercial independant', '/images/team/victor.jpg'],
    ['Elodie Renard', 'Agent commercial independant', '/images/team/elodie.jpg'],
    ['Raphael Lasbatx', 'Agent commercial independant', '/images/team/raphael.jpg'],
    ['Samuel Ribes', 'Agent commercial independant', '/images/team/samuel.jpg'],
    ['Ana Sanabria', 'Agent commercial independant', '/images/team/ana-sanabria.jpg'],
    ['Anthony Ribeiro', 'Agent commercial independant', '/images/team/anthony.jpg'],
    ['Pauline Rodriguez', 'Agent commercial independant', '/images/team/pauline.jpg'],
    ['Axel Bernard', 'Agent commercial independant', '/images/team/AXELBERNARD.png'],
  ] as const
  return (
    <main className="agency-page">
      <section className="agency-hero">
        <img
          src="/images/Biens/pont-photo-page-agence.png"
          alt="Vue du pont de Sainte-Foy-les-Lyon, territoire de l'agence Hamac"
          loading="eager"
        />
        <div className="agency-hero__overlay" />
        <div className="container agency-hero__content">
          <p className="eyebrow">L&apos;AGENCE</p>
          <h1 className="agency-hero__title">Une agence ancree dans son territoire, attentive a chaque projet</h1>
          <p className="agency-hero__lead">Depuis Sainte-Foy-les-Lyon, nous accompagnons chaque client avec exigence, transparence et sensibilite locale.</p>
        </div>
      </section>
      <section className="section section--cream agency-story">
        <div className="container agency-story__grid">
          <div>
            <h2 className="section-title">L&apos;histoire de Hamac et la vision de Sebastien</h2>
            <p className="prose">Nee a Sainte-Foy-les-Lyon, Hamac s&apos;est construite autour d&apos;une conviction simple: chaque projet merite une strategie sur-mesure et un accompagnement humain.</p>
            <p className="prose">Notre expertise de l&apos;Ouest Lyonnais permet d&apos;identifier les bonnes adresses, d&apos;anticiper les attentes des acquereurs et d&apos;orchestrer des ventes sereines.</p>
          </div>
          <div className="agency-values">
            {[
              ['Proximite', 'Une presence locale forte et disponible.'],
              ['Expertise locale', 'Une lecture fine des micro-marches.'],
              ['Transparence', 'Des conseils clairs a chaque etape.'],
            ].map(([title, copy]) => (
              <article key={title} className="agency-value-card"><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
        </div>
      </section>
      <section className="section agency-stats">
        <div className="container agency-stats__grid">
          <article className="agency-stat"><p>15+</p><span>annees d&apos;experience cumulee</span></article>
          <article className="agency-stat"><p>240+</p><span>biens accompagnes</span></article>
          <article className="agency-stat"><p>96%</p><span>satisfaction client</span></article>
        </div>
      </section>
      <section className="section section--cream agency-team">
        <div className="container">
          <header className="section-header"><h2 className="section-title">Une equipe qui connait chaque rue</h2></header>
          <div className="agency-team__grid">
            {team.map(([name, role, photo]) => (
              <article key={name} className="agency-agent">
                <img
                  className={name === 'Samuel Ribes' ? 'team-photo--samuel' : undefined}
                  src={photo}
                  alt={`Portrait de ${name}, ${role}`}
                  loading="lazy"
                />
                <h3>{name}</h3><p className="agency-agent__role">{role}</p><p className="agency-agent__tagline">Accompagnement humain et precision locale.</p>
              </article>
            ))}
          </div>
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

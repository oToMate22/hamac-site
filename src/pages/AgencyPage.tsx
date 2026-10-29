import { Link } from 'react-router-dom'
import { realEstateAgentJsonLd } from '../seo/jsonld'
import { usePageMeta } from '../utils/seo'

export function AgencyPage() {
  usePageMeta({
    title: "L'agence Hamac — Hamac Investissements & Patrimoine",
    description: "Découvrez l'histoire, l'équipe et la vision de Hamac, agence immobilière spécialisée dans l’Ouest lyonnais.",
    jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd() }],
  })

  const team = [
    ['Romain Monneri-Fons', 'Directeur associé', '/fr/images/team/romain.webp?v=2', 'Une expertise solide, des conseils précis et surtout une vraie proximité : chaque projet mérite une attention particulière et un accompagnement à la hauteur.'],
    ['Victor Bonazza', 'Gérant associé', '/fr/images/team/victor.webp?v=4', "Expert de terrain, il sécurise vos étapes d'achat et de vente avec rigueur."],
    ['Sarah Bodhuin', 'Agent commercial', '/fr/images/team/sarah-bodhuin.webp', 'Elle accompagne chaque projet avec écoute, exigence et une vraie présence sur le terrain.'],
    ['Raphaël Lasbatx', 'Négociateur immobilier', '/fr/images/team/raphael.webp', 'Réactif et attentif, il vous guide sur chaque phase de la transaction.'],
    ['Samuel Ribes', 'Négociateur immobilier', '/fr/images/team/samuel.webp', "Au-delà d'un projet immobilier, je place l'humain au cœur de chaque rencontre, avec écoute, confiance et engagement."],
    ['Ana Sanabria', 'Agent commercial', '/fr/images/team/ana-sanabria.webp?v=2', "Elle accompagne vos recherches avec exigence et une vraie qualité d'écoute."],
    ['Anthony Ribeiro', 'Négociateur immobilier', '/fr/images/team/anthony.webp?v=2', 'Il structure chaque dossier pour offrir un suivi fluide et transparent.'],
    ['Pauline Rodriguez', 'Agent commercial', '/fr/images/team/pauline.webp?v=2', "Minutieuse et attentive, elle accorde une importance particulière au suivi de chaque dossier et à la qualité de la relation humaine, afin d'accompagner chaque client avec confiance et sérénité."],
    ['Axel Bernard', 'Conseiller location', '/fr/images/team/AXELBERNARD.webp', "Disponible, réactif et toujours à l'écoute, il met son énergie au service de vos projets."],
    ['Élodie Renard', 'Agent commercial', '/fr/images/team/elodie-renard.webp?v=2', 'Elle accompagne les familles dans leurs projets de vie avec une approche humaine et précise.'],
  ] as const
  return (
    <main className="agency-page">
      <section className="agency-hero">
        <img
          src="/fr/images/Biens/pont-photo-page-agence.webp"
          alt="Vue du pont de Sainte-Foy-lès-Lyon, territoire de l'agence Hamac"
          loading="eager"
        />
        <div className="agency-hero__overlay" />
        <div className="container agency-hero__content">
          <p className="eyebrow">L&apos;AGENCE</p>
          <h1 className="agency-hero__title">Une agence ancrée dans son territoire, attentive à chaque projet</h1>
          <p className="agency-hero__lead">Depuis Sainte-Foy-lès-Lyon, nous accompagnons chaque client avec exigence, transparence et sensibilité locale.</p>
        </div>
      </section>
      <section className="section section--cream agency-story">
        <div className="container agency-story__grid">
          <div>
            <h2 className="section-title">L&apos;histoire et la vision de Hamac</h2>
            <p className="prose">Née à Sainte-Foy-lès-Lyon, Hamac s&apos;est construite autour d&apos;une conviction simple : chaque projet mérite une stratégie sur-mesure et un accompagnement humain.</p>
            <p className="prose">Notre expertise de l&apos;Ouest Lyonnais permet d&apos;identifier les bonnes adresses, d&apos;anticiper les attentes des acquéreurs et d&apos;orchestrer des ventes sereines.</p>
          </div>
          <div className="agency-values">
            {[
              ['Proximité', 'Une présence locale forte et disponible.'],
              ['Expertise locale', 'Une lecture fine des micro-marchés.'],
              ['Transparence', 'Des conseils clairs à chaque étape.'],
            ].map(([title, copy]) => (
              <article key={title} className="agency-value-card"><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
        </div>
      </section>
      <section className="section agency-stats">
        <div className="container agency-stats__grid">
          <article className="agency-stat"><p>15+</p><span>années d&apos;expérience cumulée</span></article>
          <article className="agency-stat"><p>240+</p><span>biens accompagnés</span></article>
          <article className="agency-stat"><p>96%</p><span>satisfaction client</span></article>
        </div>
      </section>
      <section className="section section--cream agency-team">
        <div className="container">
          <header className="section-header"><h2 className="section-title">Une synergie au service de vos projets</h2></header>
          <div className="agency-team__grid">
            {team.map(([name, role, photo, tagline]) => (
              <article key={name} className="agency-agent">
                <img
                  className={name === 'Samuel Ribes' ? 'team-photo--samuel' : undefined}
                  src={photo}
                  alt={`Portrait de ${name}, ${role}`}
                  loading="lazy"
                />
                <h3>{name}</h3>
                <p className="agency-agent__role">{role}</p>
                <p className="agency-agent__tagline">{tagline}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--navy agency-cta">
        <div className="container section-header section-header--on-dark">
          <p className="eyebrow eyebrow--muted">Parlons de votre projet</p>
          <h2 className="section-title">Un accompagnement sur-mesure, de la première visite à la signature</h2>
          <p className="section-intro">Contactez notre équipe pour une estimation, une vente ou un achat dans l&apos;Ouest Lyonnais.</p>
          <p className="biens-cta-wrap"><Link className="btn btn--outline-light" to="/contact">Nous contacter</Link></p>
        </div>
      </section>
    </main>
  )
}

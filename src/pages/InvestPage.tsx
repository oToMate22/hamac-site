import { Link } from 'react-router-dom'
import { usePageMeta } from '../utils/seo'

const INVESTMENT_PILLARS = [
  {
    title: 'Sélection locale',
    description:
      "Nous ciblons les adresses et typologies cohérentes avec votre stratégie patrimoniale dans l'Ouest lyonnais.",
  },
  {
    title: 'Lecture du marché',
    description:
      'Prix, demande locative, travaux, revente : chaque opportunité est étudiée avec une approche concrète du terrain.',
  },
  {
    title: 'Accompagnement complet',
    description:
      "De la recherche à la signature, Hamac coordonne les étapes clés pour avancer avec clarté et sérénité.",
  },
]

export function InvestPage() {
  usePageMeta({
    title: 'Investir dans l’immobilier — Hamac Investissements & Patrimoine',
    description:
      "Hamac accompagne vos projets d'investissement immobilier dans l'Ouest lyonnais avec une sélection locale et une lecture patrimoniale.",
  })

  return (
    <main className="invest-page">
      <section className="invest-hero">
        <img
          src="/images/Biens/maison-moderne.jpg"
          alt="Maison contemporaine dans l'Ouest lyonnais"
          className="invest-hero__image"
          loading="eager"
        />
        <div className="invest-hero__overlay" />
        <div className="container invest-hero__content">
          <p className="eyebrow">INVESTIR AVEC HAMAC</p>
          <h1 className="invest-hero__title">Construire un projet immobilier rentable, lisible et durable</h1>
          <p className="invest-hero__lead">
            Nous vous aidons à identifier les biens adaptés à vos objectifs patrimoniaux : résidence locative,
            diversification, pied-à-terre ou projet de long terme.
          </p>
          <div className="invest-hero__actions">
            <Link className="btn btn--gold" to="/contact">
              Parler de mon projet
            </Link>
            <Link className="btn btn--outline-light" to="/acheter">
              Voir les biens
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--cream invest-intro">
        <div className="container invest-intro__grid">
          <div>
            <p className="eyebrow">APPROCHE PATRIMONIALE</p>
            <h2 className="section-title">Un investissement se choisit autant pour son adresse que pour son usage</h2>
          </div>
          <div className="invest-intro__copy">
            <p>
              Hamac croise expertise immobilière, connaissance fine des communes et compréhension de vos priorités :
              rendement, valorisation, transmission, qualité de vie ou équilibre entre plusieurs objectifs.
            </p>
            <p>
              Notre rôle : vous aider à arbitrer avec des informations claires, des biens cohérents et un accompagnement
              humain jusqu'à la décision.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--cream invest-pillars">
        <div className="container invest-pillars__grid">
          {INVESTMENT_PILLARS.map((pillar, index) => (
            <article className="invest-pillar-card" key={pillar.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--navy agency-cta">
        <div className="container section-header section-header--on-dark">
          <p className="eyebrow eyebrow--muted">Première étape</p>
          <h2 className="section-title">Parlons de vos critères et de votre horizon d'investissement</h2>
          <p className="section-intro">
            Un échange suffit pour préciser votre cible, votre budget et les communes à privilégier.
          </p>
          <p className="biens-cta-wrap">
            <Link className="btn btn--outline-light" to="/contact">
              Contacter Hamac
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

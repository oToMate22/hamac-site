export type BlogCategory = 'Marché immobilier' | 'Guides pratiques' | 'Vie locale' | 'Conseils patrimoine'

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  coverImage: string
  category: BlogCategory
  author: string
  publishedDate: string
  readTime: string
  content: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'prix-immobilier-ouest-lyonnais-2026',
    title: "Prix immobilier dans l'Ouest Lyonnais en 2026 : bilan et perspectives",
    excerpt: "Après deux années de normalisation, les prix se stabilisent dans la plupart des communes de l'Ouest lyonnais. Voici les signaux à surveiller pour acheter ou vendre au bon moment.",
    coverImage: '/fr/images/Biens/maison-homepage.webp',
    category: 'Marché immobilier',
    author: "L'équipe Hamac",
    publishedDate: '2026-02-11',
    readTime: '5 min',
    content: [
      "En 2026, le marché immobilier de l'Ouest lyonnais montre un visage plus lisible. Les délais de vente se sont allongés par rapport à la période très tendue de 2021-2022, mais les biens bien positionnés continuent de se vendre dans des conditions satisfaisantes.",
      "Sainte-Foy-lès-Lyon et Écully restent des secteurs premium, soutenus par une demande familiale régulière et un cadre de vie recherché. Tassin et Francheville, de leur côté, attirent davantage de profils actifs en quête d'équilibre entre accessibilité et qualité résidentielle.",
      "Pour les vendeurs, la clé est désormais la justesse du prix dès la mise en ligne. Pour les acquéreurs, 2026 offre un meilleur pouvoir de négociation, à condition d'avoir un dossier solide et une stratégie claire.",
      "Dans ce contexte, une lecture fine des micro-secteurs fait la différence : d'une rue à l'autre, les écarts de valorisation restent significatifs."
    ],
  },
  {
    slug: 'acheter-premiere-maison-guide',
    title: 'Acheter sa première maison : le guide complet pour les primo-accédants',
    excerpt: "De la capacité d'emprunt à la signature chez le notaire, ce guide pratique vous aide à structurer votre premier achat sans stress ni mauvaise surprise.",
    coverImage: '/fr/images/Biens/maison-moderne.webp',
    category: 'Guides pratiques',
    author: 'Romain Monneri-Fons',
    publishedDate: '2026-01-22',
    readTime: '7 min',
    content: [
      "Le premier achat immobilier est souvent un mélange d'enthousiasme et d'incertitude. Avant de lancer les visites, il est indispensable de cadrer votre budget global : apport, mensualité cible, frais de notaire et travaux éventuels.",
      "Ensuite, définissez une grille de priorités simple : localisation, surface, nombre de chambres, extérieur, potentiel d'évolution. Cette méthode évite les décisions impulsives et permet de comparer les biens de manière objective.",
      "Au moment de l'offre, la préparation du dossier fait toute la différence. Un financement clair, validé en amont, vous place dans une position plus forte face au vendeur.",
      "Enfin, entourez-vous d'interlocuteurs fiables pour sécuriser chaque étape : négociation, compromis, clauses suspensives et coordination notariale."
    ],
  },
  {
    slug: 'vivre-sainte-foy-les-lyon',
    title: 'Vivre à Sainte-Foy-lès-Lyon : le quartier à la loupe',
    excerpt: "Entre village et ville, Sainte-Foy offre un cadre de vie recherché par les familles. Écoles, commerces, ambiance locale : on vous explique pourquoi la commune séduit autant.",
    coverImage: '/fr/images/Biens/maison-jardin.webp',
    category: 'Vie locale',
    author: 'Élodie Renard',
    publishedDate: '2026-03-03',
    readTime: '6 min',
    content: [
      "Sainte-Foy-lès-Lyon plaît d'abord pour son atmosphère : un esprit de bourg, des adresses de proximité et une vraie vie de quartier. On y trouve un rythme plus apaisé qu'en centre-ville, sans être isolé de Lyon.",
      "Les familles apprécient particulièrement la qualité des établissements scolaires, les équipements sportifs et les espaces verts accessibles au quotidien. Le secteur combine praticité et qualité de vie.",
      "Sur le plan immobilier, la commune propose des profils variés : appartements de standing, maisons familiales, biens avec vue. Cette diversité attire des parcours de vie très différents.",
      "C'est un territoire qui se choisit pour longtemps, avec une vraie logique patrimoniale."
    ],
  },
  {
    slug: 'investissement-locatif-lyon-ouest',
    title: "Investissement locatif dans l'Ouest Lyonnais : où et comment investir",
    excerpt: "Rentabilité, tension locative, typologies de biens : les bons repères pour investir intelligemment dans les communes de l'Ouest lyonnais.",
    coverImage: '/fr/images/Biens/appartement-interieur-1.webp',
    category: 'Conseils patrimoine',
    author: 'Samuel Ribes',
    publishedDate: '2026-02-27',
    readTime: '6 min',
    content: [
      "L'Ouest lyonnais attire des investisseurs qui cherchent un compromis entre sécurité patrimoniale et demande locative stable. Les secteurs proches des transports et des bassins d'emploi restent les plus performants.",
      "Le choix de la typologie est central : les petites surfaces sont plus liquides, tandis que les T3/T4 bien situés séduisent des locataires longue durée avec un taux de vacance limité.",
      "Au-delà du prix d'achat, il faut intégrer le potentiel locatif réel : charges, fiscalité, état du bien et qualité de la copropriété. Un rendement brut attractif peut masquer des coûts d'exploitation élevés.",
      "Une stratégie d'investissement réussie repose sur l'alignement entre horizon de détention, niveau de risque accepté et objectifs de valorisation."
    ],
  },
]

export const BLOG_CATEGORIES: Array<'Tout' | BlogCategory> = [
  'Tout',
  'Marché immobilier',
  'Guides pratiques',
  'Vie locale',
  'Conseils patrimoine',
]

export const getBlogPostBySlug = (slug: string) => BLOG_POSTS.find((entry) => entry.slug === slug)

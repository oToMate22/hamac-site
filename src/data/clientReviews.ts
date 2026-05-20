export type ClientReview = {
  id: string
  quote: string
  author: string
  /** Note fixe affichée (ex. 5 pour 5/5). Sinon note aléatoire entre 4,6 et 5. */
  rating?: number
}

/** Avis clients (texte). Ajoutez ou modifiez ici sans toucher au HTML. */
export const CLIENT_REVIEWS: ClientReview[] = [
  {
    id: '1',
    quote:
      '« Une écoute rare. Hamac a sécurisé notre achat à Sainte-Foy avec une transparence que nous n’avions pas trouvée ailleurs. »',
    author: 'Claire & Marc D. — Sainte-Foy-lès-Lyon',
    rating: 5,
  },
  {
    id: '2',
    quote:
      '« Vente rapide, photos magnifiques, et un interlocuteur unique du premier rendez-vous jusqu’à la signature. »',
    author: 'Thomas L. — Tassin-la-Demi-Lune',
  },
  {
    id: '3',
    quote:
      '« On cherchait un investissement sans prise de tête : Hamac connaît les quartiers et les rendements réalistes. »',
    author: 'Sophie M. — Investisseuse, Ouest Lyonnais',
    rating: 5,
  },
  {
    id: '4',
    quote: '« Accompagnement clair et réactif du début à la fin. Nous recommandons Hamac sans hésiter. »',
    author: 'Famille R. — Francheville',
  },
  {
    id: '5',
    quote: '« Estimation juste, stratégie de mise en vente efficace, vente conclue dans les délais annoncés. »',
    author: 'Philippe G. — Écully',
  },
  {
    id: '6',
    quote: '« Une équipe disponible qui connaît vraiment le secteur. Visites bien ciblées, zéro perte de temps. »',
    author: 'Julie & Antoine B. — Craponne',
  },
  {
    id: '7',
    quote: '« Location gérée avec sérieux : dossiers complets, locataire solide, suivi impeccable. »',
    author: 'Marc D. — Oullins',
  },
  {
    id: '8',
    quote: '« Conseils patrimoniaux pertinents et pédagogiques. On se sent accompagné, pas pressé. »',
    author: 'Isabelle V. — Sainte-Foy-lès-Lyon',
  },
  {
    id: '9',
    quote: '« Photos et annonce au top, nombreuses visites qualifiées, vente au prix attendu. »',
    author: 'Nicolas P. — Tassin-la-Demi-Lune',
  },
  {
    id: '10',
    quote: '« Très bonne lecture du marché local. Hamac a su rassurer acquéreurs et vendeurs. »',
    author: 'Céline M. — Ouest Lyonnais',
  },
  {
    id: '11',
    quote: '« Professionnalisme, transparence et proximité : exactement ce que l’on attend d’une agence de quartier. »',
    author: 'Laurent & Anne F. — Sainte-Foy-lès-Lyon',
  },
]

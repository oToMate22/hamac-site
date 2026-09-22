export type PrivateVisit = {
  id: string
  title: string
  commune: string
  /** UID Cloudflare Stream (dashboard → Stream → vidéo). */
  streamVideoId?: string
  posterSrc: string
  soldDate?: string
  surface?: number
  rooms?: number
  description?: string
}

/** Carte mise en avant au centre du carousel (accueil). */
export const FEATURED_PRIVATE_VISIT_ID = 'appartement-tassin'

/** IDs Cloudflare Stream */
export const CLOUDFLARE_STREAM_IDS = {
  maisonSainteFoy: 'a08eb7862d12604105c7ee0b444c2e04',
  appartementTassin: '55f112ac77b6c4c69a24cd46abfbbf70',
  villaEcully: '0f1a656f5db8580227546290d3150c5f',
  maisonFrancheville: 'db9d1510c8dc1333f2bab7b1cf664c69',
  proprieteCraponne: '4fe723993a61a006454a682b72180c3c',
  appartementOullins: 'e0761074e320df7e77966382f8ec3fc2',
} as const

/**
 * Ordre carousel : Tassin au centre (index 2).
 * Swipe ← Écully… | Tassin | …Sainte-Foy →
 */
export const privateVisits: PrivateVisit[] = [
  {
    id: 'maison-sainte-foy',
    title: 'Maison familiale avec jardin',
    commune: 'Sainte-Foy-lès-Lyon',
    streamVideoId: CLOUDFLARE_STREAM_IDS.maisonSainteFoy,
    posterSrc: '/fr/images/Biens/maison-jardin.webp',
    soldDate: '2025-11-12',
    surface: 185,
    rooms: 7,
    description:
      'Une demeure lumineuse aux volumes généreux, vendue après une mise en valeur soignée de l’extérieur et des espaces de vie.',
  },
  {
    id: 'appartement-oullins',
    title: 'Appartement lumineux proche du métro',
    commune: 'Oullins',
    streamVideoId: CLOUDFLARE_STREAM_IDS.appartementOullins,
    posterSrc: '/fr/images/Biens/appartement-interieur-2.webp',
    soldDate: '2025-01-18',
    surface: 68,
    rooms: 3,
    description:
      'Visite privée mettant en valeur la proximité des transports et la qualité de vie dans un quartier en plein essor.',
  },
  {
    id: 'appartement-tassin',
    title: 'Appartement traversant avec terrasse',
    commune: 'Tassin-la-Demi-Lune',
    streamVideoId: CLOUDFLARE_STREAM_IDS.appartementTassin,
    posterSrc: '/fr/images/Biens/appartement-interieur-1.webp',
    soldDate: '2025-09-28',
    surface: 92,
    rooms: 4,
    description:
      'Visite filmée mettant en avant la lumière naturelle et la proximité des commerces de centre-ville.',
  },
  {
    id: 'villa-ecully',
    title: 'Villa contemporaine de standing',
    commune: 'Écully',
    streamVideoId: CLOUDFLARE_STREAM_IDS.villaEcully,
    posterSrc: '/fr/images/Biens/maison-art.webp',
    soldDate: '2025-07-15',
    surface: 210,
    rooms: 6,
    description:
      'Architecture actuelle, prestations haut de gamme et vue dégagée : un bien vendu dans un délai maîtrisé.',
  },
  {
    id: 'maison-francheville',
    title: 'Maison de ville rénovée',
    commune: 'Francheville',
    streamVideoId: CLOUDFLARE_STREAM_IDS.maisonFrancheville,
    posterSrc: '/fr/images/Biens/maison-city.webp',
    soldDate: '2025-05-03',
    surface: 128,
    rooms: 5,
    description:
      'Rénovation complète valorisée en visite privée, avec un parcours fluide entre pièces de réception et jardin.',
  },
  {
    id: 'propriete-craponne',
    title: 'Propriété proche des espaces verts',
    commune: 'Craponne',
    streamVideoId: CLOUDFLARE_STREAM_IDS.proprieteCraponne,
    posterSrc: '/fr/images/Biens/maison-bleu-2.webp',
    soldDate: '2025-02-20',
    surface: 156,
    rooms: 6,
    description:
      'Cadre résidentiel calme, garage double et pièce de vie ouverte sur l’extérieur : une vente accompagnée de bout en bout.',
  },
]

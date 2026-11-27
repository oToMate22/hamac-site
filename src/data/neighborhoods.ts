export type NeighborhoodPhotoCredit = {
  author: string
  license: 'CC BY-SA 4.0' | 'CC0'
  work: string
  url: string
}

export type Neighborhood = {
  slug: string
  name: string
  heroImage: string
  heroAlt: string
  photoCredit: NeighborhoodPhotoCredit
  tagline: string
  pricePerSqm: string
  priceEvolution: string
  population: string
  description: string[]
  schools: string[]
  transport: string[]
  shops: string
  parks: string
  referentAgent: {
    name: string
    role: string
    photo: string
  }
}

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    slug: 'sainte-foy-les-lyon',
    name: 'Sainte-Foy-lès-Lyon',
    heroImage: '/fr/images/quartiers/sainte-foy-les-lyon.webp?v=5',
    heroAlt: 'Église Sainte-Foy à Sainte-Foy-lès-Lyon, chevet et clocher',
    photoCredit: {
      author: 'Chabe01',
      license: 'CC BY-SA 4.0',
      work: 'Église Sainte-Foy',
      url: 'https://commons.wikimedia.org/wiki/File:%C3%89glise_Sainte_Foy_-_Sainte-Foy-l%C3%A8s-Lyon_(FR69)_-_2026-08-23_-_5.jpg',
    },
    tagline: 'Le bourg historique aux portes de Lyon',
    pricePerSqm: '4 850 € / m²',
    priceEvolution: '+3.2% sur 12 mois',
    population: '22 000 habitants',
    description: [
      "Sainte-Foy-lès-Lyon séduit par son équilibre rare entre charme de village et proximité immédiate de Lyon. Entre les pentes arborées, les places animées du bourg et les vues ouvertes sur la ville, la commune offre un cadre de vie paisible sans compromis sur la praticité du quotidien.",
      "Les familles apprécient ses établissements scolaires réputés, ses rues résidentielles calmes et la qualité des services de proximité. Le patrimoine local, dont les aqueducs romains, donne à la ville une identité forte et un caractère authentique.",
      "Vivre à Sainte-Foy, c'est choisir une adresse rassurante, élégante et durable, où l'on s'installe souvent pour longtemps."
    ],
    schools: ['Lycée Jean-Baptiste-Say', 'Institution Sainte-Marc', 'École Châtelain'],
    transport: ['Bus C19 / C20 vers Lyon centre', 'Accès rapide Lyon 5e', 'Connexion A6 / périphérique'],
    shops: 'Commerces de bouche, cafés de quartier, marché hebdomadaire et services de centre-bourg.',
    parks: 'Parcs arborés, promenades sur les hauteurs, points de vue sur Lyon et espaces naturels préservés.',
    referentAgent: {
      name: 'Ana Sanabria',
      role: 'Agent commercial',
      photo: '/fr/images/team/ana-sanabria.webp?v=2'
    }
  },
  {
    slug: 'tassin-la-demi-lune',
    name: 'Tassin-la-Demi-Lune',
    heroImage: '/fr/images/quartiers/tassin-la-demi-lune.webp',
    heroAlt: 'Place Pierre Vauboin et horloge monumentale à Tassin-la-Demi-Lune',
    photoCredit: {
      author: 'Chabe01',
      license: 'CC BY-SA 4.0',
      work: 'Place Pierre Vauboin',
      url: 'https://commons.wikimedia.org/wiki/File:Place_Pierre_Vauboin_-_Tassin-la-Demi-Lune_(FR69)_-_2026-08-23_-_2.jpg',
    },
    tagline: "Le carrefour dynamique de l'Ouest",
    pricePerSqm: '4 200 € / m²',
    priceEvolution: '+2.6% sur 12 mois',
    population: '18 000 habitants',
    description: [
      "Tassin-la-Demi-Lune combine énergie urbaine et douceur résidentielle. Sa position stratégique en fait un point de connexion majeur entre l'Ouest lyonnais et le centre-ville.",
      "La commune propose une offre immobilière variée, des appartements proches des commerces aux maisons familiales dans des rues plus calmes. Cette diversité attire aussi bien les jeunes actifs que les familles établies.",
      "Avec ses écoles, ses infrastructures et ses accès fluides, Tassin offre un mode de vie simple et efficace, très recherché sur le marché local."
    ],
    schools: ['Institution Saint-Joseph', 'Collège Jean-Jacques-Rousseau', 'École Baraillon'],
    transport: ['Gare TER de Tassin', 'Bus 5 / 72 / 73', 'Accès rapide A6 / périphérique ouest'],
    shops: 'Centre commerçant vivant, enseignes de proximité, restaurants et services du quotidien.',
    parks: 'Squares résidentiels, promenades vertes et accès rapide aux espaces boisés de l’Ouest lyonnais.',
    referentAgent: {
      name: 'Romain Monneri-Fons',
      role: 'Directeur associé',
      photo: '/fr/images/team/romain.webp?v=2'
    }
  },
  {
    slug: 'ecully',
    name: 'Écully',
    heroImage: '/fr/images/quartiers/ecully.webp?v=3',
    heroAlt: 'Église Saint-Blaise à Écully',
    photoCredit: {
      author: 'Chabe01',
      license: 'CC BY-SA 4.0',
      work: 'Église Saint-Blaise',
      url: 'https://commons.wikimedia.org/wiki/File:%C3%89glise_Saint_Blaise_-_%C3%89cully_(FR69)_-_2026-08-23_-_10.jpg',
    },
    tagline: 'Prestige discret et grandes écoles',
    pricePerSqm: '5 100 € / m²',
    priceEvolution: '+2.1% sur 12 mois',
    population: '19 000 habitants',
    description: [
      "Écully incarne un standing résidentiel recherché, avec de belles propriétés nichées dans un environnement verdoyant et confidentiel. L'atmosphère y est élégante, sans ostentation.",
      "La présence d'établissements majeurs comme EM Lyon et Centrale Lyon renforce le dynamisme local et l'attractivité de la commune sur le long terme.",
      "Entre patrimoine, calme et qualité architecturale, Écully reste une valeur sûre pour les familles et les acquéreurs en quête d'un cadre premium."
    ],
    schools: ['École Centrale de Lyon', 'EM Lyon', 'Lycée Valpré'],
    transport: ['Bus 3 / 19 / 89', 'Accès A6 immédiat', 'Liaison rapide vers Gorge de Loup'],
    shops: 'Commerces de qualité, artisanat local, services premium et vie de quartier active.',
    parks: 'Grandes propriétés arborées, parcs paysagers et ambiance très verte au quotidien.',
    referentAgent: {
      name: 'Victor Bonazza',
      role: 'Gérant associé',
      photo: '/fr/images/team/victor.webp?v=6'
    }
  },
  {
    slug: 'francheville',
    name: 'Francheville',
    heroImage: '/fr/images/quartiers/francheville.webp',
    heroAlt: 'Église Saint-Roch à Francheville-le-Haut',
    photoCredit: {
      author: 'Sebleouf',
      license: 'CC BY-SA 4.0',
      work: 'Église Saint-Roch de Francheville-le-Haut',
      url: 'https://commons.wikimedia.org/wiki/File:Francheville_(Rh%C3%B4ne)_-_%C3%89glise_Saint-Roch_de_Francheville-le-Haut_(mars_2019).jpg',
    },
    tagline: 'Nature et tranquillité',
    pricePerSqm: '3 600 € / m²',
    priceEvolution: '+3.9% sur 12 mois',
    population: '14 000 habitants',
    description: [
      "Francheville attire celles et ceux qui recherchent un quotidien plus apaisé, entre nature, reliefs boisés et esprit familial. La commune conserve une identité résidentielle forte.",
      "Le secteur bénéficie d'un excellent rapport qualité-prix dans l'Ouest lyonnais, ce qui en fait une alternative particulièrement intéressante face à Écully ou Sainte-Foy.",
      "Avec sa popularité croissante, Francheville reste un choix stratégique pour habiter durablement ou valoriser un investissement patrimonial."
    ],
    schools: ['Collège Christiane Bernardin', 'École du Bourg', 'Groupe scolaire Chater'],
    transport: ['Bus C20E / 14', 'Proximité A450', 'Connexion TER Francheville'],
    shops: 'Commerces de proximité, services essentiels et vie locale active autour des centres de quartier.',
    parks: "Vallée de l'Yzeron, sentiers verts et espaces naturels appréciés des familles.",
    referentAgent: {
      name: 'Élodie Renard',
      role: 'Agent commercial',
      photo: '/fr/images/team/elodie-renard.webp?v=2'
    }
  },
  {
    slug: 'craponne',
    name: 'Craponne',
    heroImage: '/fr/images/quartiers/craponne.webp',
    heroAlt: 'Marché dans le bourg de Craponne',
    photoCredit: {
      author: 'Vert42450',
      license: 'CC BY-SA 4.0',
      work: 'Bourg de Craponne un jour de marché',
      url: 'https://commons.wikimedia.org/wiki/File:Bourg_Craponne_en_plein_march%C3%A9_estival.jpg',
    },
    tagline: 'La campagne aux portes de Lyon',
    pricePerSqm: '3 800 € / m²',
    priceEvolution: '+4.1% sur 12 mois',
    population: '11 000 habitants',
    description: [
      "Craponne conserve un esprit village très apprécié, avec une vraie convivialité de quartier et un rythme de vie plus serein que dans l'hyper-centre.",
      "Son marché hebdomadaire, ses commerces indépendants et sa vie associative donnent à la commune une ambiance chaleureuse, idéale pour les jeunes familles.",
      "Avec un ticket d'entrée plus accessible que d'autres communes de l'Ouest, Craponne devient un choix naturel pour concrétiser un premier projet maison."
    ],
    schools: ['Collège Jean Rostand', 'École publique de Craponne', 'Institution Saint-Irénée'],
    transport: ['Bus C24 / C24E', 'Accès rapide vers Tassin', 'Connexion A450'],
    shops: 'Marché de plein vent, commerces locaux et services de centre-ville très pratiques.',
    parks: 'Espaces verts familiaux, promenades en lisière de campagne et environnement résidentiel aéré.',
    referentAgent: {
      name: 'Raphaël Lasbatx',
      role: 'Négociateur immobilier',
      photo: '/fr/images/team/raphael.webp'
    }
  },
  {
    slug: 'oullins',
    name: 'Oullins',
    heroImage: '/fr/images/quartiers/oullins.webp',
    heroAlt: "Mairie d'Oullins et son esplanade",
    photoCredit: {
      author: 'Benoît Prieur',
      license: 'CC0',
      work: "Mairie d'Oullins",
      url: 'https://commons.wikimedia.org/wiki/File:Mairie_d%27Oullins_en_janvier_2023.JPG',
    },
    tagline: "L'énergie du sud-ouest lyonnais",
    pricePerSqm: '3 400 € / m²',
    priceEvolution: '+3.5% sur 12 mois',
    population: '26 000 habitants',
    description: [
      "Oullins offre une dynamique urbaine appréciée pour sa connexion directe avec Lyon, notamment grâce au métro B. C'est une commune active, vivante et en transformation.",
      "Les bords du Rhône, les commerces et la diversité de son parc immobilier en font un secteur attractif pour les primo-accédants comme pour les investisseurs.",
      "Plus urbain que d'autres communes de l'Ouest lyonnais, Oullins conserve néanmoins des poches résidentielles agréables et une vraie qualité de vie de proximité."
    ],
    schools: ['Lycée Parc Chabrières', 'Collège Pierre Brossolette', 'École de la Saulaie'],
    transport: ['Métro B', 'Bus C7 / 63 / 88', 'Accès rapide A7 / périphérique'],
    shops: 'Commerces de centre-ville, marchés, cafés et services urbains complets.',
    parks: 'Berges du Rhône, parcs de quartier et promenades aménagées.',
    referentAgent: {
      name: 'Samuel Ribes',
      role: 'Négociateur immobilier',
      photo: '/fr/images/team/samuel.webp'
    }
  }
]

export const getNeighborhoodBySlug = (slug: string) => NEIGHBORHOODS.find((entry) => entry.slug === slug)

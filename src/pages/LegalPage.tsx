import { Link } from 'react-router-dom'
import { LegalDocument, LegalSection } from '../components/LegalDocument'
import { NEIGHBORHOODS } from '../data/neighborhoods'

const LAST_UPDATED = '10 novembre 2026'

const AGENCY = {
  name: 'Hamac Investissements & Patrimoine',
  addressLine1: '19 Boulevard Baron du Marais',
  city: '69110 Sainte-Foy-lès-Lyon',
  country: 'France',
  phone: '+33 4 78 85 08 27',
  email: 'agence@hamacpatrimoine.com',
  tradeRegister: '89954018100026',
}

export function LegalPage() {
  return (
    <LegalDocument
      title="Mentions légales — Hamac Investissements & Patrimoine"
      metaDescription="Mentions légales du site Hamac Investissements & Patrimoine, agence immobilière à Sainte-Foy-lès-Lyon."
      heading="Mentions légales"
      lastUpdated={LAST_UPDATED}
    >
      <p>
        Conformément aux dispositions des articles 6-III et 19 de la loi pour la Confiance dans l&apos;Économie Numérique,
        ainsi que l&apos;arrêté du 10 janvier 2017 relatif à l&apos;information des consommateurs par les professionnels
        intervenant dans une transaction immobilière, nous vous informons que :
      </p>
      <p>
        Notre barème tarifaire est disponible sur notre site, ou sur simple demande par e-mail, courrier, téléphone ou depuis
        la rubrique{' '}
        <Link to="/contact">contact</Link>.
      </p>

      <LegalSection title="Éditeur">
        <p>
          <strong>{AGENCY.name}</strong>
          <br />
          {AGENCY.addressLine1}
          <br />
          {AGENCY.city}
          <br />
          {AGENCY.country}
          <br />
          Tél. : <a href="tel:+33478850827">{AGENCY.phone}</a>
          <br />
          Email : <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>
          <br />
          Tribunal de commerce : {AGENCY.tradeRegister}
        </p>
      </LegalSection>

      <LegalSection title="Hébergeurs et sous-traitants techniques">
        <p>
          <strong>Hébergement du site web</strong>
          <br />
          Vercel Inc.
          <br />
          440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
          <br />
          <a href="https://vercel.com" rel="noopener noreferrer" target="_blank">
            vercel.com
          </a>
        </p>
        <p>
          <strong>Hébergement des données des formulaires</strong> (contact, estimation, off-market, demande sur un bien)
          <br />
          Supabase, Inc.
          <br />
          <a href="https://supabase.com" rel="noopener noreferrer" target="_blank">
            supabase.com
          </a>
        </p>
        <p>
          Le détail des traitements de données personnelles est précisé sur la page{' '}
          <Link to="/confidentialite">Politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Crédits photos" id="credits-photos">
        <p>
          Les photographies des communes utilisées sur les pages quartiers proviennent de Wikimedia Commons. Cinq d’entre
          elles sont publiées sous licence CC BY-SA 4.0 : l’auteur et la licence doivent être mentionnés. La photo
          d’Oullins est en CC0 (domaine public), sans mention obligatoire.
        </p>
        <ul>
          {NEIGHBORHOODS.map((entry) => (
            <li key={entry.slug}>
              <strong>{entry.name}</strong>
              {' — '}
              {entry.photoCredit.work}, {entry.photoCredit.author}, {entry.photoCredit.license}, via{' '}
              <a href={entry.photoCredit.url} rel="noopener noreferrer" target="_blank">
                Wikimedia Commons
              </a>
              .
            </li>
          ))}
        </ul>
        <p>
          Le partage à l’identique de la licence CC BY-SA 4.0 porte uniquement sur les photographies ainsi utilisées, et
          non sur l’ensemble du site.
        </p>
      </LegalSection>

      <p>
        Les sections relatives aux données personnelles, aux cookies et au démarchage téléphonique sont consultables sur
        la page <Link to="/confidentialite">Politique de confidentialité</Link>.
      </p>
    </LegalDocument>
  )
}

function FeesTable({
  headers,
  rows,
  note,
}: {
  headers: [string, string]
  rows: Array<[string, string]>
  note?: string
}) {
  return (
    <div className="legal-table-wrap">
      <table className="legal-table">
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([left, right]) => (
            <tr key={`${left}-${right}`}>
              <td>{left}</td>
              <td>{right}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="legal-section__note">{note}</p> : null}
    </div>
  )
}

export function FeesPage() {
  const chargeVendeur =
    'Sauf convention contraire, les honoraires seront à la charge du vendeur et les pourcentages des honoraires appliqués sont calculés sur le prix de vente TTC (incluant une TVA à 20 %).'
  const chargeAcquereur =
    "Sauf convention contraire, les honoraires seront à la charge de l'acquéreur et les pourcentages des honoraires appliqués sont calculés sur le prix de vente TTC (incluant une TVA à 20 %)."

  return (
    <LegalDocument
      title="Honoraires — Hamac Investissements & Patrimoine"
      metaDescription="Grille d'honoraires Hamac : transaction, location, gestion courte durée et investissement clé en main."
      heading="Honoraires d'agence"
      lastUpdated="30 octobre 2026"
    >
      <p>
        Conformément à la réglementation en vigueur, {AGENCY.name} communique ses honoraires de manière transparente avant
        toute mission.
      </p>
      <p>
        Vous pouvez aussi{' '}
        <a href="/fr/documents/honoraires-hamac.pdf" download>
          télécharger la grille d&apos;honoraires (PDF)
        </a>
        , ou nous écrire via <Link to="/contact">contact</Link>.
      </p>

      <LegalSection title="Grille honoraires « Transaction »">
        <h3>Vente de locaux à usage d&apos;habitation</h3>
        <FeesTable
          headers={['Montant de la transaction', 'Honoraires T.T.C']}
          rows={[
            ['Entre 0 € et 50 000 €', 'Forfait de 3 600 €'],
            ['Entre 50 001 € et 100 000 €', '8,00 %'],
            ['Entre 100 001 € et 200 000 €', '7,00 %'],
            ['Entre 200 001 € et 250 000 €', '6,00 %'],
            ['Entre 250 001 € et 300 000 €', '5,50 %'],
            ['Entre 300 001 € et 600 000 €', '5,00 %'],
            ['Plus de 600 001 €', '4,00 %'],
          ]}
          note={chargeVendeur}
        />
        <h3>Vente de locaux à usage professionnel, commercial, industriel et cession de bail</h3>
        <FeesTable
          headers={['Montant de la transaction', 'Honoraires T.T.C']}
          rows={[
            ['Entre 0 € et 100 000 €', 'Forfait de 8 000 €'],
            ['Entre 100 001 € et 200 000 €', '8 %'],
            ['Plus de 200 000 €', '7 %'],
          ]}
          note={chargeAcquereur}
        />
        <h3>Vente de terrains à bâtir</h3>
        <FeesTable
          headers={['Montant de la transaction', 'Honoraires T.T.C']}
          rows={[
            ['Entre 0 € et 500 000 €', '10,00 %'],
            ['Plus de 500 001 €', '7,00 %'],
          ]}
          note={chargeVendeur}
        />
      </LegalSection>

      <LegalSection title="Location de locaux à usage d'habitation">
        <p className="legal-section__note">
          Conforme aux dispositions de la loi ALUR du 24 mars 2014 et au décret d&apos;application du 1er août 2014.
        </p>
        <h3>Part du locataire</h3>
        <FeesTable
          headers={['Prestation', 'Honoraires T.T.C']}
          rows={[
            [
              "Rédaction de l'annonce, visites, constitution du dossier locataire, rédaction du bail",
              '10,00 € TTC par m² de surface habitable',
            ],
            ['État des lieux', '3,00 € TTC par m² de surface habitable'],
          ]}
        />
        <h3>Part du propriétaire-bailleur</h3>
        <FeesTable
          headers={['Prestation', 'Honoraires T.T.C']}
          rows={[
            [
              "Rédaction de l'annonce, visites, constitution du dossier locataire, rédaction du bail",
              'Égale à un mois de loyer hors charge et hors état des lieux TTC',
            ],
            ['État des lieux', '3,00 € TTC par m² de surface habitable'],
          ]}
        />
      </LegalSection>

      <LegalSection title="Location de locaux à usage professionnel, commercial, ou stationnements">
        <h3>Part du locataire</h3>
        <FeesTable
          headers={['Prestation', 'Honoraires T.T.C']}
          rows={[
            [
              "Rédaction de l'annonce, visites, constitution du dossier locataire, rédaction du bail",
              '10 % HT du loyer annuel',
            ],
            ['État des lieux', '3,00 € TTC par m² de surface'],
          ]}
        />
        <h3>Part du propriétaire-bailleur</h3>
        <FeesTable
          headers={['Prestation', 'Honoraires T.T.C']}
          rows={[
            [
              "Rédaction de l'annonce, visites, constitution du dossier locataire, rédaction du bail",
              'Égale à celle du locataire',
            ],
            ['État des lieux', '3,00 € TTC par m² de surface'],
          ]}
        />
      </LegalSection>

      <LegalSection title="Gestion à haute rentabilité — courte et moyenne durée">
        <h3>Honoraires propriétaire</h3>
        <FeesTable
          headers={['Mandat de gestion', 'Honoraires T.T.C']}
          rows={[
            ['Location courte durée (de 1 à 30 nuits)', '25 % TTC'],
            ['Location moyenne durée (supérieur à 30 nuits)', '20 % TTC'],
          ]}
        />
        <h3>Pack d&apos;entrée à la charge des propriétaires</h3>
        <FeesTable
          headers={['Prestation', 'Honoraires T.T.C']}
          rows={[
            [
              "Shooting photo professionnel · rédaction de l'annonce sur tous les supports de diffusion · ménage intégral avant la première mise en location · démarches administratives de conformité d'urbanisme",
              '500 €',
            ],
          ]}
        />
        <h3>Honoraires locataires</h3>
        <FeesTable
          headers={['Prestation', 'Honoraires T.T.C']}
          rows={[
            [
              "Frais de rédaction d'acte",
              '150 € par chambre de colocation · 8 € / m² pour une location simple · 150 € pour un parking',
            ],
            [
              'État des lieux entrant ou sortant',
              '3 € / m² avec un minimum de 50 € (pour les colocations, forfait de 50 € par passage)',
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="Investissement clé en main">
        <ul>
          <li>Validation de vos objectifs</li>
          <li>Proposition d&apos;une stratégie d&apos;investissement</li>
          <li>Identification des biens</li>
          <li>Accompagnement dans le processus d&apos;acquisition</li>
          <li>Suivi des travaux</li>
        </ul>
        <FeesTable
          headers={["Montant de l'investissement (1)", 'Honoraires T.T.C']}
          rows={[
            ['Inférieur à 100 000 €', '8 100 €'],
            ['Entre 100 000 € et 119 999 €', '8 800 €'],
            ['Entre 120 000 € et 139 999 €', '9 800 €'],
            ['Entre 140 000 € et 159 999 €', '11 900 €'],
            ['Entre 160 000 € et 179 999 €', '13 200 €'],
            ['Entre 180 000 € et 199 999 €', '14 900 €'],
            ['Entre 200 000 € et 249 999 €', '16 700 €'],
            ['Entre 250 000 € et 299 999 €', '18 100 €'],
            ['Entre 300 000 € et 349 999 €', '20 500 €'],
            ['Entre 350 000 € et 399 999 €', '23 600 €'],
            ['Entre 400 000 € et 499 999 €', '26 250 €'],
            ['Entre 500 000 € et 599 999 €', '30 000 €'],
            ['Entre 600 000 € et 699 999 €', '35 000 €'],
            ['Entre 700 000 € et 799 999 €', '40 000 €'],
            ['Au-delà', 'Nous consulter'],
          ]}
          note="(1) Le montant de l'investissement = prix d'achat du bien (frais d'agent inclus) + montant des travaux et ameublement."
        />
      </LegalSection>

      <LegalSection title="Informations légales">
        <p>
          Hamac Investissements &amp; Patrimoine SAS immatriculée au RCS de Lyon sous le n° 899 540 181 — Carte
          professionnelle Transaction n° CPI 6901 2021 000 000 102 délivrée par la CCI de Lyon Métropole — Non
          maniement de fonds — Capital : 1 000,00 € — 5 Place Bellecour, 69002 Lyon —{' '}
          <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>
        </p>
        <p>
          Pour toute question : <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a> — {AGENCY.phone}.
        </p>
      </LegalSection>
    </LegalDocument>
  )
}

export function PrivacyPage() {
  return (
    <LegalDocument
      title="Politique de confidentialité — Hamac Investissements & Patrimoine"
      metaDescription="Données personnelles, cookies et droits des utilisateurs sur le site Hamac Investissements & Patrimoine."
      heading="Données personnelles et cookies"
      lastUpdated={LAST_UPDATED}
    >
      <LegalSection title="Conditions d'utilisation du site">
        <p>
          L&apos;utilisation du site est soumise au respect des conditions ci-dessous. L&apos;accès et la navigation sur le
          site entraînent l&apos;acceptation de ces conditions :
        </p>
        <ul>
          <li>
            <strong>Site</strong> : désigne le site internet auquel vous accédez depuis votre navigateur internet
          </li>
          <li>
            <strong>L&apos;Agence</strong> : désigne l&apos;agence immobilière {AGENCY.name}, qui diffuse les annonces et
            récupère les données saisies par l&apos;internaute sur les formulaires de contact
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Données personnelles collectées">
        <p>Les données personnelles pouvant être collectées sur le site sont les suivantes :</p>
        <ul>
          <li>
            <strong>Cookies</strong> : les cookies sont utilisés, dans le cadre de l&apos;utilisation du site, afin de
            collecter certaines informations (en particulier, votre adresse IP, des informations relatives à
            l&apos;ordinateur utilisé pour la navigation, le mode de connexion, le type et la version du navigateur
            internet, le système d&apos;exploitation et d&apos;autres identifiants techniques ou encore l&apos;adresse URL des
            connexions, y compris la date et l&apos;heure, ainsi que le contenu accédé). Vous avez la possibilité de désactiver
            les cookies à partir des paramètres de votre navigateur.
          </li>
          <li>
            <strong>Formulaires de contact</strong> : selon le formulaire utilisé, sont collectés notamment vos nom,
            prénom, adresse électronique, numéro de téléphone, le contenu de votre message, et le cas échéant des
            informations relatives à un bien (référence), à une demande d&apos;estimation (type de bien, commune, surfaces,
            pièces) ou à une inscription off-market (critères de recherche, secteur, budget).
          </li>
        </ul>
        <p>Pages concernées : contact, estimation, off-market, demande sur une fiche bien (acheter / louer).</p>
      </LegalSection>

      <LegalSection title="Utilisation de vos données">
        <p>Les utilisations de vos données personnelles sont principalement les suivantes :</p>
        <ul>
          <li>gestion de la relation avec vous ;</li>
          <li>
            fourniture de contenus et services personnalisés, en fonction de votre historique de navigation, de vos
            préférences et centres d&apos;intérêts ;
          </li>
        </ul>
        <p>
          Lorsque certaines informations sont obligatoires pour accéder à des fonctionnalités spécifiques du site, ce
          caractère obligatoire est indiqué au moment de la saisie des données. En cas de refus de votre part de fournir
          des informations obligatoires, vous pourriez ne pas avoir accès à certains services, fonctionnalités ou
          rubriques du site.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Vos informations personnelles sont conservées pendant une durée qui ne saurait excéder 36 mois, sauf si :
        </p>
        <ul>
          <li>vous exercez, dans les conditions prévues ci-après, l&apos;un des droits qui vous sont reconnus par la législation ;</li>
          <li>une durée de conservation plus longue est autorisée ou imposée en vertu d&apos;une disposition légale ou réglementaire ;</li>
          <li>ce délai peut être renouvelé si vous donnez suite à la relation commerciale.</li>
        </ul>
        <p>
          Pendant cette période, le site met en œuvre les moyens organisationnels, logiciels, juridiques, techniques et
          physiques aptes à assurer la confidentialité et la sécurité de vos données personnelles, de manière à empêcher
          leur endommagement, effacement ou accès par des tiers non autorisés.
        </p>
      </LegalSection>

      <LegalSection title="Accès aux données personnelles">
        <p>
          L&apos;accès à vos données personnelles est strictement limité au personnel et agents commerciaux de l&apos;Agence,
          habilités en raison de leurs fonctions et tenus à une obligation de confidentialité. Cependant, les données
          collectées pourront éventuellement être communiquées à des sous-traitants chargés contractuellement de
          l&apos;exécution des tâches nécessaires au bon fonctionnement du site et de ses services ainsi qu&apos;à la bonne
          gestion de la relation avec vous, sans que vous ayez besoin de donner votre autorisation. Il est précisé que,
          dans le cadre de l&apos;exécution de leurs prestations, les sous-traitants n&apos;ont qu&apos;un accès limité à vos données
          et ont une obligation contractuelle de les utiliser en conformité avec les dispositions de la législation
          applicable en matière de protection des données personnelles, notamment :
        </p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> — hébergement et diffusion du site web ;
          </li>
          <li>
            <strong>Supabase, Inc.</strong> — hébergement et stockage des données transmises via les formulaires en ligne
            (contact, estimation, off-market, fiche bien).
          </li>
          <li>
            <strong>Google Ireland Limited</strong> — mesure d&apos;audience, uniquement après votre consentement.
          </li>
        </ul>
        <p>
          En dehors des cas énoncés ci-dessus, l&apos;Agence s&apos;engage à ne pas vendre, louer, céder ou donner accès à des
          tiers à vos données sans votre consentement préalable, à moins d&apos;y être contraints en raison d&apos;un motif
          légitime (obligation légale, lutte contre la fraude ou l&apos;abus, exercice des droits de la défense, etc.).
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Conformément aux dispositions légales et réglementaires applicables, en particulier la loi n° 78-17 du 6 janvier
          1978 modifiée relative à l&apos;informatique, aux fichiers et aux libertés et du règlement européen n° 2016/679/UE
          du 27 avril 2016, vous disposez des droits suivants :
        </p>
        <ul>
          <li>exercer votre droit d&apos;accès, pour connaître les données personnelles qui vous concernent ;</li>
          <li>demander la mise à jour de vos données, si celles-ci sont inexactes ;</li>
          <li>demander la portabilité ou la suppression de vos données ;</li>
          <li>demander la limitation du traitement de vos données ;</li>
          <li>vous opposer, pour des motifs légitimes, au traitement de vos données ;</li>
          <li>
            vous opposer ou retirer votre consentement à l&apos;utilisation, par nos services, de vos coordonnées pour
            l&apos;envoi de nos promotions et sollicitations via courriers électroniques, messages SMS, appels téléphoniques
            et courriers postaux. Ce droit demeure valable que les informations vous concernant nous aient été transmises
            directement par vous ou par des partenaires tiers à qui vous les avez communiquées (dans ce cas, il faudra
            cliquer sur les liens de désinscription prévus dans nos SMS ou courriels ou nous contacter dans les conditions
            ci-dessous).
          </li>
        </ul>
        <p>
          Ces différents droits sont à exercer soit directement sur le site à la rubrique{' '}
          <Link to="/contact">Contact</Link>, soit par courrier postal, soit par courriel à l&apos;adresse{' '}
          <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>.
        </p>
        <p>
          Pour des raisons de sécurité et éviter toute demande frauduleuse, cette demande devra être accompagnée d&apos;un
          justificatif d&apos;identité. Le justificatif sera détruit une fois la demande traitée.
        </p>
        <p>
          Pour toute information complémentaire ou réclamation, vous pouvez contacter la Commission Nationale de
          l&apos;Informatique et des Libertés (plus d&apos;informations sur{' '}
          <a href="https://www.cnil.fr" rel="noopener noreferrer" target="_blank">
            www.cnil.fr
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Utilisation des cookies">
        <h3>Qu&apos;est-ce qu&apos;un cookie ?</h3>
        <p>
          Un cookie est un petit fichier texte que les sites web sauvegardent sur votre ordinateur ou appareil mobile
          lorsque vous les consultez. Il permet à ces sites de mémoriser vos actions et préférences (nom d&apos;utilisateur,
          langue, taille des caractères et autres paramètres d&apos;affichage) pendant un temps donné, pour que vous n&apos;ayez pas
          à réindiquer ces informations à chaque fois que vous consultez ces sites ou naviguez d&apos;une page à une autre.
        </p>
        <h3>Comment puis-je désactiver les cookies ?</h3>
        <p>
          Vous pouvez contrôler et/ou supprimer des cookies comme vous le souhaitez. Pour en savoir plus, consultez{' '}
          <a href="https://www.aboutcookies.org" rel="noopener noreferrer" target="_blank">
            aboutcookies.org
          </a>
          . Vous avez la possibilité de supprimer tous les cookies déjà stockés sur votre ordinateur et de configurer la
          plupart des navigateurs pour qu&apos;ils les bloquent. Toutefois, dans ce cas, vous devrez peut-être indiquer
          vous-mêmes certaines préférences chaque fois que vous vous rendrez sur un site, et certains services et
          fonctionnalités risquent de ne pas être accessibles.
        </p>
        <h3>Pourquoi utilise-t-on des cookies ?</h3>
        <p>Nous utilisons des cookies notamment pour :</p>
        <ul>
          <li>gérer vos préférences lors de la navigation sur le site ;</li>
          <li>améliorer nos services et permettre une mesure de l&apos;audience ;</li>
        </ul>
        <p>
          D&apos;autres cookies peuvent être ajoutés par des applications tierces telles que les boutons de partage des
          réseaux sociaux.
        </p>
      </LegalSection>

      <LegalSection title="Mesure d'audience (Google Analytics 4)">
        <h3>Finalité</h3>
        <p>
          Le site utilise Google Analytics 4 pour mesurer sa fréquentation : nombre de visites, pages consultées,
          provenance des visites et type d&apos;appareil. Ces statistiques servent uniquement à améliorer le site et
          l&apos;information qui y est publiée. Aucune donnée n&apos;est utilisée à des fins publicitaires, de profilage
          individuel ou de revente.
        </p>
        <h3>Base légale et consentement</h3>
        <p>
          Ce traitement repose sur votre consentement (article 6.1.a du règlement européen n° 2016/679/UE et article 82
          de la loi n° 78-17 du 6 janvier 1978). Tant que vous n&apos;avez pas accepté, aucun script de mesure n&apos;est
          chargé et aucun cookie de mesure n&apos;est déposé : aucune donnée n&apos;est transmise à Google. Le refus est
          aussi simple que l&apos;acceptation.
        </p>
        <h3>Cookies et stockages concernés</h3>
        <ul>
          <li>
            <strong>_ga</strong> : identifiant de visite permettant de distinguer les visiteurs ; durée de vie de 2 ans ;
          </li>
          <li>
            <strong>_ga_KCHSLFNCBR</strong> : identifiant de session propre à ce site ; durée de vie de 2 ans ;
          </li>
          <li>
            <strong>hamac_consent_v1</strong> (stockage local du navigateur, et non cookie) : mémorise votre choix afin de
            ne pas vous reposer la question à chaque page. Il est conservé dans votre navigateur et n&apos;est jamais
            transmis à nos serveurs.
          </li>
        </ul>
        <h3>Données traitées et conservation</h3>
        <p>
          Les données traitées sont les pages vues, les événements de navigation, l&apos;adresse des pages consultées,
          la page de provenance, la langue, le type d&apos;appareil et de navigateur, une localisation approximative
          (pays, région) et un identifiant aléatoire. Les adresses IP ne sont pas conservées par Google Analytics 4.
        </p>
        <p>
          Ces données sont conservées <strong>14 mois</strong> dans Google Analytics 4, puis supprimées ou agrégées de
          façon définitive.
        </p>
        <h3>Modifier ou retirer votre consentement</h3>
        <p>
          Le lien <strong>« Cookies »</strong> présent en pied de page de chaque page vous permet de revenir sur votre
          choix à tout moment. En cas de retrait, la collecte cesse immédiatement et les cookies de mesure déjà déposés
          sont supprimés. Vous pouvez également supprimer ces cookies depuis les réglages de votre navigateur.
        </p>
        <h3>Sous-traitant et transfert hors Union européenne</h3>
        <p>
          Le service est fourni par Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Irlande), avec les
          fonctions publicitaires désactivées. Des données peuvent être transférées vers les États-Unis dans le cadre des
          clauses contractuelles types de la Commission européenne et du cadre de protection des données UE-États-Unis.
        </p>
      </LegalSection>

      <LegalSection title="Politique liée au démarchage téléphonique">
        <p>
          Nous vous informons de votre droit d&apos;inscription à la liste d&apos;opposition pour le démarchage téléphonique et vous
          suggérons de vous inscrire sur Bloctel.
        </p>
        <p>
          Bloctel est la liste d&apos;opposition au démarchage téléphonique sur laquelle tout consommateur peut s&apos;inscrire
          gratuitement afin de ne plus être démarché téléphoniquement par un professionnel avec lequel il n&apos;a pas de
          relation contractuelle en cours, conformément à la loi n° 2014-344 du 17 mars 2014 relative à la consommation.
        </p>
        <p>
          La loi précise qu&apos;il est interdit à tout professionnel, directement ou par l&apos;intermédiaire d&apos;un tiers agissant
          pour son compte, de démarcher téléphoniquement un consommateur inscrit sur cette liste, à l&apos;exception des cas
          énumérés par la loi.
        </p>
        <ul>
          <li>
            Pour plus d&apos;informations :{' '}
            <a href="https://www.bloctel.gouv.fr" rel="noopener noreferrer" target="_blank">
              www.bloctel.gouv.fr
            </a>
          </li>
          <li>
            Pour s&apos;inscrire :{' '}
            <a href="https://conso.bloctel.fr" rel="noopener noreferrer" target="_blank">
              conso.bloctel.fr
            </a>
          </li>
        </ul>
      </LegalSection>
    </LegalDocument>
  )
}

import { Link } from 'react-router-dom'
import { LegalDocument, LegalSection } from '../components/LegalDocument'

const LAST_UPDATED = '26 mai 2026'

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

      <p>
        Les sections relatives aux données personnelles, aux cookies et au démarchage téléphonique sont consultables sur
        la page <Link to="/confidentialite">Politique de confidentialité</Link>.
      </p>
    </LegalDocument>
  )
}

export function FeesPage() {
  return (
    <LegalDocument
      title="Honoraires — Hamac Investissements & Patrimoine"
      metaDescription="Barème et modalités d'honoraires de l'agence Hamac Investissements & Patrimoine."
      heading="Honoraires d'agence"
      lastUpdated={LAST_UPDATED}
    >
      <p>
        Conformément à la réglementation en vigueur, {AGENCY.name} communique ses honoraires de manière transparente avant
        toute mission.
      </p>
      <p>
        Notre barème tarifaire est disponible sur notre site, ou sur simple demande par e-mail, courrier, téléphone ou
        depuis la rubrique <Link to="/contact">contact</Link>.
      </p>
      <LegalSection title="Demande de renseignements">
        <p>
          Pour obtenir le détail de nos honoraires (vente, achat, estimation) :{' '}
          <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a> — {AGENCY.phone}.
        </p>
        <p>
          {AGENCY.addressLine1}, {AGENCY.city}, {AGENCY.country}
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

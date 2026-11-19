# Tracking OTOMATE — Hamac (socle v1.4)

Le site envoie les événements avec gtag, vers le flux `VITE_GA_MEASUREMENT_ID`, uniquement après consentement analytics.
Le conteneur `GTM-NH239JGT` n'est pas chargé : sa version publiée ne contient aucune balise, et l'ajouter à côté de gtag doublerait les pages vues.
Les fichiers `gtm/` décrivent un import préparé. Ne pas le publier tant que le site envoie déjà par gtag.

## Code (src/analytics/)

| Fichier | Rôle |
|---|---|
| `config.ts` | `VITE_GA_MEASUREMENT_ID`, garde pré-rendu |
| `boot.ts` | Démarrage avant React : marquage interne, mémoire de l'arrivée, consentement |
| `gtm.ts` | Consent Mode v2 et injection unique de gtag.js. Ne charge pas GTM |
| `params.ts` | Moteur générique : schéma fermé, rejet intégral, échec sans valeur |
| `events.ts` | Registre Hamac : événements, paramètres, règles croisées. N'envoie rien |
| `track.ts` | Conditions d'envoi, validation, dédoublonnage `page_view` et `generate_lead`, émission gtag |
| `type-tests.ts` | Contrats TypeScript. Vu par `tsc --noEmit`, jamais importé par l'application |
| `url.ts` | Nettoyage de `page_location` / `page_referrer`, communes de confiance, champs `campaign_*` (acceptation tardive) |
| `internalTraffic.ts` | `?otomate_internal=on|off` → `traffic_type=internal` |
| `pageType.ts` | Route → `page_type` |
| `cookies.ts` | Purge `_ga*` |

Le code appelle `gtag('consent', …)` et charge `gtag.js` après acceptation. Il ne charge pas `gtm.js`.

## Variables d'environnement

```
VITE_GA_MEASUREMENT_ID=G-KCHSLFNCBR
```

À conserver dans `.env.local` et dans Vercel. Sans cet identifiant, rien n'est chargé. Ne pas ajouter `VITE_GTM_ID`.

## Import dans GTM (container GTM-NH239JGT)

1. **Modèle** : Modèles → Modèles de balise → Nouveau → menu ⋮ → **Importer** → `gtm/otomate-consent-bridge.tpl` → Enregistrer.
2. **Container** : Admin → Importer un conteneur → `gtm/hamac-container-socle.json` → espace de travail nouveau → **Fusionner** → Remplacer les éléments en conflit.
3. **Balise Consent Bridge** (à créer à la main, une fois) :
   type « OTOMATE – Consent Bridge », déclencheur **Consent Initialization - All Pages**, dossier `00 Core`.
4. Vérifier sur chaque balise : Paramètres avancés → Consentement → **« Aucun consentement supplémentaire requis »**.
5. Ne **pas** publier avant les réglages GA4 (mesure améliorée désactivée, détection automatique désactivée, données fournies par l'utilisateur désactivées, censure des données) et les tests bloquants ci-dessous.

Ce JSON et ce modèle n'ont pas encore été importés dans GTM : un écart de format reste possible (types de déclencheur `INIT`, clé `consentSettings`). En cas d'erreur à l'import, recréer l'élément concerné à la main avec les mêmes noms.

## Tests bloquants du socle (avant tout événement P1)

| Test | Attendu |
|---|---|
| T-C6 | Sans choix, puis refus : 0 requête Google, aucun cookie `_ga` |
| T-B1 / T-C1 | Preview, Consent Initialization : Default `analytics_storage` Granted, aucun Update ; Initialization : Google tag Fired |
| T-C7 | 1 seul `gtm.js` ; 0 `collect` avant `en=page_view` |
| T-CS1 / T-CS2 | Contrôles intégrés visibles, aucun contrôle supplémentaire ; 100 % des balises avec la condition `JS - otomate analytics granted` |
| T-PV1 à T-PV4 | Aucun `page_view` automatique ni lié à l'historique |
| T-RV1 à T-RV6 | Révocation : classement des requêtes par instant de création (`T_init`), variantes VR-1 / VR-2 / VR-3 |
| T-DL1 à T-DL4 | Remise à zéro de `event_params` dans le vrai container |
| T-A1 | Acceptation tardive : `campaign_*` sur le premier `page_view`, `dl` sans UTM |

Réglages de test (développement uniquement, `npm run dev`) :
- `localStorage.otomate_revoke_variant = 'VR-2' | 'VR-3'` : variante de révocation mesurée ;
- `localStorage.otomate_revoke_no_reload = '1'` : révocation sans rechargement (isolement T-RV1 / T-RV2) ;
- la console affiche `[otomate] R1 <timestamp>` au début de la révocation.

## Registre des événements

Le registre vit dans `src/analytics/events.ts`. Il décrit les événements autorisés. Il ne les émet pas.

Aujourd'hui, seule la vue de page part vers le dataLayer, via `trackPageView`. Les douze autres événements sont prêts dans le schéma et ne sont branchés sur aucune page. Leur activation attend un alignement GTM distinct.

| Événement | Obligatoire | Facultatif |
|---|---|---|
| `page_view` | — | — |
| `property_view` | `property_ref`, `property_type`, `listing_kind` | `city` |
| `property_search` | `listing_kind`, `results_count` | `property_type`, `city`, `budget_max`, `surface_min`, `bedrooms_min`, `sort`, `view` |
| `property_filter` | `filter_axis` | le compagnon du même axe, décrit plus bas |
| `no_search_results` | `listing_kind`, `results_count` exactement `0` | mêmes clés facultatives que `property_search` |
| `contact_submit` | `form` = `contact` | — |
| `property_inquiry_submit` | `form` = `bien`, `property_ref` | — |
| `estimate_submit` | `form` = `estimation`, `property_type`, `surface` | `city`, `rooms` |
| `offmarket_submit` | `form` = `offmarket` | `property_type`, `sector` |
| `phone_click` | `cta`, `page_type` | — |
| `email_click` | `cta`, `page_type` | — |
| `form_error` | `form`, `error_code` | — |
| `generate_lead` | `form` | — |

`generate_lead` ne porte pas de `property_ref`. Les formulaires l'envoient, avec seulement `form`, après une réponse réussie du service. Un échec classé envoie `form_error` avec le code, jamais le message.

Valeurs fermées :

- `property_ref` : `^[a-z0-9-]{1,60}$`. Les références Apimo actuelles, numériques sur 7 ou 8 chiffres, passent. Une chaîne d'au moins 9 chiffres est refusée ensuite par `looksPersonal`.
- `property_type` catalogue : `maison`, `appartement`, `terrain`, `commerce`, `bureau`, `garage`, `immeuble`.
- Estimation : `maison`, `appartement`, `terrain` seulement. `surface` est un entier de 0 à 9999. `rooms` est un entier de 1 à 7.
- Off-market : `property_type` vaut `Maison`, `Appartement` ou `Les deux`. `sector` vaut l'une des six communes ou `Tout l'Ouest Lyonnais`. Ce n'est pas le paramètre `city`. Le budget off-market n'est pas dans le schéma.
- `listing_kind` : `sale` ou `rent`.
- `form` : `contact`, `bien`, `estimation`, `offmarket`. Chaque événement de formulaire ne retient que le sien, sauf `form_error` et `generate_lead`, qui acceptent les quatre.
- `error_code` : `turnstile`, `rate_limited`, `invalid`, `network`, `server`.
- `page_type` : les seize valeurs de `pageType.ts` (`home`, `listing_sale`, `listing_rent`, `property`, `estimate`, `contact`, `offmarket`, `selling`, `invest`, `agency`, `neighborhood_index`, `neighborhood`, `blog_index`, `blog_post`, `legal`, `not_found`).
- `cta` téléphone : `nav_phone`, `footer_phone`, `contact_phone`, `property_phone`, `property_mobile_phone`, `listing_phone`, `neighborhood_phone`, `legal_phone`.
- `cta` e-mail : `footer_email`, `contact_email`, `property_email`, `legal_email`. Ce sont des jetons, jamais une adresse.
- `budget_max` : plafonds préfixés, jamais un montant saisi. Vente : `sale_to_300000`, `sale_to_500000`, `sale_to_750000`, `sale_to_1000000`, `sale_to_1500000`, `sale_to_2000000`, `sale_to_3000000`. Location : `rent_to_800`, `rent_to_1200`, `rent_to_1500`, `rent_to_2000`, `rent_to_2500`, `rent_to_3000`, `rent_to_4000`. Au-dessus du dernier plafond, l'appelant omet `budget_max`.
- `surface_min` : chaînes `10`, `20`, … `300`.
- `bedrooms_min` : entier de 1 à 4. C'est le critère `rooms` de l'URL catalogue, qui désigne des chambres.
- `sort` : `recent`, `price-asc`, `price-desc`, `surface`.
- `view` : `map` ou `list`.
- `results_count` de `property_search` : entier de 0 à 500. `no_search_results` n'accepte que `0`.
- `city` : uniquement un libellé canonique parmi Sainte-Foy-lès-Lyon, Tassin-la-Demi-Lune, Écully, Francheville, Craponne, Oullins.

`property_filter` transmet exactement un axe et, sauf exception, son compagnon du même nom :

| `filter_axis` | Compagnon |
|---|---|
| `property_type` | `property_type` |
| `city` | `city`, ou aucun compagnon |
| `budget_max` | `budget_max` |
| `surface_min` | `surface_min` |
| `bedrooms_min` | `bedrooms_min` |
| `sort` | `sort` |
| `view` | `view` |

Pour l'axe `city`, une commune canonique part avec l'axe. Une commune inconnue, ambiguë ou absente après préparation laisse l'événement `{ filter_axis: 'city' }` sans `city`. Un autre compagnon sur cet axe est incohérent. Les autres axes exigent exactement leur compagnon.

Hors schéma, et donc refusés : texte libre, nom, adresse e-mail, téléphone, message, adresse postale, montant exact, `budget_min`, rayon, équipements, chambres ou terrain de l'estimation.

## Validation et rejet

`track()` suit cet ordre.

1. `canTrack()` est faux : retour `false`, aucun push, aucun journal.
2. `validateEvent` prépare `city`, puis vérifie le schéma, les clés obligatoires et les règles croisées.
3. `looksPersonal` relit les chaînes déjà acceptées. Un `@`, un e-mail, un téléphone français, neuf chiffres ou plus, ou un condensat hexadécimal d'au moins 32 caractères rejette l'événement entier.
4. Sinon les deux pushes partent et `track()` renvoie `true`.

Le rejet est intégral. Une clé inconnue ou une valeur invalide ne sont pas retirées pour laisser passer le reste. `sanitizeParams` n'existe plus.

`city` est un cas à part, avant le schéma, et seulement pour `property_view`, `property_search`, `property_filter`, `no_search_results` et `estimate_submit`. Une commune reconnue est remplacée par son libellé canonique. Une commune inconnue, vide, nulle, multiple, `hors_liste` ou contenant `…` est omise et l'événement continue. Un nombre ou un objet à la place de `city` reste en place et le schéma le refuse. La chaîne brute n'est jamais transmise.

Règles croisées, après le schéma :

- `property_filter` : cohérence axe / compagnon, avec l'exception `city` ci-dessus.
- `no_search_results` : `results_count` vaut `0`.
- `property_search` et `no_search_results` : si `budget_max` et `listing_kind` sont tous les deux présents, le préfixe doit correspondre (`sale_to_` avec `sale`, `rent_to_` avec `rent`).

Motifs techniques, sans valeur associée : `not_object`, `unexpected_key`, `symbol_key`, `accessor`, `invalid_type`, `invalid_value`, `out_of_range`, `resolver_rejected`, `missing_key`, `inconsistent`, `personal`.

Le moteur ne parcourt que les clés du schéma pour décider quoi transmettre. Une clé inconnue, un symbole, un accesseur ou un objet qui n'est pas un simple objet rejettent l'ensemble. Il n'y a pas de conversion entre chaîne, nombre et booléen.

## Consentement et conditions d'envoi

`canTrack()` est vrai seulement si les quatre conditions le sont :

- le suivi n'est pas en cours de révocation ;
- GTM a été injecté sur cette page ;
- `trackingConfigured()` est vrai : navigateur, pas de pré-rendu (`window.__PRERENDER__`), identifiant GTM au format `GTM-` suivi de lettres et de chiffres ;
- le consentement analytics est accordé.

Sans ces conditions, l'événement est abandonné. Il n'est pas mis en file. Le refus de consentement remet `lastPageViewRoute` à vide, pour qu'une acceptation ultérieure sur la même page puisse renvoyer la vue.

`trackPageView` mémorise la route seulement si `track('page_view', {})` renvoie `true`. Un second appel pour la même route ne renvoie pas la vue. Un `page_view` refusé par `track()` ne marque pas la route.

## Contrat dataLayer

Un envoi réussi de `track()` produit exactement deux pushes, dans cet ordre :

```js
dataLayer.push({ event_params: null })
dataLayer.push({ event, event_params: params })
```

`params` ne contient que les clés validées. `otomate_context` n'est pas dans ces deux pushes. Il part séparément : avant le marqueur `gtm.js`, et dans `trackPageView` juste avant `track('page_view', {})`.

Une vue de page acceptée ressemble donc à : contexte, puis remise à `null`, puis `page_view` avec `event_params` vide. Le second appel de la même route n'ajoute rien.

## Journal de rejet en développement

En développement, un rejet de validation ou de `looksPersonal` écrit :

```text
[otomate] rejet <événement> <motif>
```

Trois arguments, tous fermés : le préfixe, un nom présent dans `EVENT_SCHEMAS`, un motif de la liste ci-dessus. Les clés et les valeurs ne sont pas journalisées. Un nom d'événement inconnu ou un motif hors liste ne sont pas recopiés.

`import.meta.env.DEV` est faux dans un build de production : cet appel n'y figure plus. L'absence de consentement et le pré-rendu ne produisent pas ce journal.

`[otomate] R1` reste le journal de révocation, distinct de celui des rejets.

## TypeScript et exécution

Les deux contrôles ne se remplacent pas.

TypeScript, dans `EventParams` et dans `src/analytics/type-tests.ts`, refuse à la compilation une clé obligatoire absente, un littéral hors liste, un mauvais compagnon de filtre, un `results_count` autre que `0` pour `no_search_results`, ou une clé connue en trop sur un objet qui a déjà des propriétés. `type-tests.ts` n'est pas importé : il ne s'exécute pas.

L'exécution, dans `validateEvent`, `looksPersonal` et `track()`, décide de l'envoi. Elle seule applique les bornes numériques, le motif de référence, la préparation de `city`, l'accord budget / transaction, et le rejet d'une valeur personnelle déjà conforme au schéma.

Limite de typage : `EventParams<'page_view'>` est `{}`. Une clé libre sur cet objet ne produit pas d'erreur d'excès. `validateEvent` la refuse quand même, avec le motif `unexpected_key`.

## Ajouter un événement

1. Décrire le schéma et les clés obligatoires dans `events.ts`.
2. Laisser `EventParams` en déduire le contrat, avec une règle croisée seulement si les clés ne suffisent pas.
3. Ajouter un cas positif et un `@ts-expect-error` dans `type-tests.ts`.
4. Ne pas appeler `track()` depuis une page tant que l'activation n'est pas décidée. L'alignement du container GTM se fait à ce moment-là, pas dans le registre.

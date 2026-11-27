# Tracking OTOMATE — Hamac (socle v1.4)

Le site envoie les événements avec gtag, vers le flux `VITE_GA_MEASUREMENT_ID`, uniquement après consentement analytics.
Le conteneur `GTM-NH239JGT` n'est pas chargé : sa version publiée ne contient aucune balise, et l'ajouter à côté de gtag doublerait les pages vues.
Les fichiers `gtm/` sont archivés et ne doivent pas être importés tant que le site envoie par gtag.

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

## Fichiers `gtm/` (archivés)

`gtm/hamac-container-socle.json` et `gtm/otomate-consent-bridge.tpl` décrivent un ancien projet d'import dans le conteneur GTM. Ils ne sont pas utilisés : le site n'injecte ni `gtm.js` ni conteneur. Ne pas les importer ni publier de balise GA4 dans GTM tant que le site envoie par gtag, sinon chaque événement partirait deux fois.

## Contrôles

`node scripts/check-published-tracking.mjs [dist|https://hamacpatrimoine.com/fr/]` lit le HTML et le JavaScript publiés, sans rien envoyer. Il échoue si `gtm.js` ou un identifiant `GTM-` apparaît, si le flux GA4 manque ou si un événement attendu est absent du bundle.

Contrôles manuels (Tag Assistant ou GA4 DebugView, en trafic interne : `?otomate_internal=on`) :

| Contrôle | Attendu |
|---|---|
| Sans choix, puis refus | 0 requête vers Google, aucun cookie `_ga` |
| Acceptation | `gtag/js` chargé une seule fois, aucun `gtm.js`, 1 `page_view` pour la page courante |
| Navigation interne, rechargement, retour | 1 `page_view` par changement de chemin, aucun `page_view` automatique de GA4 |
| Révocation | consentement `denied`, cookies `_ga*` purgés, rechargement, plus aucune requête |
| Acceptation tardive | champs `campaign_*` sur le premier `page_view`, `page_location` sans UTM |
| Formulaire envoyé | 1 événement de formulaire et 1 `generate_lead` |

## Registre des événements

Le registre vit dans `src/analytics/events.ts`. Il décrit les événements autorisés. Il ne les émet pas.

Les treize événements sont branchés et partent par `gtag('event', …)` : `page_view` via `trackPageView` (`Analytics.tsx`), les clics téléphone et e-mail, les filtres, la recherche et l'absence de résultats du catalogue, la vue d'une fiche, les quatre formulaires, `generate_lead` et `form_error` (`forms.ts`).

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

1. `canTrack()` est faux : retour `false`, aucun envoi, aucun journal.
2. `validateEvent` prépare `city`, puis vérifie le schéma, les clés obligatoires et les règles croisées.
3. `looksPersonal` relit les chaînes déjà acceptées. Un `@`, un e-mail, un téléphone français, neuf chiffres ou plus, ou un condensat hexadécimal d'au moins 32 caractères rejette l'événement entier.
4. `generate_lead` est ignoré s'il arrive une seconde fois pour le même formulaire en moins de 1,5 s (`lead-dedup.ts`).
5. Sinon l'événement part par gtag et `track()` renvoie `true`.

Le rejet est intégral. Une clé inconnue ou une valeur invalide ne sont pas retirées pour laisser passer le reste. `sanitizeParams` n'existe plus.

`city` est un cas à part, avant le schéma, et seulement pour `property_view`, `property_search`, `property_filter`, `no_search_results` et `estimate_submit`. Une commune reconnue est remplacée par son libellé canonique. Une commune inconnue, vide, nulle, multiple, `hors_liste` ou contenant `…` est omise et l'événement continue. Un nombre ou un objet à la place de `city` reste en place et le schéma le refuse. La chaîne brute n'est jamais transmise.

Règles croisées, après le schéma :

- `property_filter` : cohérence axe / compagnon, avec l'exception `city` ci-dessus.
- `no_search_results` : `results_count` vaut `0`.
- `property_search` et `no_search_results` : si `budget_max` et `listing_kind` sont tous les deux présents, le préfixe doit correspondre (`sale_to_` avec `sale`, `rent_to_` avec `rent`).

Motifs techniques, sans valeur associée : `not_object`, `unexpected_key`, `symbol_key`, `accessor`, `invalid_type`, `invalid_value`, `out_of_range`, `resolver_rejected`, `missing_key`, `inconsistent`, `personal`.

Le moteur ne parcourt que les clés du schéma pour décider quoi transmettre. Une clé inconnue, un symbole, un accesseur ou un objet qui n'est pas un simple objet rejettent l'ensemble. Il n'y a pas de conversion entre chaîne, nombre et booléen.

## Consentement et conditions d'envoi

`canTrack()` est vrai seulement si les conditions suivantes le sont :

- le suivi n'est pas en cours de révocation ;
- `grant()` a configuré gtag sur cette page, sans conteneur GTM ;
- `trackingConfigured()` est vrai : navigateur, pas de pré-rendu (`window.__PRERENDER__`), identifiant GA4 au format `G-` suivi de lettres et de chiffres ;
- le consentement analytics est accordé.

Sans ces conditions, l'événement est abandonné. Il n'est pas mis en file. Le refus de consentement remet `lastPageViewRoute` à vide, pour qu'une acceptation ultérieure sur la même page puisse renvoyer la vue.

`trackPageView` mémorise la route seulement si `track('page_view', {})` renvoie `true`. Un second appel pour la même route ne renvoie pas la vue. Un `page_view` refusé par `track()` ne marque pas la route.

## Contrat d'envoi gtag

Un envoi réussi de `track()` produit exactement un appel :

```js
gtag('event', event, { ...params, tracking_version: 'otomate-1.4', send_to: GA_MEASUREMENT_ID })
```

`params` ne contient que les clés validées. `traffic_type: 'internal'` s'ajoute quand le trafic est marqué interne. Les clés de valeur `undefined` sont retirées.

Pour `page_view`, `track()` ajoute `page_path`, `page_location` et `page_referrer` nettoyés (`url.ts`), et `page_type` quand la route est connue. gtag est configuré avec `send_page_view: false` : GA4 n'envoie aucune vue automatique.

Le site n'utilise pas d'objet `event_params` ni de remise à `null`. `window.dataLayer` sert seulement de file interne au snippet gtag.

## Journal de rejet en développement

En développement, un rejet de validation ou de `looksPersonal` écrit :

```text
[otomate] rejet <événement> <motif>
```

Trois arguments, tous fermés : le préfixe, un nom présent dans `EVENT_SCHEMAS`, un motif de la liste ci-dessus. Les clés et les valeurs ne sont pas journalisées. Un nom d'événement inconnu ou un motif hors liste ne sont pas recopiés.

`import.meta.env.DEV` est faux dans un build de production : cet appel n'y figure plus. L'absence de consentement et le pré-rendu ne produisent pas ce journal.

La révocation ne produit pas de journal : elle retire le consentement, purge les cookies `_ga*` et recharge la page.

## TypeScript et exécution

Les deux contrôles ne se remplacent pas.

TypeScript, dans `EventParams` et dans `src/analytics/type-tests.ts`, refuse à la compilation une clé obligatoire absente, un littéral hors liste, un mauvais compagnon de filtre, un `results_count` autre que `0` pour `no_search_results`, ou une clé connue en trop sur un objet qui a déjà des propriétés. `type-tests.ts` n'est pas importé : il ne s'exécute pas.

L'exécution, dans `validateEvent`, `looksPersonal` et `track()`, décide de l'envoi. Elle seule applique les bornes numériques, le motif de référence, la préparation de `city`, l'accord budget / transaction, et le rejet d'une valeur personnelle déjà conforme au schéma.

Limite de typage : `EventParams<'page_view'>` est `{}`. Une clé libre sur cet objet ne produit pas d'erreur d'excès. `validateEvent` la refuse quand même, avec le motif `unexpected_key`.

## Ajouter un événement

1. Décrire le schéma et les clés obligatoires dans `events.ts`.
2. Laisser `EventParams` en déduire le contrat, avec une règle croisée seulement si les clés ne suffisent pas.
3. Ajouter un cas positif et un `@ts-expect-error` dans `type-tests.ts`.
4. Appeler `track()` depuis la page concernée, puis ajouter le nom à `EVENTS` dans `scripts/check-published-tracking.mjs`. Aucune configuration GTM n'est nécessaire.

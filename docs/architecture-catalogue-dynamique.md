# Catalogue Hamac autonome : audit et plan technique

**Statut :** validé. Implémenté sur la branche `feat/catalogue-dynamique` (non poussée, non déployée) ; procédure dans [deploiement-catalogue-dynamique.md](deploiement-catalogue-dynamique.md).
**Date :** 25/11/2026.
**Cas réel de validation :** le bien **87634540** (garage double, Lyon 5ᵉ), publié dans Apimo après le dernier déploiement.

**Objectif :** les agents publient, modifient et retirent leurs biens uniquement dans Apimo. Le site met alors à jour, sans redéploiement ni intervention humaine, les fiches (HTML complet), les métadonnées SEO, le JSON-LD, le sitemap et les images de partage WhatsApp.

---

## 1. Audit des contraintes réelles

### 1.1 Vercel (vérifié avec le CLI `vercel`, en lecture seule)

| Point | Constat | Conséquence |
|---|---|---|
| Plan | **Hobby** (équipe `oToMate22`) | Vercel réserve Hobby à un **usage personnel et non commercial** ; tout usage commercial exige Pro ou Enterprise (selon ses fair use guidelines). Le site d'une agence immobilière cliente est commercial. **Passer en Pro est nécessaire indépendamment de l'option B.** |
| Région des fonctions | `iad1` (Virginie, par défaut) | À déplacer vers `dub1` (Dublin), à côté de Supabase (eu-west-1, Irlande). |
| Crons | Hobby : 1 exécution par jour maximum | La planification ne doit pas reposer sur Vercel Cron (voir 1.2). |
| Fonctions | 300 s maximum, 2 Go de mémoire (Hobby) ; Pro jusqu'à 800 s et 4 Go | Largement suffisant : rendu d'environ 15 ms, image d'environ 1 s. |
| Cache CDN | `@vercel/functions` 3.9.11 est déjà installé et expose `addCacheTag`, `invalidateByTag`, `dangerouslyDeleteByTag`, `getCache` et `waitUntil` | Invalidation ciblée possible par bien, sans redéploiement. |
| Quotas Hobby | 1 M d'invocations de fonction, 4 h de CPU actif, 100 Go de transfert par mois | Aucun ne serait atteint (voir §1.5). |

### 1.2 Supabase (vérifié avec le CLI `supabase`, en lecture seule)

- Projet `hamac-investissements` (`lxkhoz…`), région **West EU (Irlande)**, dans l'organisation « Otomate.Org ».
- Fonctions Edge actives : `apimo-proxy`, `submit-form`, `notify-lead`, `dashboard-metrics`.
- `pg_net` est **déjà utilisé** (notification des formulaires).
- `pg_cron` **n'est pas activé**, comme l'indique un commentaire de la migration `20261116120000`.
- **Plan : non lisible via le CLI.** Indice : l'organisation compte **3 projets** alors que la formule gratuite limite à 2 projets actifs, ce qui suggère Pro. **À confirmer dans Dashboard → Billing.**
- Quotas publiés (supabase.com/pricing) :
  - Free : 500 000 invocations Edge, 1 Go de stockage, 5 Go d'egress, mise en pause après une semaine d'inactivité, pas de transformation d'image.
  - Pro (25 $ par mois) : 2 M d'invocations Edge puis 2 $ par million, 100 Go de stockage, 250 Go d'egress.

### 1.3 Apimo

- **Webhooks :** aucune mention dans la documentation publique (apimo.com/api/webservice). La documentation technique n'est pas publique. **Question à poser au support Apimo.**
- **Limites d'API :** non publiées. Le code gère déjà des réponses **429** (`apimo-proxy`, `collect-routes.ts`, message « Quota Apimo atteint » côté client), ce qui signifie que le quota a déjà été atteint. **À obtenir auprès d'Apimo :** quota par jour et par minute, et existence d'un filtre « modifié depuis ».
- **Détection de changement disponible dès maintenant :**
  - chaque bien expose `updated_at` (par exemple `2026-11-25 16:07:22` pour 87634540), ainsi que `pictures[].url`, `rank` et `internet` ;
  - les URL `media.apimo.pro/cache/<md5>_…-original.jpg` changent quand la photo change ;
  - une interrogation périodique du catalogue suffit donc à tout détecter.
- **Coût d'une interrogation :** le catalogue est paginé par 100 (`PAGE_SIZE`). Cela fait 2 appels Apimo pour 122 biens, 5 pour 500 et 10 pour 1 000.
- **Latences mesurées via `apimo-proxy` :**
  - catalogue complet : 315 ms ;
  - un bien à froid : 1,3 s ;
  - un bien en cache : 95 ms.
- **Photos :** `media.apimo.pro` sert les originaux (jusqu'à 4096 px et 2,2 Mo) et son `robots.txt` contient `Disallow: /`. Les aperçus doivent donc être servis depuis notre domaine (déjà le cas avec le chantier Open Graph).

### 1.4 Comportement actuel entre deux déploiements (vérifié en production)

| Cas | Robots (WhatsApp, Google) | Internaute |
|---|---|---|
| Nouveau bien (87634540) | `<head>` de l'**accueil** : titre générique, image Hamac, `og:url` et **canonical vers `/fr/`**, code 200 | Fiche affichée après le JavaScript |
| Modification | Ancien titre, ancienne description et ancienne image jusqu'au build | Données à jour (cache de 5 min) |
| Retrait | Page pré-rendue toujours servie en 200 | Redirection vers `/acheter` par le JavaScript |
| Identifiant inexistant | Shell en 200 indexable (« soft 404 ») | « Bien introuvable » |
| Pages catalogue `/acheter`, `/louer` | **0 lien vers les fiches** dans le HTML pré-rendu | Liste chargée par le JavaScript |
| Sitemap | Figé au build | — |

### 1.5 Coûts estimés

**Hypothèses :**
- trafic de 20 à 50 vues par bien et par mois, plus les robots ;
- environ 2 modifications par bien et par mois ;
- une synchronisation toutes les 5 minutes, soit 8 640 par mois.

| Poste | 100 biens | 500 biens | 1 000 biens |
|---|---|---|---|
| Appels Apimo de la synchronisation (pages de 100) | 8 640 / mois | 43 200 / mois | 86 400 / mois |
| Invocations Edge Supabase (synchronisation et flux) | environ 15 k | environ 25 k | environ 40 k |
| Invocations de fonctions Vercel (défauts de cache CDN) | inférieures à 10 k | environ 30 k | environ 60 k |
| Générations d'image (créations et changements de photo) | environ 200 / mois | environ 1 000 | environ 2 000 |
| CPU actif Vercel (rendu d'environ 15 ms, image d'environ 1 s) | moins de 0,2 h | environ 0,4 h | environ 0,8 h |
| Stockage des images (environ 150 Ko, versions sur 30 jours) | environ 30 Mo | environ 150 Mo | environ 300 Mo |
| **Surcoût d'usage** | **≈ 0 €** | **≈ 0 €** | **≈ 0 à 2 € par mois** |

- **Coût fixe :** **Vercel Pro à 20 $ par mois et par développeur**, requis de toute façon pour un usage commercial. Les 20 $ de crédit inclus couvrent tout l'usage ci-dessus.
- **Supabase :** aucun surcoût si l'organisation est déjà en Pro. En Free, tout tient dans les quotas, mais la mise en pause après inactivité et l'absence de garantie de service sont inadaptées à la production.
- **Principal risque de coût :** le **quota Apimo** (inconnu), plus que l'argent. Si le quota est bas, on espace la synchronisation à 10 ou 15 minutes, ou on utilise le filtre « modifié depuis » s'il existe.

---

## 2. Préserver le SEO : HTML complet rendu côté serveur

### 2.1 Résultat du prototype (local, hors dépôt)

J'ai rendu la fiche avec les **composants React existants, sans aucune modification** (`App`, `SiteLayout`, `PropertyDetailPage`). Méthode : `renderToString` avec `StaticRouter` et le bien transmis par `location.state`, le mécanisme `routeSeed` déjà présent dans `PropertyDetailPage`.

- **87604875 :** texte de la page **identique à 99,9 %** à la page pré-rendue par Chromium (1 896 contre 1 898 caractères), même `<h1>`, rendu en **12 ms**.
- **87634540 (pas encore sur le site) :** rendu complet en 16 ms. On y trouve la description, le prix, 7 images, le formulaire et le pied de page, sans l'écran « Chargement… ».
- **Pas de risque d'hydratation :** `src/main.ts` vide le `<body>` puis appelle `createRoot` (pas `hydrateRoot`). Le comportement est donc **identique à celui d'aujourd'hui** avec Chromium : même design, même expérience, même amorçage du tracking.

Il n'y a donc ni migration de framework ni refonte : on remplace Chromium par `renderToString` pour les fiches seulement.

### 2.2 Garanties SEO

- **Contenu sans JavaScript :** le HTML complet est rendu côté serveur, comme le pré-rendu actuel.
- **Canonical :** `https://hamacpatrimoine.com/fr/{acheter|louer}/{id}`, calculé à partir du type réel du bien. Une rubrique erronée (vente au lieu de location, ou l'inverse) reçoit une redirection 308 vers la bonne.
- **JSON-LD :** `listingJsonLd` et `breadcrumbJsonLd` sont produits à chaque rendu à partir de l'état courant du bien.
- **Sitemap dynamique :** `/fr/sitemap.xml` est généré par une fonction à partir de l'instantané des biens actifs, plus les pages statiques. `lastmod` vaut `updated_at` d'Apimo. Il est mis en cache et invalidé à chaque changement de catalogue.
- **Codes HTTP :** 200 pour un bien actif, **410** pour un bien retiré, **404** pour un identifiant jamais vu, **503** avec `Retry-After` en cas de panne (voir §5).
- **URL historiques :** `src/proxy.ts`, les 42 redirections de `vercel.json` et `/fr/propriete/...` sont conservés. `proxy.ts` lit aujourd'hui `data/apimo-routes.json`, figé au build ; il lira l'index dynamique, mis en cache.
- **Amélioration optionnelle :** rendre `/acheter` et `/louer` côté serveur avec les liens vers les fiches, qui sont absents aujourd'hui. Le maillage interne serait réel pour Google.

---

## 3. Architecture cible

```
Apimo ──(API)──► Supabase Edge « apimo-proxy » (existant, cache 5 min)
                       ▲
   pg_cron (5 min) ──► Supabase Edge « catalog-sync » (NOUVEAU)
                         • lit le catalogue complet (refresh forcé)
                         • compare avec la table listing_snapshots (dernière version valide)
                         • nouveau / modifié / retiré / anomalie
                         • déclenche le préchauffage : POST signé → Vercel /api/og/render
                         • stocke l'image renvoyée dans Storage « og-listings »
                         • demande l'invalidation CDN : POST signé → Vercel /api/revalidate
                         • alerte en cas d'échecs persistants (Resend, déjà configuré)
                       │
   Supabase Edge « listing-feed » (NOUVEAU, lecture seule)
                         • GET index (id, type, statut, updated_at, hash photo)
                         • GET bien {id} (dernier instantané valide, repli en direct via apimo-proxy)
                       ▲ secret dédié (pas de service_role dans Vercel)
Vercel (région dub1)
   /fr/acheter/:id, /fr/louer/:id ─► fonction « listing-page » (SSR React + head + JSON-LD)
   /fr/og/listings/:id-:hash.jpg ──► fonction « og-image » (Storage → sinon génération Sharp)
   /fr/sitemap.xml ────────────────► fonction « sitemap »
   le reste du site ───────────────► statique pré-rendu (inchangé)
```

### 3.1 Table `listing_snapshots` (Supabase, nouvelle)

| Colonne | Rôle |
|---|---|
| `id` (pk), `kind` (`acheter` ou `louer`) | Identité et rubrique |
| `status` | `active`, `withdrawn` ou `pending_withdrawal` |
| `payload` (jsonb) | **Dernière version valide** du bien Apimo |
| `updated_at_apimo`, `photo_source_url`, `og_hash`, `og_status` | Détection des changements et de l'état de l'image |
| `first_seen_at`, `last_seen_at`, `missing_runs`, `withdrawn_at` | Gestion des retraits |

La table est sous RLS, sans accès anonyme. Seules les fonctions Edge y accèdent, avec la clé de service qui **reste à l'intérieur de Supabase**.

### 3.2 Table `catalog_sync_runs`

Elle journalise chaque synchronisation : heure, durée, nombre de biens, pages, erreurs, codes Apimo. Elle sert aux alertes et au **futur dashboard OTOMATE**, sur le modèle de `dashboard-metrics`.

---

## 4. Images de partage

On réutilise `scripts/og-images.ts` (génération, validation, repli sur les photos suivantes, contrôle d'image blanche) et ses 12 tests, extraits dans un module partagé par le build et la fonction Vercel.

- **Nommage versionné calculable à l'avance :** `og_hash` est l'empreinte de l'URL source Apimo et de la version du générateur. L'URL `/fr/og/listings/{id}-{og_hash}.jpg` est connue avant que l'image existe, et elle change quand la photo change.
- **Stockage persistant :** bucket Supabase **`og-listings`**, en lecture publique. L'écriture passe uniquement par `catalog-sync`. Vercel ne détient aucun droit d'écriture.
- **Génération :**
  - en temps normal, `catalog-sync` détecte le bien et appelle `POST /api/og/render`, signé HMAC, avec `id` et `og_hash` ;
  - Vercel génère l'image (Sharp, Node) et renvoie le JPEG ;
  - `catalog-sync` le valide (taille et type) et l'enregistre ;
  - les fonctions Edge Supabase (Deno) ne peuvent pas exécuter Sharp, d'où ce partage des rôles.
- **Préchauffage indépendant des visites :** chaque bien nouveau ou modifié est traité au plus 5 minutes après son apparition dans Apimo, que quelqu'un consulte la fiche ou non.
- **Premier partage d'un bien très récent (avant la synchronisation) :**
  - `listing-page` lit le bien en direct (`apimo-proxy`, `properties/{id}`) et rend la page normalement ;
  - `og-image` ne trouve pas l'image dans Storage et la **génère à la volée** avec un budget de 4 s ;
  - au-delà de ce budget ou en cas d'échec, elle renvoie l'**image Hamac par défaut 1200×630**, avec un cache court (60 s), puis la synchronisation produit l'image définitive ;
  - un partage n'est donc jamais blanc ni vide ; au pire, il montre l'image Hamac pendant moins de 5 minutes.
- **Déduplication :**
  - une seule génération à la fois par `(id, og_hash)`, grâce à un verrou dans la synchronisation et à une carte des générations en cours dans la fonction ;
  - les noms sont déterministes, donc deux écritures concurrentes produisent le même objet ;
  - le CDN met en cache un an (URL immuable).
- **Nettoyage :** un job quotidien supprime les objets dont le hash n'est plus le hash courant d'un bien actif **depuis plus de 30 jours**. Ce délai couvre les aperçus WhatsApp déjà envoyés.
- **Image de secours :** `hamac-og-1200x630.jpg`, toujours valide et servie en cas d'échec. L'**ancienne image valide** reste utilisée tant que la nouvelle n'a pas été générée.

---

## 5. Sécurité

- **Pas de `service_role` dans Vercel :**
  - Vercel ne lit que via `listing-feed`, une fonction en lecture seule, avec un secret dédié et révocable (`LISTING_FEED_TOKEN`), sur un périmètre limité à l'index et aux biens ;
  - Vercel n'écrit nulle part ;
  - les appels de Supabase vers Vercel (`/api/og/render`, `/api/revalidate`) sont signés en **HMAC SHA-256**, avec horodatage (fenêtre de 5 min, contre le rejeu) et un secret distinct.
- **Identifiants arbitraires :**
  - format strict `^\d{5,12}$`, vérifié contre l'index mis en cache ;
  - un identifiant inconnu donne un 404 mis en cache 5 minutes, **sans appel à Apimo** ;
  - le repli « en direct » n'est tenté que pour les identifiants plus récents que le plus grand identifiant connu, avec une limite d'1 appel par minute et par identifiant.
- **SSRF :**
  - aucune URL n'est acceptée en paramètre ;
  - l'URL source est relue dans l'instantané ;
  - téléchargement uniquement depuis `https://media.apimo.pro`, avec taille maximale de 15 Mo, timeout, contrôle du type `image/*` et `limitInputPixels` de Sharp.
- **Génération incontrôlée :**
  - génération seulement si `og_hash` correspond au hash courant du bien (sinon 404 ou redirection vers l'URL courante) ;
  - au plus 2 générations concurrentes par instance ;
  - les URL sont immuables et mises en cache.
- **Abus et requêtes répétées :**
  - règle de limitation de débit du pare-feu Vercel (WAF) sur `/fr/og/*` et `/api/*`, à paramétrer selon le plan ;
  - les endpoints internes refusent toute requête non signée.
- **Clés existantes :** l'anon key reste exposée côté navigateur, comme aujourd'hui. Aucun changement pour `submit-form` et la CMP.

---

## 6. Cache, délais et résilience

### 6.1 Délai maximal d'actualisation

| Maillon | TTL |
|---|---|
| Intervalle de synchronisation (`pg_cron`) | 5 min |
| Cache de `apimo-proxy` | 5 min, **contourné** (la synchronisation force `refresh`) |
| Invalidation CDN Vercel (`invalidateByTag` par bien) | quelques secondes, à mesurer en Preview |
| TTL CDN de sécurité (`s-maxage`), si l'invalidation échoue | 1 h, plus `stale-while-revalidate` de 7 jours |

- **Délai nominal :** 5 min au plus, plus la durée de la synchronisation (moins d'1 min), soit **moins de 6 min** de la publication Apimo à la fiche, au sitemap et à l'image.
- **Pire cas** (invalidation CDN en échec) : **5 min + 1 h**.
- **Sans invalidation par tag** (si elle n'est pas disponible sur le plan) : `s-maxage` de 300 s, soit environ 10 min au pire.
- **Côté navigateur :** inchangé (cache local du catalogue).

### 6.2 Distinguer les situations

| Situation | Détection | Réponse |
|---|---|---|
| **Bien retiré** | Absent d'un catalogue **complet et cohérent** (toutes les pages lues, total conforme, baisse de moins de 20 % par rapport au run précédent) sur **2 synchronisations consécutives** | 410 en `noindex` avec la page « Ce bien n'est plus disponible » et des liens vers des biens similaires, retrait du sitemap |
| **Identifiant inexistant** | Jamais vu dans `listing_snapshots` | 404 en `noindex`, cache de 5 min |
| **Panne Apimo** (erreur, 429, timeout, page manquante, chute anormale du nombre de biens) | Synchronisation marquée en échec, **aucune modification d'état** | Pages servies depuis le dernier instantané valide, en 200 ; **aucun retrait** |
| **Panne Supabase** | `listing-feed` injoignable | Copie en cache CDN servie (`stale-if-error`) ; sans copie, **503** avec `Retry-After: 300`, jamais 404 ni 410 |
| **Échec de génération d'image** | Erreur dans `og-image` ou la synchronisation | Ancienne image valide, sinon image par défaut ; 3 nouvelles tentatives avec délai croissant |

Une panne temporaire ne peut donc jamais désindexer un bien : un 410 exige deux catalogues complets et cohérents où le bien est absent.

### 6.3 Alertes

Un e-mail via Resend (déjà configuré dans `notify-lead`) est envoyé à OTOMATE dans trois cas :
- plus d'1 h d'échecs de synchronisation consécutifs ;
- un bien actif sans image valide après 3 tentatives ;
- une chute de plus de 20 % du catalogue.

L'état reste aussi consultable dans `catalog_sync_runs`, pour le futur dashboard.

---

## 7. Non-régression

- **Design et expérience :** mêmes composants, même `main.ts`. Le HTML serveur est remplacé par le rendu client, exactement comme le pré-rendu actuel.
- **Formulaires, Turnstile, notifications :** inchangés (code client et `submit-form` intacts).
- **GA4, CMP, événements marketing :** inchangés.
  - `bootTracking()` s'exécute côté client comme aujourd'hui ;
  - le rendu serveur doit émettre le même `<head>` (scripts de consentement) que le shell de build ;
  - `scripts/check-published-tracking.mjs` sera exécuté sur une réponse SSR en Preview.
- **Redirections :** `vercel.json` et `proxy.ts` sont conservés ; `scripts/check-legacy-redirects.mjs` est exécuté en Preview.
- **Performances :**
  - rendu de 15 ms et réponse mise en cache sur le CDN ;
  - 1ʳᵉ requête après invalidation : environ 200 à 400 ms (feed, puis SSR) ;
  - le reste du site reste statique.
- **Dashboard OTOMATE :** les données (instantanés, runs) sont consultables en SQL ou via une Edge Function, sans dépendre d'Apimo.

---

## 8. Plan de migration progressif

### Phase 0 : prérequis (décisions, aucun code)

1. Passer Vercel en **Pro** et confirmer le plan Supabase.
2. Demander à Apimo : quotas, webhooks, filtre « modifié depuis ».
3. Valider les points d'infrastructure de la §9.

### Phase 1 : socle de données (Supabase, sans effet sur le site)

- Migration : tables `listing_snapshots` et `catalog_sync_runs` ; extension `pg_cron` ; job toutes les 5 minutes.
- Fonction Edge `catalog-sync` en mode **observation** : elle remplit les instantanés et journalise, sans rien appeler côté Vercel.
- Fonction Edge `listing-feed`, en lecture seule.
- **Validation :** une semaine de runs, puis contrôle des détections (87634540 vu comme nouveau, cohérence du nombre de biens, aucun faux retrait).

### Phase 2 : fonctions Vercel en Preview uniquement

- `src/entry-server.tsx` : `render(url, property)`, issu du prototype. Il est construit par `vite build --ssr` dans `dist-ssr/`.
- `api/listing-page.ts`, `api/og-image.ts`, `api/sitemap.ts`, `api/og-render.ts` (signé), `api/revalidate.ts` (signé).
- `scripts/og-images.ts` est déplacé dans un module partagé, `shared/og-images.ts`.
- `vercel.json` :
  - `functions.regions: ["dub1"]` ;
  - `includeFiles` pour le shell et le bundle SSR ;
  - réécritures des fiches, de `og/listings` et du sitemap vers les fonctions.
- Build : les fiches ne sont plus pré-rendues et le sitemap statique n'est plus généré. `check-og-meta` est adapté pour auditer les réponses SSR.

### Phase 3 : bascule de la synchronisation en mode actif

- `catalog-sync` appelle `og-render` et `revalidate`, et applique la gestion des retraits.

### Phase 4 : production, puis observation pendant 2 semaines

### Phase 5 : nettoyage

- Job de purge des images.
- Retrait de la génération d'images au build : elle peut rester comme amorçage initial.
- Option : rendu serveur de `/acheter` et `/louer`.

### 8.1 Fichiers et ressources concernés

| Nouveau | Modifié | Inchangé |
|---|---|---|
| `src/entry-server.tsx`, `api/*.ts` (5 fonctions), `shared/og-images.ts`, `supabase/functions/catalog-sync/`, `supabase/functions/listing-feed/`, 1 migration SQL, bucket `og-listings`, secrets `LISTING_FEED_TOKEN` et `SYNC_HMAC_SECRET` | `vercel.json`, `package.json` (build), `scripts/prerender.ts` (exclure les fiches), `src/proxy.ts` (index dynamique), `scripts/check-og-meta.ts` | Composants React, `main.ts`, tracking, CMP, `submit-form`, `notify-lead`, `apimo-proxy` |

### 8.2 Tests

**Unitaires :**
- tests Open Graph existants (12) ;
- rendu SSR d'une fiche (balises, canonical, JSON-LD, contenu) ;
- décision de statut : retiré, inexistant, panne, anomalie de comptage ;
- signature HMAC (valide, expirée, rejouée) ;
- validation des identifiants et des hash ;
- calcul de `og_hash` ;
- TTL et en-têtes de cache par cas.

**Intégration, en Preview :**
- `curl` en tant que WhatsApp, Facebook et Googlebot sur toutes les fiches de l'index ;
- vérification HTTP et des balises, et contrôle que les images sont téléchargeables et valides ;
- `check-published-tracking` et `check-legacy-redirects`.

**Scénarios simulés,** grâce à un mode « catalogue injecté » de `catalog-sync` disponible seulement en Preview (aucun bien réel modifié dans Apimo) :

| Scénario | Résultat attendu |
|---|---|
| Publication | Un identifiant ajouté au flux apparaît en moins de 6 min, avec page 200, image générée, entrée dans le sitemap et JSON-LD |
| Modification | Prix et photo principale changés : nouvelle URL d'image, page à jour, ancienne image conservée 30 jours |
| Retrait | Bien supprimé du flux : pas de 410 après une synchronisation, 410 après deux |
| Panne Apimo | 429, timeout, pages manquantes : 200 inchangé, aucun retrait, alerte au bout d'1 h |
| Panne Supabase | Feed coupé : `stale-if-error`, sinon 503 |
| Échec d'image | URL source cassée : image précédente ou image par défaut, nouvelles tentatives |

**Cas réel 87634540 :** en Preview, la page est rendue côté serveur avec son titre, sa photo dans `og:image`, son canonical et son JSON-LD, et elle apparaît dans le sitemap, sans redéploiement.

### 8.3 Rollback

- Chaque phase est réversible indépendamment.
- **Phase 2 et suivantes :**
  - « Instant Rollback » Vercel vers le déploiement précédent, qui revient au pré-rendu statique avec les images Open Graph du build ;
  - ou désactivation par variable d'environnement : `DYNAMIC_LISTINGS=0` remet le build en mode statique.
- **Phase 1 et suivantes :** désactiver le job `pg_cron` (`cron.unschedule`). Les tables et le bucket peuvent rester sans effet sur le site.

### 8.4 Critères de passage en production

- [ ] Plan Vercel Pro actif, région `dub1`, plan Supabase confirmé, quotas Apimo connus.
- [ ] 100 % des fiches de l'index en 200, avec des balises Open Graph et Twitter complètes et uniques, et une image valide de 1200×630 pesant au plus 250 Ko.
- [ ] Le texte rendu côté serveur est au moins 99 % identique au pré-rendu Chromium sur un échantillon de 10 fiches.
- [ ] Les 6 scénarios simulés sont conformes, et 87634540 est validé sans redéploiement.
- [ ] Le tracking (9 événements, gtag seul), la CMP, les formulaires et les 42 redirections sont inchangés.
- [ ] Le TTFB de la fiche servie depuis le cache CDN n'est pas plus lent que la page statique actuelle ; en défaut de cache, moins de 600 ms.
- [ ] Une semaine de synchronisation en observation sans faux retrait.
- [ ] Test WhatsApp réel (iPhone et Android) sur 87604875, 87557142 et 87634540.

---

## 9. Décisions et validations demandées

1. Passer Vercel en **Pro**.
2. Créer dans Supabase : `pg_cron`, les tables `listing_snapshots` et `catalog_sync_runs`, les fonctions Edge `catalog-sync` et `listing-feed`, et le bucket public `og-listings`.
3. Ajouter les secrets `LISTING_FEED_TOKEN` et `SYNC_HMAC_SECRET`, dans Vercel et dans Supabase.
4. Modifier `vercel.json` (régions, réécritures, fonctions) et le build (les fiches ne sont plus pré-rendues).
5. Fixer l'intervalle de synchronisation (5 min proposées), à ajuster selon le quota Apimo.
6. Choisir l'adresse e-mail des alertes.

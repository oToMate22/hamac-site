# AUDIT — Hamac Investissements & Patrimoine

**Nom de repli :** `AUDIT.md` — version 2 (audit A du code + audit B des tests réels fusionnés).
**Date :** 29/09/2026 · **Cible auditée :** `https://hamac-site.vercel.app` — **build redeployé à 17:45 GMT pendant l'audit** (commit `5a16f5b`, 17:32) · **Dépôt :** `~/hamac-site` @ **`c12ecc9`** (working tree propre, seul `AUDIT.md` n'est pas suivi). Le commit `c12ecc9` (17:50, = Prompt 2, biens fictifs) est **poussé mais pas encore déployé** à l'heure de la rédaction — voir « Revue du Prompt 2 ».

**Version 1 (audit A)** : audit du code, dépôt @ `8271387`, build en ligne du 28/09 22:03 GMT.
**Version 2 (audit B, section dédiée plus bas)** : tests réels en production — console, réseau, rendu 1440/375, filtres, carte, formulaire, 404, en-têtes. 2 problèmes critiques, 3 hauts et 3 moyens **nouveaux** ; 4 problèmes de l'audit A **corrigés** (dont DEMO-01 : corrigé dans le dépôt par `c12ecc9`, encore à confirmer après redéploiement) ; le reste **confirmé** ou **non reproduit**.
**Méthode :** build / typecheck / lint en local + mesures HTTP sur la production + navigateur réel piloté en CDP (enregistreur de console et de réseau injecté avant le JS de l'app) + Lighthouse 13.5.0 mobile + lecture du code source et du bundle servi. Sur les 3 passes Lighthouse lancées en série, **2 n'ont jamais démarré** (échec du téléchargement du paquet via `npx` : `npm error code ETIMEDOUT / network read`) — seules les passes abouties sont retenues. **Aucune écriture n'a été faite dans la base du client** (méthode détaillée dans la section B). Aucun fichier du dépôt n'a été modifié ni supprimé ; seul ce fichier a été créé puis mis à jour.

**Sommaire de ce fichier.**
- **ÉTAPE 0** — base factuelle (build, typecheck, lint) — audit A, complétée par les mesures de l'audit B.
- **DÉCISIONS D'ARCHITECTURE** — DA-1 à DA-4 ; DA-3 et DA-4 sont réglées, DA-1 et DA-2 restent à trancher.
- **TABLEAU DES PROBLÈMES (25)** — la liste fusionnée, triée par gravité.
- **DÉTAIL DES PROBLÈMES** — le détail de l'audit A (code).
- **AUDIT B — TESTS RÉELS EN PRODUCTION** — comptes rendus des tests, ce qui est confirmé, ce qui n'est pas reproduit, validation du Prompt 1, et le détail des 6 constats nouveaux.
- **CE QUI MARCHE DÉJÀ**, **CE QUE JE N'AI PAS PU VÉRIFIER**.
- **ÉTAPE 3 (version 1)** — périmée, conservée pour l'historique.
- **ÉTAPE 3 (version 2)** — **les 5 prompts à jour, à utiliser en priorité.**

---

## ÉTAPE 0 — Base factuelle (fait avant toute analyse)

| Contrôle | Commande | Résultat |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **0 erreur** ✅ |
| Build complet | `npm run build` | **EXIT=0** — 120/120 routes pré-rendues, sitemap 120 URLs ✅ |
| Lint | `grep -c eslint package.json` | **0** — aucun linter configuré (ni ESLint, ni Prettier, ni Biome) ❌ |
| Durée du build | mtime `dist/fr/index.html` 14:55 → log clos 15:13 | **~18 min** (dont ~17 min pour le passage Chromium) ⚠️ |
| Prétendu « vert » déjà en ligne | 115 URLs du sitemap crawlées | **115 empreintes sha1 distinctes, 0 page réduite** — le pré-rendu par page est bien en production ✅ |
| Lighthouse mobile | `/fr/` et `/fr/acheter` | perf **51 / 65 / 83**, a11y 96-98, best-practices 100, SEO **69-92** ❌ |

---

## DÉCISIONS D'ARCHITECTURE (conditionnent une partie des correctifs)

**DA-1 — SPA + pré-rendu Chromium au moment du build, pas de SSR.** C'est le choix structurant : *tous* les correctifs SEO dépendent de lui. Il fonctionne (115 pages avec `<head>` + corps réel), mais il couple chaque déploiement à un tiers : ~91 requêtes Apimo et 120 navigations Chrome, 18 min mesurées en local, avec un budget de 6 min côté Vercel (`scripts/prerender.ts:88`). **À trancher :** on garde le pré-rendu au build (et on rend son échec visible), ou on passe à un rendu à la demande sur les fiches (ISR / Edge) — dans ce cas `data/apimo-routes.json` et l'injection `<head>` deviennent inutiles. Tant que ce n'est pas tranché, corriger le SEO « à la main » est du travail jetable.

**DA-2 — Le domaine cible n'est pas libre : `hamacpatrimoine.com/fr/` est déjà occupé par l'ancien site.** La réponse retenue est une table de 722 redirections littérales dans `vercel.json` (< limite Vercel de 2 048). Elle est en place mais **fausse dans sa forme** (SEO-02) : écrire 722 chemins « à la main » est fragile, un middleware Edge qui extrait le `id` en fin de slug résisterait aux variantes d'encodage. **Décision à prendre** avant la bascule : table littérale corrigée (rapide, fragile) ou Edge (plus solide, une fonction à écrire).

**DA-3 — L'indexation est pilotée par une variable de build** (`INDEXABLE`, lue dans `scripts/generate-sitemap.ts:43-45`). Un oubli est muet : le site peut être parfait et invisible pendant des semaines. La détection automatique par `VERCEL_PROJECT_PRODUCTION_URL` est la bonne réponse. → **Réglé le 29/09 à 17:32 par `5a16f5b`** (« ouverture auto de robots.txt »), déployé à 17:45. **Vérifié en ligne** : `robots.txt` = `Disallow: /` aujourd'hui (correct, le domaine cible n'est pas encore `hamacpatrimoine.com`) — l'ouverture sera donc automatique lors de la bascule, sans intervention manuelle.

**DA-4 — `data/apimo-routes.json` est la source de vérité du pré-rendu, rafraîchie hors déploiement.** Conséquence directe, mesurée dans l'audit A : la production publiait **115** URLs quand un build local en produisait **120** → tout bien publié depuis le dernier `sync:routes` n'avait pas de page pré-rendue et retombait sur la coquille (SEO-04). → **Réglé le 29/09 à 17:32 par `5a16f5b`** : le sitemap en ligne sert maintenant **120 URLs**. Reste à décider de la fraîcheur acceptable (cron ? action à chaque mise en vente ?) — un bien mis en vente aujourd'hui n'aura toujours pas de page avant le prochain `sync:routes` + déploiement.

---

## TABLEAU DES PROBLÈMES (25) — version fusionnée A + B

Tri : gravité, puis architecture/bugs > sécurité > API/données > performance > SEO > UX/responsive > finitions.

La colonne **Audit** dit d'où vient le constat (`A` = lecture du code le 28/09, `B` = tests réels le 29/09). La colonne **Statut** dit ce que les tests réels ont donné : **`confirmé en réel`**, **`non reproduit`** (le défaut reste au rapport), **`corrigé`**, **`nouveau`**, ou `constaté` (établi par le code, non observable depuis l'extérieur — il est conservé tel quel). Les constats « moyens » et « bas » non testables en réel (dette, cache d'actifs) restent ceux de l'audit A.

| ID | Gravité | Audit | Statut | Preuve courte | Problème |
|---|---|---|---|---|---|
| **DEMO-01** | **critique** | A+B | **confirmé en ligne le 29/09** · **corrigé dans le dépôt** (`c12ecc9`, 17:50) — **déploiement à revérifier** | `src/data/properties.ts:37-39` (avant) · HTML de 3 pages quartiers | 13 biens **fictifs** : **encore servis par la production** (build de 17:45) — « Villa contemporaine · 1 250 000 € » 2× dans le HTML de `/fr/quartiers/sainte-foy-les-lyon` ; retirés du dépôt par `c12ecc9`, à confirmer après redéploiement |
| **B-ARCH-01** | **critique** | B | **nouveau** | `src/pages/PropertyListingPage.tsx:123,386,801,848` + mesure en ligne | `/fr/acheter` n'affiche que **32 annonces sur 87** : 55 biens (63 %) invisibles, **aucun bouton, aucune pagination, aucun compteur** |
| ARCH-01 | haute | A | **corrigé** le 29/09 17:32 (`5a16f5b`, déployé 17:45) | `git show HEAD:vercel.json` → 0 clé `routes` · `last-modified: 15:45:31 GMT` | **La production ne correspondait pas au commit** : ce qui était servi venait du `vercel.json` non commité |
| **B-UX-01** | haute | B | **nouveau** | mesure 375 px sur `/fr/acheter?view=map` | Vue « Carte » sur mobile : conteneur **9 558 px** de large → **8 090 px de débordement horizontal** |
| ARCH-02 | haute | A+B | **confirmé en réel** | `vercel.json:3653-3658` + `curl` | `/fr/acheter/<id inconnu>` et `/fr/louer/<id>` → **HTTP 200** (spam d'URL indexables) |
| ARCH-04 | haute | A+B | **confirmé en réel** | `src/services/leads.ts:11` + soumission testée | Aucune notification : un prospect envoie une demande, la ligne arrive en base, **personne n'est prévenu** |
| SEC-01 | haute | A+B | **confirmé en réel** | `curl -X POST` **sans aucune clé** → **HTTP 200** | `verify_jwt = false` + `Access-Control-Allow-Origin: *` : le proxy Apimo est appelable par n'importe qui → quota épuisable |
| SEO-02 | haute | A+B | **confirmé en réel** | URL exacte de l'ancien site : forme `+` → **404**, forme `%2B` → **200** | Les redirections des fiches de l'ancien site ne matchent que la forme `%2B` → **404 sur l'URL réellement indexée** (229 URLs `propriete` concernées) |
| **B-PERF-01** | haute | B | **nouveau** | mesure CDP sur 3 fiches | **CLS 0,45** sur les fiches de biens (4 mesures identiques) — 4,5× le seuil de 0,1 |
| ARCH-03 | haute | A | constaté | `scripts/prerender.ts:88,176-179` | Pré-rendu dépendant du réseau (17-18 min, ~91 requêtes Apimo) ; son échec **ne casse pas le build** |
| API-01 | haute | A | **non reproduit** (12 appels mesurés 410-958 ms) | `src/services/apimo.ts:519` vs `index.ts:210,283` | Timeout client 10 s < pire cas serveur 30 s → écran **« Erreur de chargement »** observé le 28/09 ; défaut réel, non revu le 29/09 |
| SEO-04 | haute | A | **corrigé** le 29/09 17:32 (`5a16f5b`) | sitemap en ligne 115 → **120 URLs** | Les biens publiés depuis le 28/09 n'avaient **pas de page pré-rendue** et répondaient la coquille |
| SEO-01 | haute | A+B | **confirmé en réel** | `src/config/site.ts:16` + `curl` → **404** | L'`og:image` **est en 404** (il pointe sur l'ancien domaine) — `twitter:image` utilise la même URL, donc également en 404 |
| SEO-03 | haute | A | constaté (voulu aujourd'hui) | `scripts/generate-sitemap.ts:43` | `Disallow: /` piloté par une variable de build manuelle — auto-corrigé par `5a16f5b`, se rouvrira tout seul à la bascule |
| PERF-01 + PERF-02 | haute | A+B | **confirmé** | Lighthouse mobile + 34/34 images sans `srcset` | Accueil **51-65**, `/fr/acheter` **83** (critère « ≥ 90 » non atteint) ; **0 `srcset`** partout |
| **B-API-01** | moyenne | B | **nouveau** | API Apimo + site | **Doublons** : le même bien publié 2× (`86938526`/`86942704`, Écully, mêmes photos, même prix) et 2 annonces distinctes au **titre identique** (« Lyon 2ème 40m² ») affichées côte à côte |
| **B-DATA-01** | moyenne | B | **nouveau** | API Apimo (`87336703`) | Fiche sans surface → **titre et h1 « Bien immobilier »** ; par ailleurs **5 des 8 options** du filtre « Type » ne peuvent jamais rien renvoyer (aucun terrain/bureau/garage/immeuble dans les 94 biens) |
| SEC-03 | moyenne | A+B | **confirmé en réel** | DOM du formulaire | Formulaire sans anti-abus : **aucun captcha, aucun champ piège**, insertion anonyme illimitée |
| SEC-02 + SEC-04 | moyenne | A+B | **confirmé + constaté** | `curl -I` · `apimo-proxy/index.ts:341` | Aucun en-tête de sécurité (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) · messages d'erreur internes renvoyés au navigateur |
| API-02 + API-04 | moyenne | A+B | **confirmé + constaté** | `PropertyDetailPage.tsx:233,268` · `apimo.ts:591-604` | La fiche télécharge **tout le catalogue** pour un seul bien · `AbortSignal.timeout()` créé mais **jamais transmis** |
| API-03 | moyenne | A | constaté (non atteint : 94 biens) | `apimo-proxy/index.ts:283` | Pagination en dur (`[100, 200]`) : au-delà de 300 biens, troncature silencieuse |
| PERF-03 + PERF-04 | moyenne | A+B | **confirmé + constaté** | `curl -sI` assets/images · `src/style.css` (8 092 lignes) | `cache-control: max-age=0, must-revalidate` sur le bundle (1,0 Mo) et les images · CSS monolithique en échec `unused-css-rules` |
| UX-01 | moyenne | A+B | **confirmé en réel** (+ B-UX-02) | mesures 375 px | Accueil = **17,5 écrans** ; **90 des 111** zones tactiles < 44 px ; police minimale **10 px** ; **menu mobile ouvert, la page défile derrière** (`body` reste `overflow: visible`) |
| DET-01 | moyenne | A | constaté | `package.json:6-11`, `tsconfig.json:30` | Aucun lint, et `tsconfig` n'inclut que `src/` → les 8 scripts du build ne sont pas typés |
| **B-FIN-01** | basse | B (+ A) | **nouveau / confirmé** (5 points) | voir détail § B-FIN-01 | « Confidentialite » **sans accent** dans le pied de page (toutes les pages) · la page 404 se **canonicalise vers l'URL inexistante** · contraste insuffisant sur la bande d'estimation (UX-02) · dépendance morte `@cloudflare/stream-react` (DET-02) · **`supabase/.temp` toujours suivi** par git (8 entrées) malgré `.gitignore:27` |

---

## DÉTAIL DES PROBLÈMES

### DEMO-01 — Des biens fictifs sont publiés sur les pages quartiers · **critique** · constaté

**Preuve.** `src/data/properties.ts:37-39`
```ts
slug: 'villa-contemporaine-sainte-foy',
title: 'Villa contemporaine',
city: 'Sainte-Foy-lès-Lyon',
```
`src/pages/NeighborhoodPage.tsx:22` — `const properties = useProperties({ city: neighborhood.name }, 'recent')`
`src/hooks/useProperties.ts:26` — `const filtered = PROPERTIES.filter(...)` (13 biens statiques)
HTML brut de `https://hamac-site.vercel.app/fr/quartiers/sainte-foy-les-lyon` (23 973 o) :
```html
<p class="bien-card__price">1 250 000 €</p><h3 class="bien-card__title">Villa contemporaine — Sainte-Foy-lès-Lyon</h3>
<p class="bien-card__meta">210 m² · 5 ch. · maison</p>
```
2 occurrences dans le HTML brut, donc **dans ce que Google et les crawlers reçoivent**.

**Pourquoi c'est grave.** Ce n'est pas un écran de chargement : c'est une annonce complète (titre, prix, surface, photo) publiée sur le site d'une agence immobilière, pour un bien qui n'existe pas. Un prospect peut appeler l'agence pour « la villa à 1 250 000 € » ; l'agence peut se faire reprocher une fausse annonce. Sont concernées **3 des 6 pages communes** — chacune avec **2 occurrences dans le HTML pré-rendu** (mesuré dans `dist/fr/`, donc indexable) :

| Page | Bien fictif affiché | Occurrences |
|---|---|---|
| `/fr/quartiers/sainte-foy-les-lyon` | Villa contemporaine — 1 250 000 € · 210 m² · 5 ch. | 2 |
| `/fr/quartiers/tassin-la-demi-lune` | Appartement familial | 2 |
| `/fr/quartiers/ecully` | Maison bourgeoise | 2 |

Les 3 autres communes (Francheville, Craponne, Oullins) n'ont pas de bien fictif correspondant : le défaut est silencieux, il dépend du nom de la commune. **Correctif à ne pas oublier** : les 13 biens statiques restent dans le fichier et réapparaîtraient sur n'importe quelle page qui les importerait plus tard.

**Solution recommandée.** Brancher `NeighborhoodPage` sur les biens réels (`getProperties()` filtré sur `city`, avec états chargement/vide/erreur comme sur `/acheter`), puis réduire `src/data/properties.ts` à ses types (supprimer les 13 biens) et ajouter une règle qui interdit l'import de ce fichier depuis `src/pages/**`. Critère : le HTML servi ne doit plus contenir aucun titre de bien statique.

### ARCH-01 — La production ne correspond pas au commit · haute · constaté

**Preuve.**
- Dernier commit : `8271387`, 28/09 **16:22:01 +02:00** ; `origin/main` = `8271387` (aucun `ahead`).
- `vercel.json` du dépôt : **modifié et non commité**, mtime **28/09 16:40**.
- Production : `last-modified: Mon, 28 Sep 2026 22:03:13 GMT` → **une mise en production a eu lieu 5 h 40 après le dernier commit**, sans nouveau commit.
- Le comportement servi suit le fichier **non commité** : `git show HEAD:vercel.json` contient la clé legacy `routes` (dont `{"src":"^/fr(/.*)?$","dest":"/fr/404.html","status":404}` et `{"src":"/.*","dest":"/404.html","status":404}`) ; le working tree la supprime au profit de `redirects`+`rewrites`. Mesure en ligne : `/en/` → **308**, `/fr/selection` → **308**, `/es/aviso-legal` → **308** — impossible avec la clé `routes` du commit (qui n'a aucune règle `/en/`) ; ce comportement n'apparaît qu'avec la version non commitée.

**Pourquoi c'est grave.** Tout le travail de routage qui rend la bascule possible ne vit que sur ce disque. Un `git push` depuis le dépôt, sur une autre machine ou par un autre agent, **réécrit la config déployée et re-casse la production** sans qu'aucun test ne le voie. C'est aussi la raison pour laquelle les corrections de ce rapport ne peuvent pas être validées « dans le dépôt » : ce qui est en ligne n'y est pas.

**Solution recommandée.** Committer le working tree tel quel (il est cohérent : `routes` → `redirects`+`rewrites`), puis redéployer depuis `main` et revérifier les 3 URLs témoins. Hypothèse associée (non prouvée, à confirmer dans le dashboard Vercel → Deployments) : le déploiement de 22:03 a été lancé depuis le dossier local (`vercel --prod`), qui envoie aussi les fichiers non commités.

### ARCH-02 — Un bien inexistant répond 200 avec la coquille · haute · constaté

**Preuve.** `vercel.json:3653-3658`
```json
{ "source": "/fr/acheter/:id", "destination": "/fr/200.html" },
{ "source": "/fr/louer/:id",   "destination": "/fr/200.html" }
```
`curl -o /dev/null -w '%{http_code} %{size_download}'` → `/fr/acheter/99999999` : **200 / 6 337 o**. HTML brut : `<title>Hamac — Immobilier premium | Ouest Lyonnais` + `<link rel="canonical" href="https://hamacpatrimoine.com/fr/">` + `<meta name="robots" content="index,follow" />`. Après hydratation, la page affiche la liste `/acheter`.

**Pourquoi.** Un identifiant inexistant (ou un bien publié après le dernier snapshot — cf. SEO-04) produit une URL indexable, avec un titre et une canonique qui ne lui correspondent pas. C'est du contenu dupliqué à grande échelle et du budget de crawl gaspillé sur les URL les plus importantes du site.

**Solution recommandée.** Servir un vrai 404 pour une fiche inconnue : soit une fonction Edge qui vérifie l'id contre l'instantané de routes et renvoie 404, soit — si le pré-rendu reste au build — générer un `404.html` dédié et router `/fr/acheter/:id` vers un fallback qui répond 404 quand l'id n'est pas dans la liste. Vérifier après coup : `/fr/acheter/99999999` → 404, `/fr/acheter/87355426` → 200.

### ARCH-03 — Le pré-rendu dépend du réseau et échoue en silence · haute · constaté

**Preuve.** `scripts/prerender.ts:88` — `const CHROME_BUDGET_MS = Number(process.env.PRERENDER_CHROME_MS ?? (process.env.VERCEL ? 6 * 60 * 1000 : 0)) || 0`
`scripts/prerender.ts:176-179` — un pré-rendu incomplet n'émet qu'un `console.warn`, le build reste `EXIT=0`.
Journal du build local :
```
145:ÉCHEC /louer/87259648 : Waiting failed: 40000ms exceeded
120/120 routes pré-rendues (body complet)
```
Durée : `dist` écrit à 14:55, log clos à 15:13 → **~18 min**, dont ~17 min de Chromium pour 120 routes, avec ~91 requêtes Apimo (`fetchListingsForHead`).

**Pourquoi.** Un 429 Apimo, une latence, ou simplement 20 routes de plus suffisent à dépasser le budget de 6 min côté Vercel : les pages concernées gardent le `<head>` injecté mais perdent leur corps — et rien ne le signale. Le build reste vert, le site est en ligne, la régression ne se voit que par un crawl (c'est exactement ce qui s'est produit le 28/09 au matin).

**Solution recommandée.** 1) Sortir les données Apimo du chemin de build (déjà prévu par `data/apimo-pages.json`) pour que le pré-rendu ne dépende plus du réseau. 2) Faire échouer le build (ou au minimum écrire un fichier de rapport) dès qu'une route n'a pas son corps complet, avec un seuil explicite. 3) Mesurer puis fixer `PRERENDER_CHROME_MS` en fonction du nombre réel de routes.

### ARCH-04 — Aucune notification quand un prospect envoie une demande · haute · constaté (côté code)

**Preuve.** `src/services/leads.ts:11` — `const { error } = await supabase.from('leads').insert(payload)`
`grep -rniE "resend|sendgrid|nodemailer|mailgun|smtp|sendEmail" src/ supabase/functions/ api/` → **0 résultat** ; le dossier `api/` est vide.

**Pourquoi.** Le site a un objectif unique : générer des demandes de contact. Aujourd'hui une demande se dépose dans une table Supabase et s'arrête là. Si personne ne surveille la table, chaque formulaire rempli est un lead perdu — c'est le point qui annule la valeur du reste du travail.

**Solution recommandée.** Un `AFTER INSERT` sur `public.leads` qui appelle une edge function d'envoi d'email (Resend ou l'email agence existant), avec le nom/email/téléphone/message + la référence du bien + l'URL d'origine. À vérifier avant de conclure à l'absence : un **Database Webhook / trigger peut exister côté dashboard Supabase sans trace dans le dépôt** — c'est le premier contrôle à faire (Dashboard → Database → Webhooks, et `select * from pg_trigger`).

### SEC-01 — Le proxy Apimo est ouvert à tout Internet · haute · constaté

**Preuve.** `supabase/config.toml:4` — `verify_jwt = false` sous `[functions.apimo-proxy]`.
`supabase/functions/apimo-proxy/index.ts:12` — `"Access-Control-Allow-Origin": "*"`.
Aucune limitation de débit dans la fonction (`grep` : aucun compteur, aucune clé d'appelant).

**Pourquoi.** N'importe qui peut appeler `https://<projet>.supabase.co/functions/v1/apimo-proxy` sans clé et faire consommer le quota Apimo de l'agence (quota payant, avec une limite journalière). Une fois le quota atteint, ce sont les vrais visiteurs qui voient l'état d'erreur (API-01). Le token Apimo, lui, reste bien côté serveur — c'est le point positif à conserver.

**Solution recommandée.** `verify_jwt = true` (la clé anon du site reste un JWT valide, donc le site continue de fonctionner), restreindre `Access-Control-Allow-Origin` au domaine du site, et ajouter une limite simple par IP dans la fonction. Vérifier ensuite : appel sans en-tête `apikey` → 401 ; appel avec la clé anon → 200.

### API-01 — Le client abandonne avant le serveur, et affiche une erreur · haute · constaté

**Preuve.** `src/services/apimo.ts:519` — `const CATALOG_FETCH_TIMEOUT_MS = 10_000`, utilisé par `invokeWithTimeout` (`:591-604`, rejet → `CatalogLoadError('timeout')`).
`supabase/functions/apimo-proxy/index.ts:210` — `setTimeout(() => controller.abort(), 10_000)` **par page Apimo**, et `:283-284` — jusqu'à **3 pages séquentielles** (offsets 0, 100, 200) → pire cas serveur ≈ 30 s.
Observé en production :
- console Lighthouse de `/fr/` : `[apimo] getProperties() error: CatalogLoadError: Délai de chargement dépassé at AbortSignal.r (…/index-7jyrbp1F.js:89:2547)`
- une fiche bien a rendu `h1 = « Erreur de chargement »` pendant l'audit (transitoire, revenu à la normale au rechargement).

**Pourquoi.** Dès que le cache de 5 min du proxy expire pendant un pic (ou pendant que l'API Apimo est lente), les visiteurs voient un écran d'erreur plein écran **sans bouton Réessayer** : le prospect part. Le pire cas serveur étant 3× le délai du client, le client abandonne par construction avant que le serveur ait fini.

**Solution recommandée.** Aligner les deux côtés : timeout client ≥ 1,5 × le pire cas serveur (ou rendre le proxy asynchrone avec cache), et remplacer l'écran d'erreur par un état explicite avec réessai + repli sur le cache `sessionStorage` existant. Ajouter un délai global dans la fonction (ex. 12 s pour l'ensemble des 3 pages) et servir le cache périmé plutôt qu'une erreur.

### SEO-01 — L'image d'aperçu social est en 404 · haute · constaté

**Preuve.** `src/config/site.ts:16` — `export const DEFAULT_OG_IMAGE = \`${SITE_URL}/images/og/hamac-og-1200x630.jpg\`` avec `SITE_ORIGIN = 'https://hamacpatrimoine.com'`.
Mesures : `https://hamacpatrimoine.com/fr/images/og/hamac-og-1200x630.jpg` → **404 text/html** ; `https://hamac-site.vercel.app/fr/images/og/hamac-og-1200x630.jpg` → **200 image/jpeg, 234 187 o**.
Le fichier existe aussi dans `index.html:25`, qui déclare la même URL sur l'ancien domaine.

**Pourquoi.** `SITE_ORIGIN` est le domaine **final**, aujourd'hui encore servi par l'ancien site Apimo qui ne connaît pas ce fichier. Résultat : tous les aperçus sans photo Apimo (accueil, `/acheter`, `/vendre`, `/contact`, blog, quartiers) affichent un aperçu sans image sur WhatsApp, Facebook et LinkedIn — invisible dans un navigateur, donc invisible pour l'agence.

**Solution recommandée.** Émettre l'`og:image` (et l'`og:url`) sur l'hôte **réellement servi**, en réutilisant le signal déjà écrit pour `robots.txt` (`VERCEL_PROJECT_PRODUCTION_URL`) : tant que ce n'est pas `hamacpatrimoine.com`, les URL absolues pointent sur l'hôte Vercel ; après la bascule, elles reprennent le domaine sans modification. Contrôle : `curl -s -A "facebookexternalhit/1.1" <url>` puis vérification du code HTTP de l'image déclarée.

### SEO-02 — Les redirections de l'ancien site ne matchent pas l'URL indexée · haute · constaté

**Preuve.** `vercel.json:2474`
```json
{ "source": "/fr/propriete/location%2Bappartement%2Birigny%2B...%2B85304702", "destination": "/fr/louer", "permanent": true }
```
Mesures (source formée à partir de `~/hamac-briefs/ANCIEN-SITE-urls.csv`) :
| URL demandée | Résultat |
|---|---|
| `/fr/propriete/location+appartement+irigny+...+85304702` (**forme indexée par Google et envoyée par le navigateur**) | **404** |
| `/fr/propriete/location%2Bappartement%2B...%2B85304702` (forme stockée) | 308 → `/fr/louer` |
| `/en/property/sale+apartment+lyon-5eme+...+6…00` (URL réelle du CSV) | **404** |
| `/es/aviso-legal`, `/es/`, `/en/` (sources sans `+`) | 308 → bonne page ✅ |

Répartition des 722 règles : 227 `/fr/propriete/*`, 243 `/en/*`, 240 `/es/*` — toutes les URL de fiches contiennent des `+` (`scripts/build-legacy-redirects.mjs`).

**Pourquoi.** Après la bascule de DNS, les fiches de l'ancien site — celles qui portent le référencement de l'agence depuis 2022 — répondraient 404 au lieu de rediriger. Le `%2B` est une forme que ni Google ni les navigateurs n'utilisent dans un chemin : la table entière est donc inopérante pour ces 700 URLs, alors qu'elle *paraît* complète dans le fichier.

**Solution recommandée.** Écrire le `source` avec le `+` littéral (décodage avant sérialisation dans le générateur), régénérer, puis **contrôler avec 3 URL réelles du CSV** (pas avec la source recopiée depuis le fichier — c'est l'erreur qui a produit le défaut). Vérifier aussi qu'aucune règle ne redirige un chemin vers lui-même et que le total reste sous 2 048.

### SEO-03 — L'ouverture de l'indexation est un interrupteur manuel · haute · constaté (voulu aujourd'hui)

**Preuve.** `scripts/generate-sitemap.ts:43-45` (working tree, non commité) :
```ts
const indexable =
  process.env.INDEXABLE === '1' ||
  (process.env.INDEXABLE !== '0' && productionHost !== '' && productionHost === siteHost)
```
Production : `curl -s /robots.txt` → `User-agent: *` / `Disallow: /` / `Sitemap: https://hamacpatrimoine.com/fr/sitemap.xml`.

**Pourquoi.** Le `Disallow` est **le bon réglage aujourd'hui** : les 115 pages portent une canonique sur `hamacpatrimoine.com`, qui sert encore l'ancien site ; ouvrir le crawl maintenant ferait indexer 115 pages dupliquées sous `vercel.app`. Mais c'est un état qui dépend d'une variable lue **au build** : si elle est oubliée au moment de la bascule, le site parfait reste invisible et personne ne s'en aperçoit avant des semaines. Par ailleurs le `Sitemap:` déclaré pointe vers l'ancien domaine alors que le fichier est servi par `vercel.app` → sitemap inter-hôte, ignoré.

**Solution recommandée.** Committer la détection automatique (`productionHost === siteHost`), la porter dans la checklist de bascule au même titre que les redirections, et ajouter un contrôle post-bascule : `curl -s https://hamacpatrimoine.com/robots.txt` doit renvoyer `Allow: /` après le rattachement du domaine au projet Vercel.

### SEO-04 — Les biens récents n'ont pas de page pré-rendue · haute · constaté

**Preuve.** `curl -s https://hamac-site.vercel.app/fr/sitemap.xml | grep -c "<loc>"` → **115**. Build local du 29/09 : `sitemap : 120 URLs`. `data/apimo-routes.json` : 98 lignes en working tree (non commité) contre 93 dans `HEAD`.

**Pourquoi.** Les pages sont fabriquées à partir de `data/apimo-routes.json`, un instantané rafraîchi hors déploiement. Tout bien publié après cet instantané n'a pas de route : son URL tombe sur `/fr/200.html` (coquille) et répond **200** (cf. ARCH-02). Une nouvelle annonce — le moment où l'agence communique le plus — est donc la plus mal servie.

**Solution recommandée.** Rafraîchir l'instantané avant chaque déploiement (ou le générer dans le build avec un repli sur l'ancien si l'API ne répond pas), et rendre l'écart visible : une route demandée mais absente de l'instantané doit produire un 404 propre, pas une coquille en 200.

### PERF-01 / PERF-02 — Lighthouse mobile sous le seuil, aucune image responsive · haute · constaté

**Preuve.** Lighthouse 13.5.0, mobile, `--form-factor=mobile` :

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| `/fr/` (passe 1) | **0,65** | 0,96 | (passe en erreur DevTools) | 0,92 |
| `/fr/` (passe 2) | **0,51** | 0,96 | — | 0,92 |
| `/fr/acheter` | **0,83** | 0,98 | 1,00 | **0,69** |

Métriques accueil : CLS **0,116** (seuil 0,1), FCP 2,8 s, Speed Index 4,1 s, LCP 8,8 s puis 23,6 s (mesure instable, à reconfirmer avec PageSpeed Insights — les deux passes ont terminé sur une erreur DevTools `CSS.enable`). Le seul coupable de CLS identifié : « Des lieux choisis, pour des vies bien pensées » (score 0,1155 sur 0,1155 total).
Audits en échec : `image-delivery-insight`, `render-blocking-insight`, `unused-javascript`, `unused-css-rules`, `forced-reflow-insight`, `bf-cache`, `layout-shifts`.
Images mesurées : `34/34` sans `srcset` sur l'accueil, `16/16` sur la fiche ; `maison-homepage.webp` = **488 102 o** ; bundle JS = **1 021 461 o**.
SEO `/fr/acheter` = 0,69 : le seul défaut bloquant est `is-crawlable` (le `Disallow` volontaire, cf. SEO-03).

**Pourquoi.** Le critère « Lighthouse mobile ≥ 90 » n'est atteint sur aucune des deux pages mesurées. Concrètement : le premier écran met plusieurs secondes à se stabiliser sur un téléphone en 4G, et la page bouge pendant le chargement — sur un site où l'objectif est de faire remplir un formulaire.

**Solution recommandée.** Dans l'ordre : `srcset` + `sizes` sur les images (le plus gros gain, cf. DEMO/UX mesurés), dimensions explicites (ou `aspect-ratio`) sur l'image du héros et le titre pour tuer le CLS, `loading="lazy"` généralisé hors premier écran, purge du CSS mort, et découpage du bundle. Re-mesurer avec PageSpeed Insights (données de terrain) et non uniquement en headless local.

### SEC-02 — Aucun en-tête de sécurité · moyenne · constaté

**Preuve.** `curl -sI https://hamac-site.vercel.app/fr/acheter` → seuls `strict-transport-security` et `cache-control`. Absents : `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
**Pourquoi.** La page est encadrable dans une iframe tierce (clickjacking sur un bouton de contact), et il n'existe aucune barrière si une injection est trouvée dans les données Apimo affichées. Le type des ressources n'est pas figé (reniflage MIME).
**Solution.** Ajouter un bloc `headers` dans `vercel.json` : `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, puis une CSP en `Content-Security-Policy-Report-Only` (les domaines tiers connus : `*.supabase.co`, `media.apimo.pro`, `videodelivery.net`, `fonts.gstatic.com`, `tile.openstreetmap.org`).

### SEC-03 — Formulaire de contact sans anti-abus · moyenne · constaté

**Preuve.** `supabase/leads-contact-rls.sql:11-15`
```sql
create policy "Allow anonymous insert on leads"
  on public.leads for insert to anon with check (true);
```
La clé anon est par nature publique (elle est dans le bundle) ; l'insertion est donc ouverte à tout script.
**Pourquoi.** Un robot peut remplir la table `leads` de plusieurs milliers de lignes en quelques minutes : les vraies demandes se noient et l'exploitation de la table devient pénible.
**Solution.** Champ piège + horodatage minimal côté client (le temps de remplissage), limitation par IP côté edge function, et — si le spam apparaît — captcha invisible. La policy `with check (true)` peut rester, le contrôle se fait à l'appel.

### SEC-04 — Messages d'erreur internes exposés au navigateur · moyenne · constaté

**Preuve.** `supabase/functions/apimo-proxy/index.ts:341` — `return json({ error: "Internal error in apimo-proxy", details: String(err) }, 500)` ; même schéma lignes 247, 268, 331. La ligne 159 énumère aussi les noms de secrets manquants.
**Pourquoi.** Un `String(err)` peut contenir l'URL Apimo appelée, un extrait de la réponse amont ou une trace de la stack : de l'information utile à un attaquant, inutile au prospect. À noter aussi : `curl` direct sur le proxy sans authentification renvoie déjà du contenu.
**Solution.** Journaliser le détail côté fonction (`console.error`) et ne renvoyer qu'un code d'erreur stable au client.

### API-02 — La fiche télécharge tout le catalogue pour un seul bien · moyenne · constaté

**Preuve.** `src/pages/PropertyDetailPage.tsx:233` `let p = await getPropertyById(propertyId)` → `src/services/apimo.ts:674-682` (`getAllMappedProperties()` puis `.find(p => p.slug === slugToFind)`) ; `:268` `const all = await getProperties()` pour les biens similaires.
Mesure navigateur sur `/fr/acheter/87355426` : `performance.getEntriesByType('resource')` → **deux** appels `apimo-proxy` (1 330 ms puis 1 053 ms).
**Pourquoi.** Chaque visite de fiche refait le chargement complet du catalogue (91 biens, plusieurs centaines de Ko de JSON) pour n'en garder qu'un, puis le recharge pour les similaires. C'est du temps sur le seul écran qui convertit, et une multiplication des appels Apimo (donc du risque de quota, cf. SEC-01).
**Solution.** Utiliser la route « bien seul » du proxy (`route: "properties/<id>"`, déjà implémentée dans la fonction) pour la fiche, ne charger la liste complète qu'une fois par session, et partager le résultat entre les composants (contexte ou cache mémoire au lieu de deux appels concurrents).

### API-03 — Pagination en dur à 300 biens · moyenne · constaté

**Preuve.** `supabase/functions/apimo-proxy/index.ts:283` — `const additionalOffsets = [100, 200]` (avec `pageSize = 100`, `:260`), et `:307` recopie `total_items` tel quel.
**Pourquoi.** Au-delà de 300 biens au portefeuille, le catalogue servi serait tronqué en silence, sans erreur : des biens disparaîtraient des listes, mais `total_items` annoncerait un nombre plus élevé (compteur et résultats incohérents). Aujourd'hui 91 biens, donc le défaut est latent.
**Solution.** Boucler jusqu'à `total_items` (avec un plafond de sécurité explicite, ex. 10 pages) et journaliser le cas où le plafond est atteint.

### PERF-03 — Assets et images sans cache long · moyenne · constaté

**Preuve.**
```
GET /fr/assets/index-7jyrbp1F.js      → cache-control: public, max-age=0, must-revalidate ; content-length: 1021461
GET /fr/images/Biens/maison-homepage.webp → cache-control: public, max-age=0, must-revalidate ; content-length: 488102
```
**Pourquoi.** Les noms de fichiers sont hachés (`index-7jyrbp1F.js`) : ils ne changeront jamais, un cache d'un an `immutable` serait sans risque. Aujourd'hui le navigateur revalide à chaque navigation un bundle de 1 Mo et les images — des allers-retours inutiles, et un poids qui repart à zéro sur les connexions mobiles.
**Solution.** Ajouter un bloc `headers` pour `/assets/(.*)` … `Cache-Control: public, max-age=31536000, immutable` (et un cache long équivalent sur `/images/*`, avec un paramètre de version quand un visuel est remplacé, comme le fait déjà `?v=20260922` sur le logo).

### PERF-04 — CSS monolithique · moyenne · constaté

**Preuve.** `src/style.css` = **8 092 lignes** ; audit Lighthouse `unused-css-rules` en échec ; 6 media queries `max-width` contre 25+ `min-width` (relevé du 28/09).
**Pourquoi.** Tout le CSS est chargé sur toutes les pages ; une partie ne sert à aucune. Effet direct sur `render-blocking` et sur la maintenabilité : une correction mobile doit se faire dans un fichier de 8 000 lignes où les règles concurrentes sont à 4 000 lignes de distance.
**Solution.** Ne pas empiler de nouvelles media queries : extraire le socle commun et découper par page/composant (ou passer à des fichiers CSS par route, Vite gère le découpage), en s'appuyant sur la mesure `unused-css-rules` pour vérifier le gain.

### UX-01 — Accueil mobile long, pastilles du héros sous le seuil tactile · moyenne · constaté

**Preuve.** Mesures `Emulation.setDeviceMetricsOverride(390×844, dpr 2)` :
- accueil : **16,8 écrans** de haut ; `search-field__pill` = **189×32 px** (seuil tactile 44 px) ; déclencheurs internes 110×17, 113×17, 92×17 px ; police minimale **10 px** ; **144** éléments de texte sous 16 px ; 34/34 images sans `srcset`.
- fiche bien (après le commit `1578dcd`) : prix à **0,93 écran**, titre à 1,07, bouton « Envoyer ma demande » collant (`detail-mobile-cta`, 68 px) présent — **cette partie est corrigée, ne pas la reprendre** ; restent **22 cibles sur 42** sous 44 px ; 16/16 images sans `srcset`.

**Pourquoi.** Sur l'accueil, les trois pastilles de recherche — le premier geste attendu — sont deux fois trop basses en hauteur, et la taille de police de 10 px sur des libellés de navigation est illisible sur un téléphone. Aucun champ de saisie n'est sous 16 px (donc pas de zoom involontaire : point à créditer).
**Solution.** Porter les pastilles du héros à ≥ 44 px de hauteur (48 px recommandé) et remonter le plancher typographique à 16 px pour le texte de contenu / 12-14 px pour les mentions secondaires, page par page (accueil d'abord). Vérifier avec le même protocole de mesure (390×844) plutôt qu'à l'œil.

### DET-01 — Aucun filet : pas de lint, scripts du build non typés · moyenne · constaté

**Preuve.** `package.json:6-11` — scripts `dev`, `build`, `sync:routes`, `preview` : pas de `lint`. Aucune dépendance ESLint/Prettier/Biome. `tsconfig.json:30` — `"include": ["src"]` : `scripts/prerender.ts`, `inject-route-heads.ts`, `generate-sitemap.ts`, `sync-routes.ts`, `collect-routes.ts`, `build-legacy-redirects.mjs` échappent à `tsc` (exécutés par `tsx`, qui ne vérifie pas les types).
**Pourquoi.** Le build vert ne dit rien de ces scripts, alors que ce sont eux qui fabriquent le SEO, les redirections et le sitemap — et qu'ils ont produit le défaut SEO-02. Le typecheck seul ne couvre pas non plus les usages dangereux (imports de données statiques, cf. DEMO-01).
**Solution.** Ajouter ESLint (config TS + React) et un script `lint`, l'appeler dans `build` avant `tsc`, et étendre le typecheck aux scripts (`tsconfig.node.json` incluant `scripts/**`).

### UX-02 — Contraste insuffisant sur la bande d'estimation · basse · constaté

**Preuve.** Lighthouse `color-contrast` (accueil mobile), élément : `VOUS VENDEZ ? ESTIMEZ VOTRE BIEN GRATUITEMENT`.
**Pourquoi.** Le texte de cette accroche (appel à l'action principal vers l'estimation) n'atteint pas le ratio 4,5:1 exigé. Le doré `#c5a96a` sur crème plafonnait à 2,07:1 ; un résidu de ce type subsiste sur cet élément alors que le reste du site est passé au navy `#142a38`.
**Solution.** Relever la couleur calculée de cet élément et la remplacer par `--text-heading`/navy sur fond crème (le navy monte à 13,5:1), en vérifiant au passage les éléments posés sur fond navy (badge carte, lightbox vidéo) qui doivent rester en crème `#f7f4ef`.

### DET-02 — Dépendance morte et fichier d'outil versionné · basse · constaté

**Preuve.** `package.json:30` — `@cloudflare/stream-react` en dépendance ; `grep -rn "@cloudflare/stream-react" src/` → **0**. `git status --short` → `M supabase/.temp/cli-latest` (fichier d'état de la CLI Supabase suivi par git).
**Pourquoi.** Une dépendance inutile alourdit l'installation et le `package-lock` ; le fichier `.temp` apparaît à chaque `git status` et pollue les revues de diff.
**Solution.** Retirer `@cloudflare/stream-react` (les vidéos passent par `src/components/PropertyVideo.tsx` et `hls.js`), supprimer `supabase/.temp/cli-latest` du suivi et ajouter `supabase/.temp/` au `.gitignore`.

---

## AUDIT B — TESTS RÉELS EN PRODUCTION (29/09/2026, 17:00-18:30 CEST)

**⚠️ La production a changé pendant l'audit.** Le 29/09 à **17:32**, le commit `5a16f5b` (« fix : versionner la config Vercel et l'ouverture auto de robots.txt » — c'est le **Prompt 1** de ce rapport) a été poussé, puis déployé à **17:45 GMT** (`last-modified: Tue, 29 Sep 2026 15:45:31 GMT`, `age: 103`, `x-vercel-cache: HIT`). Le sitemap est passé de 115 à **120 URLs** pendant les mesures. **Toutes les vérifications de cette section ont été refaites sur ce nouveau build**, sauf mention contraire. Au même moment, le working tree était modifié (`src/data/properties.ts`, `src/hooks/useProperties.ts`) : le **Prompt 2** était en cours — il a été poussé à **17:50** (`c12ecc9`, voir « Revue du Prompt 2 »).

**Conditions de test.** Chrome piloté en CDP, enregistreur injecté **avant** le JavaScript de l'application (erreurs console, promesses rejetées, `fetch`/XHR avec méthode, statut, durée). Viewports **1440×900** et **375×812**. Pages testées : accueil, `/fr/acheter` (liste, filtres, carte, `?view=map`), 3 fiches de biens, `/fr/contact` (formulaire), une URL inexistante, `/fr/agence`, `/fr/mentions-legales`, 3 pages quartiers. Aucun fichier du dépôt modifié.

### ÉTAPE 0 (audit B) — base factuelle mesurée

| Contrôle | Résultat |
|---|---|
| Console (toutes les pages testées) | **0 erreur, 0 avertissement** ✅ |
| Appels API observés | 12 appels `apimo-proxy`, **410-958 ms**, tous en 200 ✅ |
| Secrets côté client | 0 occurrence de `service_role` / `APIMO_TOKEN` dans le bundle servi ; seule la clé **anon** circule (normal et public chez Supabase) ✅ |
| `title` / `meta description` / `canonical` / Open Graph / Twitter | présents et corrects sur **les 120 pages** (0 page sans titre, 0 sans description) ✅ |
| Open Graph d'une fiche | image réelle en JPEG servie par `media.apimo.pro` (200) ✅ |
| 404 | `/fr/url-inexistante-audit-42` → **HTTP 404** + page « Page introuvable » + `robots: noindex,follow` ✅ |
| Formulaire | chaîne complète vérifiée ; succès = « …a bien été envoyée… », échec = « Une erreur est survenue. Merci de réessayer ou de nous contacter par téléphone. » ✅ |
| Redirections legacy | `/en/` → 308 · `/fr/selection` → 308 · `/es/aviso-legal` → 308 ✅ |
| En-têtes | HSTS `max-age=63072000; includeSubDomains; preload` présent ; **aucun autre en-tête de sécurité** ❌ (SEC-02) |
| Pré-rendu | sitemap 120 URLs ; `/fr/` servi en 61 269 o avec le contenu réel, pas une coquille ✅ |

### Méthode — ce que je n'ai pas fait, et pourquoi

- **Aucune écriture dans la base du client.** Le formulaire a été testé sans laisser de faux prospect dans `leads` : (1) test de **permission** d'insertion avec une charge utile invalide → réponse `PGRST204` (colonne inconnue) et non `42501` (RLS), ce qui prouve que l'insertion anonyme est bien autorisée **sans écrire de ligne** ; (2) succès et échec simulés en interceptant `fetch` dans le navigateur pour lire ce que voit le prospect. **La soumission réelle de bout en bout (une ligne en base) n'a pas été faite** : dis-le moi et je la fais avec une ligne marquée « TEST AUDIT », ou fais-la toi-même, je te donne la requête.
- **Lighthouse** : 3 passes lancées, **1 seule a abouti** (`/fr/acheter` : 83 / 98 / 100 / 69) ; les 2 autres n'ont jamais démarré (téléchargement du paquet impossible : `npm error code ETIMEDOUT`). La fiche de bien n'a donc **aucun score Lighthouse** — son diagnostic vient de mes propres mesures CDP.
- **INP non mesuré** : l'observateur d'événements n'a enregistré aucune interaction > 16 ms ; aucune valeur INP ne peut être affirmée.
- **Faux positif écarté (transparence)** : `document.title` renvoyait « 🐴 … » sur certaines pages lors de mes relevés. Vérification : l'emoji est **absent du HTML servi** (contrôlé par `curl` *et* par un `fetch()` exécuté depuis la page) et **absent de tout le dépôt et du bundle** → c'est un artefact de **mon environnement de test**, **non retenu** comme problème du site.

### B-ARCH-01 — Le catalogue n'affiche que 32 annonces sur 87 · **critique** · nouveau · `/fr/acheter`, desktop et mobile

**Observation.** `.bien-card` = **32** à chaque mesure (au chargement, après défilement complet de la page, après rechargement) — identique sur mobile 375 px et au build du 29/09 17:45. **Aucun bouton « voir plus », aucune pagination, aucun compteur de résultats** (les seuls textes « N biens » de la page sont les pastilles de la carte).

**Preuves.** API Apimo : **94 biens** dont **87 à la vente** (1=appartement 63, 2=maison 25, 4=commerce 6). Sitemap : **85 fiches de vente** + la liste. Carte Leaflet de la même page : **52 marqueurs**, avec des pastilles « 30 biens », « 3 biens », « 2 biens ». Grille : **32**.

**Cause localisée.**
```tsx
// src/pages/PropertyListingPage.tsx:123
const [visibleCount, setVisibleCount] = useState(32)
// :386 — remet à 32 à chaque changement de filtre
useEffect(() => setVisibleCount(32), [type, budgetMaxForFilter, ...])
// :801 et :848 — la grille ne rend que les 32 premiers
listedProperties.slice(0, visibleCount).map(...)
```
`setVisibleCount` n'est appelé **nulle part ailleurs** dans le fichier (recherche `visibleCount|setVisibleCount` : 4 occurrences, toutes ci-dessus) : la valeur ne peut jamais dépasser 32.

**Pourquoi c'est grave.** 55 biens sur 87 (**63 %** du portefeuille à la vente) sont invisibles pour un visiteur qui parcourt le catalogue. Les fiches restent atteignables par Google (sitemap) et par la carte, mais pas par la liste — donc pas par le chemin normal d'un prospect. Sur un site dont l'objectif est de générer des demandes de contact, c'est le défaut le plus coûteux trouvé.

**Solution.** Afficher tout, ou ajouter une pagination « Voir plus » (+32 par clic) jusqu'à épuisement, **avec un compteur visible** (« 87 biens »). Vérifier au passage que la remise à 32 au changement de filtre est voulue. **Incohérence à corriger dans le même mouvement** : la carte et la grille de la même page n'affichent pas le même nombre de biens (52 vs 32).

### B-UX-01 — La vue « Carte » est cassée sur mobile · **haute** · nouveau · `/fr/acheter?view=map`, 375×812

**Observation.**
```
.leaflet-container  → 9 556 px de large
.catalog-map-view   → 9 558 px
documentElement.scrollWidth → 9 590  (viewport 375)  →  8 090 px de débordement horizontal
window.scrollTo(3000,0) → window.scrollX = 3000  (le déplacement horizontal est bien possible)
chaîne de parents : .property-map (9 558) → .catalog-map-stage (9 558) → .catalog-map-view (9 558), tous en overflow-x: visible
```
**À 1440 px, la même page donne 1 006 px et aucun débordement** : le défaut est propre au point de rupture mobile.

**Cause probable.** Dans `src/style.css` (8 092 lignes), la chaîne `.catalog-map-view` → `.property-map` n'a pas de largeur contrainte sur mobile (conteneur flex/grid sans `min-width: 0` ni `max-width: 100%`) : la carte est dimensionnée sur le contenu au lieu de l'écran. Non localisée à la ligne près.

**Pourquoi.** Le lien « Carte » est proposé **dans le catalogue mobile**. En l'état, la carte fait 6,4× la largeur de l'écran : la page part en travers, la zone tactile de la carte est inutilisable.

**Solution.** Contraindre la carte au conteneur (`width: 100%; max-width: 100%; min-width: 0` sur la chaîne ci-dessus), puis vérifier que `scrollWidth == innerWidth` à 375 px **et** que rien ne bouge à 1440 px.

### B-PERF-01 — Les fiches de biens se décalent d'un demi-écran (CLS 0,45) · **haute** · nouveau · 3 fiches, desktop et mobile

**Observation.** Décalage de mise en page cumulé mesuré : **0,4495** (`87355426` mobile), **0,4497** (`87232189` mobile), **0,4503** (`87336703` mobile), **0,45** (desktop). Quatre mesures, trois fiches différentes, deux viewports : la valeur est stable. Lighthouse mobile sur l'accueil : **0,116**.

**Pourquoi.** Le seuil « bon » est 0,1 : la page de conversion du site se décale de **4,5× le seuil**, au moment où la galerie et les images se posent. C'est cohérent avec PERF-02 : **34 images sur 34 sans `srcset`, 21 sans dimensions déclarées** → le navigateur ne peut pas réserver la place avant l'arrivée de l'image.

**Solution.** Réserver les dimensions (ou un `aspect-ratio`) sur les vignettes de galerie et de carte, puis ajouter le `srcset`. Re-mesurer ensuite : sur la fiche, Lighthouse est aujourd'hui impossible à exécuter depuis ce poste (réseau), il faudra passer par PageSpeed Insights.

**Honnêteté de la mesure.** Hors bridage réseau, ma mesure du CLS sur l'accueil donne 0,0004 quand Lighthouse bridé (4G + CPU ×4) donne 0,116. Les deux sont vraies : c'est la mesure bridée qui correspond au terrain et au critère « ≥ 90 ». Les écarts sont normaux, je les conserve tels quels.

### B-API-01 — Annonces en doublon, et deux annonces au titre identique · moyenne · nouveau · données Apimo

**1. Le même bien publié deux fois.** `86938526` et `86942704` : Écully, 183 m², 849 000 €, 7 pièces, 26 photos, **les deux premières photos sont les mêmes fichiers** (`…_1448-original.jpg`, `…_3344-original.jpg`), référence d'accord « 685 » identique, création à 2 jours d'intervalle (22/04 et 24/04). Les deux pages existent et sont indexables : `/fr/acheter/86938526` → HTTP 200 (28 535 o), `/fr/acheter/86942704` → HTTP 200 (28 496 o).

**2. Deux annonces distinctes au titre identique.** Dans la liste, la carte « **Lyon 2ème 40m² — Lyon 2ème** » apparaît **deux fois** (biens `87121066` et `87217353`).

**Cause.** Les données Apimo, pas le code. Le pré-rendu gère la collision côté référencement (les deux `<title>` se terminent par `· réf. <id>`, donc distincts), mais **les cartes de la liste affichent le même libellé** : le visiteur ne peut pas faire la différence entre deux annonces à 40 m² dans le même arrondissement.

**Solution.** Côté agence : dépublier l'un des deux Écully (doublon réel). Côté code : ajouter un discriminant court aux cartes en collision (pièces, réf., ou prix) plutôt que de laisser deux libellés identiques.

### B-DATA-01 — Une fiche s'appelle « Bien immobilier », et 5 filtres ne peuvent rien renvoyer · moyenne · nouveau · `/fr/acheter/87336703` + filtre Type

**1. Fiche sans surface.** `87336703` (Lyon 7ème, commerce, 2 pièces, 145 800 €, 1 photo) n'a **pas de surface** dans Apimo :
```html
<title>Bien immobilier · commerce · réf. 87336703 — Hamac Investissements & Patrimoine</title>
<h1>Bien immobilier</h1>
```
La ville est connue, mais elle disparaît du titre et du h1. Cause : `src/services/apimo.ts:367-368` compose le titre `ville + surface` et ne retombe sur un repli que lorsque la surface manque.
**Solution :** repli en cascade `type + ville` (« Commerce à Lyon 7ème ») avant le générique « Bien immobilier ».

**2. Options de filtre sans données.** Le filtre « Type » propose 8 options (Tous, Maison, Appartement, Terrain, Commerce, Bureau, Garage/Parking, Immeuble). L'API ne contient que **appartement (63), maison (25), commerce (6)** : **terrain, bureau, garage et immeuble n'existent pas** → 4 options qui renvoient systématiquement zéro résultat, sans explication.
**Solution :** construire la liste des types à partir des biens réellement présents.

### B-FIN-01 — Finitions (5 points) · basse

1. **« Confidentialite » sans accent** dans le pied de page, présent sur toutes les pages (le reste du pied de page est accentué : « Mentions légales », « Honoraires »). Correction : « Confidentialité ».
2. **La page 404 se canonicalise vers l'URL inexistante** : `<link rel="canonical" href="https://hamacpatrimoine.com/fr/url-inexistante-audit-42">`. Le 404 HTTP et le `noindex` sont corrects, mais la canonique est contradictoire. Correction : retirer la canonique sur la 404 (ou la pointer vers `/fr/`).
3. **Contraste** insuffisant sur la bande « VOUS VENDEZ ? … » (UX-02 de l'audit A, non re-mesuré ici).
4. **`@cloudflare/stream-react`** toujours installée et jamais importée (DET-02). À noter : les **vidéos Cloudflare Stream sont réelles** (6 identifiants testés : lecteur 200, vignette 200) mais elles ne vivent que dans le module « visites privées » codé en dur — **aucune fiche de bien n'a de vidéo**, contrairement à ce que le brief de test supposait.
5. **`supabase/.temp` toujours suivi par git** : 8 entrées dans l'index, malgré `.gitignore:27` (`supabase/.temp/`). Un fichier déjà suivi n'est pas dé-ignoré par une règle `.gitignore` — voir la réserve sur le Prompt 1 ci-dessous.

### Ce que les tests réels CONFIRMENT de l'audit A

| Audit A | Statut après tests réels | Ce qui l'établit |
|---|---|---|
| DEMO-01 — biens fictifs | **confirmé** | « Villa contemporaine · 1 250 000 € · 210 m² · 5 ch. » toujours dans le DOM des 3 pages quartiers sur le build de 17:45 |
| ARCH-02 — bien inexistant en 200 | **confirmé** | `/fr/acheter/<id inconnu>` répond 200 avec la coquille et `robots: index,follow` |
| ARCH-04 — aucune notification | **confirmé** | formulaire exécuté de bout en bout : la demande part bien vers Supabase, **aucun email/webhook** ne suit |
| SEC-01 — proxy ouvert | **confirmé** | `POST /functions/v1/apimo-proxy` **sans aucun en-tête d'authentification** → **HTTP 200** |
| SEO-01 — og:image en 404 | **confirmé** | `curl` sur l'URL de `src/config/site.ts:16` → 404 ; `twitter:image` utilise la même URL |
| SEO-02 — redirections legacy | **confirmé** | URL exacte de l'ancien site : forme `+` → **404**, forme `%2B` → **200** (229 URLs `propriete` dans la liste de l'ancien site) |
| SEC-02 — aucun en-tête de sécurité | **confirmé** | seuls HSTS + en-têtes Vercel présents |
| SEC-03 — formulaire sans anti-abus | **confirmé** | aucun captcha, aucun champ piège dans le DOM du formulaire |
| PERF-02 — aucune image responsive | **confirmé** | 34/34 images sans `srcset` sur l'accueil, 13/13 sur une fiche |
| UX-01 — accueil mobile trop long, cibles trop petites | **confirmé** | **17,5 écrans** de haut à 375 px ; **90 des 111** zones tactiles < 44 px ; police minimale 10 px |
| API-02 — la fiche télécharge tout le catalogue | **confirmé** | 1 appel `apimo-proxy` par page, réponse contenant le catalogue complet, 410-958 ms |
| PERF-03 — pas de cache long | **confirmé** | `cache-control: public, max-age=0, must-revalidate` sur le document |
| **Nouveau (B-UX-02)** — menu mobile | **confirmé** | menu ouvert : `body` reste `overflow: visible` et la page **défile derrière** (700 px parcourus menu ouvert) |

### Ce que les tests réels n'ont PAS reproduit

| Audit A | Statut | Détail |
|---|---|---|
| API-01 — écran « Erreur de chargement » | **non reproduit** | 12 appels mesurés entre **410 et 958 ms**, tous en 200, aucun « Délai de chargement dépassé » en console. Le défaut reste réel (timeout client 10 s < pire cas serveur 30 s) : il ne s'est simplement pas produit pendant les tests. **À ne pas supprimer du rapport.** |
| UX-02 — contraste | **non re-testé** | dépendait du rapport Lighthouse ; l'audit A le conservait déjà comme basse. |

### Validation du Prompt 1 (ARCH-01) — **validé avec une réserve**

| Critère d'acceptation | Mesure | Verdict |
|---|---|---|
| `vercel.json` du dépôt ne contient plus la clé `routes` | `git show HEAD:vercel.json \| grep -c '"routes"'` → **0** | ✅ |
| La production correspond au commit | commit `5a16f5b` à 17:32, déploiement à **17:45 GMT** ; les redirections témoins sont servies (`/en/` → 308, `/fr/selection` → 308, `/es/aviso-legal` → 308) | ✅ |
| Le sitemap est à jour | **120 URLs** (contre 115 avant) | ✅ |
| `supabase/.temp` retiré du suivi git | `git ls-files \| grep -c supabase/.temp` → **8** | ❌ **réserve** |

**Réserve à traiter (à ajouter au prochain passage sur le dépôt) :** `.gitignore:27` contient bien `supabase/.temp/`, mais un fichier **déjà suivi** n'est pas ignoré : les 8 entrées restent dans l'index (`git ls-files`), et `git status` continuera de les afficher. Il faut `git rm -r --cached supabase/.temp` (ce qui **ne supprime rien sur le disque**) puis committer. C'est un ajout de 2 lignes au diff, pas un nouveau chantier.

**Conséquence sur les priorités :** ARCH-01 sort des prompts prioritaires (validé), SEO-03 et SEO-04 sortent aussi (réglés par le même commit). Ils sont remplacés par les deux constats critiques de l'audit B.

### Revue du Prompt 2 — `c12ecc9` « retirer les biens fictifs des pages quartiers » · 17:50 · **validé sur le diff, vérification en ligne en attente**

**Ce que fait le commit** (3 fichiers, +136 / −376) :
- `src/data/properties.ts` : **303 lignes supprimées** — les 13 biens statiques ont disparu, il ne reste que les types. ✅
- `src/hooks/useProperties.ts` : le hook `useProperties` (qui filtrait `PROPERTIES`) et `getPropertyBySlug` sont supprimés ; seuls les types restent. ✅
- `src/pages/NeighborhoodPage.tsx` : la page appelle maintenant `getProperties()` (données Apimo réelles), avec une machine à états explicite `'loading' | 'ok' | 'empty' | 'quota' | 'timeout' | 'network'`, un mappeur `toPropertyCard`, une image de repli, une annulation propre au démontage, et le cas « commune inconnue » n'écrase plus les métadonnées. ✅

**Verdict : le diff est bon, je l'accepte.** Le critère principal de mon prompt (« plus aucun bien fictif dans le HTML servi ») est **structurellement** tenu : les données ne peuvent plus venir que de l'API.

**Deux points de contrôle à faire au prochain déploiement** (ils ne peuvent pas être validés tant que la production n'a pas reconstruit — elle sert encore le build de 17:45, `last-modified: 15:45:31 GMT`, avec « Villa contemporaine » **2 fois** dans le HTML de `/fr/quartiers/sainte-foy-les-lyon`) :

1. **Risque de pré-rendu vide ou en erreur.** La page quartier dépend désormais d'un appel réseau au moment où Chromium pré-rend la page au build. Si l'API Apimo est lente ou si le quota est atteint à ce moment-là, le HTML figé pourrait contenir **l'état `'loading'`, `'quota'` ou `'network'`** au lieu des biens. À vérifier sur le build déployé : `curl https://…/fr/quartiers/ecully | grep -c "bien-card__title"` doit valoir **0** (plus de faux bien) et le HTML ne doit contenir **aucun message d'erreur ni « Chargement »**. Si c'est le cas, la page perd son contenu indexable : il faudra alors garder le pré-rendu alimenté par l'instantané `data/apimo-routes.json` (ou accepter une page commune sans biens, ce qui est défendable).
2. **Écart assumé par rapport au critère.** Mon prompt demandait « les biens réels **ou** un état vide explicite ». Le commit retient « **sans correspondance, la section disparaît** » (message de commit). C'est un choix défendable (pas de « 0 résultat » sur une page vitrine) — **je ne le refuse pas**, à condition que la disparition soit propre (pas de bloc vide avec un titre orphelin). À contrôler visuellement sur une commune sans bien (`Francheville`, `Craponne` ou `Oullins`).

**Ce qu'il reste à faire quand le déploiement sera passé :** les deux contrôles ci-dessus, puis DEMO-01 passera de « corrigé dans le dépôt » à « corrigé en ligne ». En attendant, **la production reste porteuse du défaut** : je ne classe pas DEMO-01 comme résolu.

---



## CE QUI MARCHE DÉJÀ (à ne pas casser)

- **Pré-rendu par page réellement en production** : les 115 URL du sitemap renvoyaient **115 empreintes sha1 distinctes**, aucune page réduite ; **120 URLs au 29/09 après `5a16f5b`**, toutes vérifiées une par une (0 page sans titre, 0 sans description). Titres uniques, **1 seule** `canonical` par page, 1 bloc JSON-LD, `<h1>` et corps réel dans le HTML brut (fiche = 25 Ko, 36 photos). C'est le travail le plus difficile du projet, et il est fait.
- **Aucune erreur de console, sur aucune page testée** (accueil, catalogue, carte, 3 fiches, contact, 404, agence, mentions légales, quartiers) — 0 erreur, 0 avertissement, y compris après hydratation.
- **La 404 est une vraie 404** : `/fr/url-inexistante-audit-42` → HTTP 404, page « Page introuvable », `robots: noindex,follow`.
- **Le formulaire de contact fonctionne** : la demande part bien vers `POST /rest/v1/leads` (clé anon, politique RLS d'insertion vérifiée), un message de confirmation s'affiche et le formulaire se vide ; en cas d'échec serveur, le message « Une erreur est survenue… » s'affiche et le bouton reste utilisable.
- **Aucune clé secrète côté client** : 0 occurrence de `service_role` / `APIMO_TOKEN` dans le bundle ; seule la clé anon circule, ce qui est le fonctionnement normal de Supabase.
- **Le formulaire gère les champs vides** par la validation native du navigateur (aucune requête envoyée), et ses champs sont correctement associés à leurs libellés (chaque `input` est dans son `<label>`).
- **Carte du catalogue fonctionnelle sur desktop** : Leaflet présent, 4 tuiles chargées, 52 marqueurs, support tactile actif.
- **Iframe Google Maps des fiches** : l'URL `maps.google.com/maps?q=…&output=embed` redirige (301) vers `www.google.com/maps/embed` → **HTTP 200**, la carte s'affiche sans clé d'API.
- **Vidéos Cloudflare Stream réelles** : les 6 identifiants du module « visites privées » répondent (lecteur 200, vignette 200).
- **Open Graph des fiches** : `og:title`, `og:description` (vrai texte Apimo) et `og:image` en **JPEG 1200×630 servi par `media.apimo.pro`** — donc valide pour WhatsApp/Facebook. Vérifié sur `/fr/acheter/87355426`.
- **Aucun secret côté client** : `grep` sur le bundle servi → 0 occurrence de `service_role`, 0 de `APIMO_TOKEN` ; le token Apimo reste dans les secrets de l'edge function. `.gitignore` couvre bien `*.local` (donc `.env.local`), seul `.env.example` est versionné.
- **RLS Supabase effective** : avec la clé anon publique, `GET /rest/v1/leads` renvoie `[]` (aucune donnée prospect lisible) et `apimo_cache` renvoie **42501 permission denied**. Le proxy ne circule que dans un sens.
- **Routage et bascule** : `/` → 308 `/fr/`, `/en/` → 308, `/es/aviso-legal` → 308 `/fr/mentions-legales`, `/fr/selection` → 308 `/fr/off-market`, URL inconnue → **404 réel**, `/fr/robots.txt` et sitemap servis, HSTS actif avec `preload`.
- **Mobile sur la fiche bien** : prix à 0,93 écran, barre d'action collante « Envoyer ma demande » (68 px, fond fixe), aucun débordement horizontal (`scrollWidth = 390` sur toutes les pages mesurées), champs de formulaire à 16 px / 45 px.
- **Propreté du code** : `tsc --noEmit` = 0 erreur, 0 `TODO`/`FIXME` dans `src/`, palette dorée remplacée (plus de `#c5a96a`).

## CE QUE JE N'AI PAS PU VÉRIFIER

1. **L'état réel des policies RLS** : `DELETE /rest/v1/leads` renvoie **204**, ce qui est compatible *à la fois* avec une suppression bloquée par RLS et avec une suppression de 0 ligne. Le fichier SQL du dépôt ne crée qu'une policy d'INSERT — à confirmer côté dashboard (`select relname, relrowsecurity from pg_class where relname='leads'` + liste des policies). **Ce que les tests réels ont ajouté** : l'insertion anonyme est bien **autorisée** (charge utile invalide → `PGRST204` et non `42501`), donc la policy d'INSERT existe et s'applique — mais je n'ai toujours pas écrit de ligne pour aller plus loin. Je n'ai pas écrit dans la table du client pour trancher.
2. **L'existence d'un webhook/trigger Supabase côté dashboard** (ARCH-04) : invisible dans le dépôt.
3. **L'origine du déploiement du 28/09 22:03** (ARCH-01) : la liste des déploiements Vercel n'a jamais pu être lue (`npx vercel ls` → timeout, exit 124 — **encore vrai le 29/09**). Sans objet depuis que la production et le dépôt sont alignés, mais la cause du décalage initial reste une hypothèse.
4. **Lighthouse sur une fiche bien** : la passe n'a pas abouti. Deux tentatives n'ont jamais démarré — le paquet `lighthouse` lancé par `npx` n'a pas pu être téléchargé (`npm error code ETIMEDOUT`, `network read`) — et la tentative manuelle a rendu `NO_FCP` (« The page did not paint any content »). Les chiffres donnés portent donc uniquement sur `/fr/` et `/fr/acheter`, et les mesures LCP de l'accueil sont instables (8,8 s puis 23,6 s) : à reconfirmer par PageSpeed Insights, qui mesure depuis un banc d'essai distant et non depuis ce Mac.
5. **Le quota Apimo réel** et son heure de remise à zéro (contrat client).
6. **La soumission réelle du formulaire** (une ligne écrite en base) : volontairement non faite pour ne pas polluer la table `leads` du client. La chaîne est prouvée jusqu'à l'autorisation d'insertion, pas jusqu'à la ligne. Proposé : je le fais avec une ligne marquée « TEST AUDIT », sur ton accord, puis je la supprime.
7. **L'INP** : non mesuré. L'observateur d'événements du navigateur n'a enregistré aucune interaction dépassant 16 ms ; aucune valeur ne peut être affirmée (le TBT de Lighthouse, lui, est à 0-20 ms, ce qui suggère un INP sain).
8. **Le CLS des fiches en conditions bridées** : mes 4 mesures de 0,45 sont faites hors bridage réseau. La valeur passerait probablement au-dessus en 4G bridée, mais je ne l'affirme pas sans mesure — à confirmer via PageSpeed Insights.
9. **Les mesures basses/contraste** (UX-02) : dépendantes d'un rapport Lighthouse qui n'a pas pu être relancé sur les pages concernées.

---

## ⚠️ ÉTAPE 3 — LES 5 PROMPTS CURSOR PRIORITAIRES — **version 1, périmée**

> **Ne pas utiliser cette version.** Elle date de l'audit A (28/09). Depuis : le **Prompt 1 est réglé et validé** (commit `5a16f5b`), le **Prompt 2 est poussé** (`c12ecc9`, 17:50 — diff accepté, à revérifier en ligne), le **Prompt 3 reste d'actualité** (inchangé) et le **Prompt 4 est conservé** (même cible). En revanche le **Prompt 5 est déclassé** et **deux constats critiques/haute nouveaux** prennent les places 1 et 5.
> **→ Utiliser la section « ÉTAPE 3 (version 2) — les 5 prompts à jour », plus bas dans ce fichier.**

Ordre choisi : d'abord ce qui empêche les autres corrections d'être fiables (ARCH-01), puis l'incident commercial en cours (DEMO-01), puis les deux points qui décident de la valeur du site (notifier les leads, réussir la bascule), puis la correction la plus rapide et la plus visible (aperçus sociaux).
**Un prompt = un commit.** Les prompts 2 à 5 se donnent l'un après l'autre, jamais en parallèle (ils touchent tous `vercel.json` ou `src/`).

### Prompt 1 — Aligner la production et le dépôt (ARCH-01)

**Objectif.** Faire en sorte que ce qui tourne en production soit exactement le contenu de `main`.

**Fichiers à committer tels quels** (déjà modifiés, non commités) : `vercel.json`, `scripts/generate-sitemap.ts`, `scripts/build-legacy-redirects.mjs`, `data/apimo-routes.json`.
**À retirer du suivi** : `supabase/.temp/cli-latest`, et ajouter `supabase/.temp/` à `.gitignore`.
**À ne pas toucher** : tout `src/**` (aucune modification de code dans ce commit).

**Étapes.**
1. `git status --short` puis `git diff` : vérifier que `vercel.json` contient bien la clé `rewrites` et **plus** la clé `routes`, et que `generate-sitemap.ts` contient `productionHost`.
2. `git rm --cached supabase/.temp/cli-latest`, ajouter la ligne au `.gitignore`.
3. Un seul commit, puis push sur `main`.
4. Attendre la fin du déploiement Vercel (`Ready`), puis exécuter les commandes de vérification ci-dessous.

**Critères d'acceptation.**
- `git status --short` → vide ; `git status -sb` → pas de `ahead`.
- `git show HEAD:vercel.json | grep -c '"routes"'` → **0**.
- `curl -sI https://hamac-site.vercel.app/fr/` → `last-modified` **postérieur** au push.
- `/en/` → 308, `/fr/selection` → 308, `/es/aviso-legal` → 308 (comportement identique à aujourd'hui : c'est le but — ne rien casser).

**Commandes de vérification.**
```
git status --short
git show HEAD:vercel.json | grep -c '"routes"'
curl -sI https://hamac-site.vercel.app/fr/ | grep -i last-modified
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://hamac-site.vercel.app/en/
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://hamac-site.vercel.app/fr/selection
```

### Prompt 2 — Retirer les biens fictifs des pages quartiers (DEMO-01)

**Objectif.** Les 6 pages `/quartiers/<commune>` n'affichent que des biens réels venant de l'API Apimo.

**Fichiers à modifier** : `src/pages/NeighborhoodPage.tsx` (ligne 22), `src/hooks/useProperties.ts`, `src/data/properties.ts` (ne garder que les types `Property`, `Amenity`, `PropertyType`).
**À ne pas toucher** : `src/services/apimo.ts`, `src/pages/PropertyListingPage.tsx`, `vercel.json`, `src/pages/HomePage.tsx`.

**Étapes.**
1. Dans `NeighborhoodPage.tsx`, remplacer `useProperties({ city: neighborhood.name }, 'recent')` par un chargement Apimo : `getProperties()` puis filtre sur `city === neighborhood.name` (même source que `/acheter`).
2. Reprendre les états existants de `/acheter` : chargement, aucun bien, erreur/quota. **Si aucun bien ne correspond, la section ne doit pas s'afficher du tout** (pas de bloc vide).
3. Supprimer les 13 biens en dur de `src/data/properties.ts` et les fonctions qui les exposent (`PROPERTIES`, `useProperties`, `getPropertyBySlug`) si plus aucun import ne les utilise.
4. Vérifier les 6 pages : `sainte-foy-les-lyon`, `tassin-la-demi-lune`, `ecully`, `francheville`, `craponne`, `oullins`.

**Critères d'acceptation** (état « avant » mesuré sur le build du 29/09).
- Occurrences de bien fictif dans les pages quartiers : **6 aujourd'hui** (`grep -ro … | wc -l`, soit 2 par page sur 3 pages) → attendu **0**.
- Aucun titre de bien statique (`Villa contemporaine`, `Appartement familial`, `Maison bourgeoise`) dans le HTML de `dist/fr/quartiers/**`.
- `npx tsc --noEmit` → 0 erreur ; `grep -rn "from '.*data/properties'" src/pages/` → 0 résultat.

**Commande de vérification.**
```
npm run build
grep -roiE "villa contemporaine|appartement familial|maison bourgeoise" dist/fr/quartiers/ | wc -l   # aujourd'hui 6, attendu 0
npx tsc --noEmit
```
À contrôler aussi sur le site en ligne après déploiement (la commande ci-dessus porte sur le build local) : `curl -s https://hamac-site.vercel.app/fr/quartiers/sainte-foy-les-lyon | grep -c "Villa contemporaine"` → attendu 0.

### Prompt 3 — Notifier l'agence à chaque demande reçue (ARCH-04)

**Objectif.** Chaque ligne insérée dans `public.leads` déclenche un email à l'agence.

**Fichiers à créer** : `supabase/functions/notify-lead/index.ts` (email via Resend), `supabase/migrations/<horodatage>_notify_lead_on_insert.sql` (déclencheur `AFTER INSERT ON public.leads` → appel de la fonction avec la clé `service_role`), mise à jour de `supabase/config.toml` (`verify_jwt = true` **pour cette fonction seulement**).
**À ne pas toucher** : `src/services/leads.ts`, `src/pages/ContactPage.tsx`, `apimo-proxy` (traité séparément), `vercel.json`.

**Étapes.**
1. Fonction : lit `RESEND_API_KEY`, `LEAD_NOTIFY_TO`, `LEAD_NOTIFY_FROM` ; compose un email court (nom, email, téléphone, message, `bien_ref`, URL d'origine) ; répond 200 ; journalise les échecs sans exposer le détail.
2. Secrets : `supabase secrets set RESEND_API_KEY=… LEAD_NOTIFY_TO=agence@hamacpatrimoine.com`.
3. Déclencheur SQL sur `public.leads` (insert only), condition `when (new.type_contact is not null)`.
4. Test : insérer une ligne de test, vérifier la réception, **puis la supprimer** (avec la clé service_role, pas la clé anon).

**Critères d'acceptation.**
- Une insertion de test produit un email en moins de 30 s.
- `curl` de la fonction **sans** en-tête `Authorization` → **401**.
- Le bundle client servi ne contient aucune occurrence de `RESEND` ni de `service_role` (`curl -s <bundle> | grep -c RESEND` → 0).
- Le site continue d'accepter le formulaire (une soumission réelle arrive bien dans la table + email).

**Commande de vérification.**
```
supabase functions deploy notify-lead
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://lxkhozdshbpdjnanbnzi.supabase.co/functions/v1/notify-lead"   # attendu : 401
curl -s https://hamac-site.vercel.app/fr/assets/<bundle>.js | grep -c RESEND                                              # attendu : 0
```

### Prompt 4 — Réparer les redirections des fiches de l'ancien site (SEO-02)

**Objectif.** Les ~710 URL de l'ancien site répondent 301 vers la bonne page, **sous la forme réellement indexée (avec `+`)**.

**Fichiers à modifier** : `scripts/build-legacy-redirects.mjs` (la cause), `vercel.json` (régénéré), `scripts/check-legacy-redirects.mjs` (le contrôle).
**À ne pas toucher** : tout `src/**`, `scripts/prerender.ts`, `scripts/generate-sitemap.ts`.

**Étapes.**
1. Dans le générateur : décoder le chemin avant de l'écrire dans `source` (le `+` doit rester un `+` littéral, jamais `%2B`), et ne jamais écrire une règle dont la source égale la destination.
2. Régénérer `vercel.json` et vérifier le volume : **≤ 2 048 règles**.
3. Contrôler avec des URL réelles prises dans `~/hamac-briefs/ANCIEN-SITE-urls.csv` — **jamais** en recopiant la source depuis `vercel.json` (c'est cette erreur qui a produit le défaut) :
   - `/fr/propriete/location+appartement+irigny+location-irigny-appartement-grand-t3-de-70m2-avec-balcon-+85304702` → attendu 308 vers `/fr/louer`
   - une URL `/en/property/...` comportant des `+` → attendu 308
   - `/es/aviso-legal` → attendu 308 vers `/fr/mentions-legales` (non-régression : fonctionne déjà)
4. Ajouter au script de contrôle : aucune règle en `%2B`, aucune boucle, total ≤ 2 048.

**Critères d'acceptation.**
- `grep -c '%2B' vercel.json` → **0**.
- Les 3 URL témoins ci-dessus renvoient 308 vers la destination attendue depuis `hamac-site.vercel.app` **après** déploiement.
- `grep -c '"source"' vercel.json` ≤ 2 048.
- Aucune page existante cassée : `/fr/acheter`, `/fr/acheter/87355426`, `/fr/quartiers/tassin-la-demi-lune` → 200 après déploiement.

**Commande de vérification.**
```
grep -c '%2B' vercel.json
grep -c '"source"' vercel.json
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://hamac-site.vercel.app/fr/propriete/location+appartement+irigny+location-irigny-appartement-grand-t3-de-70m2-avec-balcon-+85304702"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://hamac-site.vercel.app/es/aviso-legal"
```

### Prompt 5 — Réparer l'image d'aperçu social (SEO-01)

**Objectif.** Toute page partagée sur WhatsApp / Facebook / LinkedIn affiche une image qui existe réellement.

**Fichiers à modifier** : `src/config/site.ts:16` (et l'usage de `DEFAULT_OG_IMAGE`), `index.html:24-31`, `scripts/inject-route-heads.ts` si l'`og:image` y est composé.
**À ne pas toucher** : `src/services/apimo.ts`, les photos Apimo (`media.apimo.pro` — déjà en JPEG et valides), `vercel.json`.

**Étapes.**
1. Introduire une origine « telle que servie » : `VERCEL_PROJECT_PRODUCTION_URL` quand elle est disponible (même signal que celui déjà écrit pour `robots.txt` dans le working tree), avec repli sur `SITE_ORIGIN`.
2. Composer `DEFAULT_OG_IMAGE` (et `og:url`) avec cette origine, en conservant `media.apimo.pro` pour les fiches.
3. Aligner `index.html` sur la même valeur pour que la coquille et le pré-rendu déclarent la même URL.
4. Vérifier sur trois pages de natures différentes : accueil, une fiche, une page sans photo.

**Critères d'acceptation** (état actuel mesuré en face de chaque attendu).
- `curl -sI https://hamacpatrimoine.com/fr/images/og/hamac-og-1200x630.jpg` → aujourd'hui **404** ; l'URL déclarée en ligne ne doit plus être celle-là tant que le domaine n'est pas basculé.
- Sur `https://hamac-site.vercel.app`, l'image déclarée répond **200 `image/jpeg` 1200×630** : `curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" <og:image>`.
- Aucun changement sur les fiches : `og:image` reste une URL `media.apimo.pro` (vérifié aujourd'hui : 200 JPEG).
- Après la bascule de domaine, la même vérification sur `hamacpatrimoine.com` doit passer **sans modification de code**.

**Commande de vérification.**
```
curl -s -A "facebookexternalhit/1.1" https://hamac-site.vercel.app/fr/ | grep -oE '<meta property="og:(image|url)"[^>]*>'
curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" "<l'URL trouvée ci-dessus>"
curl -s -A "facebookexternalhit/1.1" https://hamac-site.vercel.app/fr/acheter/87355426 | grep -oE '<meta property="og:image"[^>]*>'
```

---

---

## ÉTAPE 3 (version 2) — LES 5 PROMPTS À JOUR (29/09)

**Ce qui change par rapport à la version 1.** `ARCH-01`, `SEO-03` et `SEO-04` sont **réglés** (commit `5a16f5b`, validé plus haut) → ils sortent. Les constats **B-ARCH-01** (critique) et **B-UX-01** (haute) entrent. `SEO-01` (og:image) sort du top 5 mais reste prêt, à faire juste après.
**Un prompt = un commit.** Les prompts 1 et 2 **peuvent être menés en parallèle** : ils ne touchent pas les mêmes fichiers (c'est volontaire, l'un ne peut pas casser l'autre). Les prompts 3, 4 et 5 se donnent l'un après l'autre.

### Prompt 1 — Afficher toutes les annonces du catalogue (B-ARCH-01) · **critique**

**Objectif.** `/fr/acheter` doit présenter les **87 annonces de vente** (aujourd'hui plafonnées à 32) avec un compteur visible.

**Fichiers à modifier :** `src/pages/PropertyListingPage.tsx` · `src/style.css` **uniquement** si le style du compteur/bouton l'exige.
**Fichiers à ne pas toucher :** `src/data/properties.ts`, `src/hooks/useProperties.ts` (le Prompt 2 travaille dessus en ce moment), `vercel.json`, `scripts/**`, `supabase/**`.

**Étapes.**
1. Remplacer la constante figée de `PropertyListingPage.tsx:123` par une pagination réelle : soit tout afficher, soit un bouton « Voir plus » qui ajoute 32 annonces par clic.
2. Ajouter un **compteur visible** au-dessus de la grille (« 87 biens »), alimenté par le nombre d'annonces **après filtres**.
3. Conserver le reset au changement de filtre (`:386`) mais s'assurer qu'il ne re-plafonne pas à 32 après un « Voir plus ».
4. Mettre la carte et la grille d'accord (aujourd'hui : 52 marqueurs pour 32 cartes).

**Critères d'acceptation.**
- `document.querySelectorAll('.bien-card').length` = **87** (ou 32 → 64 → 87 après deux clics sur « Voir plus »).
- Le compteur affiché = ce même nombre.
- Filtrer « Maison » fait baisser le compteur et la grille de la même façon (aucune régression).
- Aucune erreur de console ajoutée.

**Commandes de vérification.**
```
npx tsc --noEmit                      # 0 erreur
npm run build                         # EXIT=0
# puis, dans la console du navigateur sur /fr/acheter :
document.querySelectorAll('.bien-card').length
```

### Prompt 2 — Retirer les biens fictifs (DEMO-01) · **critique** · ✅ **déjà poussé** (`c12ecc9`, 29/09 17:50)

> **Ce prompt a été exécuté.** Le diff est accepté (voir « Revue du Prompt 2 »). Il ne reste que la **vérification en ligne après redéploiement** : `curl …/fr/quartiers/ecully | grep -c "bien-card__title"` → **0**, et aucun « Chargement » ni message d'erreur figé dans le HTML. Les critères ci-dessous servent à cette vérification.

**Objectif.** Plus aucun bien fictif dans le HTML servi ni dans ce que voit un visiteur.

⚠️ Le working tree contient **déjà** des modifications sur `src/data/properties.ts` et `src/hooks/useProperties.ts`. **Partir de cet état, ne rien perdre**, et ne pas repartir de zéro.

**Fichiers à modifier :** `src/pages/NeighborhoodPage.tsx`, `src/hooks/useProperties.ts`, `src/data/properties.ts`.
**Fichiers à ne pas toucher :** `src/pages/PropertyListingPage.tsx` (Prompt 1 en parallèle), `vercel.json`.

**Étapes.**
1. `NeighborhoodPage` lit les biens **réels** (`getProperties()` filtré sur la ville) avec les trois états : chargement, vide, erreur — même traitement que `/acheter`.
2. Réduire `src/data/properties.ts` à ses **types** : supprimer les 13 biens statiques.
3. Vérifier qu'aucun autre fichier ne les importe.

**Critères d'acceptation.**
- `grep -rn "Villa contemporaine\|Maison bourgeoise\|Appartement familial\|1 250 000" dist/` → **0 résultat**.
- Les 3 pages quartiers concernées (`sainte-foy-les-lyon`, `tassin-la-demi-lune`, `ecully`) affichent des biens réels ou un état vide explicite.
- Le build passe et le pré-rendu reste complet (120 routes).

**Commandes de vérification.**
```
npm run build
grep -rn "Villa contemporaine\|Maison bourgeoise\|Appartement familial\|1 250 000" dist/ | wc -l   # 0
grep -rn "from '@/data/properties'" src/ | wc -l                                                  # 0
```

### Prompt 3 — Prévenir l'agence à chaque demande reçue (ARCH-04) · **haute**

**Objectif.** Toute ligne insérée dans `leads` déclenche un email à l'agence : plus aucun prospect perdu en silence.

⚠️ **À ne lancer qu'avec** l'**adresse de réception** et une **clé d'envoi** (Resend ou SMTP). Sans elles, ne pas commencer.

**Fichiers à modifier :** nouvelle fonction `supabase/functions/notify-lead/index.ts` **ou** trigger Postgres (`after insert on public.leads`) + `supabase/config.toml`.
**Fichiers à ne pas toucher :** tout `src/**` — le formulaire fonctionne, il n'a pas besoin d'être modifié (prouvé lors des tests réels).

**Étapes.**
1. Déclencher sur `after insert on public.leads`.
2. Envoyer nom, email, téléphone, message, bien concerné, date.
3. En cas d'échec d'envoi : **la ligne reste en base**, l'erreur est journalisée.
4. Écrire la procédure de test dans le README.

**Critères d'acceptation.**
- Une insertion de test produit un email réellement reçu (fournir l'identifiant d'envoi du fournisseur).
- Un échec d'envoi simulé laisse la ligne en base et une trace dans les logs.
- Aucun changement visible du formulaire.

**Commandes de vérification.**
```
# insertion d'une ligne marquée TEST AUDIT, puis suppression
supabase functions logs notify-lead      # trace d'envoi attendue
```

### Prompt 4 — Réparer les redirections des fiches de l'ancien site (SEO-02) · **haute**

**Objectif.** Les URLs `…/propriete/…` réellement indexées (forme `+`) doivent rediriger vers la fiche correspondante au lieu de renvoyer 404.

**Fichiers à modifier :** `vercel.json` (+ éventuellement un middleware Edge si la table littérale est abandonnée).
**Fichiers à ne pas toucher :** `src/**`.

**Étapes.**
1. Trancher : (a) remplacer les 681 sources `%2B` par la forme `+` — rapide, mais fragile ; ou (b) un middleware qui normalise l'encodage et extrait l'`id` final — plus robuste et insensible aux variantes.
2. Vérifier la limite des 2 048 redirections Vercel et l'absence de boucle.
3. Vérifier que les fiches **nouvelles** (`/fr/acheter/<id>`) ne sont pas capturées.

**Critères d'acceptation** (les deux sont en échec aujourd'hui, mesuré).
- URL exacte de l'ancien site avec `+` → **301/308** (aujourd'hui **404**).
- Même URL en `%2B` → **301/308** (aujourd'hui 200 sur la coquille).
- `/fr/acheter/87355426` → toujours **200**.

**Commandes de vérification.**
```
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
  'https://hamac-site.vercel.app/fr/propriete/vente+appartement+lyon-5eme+<fin-de-slug>'
# même URL avec %2B à la place de +
curl -s -o /dev/null -w '%{http_code}\n' 'https://hamac-site.vercel.app/fr/acheter/87355426'
```

### Prompt 5 — Réparer la vue « Carte » sur mobile (B-UX-01) · **haute**

**Objectif.** Sur mobile, la vue carte doit tenir dans l'écran : aujourd'hui 9 558 px de large → 8 090 px de débordement horizontal.

**Fichiers à modifier :** `src/style.css` (chaîne `.catalog-map-view` → `.catalog-map-stage` → `.property-map`).
**Fichiers à ne pas toucher :** `src/pages/PropertyListingPage.tsx` (Prompt 1), `vercel.json`.

**Étapes.**
1. Contraindre la largeur sur toute la chaîne : `width: 100%; max-width: 100%; min-width: 0` — et vérifier les conteneurs parents flex/grid (c'est là que la largeur se perd).
2. Ne rien changer au rendu desktop (1 006 px, aucun débordement aujourd'hui).
3. Vérifier que la carte reste utilisable au doigt (zoom, déplacement).

**Critères d'acceptation.**
- À 375 px : `document.documentElement.scrollWidth` = **375** (aujourd'hui 9 590) et `.leaflet-container` ≈ 375 px.
- À 1440 px : `scrollWidth` = 1 440 (aucune régression).
- La carte reste interactive sur mobile.

**Commandes de vérification.**
```
# console, à 375 px, sur /fr/acheter?view=map
document.documentElement.scrollWidth
document.querySelector('.leaflet-container').getBoundingClientRect().width
```

### Juste après le top 5 (par ordre d'impact)
6. **SEO-01** — l'`og:image` en 404 : une ligne dans `src/config/site.ts:16`. C'est l'aperçu de **tout** le site sur WhatsApp/LinkedIn/Facebook. 10 minutes.
7. **B-PERF-01** — réserver les dimensions des images (CLS 0,45 sur les fiches de biens).
8. **B-DATA-01** — repli de titre `type + ville`, et liste des types de biens alimentée par les données réelles.
9. **SEC-01** — fermer le proxy Apimo (aujourd'hui appelable par n'importe qui : `POST` sans clé → 200).

---

## PROTOCOLE DE REVUE (à suivre pour les 5 prochaines sessions)

À chaque tour, je reçois **le git diff** de la correction et **ce fichier**. Je rends :
1. **VALIDÉ** ou **REFUSÉ**, avec la mesure qui le prouve (jamais « ça a l'air bon » : la preuve est le rendu réel, les codes HTTP et les empreintes, pas le diff) ;
2. la mise à jour d'`AUDIT.md` : statut du problème (`constaté` → `corrigé` / `régressé`), nouveaux constats s'il y en a, et les IDs qui changent de gravité ;
3. **le prompt suivant**, un seul, en tenant compte de ce qui a bougé.

Règles non négociables : un prompt = un commit ; deux corrections qui touchent les mêmes fichiers ne se donnent jamais en parallèle ; toute correction de routing est revérifiée par des URL réelles (pas par la source recopiée depuis `vercel.json`).

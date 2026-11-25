# Catalogue dynamique : Preview, mise en production et retour arrière

**Branche :** `feat/catalogue-dynamique`, non commitée et non poussée.
**Projet Supabase :** `hamac-investissements`, ref **`lxkhozdshbpdjnanbnzi`** (West EU, Irlande). C'est le même projet pour la Preview et la production.
**Projet Vercel :** `hamac-site` (équipe `oToMate22`, plan **Pro**).

Chaque étape marquée ⚠️ modifie une ressource réelle et attend votre validation explicite.

---

## 1. Constats bloquants ou structurants

| # | Constat | Conséquence |
|---|---|---|
| 1 | **L'historique des migrations Supabase est désaligné.** 5 migrations locales ne sont pas enregistrées à distance (`20260922112508`, `20260922120834`, `20260929180800`, `20261104120000`, `20261116120000`) et 6 versions distantes n'existent pas en local. Leurs effets sont bien présents en base (vérifié en lecture seule : `apimo_cache`, `notify_form_submission`, `form_throttle`, `claim_form_slot`, triggers `notify_*`). | `supabase db push` refuse de s'exécuter (dry-run). Ne **pas** forcer : il rejouerait d'anciennes migrations. Voir §3. |
| 2 | **Un build local sur Mac embarque Sharp `darwin-arm64`.** | Déployer **uniquement par push Git** (build Linux par Vercel, avec `@img/sharp-linux-x64` présent dans le `package-lock.json`), jamais `vercel deploy --prebuilt` depuis ce Mac. |
| 3 | `pg_cron` est disponible mais pas installé ; `pg_net` et le secret Vault `service_role` existent. | La migration installe `pg_cron`, mais **ne planifie rien** : l'activation est une étape séparée (§4). |
| 4 | Les Previews Vercel ont la même `VERCEL_PROJECT_PRODUCTION_URL` que la production. | Corrigé : `robots.txt` n'autorise l'indexation que si `VERCEL_ENV=production`, et les fonctions renvoient `X-Robots-Tag: noindex, nofollow` hors production. |

## 2. Secrets

Générés localement par `scripts/generate-catalog-secrets.sh` dans `.vercel/catalog-secrets.env` (ignoré par Git, droits 600, jamais affichés).

| Variable | Vercel Preview | Vercel Production | Supabase (secrets des fonctions) |
|---|---|---|---|
| `LISTING_FEED_URL` | ✓ | ✓ | — |
| `LISTING_FEED_TOKEN` | `…_PREVIEW` | `…_PRODUCTION` | `LISTING_FEED_TOKEN=<preview>,<production>` (les deux sont acceptés ; retirer un jeton révoque l'environnement concerné) |
| `SYNC_HMAC_SECRET` | ✓ | ✓ | ✓ |
| `SITE_ORIGIN` | — | — | URL de la Preview, puis `https://hamacpatrimoine.com` |
| `VERCEL_PROTECTION_BYPASS` | — | — | jeton « Protection Bypass for Automation » (Preview seulement) |
| `ALERT_EMAIL_TO` | — | — | adresse(s) d'alerte |

Vercel ne reçoit **aucune** clé Supabase privée.

**Commandes ⚠️** (à lancer depuis le dépôt ; elles lisent le fichier sans afficher les valeurs) :

```bash
set -a; . .vercel/catalog-secrets.env; set +a
printf %s "$LISTING_FEED_URL" | npx vercel env add LISTING_FEED_URL preview feat/catalogue-dynamique
printf %s "$LISTING_FEED_TOKEN_PREVIEW" | npx vercel env add LISTING_FEED_TOKEN preview feat/catalogue-dynamique
printf %s "$SYNC_HMAC_SECRET" | npx vercel env add SYNC_HMAC_SECRET preview feat/catalogue-dynamique
supabase secrets set --project-ref lxkhozdshbpdjnanbnzi \
  LISTING_FEED_TOKEN="$LISTING_FEED_TOKEN_PREVIEW,$LISTING_FEED_TOKEN_PRODUCTION" \
  SYNC_HMAC_SECRET="$SYNC_HMAC_SECRET" ALERT_EMAIL_TO=<adresse>
```

Les variables Preview sont limitées à la branche `feat/catalogue-dynamique`.

## 3. Migration Supabase ⚠️

**Option recommandée : réaligner l'historique, sans toucher au schéma**, puis pousser uniquement la nouvelle migration.

```bash
supabase migration repair --linked --status reverted 20260526152615 20260526154309 20260526154318 20260526154325 20260922112531 20260922120946
supabase migration repair --linked --status applied 20260922112508 20260922120834 20260929180800 20261104120000 20261116120000
supabase db push --linked --dry-run     # doit lister UNIQUEMENT 20261126090000_catalog_sync.sql
supabase db push --linked
```

`migration repair` ne modifie que la table d'historique (`supabase_migrations.schema_migrations`), jamais le schéma.

**Option alternative :** appliquer uniquement le fichier, puis l'enregistrer.

```bash
supabase db query --linked -f supabase/migrations/20261126090000_catalog_sync.sql
supabase migration repair --linked --status applied 20261126090000
```

**Effets de la migration :**
- elle crée 3 tables (RLS active, accès `anon` et `authenticated` révoqués) et 4 fonctions SQL ;
- elle installe `pg_cron` et crée le bucket public `og-listings` (JPEG uniquement, 512 Ko au plus) ;
- **aucun job n'est planifié**.

Elle a été validée sur une pile Supabase locale réelle (Postgres, Vault, `pg_net`, `pg_cron`, Storage).

## 4. Déploiement des fonctions ⚠️

```bash
supabase functions deploy apimo-proxy catalog-sync listing-feed --project-ref lxkhozdshbpdjnanbnzi
```

Le changement d'`apimo-proxy` est additif : il ajoute seulement `sync_meta.complete` à la réponse, et le site actuel l'ignore. `catalog-sync` refuse la clé anon. `listing-feed` exige un jeton.

## 5. Preview ⚠️

1. Dans les réglages Vercel, sous Deployment Protection, créer le jeton « Protection Bypass for Automation ».
2. Ajouter les variables Preview (§2).
3. Commiter puis pousser `feat/catalogue-dynamique`. L'intégration GitHub construit sur Linux et crée la Preview, **sans toucher à la production**.
4. **Sans synchronisation**, la Preview fonctionne déjà :
   - `listing-feed` se replie sur le catalogue en direct tant que la table est vide ;
   - les images sont générées à la volée.
   - Lancer :

```bash
PREVIEW_BYPASS=<jeton> SYNC_HMAC_SECRET=<secret> npx tsx scripts/check-preview-cdn.ts https://<preview> 87634540
```
```bash
npx tsx scripts/check-deployment.ts https://<preview> --bypass=<jeton>
```
```bash
node scripts/check-legacy-live.mjs https://<preview> <ancien-sitemap.xml>
```

   Pour ce dernier contrôle, la Preview doit être accessible sans authentification, ou il faut ajouter le jeton.

5. Avec synchronisation (validation séparée, §6) : `SITE_ORIGIN` pointe vers l'URL de la Preview et `VERCEL_PROTECTION_BYPASS` est défini, en mode `active`.

### Ce que vérifient les tests réels (`check-preview-cdn.ts`)

- **Fiche 87634540 :**
  - statut 200, balises OG et Twitter uniques ;
  - canonical vers la production, contenu SSR complet ;
  - fonction exécutée en `dub1`, d'après `x-vercel-id` ;
  - `X-Robots-Tag: noindex` sur la Preview ;
  - 2e requête servie par le CDN (`HIT` ou `STALE`).
- **Image :** JPEG 1200×630 valide ; sa source (stockage, à la volée ou par défaut) et sa latence sont indiquées.
- **Sitemap :** contient 87634540.
- **Catalogues :** `/fr/acheter`, `/fr/acheter?page=2` et `/fr/louer` répondent en 200 avec des liens vers les fiches.
- **`robots.txt` :** `Disallow` sur la Preview.
- **Codes HTTP et protections :** 404 pour un identifiant inexistant, 401 pour une purge ou une génération non signée.
- **Invalidation réelle :** une purge signée de `listing-87634540` donne `MISS` ou `STALE`, puis `HIT`.

## 6. Synchronisation ⚠️ (production Supabase)

```sql
-- Observation : toutes les 10 minutes, sans appel à Vercel
select public.catalog_sync_configure(p_enabled := true, p_interval_minutes := 10);
-- Activation (images + purge CDN), après validation de l'observation
select public.catalog_sync_configure(p_mode := 'active');
-- Arrêt immédiat
select public.catalog_sync_configure(p_enabled := false);
```

### Durée d'observation : critères mesurables plutôt qu'une semaine

La logique est déterministe et couverte par 48 tests unitaires (36 catalogue, 12 Open Graph) et 25 scénarios de bout en bout. Le seul inconnu est le comportement réel d'Apimo : réponses partielles, quotas, rythme des modifications. Une **journée ouvrée complète** l'expose. Je recommande au minimum **24 h couvrant une journée ouvrée** (144 runs), prolongées à 72 h au plus si un critère n'est pas atteint.

| Critère | Seuil |
|---|---|
| Runs `ok` | ≥ 95 % ; chaque `failed` ou `degraded` doit être expliqué |
| Nombre de biens servis par rapport à `apimo_cache.total_items` | écart nul à chaque run fiable |
| Retraits (`withdrawn`) | 0, ou chacun confirmé absent dans Apimo |
| Erreurs 429 Apimo | 0 |
| Changement réel détecté | ≥ 1 (`updated` ou `created`), reflété dans `listing_snapshots` |
| Alertes | 0 |

```sql
select outcome, count(*) from catalog_sync_runs where started_at > now() - interval '24 hours' group by 1;
select count(*) filter (where status <> 'withdrawn') as servis,
       (select (payload->>'total_items')::int from apimo_cache where key='properties') as apimo
  from listing_snapshots;
select id, withdrawn_at from listing_snapshots where status = 'withdrawn';
```

## 7. Mise en production ⚠️ (après validation de la Preview)

1. Ajouter les variables pour l'environnement Production, avec `LISTING_FEED_TOKEN=<production>`.
2. Fusionner `feat/catalogue-dynamique` dans `main`, ce qui lance le build et le déploiement de production.
3. Mettre à jour les secrets Supabase :

```bash
supabase secrets set SITE_ORIGIN=https://hamacpatrimoine.com
```
```bash
supabase secrets unset VERCEL_PROTECTION_BYPASS
```

4. Lancer `check-preview-cdn.ts https://hamacpatrimoine.com`, `check-deployment.ts` et `check-legacy-live.mjs`.
5. Faire les tests WhatsApp réels (§9).
6. Retirer le jeton Preview de `LISTING_FEED_TOKEN` côté Supabase quand la Preview n'est plus utile.

## 8. Retour arrière

| Action | Effet | Délai |
|---|---|---|
| Vercel → Deployments → **Instant Rollback** | Retour aux fiches pré-rendues statiques | moins d'1 min |
| `DYNAMIC_LISTINGS=0` + redéploiement | Pré-rendu statique au build, sans revenir sur le code | environ 5 min |
| `catalog_sync_configure(p_enabled := false)` | Arrêt de la synchronisation, données conservées | immédiat |
| `catalog_sync_configure(p_mode := 'observe')` | Plus d'appel à Vercel (images, purges) | immédiat |
| Retirer un jeton de `LISTING_FEED_TOKEN` | Révoque l'accès de l'environnement concerné | immédiat |

Aucune action n'est destructive.

## 9. Validation WhatsApp (production uniquement)

WhatsApp ne peut pas lire une Preview protégée.

1. Ouvrir le débogueur de partage Facebook et cliquer sur « Scrape again » pour 87604875, 87557142 et 87634540.
2. Dans une conversation où ces liens n'ont jamais été envoyés, envoyer chaque lien avec `?v=1`.
3. Vérifier sur iPhone **et** Android que la vignette montre la photo du bien.
4. Publier ou modifier un bien dans Apimo, puis vérifier son aperçu en moins de 20 minutes : 10 minutes de cycle, plus 5 minutes de cache `apimo-proxy`, plus la durée du run.

## 10. Validation GA4 et CMP (absence de double comptage)

Pourquoi le rendu serveur ne peut pas doubler les mesures :
- Le serveur n'exécute **aucun** code de suivi : `bootTracking()` n'est appelé que dans `src/main.ts`, côté navigateur.
- Le HTML rendu côté serveur ne contient aucun script gtag ou GTM, seulement le bundle habituel.
- gtag est configuré avec `send_page_view: false`. Le `page_view` est envoyé manuellement, **une fois par chemin** (`lastPageViewRoute`), et seulement après consentement.
- `main.ts` remplace le HTML serveur par le rendu React (`createRoot`), exactement comme avec l'ancien pré-rendu Chromium.

Contrôle à faire sur la Preview (Tag Assistant ou GA4 DebugView, avec le jeton de contournement) :

1. Première visite sans consentement : **0** requête vers `google-analytics.com` ou `g/collect`. Le bandeau CMP s'affiche.
2. « Tout accepter » : **1** `page_view` pour la page courante.
3. Rechargement : **1** `page_view`. Navigation interne vers une fiche : **1** `page_view`. Retour : **1** `page_view`.
4. « Tout refuser » : plus aucune requête.
5. Clic sur le téléphone et envoi d'un formulaire de test : **1** événement chacun.

⚠️ La Preview utilise le même identifiant GA4 que la production (`VITE_GA_MEASUREMENT_ID` est défini pour la Preview). Faire ces tests en trafic interne (paramètre géré par `applyInternalTrafficParam`) ou en mode debug, pour ne pas polluer les statistiques.

## 11. Surveillance

**Synchronisation et quotas Apimo** (vue créée par la migration, réservée à la clé de service) :

```sql
select * from public.catalog_sync_health;   -- runs, ok, degraded, failed, 429, retraits, images, écart avec Apimo
select started_at, outcome, http_status, reason from catalog_sync_runs
 where outcome <> 'ok' order by id desc limit 20;
```

**Alertes automatiques par e-mail** (Resend, `ALERT_EMAIL_TO`) : 60 minutes sans run fiable, quota 429 compris, puis au plus une alerte toutes les 6 heures.

**Seuils d'action :**
- `quota_429_24h > 0` : passer à 15 minutes avec `catalog_sync_configure(p_interval_minutes := 15)`.
- `withdrawn_24h` anormal : vérifier dans Apimo, puis `p_enabled := false` si besoin.
- `og_failed > 0` : lire `og_last_error` dans `listing_snapshots`.

**Vercel** (Dashboard → Usage, et Settings → Billing → Spend Management, plafond conseillé avec alerte à 50 %) :
- Invocations et CPU actif des fonctions `api/*`, Fast Data Transfer, requêtes CDN.
- **Minutes de build :** chaque build utilise une machine « enhanced » (8 vCPU), soit environ 56 minutes-CPU, surtout à cause du pré-rendu Chromium. Avec l'architecture dynamique, les redéploiements deviennent rares. Vérifier que ce type de machine est bien voulu (Settings → Build & Deployment → Build Machine).
- **Logs :** Deployments → Functions → `api/listing` (statuts 503 et durées).

**Supabase** (Dashboard → Usage) : invocations des fonctions Edge (`catalog-sync`, `listing-feed`, `apimo-proxy`), stockage du bucket `og-listings`, egress. Logs : Edge Functions → `catalog-sync`.

# Audit de l'historique des migrations Supabase (lecture seule)

**Date :** 26/11/2026.
**Cible confirmée :**
- projet **`hamac-investissements`**, ref **`lxkhozdshbpdjnanbnzi`** ;
- organisation `enmufclhdagbcfabxjmi`, région West EU (Irlande), PostgreSQL 17.6 ;
- projet lié à la CLI (`supabase/.temp/project-ref`), identique à `VITE_SUPABASE_URL`.

**Opérations réalisées :** uniquement des `SELECT` (`supabase db query --linked`), `supabase migration list`, `supabase db push --dry-run` et `supabase backups list`. **Aucune écriture.**

---

## 1. Écart constaté

| Version | Local | Distant | Nature |
|---|---|---|---|
| 20260526152615 `create_offmarket_submissions` | — | ✓ | Appliquée depuis le tableau de bord (SQL dans `supabase/offmarket-submissions-rls.sql`) |
| 20260526154309 `enable_rls_leads` | — | ✓ | idem (`supabase/leads-contact-rls.sql`) |
| 20260526154318 `enable_rls_estimation_submissions` | — | ✓ | idem (`supabase/estimation-submissions-rls.sql`) |
| 20260526154325 `enable_rls_offmarket_submissions` | — | ✓ | idem |
| 20260922112531 `apimo_properties_cache` | — | ✓ | **Texte identique** à la version locale 20260922112508 |
| 20260922120946 `apimo_cache` | — | ✓ | **Texte identique** à la version locale 20260922120834 |
| **20260922112508** `apimo_properties_cache` | ✓ | — | Doublon de 20260922112531 |
| **20260922120834** `apimo_cache` | ✓ | — | Doublon de 20260922120946 |
| **20260929180800** `notify_lead_on_insert` | ✓ | — | Appliquée hors CLI |
| **20261104120000** `notify_all_forms` | ✓ | — | Appliquée hors CLI |
| **20261116120000** `form_throttle_and_checks` | ✓ | — | Appliquée hors CLI |
| 20261027195722, 20261117090000, 20261118190000, 20261119230000 | ✓ | ✓ | Alignées. 20261117 ne diffère que par les `;` ; 20261119 est enregistrée sous forme de commentaire, mais ses effets sont présents (`delivery_failures`, `delivery_journal`, `delivery_failure_record`) |
| 20261126090000 `catalog_sync` | ✓ | — | Nouvelle migration du chantier (non appliquée) |

`supabase db push --dry-run` refuse de s'exécuter : « Remote migration versions not found in local migrations directory ».

## 2. Preuves par migration

Requêtes exécutées : voir §5. Résultats relevés le 26/11/2026.

### 2.1 `20260922112508_apimo_properties_cache`

- **Attendu :** crée `public.apimo_properties_cache`. La migration suivante (120834) la supprime.
- **Constaté :** la table `apimo_properties_cache` est **absente**, ce qui est l'état final attendu. Le texte SQL est **identique** à la version distante 20260922112531.

### 2.2 `20260922120834_apimo_cache`

- **Attendu :**
  - table `apimo_cache` (`key` text, clé primaire ; `payload` jsonb non nul ; `fetched_at` timestamptz non nul, défaut `now()`) ;
  - RLS activée et droits retirés à `anon`, `authenticated` et `public` ;
  - suppression de `apimo_properties_cache`.
- **Constaté :**
  - colonnes `key` text NOT NULL, `payload` jsonb NOT NULL, `fetched_at` timestamptz NOT NULL DEFAULT now() ;
  - index `apimo_cache_pkey` UNIQUE (key) ;
  - `rls = true`, ACL `{postgres=arwdDxtm, service_role=arwdDxtm}` : aucun droit pour `anon` ni `authenticated` ;
  - aucune politique RLS, donc accès réservé à la clé de service.
  - Texte **identique** à la version distante 20260922120946.

### 2.3 `20260929180800_notify_lead_on_insert`

- **Attendu :**
  - `pg_net` dans le schéma `extensions` ;
  - schéma `private`, dont les droits sont retirés à `public`, `anon` et `authenticated` ;
  - fonction `private.notify_lead_on_insert` et trigger `notify_lead_on_insert`, tous deux **remplacés ensuite par 20261104**.
- **Constaté :**
  - `pg_net` 0.20.0, schéma `extensions` ;
  - ACL du schéma `private` = `{postgres=UC}` uniquement ;
  - `private.notify_lead_on_insert` **absente**, ce qui est attendu puisque 20261104 la supprime ;
  - trigger `notify_lead_on_insert` présent et redirigé, voir 2.4.

### 2.4 `20261104120000_notify_all_forms`

- **Attendu :**
  - fonction `private.notify_form_submission()` en SECURITY DEFINER, avec `search_path = pg_catalog, private, net, vault`, exécution retirée à `public`, `anon` et `authenticated` ;
  - 3 triggers AFTER INSERT : `leads` (WHEN `type_contact IS NOT NULL`), `estimation_submissions` et `offmarket_submissions` ;
  - suppression de `private.notify_lead_on_insert`.
- **Constaté :**
  - `secdef = true`, `config = search_path=pg_catalog, private, net, vault`, ACL `{postgres=X}` : seul `postgres` exécute ;
  - le corps de la fonction est **identique au fichier, à la mise en forme près** (un `jsonb_build_object` écrit sur une ligne au lieu de quatre) ;
  - triggers relevés :
    - `CREATE TRIGGER notify_lead_on_insert AFTER INSERT ON public.leads FOR EACH ROW WHEN ((new.type_contact IS NOT NULL)) EXECUTE FUNCTION private.notify_form_submission()`
    - `CREATE TRIGGER notify_estimation_on_insert AFTER INSERT ON public.estimation_submissions FOR EACH ROW EXECUTE FUNCTION private.notify_form_submission()`
    - `CREATE TRIGGER notify_offmarket_on_insert AFTER INSERT ON public.offmarket_submissions FOR EACH ROW EXECUTE FUNCTION private.notify_form_submission()`
  - Le secret Vault `service_role` est présent (comptage uniquement, valeur non lue).

### 2.5 `20261116120000_form_throttle_and_checks`

- **Attendu :**
  - table `form_throttle` (identité ALWAYS, `form` avec CHECK sur 4 valeurs, `ip_hash`, `created_at`) ;
  - index `form_throttle_ip_idx (ip_hash, created_at desc)` et `form_throttle_created_idx (created_at)` ;
  - RLS activée et droits retirés ;
  - fonction `claim_form_slot` en SECURITY DEFINER, exécutable par `service_role` uniquement ;
  - 13 contraintes CHECK **NOT VALID** sur `leads` (4), `estimation_submissions` (5) et `offmarket_submissions` (4).
- **Constaté :**
  - colonnes conformes (`id` bigint identité ALWAYS, `form`, `ip_hash` et `created_at` NOT NULL) ;
  - `form_throttle_form_check` présente ;
  - les 2 index sont présents ;
  - `rls = true`, ACL limitée à `postgres` et `service_role` ;
  - `claim_form_slot` : `secdef = true`, `search_path=pg_catalog, public`, ACL `{postgres=X, service_role=X}`, corps **identique** au fichier (sha256 normalisé `5fc2d1eca28f` des deux côtés) ;
  - les **13 contraintes sont présentes, avec `convalidated = false`**, et leurs définitions sont identiques au fichier.

### 2.6 Transformations de données

Aucune des 5 migrations ne contient d'`UPDATE`, d'`INSERT` ou de `DELETE` sur des données métier.
- Les contraintes `NOT VALID` ne vérifient pas les lignes existantes.
- Seule `apimo_properties_cache`, une table de cache, est supprimée par 120834 ; c'est déjà fait.
- Le `DELETE` de `claim_form_slot` ne s'exécute qu'à l'appel de la fonction (purge des jetons de plus de 7 jours dans `form_throttle`). Ce n'est pas un effet de la migration.

## 3. Sauvegarde et restauration

- **Sauvegardes physiques quotidiennes réussies**, du 18/11 au 25/11/2026 à 02:30 UTC (`supabase backups list`). Ce n'est possible qu'avec une formule payante.
- **Pas de restauration à un instant précis (PITR)** : une restauration ramène tout le projet au dernier point quotidien. Elle se fait depuis le tableau de bord (Database → Backups → Restore) et entraîne une indisponibilité pendant la restauration.
- **Copie locale de l'historique des migrations** (10 lignes, version, nom et instructions) : `supabase/.temp/schema_migrations-backup-20261126.json`, ignoré par Git. Elle permet de recréer exactement l'historique avec `migration repair`, sans restaurer la base.

## 4. Réparation proposée (NON exécutée)

`supabase migration repair` n'agit **que** sur la table `supabase_migrations.schema_migrations` :
- `--status applied` insère une ligne ;
- `--status reverted` supprime une ligne.

Elle ne crée, ne modifie et ne supprime **aucune table métier, aucune donnée client, aucune fonction ni aucune politique**.

```bash
# 0. Vérifier la cible
cat supabase/.temp/project-ref            # doit afficher lxkhozdshbpdjnanbnzi
supabase projects list | grep "●"         # hamac-investissements

# 1. Retirer de l'historique les 6 versions distantes sans fichier local
#    (4 versions de mai, documentées dans supabase/*-rls.sql, et 2 doublons de 112508 et 120834)
supabase migration repair --linked --status reverted 20260526152615 20260526154309 20260526154318 20260526154325 20260922112531 20260922120946

# 2. Enregistrer les 5 migrations locales dont les effets sont prouvés (§2)
supabase migration repair --linked --status applied 20260922112508 20260922120834 20260929180800 20261104120000 20261116120000

# 3. Contrôle : la liste doit être alignée, et le dry-run ne proposer QUE 20261126090000
supabase migration list --linked
supabase db push --linked --dry-run
```

**Retour arrière de la réparation :** les opérations inverses, plus la copie locale (§3).

```bash
supabase migration repair --linked --status reverted 20260922112508 20260922120834 20260929180800 20261104120000 20261116120000
supabase migration repair --linked --status applied 20260526152615 20260526154309 20260526154318 20260526154325 20260922112531 20260922120946
```

Le contenu SQL des 6 lignes réinsérées est alors vide. La copie locale conserve leurs instructions d'origine.

## 5. Requêtes de preuve (reproductibles, lecture seule)

```sql
-- historique
select version, name, array_length(statements,1) from supabase_migrations.schema_migrations order by version;
-- fonctions (sécurité, search_path, droits, corps)
select n.nspname||'.'||p.proname, p.prosecdef, p.proconfig, p.proacl, md5(p.prosrc)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname, p.proname) in (('private','notify_form_submission'),('private','notify_lead_on_insert'),('public','claim_form_slot'));
-- triggers
select c.relname, t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal and c.relname in ('leads','estimation_submissions','offmarket_submissions');
-- tables, RLS, droits
select c.relname, c.relrowsecurity, c.relacl from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('apimo_cache','apimo_properties_cache','form_throttle');
-- contraintes (NOT VALID)
select conrelid::regclass, conname, convalidated, pg_get_constraintdef(oid) from pg_constraint
 where conrelid in ('public.leads'::regclass,'public.estimation_submissions'::regclass,'public.offmarket_submissions'::regclass,'public.form_throttle'::regclass) and contype = 'c';
-- index, colonnes, schéma private, extensions
select indexname, indexdef from pg_indexes where tablename in ('form_throttle','apimo_cache');
select table_name, column_name, data_type, is_nullable, column_default, identity_generation from information_schema.columns where table_name in ('apimo_cache','form_throttle');
select nspacl from pg_namespace where nspname = 'private';
select extname, extversion, extnamespace::regnamespace from pg_extension where extname in ('pg_net','pg_cron');
select count(*) from vault.secrets where name = 'service_role';   -- comptage, valeur jamais lue
```

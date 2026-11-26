#!/usr/bin/env bash
# Suivi de l'observation du catalogue (lecture seule) : santé 24 h, derniers runs, appels Apimo, écarts.
# Usage : ./scripts/catalog-health.sh [heures]   (par défaut 24)
set -euo pipefail
cd "$(dirname "$0")/.."
H="${1:-24}"
[ "$(cat supabase/.temp/project-ref)" = "lxkhozdshbpdjnanbnzi" ] || { echo "Projet Supabase inattendu"; exit 1; }
q() { supabase db query --linked "$1" 2>/dev/null | python3 -c '
import json,sys
t=sys.stdin.read(); d=json.loads(t[t.index("{"):t.rindex("}")+1])
for r in d.get("rows",[]): print("  " + " | ".join(f"{k}={v}" for k,v in r.items()))'; }
echo "== État"
q "select enabled, mode, interval_minutes, backoff_until, consecutive_failures, failing_since, last_success_at, last_alert_at from public.catalog_sync_state"
echo "== Santé (24 h)"
q "select * from public.catalog_sync_health"
echo "== Runs sur ${H} h par résultat et source (source=miss : lecture réelle d'Apimo, 4 appels par lecture aujourd'hui)"
q "select outcome, coalesce(source,'-') as source, count(*) as runs, max(started_at) as dernier from public.catalog_sync_runs where started_at > now() - interval '${H} hours' group by 1,2 order by 1,2"
echo "== Erreurs 429 / échecs sur ${H} h"
q "select started_at, outcome, http_status, left(reason, 90) as raison from public.catalog_sync_runs where started_at > now() - interval '${H} hours' and outcome <> 'ok' order by id desc limit 10"
echo "== Changements détectés sur ${H} h"
q "select coalesce(sum(created),0) as crees, coalesce(sum(updated),0) as modifies, coalesce(sum(reactivated),0) as reactives, coalesce(sum(pending_withdrawal),0) as absences, coalesce(sum(withdrawn),0) as retraits from public.catalog_sync_runs where started_at > now() - interval '${H} hours'"
echo "== Cohérence avec Apimo (biens servis / total du cache apimo-proxy)"
q "select (select count(*) from public.listing_snapshots where status <> 'withdrawn') as servis, (select (payload->>'total_items')::int from public.apimo_cache where key='properties') as apimo, (select fetched_at from public.apimo_cache where key='properties') as cache_lu_a"
echo "== Derniers runs"
q "select id, started_at, outcome, source, seen, created, updated, pending_withdrawal, withdrawn, duration_ms from public.catalog_sync_runs order by id desc limit 6"

// Contrôle en ligne d'apimo-proxy, tel qu'un visiteur l'appelle (clé anon) : lecture seule STRICTE.
// N'envoie que les deux appels que fait le site (POST { route: 'properties' } et GET …/properties),
// sans aucun paramètre : ni refresh, ni statut, ni route supprimée. Ces manipulations sont testées
// uniquement en isolé (npm run test:apimo-proxy-isolated), jamais contre la production.
// Usage : node scripts/check-apimo-proxy-live.mjs   (lit VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local)
// N'affiche que des compteurs et des noms de champs, jamais une valeur.
import { existsSync, readFileSync } from 'node:fs'

// Variables d'environnement (CI) ou, à défaut, .env.local (poste de travail).
const envFile = new URL('../.env.local', import.meta.url)
const env = {
  ...(existsSync(envFile)
    ? Object.fromEntries(
        readFileSync(envFile, 'utf8')
          .split('\n')
          .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
          .filter(Boolean)
          .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
      )
    : {}),
  ...Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => process.env[k]).map((k) => [k, process.env[k]])),
}
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis')
  process.exit(2)
}
const base = `${env.VITE_SUPABASE_URL}/functions/v1/apimo-proxy`
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }

const ALLOWED_ROOT = new Set(['properties', 'total_items', 'fetched_items', 'status_filter', 'sync_meta'])
const FORBIDDEN = [
  'owner', 'tenant', 'private_comment', 'interagency_comment', 'status_comment', 'life_annuity', 'occupants', 'birthday', 'birthday_at',
  'address', 'address_more', 'cadastre_reference', 'lot_reference', 'logs', 'financial', 'documents', 'exchanges', 'referral', 'visit',
  'commission', 'commission_customer', 'commission_owner', 'contribution', 'deposit', 'fees', 'inventory', 'pension', 'transfer_tax', 'vat',
  'renovation_cost', 'mobile', 'fax', 'start_at', 'end_at', 'lot', 'agency', 'created_by', 'updated_by',
]
let failures = 0
const fail = (message) => {
  failures++
  console.error(`KO  ${message}`)
}

function keysOf(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) (out.add(k), keysOf(v, out))
  return out
}

const variants = [
  ['POST properties', { method: 'POST', body: JSON.stringify({ route: 'properties' }) }, ''],
  ['GET properties', { method: 'GET' }, '/properties'],
]
for (const [label, init, suffix] of variants) {
  const res = await fetch(base + suffix, { ...init, headers })
  const body = await res.json().catch(() => null)
  if (res.status !== 200 || !body) {
    fail(`${label} : HTTP ${res.status}`)
    break
  }
  const extraRoot = Object.keys(body).filter((k) => !ALLOWED_ROOT.has(k))
  if (label === 'POST properties' && (extraRoot.length || body.status_filter !== '1,22,29')) {
    fail('version non corrigée en ligne')
    process.exit(1)
  }
  if (extraRoot.length) fail(`${label} : champs racine inattendus ${extraRoot.join(', ')}`)
  const keys = keysOf(body.properties)
  const leaked = FORBIDDEN.filter((k) => keys.has(k))
  if (leaked.length) fail(`${label} : champs interdits ${leaked.join(', ')}`)
  const statuses = new Set(body.properties.map((p) => String(p.status)))
  if ([...statuses].some((s) => !['1', '22', '29'].includes(s))) fail(`${label} : statut non publié servi`)
  const coarse = body.properties.filter((p) => !p.publish_address && [p.latitude, p.longitude].some((v) => typeof v === 'number' && String(v).split('.')[1]?.length > 2))
  if (coarse.length) fail(`${label} : ${coarse.length} coordonnées exactes sans adresse publiée`)
  console.log(`ok  ${label} : ${body.properties.length} biens, ${keys.size} champs distincts, X-Cache ${res.headers.get('x-cache')}`)
}

if (failures) process.exit(1)
console.log('\napimo-proxy conforme')

// Garde-fou avant tout déploiement des fonctions Supabase du catalogue : refuse une version
// d'apimo-proxy (ou de la liste blanche partagée) antérieure au correctif de sécurité de novembre 2026.
// Usage : node scripts/guard-apimo-proxy.mjs   (appelé par npm run deploy:functions et par la CI)
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => {
  const url = new URL(`../${path}`, import.meta.url)
  return existsSync(url) ? readFileSync(url, 'utf8') : ''
}
const problems = []
const proxy = read('supabase/functions/apimo-proxy/index.ts')
const model = read('supabase/functions/_shared/catalog/model.ts')
const pub = read('supabase/functions/_shared/catalog/public.ts')

const required = [
  [proxy, /publicCatalogEnvelope/, 'apimo-proxy doit filtrer chaque réponse par publicCatalogEnvelope'],
  [proxy, /isCatalogRoute\(/, 'apimo-proxy doit restreindre les routes par isCatalogRoute'],
  [proxy, /for \(const status of PUBLISHED_STATUSES\)/, 'apimo-proxy doit lire uniquement les statuts publiés'],
  [model, /sanitizeListing\(raw\)/, 'publicPayload doit reposer sur la liste blanche profonde (sanitizeListing)'],
  [pub, /export const PUBLISHED_STATUSES = \['1', '22', '29'\]/, 'statuts publiés attendus : 1, 22, 29'],
  [pub, /export const COARSE_COORDINATE_DECIMALS = [0-2]\b/, 'coordonnées approximatives : 2 décimales au plus'],
]
for (const [source, pattern, message] of required) if (!pattern.test(source)) problems.push(message)

const forbidden = [
  [/refresh/i, 'apimo-proxy ne doit accepter aucun rafraîchissement demandé par le client'],
  [/probe/, 'route properties/probe supprimée'],
  [/\$\{APIMO_BASE_URL\}\/agencies`/, 'route agencies supprimée'],
  [/searchParams\.(entries|forEach|keys)\(|of [\w.]*searchParams\b/, 'aucun paramètre du client ne doit être relayé à Apimo'],
  [/properties\/\(\[\^\/\]\+\)|properties\/\$\{/, 'lecture d’un bien par identifiant supprimée'],
]
for (const [pattern, message] of forbidden) if (pattern.test(proxy)) problems.push(message)

if (problems.length) {
  console.error('DÉPLOIEMENT REFUSÉ : version d’apimo-proxy vulnérable ou incomplète')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('Partir de main (correctif 94c4bf0 et suivants) avant de déployer.')
  process.exit(1)
}
console.log('garde-fou apimo-proxy : ok')

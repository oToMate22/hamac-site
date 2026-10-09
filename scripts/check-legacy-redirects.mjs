// DÉPRÉCIÉ — remplacé par src/proxy.ts / scripts/check-legacy-live.mjs. Ne plus lancer : dépend d'un CSV hors dépôt.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MAPPING = '/Users/tristansalmon/hamac-briefs/bascule/mapping-301.csv'
const REDIRECTS = path.join(ROOT, 'data/legacy-redirects.json')
const VERCEL = path.join(ROOT, 'vercel.json')

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines.shift()
  if (!header.startsWith('ancienne_url')) {
    throw new Error(`CSV inattendu : ${header}`)
  }
  return lines.map((line) => {
    const [ancienne_url, nouvelle_url, type, regle_a_creer] = line.split(',')
    return { ancienne_url, nouvelle_url, type, regle_a_creer }
  })
}

function decodePath(pathname) {
  return pathname
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')
}

const rows = parseCsv(await readFile(MAPPING, 'utf8'))
const redirects = JSON.parse(await readFile(REDIRECTS, 'utf8'))
const vercel = JSON.parse(await readFile(VERCEL, 'utf8'))

const bySource = new Map(redirects.map((entry) => [decodePath(entry.source), entry]))
const gaps = []
let identities = 0

for (const row of rows) {
  const source = decodePath(row.ancienne_url)
  const rule = bySource.get(source)
  if (row.regle_a_creer === 'non') {
    identities++
    if (rule) {
      gaps.push(`identité encore redirigée : ${row.ancienne_url}`)
    }
    continue
  }
  if (!rule) {
    gaps.push(`manque : ${row.ancienne_url} → ${row.nouvelle_url}`)
    continue
  }
  if (rule.destination !== row.nouvelle_url) {
    gaps.push(`${row.ancienne_url} : ${rule.destination} ≠ ${row.nouvelle_url}`)
  }
}

const csvSources = new Set(rows.map((row) => decodePath(row.ancienne_url)))
for (const entry of redirects) {
  if (!csvSources.has(decodePath(entry.source))) gaps.push(`en trop : ${entry.source}`)
}

const encodedPlus = []
const loops = []
for (const entry of vercel.redirects ?? []) {
  if (/%2B/i.test(entry.source)) encodedPlus.push(entry.source)
  const requestPath = entry.source.replace(/\\\+/g, '+')
  if (requestPath === entry.destination) loops.push(entry.source)
}

const sourceCount = (await readFile(VERCEL, 'utf8')).split('"source"').length - 1

console.log(`CSV : ${rows.length} URLs`)
console.log(`redirections : ${redirects.length}`)
console.log(`identités : ${identities}`)
console.log(`vercel redirects : ${vercel.redirects.length}`)
console.log(`clés "source" : ${sourceCount}`)
console.log(`écart : ${gaps.length}`)
if (encodedPlus.length) {
  console.error(`%2B dans ${encodedPlus.length} source(s)`)
  for (const source of encodedPlus.slice(0, 10)) console.error(`  ${source}`)
  process.exit(1)
}
if (loops.length) {
  console.error(`boucle : ${loops.join(', ')}`)
  process.exit(1)
}
if (sourceCount > 2048) {
  console.error(`trop de "source" : ${sourceCount} > 2048`)
  process.exit(1)
}
if (gaps.length) {
  for (const gap of gaps.slice(0, 40)) console.error(`  ${gap}`)
  if (gaps.length > 40) console.error(`  … ${gaps.length - 40} de plus`)
  process.exit(1)
}
if (vercel.redirects.length < 722 || vercel.redirects.length > 2048) {
  console.error(`vercel.json redirects hors plage : ${vercel.redirects.length}`)
  process.exit(1)
}
if (JSON.stringify(vercel.redirects[0]) !== JSON.stringify({ source: '/', destination: '/fr/', permanent: true })) {
  console.error('la première règle doit rester / → /fr/')
  process.exit(1)
}
console.log('0 écart')

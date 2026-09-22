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

const rows = parseCsv(await readFile(MAPPING, 'utf8'))
const redirects = JSON.parse(await readFile(REDIRECTS, 'utf8'))
const vercel = JSON.parse(await readFile(VERCEL, 'utf8'))

const bySource = new Map(redirects.map((entry) => [entry.source, entry]))
const gaps = []
let identities = 0

for (const row of rows) {
  const rule = bySource.get(row.ancienne_url)
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

for (const entry of redirects) {
  const row = rows.find((item) => item.ancienne_url === entry.source)
  if (!row) gaps.push(`en trop : ${entry.source}`)
}

console.log(`CSV : ${rows.length} URLs`)
console.log(`redirections : ${redirects.length}`)
console.log(`identités : ${identities}`)
console.log(`vercel redirects : ${vercel.redirects.length}`)
console.log(`écart : ${gaps.length}`)
if (gaps.length) {
  for (const gap of gaps.slice(0, 40)) console.error(`  ${gap}`)
  if (gaps.length > 40) console.error(`  … ${gaps.length - 40} de plus`)
  process.exit(1)
}
if (vercel.redirects.length !== 722) {
  console.error(`vercel.json doit contenir 722 redirects, pas ${vercel.redirects.length}`)
  process.exit(1)
}
if (JSON.stringify(vercel.redirects[0]) !== JSON.stringify({ source: '/', destination: '/fr/', permanent: true })) {
  console.error('la première règle doit rester / → /fr/')
  process.exit(1)
}
console.log('0 écart')

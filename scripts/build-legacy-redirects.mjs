import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MAPPING = '/Users/tristansalmon/hamac-briefs/bascule/mapping-301.csv'
const VERCEL_PATH = path.join(ROOT, 'vercel.json')
const OUTPUT_JSON = path.join(ROOT, 'data/legacy-redirects.json')

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

/** Vercel path-to-regexp treats `+` as a quantifier; escape so the request URL can keep a literal +. */
function vercelSource(pathname) {
  return decodePath(pathname).replace(/\+/g, '\\+')
}

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

const redirects = []
const seen = new Set()
let identities = 0

for (const row of rows) {
  const source = decodePath(row.ancienne_url)
  if (seen.has(source)) continue
  seen.add(source)
  if (row.regle_a_creer === 'non') {
    identities++
    continue
  }
  const destination = row.nouvelle_url
  if (!destination) {
    identities++
    continue
  }
  if (source === destination) {
    throw new Error(`boucle : ${source}`)
  }
  redirects.push({ source, destination, permanent: true })
}

redirects.sort((a, b) => a.source.localeCompare(b.source))

if (redirects.length !== 721) {
  throw new Error(`attendu 721 redirections, obtenu ${redirects.length} (identités : ${identities})`)
}

await mkdir(path.dirname(OUTPUT_JSON), { recursive: true })
await writeFile(OUTPUT_JSON, `${JSON.stringify(redirects, null, 2)}\n`)

const vercel = JSON.parse(await readFile(VERCEL_PATH, 'utf8'))
const rewrites = vercel.rewrites
vercel.redirects = [
  { source: '/', destination: '/fr/', permanent: true },
  { source: '/index.html', destination: '/fr/', permanent: true },
  ...redirects.map((entry) => ({
    ...entry,
    source: vercelSource(entry.source),
  })),
]
if (rewrites) vercel.rewrites = rewrites
delete vercel.routes
await writeFile(VERCEL_PATH, `${JSON.stringify(vercel, null, 2)}\n`)

console.log(`identités (pas de règle) : ${identities}`)
console.log(`redirections : ${redirects.length}`)
console.log(`vercel.json redirects : ${vercel.redirects.length}`)

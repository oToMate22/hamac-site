// Tests de non-régression des aperçus de partage. Usage : npx tsx scripts/og-images.test.ts
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { auditTags, readMetaTags } from './check-og-meta'
import { applyHead, applyOgImageTags, headForRoute, type ListingHeadInput } from './inject-route-heads'
import {
  candidatePictures,
  generateListingOgImage,
  needsMainPhotoRetry,
  OG_TARGET_MAX_BYTES,
  validateOgJpeg,
  versionedFileName,
} from './og-images'
import { DEFAULT_OG_IMAGE, SERVED_SITE_URL } from '../src/config/site'

let failures = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${name} : ${(error as Error).message}`)
  }
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Photo de test « réaliste » : dégradés + bruit, pour un poids JPEG comparable à une vraie photo. */
async function fakePhoto(width: number, height: number, seed = 1) {
  const raw = Buffer.alloc(width * height * 3)
  let state = seed
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      const noise = (state >> 16) % 60
      const i = (y * width + x) * 3
      raw[i] = (x * 255) / width / 1.4 + noise
      raw[i + 1] = (y * 255) / height / 1.4 + noise
      raw[i + 2] = 120 + noise
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer()
}
const whiteImage = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).jpeg().toBuffer()

const tmp = await mkdtemp(path.join(tmpdir(), 'og-test-'))
const photo = await fakePhoto(2400, 1800)
const portrait = await fakePhoto(1200, 1800, 7)
const white = await whiteImage(2000, 1500)
const fetcherFor = (files: Record<string, Buffer | Error>) => async (url: string) => {
  const value = files[url]
  if (!value) throw new Error('HTTP 404')
  if (value instanceof Error) throw value
  return value
}

await test('candidatePictures trie par rang et ignore les photos non publiées', () => {
  const urls = candidatePictures([
    { url: 'https://x/3.jpg', rank: 3 },
    { url: 'https://x/1.jpg', rank: 1 },
    { url: 'https://x/2.jpg', rank: 2, internet: 0 },
    { rank: 4 },
  ])
  check(urls.join(',') === 'https://x/1.jpg,https://x/3.jpg', urls.join(','))
})

await test('photo principale : JPEG 1200×630 valide, ≤ 250 Ko, non progressif', async () => {
  const result = await generateListingOgImage('111', [{ url: 'https://x/a.jpg', rank: 1 }], tmp, fetcherFor({ 'https://x/a.jpg': photo }))
  check(result.ok, JSON.stringify(result))
  check(result.sourceIndex === 0, 'photo 1 attendue')
  check(result.bytes <= OG_TARGET_MAX_BYTES, `${result.bytes} octets`)
  const bytes = await readFile(path.join(tmp, result.file))
  const problems = await validateOgJpeg(bytes)
  check(problems.length === 0, problems.join(', '))
  check(/^111-[0-9a-f]{10}\.jpg$/.test(result.file), result.file)
})

await test('photo blanche ou inaccessible : on passe à la suivante', async () => {
  const result = await generateListingOgImage(
    '222',
    [
      { url: 'https://x/blanche.jpg', rank: 1 },
      { url: 'https://x/timeout.jpg', rank: 2 },
      { url: 'https://x/bonne.jpg', rank: 3 },
    ],
    tmp,
    fetcherFor({ 'https://x/blanche.jpg': white, 'https://x/timeout.jpg': new Error('timeout'), 'https://x/bonne.jpg': photo }),
  )
  check(result.ok && result.sourceIndex === 2, JSON.stringify(result))
  check(result.rejected.length === 2, result.rejected.join(' ; '))
})

await test('reprise : seule une photo mieux classée écartée pour cause réseau déclenche un 2ᵉ essai', () => {
  const base = { ok: true as const, file: 'f', bytes: 1, quality: 80, sourceUrl: 'u', layout: 'cover' as const }
  check(needsMainPhotoRetry({ ...base, sourceIndex: 1, rejected: ['photo 1 : téléchargement impossible (timeout)'] }), 'réseau')
  check(!needsMainPhotoRetry({ ...base, sourceIndex: 1, rejected: ['photo 1 : trop petite (461×488)'] }), 'contenu')
  check(!needsMainPhotoRetry({ ...base, sourceIndex: 0, rejected: [] }), 'photo 1 utilisée')
  check(needsMainPhotoRetry({ ok: false, rejected: ['photo 1 : téléchargement impossible (HTTP 503)'] }), 'échec total')
})

await test('fichier corrompu et image trop petite rejetés', async () => {
  const tiny = await fakePhoto(300, 200)
  const result = await generateListingOgImage(
    '333',
    [
      { url: 'https://x/corrompu.jpg', rank: 1 },
      { url: 'https://x/petite.jpg', rank: 2 },
    ],
    tmp,
    fetcherFor({ 'https://x/corrompu.jpg': Buffer.from('pas une image'), 'https://x/petite.jpg': tiny }),
  )
  check(!result.ok, 'aucune image valide attendue')
  check(result.rejected.length === 2, result.rejected.join(' ; '))
})

await test('photo verticale : mise en page « contain » sans recadrage', async () => {
  const result = await generateListingOgImage('444', [{ url: 'https://x/p.jpg', rank: 1 }], tmp, fetcherFor({ 'https://x/p.jpg': portrait }))
  check(result.ok && result.layout === 'contain', JSON.stringify(result))
})

await test('validateOgJpeg détecte une image blanche', async () => {
  const blank = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#fff' } }).jpeg().toBuffer()
  const problems = await validateOgJpeg(blank)
  check(problems.some((p) => p.includes('blanche')), problems.join(', '))
})

await test("le nom de fichier change quand le contenu change (versionnement d'URL)", () => {
  check(versionedFileName('9', Buffer.from('a')) !== versionedFileName('9', Buffer.from('b')), 'hash identique')
  check(versionedFileName('9', Buffer.from('a')) === versionedFileName('9', Buffer.from('a')), 'hash instable')
})

const shell = `<!doctype html><html><head><title>x</title>
<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/jpeg" />
<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
</head><body></body></html>`

function listing(ogImage: ListingHeadInput['ogImage']): ListingHeadInput {
  return {
    id: '87604875',
    slug: '87604875',
    ogPictures: [],
    title: 'Sainte-Foy-lès-Lyon 302m²',
    city: 'Sainte-Foy-lès-Lyon',
    type: 'maison',
    price: 1,
    surface: 302,
    rooms: 8,
    images: ['https://media.apimo.pro/cache/x-original.jpg'],
    description: 'Maison',
    zipcode: '69110',
    isRental: false,
  }
}

await test('fiche avec image générée : balises complètes, uniques, jamais Apimo', () => {
  const url = `${SERVED_SITE_URL}/images/og/listings/87604875-abcdef0123.jpg`
  const route = '/acheter/87604875'
  const html = applyHead(shell, route, headForRoute(route, new Map([[route, { ...listing(null), ogImage: { url, width: 1200, height: 630 } }]])))
  const tags = readMetaTags(html)
  const problems = auditTags(tags, route)
  check(problems.length === 0, problems.join(' | '))
  check(tags.find((t) => t.key === 'og:image')?.content === url, 'og:image')
  check(tags.find((t) => t.key === 'og:image:width')?.content === '1200', 'width')
  check(tags.find((t) => t.key === 'hamac:og-route')?.content === route, 'marqueur')
  // (le JSON-LD garde les photos Apimo pour Google ; seules les balises de partage comptent ici)
  check(!tags.some((t) => t.content.includes('media.apimo.pro')), 'photo Apimo brute dans une balise')
})

await test("fiche sans image générée : image Hamac par défaut, jamais la photo Apimo", () => {
  const route = '/acheter/87604875'
  const html = applyHead(shell, route, headForRoute(route, new Map([[route, listing(null)]])))
  const tags = readMetaTags(html)
  check(auditTags(tags, route).length === 0, auditTags(tags, route).join(' | '))
  check(tags.find((t) => t.key === 'og:image')?.content === DEFAULT_OG_IMAGE, 'défaut attendu')
})

await test('auditTags signale doublons et image Apimo', () => {
  const problems = auditTags(
    [
      { key: 'og:image', content: 'https://media.apimo.pro/a.jpg' },
      { key: 'og:image', content: 'https://media.apimo.pro/a.jpg' },
    ],
    '/acheter/1',
  )
  check(problems.some((p) => p.startsWith('og:image présent 2 fois')), problems.join(' | '))
  check(problems.some((p) => p.includes('media.apimo.pro')), problems.join(' | '))
})

await test('après Chromium : la photo Apimo réécrite par le client est remplacée par l’image du build', () => {
  const url = `${SERVED_SITE_URL}/images/og/listings/87604875-abcdef0123.jpg`
  const route = '/acheter/87604875'
  const apimo = 'https://media.apimo.pro/cache/x-original.jpg'
  // HTML tel que sérialisé par Chromium (pas de « / », pas de dimensions, pas de marqueur)
  const chromium = `<html><head><title>t</title><meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:url" content="https://hamacpatrimoine.com/fr/acheter/87604875"><meta property="og:image" content="${apimo}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${apimo}"></head><body></body></html>`
  const head = headForRoute(route, new Map([[route, { ...listing(null), ogImage: { url, width: 1200, height: 630 } }]]))
  const tags = readMetaTags(applyOgImageTags(chromium, route, head))
  const problems = auditTags(tags, route)
  check(problems.length === 0, problems.join(' | '))
  check(tags.find((t) => t.key === 'og:image')?.content === url, 'og:image non remplacée')
})

await rm(tmp, { recursive: true, force: true })
if (failures) {
  console.error(`\n${failures} test(s) en échec`)
  process.exit(1)
}
console.log('\nTous les tests passent')

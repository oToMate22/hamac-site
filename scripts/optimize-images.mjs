// Convertit les images de public/images en WebP redimensionné.
// Usage : node scripts/optimize-images.mjs [--force]
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const IMAGES = fileURLToPath(new URL('../public/images', import.meta.url))
const FORCE = process.argv.includes('--force')

// Slides plein écran de la home (index.html) + heroImage des pages quartiers.
const HEROES = new Set([
  'Biens/maison-homepage.jpg',
  'Biens/maison-piscine-1.jpg',
  'Biens/appartement-interieur-1.jpg',
  'Biens/maison-moderne.jpg',
  'Biens/maison-city.jpg',
  'Biens/maison-art.jpg',
  'Biens/maison-bleu-2.jpg',
  'Biens/appartement-interieur-2.jpg',
  'Biens/maison-jardin.jpg',
])

const targetWidth = (rel) => {
  if (rel.startsWith('team/')) return 640
  if (rel.startsWith('Logo/')) return 400
  if (HEROES.has(rel)) return 1920
  return 1600
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

let converted = 0
let skipped = 0
let before = 0
let after = 0

for await (const file of walk(IMAGES)) {
  if (!/\.(jpe?g|png)$/i.test(file)) continue
  const rel = path.relative(IMAGES, file)
  const out = path.join(path.dirname(file), path.basename(file).replace(/\.(jpe?g|png)$/i, '.webp'))

  const srcStat = await stat(file)
  if (!FORCE) {
    try {
      const outStat = await stat(out)
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++
        continue
      }
    } catch {
      /* pas encore converti */
    }
  }

  const width = targetWidth(rel)
  const image = sharp(file, { failOn: 'none' })
  const meta = await image.metadata()
  const finalWidth = Math.min(width, meta.width ?? width)

  await image
    .rotate()
    .resize({ width: finalWidth, withoutEnlargement: true })
    .webp({ quality: rel.includes('Logo/') ? 90 : 75, effort: 5 })
    .toFile(out)

  const outStat = await stat(out)
  before += srcStat.size
  after += outStat.size
  converted++
  console.log(
    `${rel} → ${path.basename(out)}  ${Math.round(srcStat.size / 1024)} Ko → ${Math.round(outStat.size / 1024)} Ko`,
  )
}

console.log(`\n${converted} converties, ${skipped} déjà à jour`)
console.log(`${(before / 1048576).toFixed(1)} Mo → ${(after / 1048576).toFixed(1)} Mo`)

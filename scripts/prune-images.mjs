// Supprime les images de public/images qu'aucun fichier de src/ ou index.html ne référence.
// Usage : node scripts/prune-images.mjs          (liste seulement)
//         node scripts/prune-images.mjs --apply  (supprime)
//         node scripts/prune-images.mjs --apply --webp-orphans
import { readdir, rm, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IMAGES = path.join(ROOT, 'public/images')
const APPLY = process.argv.includes('--apply')
const WEBP_ORPHANS = process.argv.includes('--webp-orphans')

async function collectCode(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await collectCode(p)))
    else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(p)
  }
  return out
}

async function removeEmptyDirs(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) await removeEmptyDirs(path.join(dir, e.name))
  }
  const leftover = await readdir(dir)
  if (leftover.length === 0 && dir !== IMAGES) {
    await rm(dir, { recursive: true })
  }
}

const sources = [...(await collectCode(path.join(ROOT, 'src'))), path.join(ROOT, 'index.html')]

const referenced = new Set()
for (const file of sources) {
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/\/(?:fr\/)?images\/[^'"`)\s]+/g)) {
    const rel = decodeURIComponent(m[0].replace(/^\/(?:fr\/)?images\//, '').split('?')[0])
    referenced.add(rel)
  }
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

let kept = 0
const doomed = []
let mo = 0
const orphans = []
for await (const file of walk(IMAGES)) {
  const rel = path.relative(IMAGES, file)
  const isJunk = path.basename(file) === '.DS_Store'
  if (!isJunk && referenced.has(rel)) {
    kept++
    continue
  }

  if (rel.endsWith('.webp') && !WEBP_ORPHANS) {
    orphans.push(rel)
    continue
  }

  const { size } = await stat(file)
  doomed.push([rel, size])
  mo += size
}

console.log(`référencées : ${kept} | à supprimer : ${doomed.length} (${(mo / 1048576).toFixed(1)} Mo)`)
for (const [rel, size] of doomed.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(Math.round(size / 1024)).padStart(6)} Ko  ${rel}`)
}

if (APPLY) {
  for (const [rel] of doomed) await rm(path.join(IMAGES, rel), { force: true })
  await removeEmptyDirs(IMAGES)
  console.log(`\n${doomed.length} fichiers supprimés.`)
} else {
  console.log('\n(dry-run : relancer avec --apply pour supprimer)')
}

if (orphans.length) {
  console.log(`\n${orphans.length} .webp non référencées (jamais supprimées automatiquement) :`)
  for (const rel of orphans) console.log(`  ${rel}`)
  console.log('→ relancer avec --apply --webp-orphans pour les supprimer aussi,')
  console.log('  une fois le critère 2 de la section 4 vérifié.')
}

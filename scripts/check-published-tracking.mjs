// Lecture seule du JavaScript public. Aucun POST, aucun formulaire, aucun e-mail.
// Usage : node scripts/check-published-tracking.mjs [dist|https://hamacpatrimoine.com/fr/]

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const target = process.argv[2] ?? 'dist'
const EVENTS = [
  'phone_click',
  'email_click',
  'generate_lead',
  'property_view',
  'property_filter',
  'property_search',
  'no_search_results',
  'form_error',
  'page_view',
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function bundleText() {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    const page = await fetch(target, { method: 'GET', redirect: 'follow' })
    if (!page.ok) fail(`page ${page.status}`)
    const html = await page.text()
    if (/googletagmanager\.com\/gtm\.js|GTM-/.test(html)) fail('GTM présent dans le HTML')
    const src = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
    if (!src) fail('bundle introuvable')
    const url = new URL(src, target)
    const script = await fetch(url, { method: 'GET' })
    if (!script.ok) fail(`bundle ${script.status}`)
    return script.text()
  }
  const assets = join(target, 'assets')
  const file = readdirSync(assets).find((name) => /^index-.*\.js$/.test(name))
  if (!file) fail('bundle local introuvable')
  return readFileSync(join(assets, file), 'utf8')
}

const text = await bundleText()
for (const name of EVENTS) {
  if (!text.includes(name)) fail(`événement absent : ${name}`)
}
if (text.includes('gtm.js') || text.includes('GTM-')) fail('le bundle charge GTM')
if (!text.includes('G-KCHSLFNCBR')) fail('flux GA4 absent')
const automatic = text.includes('send_page_view:!0') || text.includes('send_page_view:true')
const manual = text.includes('send_page_view:!1') || text.includes('send_page_view:false')
if (automatic || !manual) fail('page_view automatique non désactivé')
console.log(`tracking publié : ${EVENTS.length} événements, gtag seul, page_view manuel`)

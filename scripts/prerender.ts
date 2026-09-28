import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { collectRoutes } from './collect-routes'
import { fetchListingsForHead, injectRouteHeads } from './inject-route-heads'
import { loadEnvFiles } from './load-env'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const PREVIEW_PORT = process.env.PRERENDER_PORT ?? '4180'
const BASE = process.env.PRERENDER_BASE_URL ?? `http://127.0.0.1:${PREVIEW_PORT}`
const BASE_PATH = (process.env.VITE_BASE_PATH ?? '/fr').replace(/\/$/, '')

loadEnvFiles(ROOT)

function outputDir(route: string) {
  if (route === '/') return path.join(DIST, BASE_PATH)
  return path.join(DIST, BASE_PATH, route.replace(/^\//, ''))
}

async function waitForServer(url: string) {
  const started = Date.now()
  while (Date.now() - started < 20000) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.ok || res.status === 302) return
    } catch {
      /* still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`vite preview injoignable sur ${url}`)
}

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: { width: 1440, height: 900 },
    })
  }
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  })
}

async function renderRoute(browser: puppeteer.Browser, route: string) {
  const page = await browser.newPage()
  try {
    const url = `${BASE}${BASE_PATH}${route}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForSelector('h1', { timeout: 20000 })
    if (/^\/(acheter|louer)\/[^/]+$/.test(route)) {
      await page.waitForFunction(
        () => {
          const title = document.querySelector('h1')?.textContent?.trim() ?? ''
          return title.length > 0 && title !== 'Chargement...'
        },
        { timeout: 40000 },
      )
      await page.waitForSelector('.detail-gallery__main img', { timeout: 15000 }).catch(() => undefined)
    }
    const html = await page.content()
    const { mkdir, writeFile } = await import('node:fs/promises')
    const dir = outputDir(route)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html)
  } finally {
    await page.close()
  }
}

const routes = await collectRoutes()
const listings = await fetchListingsForHead()
await injectRouteHeads(routes, listings)

if (process.env.SKIP_PRERENDER === '1') {
  console.warn('SKIP_PRERENDER=1 : Chromium ignoré, les pages gardent le <head> injecté.')
  process.exit(0)
}

const CHROME_BUDGET_MS = Number(process.env.PRERENDER_CHROME_MS ?? (process.env.VERCEL ? 6 * 60 * 1000 : 0)) || 0

const server = spawn(
  'npx',
  ['vite', 'preview', '--host', '127.0.0.1', '--port', PREVIEW_PORT, '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' },
)

let browser: puppeteer.Browser | undefined
const failures: string[] = []
let ok = 0

try {
  const runChrome = async () => {
    await waitForServer(`${BASE}${BASE_PATH}/`)
    browser = await launchBrowser()
    const queue = [...routes]
    const workers = 2
    await Promise.all(
      Array.from({ length: workers }, async () => {
        while (queue.length) {
          const route = queue.shift()
          if (!route) return
          try {
            await renderRoute(browser!, route)
            ok++
            console.log(`OK ${route}`)
          } catch (error) {
            failures.push(route)
            console.error(`ÉCHEC ${route} : ${(error as Error).message}`)
          }
        }
      }),
    )

    if (failures.length) {
      const retry = [...failures]
      failures.length = 0
      for (const route of retry) {
        try {
          await renderRoute(browser!, route)
          ok++
          console.log(`OK (retry) ${route}`)
        } catch (error) {
          failures.push(route)
          console.error(`ÉCHEC (retry) ${route} : ${(error as Error).message}`)
        }
      }
    }

    const { mkdir, writeFile } = await import('node:fs/promises')
    const notFoundPage = await browser.newPage()
    await notFoundPage.goto(`${BASE}${BASE_PATH}/route-inexistante-test`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })
    await notFoundPage.waitForSelector('h1', { timeout: 15000 })
    const notFound = await notFoundPage.content()
    await notFoundPage.close()
    await writeFile(path.join(DIST, '404.html'), notFound)
    await mkdir(path.join(DIST, BASE_PATH), { recursive: true })
    await writeFile(path.join(DIST, BASE_PATH, '404.html'), notFound)
  }

  if (CHROME_BUDGET_MS > 0) {
    await Promise.race([
      runChrome(),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`budget Chromium ${Math.round(CHROME_BUDGET_MS / 1000)}s dépassé`)),
          CHROME_BUDGET_MS,
        )
      }),
    ])
  } else {
    await runChrome()
  }
} catch (error) {
  console.warn(
    `Chromium indisponible (${(error as Error).message}). Les pages conservent le <head> injecté (option C).`,
  )
} finally {
  await browser?.close()
  server.kill()
}

if (ok) console.log(`\n${ok}/${routes.size} routes pré-rendues (body complet)`)
if (failures.length) {
  console.warn(
    `Pré-rendu Chromium incomplet (${failures.length} route(s)). Le <head> injecté reste en place pour ces URLs : ${failures.join(', ')}`,
  )
}

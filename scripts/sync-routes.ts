import { fileURLToPath } from 'node:url'
import { collectRoutes } from './collect-routes'
import { loadEnvFiles } from './load-env'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
loadEnvFiles(ROOT)

const routes = await collectRoutes({ forceRefresh: true })
const propertyRoutes = [...routes].filter((route) => /^\/(acheter|louer)\/[^/]+$/.test(route))
console.log(`sync:routes — ${propertyRoutes.length} fiches, ${routes.size} routes au total.`)

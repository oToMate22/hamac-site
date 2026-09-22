import { BLOG_POSTS } from '../src/data/blogPosts'
import { NEIGHBORHOODS } from '../src/data/neighborhoods'
import { STATIC_ROUTES } from '../src/routes'

export async function collectRoutes() {
  const routes = new Set<string>([
    ...STATIC_ROUTES,
    ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    ...NEIGHBORHOODS.map((neighborhood) => `/quartiers/${neighborhood.slug}`),
  ])

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absents : les fiches biens ne seraient pas pré-rendues')
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/apimo-proxy`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ route: 'properties' }),
  })
  if (!res.ok) {
    throw new Error(`apimo-proxy HTTP ${res.status}`)
  }
  const payload = (await res.json()) as {
    properties?: Array<{ id?: unknown; price?: { period?: unknown } }>
    data?: { properties?: Array<{ id?: unknown; price?: { period?: unknown } }> }
  }
  const list = payload.properties ?? payload.data?.properties ?? []
  for (const property of list) {
    if (property.id == null) continue
    const isRental = property.price?.period !== null && property.price?.period !== undefined
    routes.add(`${isRental ? '/louer' : '/acheter'}/${property.id}`)
  }
  console.log(`${list.length} biens Apimo ajoutés aux routes`)
  return routes
}

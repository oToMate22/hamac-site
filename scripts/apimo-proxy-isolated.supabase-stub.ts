// Double minimal de @supabase/supabase-js pour le test isolé d'apimo-proxy : seules les opérations
// utilisées par la fonction (select/eq/maybeSingle et upsert sur apimo_cache), transmises en HTTP
// au fetch simulé du test. Évite de dépendre de la version npm du client, instable sous Deno local.
export function createClient(url: string, key: string) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    from(table: string) {
      const endpoint = `${url}/rest/v1/${table}`
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                async maybeSingle() {
                  const res = await fetch(`${endpoint}?select=${columns}&${column}=eq.${encodeURIComponent(value)}`, { headers })
                  if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } }
                  const rows = (await res.json()) as unknown[]
                  return { data: rows[0] ?? null, error: null }
                },
              }
            },
          }
        },
        async upsert(row: unknown) {
          const res = await fetch(endpoint, { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) })
          return { error: res.ok ? null : { message: `HTTP ${res.status}` } }
        },
      }
    },
  }
}

import assert from "node:assert/strict"
import { acceptDelivery, buildDocument } from "./document.ts"
import { handleMetrics } from "./index.ts"
import { signHex } from "./signature.ts"

const SECRET = "test-secret-0123456789abcdef0123456789"
const VECTOR = {
  method: "POST",
  path: "/dashboard-metrics",
  query: {},
  body: '{"version":1}',
  timestamp: 1763308800,
  nonce: "nonce-0123456789abcd",
}
const ORG = "11111111-1111-4111-8111-111111111111"

const signature = await signHex(VECTOR, SECRET)
assert.equal(signature, "4d1483af463e8b6473af3ee57a1962c148655114c4c18eabb4a6fd28d49eebc7")

const metrics = {
  received: { value: 3, previous: 1 },
  estimations: { value: 1, previous: 0 },
  byDay: {
    start: "2026-11-16",
    bien: [1],
    contact: [1],
    estimation: [1],
    offmarket: [0],
  },
  weekly: [{ date: "2026-11-16", value: 3 }],
  latest: [
    {
      kind: "bien",
      label: "Demande sur un bien",
      detail: "Réf. LY-1",
      when: "2026-11-16T18:30:00",
    },
  ],
  catalog: [
    {
      ref: "LY-1",
      city: "Lyon",
      surface: 85,
      price: 1480000,
      rental: false,
      leads: 1,
      last: "2026-11-16T18:30:00",
    },
  ],
}

const document = buildDocument({ from: "2026-11-16", to: "2026-11-16" }, metrics)
assert.equal(document.version, 1)
assert.deepEqual(document.catalog, [
  {
    title: "Lyon 85m²",
    city: "Lyon",
    ref: "LY-1",
    kind: "Vente",
    price: new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(1480000) + " €",
    leads: 1,
    last: "16 nov. 18:30",
  },
])
const serialized = JSON.stringify(document)
for (const forbidden of ["email", "nom", "telephone", "message", "budget", "user"]) {
  assert.equal(serialized.includes(`"${forbidden}"`), false)
}
assert.throws(() =>
  buildDocument({ from: "2026-11-16", to: "2026-11-16" }, {
    ...metrics,
    catalog: [{ ...metrics.catalog[0], email: "person@example.test" }],
  }),
)

const env = new Map([
  ["DASHBOARD_KEY_ID", "oto-test"],
  ["DASHBOARD_SECRET", SECRET],
  ["DASHBOARD_KEY_ID_PREVIOUS", "oto-prev"],
  ["DASHBOARD_SECRET_PREVIOUS", "previous-secret-0123456789abcdef"],
  ["DASHBOARD_ORG_IDS", ORG],
])
const seen = new Set()
const calls = []
let delivery = null
let deliveryError = false

function rpc(name, args) {
  calls.push(name)
  if (name === "dashboard_nonce_consume") {
    const token = `${args.p_key_id}:${args.p_nonce}`
    if (seen.has(token)) return false
    seen.add(token)
    return true
  }
  if (name === "dashboard_metrics_read") return metrics
  if (name === "dashboard_delivery_read") {
    if (deliveryError) throw new Error("database")
    return delivery
  }
  throw new Error("unexpected")
}

const body = JSON.stringify({
  version: 1,
  orgId: ORG,
  from: "2026-11-16",
  to: "2026-11-16",
})
const input = { ...VECTOR, body, nonce: "nonce-protocol-00001" }
const headers = {
  "x-oto-key-id": "oto-test",
  "x-oto-timestamp": String(input.timestamp),
  "x-oto-nonce": input.nonce,
  "x-oto-signature": await signHex(input, SECRET),
  "content-type": "application/json",
}

const accepted = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers,
    body,
  }),
  { get: (name) => env.get(name) },
  rpc,
  input.timestamp,
)
assert.equal(accepted.status, 200)
const payload = await accepted.json()
assert.equal(payload.leads.received.value, 3)
assert.equal(payload.sends, undefined)
assert.equal(JSON.stringify(payload).includes("person@"), false)
assert.deepEqual(calls, [
  "dashboard_nonce_consume",
  "dashboard_metrics_read",
  "dashboard_delivery_read",
])

const replay = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers,
    body,
  }),
  { get: (name) => env.get(name) },
  rpc,
  input.timestamp,
)
assert.equal(replay.status, 401)
assert.deepEqual(await replay.json(), { error: "rejected" })

const previousBody = JSON.stringify({ version: 1, orgId: ORG, from: "2026-11-16", to: "2026-11-16" })
const previousInput = { ...VECTOR, body: previousBody, nonce: "nonce-previous-000001" }
const rotated = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: {
      "x-oto-key-id": "oto-prev",
      "x-oto-timestamp": String(previousInput.timestamp),
      "x-oto-nonce": previousInput.nonce,
      "x-oto-signature": await signHex(previousInput, "previous-secret-0123456789abcdef"),
    },
    body: previousBody,
  }),
  { get: (name) => env.get(name) },
  rpc,
  previousInput.timestamp,
)
assert.equal(rotated.status, 200)

const outsider = JSON.stringify({
  version: 1,
  orgId: "22222222-2222-4222-8222-222222222222",
  from: "2026-11-16",
  to: "2026-11-16",
})
const outsiderInput = { ...VECTOR, body: outsider, nonce: "nonce-outsider-00001" }
const consumedBeforeRefusal = calls.filter((name) => name === "dashboard_nonce_consume").length
const refused = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: {
      "x-oto-key-id": "oto-test",
      "x-oto-timestamp": String(outsiderInput.timestamp),
      "x-oto-nonce": outsiderInput.nonce,
      "x-oto-signature": await signHex(outsiderInput, SECRET),
    },
    body: outsider,
  }),
  { get: (name) => env.get(name) },
  rpc,
  outsiderInput.timestamp,
)
assert.equal(refused.status, 401)
assert.deepEqual(await refused.json(), { error: "rejected" })

const browsed = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: { ...headers, origin: "https://evil.example" },
    body,
  }),
  { get: (name) => env.get(name) },
  rpc,
  input.timestamp,
)
assert.equal(browsed.status, 401)
assert.equal(calls.filter((name) => name === "dashboard_nonce_consume").length, consumedBeforeRefusal)

const readsBeforeUnsigned = calls.filter((name) => name === "dashboard_metrics_read").length
for (const request of [
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: {
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.unsigned",
      "content-type": "application/json",
    },
    body,
  }),
  new Request("https://hamac.example/functions/v1/dashboard-metrics", { method: "GET" }),
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }),
]) {
  const unsigned = await handleMetrics(
    request,
    { get: (name) => env.get(name) },
    rpc,
    input.timestamp,
  )
  assert.equal(unsigned.status, 401)
  assert.deepEqual(await unsigned.json(), { error: "rejected" })
}
assert.equal(calls.filter((name) => name === "dashboard_metrics_read").length, readsBeforeUnsigned)

const leaked = buildDocument(
  { from: "2026-11-16", to: "2026-11-16" },
  {
    ...metrics,
    latest: [
      {
        kind: "estimation",
        label: "Estimation",
        detail: "Appartement · person@example.test",
        when: "2026-11-16T18:30:00",
      },
    ],
    catalog: [{ ...metrics.catalog[0], city: "person@example.test" }, metrics.catalog[0]],
  },
)
const leakedText = JSON.stringify(leaked)
assert.equal(leakedText.includes("@"), false)
assert.equal(leakedText.includes("person"), false)
assert.equal(leaked.catalog.length, 1)

for (const orgList of ["", `${ORG},${ORG}`, `${ORG},22222222-2222-4222-8222-222222222222`]) {
  const callsBefore = calls.length
  const closed = await handleMetrics(
    new Request("https://hamac.example/functions/v1/dashboard-metrics", {
      method: "POST",
      headers,
      body,
    }),
    { get: (name) => (name === "DASHBOARD_ORG_IDS" ? orgList : env.get(name)) },
    rpc,
    input.timestamp,
  )
  assert.equal(closed.status, 500)
  assert.deepEqual(await closed.json(), { error: "unavailable" })
  assert.equal(calls.length, callsBefore)
}

const counted = {
  since: "2026-11-16",
  failed: {
    value: 2,
    previous: 0,
    attempts: 3,
    rows: [{ label: "Notification agence", count: 2 }],
  },
}
delivery = counted
const countedBody = JSON.stringify({ version: 1, orgId: ORG, from: "2026-11-16", to: "2026-11-16" })
const countedInput = { ...VECTOR, body: countedBody, nonce: "nonce-delivery-000001" }
const countedResponse = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: {
      "x-oto-key-id": "oto-test",
      "x-oto-timestamp": String(countedInput.timestamp),
      "x-oto-nonce": countedInput.nonce,
      "x-oto-signature": await signHex(countedInput, SECRET),
      "content-type": "application/json",
    },
    body: countedBody,
  }),
  { get: (name) => env.get(name) },
  rpc,
  countedInput.timestamp,
)
assert.equal(countedResponse.status, 200)
const countedPayload = await countedResponse.json()
assert.deepEqual(countedPayload.sends, counted)
assert.equal(countedPayload.leads.received.value, 3)

deliveryError = true
const downBody = JSON.stringify({ version: 1, orgId: ORG, from: "2026-11-16", to: "2026-11-16" })
const downInput = { ...VECTOR, body: downBody, nonce: "nonce-delivery-down-01" }
const downResponse = await handleMetrics(
  new Request("https://hamac.example/functions/v1/dashboard-metrics", {
    method: "POST",
    headers: {
      "x-oto-key-id": "oto-test",
      "x-oto-timestamp": String(downInput.timestamp),
      "x-oto-nonce": downInput.nonce,
      "x-oto-signature": await signHex(downInput, SECRET),
      "content-type": "application/json",
    },
    body: downBody,
  }),
  { get: (name) => env.get(name) },
  rpc,
  downInput.timestamp,
)
assert.equal(downResponse.status, 200)
const downPayload = await downResponse.json()
assert.equal(downPayload.sends, undefined)
assert.equal(downPayload.leads.received.value, 3)

deliveryError = false
delivery = { ...counted, email: "person@example.test" }
assert.equal(acceptDelivery(delivery), null)
const leakedDelivery = buildDocument({ from: "2026-11-16", to: "2026-11-16" }, {
  ...metrics,
  sends: counted,
})
assert.equal(JSON.stringify(leakedDelivery).includes("person@"), false)
assert.throws(() =>
  buildDocument({ from: "2026-11-16", to: "2026-11-16" }, {
    ...metrics,
    sends: { ...counted, email: "person@example.test" },
  }),
)

console.log("dashboard-metrics protocol: ok")

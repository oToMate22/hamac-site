import assert from "node:assert/strict"
import {
  formOf,
  notifyJournals,
  postDeliveryFailure,
  recordJournal,
} from "./delivery-journal.ts"

for (const outcome of [
  "invalid_body",
  "invalid_form",
  "invalid_payload",
  "turnstile_failed",
  "rate_limited",
  "unavailable",
  "inserted",
] as const) {
  assert.equal(recordJournal(outcome), null)
}
assert.deepEqual(recordJournal("http"), { stage: "record", reason: "insert_failed" })
assert.deepEqual(recordJournal("unreachable"), { stage: "record", reason: "database_unreachable" })

assert.equal(formOf("leads", "bien"), "bien")
assert.equal(formOf("leads", "contact"), "contact")
assert.equal(formOf("leads", "autre"), null)
assert.equal(formOf("estimation_submissions", null), "estimation")
assert.equal(formOf("offmarket_submissions", null), "offmarket")
assert.equal(formOf("users", "contact"), null)

assert.deepEqual(
  notifyJournals({ configured: true, agency: "ok", prospect: "skipped" }),
  [],
)
assert.deepEqual(
  notifyJournals({ configured: true, agency: "ok", prospect: "ok" }),
  [],
)
assert.deepEqual(
  notifyJournals({ configured: true, agency: "http", prospect: "http" }),
  [
    { stage: "agency_notify", reason: "send_failed" },
    { stage: "prospect_confirm", reason: "send_failed" },
  ],
)
assert.deepEqual(
  notifyJournals({ configured: true, agency: "ok", prospect: "unreachable" }),
  [{ stage: "prospect_confirm", reason: "unreachable" }],
)
assert.deepEqual(
  notifyJournals({ configured: false, agency: "ok", prospect: "skipped" }),
  [{ stage: "agency_notify", reason: "unconfigured" }],
)
assert.deepEqual(
  notifyJournals({ configured: false, agency: "ok", prospect: "http" }),
  [
    { stage: "agency_notify", reason: "unconfigured" },
    { stage: "prospect_confirm", reason: "unconfigured" },
  ],
)

const lines: string[] = []
let called = false
const down = await postDeliveryFailure({
  supabaseUrl: "https://hamac.example",
  serviceKey: "service-key",
  form: "contact",
  stage: "record",
  reason: "database_unreachable",
  source: "submit-form",
  log: (line) => lines.push(line),
  fetchImpl: async () => {
    called = true
    throw new Error("connect ECONNREFUSED 10.0.0.8")
  },
})
assert.equal(down, "unavailable")
assert.equal(called, true)
assert.equal(lines.length, 1)
assert.equal(lines[0]?.includes("10.0.0.8"), false)
assert.equal(lines[0]?.includes("@"), false)
assert.match(lines[0] ?? "", /journal unavailable form=contact stage=record reason=database_unreachable/)

const bodies: string[] = []
const recorded = await postDeliveryFailure({
  supabaseUrl: "https://hamac.example/",
  serviceKey: "service-key",
  form: "bien",
  stage: "agency_notify",
  reason: "send_failed",
  source: "notify-lead",
  fetchImpl: async (_url, init) => {
    bodies.push(String(init?.body))
    return new Response(null, { status: 204 })
  },
})
assert.equal(recorded, "recorded")
assert.deepEqual(JSON.parse(bodies[0] ?? "{}"), {
  p_form: "bien",
  p_stage: "agency_notify",
  p_reason: "send_failed",
})

const refused = await postDeliveryFailure({
  supabaseUrl: "https://hamac.example",
  serviceKey: "service-key",
  form: "estimation",
  stage: "prospect_confirm",
  reason: "send_failed",
  source: "notify-lead",
  log: (line) => lines.push(line),
  fetchImpl: async () =>
    new Response(JSON.stringify({ message: "person@example.test", hint: "secret" }), { status: 500 }),
})
assert.equal(refused, "unavailable")
assert.equal(lines.some((line) => line.includes("person@") || line.includes("secret")), false)
assert.match(lines.at(-1) ?? "", /status=500/)

const missing = await postDeliveryFailure({
  supabaseUrl: undefined,
  serviceKey: undefined,
  form: "offmarket",
  stage: "record",
  reason: "insert_failed",
  source: "submit-form",
  log: (line) => lines.push(line),
  fetchImpl: async () => {
    throw new Error("must not be called")
  },
})
assert.equal(missing, "unavailable")

const skipped = await postDeliveryFailure({
  supabaseUrl: "https://hamac.example",
  serviceKey: "service-key",
  form: null,
  stage: "agency_notify",
  reason: "send_failed",
  source: "notify-lead",
  log: (line) => lines.push(line),
  fetchImpl: async () => {
    throw new Error("must not be called")
  },
})
assert.equal(skipped, "skipped")

console.log("delivery-journal: ok")

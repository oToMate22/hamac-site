// ─────────────────────────────────────────────
// src/analytics/params.ts
// Moteur générique de validation des paramètres d'événements.
//
// La transmission ne parcourt que les clés du schéma. Les clés propres de
// l'objet reçu ne servent qu'à refuser l'objet entier (clé inconnue, accesseur,
// symbole). Une valeur invalide rejette aussi l'objet entier.
// Aucune valeur rejetée n'est conservée dans le résultat.
// Aucune liste métier : enums, motifs et résolveur de communes sont injectés.
// ─────────────────────────────────────────────

const SCHEMA_KEY_FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])

export type FailureReason =
  | 'not_object'
  | 'unexpected_key'
  | 'symbol_key'
  | 'accessor'
  | 'invalid_type'
  | 'invalid_value'
  | 'out_of_range'
  | 'resolver_rejected'

export type ValidationFailure = {
  readonly ok: false
  readonly reason: FailureReason
  readonly keys: readonly string[]
}

export type EnumParam<T extends readonly string[] = readonly string[]> = {
  readonly kind: 'enum'
  readonly values: T
}

export type CountParam = {
  readonly kind: 'count'
  readonly max: number
}

export type NumberParam = {
  readonly kind: 'number'
  readonly min: number
  readonly max: number
  readonly integer: boolean
}

export type BoolParam = {
  readonly kind: 'bool'
}

export type RefParam = {
  readonly kind: 'ref'
  readonly pattern: RegExp
}

/** Résout une saisie vers un libellé canonique, ou null si elle n'est pas autorisée. */
export type CommuneResolver = (value: string) => string | null

export type CommuneParam = {
  readonly kind: 'commune'
  readonly resolve: CommuneResolver
}

export type ParamDescriptor = EnumParam | CountParam | NumberParam | BoolParam | RefParam | CommuneParam

export type ParamSchema = Readonly<Record<string, ParamDescriptor>>

type InferParamValue<D> = D extends { kind: 'enum'; values: readonly (infer T extends string)[] }
  ? T
  : D extends { kind: 'count' | 'number' }
    ? number
    : D extends { kind: 'bool' }
      ? boolean
      : D extends { kind: 'ref' | 'commune' }
        ? string
        : never

export type InferredParams<S extends ParamSchema> = {
  readonly [K in keyof S]?: InferParamValue<S[K]>
}

export type ValidationSuccess<S extends ParamSchema> = {
  readonly ok: true
  readonly params: InferredParams<S>
}

export type ValidationResult<S extends ParamSchema> = ValidationSuccess<S> | ValidationFailure

type PreparedSchema = {
  readonly keys: readonly string[]
  readonly descriptors: ReadonlyMap<string, ParamDescriptor>
}

function schemaError(message: string): never {
  throw new TypeError(`params: ${message}`)
}

function isPlainObject(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

function isDataDescriptor(desc: PropertyDescriptor): desc is PropertyDescriptor & { value: unknown } {
  return !('get' in desc) && !('set' in desc)
}

function canonicalNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function isSafeIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max
}

function freezeEnumValues<T extends readonly string[]>(values: T): T {
  if (values.length === 0) schemaError('enum without values')
  const seen = new Set<string>()
  for (const entry of values) {
    if (typeof entry !== 'string' || entry.length === 0) schemaError('enum value must be a non-empty string')
    if (seen.has(entry)) schemaError('duplicate enum value')
    seen.add(entry)
  }
  return Object.freeze([...values]) as unknown as T
}

export function enumParam<const T extends readonly [string, ...string[]]>(values: T): EnumParam<T> {
  return Object.freeze({ kind: 'enum', values: freezeEnumValues(values) })
}

export function countParam(max: number): CountParam {
  if (!isSafeIntegerInRange(max, 0, Number.MAX_SAFE_INTEGER)) schemaError('count max must be a non-negative safe integer')
  return Object.freeze({ kind: 'count', max })
}

export function numberParam(bounds: { min: number; max: number; integer?: boolean }): NumberParam {
  const { min, max } = bounds
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) schemaError('number bounds must be finite and ordered')
  const integer = bounds.integer === true
  if (bounds.integer !== undefined && typeof bounds.integer !== 'boolean') schemaError('number integer flag must be boolean')
  if (integer && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max))) {
    schemaError('integer number bounds must be safe integers')
  }
  return Object.freeze({ kind: 'number', min, max, integer })
}

export function boolParam(): BoolParam {
  return Object.freeze({ kind: 'bool' })
}

export function refParam(pattern: RegExp): RefParam {
  if (!(pattern instanceof RegExp)) schemaError('ref pattern must be a RegExp')
  return Object.freeze({ kind: 'ref', pattern })
}

export function communeParam(resolve: CommuneResolver): CommuneParam {
  if (typeof resolve !== 'function') schemaError('commune resolver must be a function')
  return Object.freeze({ kind: 'commune', resolve })
}

function assertDescriptor(descriptor: unknown): ParamDescriptor {
  if (descriptor === null || typeof descriptor !== 'object' || Array.isArray(descriptor)) schemaError('invalid descriptor')
  const record = descriptor as { kind?: unknown }
  switch (record.kind) {
    case 'enum': {
      const values = (descriptor as { values?: unknown }).values
      if (!Array.isArray(values)) schemaError('enum values must be an array')
      freezeEnumValues(values as string[])
      return descriptor as EnumParam
    }
    case 'count': {
      const max = (descriptor as { max?: unknown }).max
      if (typeof max !== 'number' || !isSafeIntegerInRange(max, 0, Number.MAX_SAFE_INTEGER)) {
        schemaError('count max must be a non-negative safe integer')
      }
      return descriptor as CountParam
    }
    case 'number': {
      const { min, max, integer } = descriptor as { min?: unknown; max?: unknown; integer?: unknown }
      if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        schemaError('number bounds must be finite and ordered')
      }
      if (integer !== undefined && typeof integer !== 'boolean') schemaError('number integer flag must be boolean')
      if (integer === true && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max))) {
        schemaError('integer number bounds must be safe integers')
      }
      return descriptor as NumberParam
    }
    case 'bool':
      return descriptor as BoolParam
    case 'ref': {
      const pattern = (descriptor as { pattern?: unknown }).pattern
      if (!(pattern instanceof RegExp)) schemaError('ref pattern must be a RegExp')
      return descriptor as RefParam
    }
    case 'commune': {
      const resolve = (descriptor as { resolve?: unknown }).resolve
      if (typeof resolve !== 'function') schemaError('commune resolver must be a function')
      return descriptor as CommuneParam
    }
    default:
      schemaError('unknown descriptor kind')
  }
}

function prepareSchema(schema: object): PreparedSchema {
  const symbols = Object.getOwnPropertySymbols(schema)
  if (symbols.length > 0) schemaError('schema symbol key')
  const keys: string[] = []
  const descriptors = new Map<string, ParamDescriptor>()
  for (const key of Object.getOwnPropertyNames(schema)) {
    if (key.length === 0 || SCHEMA_KEY_FORBIDDEN.has(key)) schemaError('forbidden schema key')
    const desc = Object.getOwnPropertyDescriptor(schema, key)
    if (!desc || !isDataDescriptor(desc)) schemaError('schema accessor')
    const descriptor = assertDescriptor(desc.value)
    keys.push(key)
    descriptors.set(key, descriptor)
  }
  return { keys, descriptors }
}

export function defineSchema<const S extends ParamSchema>(schema: S): S {
  if (!isPlainObject(schema)) schemaError('schema must be a plain object')
  const prepared = prepareSchema(schema)
  const frozen = Object.create(null) as Record<string, ParamDescriptor>
  for (const key of prepared.keys) {
    const descriptor = prepared.descriptors.get(key)
    if (!descriptor) schemaError('missing descriptor')
    Object.defineProperty(frozen, key, {
      value: descriptor,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }
  return Object.freeze(frozen) as S
}

function fail(reason: FailureReason, keys: readonly string[] = []): ValidationFailure {
  return { ok: false, reason, keys }
}

/**
 * Refuse symboles, accesseurs et clés propres hors schéma.
 * Ne lit pas les valeurs : les accesseurs ne sont pas appelés.
 */
function rejectUnexpected(input: object, allowed: ReadonlySet<string>): ValidationFailure | null {
  if (Object.getOwnPropertySymbols(input).length > 0) return fail('symbol_key', ['symbol'])
  const accessors: string[] = []
  const unexpected: string[] = []
  for (const key of Object.getOwnPropertyNames(input)) {
    const desc = Object.getOwnPropertyDescriptor(input, key)
    if (!desc || !isDataDescriptor(desc)) {
      accessors.push(key)
      continue
    }
    if (!allowed.has(key)) unexpected.push(key)
  }
  if (accessors.length > 0) return fail('accessor', accessors)
  if (unexpected.length > 0) return fail('unexpected_key', unexpected)
  return null
}

function matchesEntirely(pattern: RegExp, value: string): boolean {
  const flags = pattern.flags.replace(/[gym]/g, '')
  return new RegExp(`^(?:${pattern.source})$`, flags).test(value)
}

function isCleanString(value: string): boolean {
  return value.length > 0 && !/[\u0000-\u001f]/u.test(value)
}

type ValueCheck = { ok: true; value: string | number | boolean } | { ok: false; reason: FailureReason }

function checkValue(descriptor: ParamDescriptor, value: unknown): ValueCheck {
  switch (descriptor.kind) {
    case 'enum': {
      if (typeof value !== 'string') return { ok: false, reason: 'invalid_type' }
      const allowedValues = new Set<string>()
      for (const entry of descriptor.values) {
        if (typeof entry === 'string') allowedValues.add(entry)
      }
      if (!allowedValues.has(value)) return { ok: false, reason: 'invalid_value' }
      return { ok: true, value }
    }
    case 'count': {
      if (typeof value !== 'number') return { ok: false, reason: 'invalid_type' }
      const normalized = canonicalNumber(value)
      if (!Number.isSafeInteger(normalized)) return { ok: false, reason: 'invalid_value' }
      if (!isSafeIntegerInRange(normalized, 0, descriptor.max)) return { ok: false, reason: 'out_of_range' }
      return { ok: true, value: normalized }
    }
    case 'number': {
      if (typeof value !== 'number') return { ok: false, reason: 'invalid_type' }
      if (!Number.isFinite(value)) return { ok: false, reason: 'invalid_value' }
      const normalized = canonicalNumber(value)
      if (descriptor.integer && !Number.isSafeInteger(normalized)) return { ok: false, reason: 'invalid_value' }
      if (normalized < descriptor.min || normalized > descriptor.max) return { ok: false, reason: 'out_of_range' }
      return { ok: true, value: normalized }
    }
    case 'bool': {
      if (typeof value !== 'boolean') return { ok: false, reason: 'invalid_type' }
      return { ok: true, value }
    }
    case 'ref': {
      if (typeof value !== 'string') return { ok: false, reason: 'invalid_type' }
      if (!matchesEntirely(descriptor.pattern, value)) return { ok: false, reason: 'invalid_value' }
      return { ok: true, value }
    }
    case 'commune': {
      if (typeof value !== 'string') return { ok: false, reason: 'invalid_type' }
      let resolved: string | null
      try {
        resolved = descriptor.resolve(value)
      } catch {
        return { ok: false, reason: 'resolver_rejected' }
      }
      if (typeof resolved !== 'string' || !isCleanString(resolved)) return { ok: false, reason: 'resolver_rejected' }
      return { ok: true, value: resolved }
    }
    default:
      return { ok: false, reason: 'invalid_value' }
  }
}

function summarize(reasons: readonly FailureReason[]): FailureReason {
  const first = reasons[0]
  if (!first) return 'invalid_value'
  for (const reason of reasons) {
    if (reason !== first) return 'invalid_value'
  }
  return first
}

/**
 * Valide `input` contre `schema`.
 * Les clés transmises sont uniquement celles du schéma, présentes et valides.
 * Si une clé propre n'appartient pas au schéma, ou si une valeur est invalide,
 * rien n'est transmis.
 */
export function validateParams<S extends ParamSchema>(schema: S, input: unknown): ValidationResult<S> {
  if (!isPlainObject(schema)) schemaError('schema must be a plain object')
  const prepared = prepareSchema(schema)
  if (!isPlainObject(input)) return fail('not_object')

  const allowed = new Set(prepared.keys)
  const structural = rejectUnexpected(input, allowed)
  if (structural) return structural

  const accepted: Array<{ key: string; value: string | number | boolean }> = []
  const failures: FailureReason[] = []
  const failureKeys: string[] = []

  for (const key of prepared.keys) {
    if (!Object.hasOwn(input, key)) continue
    const desc = Object.getOwnPropertyDescriptor(input, key)
    if (!desc || !isDataDescriptor(desc)) {
      failures.push('accessor')
      failureKeys.push(key)
      continue
    }
    const checked = checkValue(prepared.descriptors.get(key) as ParamDescriptor, desc.value)
    if (!checked.ok) {
      failures.push(checked.reason)
      failureKeys.push(key)
      continue
    }
    accepted.push({ key, value: checked.value })
  }

  if (failures.length > 0) return fail(summarize(failures), failureKeys)

  const params = Object.create(null) as Record<string, string | number | boolean>
  for (const entry of accepted) {
    Object.defineProperty(params, entry.key, {
      value: entry.value,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }
  return { ok: true, params: Object.freeze(params) as InferredParams<S> }
}

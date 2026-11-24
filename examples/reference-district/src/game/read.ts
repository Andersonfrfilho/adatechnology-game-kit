import type { PlanPoint, PlanRect } from '@adatechnology/game-urban'

/** A malformed data file: `path` names the field (`$.lots[3].rect[1]`). */
export class DataError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'DataError'
    this.path = path
  }
}

export type Reader<TValue> = (value: unknown, path: string) => TValue

export const readRecord: Reader<Readonly<Record<string, unknown>>> = (value, path) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DataError(path, 'expected an object')
  return value as Record<string, unknown>
}

export const readString: Reader<string> = (value, path) => {
  if (typeof value !== 'string' || value === '') throw new DataError(path, 'expected a non-empty string')
  return value
}

export const readNumber: Reader<number> = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new DataError(path, 'expected a finite number')
  return value
}

export const readBoolean: Reader<boolean> = (value, path) => {
  if (typeof value !== 'boolean') throw new DataError(path, 'expected true or false')
  return value
}

export const readPositive: Reader<number> = (value, path) => {
  const number = readNumber(value, path)
  if (number <= 0) throw new DataError(path, `expected a number above 0, got ${number}`)
  return number
}

export const readInteger: Reader<number> = (value, path) => {
  const number = readNumber(value, path)
  if (!Number.isInteger(number)) throw new DataError(path, `expected an integer, got ${number}`)
  return number
}

export const readPositiveInteger: Reader<number> = (value, path) => {
  const number = readInteger(value, path)
  if (number <= 0) throw new DataError(path, `expected an integer above 0, got ${number}`)
  return number
}

/** A part of a whole, in (0, 1]. */
export const readShare: Reader<number> = (value, path) => {
  const share = readPositive(value, path)
  if (share > 1) throw new DataError(path, `expected a share up to 1, got ${share}`)
  return share
}

export function readOneOf<TOption extends string>(options: readonly TOption[]): Reader<TOption> {
  return (value, path) => {
    if (typeof value === 'string' && (options as readonly string[]).includes(value)) return value as TOption
    throw new DataError(path, `expected one of ${options.join(', ')}`)
  }
}

export function readList<TItem>(readItem: Reader<TItem>, minLength = 0): Reader<readonly TItem[]> {
  return (value, path) => {
    if (!Array.isArray(value)) throw new DataError(path, 'expected a list')
    if (value.length < minLength) throw new DataError(path, `expected at least ${minLength} items, got ${value.length}`)
    return value.map((item: unknown, index) => readItem(item, `${path}[${index}]`))
  }
}

export const readPoint: Reader<PlanPoint> = (value, path) => {
  const [x, z] = readList(readNumber)(value, path)
  if (x === undefined || z === undefined || (value as unknown[]).length !== 2) throw new DataError(path, 'expected [x, z]')
  return [x, z]
}

export const readRect: Reader<PlanRect> = (value, path) => {
  const numbers = readList(readNumber)(value, path)
  const [x0, z0, x1, z1] = numbers
  if (x0 === undefined || z0 === undefined || x1 === undefined || z1 === undefined || numbers.length !== 4) throw new DataError(path, 'expected [x0, z0, x1, z1]')
  if (x1 <= x0 || z1 <= z0) throw new DataError(path, 'expected x1 > x0 and z1 > z0')
  return [x0, z0, x1, z1]
}

/** Reads `record[key]` with `read`, naming the field in the error. */
export function readField<TValue>(record: Readonly<Record<string, unknown>>, path: string, key: string, read: Reader<TValue>): TValue {
  return read(record[key], `${path}.${key}`)
}

/** Reads `record[key]` when present; a missing key is `undefined`, a wrong one is an error. */
export function readOptional<TValue>(record: Readonly<Record<string, unknown>>, path: string, key: string, read: Reader<TValue>): TValue | undefined {
  return record[key] === undefined ? undefined : read(record[key], `${path}.${key}`)
}

/** An object that has only the `allowed` keys: a typo (`pendng`) is an error naming its path. */
export function readStrict(allowed: readonly string[]): Reader<Readonly<Record<string, unknown>>> {
  return (value, path) => {
    const record = readRecord(value, path)
    for (const key of Object.keys(record)) if (!allowed.includes(key)) throw new DataError(`${path}.${key}`, `unknown field, expected one of ${allowed.join(', ')}`)
    return record
  }
}

/** The `[width, depth]` of a map in metres. */
export const readSize: Reader<readonly [number, number]> = (value, path) => {
  const sizes = readList(readNumber)(value, path)
  const [width, depth] = sizes
  if (width === undefined || depth === undefined || sizes.length !== 2 || width <= 0 || depth <= 0) throw new DataError(path, 'expected [width, depth], both above 0')
  return [width, depth]
}

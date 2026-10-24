import type { RandomStream } from '../random'
import { normalized } from './vector-math'

/** A value an effect computes: a number, a flag, a name or a vector. */
export type EffectValue = number | boolean | string | readonly number[]

/** A computed field of a recipe. Plain data: `{ $: 'add', a: [1, { $: 't' }] }`. Built with the helpers in `dsl.ts`. */
export interface Expr {
  readonly $: string
  readonly a?: readonly unknown[]
}

export interface ExprContext {
  readonly random: RandomStream
  readonly param: number
  readonly time: number
  readonly dt: number
  readonly index: number
  readonly variables: ReadonlyMap<string, unknown>
  readonly scaled: (count: number) => number
  readonly quality: number
  /** True on the first run after the effect was chosen, false on its repeats (the page's `fresh`). */
  readonly fresh: boolean
  /** Which way the played effect points and which surface it hit, in the world (`play`'s `direction` and `normal`). */
  readonly direction: readonly number[]
  readonly normal: readonly number[]
  readonly query: (behavior: string, name: string, args: readonly unknown[]) => unknown
  readonly camera: { readonly position: readonly number[]; readonly forward: (local: readonly number[]) => readonly number[] }
}

export function isExpr(value: unknown): value is Expr {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && '$' in value
}

type Vector = readonly number[]
const asNumber = (value: unknown): number => value as number
const asVector = (value: unknown): Vector => value as Vector
const EASE_LIMIT = 1

function ease(value: number): number {
  return value < 0 ? 0 : value > EASE_LIMIT ? EASE_LIMIT : value * value * (3 - 2 * value)
}

function reduceVectors(operands: readonly unknown[], combine: (accumulated: number, next: number) => number): Vector {
  const [first, ...rest] = operands.map(asVector)
  return rest.reduce<Vector>((total, next) => [combine(total[0]!, next[0]!), combine(total[1]!, next[1]!), combine(total[2]!, next[2]!)], first!)
}

function evaluateCall(name: string, args: readonly unknown[]): unknown {
  const [first, second, third] = args
  switch (name) {
    case 'concat': return args.map(String).join('')
    case 'add': return args.reduce<number>((total, next) => total + asNumber(next), 0)
    case 'sub': return asNumber(first) - asNumber(second)
    case 'mul': return args.reduce<number>((total, next) => total * asNumber(next), 1)
    case 'div': return asNumber(first) / asNumber(second)
    case 'mod': return asNumber(first) % asNumber(second)
    case 'neg': return -asNumber(first)
    case 'abs': return Math.abs(asNumber(first))
    case 'sqrt': return Math.sqrt(asNumber(first))
    case 'sin': return Math.sin(asNumber(first))
    case 'cos': return Math.cos(asNumber(first))
    case 'atan2': return Math.atan2(asNumber(first), asNumber(second))
    case 'min': return Math.min(...args.map(asNumber))
    case 'max': return Math.max(...args.map(asNumber))
    case 'floor': return Math.floor(asNumber(first))
    case 'ceil': return Math.ceil(asNumber(first))
    case 'round': return Math.round(asNumber(first))
    case 'clamp': return asNumber(first) < asNumber(second) ? asNumber(second) : asNumber(first) > asNumber(third) ? asNumber(third) : asNumber(first)
    case 'lerp': return asNumber(first) + (asNumber(second) - asNumber(first)) * asNumber(third)
    case 'ease': return ease(asNumber(first))
    case 'lt': return asNumber(first) < asNumber(second)
    case 'gt': return asNumber(first) > asNumber(second)
    case 'le': return asNumber(first) <= asNumber(second)
    case 'ge': return asNumber(first) >= asNumber(second)
    case 'eq': return first === second
    case 'ne': return first !== second
    case 'not': return !first
    case 'vadd': return reduceVectors(args, (total, next) => total + next)
    case 'vsub': return reduceVectors(args, (total, next) => total - next)
    case 'vscale': return asVector(first).map((component) => component * asNumber(second))
    case 'vnorm': return normalized(asVector(first) as readonly [number, number, number])
    case 'vneg': return asVector(first).map((component) => -component)
    case 'vlerp': return asVector(first).map((component, axis) => component + (asVector(second)[axis]! - component) * asNumber(third))
    case 'vx': return asVector(first)[0]
    case 'vy': return asVector(first)[1]
    case 'vz': return asVector(first)[2]
    case 'vdist': {
      const dx = asVector(first)[0]! - asVector(second)[0]!
      const dy = asVector(first)[1]! - asVector(second)[1]!
      const dz = asVector(first)[2]! - asVector(second)[2]!
      return Math.sqrt(dx * dx + dy * dy + dz * dz)
    }
    case 'with': return asVector(first).map((component, axis) => (axis === asNumber(second) ? asNumber(third) : component))
    default: throw new Error(`unknown expression: ${name}`)
  }
}

/** Resolves every `Expr` inside `value` (arrays and plain objects are walked in order, so the draws follow the order the page wrote its fields). */
export function resolve(value: unknown, context: ExprContext): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolve(entry, context))
  if (typeof value !== 'object' || value === null) return value
  if (!isExpr(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolve(entry, context)]))
  const args = value.a ?? []
  switch (value.$) {
    case 'rnd': return context.random.between(asNumber(resolve(args[0], context)), asNumber(resolve(args[1], context)))
    case 'rand': return context.random.next()
    case 'param': return (args[0] as readonly unknown[])[context.param]
    case 'paramIndex': return context.param
    case 't': return context.time
    case 'dt': return context.dt
    case 'index': return context.index
    case 'quality': return context.quality
    case 'fresh': return context.fresh
    case 'direction': return context.direction
    case 'normal': return context.normal
    case 'scaled': return context.scaled(asNumber(resolve(args[0], context)))
    case 'var': return context.variables.get(args[0] as string)
    case 'at': return (resolve(args[0], context) as readonly unknown[])[asNumber(resolve(args[1], context))]
    case 'query': return context.query(args[0] as string, args[1] as string, args.slice(2).map((entry) => resolve(entry, context)))
    case 'cameraPosition': return context.camera.position
    case 'cameraForward': return context.camera.forward(asVector(resolve(args[0], context)))
    case 'let': return resolve(args[2], { ...context, variables: new Map([...context.variables, [args[0] as string, resolve(args[1], context)]]) })
    case 'ite': return resolve(resolve(args[0], context) ? args[1] : args[2], context)
    case 'and': return args.reduce<unknown>((result, next) => (result ? resolve(next, context) : result), true)
    case 'or': return args.reduce<unknown>((result, next) => (result ? result : resolve(next, context)), false)
    default: return evaluateCall(value.$, args.map((entry) => resolve(entry, context)))
  }
}

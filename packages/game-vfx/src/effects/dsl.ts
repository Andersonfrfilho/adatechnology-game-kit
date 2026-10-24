import type { Expr } from './expression'

/** Constructors for the computed fields of a recipe. They only build data (`{ $, a }`); `expression.ts` runs it. */
const call =
  (name: string) =>
  (...args: readonly unknown[]): Expr => ({ $: name, a: args })

export const rnd = call('rnd')
export const rand = call('rand')
export const add = call('add')
export const concat = call('concat')
export const sub = call('sub')
export const mul = call('mul')
export const div = call('div')
export const mod = call('mod')
export const neg = call('neg')
export const abs = call('abs')
export const sqrt = call('sqrt')
export const sin = call('sin')
export const cos = call('cos')
export const atan2 = call('atan2')
export const min = call('min')
export const max = call('max')
export const floor = call('floor')
export const ceil = call('ceil')
export const round = call('round')
export const clamp = call('clamp')
export const lerp = call('lerp')
export const ease = call('ease')
export const lt = call('lt')
export const gt = call('gt')
export const le = call('le')
export const ge = call('ge')
export const eq = call('eq')
export const ne = call('ne')
export const not = call('not')
export const and = call('and')
export const or = call('or')
export const ite = call('ite')
export const vadd = call('vadd')
export const vsub = call('vsub')
export const vscale = call('vscale')
export const vnorm = call('vnorm')
export const vneg = call('vneg')
export const vlerp = call('vlerp')
export const vx = call('vx')
export const vy = call('vy')
export const vz = call('vz')
export const vdist = call('vdist')
export const vwith = call('with')
export const pick = call('at')
export const scaled = call('scaled')
export const param = (...values: readonly unknown[]): Expr => ({ $: 'param', a: [values] })
/** Binds `name` to `value` while `body` resolves: the page's `const a = ...` inside a spawn callback. */
export const local = (name: string, value: unknown, body: unknown): Expr => ({ $: 'let', a: [name, value, body] })
export const query = (behavior: string, name: string, ...args: readonly unknown[]): Expr => ({ $: 'query', a: [behavior, name, ...args] })
export const variable = (name: string): Expr => ({ $: 'var', a: [name] })
export const cameraForward = call('cameraForward')
export const TIME: Expr = { $: 't' }
export const PARAM: Expr = { $: 'paramIndex' }
export const DELTA: Expr = { $: 'dt' }
export const INDEX: Expr = { $: 'index' }
export const QUALITY: Expr = { $: 'quality' }
export const FRESH: Expr = { $: 'fresh' }
export const DIRECTION: Expr = { $: 'direction' }
export const NORMAL: Expr = { $: 'normal' }
export const CAMERA_POSITION: Expr = { $: 'cameraPosition' }
export const UP = [0, 1, 0] as const

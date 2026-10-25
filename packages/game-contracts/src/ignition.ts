import type { Hit } from './destruction'

/**
 * How a container of flammable fluid (a fuel tank, a jerrycan, a gas bottle) is set alight by what hits it. A normal bullet that goes through only
 * makes a leak; the leak lights when something supplies a flame: a spark of a hard round on metal, an incendiary or tracer round, a fire nearby
 * or a blast. These are the numbers of the target side; the numbers of the round (core, jacket, incendiary, tracer) are in the weapons module
 * (`rules.ignition` of `@adatechnology/game-weapons`) and reach the target in `Hit.ignition`. Every number is a default to be changed per game.
 */
export interface IgnitionRules {
  /**
   * How much of the spark and of the flame of a round reaches the vapour, by how full the container is: points `[filled, factor]`, `filled` 0..1
   * (litres over capacity), `factor` 0..1, linear between points. A full container holds a mixture too rich to burn (the vapour has no air) and
   * mostly leaks; a nearly empty one holds the vapour/air mixture of a flammable range and lights the easiest; a dry one has little vapour left.
   * Default: 0.6 empty, 1 at 10 percent, 0.6 at 35, 0.3 at 65, 0.15 at 90 and 0.12 full.
   */
  fillCurve: ReadonlyArray<readonly [number, number]>
  /** 0..1: how much of the fill factor also weighs on the flame of an incendiary or tracer (1: as much as on a spark; 0: not at all). Default 0.5. */
  flameFillInfluence: number
  /** Chance of the flame of a round that is flagged `incendiary` or `tracer` but carries no `ignition` numbers (a host that passes only the flags). */
  flameDefaults: { incendiary: number; tracer: number }
  /**
   * What a spark needs to strike: a factor 0..1 by material id of the struck part. A material that is not listed but is metal takes
   * `sparkMetalDefault`; a part that is not metal never sparks. Default: steel and iron 1, aluminium 0.25.
   */
  sparkTarget: Readonly<Record<string, number>>
  sparkMetalDefault: number
  /**
   * Factor 0..1 on the spark by fluid (default 1): diesel has a flash point of 52 degrees C and more, so a spark that lights petrol vapour does
   * not light it (a flame does). Default: diesel 0.15.
   */
  sparkFluid: Readonly<Record<string, number>>
  /** A leaking container of flammable fluid within `radius` metres of a burning part or a burning fuel stain lights at `chancePerSecond`. */
  fireNear: { radius: number; chancePerSecond: number }
}

/** Defaults of `IgnitionRules`. */
export const DEFAULT_IGNITION_RULES: IgnitionRules = {
  fillCurve: [
    [0, 0.6],
    [0.1, 1],
    [0.35, 0.6],
    [0.65, 0.3],
    [0.9, 0.15],
    [1, 0.12],
  ],
  flameFillInfluence: 0.5,
  flameDefaults: { incendiary: 0.7, tracer: 0.2 },
  sparkTarget: { steel: 1, iron: 1, aluminium: 0.25 },
  sparkMetalDefault: 0.5,
  sparkFluid: { diesel: 0.15 },
  fireNear: { radius: 1.5, chancePerSecond: 0.5 },
}

/** Merges a partial `IgnitionRules` over the defaults (an object is merged one level deep). */
export const resolveIgnitionRules = (rules?: Partial<IgnitionRules>): IgnitionRules => ({
  ...DEFAULT_IGNITION_RULES,
  ...rules,
  flameDefaults: { ...DEFAULT_IGNITION_RULES.flameDefaults, ...rules?.flameDefaults },
  sparkTarget: { ...DEFAULT_IGNITION_RULES.sparkTarget, ...rules?.sparkTarget },
  sparkFluid: { ...DEFAULT_IGNITION_RULES.sparkFluid, ...rules?.sparkFluid },
  fireNear: { ...DEFAULT_IGNITION_RULES.fireNear, ...rules?.fireNear },
})

/** Linear interpolation of the fill curve at `fill` (0..1); outside the points it keeps the first or the last. */
export const fillFactor = (fill: number, curve: IgnitionRules['fillCurve'] = DEFAULT_IGNITION_RULES.fillCurve): number => {
  if (curve.length === 0) return 1
  const f = Math.min(1, Math.max(0, fill))
  if (f <= curve[0]![0]) return curve[0]![1]
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!
    const [x0, y0] = curve[i - 1]!
    if (f <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (f - x0)) / (x1 - x0)
  }
  return curve[curve.length - 1]![1]
}

/** The factor of what a spark strikes: 0 when the struck part is not metal. */
export const sparkTargetFactor = (materialId: string, metal: boolean, rules: IgnitionRules = DEFAULT_IGNITION_RULES): number =>
  !metal ? 0 : rules.sparkTarget[materialId] ?? rules.sparkMetalDefault

/**
 * Chance that one round that went through the wall of a container lights the fluid that leaks: the spark (only on metal) and the flame (any
 * wall), each weighed by the fill of the container; the two are independent. 0 when the round carries nothing (`Hit.ignition` absent and not
 * flagged `incendiary` or `tracer`): a plain bullet on a plain wall only leaks.
 */
export const ignitionChance = (hit: Pick<Hit, 'incendiary' | 'tracer' | 'ignition'>, target: { sparkTarget: number; fill: number; fluid?: string }, rules: IgnitionRules = DEFAULT_IGNITION_RULES): number => {
  const k = fillFactor(target.fill, rules.fillCurve)
  const spark = (hit.ignition?.spark ?? 0) * target.sparkTarget * (target.fluid === undefined ? 1 : rules.sparkFluid[target.fluid] ?? 1) * k
  const flameBase = hit.ignition?.flame ?? Math.max(hit.incendiary ? rules.flameDefaults.incendiary : 0, hit.tracer ? rules.flameDefaults.tracer : 0)
  const flame = flameBase * (1 - rules.flameFillInfluence * (1 - k))
  return 1 - (1 - Math.min(1, Math.max(0, spark))) * (1 - Math.min(1, Math.max(0, flame)))
}

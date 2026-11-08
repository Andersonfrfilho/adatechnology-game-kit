import type { RandomStream } from '../random'
import { WATER_BLASTS, WATER_BLAST_KINDS, resolveWaterShotProfile } from './profiles'
import type { WaterBlastKind, WaterBlastParams, WaterBlastPlan, WaterShotParams, WaterShotPlan, WaterShotProfile, WaterVec3 } from './types'

const DEGREES = 180 / Math.PI
/** A round slower than this in water is spent: it sinks and leaves no more trail. */
const SPENT_SPEED = 15
/** Metres of water the default host puts under a point it says nothing about. */
const DEFAULT_DEPTH = 2
/** Share of the speed a round keeps when it skips off the water. */
const RICOCHET_SPEED_SHARE = 0.6
/** Most degrees a skipping round turns aside. */
const RICOCHET_YAW_DEG = 6
/** Column height of a burst of 1 kg TNT at its best depth, metres per kg^(1/4). */
const BLAST_COLUMN_PER_QUARTIC_KG = 10
/** Bursts higher over the water than this many cube-root kilograms throw no water, only the shock ring and spray. */
const AIRBURST_SCALED_HEIGHT = 2.5
/** Scaled depth (metres per cube-root kg) at which a burst throws the tallest column; deeper the water holds it down. */
const BEST_SCALED_DEPTH = 0.6
/** Scaled depth over which the column falls by 1/e past the best depth. */
const DEEP_FALL = 1.6
/** Scaled depth over which a burst counts as under the water (no fireball). */
const UNDERWATER_SCALED_DEPTH = 0.15

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** What a round does as it meets the water: the size of the splash for its class, angle and speed, a skip off a grazing surface, the trail under. */
export function planWaterShot(params: WaterShotParams, random: RandomStream, table?: Readonly<Record<string, WaterShotProfile>>): WaterShotPlan {
  const profile = resolveWaterShotProfile(params.profile, table)
  const [dx, dy, dz] = params.direction
  const sine = clamp(-dy, 0, 1)
  const angleDeg = Math.asin(sine) * DEGREES
  const speed = params.speed ?? profile.speed
  const strength = clamp(speed / profile.speed, 0.3, 1.25)
  const flat = Math.hypot(dx, dz) || 1
  const forward: readonly [number, number] = [dx / flat, dz / flat]
  const ricochet = angleDeg < profile.ricochetBelowDeg ? skipOff(params.direction, angleDeg, random) : null
  // a grazing round throws a low spout leaning the way it goes; a steep one a tall column standing almost straight
  const lean = (1 - sine) * (ricochet ? 1.2 : 0.6)
  const columnHeight = profile.columnHeight * strength * (ricochet ? 0.35 : 0.35 + 0.65 * sine)
  const depth = params.depth ?? DEFAULT_DEPTH
  const trail = ricochet ? null : trailUnder(params, profile, speed, depth, sine)
  return {
    profile,
    angleDeg,
    ricochet,
    columnHeight,
    columnRadius: profile.columnRadius * Math.sqrt(strength),
    tilt: [forward[0] * lean, forward[1] * lean],
    drops: Math.round(profile.drops * strength),
    ringRadius: profile.ringRadius * Math.sqrt(strength),
    rings: profile.rings,
    foamRadius: profile.foamRadius * (ricochet ? 1.4 : 1),
    trailEnd: trail?.end ?? params.point,
    trailLength: trail?.length ?? 0,
    bedSpeed: trail?.bedSpeed ?? 0,
  }
}

function skipOff(direction: WaterVec3, angleDeg: number, random: RandomStream): WaterShotPlan['ricochet'] {
  const yaw = random.between(-RICOCHET_YAW_DEG, RICOCHET_YAW_DEG) / DEGREES
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const [dx, dy, dz] = direction
  // it leaves a little flatter than it came in
  const up = Math.abs(dy) * (0.5 + 0.3 * random.next())
  const x = dx * cos - dz * sin
  const z = dx * sin + dz * cos
  const length = Math.hypot(x, up, z) || 1
  return { direction: [x / length, up / length, z / length], speedShare: RICOCHET_SPEED_SHARE * (1 - angleDeg / 30) }
}

function trailUnder(params: WaterShotParams, profile: WaterShotProfile, speed: number, depth: number, sine: number): { end: WaterVec3; length: number; bedSpeed: number } {
  // speed falls as exp(-x / slowing): it is spent after slowing * ln(speed / spent)
  const spentAfter = profile.slowing * Math.log(Math.max(1, speed / SPENT_SPEED))
  const toBed = sine > 1e-3 ? depth / sine : Infinity
  const length = Math.min(spentAfter, toBed)
  const [px, py, pz] = params.point
  const [dx, dy, dz] = params.direction
  const bedSpeed = toBed <= spentAfter ? speed * Math.exp(-toBed / profile.slowing) : 0
  return { end: [px + dx * length, py + dy * length, pz + dz * length], length, bedSpeed }
}

/** The charge and kind a host names, from its own numbers or the table. */
export function resolveWaterBlast(params: WaterBlastParams): { tnt: number; kind: WaterBlastKind } {
  const known = params.explosive ? WATER_BLASTS[params.explosive] : undefined
  const tnt = Math.max(0.001, params.tnt ?? known?.tnt ?? 0.25)
  const kindId = params.kind ?? known?.kind ?? 'blast'
  const kind = WATER_BLAST_KINDS[kindId as keyof typeof WATER_BLAST_KINDS] ?? WATER_BLAST_KINDS.blast
  return { tnt, kind }
}

/**
 * What a charge does to the water, by Hopkinson scaling (lengths go with the cube root of the charge): a burst a little under the surface throws the
 * tallest column; at the surface a lower one and a ring of spray; deep under, the water holds it down to a dome of white water and a boil of bubbles;
 * high over it, only the shock ring and the spray. A shallow pool has not the water to throw a full column.
 */
export function planWaterBlast(params: WaterBlastParams): WaterBlastPlan {
  const { tnt, kind } = resolveWaterBlast(params)
  const scale = Math.cbrt(tnt)
  const quartic = Math.sqrt(Math.sqrt(tnt))
  const burstDepth = params.level - params.point[1]
  const scaledDepth = burstDepth / scale
  const airburst = -scaledDepth > AIRBURST_SCALED_HEIGHT
  const underwater = scaledDepth > UNDERWATER_SCALED_DEPTH && !kind.fireballUnderwater
  const surface = scaledDepth <= 0 ? Math.max(0, 1 + scaledDepth / AIRBURST_SCALED_HEIGHT) : 1
  const depthShape = scaledDepth <= 0 ? 0.6 * surface : scaledDepth <= BEST_SCALED_DEPTH ? 0.6 + 0.4 * (scaledDepth / BEST_SCALED_DEPTH) : Math.exp(-(scaledDepth - BEST_SCALED_DEPTH) / DEEP_FALL)
  const shallow = clamp(0.35 + params.depth / (1.2 * scale), 0.35, 1)
  const power = kind.brisance
  const columnHeight = airburst ? 0 : BLAST_COLUMN_PER_QUARTIC_KG * quartic * power * depthShape * shallow
  const domed = scaledDepth > 0 && !airburst
  const domeRadius = domed ? 1.6 * scale * Math.cbrt(power) : 0
  const fragments = scaledDepth < UNDERWATER_SCALED_DEPTH ? kind.fragments : 0
  return {
    tnt,
    kind,
    burstDepth,
    underwater,
    airburst,
    columnHeight,
    columnRadius: 0.35 * scale * kind.columnWidth * (1 + 0.5 * clamp(scaledDepth, 0, 1)),
    domeRadius,
    domeHeight: domed ? domeRadius * 0.6 * (scaledDepth < 1 ? 1 : Math.exp(1 - scaledDepth)) : 0,
    shockRadius: (scaledDepth >= 0 ? 5 : 4 * surface) * scale,
    waveAmplitude: 0.12 * scale * power * (scaledDepth >= 0 ? 1 : surface) * shallow,
    waveSpeed: 2.5 + 1.5 * scale,
    drops: airburst ? Math.round(20 * scale) : Math.round((60 + 140 * scale) * Math.max(0.3, depthShape) * Math.max(0.3, power)),
    mist: Math.round((6 + 10 * scale) * kind.mist * (airburst ? 0.4 : 1)),
    fragments,
    foamRadius: 2.5 * scale * Math.max(0.4, Math.cbrt(power)) * (airburst ? 0.3 : 1),
    bubbles: scaledDepth > 0 ? Math.round(30 + 50 * scale) : 0,
  }
}

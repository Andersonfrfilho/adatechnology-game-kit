import type { WeaponRecord } from './build-firearms'
import type { GalleryWeaponRow } from './extract-gallery'
import type { UnderbarrelLauncherDecision } from './decisions'
import type { WeaponContext } from './weapon-context'
import { reloadOf } from './weapon-context'
import { slugOf } from './weapon-rules'

const MM_PER_METRE = 1000
const ROUNDING = 100
const round = (value: number): number => Math.round(value * ROUNDING) / ROUNDING

const recoilFrom = (archetypeId: string, kick: number, context: WeaponContext): [number, number] => {
  const archetype = context.archetypes.get(archetypeId)
  if (!archetype) throw new Error(`weapons-catalog: unknown archetype ${archetypeId}`)
  const { recoilKickBase } = context.decisions.launcherCommon.value
  const base = archetype.action.recoil as [number, number]
  return [round((base[0] * kick) / recoilKickBase), round((base[1] * kick) / recoilKickBase)]
}

const idOf = (row: GalleryWeaponRow, context: WeaponContext): string => context.decisions.weaponIds[row[0]]?.value ?? slugOf(row[0])

const nameOf = (row: GalleryWeaponRow, context: WeaponContext): string => context.decisions.englishNames[row[0]]?.value ?? row[0]

const dimensionsOf = (row: GalleryWeaponRow): Record<string, number> => ({ length: row[4] / MM_PER_METRE, barrel: row[5] / MM_PER_METRE, emptyMass: row[6] })

export const buildRocketLauncher = (row: GalleryWeaponRow, context: WeaponContext): WeaponRecord => {
  const decision = context.decisions.launchers[row[0]]?.value
  if (!decision) throw new Error(`weapons-catalog: no launcher decision for "${row[0]}"`)
  const { minArmDistance, backblast, backblastHalfAngleDeg, recoilBase } = context.decisions.launcherCommon.value
  return {
    id: idOf(row, context),
    name: nameOf(row, context),
    category: 'launcher',
    action: {
      kind: 'launcher',
      projectile: decision.projectile,
      magazine: 1,
      reload: decision.reload,
      timings: { draw: context.drawSeconds, reload: decision.reload, clear: context.decisions.timings.clear.value },
      family: 'rocket',
      ...(decision.disposable ? { disposable: true } : {}),
      speed: decision.speed,
      minArmDistance,
      backblast,
      backblastHalfAngleDeg,
      recoil: recoilFrom(recoilBase, decision.kick, context),
    },
    mass: row[6],
    dimensions: dimensionsOf(row),
    archetype: recoilBase,
    sources: ['gallery', ...(decision.reloadSource === 'arsenal' ? ['arsenal'] : []), 'reference', 'derived'],
  }
}

export const buildFlamethrower = (row: GalleryWeaponRow, context: WeaponContext): WeaponRecord => {
  const decision = context.decisions.flamethrowers[row[0]]?.value
  const archetype = context.archetypes.get('flamethrower')
  if (!decision || !archetype) throw new Error(`weapons-catalog: no flamethrower decision or archetype for "${row[0]}"`)
  const { range, fuelPerSecond, temperature, radius, cone, noise } = archetype.action
  return {
    id: idOf(row, context),
    name: nameOf(row, context),
    category: 'launcher',
    action: {
      kind: 'flame',
      temperature,
      radius,
      range: round(Number(range) * decision.rangeFactor),
      fuelPerSecond,
      fuel: parseInt(row[3], 10),
      cone,
      noise,
      family: 'flame',
      timings: { draw: context.drawSeconds, reload: decision.reload, clear: context.decisions.timings.clear.value },
    },
    mass: row[6],
    dimensions: dimensionsOf(row),
    archetype: 'flamethrower',
    sources: ['gallery', 'sdk', 'derived'],
  }
}

export const buildGrenadeLauncher = (context: WeaponContext): WeaponRecord => {
  const decision = context.decisions.m79.value
  const { minArmDistance } = context.decisions.launcherCommon.value
  const reload = reloadOf('M79', context).reload.reload ?? 0
  return {
    id: decision.id,
    name: decision.name,
    category: 'launcher',
    action: {
      kind: 'launcher',
      projectile: decision.projectile,
      magazine: 1,
      reload,
      timings: { draw: context.drawSeconds, reload, clear: context.decisions.timings.clear.value },
      family: 'break',
      speed: decision.speed,
      minArmDistance,
      backblast: decision.backblast,
      recoil: recoilFrom(decision.recoilBase, decision.kick, context),
    },
    mass: decision.mass,
    dimensions: { length: decision.length, barrel: decision.barrel, emptyMass: decision.emptyMass },
    archetype: decision.recoilBase,
    sources: ['gallery', 'arsenal', 'reference', 'derived'],
  }
}

/** A grenade launcher that goes under a barrel (M203, GP-25, AG36): the M79 rule (a single 40 mm grenade, break reload) with its own measures. */
export const buildUnderbarrelLauncher = (decision: UnderbarrelLauncherDecision, context: WeaponContext): WeaponRecord => {
  const { minArmDistance } = context.decisions.launcherCommon.value
  const reload = reloadOf(decision.reloadFrom, context).reload.reload ?? 0
  return {
    id: decision.id,
    name: decision.name,
    category: 'launcher',
    action: {
      kind: 'launcher',
      projectile: decision.projectile,
      magazine: 1,
      reload,
      timings: { draw: context.drawSeconds, reload, clear: context.decisions.timings.clear.value },
      family: 'underbarrel',
      speed: decision.speed,
      minArmDistance,
      backblast: decision.backblast,
      recoil: recoilFrom(decision.recoilBase, decision.kick, context),
    },
    mass: decision.mass,
    dimensions: { length: decision.length, barrel: decision.barrel, emptyMass: decision.emptyMass },
    archetype: decision.recoilBase,
    tags: ['underbarrel'],
    sources: ['arsenal', 'reference', 'derived'],
  }
}

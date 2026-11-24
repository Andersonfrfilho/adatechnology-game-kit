import type { BlastOptions, HitResult, Vec3 } from '@adatechnology/game-destruction'
import { ExplosiveBody } from '@adatechnology/game-weapons'
import type { Arsenal, Detonation, SurfaceProbe } from '@adatechnology/game-weapons'

import type { District } from '../game/options'
import type { BlastRecord } from './runner'
import type { ScriptEvent } from './scripts'

const THROW_SECONDS = 1.1
const THROW_TARGET_HEIGHT = 0.15
const CHARGE_HEIGHT = 0.1
/** Steps after a blast at which the dead are counted again: the crowd resolves a blast at the start of its next step and the corpses settle in a second. */
const KILLS_SETTLE_STEPS = 60

type Params = {
  readonly district: District
  readonly arsenal: Arsenal
  readonly handOf: () => Vec3
  readonly pointOf: (to: readonly [number, number], height: number) => Vec3
}

export type Explosives = {
  throwFrom(event: Extract<ScriptEvent, { kind: 'throw' }>, eventIndex: number): void
  place(event: Extract<ScriptEvent, { kind: 'detonate' }>, eventIndex: number): void
  /** Explosives still flying or waiting to be set off. */
  open(): number
  blasts(): readonly BlastRecord[]
  dispose(): void
}

/**
 * The explosives of a script, through the SDK only: an `ExplosiveBody` flown at the fixed step and a charge set off by its remote trigger. Both run in a `beforeWorld` system, so the blast begins inside the
 * fixed step, the way a game's explosives do: the host's pacer takes it (`blastPacing.begin`), the renderer and the crowd's `blast` follow when it ends. Each blast is written down with the dead before and after.
 */
export function createExplosives({ district, arsenal, handOf, pointOf }: Params): Explosives {
  const { world, horde } = district
  const rules = arsenal.rules.explosives
  const flying: { readonly body: ExplosiveBody; readonly eventIndex: number }[] = []
  const charges: { readonly body: ExplosiveBody; readonly eventIndex: number }[] = []
  const records: { readonly eventIndex: number; readonly explosive: string; readonly step: number; readonly killsBefore: number; killsAfter?: number }[] = []
  let step = 0

  const groundProbe: SurfaceProbe = (from, to) => {
    const floor = world.ground.at(to[0], to[2])
    if (to[1] > floor || from[1] <= floor) return null
    const share = (from[1] - floor) / (from[1] - to[1])
    return { point: [from[0] + (to[0] - from[0]) * share, floor, from[2] + (to[2] - from[2]) * share], normal: [0, 1, 0], ground: true }
  }

  function detonate(detonation: Detonation, eventIndex: number): void {
    if (detonation.cone || detonation.smoke || detonation.energy <= 0) throw new Error(`the script runner does not run the explosive "${detonation.explosive}" (cone, smoke or no energy)`)
    records.push({ eventIndex, explosive: detonation.explosive, step, killsBefore: horde.crowd.stats.kills })
    const reach = Math.max(detonation.injuryRadius, detonation.lethalRadius)
    const options: BlastOptions = { charge: { ...(detonation.tnt !== undefined ? { tnt: detonation.tnt } : {}), ...(detonation.casing ? { casing: detonation.casing } : {}) } }
    const isPlayed = world.effects.world.explosion(detonation.explosive, detonation.point, { direction: detonation.direction }) !== null
    const finish = (results: readonly HitResult[]): void => {
      world.destruction.renderer.explode(detonation.point, detonation.energy, reach, { visual: !isPlayed, report: results, effect: detonation.explosive })
      horde.crowd.blast({ point: detonation.point, energy: detonation.energy, radius: reach, lethalRadius: detonation.lethalRadius, source: 'player' })
    }
    if (world.blastPacing && detonation.casing) world.blastPacing.begin({ point: detonation.point, energy: detonation.energy, radius: reach, source: 'player', options }, finish)
    else finish(world.destruction.world.explode(detonation.point, detonation.energy, reach, 'player', options))
  }

  const stopWatching = world.frame.beforeWorld((dt) => {
    step++
    for (const charge of charges.splice(0, charges.length)) {
      const event = charge.body.trigger('remote')
      if (event?.type === 'detonate') detonate(event.detonation, charge.eventIndex)
    }
    for (const item of [...flying]) {
      for (const event of item.body.step(dt, groundProbe)) if (event.type === 'detonate') detonate(event.detonation, item.eventIndex)
      if (item.body.done) flying.splice(flying.indexOf(item), 1)
    }
    for (const record of records) if (record.killsAfter === undefined && step >= record.step + KILLS_SETTLE_STEPS) record.killsAfter = horde.crowd.stats.kills
  })

  const explosiveOf = (id: string): NonNullable<ReturnType<Arsenal['explosives']['get']>> => {
    const explosive = arsenal.explosives.get(id)
    if (!explosive) throw new Error(`the arsenal has no explosive "${id}"`)
    return explosive
  }

  return {
    throwFrom(event, eventIndex) {
      const explosive = explosiveOf(event.explosive)
      const origin = handOf()
      const target = pointOf(event.to, THROW_TARGET_HEIGHT)
      const velocity: Vec3 = [(target[0] - origin[0]) / THROW_SECONDS, (target[1] - origin[1] + 0.5 * rules.gravity * THROW_SECONDS ** 2) / THROW_SECONDS, (target[2] - origin[2]) / THROW_SECONDS]
      flying.push({ body: new ExplosiveBody({ explosive, origin, velocity, triggers: ['timer'], fuse: explosive.fuse ?? 0, rules }), eventIndex })
    },
    place(event, eventIndex) {
      charges.push({ body: new ExplosiveBody({ explosive: explosiveOf(event.explosive), origin: pointOf(event.to, CHARGE_HEIGHT), triggers: ['remote'], rules }), eventIndex })
    },
    open: () => flying.length + charges.length,
    blasts: () => records.map((record) => ({ ...record, killsAfter: record.killsAfter ?? horde.crowd.stats.kills })),
    dispose: stopWatching,
  }
}

import type { BlastOptions, HitResult, Vec3 } from '@adatechnology/game-destruction'
import { ExplosiveBody, createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal, Detonation, SurfaceProbe } from '@adatechnology/game-weapons'

import type { District } from '../game/options'
import { worldHashOf } from './hash'
import type { ActionResult, PlayerSpot, ScriptWorld } from './runner'
import type { ScriptEvent } from './scripts'

const EYE_HEIGHT = 1.55
const SHOT_TARGET_HEIGHT = 1.2
const THROW_TARGET_HEIGHT = 0.15
const THROW_SECONDS = 1.1
const CHARGE_HEIGHT = 0.1
/** A pull of the trigger: a short span, then the weapon's own time passes (a semi weapon needs the release, an automatic one gives one round per pull this way). */
const PULL_SECONDS = 0.05
const BETWEEN_PULLS_SECONDS = 0.2
const MAX_PULLS_PER_SHOT = 4

const DONE: ActionResult = { status: 'done' }
const pending = (limit: string, reason: string): ActionResult => ({ status: 'pending', limit, reason })

const unit = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

type ScriptWorldParams = { readonly seed: number }

/**
 * The page's world for a script: what the events do, through the SDK only (N5: no `game-test-room`). The player's shots go from the arsenal's weapon into the destruction world; a thrown explosive is an
 * `ExplosiveBody` stepped at the fixed step; a charge or a blast goes through the pacer, the renderer and the crowd's `blast`. What the SDK lacks answers `pending` with its lacuna.
 */
export function createScriptWorld(district: District, { seed }: ScriptWorldParams): ScriptWorld {
  const { world, player: rig, horde } = district
  const arsenal: Arsenal = createArsenal({ seed, locale: 'pt-BR' })
  const flying: ExplosiveBody[] = []
  const tick = world.frame.tick
  const handOf = (): Vec3 => [rig.player.state.x, rig.player.state.y + EYE_HEIGHT, rig.player.state.z]
  const pointOf = (to: readonly [number, number], height: number): Vec3 => [to[0], world.ground.at(to[0], to[1]) + height, to[1]]

  const groundProbe: SurfaceProbe = (from, to) => {
    const floor = world.ground.at(to[0], to[2])
    if (to[1] > floor || from[1] <= floor) return null
    const share = (from[1] - floor) / (from[1] - to[1])
    return { point: [from[0] + (to[0] - from[0]) * share, floor, from[2] + (to[2] - from[2]) * share], normal: [0, 1, 0], ground: true }
  }

  function detonate(detonation: Detonation): void {
    if (detonation.cone || detonation.smoke || detonation.energy <= 0) throw new Error(`the script runner does not run the explosive "${detonation.explosive}" (cone, smoke or no energy)`)
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

  function shoot(event: Extract<ScriptEvent, { kind: 'shoot' }>): void {
    const origin = handOf()
    const direction = unit(pointOf(event.to, SHOT_TARGET_HEIGHT).map((value, axis) => value - origin[axis]!) as Vec3)
    const gun = arsenal.create(event.weapon, { reserve: event.shots })
    let fired = 0
    for (let pulls = 0; fired < event.shots && pulls < event.shots * MAX_PULLS_PER_SHOT; pulls++) {
      gun.release()
      const result = gun.trigger(origin, direction, PULL_SECONDS, false)
      fired += result.rounds
      for (const shot of result.shots) world.destruction.world.shoot(shot.origin, shot.direction, shot.energy, shot.caliber, 'player')
      gun.update(BETWEEN_PULLS_SECONDS)
    }
  }

  function throwExplosive(event: Extract<ScriptEvent, { kind: 'throw' }>): void {
    const explosive = arsenal.explosives.get(event.explosive)
    if (!explosive) throw new Error(`the arsenal has no explosive "${event.explosive}"`)
    const origin = handOf()
    const target = pointOf(event.to, THROW_TARGET_HEIGHT)
    const gravity = arsenal.rules.explosives.gravity
    const velocity: Vec3 = [(target[0] - origin[0]) / THROW_SECONDS, (target[1] - origin[1] + 0.5 * gravity * THROW_SECONDS ** 2) / THROW_SECONDS, (target[2] - origin[2]) / THROW_SECONDS]
    flying.push(new ExplosiveBody({ explosive, origin, velocity, triggers: ['timer'], fuse: explosive.fuse ?? 0, rules: arsenal.rules.explosives }))
  }

  function placeCharge(event: Extract<ScriptEvent, { kind: 'detonate' }>): void {
    const explosive = arsenal.explosives.get(event.explosive)
    if (!explosive) throw new Error(`the arsenal has no explosive "${event.explosive}"`)
    const result = new ExplosiveBody({ explosive, origin: pointOf(event.to, CHARGE_HEIGHT), triggers: ['remote'], rules: arsenal.rules.explosives }).trigger('remote')
    if (result?.type === 'detonate') detonate(result.detonation)
  }

  function stepFlying(): void {
    for (const body of [...flying]) {
      for (const event of body.step(tick, groundProbe)) if (event.type === 'detonate') detonate(event.detonation)
      if (body.done) flying.splice(flying.indexOf(body), 1)
    }
  }

  function act(event: ScriptEvent, context: { readonly zombies: number }): ActionResult {
    switch (event.kind) {
      case 'horde_release':
        horde.release(event.zone, Math.round(context.zombies * event.share))
        return DONE
      case 'shoot':
        shoot(event)
        return DONE
      case 'throw':
        throwExplosive(event)
        return DONE
      case 'detonate':
        placeCharge(event)
        return DONE
      case 'door':
      case 'open_container':
        return pending('L6', 'the player opens doors and containers by hand only in the floorplan test area')
      case 'vehicle_drive':
        return pending('L7', 'driving by a script outside the proving ground is not in the SDK (and nothing consumes run_over: L8)')
      case 'fire_line':
        return pending('L15', 'fire does not hurt the horde')
    }
  }

  return {
    tick,
    step() {
      stepFlying()
      world.frame.scheduler.advance(tick)
    },
    placePlayer(spot: PlayerSpot) {
      const { state } = rig.player
      state.x = spot.x
      state.z = spot.z
      state.vx = spot.vx
      state.vz = spot.vz
      rig.view.yaw = spot.yaw
    },
    setCamera(mode) {
      if (mode === 'vehicle') return pending('L7', 'the vehicle camera needs the player driving')
      rig.setMode(mode)
      return DONE
    },
    act,
    hash: () => worldHashOf(district),
  }
}

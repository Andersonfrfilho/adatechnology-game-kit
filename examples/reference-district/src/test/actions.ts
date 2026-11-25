import type { Vec3 } from '@adatechnology/game-destruction'
import { createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal } from '@adatechnology/game-weapons'

import type { District } from '../game/options'
import { createExplosives } from './explosives'
import { worldHashOf } from './hash'
import type { ActionResult, PlayerSpot, ScriptWorld } from './runner'
import type { ScriptEvent } from './scripts'

const EYE_HEIGHT = 1.55
const SHOT_TARGET_HEIGHT = 1.2
/** A pull of the trigger: a short span, then the weapon's own time passes (a semi weapon needs the release, an automatic one gives one round per pull this way). */
const PULL_SECONDS = 0.05
const BETWEEN_PULLS_SECONDS = 0.2
const MAX_PULLS_PER_SHOT = 4
/** Metres from the line of fire within which an agent of the horde counts as aimed at. */
const AIMED_AT_RADIUS = 1.5

const DONE: ActionResult = { status: 'done' }
const pending = (limit: string, reason: string): ActionResult => ({ status: 'pending', limit, reason })

const unit = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function distanceToSegment(point: readonly [number, number], from: readonly [number, number], to: readonly [number, number]): number {
  const [dx, dz] = [to[0] - from[0], to[1] - from[1]]
  const lengthSquared = dx * dx + dz * dz
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / lengthSquared))
  return Math.hypot(point[0] - (from[0] + along * dx), point[1] - (from[1] + along * dz))
}

type ScriptWorldParams = { readonly seed: number }

/**
 * The page's world for a script: what the events do, through the SDK only (N5: no `game-test-room`). The player's shots go from the arsenal's weapon into the destruction world; explosives are in
 * `./explosives`; the world steps through `scheduler.frame` (the live path, `exact`), so the host's blast pacer holds the world as it does in the game. What the SDK lacks answers `pending` with its lacuna.
 */
export function createScriptWorld(district: District, { seed }: ScriptWorldParams): ScriptWorld {
  const { world, player: rig, horde } = district
  const arsenal: Arsenal = createArsenal({ seed, locale: 'pt-BR' })
  const tick = world.frame.tick
  const handOf = (): Vec3 => [rig.player.state.x, rig.player.state.y + EYE_HEIGHT, rig.player.state.z]
  const pointOf = (to: readonly [number, number], height: number): Vec3 => [to[0], world.ground.at(to[0], to[1]) + height, to[1]]
  const explosives = createExplosives({ district, arsenal, handOf, pointOf })
  const frame = (): void => world.frame.scheduler.frame(tick, { exact: true, render: false })

  function isAimedAtHorde(origin: Vec3, target: Vec3): boolean {
    const { store } = horde.crowd
    for (let agent = 0; agent < store.n; agent++) {
      if (distanceToSegment([store.x[agent] ?? 0, store.z[agent] ?? 0], [origin[0], origin[2]], [target[0], target[2]]) < AIMED_AT_RADIUS) return true
    }
    return false
  }

  function shoot(event: Extract<ScriptEvent, { kind: 'shoot' }>): ActionResult {
    const origin = handOf()
    const target = pointOf(event.to, SHOT_TARGET_HEIGHT)
    const direction = unit([target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]])
    const isAimedAtZombies = isAimedAtHorde(origin, target)
    const gun = arsenal.create(event.weapon, { reserve: event.shots })
    let fired = 0
    for (let pulls = 0; fired < event.shots && pulls < event.shots * MAX_PULLS_PER_SHOT; pulls++) {
      gun.release()
      const result = gun.trigger(origin, direction, PULL_SECONDS, false)
      fired += result.rounds
      for (const shot of result.shots) world.destruction.world.shoot(shot.origin, shot.direction, shot.energy, shot.caliber, 'player')
      gun.update(BETWEEN_PULLS_SECONDS)
    }
    return isAimedAtZombies ? { status: 'partial', limit: 'L4', reason: 'the shot hit the destruction world; no ray test against the horde exists' } : DONE
  }

  function act(event: ScriptEvent, context: { readonly zombies: number; readonly index: number }): ActionResult {
    switch (event.kind) {
      case 'horde_release':
        horde.release(event.zone, Math.round(context.zombies * event.share))
        return DONE
      case 'shoot':
        return shoot(event)
      case 'throw':
        explosives.throwFrom(event, context.index)
        return DONE
      case 'detonate':
        explosives.place(event, context.index)
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
    step: frame,
    placePlayer(spot: PlayerSpot) {
      const { state } = rig.player
      state.x = spot.x
      state.z = spot.z
      state.vx = spot.vx
      state.vz = spot.vz
      rig.snap()
      rig.view.yaw = spot.yaw
    },
    setCamera(mode) {
      if (mode === 'vehicle') return pending('L7', 'the vehicle camera needs the player driving')
      rig.setMode(mode)
      return DONE
    },
    act,
    hash: () => worldHashOf(district, frame),
    blasts: explosives.blasts,
    openExplosives: explosives.open,
    dispose: explosives.dispose,
  }
}

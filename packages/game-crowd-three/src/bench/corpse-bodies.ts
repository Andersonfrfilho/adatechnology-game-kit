import { GUIDE, corpseBodyKit, createRig } from '@adatechnology/game-characters'
import { relocateCorpse } from '@adatechnology/game-crowd'
import type { Corpse, Crowd } from '@adatechnology/game-crowd'
import type { CorpseBodies, CorpseBodyKit, PhysicsServices, Vec3 } from '@adatechnology/game-physics'

import type { LyingBodies } from '../instances'

/** Heights and builds the kits are made at: a crowd's continuous sizes fall on these steps, so one kit serves many bodies. */
const SIZE_STEP = 0.05

export type CorpseBinding = {
  /** The bodies the engine holds, for the renderer's `frame.lying`. */
  readonly lying: LyingBodies
  readonly bodies: CorpseBodies
  /** The corpses of the ledger leave the world and the binding stops following it. */
  release(): void
}

/** A death is dropped from this high above the surface its centre line meets, so one that happens on a heap lands on it instead of inside it. */
const DROP_FROM_M = 3
const SURFACE_LAYERS = ['static', 'corpse'] as const
const DOWN: Vec3 = [0, -1, 0]

const roundedTo = (value: number): number => Math.max(SIZE_STEP, Math.round(value / SIZE_STEP) * SIZE_STEP)

/**
 * The bodies the dead of a crowd have in the host's engine: each corpse that enters the crowd's ledger is made a body of the world's corpse applier (`PhysicsServices.corpses()`,
 * every rung of the body LOD), each one that leaves the ledger leaves the world, and a body that was pushed and fell asleep far from its place tells the ledger where it lies
 * (`relocateCorpse`, so the mound the horde climbs is where the body is drawn).
 */
export const bindCorpseBodies = (services: PhysicsServices, crowd: Crowd): CorpseBinding => {
  const bodies = services.corpses()
  const kits = new Map<string, CorpseBodyKit>()
  const kitOf = (corpse: Corpse): CorpseBodyKit => {
    const height = roundedTo(corpse.height)
    const build = roundedTo(corpse.build)
    const key = `${height}|${build}`
    let kit = kits.get(key)
    if (!kit) kits.set(key, (kit = corpseBodyKit({ rig: createRig({ body: GUIDE, height, build }), body: GUIDE, build })))
    return kit
  }
  // the crowd keeps no height for a body on the ground: the feet go where the engine's surface (the ground, or the heap of bodies already there) is under the death
  const surfaceAt = (x: number, z: number): number => {
    const hit = services.world.rayFirst([x, DROP_FROM_M, z], DOWN, DROP_FROM_M, { layers: SURFACE_LAYERS })
    return hit ? DROP_FROM_M - hit.distance : 0
  }
  const stopFollowing = crowd.corpses.subscribe({
    added: (entry) => void bodies.add({ id: entry.id, kit: kitOf(entry.data), position: [entry.data.x, surfaceAt(entry.data.x, entry.data.z), entry.data.z], yaw: entry.data.yaw }),
    removed: (entry) => bodies.follower.removed(entry),
  })
  const stopSettled = services.onCorpseSettled((move) => void relocateCorpse(crowd, move))
  return {
    bodies,
    lying: {
      torso: (id, out) => bodies.readTorso(id, out, 0),
      // the torso of the chain stands at the first part's position (its rotation is the identity): the standing body is turned about it
      anchor: (corpse) => (kitOf(corpse).chain.parts[0] as { readonly body: { readonly position: readonly [number, number, number] } }).body.position,
    },
    release() {
      crowd.corpses.clear()
      stopFollowing()
      stopSettled()
    },
  }
}

import type { TerrainDebris, TerrainDebrisKind } from './types'

const REST_SPEED = 0.6
const RESTITUTION = 0.25
const FRICTION = 0.55
const MAX_BOUNCES = 2
const REST_GAP = 0.01

export interface DebrisWorld {
  heightAt(x: number, z: number): number
  gravity: number
  /** Soft pieces join the ground where they stop; a false keeps the piece as loose rubble. */
  settle(piece: TerrainDebris): boolean
}

/** Pieces thrown by blows: they fly, hit the deformed ground, and come to rest. Past `max` the oldest at rest goes first. */
export interface DebrisStore {
  readonly list: TerrainDebris[]
  throwPiece(spec: { material: string; kind: TerrainDebrisKind; radius: number; position: [number, number, number]; velocity: [number, number, number]; spin: [number, number, number] }): void
  update(dt: number, world: DebrisWorld): void
  clear(): void
}

export function createDebrisStore(max: () => number): DebrisStore {
  const list: TerrainDebris[] = []
  let serial = 0

  function makeRoom(): void {
    if (list.length < max()) return
    let at = 0
    let oldest = Infinity
    let oldestResting = -1
    let restingBorn = Infinity
    list.forEach((piece, index) => {
      if (piece.born < oldest) {
        oldest = piece.born
        at = index
      }
      if (piece.atRest && piece.born < restingBorn) {
        restingBorn = piece.born
        oldestResting = index
      }
    })
    list.splice(oldestResting >= 0 ? oldestResting : at, 1)
  }

  return {
    list,
    throwPiece(spec) {
      makeRoom()
      list.push({ ...spec, id: ++serial, born: serial, atRest: false, bounces: 0 })
    },
    update(dt, world) {
      for (let i = list.length - 1; i >= 0; i--) {
        const piece = list[i]!
        if (piece.atRest) {
          // what it lay on was dug away or heaped over: it falls again, or rides up
          const under = world.heightAt(piece.position[0], piece.position[2]) + piece.radius * 0.6
          if (piece.position[1] > under + REST_GAP) piece.atRest = false
          else if (piece.position[1] < under - REST_GAP) piece.position[1] = under
          if (piece.atRest) continue
        }
        const { position, velocity } = piece
        velocity[1] -= world.gravity * dt
        position[0] += velocity[0] * dt
        position[1] += velocity[1] * dt
        position[2] += velocity[2] * dt
        const ground = world.heightAt(position[0], position[2]) + piece.radius * 0.6
        if (position[1] > ground) continue
        position[1] = ground
        const speed = Math.hypot(velocity[0], velocity[1], velocity[2])
        if (speed < REST_SPEED || piece.bounces >= MAX_BOUNCES) {
          piece.atRest = true
          if (world.settle(piece)) list.splice(i, 1)
          continue
        }
        piece.bounces++
        velocity[1] = Math.abs(velocity[1]) * RESTITUTION
        velocity[0] *= FRICTION
        velocity[2] *= FRICTION
      }
    },
    clear() {
      list.length = 0
      serial = 0
    },
  }
}

import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

type Solid = { readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation: readonly number[]; readonly mesh?: unknown }
type Piece = { readonly localCenter: readonly [number, number, number]; readonly halfExtents: readonly number[]; readonly partBoxes?: ReadonlyArray<{ readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation?: readonly number[] }> }
type Statics = { bodies: Map<string, { held: Map<string, { solid: Solid }> }> }

/** How far (m) into a box of the engine a ray may go before it meets what is drawn: the fit of a box to its part is 1 cm, a sunk detail 2 mm. */
const AIR = 0.05
/** How many rays must find air in a box for it to hold air: one or two go by a slit between two boards (the gap between the doors of a cabinet). */
const OPEN_RAYS = 3
/** The share of each face (from its middle) the rays go in by: a round leg or a trunk held as the box around it leaves its corners empty, and that is the fit, not air held. */
const MIDDLE = 0.6
/** Rays across each face of a box, each way along each of its axes. */
const GRID = 5
/** A box thinner than this any way holds less air than `AIR`: a sheet is not looked into (its edges are often not drawn). */
const THIN = AIR + 0.01

/** Every box the engine holds of the thing whose inside is not drawn: a ray goes in by one of its faces and meets nothing of the thing for more than `AIR`. */
const boxesHoldingAir = (root: THREE.Object3D, solids: ReadonlyMap<string, { solid: Solid }>): string[] => {
  const meshes: THREE.Mesh[] = []
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    // both sides: a ray from inside a board meets its far face
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.side = THREE.DoubleSide
    meshes.push(mesh)
  })
  const caster = new THREE.Raycaster()
  const out: string[] = []
  const origin = new THREE.Vector3()
  const direction = new THREE.Vector3()
  for (const [key, { solid }] of solids) {
    if (solid.mesh) continue
    const turn = new THREE.Quaternion(solid.rotation[0], solid.rotation[1], solid.rotation[2], solid.rotation[3])
    const centre = new THREE.Vector3(solid.center[0], solid.center[1], solid.center[2])
    if (2 * Math.min(solid.half[0]!, solid.half[1]!, solid.half[2]!) < THIN) continue
    let worst = 0
    let open = 0
    for (let axis = 0; axis < 3; axis++) {
      const along = solid.half[axis]!
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3
      for (const way of [-1, 1]) for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
        const local = [0, 0, 0]
        local[axis] = -way * (along + 0.01)
        local[u] = solid.half[u]! * (((i + 0.5) / GRID) * 2 - 1) * MIDDLE
        local[v] = solid.half[v]! * (((j + 0.5) / GRID) * 2 - 1) * MIDDLE
        origin.set(local[0]!, local[1]!, local[2]!).applyQuaternion(turn).add(centre)
        direction.set(axis === 0 ? way : 0, axis === 1 ? way : 0, axis === 2 ? way : 0).applyQuaternion(turn)
        caster.set(origin, direction)
        caster.far = 2 * along + 0.02
        const hit = caster.intersectObjects(meshes, false)[0]
        const air = (hit ? hit.distance : caster.far) - 0.01
        if (air <= AIR) continue
        open++
        worst = Math.max(worst, air)
      }
    }
    if (open >= OPEN_RAYS) out.push(`${key}: ${open} rays go up to ${worst.toFixed(2)} m into a box of ${solid.half.map((h) => (2 * h).toFixed(2)).join(' x ')} m`)
  }
  return out
}

const types = defaultFurnitureCatalog().map((entry) => entry.type)

/**
 * Debt counted (2026-11-27): pieces whose box, once let go, still holds air. They are round or one-shell shapes held as the box around them (a stool's legs under its
 * seat, a tub, a pot, a lamp's shade). The list only gets shorter: a piece fitted by its own parts leaves it, and a piece not listed must hold none.
 */
const KNOWN = new Set(['coffee_table_round', 'shelf_unit', 'floor_lamp', 'outdoor_pot', 'fountain', 'ceiling_light', 'pendant', 'floor_plant', 'table_lamp', 'hanging_plant', 'soaking_tub', 'bbq_simple', 'stool', 'water_tank'])

// CLAUDE.md §12, "nenhum colisor sem geometria": a kennel drawn as one part was one box in the engine, and the chips of its own boards, made inside it, never came to rest
describe('every piece of furniture of the catalogue, whole: the engine holds what is drawn, never the air in it', () => {
  it.each(types)('%s: no box of the engine holds air', (type) => {
    let made: ReturnType<typeof furnitureSpec>
    try {
      made = furnitureSpec(THREE, type, { catalog: defaultFurnitureCatalog(), document: fakeDocument, options: { chairs: false } })
    } catch {
      return
    }
    const scene = new THREE.Scene()
    const world = createDestruction()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
    const id = world.add(made.spec, { id: type })
    const root = made.build(THREE)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root)
    for (let t = 0; t < 0.5; t += 1 / 30) {
      world.update(1 / 30)
      renderer.update(1 / 30)
    }
    const held = (renderer as unknown as { pieceSys: { engine: { statics: Statics } } }).pieceSys.engine.statics.bodies.get(id)?.held
    if (held) expect(boxesHoldingAir(root, held), 'standing (fixed bodies)').toEqual([])
    // let go (what a blow, a push or a hand does to it): the boxes of the piece, about its centre of mass, where it still stands
    const piece = renderer.makePiece(id) as unknown as Piece | null
    if (!piece) return
    const [cx, cy, cz] = piece.localCenter
    const boxes = piece.partBoxes ?? [{ center: [0, 0, 0], half: piece.halfExtents }]
    const loose = new Map(boxes.map((box, i) => [`piece box ${i}`, { solid: { center: [box.center[0]! + cx, box.center[1]! + cy, box.center[2]! + cz], half: box.half, rotation: box.rotation ?? [0, 0, 0, 1] } }] as const))
    const air = boxesHoldingAir(root, loose)
    if (KNOWN.has(type)) expect(air.length, `${type} holds no air any more: take it out of KNOWN`).toBeGreaterThan(0)
    else expect(air, 'let go (the boxes of the piece)').toEqual([])
  })
})

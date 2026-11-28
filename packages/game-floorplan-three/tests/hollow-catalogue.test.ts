import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

/** A round collider: a cylinder along `axis` of its box, its radius at a point of that axis (`radiusAt`, from the centre). */
type Round = { readonly axis: number; readonly radiusAt: (along: number) => number }
type Solid = { readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation: readonly number[]; readonly mesh?: unknown; readonly round?: true | Round; readonly hull?: readonly number[] }
type Piece = { readonly localCenter: readonly [number, number, number]; readonly halfExtents: readonly number[]; readonly round?: { readonly axis: number; readonly radius: number; readonly profile?: ReadonlyArray<readonly [number, number]> }; readonly partBoxes?: ReadonlyArray<{ readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation?: readonly number[]; readonly round?: true; readonly hull?: readonly number[] }> }
type Statics = { bodies: Map<string, { held: Map<string, { solid: Solid }> }> }

/** How far (m) into a box of the engine a ray may go before it meets what is drawn: the fit of a box to its part is 1 cm, a sunk detail 2 mm. */
const AIR = 0.05
/** How many rays must find air in a box for it to hold air: one or two go by a slit between two boards (the gap between the doors of a cabinet). */
const OPEN_RAYS = 3
/** The share of each face (from its middle) the rays go in by: a round leg or a trunk held as the box around it leaves its corners empty, and that is the fit, not air held. */
const MIDDLE = 0.6
/** A ray through the very middle of a face runs along an edge of the triangles of a drawn cylinder's cap (from its centre to its first vertex) and three's raycast misses it: the grid is set off by a share of a cell no drawing lines up with. */
const SKEW = 0.0731
/** Rays across each face of a box, each way along each of its axes. */
const GRID = 5
/** A box thinner than this any way holds less air than `AIR`: a sheet is not looked into (its edges are often not drawn). */
const THIN = AIR + 0.01

/** The cylinder of a round collider: a part box's own (along its y, the mean of its x and z halves), or the piece's (`round`, its profile when it tapers). */
const roundOf = (solid: Solid): Round | null => {
  if (!solid.round) return null
  if (solid.round !== true) return solid.round
  const radius = (solid.half[0]! + solid.half[2]!) / 2
  return { axis: 1, radiusAt: () => radius }
}

/**
 * How far along the ray (from its origin, `local` in the collider's frame, going `way` along `axis`) it enters the collider: the box face, or the cylinder's side or end.
 * Null when the ray never enters it (it passes beside a cylinder, in the corner of its box).
 */
const entryOf = (solid: Solid, local: readonly number[], axis: number, way: number): number | null => {
  const along = solid.half[axis]!
  if (solid.hull) {
    // a hull (half a log, a cone): where the ray first meets it, in the box's frame
    const points: THREE.Vector3[] = []
    for (let i = 0; i < solid.hull.length; i += 3) points.push(new THREE.Vector3(solid.hull[i], solid.hull[i + 1], solid.hull[i + 2]))
    const ray = new THREE.Ray(new THREE.Vector3(local[0], local[1], local[2]), new THREE.Vector3(axis === 0 ? way : 0, axis === 1 ? way : 0, axis === 2 ? way : 0))
    const hit = new ConvexHull().setFromPoints(points).intersectRay(ray, new THREE.Vector3())
    return hit ? hit.distanceTo(ray.origin) : null
  }
  const round = roundOf(solid)
  if (!round) return 0.01
  const c = round.axis
  if (axis === c) {
    // along the cylinder: in by the end it comes from, if it is inside that end's circle
    const [i, j] = [0, 1, 2].filter((k) => k !== c) as [number, number]
    return Math.hypot(local[i]!, local[j]!) <= round.radiusAt(-way * along) ? 0.01 : null
  }
  // across it: the other axis across the cylinder is how far from its axis the ray passes
  const other = [0, 1, 2].find((k) => k !== c && k !== axis)!
  const radius = round.radiusAt(local[c]!)
  const off = Math.abs(local[other]!)
  if (off >= radius) return null
  return along + 0.01 - Math.sqrt(radius * radius - off * off)
}

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
        local[u] = solid.half[u]! * (((i + 0.5 + SKEW) / GRID) * 2 - 1) * MIDDLE
        local[v] = solid.half[v]! * (((j + 0.5 + SKEW) / GRID) * 2 - 1) * MIDDLE
        origin.set(local[0]!, local[1]!, local[2]!).applyQuaternion(turn).add(centre)
        direction.set(axis === 0 ? way : 0, axis === 1 ? way : 0, axis === 2 ? way : 0).applyQuaternion(turn)
        const entry = entryOf(solid, local, axis, way)
        if (entry === null) continue
        caster.set(origin, direction)
        caster.far = 2 * along + 0.02
        const hit = caster.intersectObjects(meshes, false)[0]
        const air = (hit ? hit.distance : caster.far) - entry
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
    // a round piece is its cylinder (along `round.axis`, its profile when it tapers), the rest the boxes of its parts or its box
    const round = piece.round
    const radiusAt = (along: number): number => {
      const profile = round?.profile
      if (!round || !profile || profile.length < 2) return round?.radius ?? 0
      const k = profile.findIndex(([at]) => at >= along)
      if (k <= 0) return profile[k === 0 ? 0 : profile.length - 1]![1]
      const [a, ra] = profile[k - 1]!
      const [b, rb] = profile[k]!
      return ra + ((rb - ra) * (along - a)) / (b - a || 1)
    }
    const boxes: ReadonlyArray<{ readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation?: readonly number[]; readonly round?: true | Round; readonly hull?: readonly number[] }> = round
      ? [{ center: [0, 0, 0], half: piece.halfExtents, round: { axis: round.axis, radiusAt } }]
      : (piece.partBoxes ?? [{ center: [0, 0, 0], half: piece.halfExtents }])
    const loose = new Map(boxes.map((box, i) => [`piece box ${i}`, { solid: { center: [box.center[0]! + cx, box.center[1]! + cy, box.center[2]! + cz], half: box.half, rotation: box.rotation ?? [0, 0, 0, 1], ...(box.round ? { round: box.round } : {}), ...(box.hull ? { hull: box.hull } : {}) } }] as const))
    expect(boxesHoldingAir(root, loose), 'let go (the colliders of the piece)').toEqual([])
  })
})

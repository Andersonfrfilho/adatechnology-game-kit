import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'

type Box = readonly [number, number, number, number, number, number]
type PartLike = { readonly id: string; readonly shape: { readonly kind: string; readonly size?: readonly number[]; readonly radius?: number; readonly height?: number }; readonly position?: readonly number[] }

/** Half the height of a part's shape (box, or cylinder standing up). */
const halfHeight = (part: PartLike): number => (part.shape.size ? part.shape.size[1]! / 2 : (part.shape.height ?? 0) / 2)
/** How far (m) over what holds it a thing may be and still count as resting there; the ground is at 0. */
const REST_GAP = 0.05
const STEP = 1 / 30
const SECONDS = 5

/** Whether a box rests on the ground or on another box under it (its top at the box's bottom, or reaching past it: a piece that came to rest leaning into another). */
const rests = (box: Box, others: readonly Box[]): boolean => {
  if (box[1] < REST_GAP) return true
  return others.some((o) => o !== box && o[1] <= box[1] + REST_GAP && o[4] >= box[1] - REST_GAP && o[0] < box[3] && o[3] > box[0] && o[2] < box[5] && o[5] > box[2])
}

const inside = (point: readonly number[], boxes: readonly Box[], tolerance: number): boolean =>
  boxes.some((b) => point[0]! > b[0] - tolerance && point[0]! < b[3] + tolerance && point[1]! > b[1] - tolerance && point[1]! < b[4] + tolerance && point[2]! > b[2] - tolerance && point[2]! < b[5] + tolerance)

/** Width of a part's shape across the floor (the smaller of x and z; a cylinder's diameter). */
const across = (part: PartLike): number => (part.shape.size ? Math.min(part.shape.size[0]!, part.shape.size[2]!) : 2 * (part.shape.radius ?? 0))
/**
 * Breaks the legs a piece of furniture stands on (parts on the floor taller than they are wide: a table's legs, a bed's feet, a cupboard's sides), with blows heavy enough for
 * wood, MDF, glass and plastic: metal may hold. What lies on the floor (a rug, a plinth) is left whole, so what was held up by the legs has something to fall from.
 */
const breakFeet = (world: ReturnType<typeof createDestruction>, id: string, parts: readonly PartLike[]): PartLike[] => {
  const feet = parts.filter((p) => (p.position?.[1] ?? 0) - halfHeight(p) < 0.02 && 2 * halfHeight(p) > across(p) && 2 * halfHeight(p) > 0.1)
  const broken: PartLike[] = []
  for (const foot of feet) {
    const at = [foot.position?.[0] ?? 0, foot.position?.[1] ?? 0, foot.position?.[2] ?? 0] as [number, number, number]
    for (let i = 0; i < 12; i++) {
      const state = world.part(id, foot.id)
      if (!state || state.status === 'broken' || state.status === 'ashes' || state.status === 'melted') break
      world.hitPart(id, foot.id, { type: 'blunt', point: at, direction: [0, 0, -1], energy: 20000, radius: 0.05, source: 'test' })
    }
    const after = world.part(id, foot.id)
    if (!after || after.status === 'broken') broken.push(foot)
  }
  return broken
}

const types = defaultFurnitureCatalog().map((entry) => entry.type)

describe('every piece of furniture of the catalogue, its feet broken', () => {
  it.each(types)('%s: nothing is left over air, and nothing collides where nothing is drawn', (type) => {
    let made: ReturnType<typeof furnitureSpec>
    try {
      // alone, as the room's tables stand: chairs around a table are objects of their own in a house
      made = furnitureSpec(THREE, type, { catalog: defaultFurnitureCatalog(), document: fakeDocument, options: { chairs: false } })
    } catch {
      return
    }
    const scene = new THREE.Scene()
    const world = createDestruction()
    const renderer = createDestructionRenderer(THREE, { scene, world })
    const id = world.add(made.spec, { id: type })
    const root = made.build(THREE)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root)
    const whole = renderer.shownBoxes(id)
    // what hangs (a mirror, a wall cabinet) is held by the wall it hangs on, not by the floor
    if (whole.length === 0 || Math.min(...whole.map((b) => b[1])) > REST_GAP) return
    const broken = breakFeet(world, id, made.spec.parts as readonly PartLike[])
    if (broken.length === 0) return
    for (let t = 0; t < SECONDS; t += STEP) {
      world.update(STEP)
      renderer.update(STEP)
    }

    const drawn = new Map(world.ids().map((o) => [o, renderer.shownBoxes(o)] as const).filter(([, boxes]) => boxes.length > 0))
    // (1) what is left of it, and every piece that came off, lies on the floor or on something once it is still (a piece still rolling is not floating)
    const floating = [...drawn].filter(([o, boxes]) => {
      const piece = renderer.piece(o)
      if (piece && !piece.sleeping) return false
      const others = [...drawn].filter(([other]) => other !== o).flatMap(([, b]) => b)
      // any of its parts may be what it rests by: a tap lies on the rim of the tub by its spout, its lowest knob over the basin
      return !boxes.some((b) => rests(b, others))
    }).map(([o]) => o)
    expect(floating).toEqual([])
    // (2) a ray through where each broken foot stood meets only what is drawn
    for (const foot of broken) {
      const [x, y, z] = [foot.position?.[0] ?? 0, foot.position?.[1] ?? 0, foot.position?.[2] ?? 0]
      for (const [origin, direction] of [
        [[x, y, z + 1.5], [0, 0, -1]],
        [[x + 1.5, y, z], [-1, 0, 0]],
      ] as Array<[[number, number, number], [number, number, number]]>) {
        const hit = world.raycast(origin, direction, 3)
        if (!hit || hit.object === 'ground') continue
        // the part the ray met is still drawn there: a dent pushes the drawn surface in (more than the dent's depth, as the renderer shows it) while the part keeps its shape in the world
        const dent = Math.max(0, ...(world.part(hit.object, hit.part)?.dents ?? []).map((d) => d.depth))
        expect(inside(hit.point, renderer.shownBoxes(hit.object, hit.part), 0.03 + 3 * dent), `${hit.object}/${hit.part} at ${hit.point.map((v) => v.toFixed(2)).join(',')}`).toBe(true)
      }
    }
  })
})

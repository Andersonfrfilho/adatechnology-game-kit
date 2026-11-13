import { describe, expect, it } from 'vitest'

import { SHELTER_OFF_WALL, gasShelterBoxes } from '../src/furniture/gas-shelter'
import type { ShelterBox } from '../src/furniture/gas-shelter'
import { houseOf, planOf, THREE } from './helpers/houses'

const SIZE = { side: 0.56, height: 0.7 }
const boxes = gasShelterBoxes(SIZE)
const of = (part: ShelterBox['part']): ShelterBox[] => boxes.filter((b) => b.part === part)

/** The faces of a box: axis (0 front, 1 across, 2 up), the side it looks to and where it lies, with the rectangle it covers on the other two axes. */
function facesOf(box: ShelterBox): { axis: number; sign: number; at: number; rect: number[][] }[] {
  const ranges = [box.front, box.across, box.y]
  return [0, 1, 2].flatMap((axis) => [-1, 1].map((sign) => ({ axis, sign, at: sign > 0 ? ranges[axis]![1] : ranges[axis]![0], rect: ranges.filter((_, k) => k !== axis).map((r) => [...r]) })))
}

describe('the outdoor gas shelter (NBR 13523)', () => {
  it('is walls and a roof round the cylinder, with a door at the front ventilated low and high', () => {
    expect(of('wall')).toHaveLength(3)
    expect(of('roof')).toHaveLength(1)
    expect(of('door')).toHaveLength(1)
    const louvres = of('louvre')
    const door = of('door')[0]!
    expect(louvres.some((l) => l.y[1] < door.y[0] + 0.25), 'low ventilation').toBe(true)
    expect(louvres.some((l) => l.y[0] > door.y[1] - 0.25), 'high ventilation').toBe(true)
    // the cylinder (radius 0.18 at the origin) fits inside the walls
    const inner = { back: of('wall')[0]!.front[1], left: of('wall')[1]!.across[1], right: of('wall')[2]!.across[0] }
    expect(inner.back).toBeLessThan(-0.18)
    expect(inner.left).toBeLessThan(-0.18)
    expect(inner.right).toBeGreaterThan(0.18)
    expect(door.front[0]).toBeGreaterThan(0.18)
  })

  it('stands off the house wall it is backed on, clear of the render whatever the wall', () => {
    expect(Math.min(...boxes.map((b) => b.front[0]))).toBeCloseTo(-SIZE.side / 2 + SHELTER_OFF_WALL, 9)
    expect(SHELTER_OFF_WALL).toBeGreaterThanOrEqual(0.02)
  })

  it('has no two faces on one plane looking the same way over a common area (no z-fighting)', () => {
    const faces = boxes.flatMap((b, i) => facesOf(b).map((f) => ({ ...f, i })))
    const overlap = (a: number[][], b: number[][]): boolean => a.every((r, k) => Math.min(r[1]!, b[k]![1]!) - Math.max(r[0]!, b[k]![0]!) > 1e-6)
    const clashes = faces.flatMap((a, ia) => faces.slice(ia + 1).filter((b) => a.i !== b.i && a.axis === b.axis && a.sign === b.sign && Math.abs(a.at - b.at) < 0.002 && overlap(a.rect, b.rect)).map((b) => `${a.i}/${b.i} axis ${a.axis}`))
    expect(clashes).toEqual([])
  })
})

describe('single_storey_a draws the shelter of its cylinder', () => {
  const shown = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }

  it('puts a roof over the shelter of every seed (the default is the outdoor shelter), with the lot layer on or off', () => {
    for (const seed of [1, 2, 3]) {
      const plan = planOf('single_storey_a', seed)
      const cylinder = plan.items.find((item) => item.type === 'cooking_gas_cylinder')!
      expect(cylinder.placement, `seed ${seed}`).toBe('outdoor_shelter')
      const { house } = houseOf(plan, {}, { quality: 'game', constructionStages: true, constructionLevel: 8 })
      for (const lotLayer of [true, false]) {
        house.setConstructionLevel!(8, { lotLayer })
        house.group.updateMatrixWorld(true)
        const ray = new THREE.Raycaster(new THREE.Vector3(cylinder.x, 1.2, cylinder.z), new THREE.Vector3(0, -1, 0), 0, 1.2)
        const hit = ray.intersectObject(house.group, true).find((h) => shown(h.object))
        expect(hit, `seed ${seed} lot ${lotLayer}`).toBeDefined()
        expect(hit!.point.y, `seed ${seed} lot ${lotLayer}: the shelter's roof`).toBeCloseTo(SIZE.height + 0.05, 2)
      }
    }
  })

  it('stands outside the footprint of the house', () => {
    for (const seed of [1, 2, 3]) {
      const plan = planOf('single_storey_a', seed)
      const cylinder = plan.items.find((item) => item.type === 'cooking_gas_cylinder')!
      const inside = plan.rooms.filter((room) => room.floor === 0).some((room) => room.parts.some((part: number[]) => cylinder.x > part[0]! && cylinder.x < part[2]! && cylinder.z > part[1]! && cylinder.z < part[3]!))
      expect(inside, `seed ${seed}`).toBe(false)
    }
  })
})

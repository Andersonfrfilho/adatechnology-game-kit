import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'

// Lot, roofs, gutters, mirrors, lights and cars: the second slice of the port.
class FakeReflector extends THREE.Mesh {
  options: unknown
  constructor(geometry: any, options: unknown) {
    super(geometry, new THREE.MeshBasicMaterial())
    this.options = options
    ;(this as any).type = 'Reflector'
  }
  dispose(): void {}
}

const fleet = {
  build(kind: string, options: { quality: string; seed: number }): any {
    const group = new THREE.Group()
    group.userData.kind = `${kind}:${options.quality}:${options.seed}`
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0xaa2222 }))
    body.position.y = 0.5
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2), new THREE.MeshStandardMaterial({ color: 0x223344, transparent: true, opacity: 0.6 }))
    glass.position.y = 1
    group.add(body, glass)
    return { group }
  },
}

describe('lot', () => {
  const plan = planOf('sobrado', 3)
  const { house } = houseOf(plan)

  it('draws the zones, the sidewalk and the lot wall of the plan', () => {
    expect(house.lot).toBeTruthy()
    const meshes = house.lot.children.filter((c: any) => c.isMesh).map((c: any) => c.name)
    expect(meshes).toEqual(expect.arrayContaining(['lot/sidewalk', 'lot/plaster', 'lot/floor']))
    const types = new Set(house.colliders.map((c: any) => c.type))
    expect(types.has('lot_wall')).toBe(true)
    expect(types.has('gate')).toBe(true)
  })

  it('keeps the lot wall and gates out when the game has its own', () => {
    const { house: bare } = houseOf(plan, {}, { noPerimeter: true })
    const types = new Set(bare.colliders.map((c: any) => c.type))
    expect(types.has('lot_wall')).toBe(false)
    expect(types.has('gate')).toBe(false)
  })

  it('leaves the ground, street and lawn out when the app already has them', () => {
    const withTerrain = houseOf(plan).house.group
    const without = houseOf(plan, {}, { terrain: false }).house.group
    const count = (root: any): number => { let n = 0; root.traverse(() => n++); return n }
    expect(count(without)).toBeLessThan(count(withTerrain))
  })

  it('hides the lot on request', () => {
    const { house: other } = houseOf(plan)
    other.show({ lot: false })
    expect(other.lot.visible).toBe(false)
    other.show({ lot: true })
    expect(other.lot.visible).toBe(true)
  })

  it('has no lot for a plan without one', () => {
    expect(houseOf(planOf('apartamento', 1)).house.lot).toBeNull()
  })
})

describe('roof and gutters', () => {
  const plan = planOf('sobrado', 3)
  const { house } = houseOf(plan)

  it('draws the roof of the plan over the top floor, with its tiles', () => {
    expect(house.roof).toBeTruthy()
    expect(house.roof.children.map((c: any) => c.name)).toEqual(expect.arrayContaining(['roof/tile']))
    const box = new THREE.Box3().setFromObject(house.roof)
    expect(box.max.y).toBeCloseTo(plan.roof.ridge, 0)
  })

  it('cuts the roof and the floors above to look into the plan', () => {
    const { house: cut } = houseOf(plan)
    cut.show({ cut: true, floor: 0 })
    expect(cut.roof.visible).toBe(false)
    expect(cut.floors[1].visible).toBe(false)
    cut.show({ cut: false })
    expect(cut.roof.visible).toBe(true)
  })

  it('lays gutters along the eaves', () => {
    expect(house.gutters.gutters.length).toBeGreaterThan(0)
    for (const gutter of house.gutters.gutters) expect(gutter.b).toBeGreaterThan(gutter.a)
  })

  it('draws the roof of a commercial plan too', () => {
    const market = planOf('mercado', 3)
    const { house: shop } = houseOf(market)
    expect(shop.roof).toBeTruthy()
    expect(new THREE.Box3().setFromObject(shop.roof).max.y).toBeGreaterThan(market.roof.y0)
  })
})

describe('lights', () => {
  const plan = planOf('sobrado', 3)

  it('gives the lamps of the rooms at night, grouped by room', () => {
    const { house } = houseOf(plan, {}, { night: true })
    expect(house.lights.list.length).toBeGreaterThan(5)
    for (const light of house.lights.list) expect(light.range).toBeGreaterThan(0)
    expect(Object.keys(house.lights.byRoom).length).toBeGreaterThan(3)
    expect(house.night).toBe(true)
  })

  it('has fewer lights by day (lanterns and candles wait for the night)', () => {
    const day = houseOf(plan, {}, { night: false }).house.lights.list.length
    const night = houseOf(plan, {}, { night: true }).house.lights.list.length
    expect(day).toBeLessThanOrEqual(night)
  })
})

describe('mirrors', () => {
  const plan = planOf('apartamento_novo', 1)

  it('draws the reflection of the nearest mirror only, and only from inside its room', () => {
    const { house } = houseOf(plan, { reflector: FakeReflector })
    const list = house.internal.mirrors.list
    expect(list).toHaveLength(2)
    const camera = new THREE.PerspectiveCamera()
    const target = list[0]
    camera.position.set(target.E.x, target.E.y, target.E.z)
    house.group.updateMatrixWorld(true)
    house.internal.mirrors.house = house.house
    house.chooseMirror(camera)
    expect(list.filter((m: any) => m.real.visible)).toHaveLength(1)
    camera.position.set(500, 500, 500)
    house.chooseMirror(camera)
    expect(list.filter((m: any) => m.real.visible)).toHaveLength(0)
    expect(list.every((m: any) => m.fake.visible)).toBe(true)
  })

  it('uses only the environment map without a Reflector or in game quality', () => {
    for (const [options, build] of [[{}, {}], [{ reflector: FakeReflector }, { quality: 'game' as const }]] as const) {
      const { house } = houseOf(plan, options, build)
      const names: string[] = []
      house.group.traverse((o: any) => { if (o.name === 'mirror/environment') names.push(o.name); expect(o.type).not.toBe('Reflector') })
      expect(names.length).toBeGreaterThan(0)
    }
  })
})

describe('cars', () => {
  const plan = planOf('sobrado', 3)

  it('parks the cars of the lot with the fleet it is given', () => {
    const { house, renderer } = houseOf(plan, { fleet })
    expect(house.cars.length).toBeGreaterThan(0)
    expect(house.cars[0]).toMatchObject({ k: expect.any(String), seed: expect.any(Number) })
    expect(['boxy_hatch', 'entry_hatch', 'beetle', 'family_hatch', 'rideshare_hatch']).toContain(house.cars[0].k)
    expect(renderer.cars.info(house.cars[0].k, house.cars[0].seed)).toMatchObject({ parts: 2, L: 4 })
  })

  it('takes the kinds of a lot style from the options', () => {
    const { house } = houseOf(plan, { fleet, carKinds: { budget: ['custom_kind'] } })
    expect(house.cars.map((c: any) => c.k)).toEqual(house.cars.map(() => 'custom_kind'))
  })

  it('merges the car model by material and builds it once per kind and seed', () => {
    const { renderer } = houseOf(plan, { fleet })
    const a = renderer.cars.model('boxy_hatch', 1)
    const b = renderer.cars.model('boxy_hatch', 1)
    expect(a).toBe(b)
    expect(renderer.cars.model('boxy_hatch', 2)).not.toBe(a)
  })

  it('parks nothing without a fleet', () => {
    expect(houseOf(plan).house.cars).toHaveLength(0)
  })
})

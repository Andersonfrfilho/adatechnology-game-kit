import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { THREE, houseOf, planOf } from './helpers/houses'

// The third slice: the house bound to the destruction of its structure (a vertex range per piece, brick courses at LOD 0, spalls and the rebar cage
// from the renderer) with a real world of @adatechnology/game-destruction and the real renderer of @adatechnology/game-destruction-three.
function setup(options: { template?: string; seed?: number; onDamage?: (...args: any[]) => void } = {}) {
  const plan = planOf(options.template ?? 'sobrado', options.seed ?? 3)
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { scene, world })
  const { house } = houseOf(plan, { destruction: world, destructionRenderer: renderer, onDamage: options.onDamage })
  scene.add(house.group)
  const d = house.destruction
  d.activate()
  const events: any[] = []
  world.on('*', (e: any) => events.push(e))
  const run = (seconds: number): void => { for (let t = 0; t < seconds; t += 0.05) { world.update(0.05); renderer.update(0.05) } }
  const centre = (id: string): [number, number, number] => { const p = house.structure.byId.get(id); return [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2] }
  return { plan, world, scene, renderer, house, d, events, run, centre }
}

/** True when every vertex of the piece's ranges sits on one point (the piece is hidden). */
function hidden(house: House, id: string): boolean {
  const items = house.structure.meshesOf(id).filter((it: any) => it.mesh && !it.whole && !it.obj)
  expect(items.length).toBeGreaterThan(0)
  return items.every((it: any) => {
    const a = it.mesh.geometry.attributes.position.array
    for (let k = it.v0 + 1; k < it.v1; k++) if (a[k * 3] !== a[it.v0 * 3] || a[k * 3 + 1] !== a[it.v0 * 3 + 1] || a[k * 3 + 2] !== a[it.v0 * 3 + 2]) return false
    return true
  })
}

describe('registration in the world', () => {
  it('describes the walls one part each, with the assembly of their masonry', () => {
    const { d, house } = setup()
    const wall = d.spec.parts.find((p: any) => p.id === 'wall_0_0')
    expect(wall).toBeTruthy()
    expect(wall.units).toBeTruthy()
    expect(wall.breach).toBeTruthy()
    expect(d.spec.parts.some((p: any) => /_pier_|_sill_|_lintel_/.test(p.id) && house.structure.byId.has(p.id.replace(/_(pier|sill|lintel|spandrel)_\d+$/, '')))).toBe(false)
  })

  it('gives the water tank what it holds and the gas cylinder what makes it explode, with the thin wall of each', () => {
    const { d } = setup({ template: 'single_storey_a', seed: 1 })
    const tank = d.spec.parts.find((p: any) => p.id === 'water_tank')
    const gas = d.spec.parts.find((p: any) => /^gas_cylinder/.test(p.id))
    expect(tank.contains).toEqual({ fluid: 'water', liters: 500 })
    expect(tank.thickness).toBeLessThan(0.01)
    expect(gas.contains.pressurized).toBe(true)
    expect(gas.explodes.energy).toBeGreaterThan(0)
    expect(gas.thickness).toBeLessThan(0.01)
  })

  it('gives the concrete that is drawn (a panel of the slab) the rebar of reinforced concrete', () => {
    const { d } = setup()
    const slab = d.spec.parts.find((p: any) => p.id === 'slab_1_p0')
    expect(slab.reinforcement).toBeTruthy()
    expect(d.spec.parts.find((p: any) => p.id === 'roof_a' || p.material === 'ceramic')?.reinforcement).toBeUndefined()
  })

  it('registers the house once and the world knows every part', () => {
    const { d, world, house } = setup()
    expect(d.active).toBe(true)
    expect(world.has(d.id)).toBe(true)
    for (const id of house.structure.byId.keys()) expect(world.part(d.id, id), id).toBeTruthy()
    d.activate()
    expect(world.has(d.id)).toBe(true)
  })

  it('binds each part to the vertex range, mesh or group that draws it', () => {
    const { d, house } = setup()
    const ranges = d.ranges()
    const drawn = [...house.structure.byId.keys()].filter((id) => house.structure.meshesOf(id).length)
    expect(Object.keys(ranges).sort()).toEqual(drawn.sort())
    for (const [id, items] of Object.entries<any[]>(ranges)) {
      for (const item of items) {
        if (item.range) {
          expect(item.mesh.isMesh, id).toBe(true)
          expect(item.range[1]).toBeGreaterThan(item.range[0])
          expect(item.range[1]).toBeLessThanOrEqual(item.mesh.geometry.attributes.position.count)
        } else expect(item.isObject3D, id).toBe(true)
      }
    }
  })

  it('leaves the world on dispose', () => {
    const { d, world, house } = setup()
    const id = d.id
    house.dispose()
    expect(world.has(id)).toBe(false)
  })
})

describe('fracture and reset', () => {
  it('binds the house to the panels the slab is cut into when it has a world, and draws the slab whole when it has none', () => {
    const { house } = setup()
    const panels = [...house.structure.byId.keys()].filter((id) => /^slab_1_p\d+$/.test(id))
    expect(panels.length).toBeGreaterThan(1)
    expect(house.structure.byId.has('slab_1')).toBe(false)
    expect(panels.filter((id) => house.structure.meshesOf(id).length).length).toBeGreaterThan(1)
    for (const id of panels) expect(house.structure.byId.get(id).role).toBe('slab')
    const bare = houseOf(planOf('sobrado', 3)).house
    expect(bare.structure.byId.has('slab_1')).toBe(true)
    expect(bare.structure.byId.has('slab_1_p0')).toBe(false)
  })

  it('a slab panel that fractures hides its own tiles and leaves the other panels of the slab', () => {
    const { house, d, world, centre, run, events } = setup()
    const drawn = [...house.structure.byId.keys()].filter((id) => /^slab_1_p\d+$/.test(id) && house.structure.meshesOf(id).some((it: any) => it.mesh && !it.whole))
    expect(drawn.length).toBeGreaterThan(1)
    const first = drawn[0]!
    const dist = (id: string): number => Math.hypot(...(centre(id).map((v, k) => v - centre(first)[k]) as number[]))
    const other = [...drawn].sort((a, b) => dist(b) - dist(a))[0]!
    expect(hidden(house, first)).toBe(false)
    world.hitPart(d.id, first, { type: 'explosive', point: centre(first), energy: 5e9, radius: 1, source: 'test' })
    run(1)
    expect(events.some((e) => (e.type === 'fracture' && e.part === first) || (e.type === 'collapse' && e.parts.includes(first)))).toBe(true)
    expect(hidden(house, first)).toBe(true)
    expect(hidden(house, other)).toBe(false)
  })

  it('hides the wall that fractures and puts it back on reset', () => {
    const { house, d, world, centre, run, events } = setup()
    const before = house.structure.meshesOf('wall_0_0').map((it: any) => it.mesh.geometry.attributes.position.array.slice(it.v0 * 3, it.v1 * 3))
    expect(hidden(house, 'wall_0_0')).toBe(false)
    world.hitPart(d.id, 'wall_0_0', { type: 'blunt', point: centre('wall_0_0'), energy: 3e6, radius: 0.35, source: 'test' })
    run(1)
    expect(events.some((e) => e.type === 'fracture' && e.part === 'wall_0_0')).toBe(true)
    expect(hidden(house, 'wall_0_0')).toBe(true)
    d.reset()
    expect(hidden(house, 'wall_0_0')).toBe(false)
    const after = house.structure.meshesOf('wall_0_0').map((it: any) => it.mesh.geometry.attributes.position.array.slice(it.v0 * 3, it.v1 * 3))
    expect(after).toEqual(before)
    expect(d.piece('wall_0_0').status).toBe('intact')
  })

  it('draws a spall decal where a bullet hits a wall', () => {
    const { d, world, renderer, centre, run, events } = setup()
    const decals = renderer.stats().decals
    // a 9 mm round: it scars the plaster but does not knock the brick under it out (a brick that comes out takes its marks with it)
    world.hitPart(d.id, 'wall_0_0', { type: 'ballistic', point: centre('wall_0_0'), direction: [0, 0, -1], energy: 500, caliber: 9 })
    run(0.2)
    expect(events.some((e) => e.type === 'chip')).toBe(false)
    expect(renderer.stats().decals).toBeGreaterThan(decals)
  })

  it('takes the marks of a brick that comes out away with it', () => {
    const { d, world, renderer, centre, run, events } = setup()
    const decals = renderer.stats().decals
    world.hitPart(d.id, 'wall_0_0', { type: 'ballistic', point: centre('wall_0_0'), direction: [0, 0, -1], energy: 2e4, caliber: 12 })
    run(0.2)
    expect(events.some((e) => e.type === 'chip')).toBe(true)
    expect(renderer.stats().decals).toBe(decals)
  })

  it('draws the rebar cage of a concrete slab that spalls, as instanced bars', () => {
    const { d, world, renderer, run, events } = setup()
    expect(renderer.rebarCount()).toBe(0)
    world.hitPart(d.id, 'slab_1_p0', { type: 'explosive', point: d.spec.parts.find((p: any) => p.id === 'slab_1_p0').position, energy: 4e5, radius: 1.5 })
    run(1)
    expect(events.some((e) => e.type === 'expose')).toBe(true)
    expect(renderer.rebarCount()).toBeGreaterThan(0)
  })

  it('turns the legacy damage of a door into a hit in the world', () => {
    const calls: unknown[][] = []
    const { house, d } = setup({ onDamage: (...args) => calls.push(args) })
    const part = house.parts['door:d0_0']
    expect(part.damageable.hp).toBeGreaterThan(0)
    house.damage('door:d0_0', null, 'strike', 1e6)
    expect(part.damageable.hp).toBe(0)
    expect(d.piece('door:d0_0').status).toBe('broken')
    expect(calls.length).toBeGreaterThan(0)
  })
})

describe('a wall cut where its units came out, at full detail', () => {
  /** A blunt hit on a wall that reaches stage 2 without fracturing it, read at the moment of the stage event (stage 3 comes in the same step). */
  function breach() {
    const s = setup()
    const seen: { statistics: any; mesh: any; hidden: boolean; opening: any }[] = []
    s.world.on('stage', (e: any) => {
      if (e.part === 'wall_0_0' && e.stage === 2) seen.push({ statistics: s.d.statistics().breached, mesh: s.house.group.getObjectByName('breach:wall_0_0') ?? s.house.getObjectByName?.('breach:wall_0_0'), hidden: hidden(s.house, 'wall_0_0'), opening: e.opening })
    })
    s.world.hitPart(s.d.id, 'wall_0_0', { type: 'blunt', point: s.centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' })
    s.run(0.5)
    return { ...s, seen }
  }

  it('cuts the wall only where the units came out and keeps the paint of the rest', () => {
    const s = setup()
    let checked = false
    s.world.on('stage', (e: any) => {
      if (e.part !== 'wall_0_0' || e.stage !== 2) return
      const statistics = s.d.statistics().breached
      expect(statistics.walls).toBe(1)
      expect(statistics.gone).toBeGreaterThan(0)
      expect(hidden(s.house, 'wall_0_0')).toBe(true)
      // the units around the opening, drawn behind the cut
      const units = s.house.group.getObjectByName('breach:wall_0_0') as any
      expect(units?.isInstancedMesh).toBe(true)
      expect(units.count).toBe(statistics.units)
      expect(units.count).toBeGreaterThan(0)
      expect(units.instanceColor).toBeTruthy()
      // the wall itself: the same geometry and material as the house drew it, cut by a mask only at the opening
      const shell = s.house.group.getObjectByName('breach-shell') as any
      const item = s.house.structure.meshesOf('wall_0_0').find((it: any) => it.mesh)
      expect(shell.material.type).toBe(item.mesh.material.type)
      expect(shell.material.map).toBe(item.mesh.material.map)
      expect(shell.geometry.attributes.position.count).toBe(item.v1 - item.v0)
      expect(Array.from(shell.geometry.attributes.color.array.slice(0, 3))).toEqual(Array.from(item.mesh.geometry.attributes.color.array.slice(item.v0 * 3, item.v0 * 3 + 3)))
      const mask = shell.userData.breachMask
      const at = (p: number[]) => {
        const v = s.house.group.worldToLocal(new THREE.Vector3(p[0], p[1], p[2]))
        const i = Math.floor(((mask.alongU ? v.x : v.z) - mask.start) / mask.len * mask.w), j = Math.floor((v.y - mask.y0) / mask.height * mask.h)
        return mask.data[j * mask.w + i]
      }
      expect(at(e.opening.center)).toBe(255)
      const part = s.house.structure.byId.get('wall_0_0')
      const far = mask.alongU ? [part.aabb[0] + 0.05, part.y0 + 0.05, 0] : [0, part.y0 + 0.05, part.aabb[1] + 0.05]
      expect(mask.data[Math.floor((far[1] - mask.y0) / mask.height * mask.h) * mask.w + Math.floor(((mask.alongU ? far[0] : far[2]) - mask.start) / mask.len * mask.w)]).toBe(0)
      expect(mask.data.filter((x: number) => x > 0).length).toBeLessThan(mask.data.length / 4)
      checked = true
    })
    s.world.hitPart(s.d.id, 'wall_0_0', { type: 'blunt', point: s.centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' })
    s.run(0.5)
    expect(checked).toBe(true)
  })

  it('leaves no unit inside the opening', () => {
    const s = setup()
    let checked = false
    s.world.on('stage', (e: any) => {
      if (e.part !== 'wall_0_0' || e.stage !== 2) return
      const mesh = s.house.group.getObjectByName('breach:wall_0_0') as any
      const m = new THREE.Matrix4(); const p = new THREE.Vector3()
      for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); expect(p.distanceTo(new THREE.Vector3(...(e.opening.center as [number, number, number])))).toBeGreaterThanOrEqual(e.opening.radius - 1e-6) }
      checked = true
    })
    s.world.hitPart(s.d.id, 'wall_0_0', { type: 'blunt', point: s.centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' })
    s.run(0.5)
    expect(checked).toBe(true)
  })

  it('goes back to the box at LOD 1 and 2 and to the cut wall at LOD 0', () => {
    const s = setup()
    s.world.on('stage', (e: any) => {
      if (e.part !== 'wall_0_0' || e.stage !== 2) return
      const mesh = s.house.group.getObjectByName('breach:wall_0_0') as any
      const shell = s.house.group.getObjectByName('breach-shell') as any
      expect(mesh.visible).toBe(true)
      expect(shell.visible).toBe(true)
      s.house.setLod(1)
      expect(mesh.visible).toBe(false)
      expect(shell.visible).toBe(false)
      expect(hidden(s.house, 'wall_0_0')).toBe(false)
      s.house.setLod(0)
      expect(mesh.visible).toBe(true)
      expect(shell.visible).toBe(true)
      expect(hidden(s.house, 'wall_0_0')).toBe(true)
    })
    s.world.hitPart(s.d.id, 'wall_0_0', { type: 'blunt', point: s.centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' })
    s.run(0.5)
  })

  it('takes the cut wall away when the wall comes down', () => {
    const { house, d } = breach()
    expect(house.group.getObjectByName('breach:wall_0_0')).toBeUndefined()
    expect(house.group.getObjectByName('breach-shell')).toBeUndefined()
    expect(d.statistics().breached.walls).toBe(0)
  })

  it('draws no courses when the house is at LOD 1', () => {
    const s = setup()
    s.house.setLod(1)
    s.world.hitPart(s.d.id, 'wall_0_0', { type: 'blunt', point: s.centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' })
    s.run(0.5)
    expect(s.d.statistics().breached.walls).toBe(0)
  })
})

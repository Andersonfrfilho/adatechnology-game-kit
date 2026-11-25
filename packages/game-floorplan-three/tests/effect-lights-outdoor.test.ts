import { createLightBudget } from '@adatechnology/game-render-three'
import { describe, expect, it } from 'vitest'

import { rectsOf } from '../src'
import type { HouseRenderer } from '../src'
import type { HouseRendererInternal } from '../src/kernel-types-systems'
import { THREE, houseOf, planOf } from './helpers/houses'

type Uniforms = Record<'uRB0' | 'uRB1' | 'uRB2' | 'uRBY' | 'uREx' | 'uROut' | 'uRIn' | 'uRInY', { value: Float32Array }> & { uRInN: { value: number } }
type Point = readonly [number, number, number]
type Opening = { id: string; axis: string; at: number; pos: number; floor: number; y0?: number; y1?: number }

const uniformsOf = (renderer: HouseRenderer): Uniforms => (renderer as HouseRendererInternal).internals.K.LZU as unknown as Uniforms

/** The room mask of slot `slot` at world point `p`, read from the uniforms exactly as the fragment shader of a masked material reads them. */
function maskAt(u: Uniforms, slot: number, [x, y, z]: Point): number {
  const inRect = (array: Float32Array, at: number): boolean => x >= array[at]! && x <= array[at + 2]! && z >= array[at + 1]! && z <= array[at + 3]!
  let inside = false
  for (let j = 0; j < u.uRInN.value; j++) if (inRect(u.uRIn.value, j * 4) && y >= u.uRInY.value[j * 2]! && y <= u.uRInY.value[j * 2 + 1]!) inside = true
  if (u.uROut.value[slot]! === 1 && !inside) return 1
  let k = inRect(u.uRB0.value, slot * 4) || inRect(u.uRB1.value, slot * 4) || inRect(u.uRB2.value, slot * 4) ? 1 : 0
  if (!(y >= u.uRBY.value[slot * 2]! && y <= u.uRBY.value[slot * 2 + 1]!)) k = 0
  if (inRect(u.uREx.value, slot * 4)) k = 0
  return k
}

function setup() {
  const { house, renderer } = houseOf(planOf('casaA', 3), {}, { night: true })
  house.house.updateMatrixWorld(true)
  const scene = new THREE.Scene()
  const budget = createLightBudget(THREE, scene, { point: 6, spot: 0, pointShadows: 0 })
  const M = house.house.matrixWorld
  const world = (u: number, y: number, v: number): Point => {
    const p = new THREE.Vector3(u, y, v).applyMatrix4(M)
    return [p.x, p.y, p.z]
  }
  const rooms = house.r.rooms.filter((room) => room.type !== 'void')
  const roomAt = (u: number, v: number, floor: number) => rooms.find((room) => room.floor === floor && rectsOf(room).some(([a, b, c, d]) => u > a && u < c && v > b && v < d))
  /** The two sides of an opening, 0.6 m off its plane, in the house's own u/v. */
  const sidesOf = (p: Opening): [[number, number], [number, number]] => (p.axis === 'u' ? [[p.at, p.pos - 0.6], [p.at, p.pos + 0.6]] : [[p.pos - 0.6, p.at], [p.pos + 0.6, p.at]])
  /** An outer opening: the room behind it and a point `out` metres in front of it, outside. */
  const outerOf = (p: Opening, out: number) => {
    const [low, high] = sidesOf(p)
    const lowRoom = roomAt(low[0], low[1], p.floor)
    const highRoom = roomAt(high[0], high[1], p.floor)
    if (!lowRoom === !highRoom) return undefined
    const [cu, cv] = p.axis === 'u' ? [p.at, p.pos] : [p.pos, p.at]
    const [ou, ov] = lowRoom ? high : low
    const scale = out / 0.6
    return { room: (lowRoom ?? highRoom)!, front: [cu + (ou - cu) * scale, cv + (ov - cv) * scale] as const, centre: [cu, cv] as const }
  }
  const centreOf = (room: (typeof rooms)[number]): Point => {
    const [a, b, c, d] = rectsOf(room)[0]!
    return world((a + c) / 2, house.y0(room.floor) + 1.2, (b + d) / 2)
  }
  const lamp = (position: Point, distance: number) => budget.acquire({ owner: 'urban.light', priority: 900, urgent: true, color: 0xffc070, intensity: 4, distance, position: [...position] })!
  const lit = (): Uniforms => {
    budget.present([0, 1.6, 0], 1)
    renderer.effectLights!({ budget }).update([house], { x: 0, y: 1.6, z: 0 })
    return uniformsOf(renderer)
  }
  const openings = (list: readonly Opening[] | undefined): Opening[] => [...(list ?? [])]
  return { house, renderer, budget, world, rooms, outerOf, centreOf, lamp, lit, openings }
}

/** The openings of a room's floor within `reach` of a point, in the house's u/v. */
const near = (list: readonly Opening[], [u, v]: readonly [number, number], reach: number): Opening[] =>
  list.filter((p) => Math.hypot((p.axis === 'u' ? p.at : p.pos) - u, (p.axis === 'u' ? p.pos : p.at) - v) <= reach)

describe('outdoor lights and the house interiors', () => {
  it('gives the house materials the mask without lighting()', () => {
    const { renderer, budget } = setup()
    renderer.effectLights!({ budget })
    const masked = Object.values(renderer.materials).filter((m) => m?.userData?.roomLightMask)
    expect(masked.length).toBeGreaterThan(5)
  })

  it('a lamp outside a wall with no opening near it lights the outer face and none of the interior faces', () => {
    const { house, world, rooms, centreOf, lamp, lit, openings } = setup()
    const all = openings(house.r.windows)
    // a ground floor room side that is an outer wall, with no door or window within 4 m of the spot 1.5 m in front of it
    let found: { room: (typeof rooms)[number]; front: Point; inner: Point; outer: Point } | undefined
    for (const room of rooms.filter((r) => r.floor === 0)) {
      const [a, b, c, d] = rectsOf(room)[0]!
      const y = house.y0(0) + 1.2
      const sides: Array<[number, number, number, number]> = [[(a + c) / 2, b, 0, -1], [(a + c) / 2, d, 0, 1], [a, (b + d) / 2, -1, 0], [c, (b + d) / 2, 1, 0]]
      for (const [u, v, du, dv] of sides) {
        const outside = rooms.some((other) => other.floor === 0 && rectsOf(other).some(([a2, b2, c2, d2]) => u + du * 0.6 > a2 && u + du * 0.6 < c2 && v + dv * 0.6 > b2 && v + dv * 0.6 < d2))
        if (outside) continue
        const front: [number, number] = [u + du * 1, v + dv * 1]
        if (near(all, front, 1.6).length) continue
        found = { room, front: world(front[0], y + 1, front[1]), inner: world(u - du * 0.075, y, v - dv * 0.075), outer: world(u + du * 0.075, y, v + dv * 0.075) }
        break
      }
      if (found) break
    }
    expect(found).toBeDefined()
    const { room, front, inner, outer } = found!
    const handle = lamp(front, 1.5)
    const u = lit()
    expect(u.uROut.value[handle.slot]).toBe(1)
    expect(maskAt(u, handle.slot, outer)).toBe(1)
    expect(maskAt(u, handle.slot, inner)).toBe(0)
    expect(maskAt(u, handle.slot, centreOf(room))).toBe(0)
    for (const other of rooms) expect(maskAt(u, handle.slot, centreOf(other))).toBe(0)
  })

  it('a lamp in front of a window lights the room behind it, and not a room it does not see', () => {
    const { house, rooms, world, outerOf, centreOf, lamp, lit, openings } = setup()
    const window = openings(house.r.windows).find((p) => p.floor === 0 && outerOf(p, 2))!
    expect(window).toBeDefined()
    const { room, front } = outerOf(window, 2)!
    const handle = lamp(world(front[0], house.y0(0) + 2, front[1]), 6)
    const u = lit()
    expect(maskAt(u, handle.slot, centreOf(room))).toBe(1)
    const upstairsOrFar = rooms.filter((other) => other !== room && (other.floor > 0 || Math.hypot(centreOf(other)[0] - centreOf(room)[0], centreOf(other)[2] - centreOf(room)[2]) > 8))
    const unseen = upstairsOrFar.find((other) => other.floor > 0) ?? upstairsOrFar[0]
    if (unseen) expect(maskAt(u, handle.slot, centreOf(unseen))).toBe(0)
  })

  it('a closed outer door keeps the lamp out, an open one lets it in', () => {
    const { house, world, outerOf, centreOf, lamp, lit, openings } = setup()
    const windows = openings(house.r.windows)
    const door = openings(house.r.doors).find((p) => p.floor === 0 && outerOf(p, 1) && near(windows, outerOf(p, 1)!.front, 1.6).length === 0)!
    expect(door).toBeDefined()
    const { room, front } = outerOf(door, 1)!
    const doorState = (house as unknown as { internal: { doorState: Map<string, boolean> } }).internal.doorState
    doorState.set(door.id, false)
    const handle = lamp(world(front[0], house.y0(0) + 1.2, front[1]), 1.5)
    expect(maskAt(lit(), handle.slot, centreOf(room))).toBe(0)
    doorState.set(door.id, true)
    expect(maskAt(lit(), handle.slot, centreOf(room))).toBe(1)
    doorState.set(door.id, false)
    expect(maskAt(lit(), handle.slot, centreOf(room))).toBe(0)
  })

  it('a lamp inside a room keeps the room mask (not an outdoor light)', () => {
    const { rooms, centreOf, lamp, lit } = setup()
    const room = rooms.find((r) => r.floor === 0)!
    const handle = lamp(centreOf(room), 5)
    const u = lit()
    expect(u.uROut.value[handle.slot]).toBe(2)
    expect(maskAt(u, handle.slot, centreOf(room))).toBe(1)
  })

  it('reads the outdoor flag and the interiors in the shader', () => {
    const { renderer, budget } = setup()
    renderer.effectLights!({ budget })
    const material = Object.values(renderer.materials).find((m) => m?.userData?.roomLightMask)!
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: 'void main() {\n#include <begin_vertex>', fragmentShader: 'void main() {\ngetPointLightInfo( pointLight, geometryPosition, directLight );' }
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer)
    expect(shader.fragmentShader).toContain('uROut[ i ], rInside')
    expect(shader.fragmentShader).toContain('bool rInside = roomInside( vRoomW );')
    for (const key of ['uROut', 'uRIn', 'uRInY', 'uRInN']) expect(shader.uniforms[key]).toBeDefined()
  })

  it('wraps the point lights of the real shader: the loop is in an include the renderer opens after onBeforeCompile', () => {
    const { renderer, budget } = setup()
    renderer.effectLights!({ budget })
    const material = Object.values(renderer.materials).find((m) => m?.userData?.roomLightMask)!
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader }
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>')
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer)
    expect(shader.fragmentShader).not.toContain('#include <lights_fragment_begin>')
    expect(shader.fragmentShader).toContain('rmk = roomMask( uRB0[ i ]')
    expect(shader.vertexShader).toContain('vRoomW = ( modelMatrix')
    // the loop is unrolled with no braces: a declaration inside it would repeat once per light
    expect(shader.fragmentShader.match(/float rmk/g)).toHaveLength(1)
    // the fake indirect is the room lamps' only: a street lamp is many times brighter and would flood the room it is let into
    expect(shader.fragmentShader).toContain('rmk * step( uROut[ i ], 0.5 ) * uIndK')
  })
})

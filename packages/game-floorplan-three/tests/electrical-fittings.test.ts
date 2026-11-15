import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { PLASTER_PER_FACE, lampTypeOfRoom } from '@adatechnology/game-floorplan-structure'
import type { Electrical, LampType, Outbuilding } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { SOCKET_SIZE, ceilingSocketParts, sconceSocketParts, tubeLayoutOf } from '../src/utilities/lamp-sockets'
import type { SocketPrimitive } from '../src/utilities/lamp-sockets'
import { WALL_BOX, wallBehindOf, wallBoxExtent } from '../src/utilities/wall-box'
import { THREE, houseOf, planOf } from './helpers/houses'

const kit = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree }
const WALL_PLATE = GameInteractablesHousehold.WALL_PLATE
type StagedHouse = ReturnType<typeof houseOf>['house'] & { setConstructionLevel(level: number): number }
type Plan = ReturnType<typeof planOf> & { outbuildings?: Outbuilding[]; utilities: { electrical: Electrical }; rooms: { id: string; type: string; floor: number }[] }

const visibleIn = (o: THREE.Object3D): boolean => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}
const sizeOf = (primitives: readonly SocketPrimitive[]): THREE.Box3 => {
  const box = new THREE.Box3()
  for (const p of primitives) {
    if (p.shape === 'box') box.union(new THREE.Box3(new THREE.Vector3(...p.min), new THREE.Vector3(...p.max)))
    else if (p.shape === 'cylinder') box.union(new THREE.Box3(new THREE.Vector3(p.base[0] - p.radius, p.base[1], p.base[2] - p.radius), new THREE.Vector3(p.base[0] + p.radius, p.base[1] + p.height, p.base[2] + p.radius)))
    else box.union(new THREE.Box3().setFromPoints([new THREE.Vector3(...p.from), new THREE.Vector3(...p.to)]).expandByScalar(p.diameter / 2))
  }
  return box
}

describe('the sockets of the lamps, with their real sizes', () => {
  const at = { x: 3, z: 4, mountY: 2.6, alongU: true, span: 1.2 }

  it('holds a bulb in an E27 holder 40 mm across and 55 mm long', () => {
    const { socket } = ceilingSocketParts({ ...at, lamp: 'bulb_e27' })
    const holder = socket.find((p): p is Extract<SocketPrimitive, { shape: 'cylinder' }> => p.shape === 'cylinder' && p.radius === SOCKET_SIZE.e27.radius)!
    expect(holder.radius * 2).toBeCloseTo(0.04, 6)
    expect(holder.height).toBeCloseTo(0.055, 6)
    expect(sizeOf(socket).max.y).toBeCloseTo(at.mountY, 6)
  })

  it('puts the two lampholders of a T8 batten 1200 mm apart, the tube between them, flush with the ceiling', () => {
    const { socket, lamp } = ceilingSocketParts({ ...at, lamp: 'tube_t8' })
    const holders = socket.filter((p): p is Extract<SocketPrimitive, { shape: 'box' }> => p.shape === 'box').slice(1)
    expect(holders.length).toBe(2)
    const centres = holders.map((p) => (p.min[0] + p.max[0]) / 2)
    expect(Math.abs(centres[1]! - centres[0]!)).toBeCloseTo(1.2, 6)
    expect(lamp[0]).toMatchObject({ shape: 'rod' })
    const along = sizeOf(lamp).getSize(new THREE.Vector3())
    expect(along.x).toBeGreaterThan(1.15)
    expect(sizeOf(socket).max.y).toBeCloseTo(at.mountY, 6)
    const short = ceilingSocketParts({ ...at, lamp: 'tube_t8', span: 0.6, alongU: false })
    const shortCentres = short.socket.filter((p): p is Extract<SocketPrimitive, { shape: 'box' }> => p.shape === 'box').slice(1).map((p) => (p.min[2] + p.max[2]) / 2)
    expect(Math.abs(shortCentres[1]! - shortCentres[0]!)).toBeCloseTo(0.6, 6)
  })

  it('lays a flush base between 100 and 300 mm across, and a wall sconce on the wall face', () => {
    const base = ceilingSocketParts({ ...at, lamp: 'plafon' }).socket[0] as Extract<SocketPrimitive, { shape: 'cylinder' }>
    expect(base.radius * 2).toBeGreaterThanOrEqual(0.1)
    expect(base.radius * 2).toBeLessThanOrEqual(0.3)
    const [sconceBase] = sconceSocketParts({ x: 1, y: 2.1, z: 0, frontU: 0, frontV: -1 }).socket
    expect(sconceBase).toMatchObject({ shape: 'rod', from: [1, 2.1, 0], to: [1, 2.1, -SOCKET_SIZE.sconce.depth] })
    expect((sconceBase as Extract<SocketPrimitive, { shape: 'rod' }>).diameter).toBeCloseTo(0.1, 6)
  })

  it('lays the 1.2 m tube along the room if it fits between the walls, else the short tube, else across', () => {
    expect(tubeLayoutOf(2, 2, [0, 0, 6, 3])).toEqual({ alongU: true, span: 1.2 })
    expect(tubeLayoutOf(1, 3, [0, 0, 2, 6])).toEqual({ alongU: false, span: 1.2 })
    expect(tubeLayoutOf(0.6, 0.6, [0, 0, 1.2, 1.2])).toEqual({ alongU: true, span: 0.6 })
  })
})

for (const template of ['single_storey_a', 'townhouse', 'mid_modern_single_storey']) {
  describe(`${template}: the sockets from the installations level`, () => {
    const plan = planOf(template, 1) as unknown as Plan
    const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 8 })
    const staged = house as StagedHouse
    const lights = (plan as unknown as { items: { id: string; type: string; x: number; z: number; room: string; floor: number }[] }).items.filter((item) => item.type === 'ceiling_light')
    const buildings = plan.outbuildings ?? []
    const lampOfLight = (light: { room: string; floor: number }): LampType => {
      const room = plan.rooms.find((candidate) => candidate.id === light.room && candidate.floor === light.floor)
      return lampTypeOfRoom(room?.type ?? 'living', buildings.some((building) => building.id === light.room))
    }

    it('gives each lighting point the socket of its room, shown at the installations level', () => {
      staged.setConstructionLevel(4)
      const shown: { id: string; lamp: string }[] = []
      staged.group.traverse((o) => {
        if (o.userData.part === 'lamp_holder' && o.userData.mount === 'slab' && visibleIn(o)) shown.push(...(o.userData.sockets as { id: string; lamp: string }[]))
      })
      expect(lights.length).toBeGreaterThan(0)
      for (const light of lights) expect(shown.find((socket) => socket.id === light.id)?.lamp, light.id).toBe(lampOfLight(light))
    })

    it('hangs every socket under the slab at the installations level and under the rendered ceiling afterwards, never inside either', () => {
      for (const level of [4, 5, 6, 7]) {
        staged.setConstructionLevel(level)
        const meshes: THREE.Mesh[] = []
        staged.group.updateMatrixWorld(true)
        staged.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && visibleIn(o)) meshes.push(o as THREE.Mesh) })
        const raycaster = new THREE.Raycaster()
        for (const light of lights) {
          const floorY = (plan as unknown as { floors: { y0: number }[] }).floors[light.floor]?.y0 ?? 0
          raycaster.set(new THREE.Vector3(light.x, floorY + 1.2, light.z), new THREE.Vector3(0, 1, 0))
          const hit = raycaster.intersectObjects(meshes, false)[0]
          let part: THREE.Object3D | null = hit?.object ?? null
          while (part && !['lamp_holder', 'lamp_bulb'].includes(String(part.userData.part))) part = part.parent
          expect(part, `${light.id} at level ${level}: first thing over it (${hit?.object.parent?.name})`).not.toBeNull()
        }
      }
    })

    it('draws one kind of socket set at a time between level 4 and 7, and none outside', () => {
      for (const level of [3, 4, 5, 6, 7, 8]) {
        staged.setConstructionLevel(level)
        const sets: THREE.Object3D[] = []
        staged.group.traverse((o) => { if (o.userData.part === 'lamp_holder' && o.userData.id) sets.push(o) })
        const shown = sets.filter(visibleIn).map((o) => o.userData.mount)
        expect(shown.length > 0, `level ${level}`).toBe(level >= 4 && level <= 7)
        expect(new Set(shown).size, `level ${level}`).toBe(shown.length ? 1 : 0)
        expect(shown[0], `level ${level}`).toBe(level < 4 || level > 7 ? undefined : level === 4 ? 'slab' : 'ceiling')
      }
    })
  })
}

describe('single_storey_a: the 4x2 box and its plate', () => {
  const plan = planOf('single_storey_a', 1) as unknown as Plan & { walls: Parameters<typeof wallBehindOf>[0] }
  const electrical = plan.utilities.electrical
  const points = [...electrical.outlets, ...electrical.switches]
  const { house } = houseOf(plan as never, { interactives: kit }, { quality: 'game', constructionStages: true, constructionLevel: 8 })

  it('has a box 101 x 54 mm and a plate about 120 x 75 mm, portrait, bigger than the box', () => {
    expect(WALL_BOX.high).toBeCloseTo(0.101, 6)
    expect(WALL_BOX.along).toBeCloseTo(0.054, 6)
    expect(WALL_PLATE.height).toBeGreaterThanOrEqual(0.115)
    expect(WALL_PLATE.height).toBeLessThanOrEqual(0.125)
    expect(WALL_PLATE.width).toBeGreaterThanOrEqual(0.07)
    expect(WALL_PLATE.width).toBeLessThanOrEqual(0.08)
    expect(WALL_PLATE.height).toBeGreaterThan(WALL_PLATE.width)
  })

  it('covers every box on all sides by at least 5 mm, centred on it, with the module in the middle', () => {
    const entries = house.interactives!.entries
    expect(points.length).toBeGreaterThan(5)
    for (const point of points) {
      const entry = entries.get(point.id)!
      expect(entry, point.id).toBeDefined()
      const alongU = Math.abs(point.frontV) >= Math.abs(point.frontU)
      const box = wallBoxExtent(point, wallBehindOf(plan.walls, point))
      const floorY = entry.pos[1], plateY0 = floorY + (entry.entry.item.y as number), plateY1 = plateY0 + WALL_PLATE.height
      expect(floorY + box.y0 - plateY0, point.id).toBeGreaterThanOrEqual(0.005 - 1e-9)
      expect(plateY1 - (floorY + box.y1), point.id).toBeGreaterThanOrEqual(0.005 - 1e-9)
      expect((plateY0 + plateY1) / 2, point.id).toBeCloseTo(floorY + point.y, 6)
      const boxAlong = alongU ? [box.u0, box.u1] : [box.v0, box.v1]
      const plateCentre = alongU ? entry.pos[0] : entry.pos[2]
      expect(plateCentre - WALL_PLATE.width / 2, point.id).toBeLessThanOrEqual(boxAlong[0]! - 0.005 + 1e-9)
      expect(plateCentre + WALL_PLATE.width / 2, point.id).toBeGreaterThanOrEqual(boxAlong[1]! + 0.005 - 1e-9)
      expect(plateCentre, point.id).toBeCloseTo((boxAlong[0]! + boxAlong[1]!) / 2, 6)
    }
  })

  it('sets every box flush with the bricks, behind the render and inside the wall', () => {
    const half = (wall: { halfThickness: number }): number => wall.halfThickness
    for (const point of points) {
      const wall = wallBehindOf(plan.walls, point)
      const box = wallBoxExtent(point, wall)
      const alongU = Math.abs(point.frontV) >= Math.abs(point.frontU)
      const intoRoom = Math.sign(alongU ? point.frontV : point.frontU)
      const [near, far] = alongU ? [box.v0, box.v1] : [box.u0, box.u1]
      const face = intoRoom > 0 ? far : near, back = intoRoom > 0 ? near : far
      const renderFace = wall.line + intoRoom * half(wall), masonryFace = renderFace - intoRoom * PLASTER_PER_FACE
      expect(Math.abs(face - masonryFace), point.id).toBeLessThanOrEqual(0.005)
      expect(Math.abs(renderFace - face), point.id).toBeGreaterThanOrEqual(0.01)
      expect(box.renderOverFace, point.id).toBeGreaterThanOrEqual(0.01)
      expect(Math.abs(wall.line - back), point.id).toBeLessThan(half(wall))
    }
  })

  it('shows the box flush with the masonry at the installations level and no cavity', () => {
    const staged = house as StagedHouse
    staged.setConstructionLevel(4)
    staged.group.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    staged.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && visibleIn(o)) meshes.push(o as THREE.Mesh) })
    const raycaster = new THREE.Raycaster()
    for (const point of points) {
      const wall = wallBehindOf(plan.walls, point)
      const box = wallBoxExtent(point, wall)
      const alongU = Math.abs(point.frontV) >= Math.abs(point.frontU)
      const floorY = (plan as unknown as { floors: { y0: number }[] }).floors[point.floor]?.y0 ?? 0
      const front = new THREE.Vector3(alongU ? 0 : Math.sign(point.frontU), 0, alongU ? Math.sign(point.frontV) : 0)
      raycaster.set(new THREE.Vector3(point.u, floorY + point.y, point.v).addScaledVector(front, 0.5), front.clone().negate())
      const hit = raycaster.intersectObjects(meshes, false)[0]
      expect(hit, point.id).toBeDefined()
      const reached = alongU ? hit!.point.z : hit!.point.x
      const masonryFace = wall.line + Math.sign(alongU ? point.frontV : point.frontU) * (wall.halfThickness - PLASTER_PER_FACE)
      expect(Math.abs(reached - masonryFace), `${point.id}: the first face seen from the room, within the render's thickness of the planned masonry`).toBeLessThanOrEqual(PLASTER_PER_FACE)
      expect(box.y1 - box.y0).toBeCloseTo(WALL_BOX.high, 6)
    }
  })
})

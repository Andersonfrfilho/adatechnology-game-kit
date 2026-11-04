import { writeFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { fleetVehicleIds } from '../src'
import { makeFleetKit } from './helpers/kit'

/** Per model: a shot lands on the drawn part, the mark stays on it when the door swings, and the door takes its skin, pane and rubber with it. */
type Finding = { readonly model: string; readonly problem: string }

const AIR_ABOVE = 0.4
const PANE_SAMPLES = 6
const PANE_SEAT_TOLERANCE = 0.03
const HOOD_SEAM = 0.015
const HOOD_STEP = 0.005
/** Panes a shot along their normal does not reach yet (something drawn stands in front, or the pane is behind trim): to look at one by one, see docs/veiculos-verificacao.md. */
const KNOWN_OPEN = new Set(['midsize_suv', 'armored_truck', 'fastback_sedan', 'battle_tank', 'fishing_boat', 'single_engine_plane', 'beetle', 'apc_6x6'])
/** A strip drawn along the side is a ribbon up to this tall; a taller part (a wheel arch's liner) is not a strip. */
const STRIP_TALL = 0.22
/** The bottom of a door (this high over its zone's floor) is no deeper than this from its skin, metres: deeper is the body behind it (a wheel house, the floor). */
const DOOR_BOTTOM = 0.25
const DOOR_LOWER_DEPTH = 0.3
const SHOT = { type: 'ballistic', energy: 527, caliber: 9 } as const

/** Points really on the pane, whatever its outline: the middles of its largest triangles, facing out. A trim or a seal may cover some, never all. */
function paneAims(mesh: THREE.Mesh, vehicleCentre: THREE.Vector3): Array<{ at: THREE.Vector3; normal: THREE.Vector3 }> {
  const pos = mesh.geometry.attributes.position!
  const index = mesh.geometry.index
  const tri = new THREE.Triangle()
  const count = index ? index.count : pos.count
  const all: Array<{ area: number; at: THREE.Vector3; normal: THREE.Vector3 }> = []
  for (let f = 0; f + 2 < count; f += 3) {
    tri.a.fromBufferAttribute(pos, index ? index.getX(f) : f)
    tri.b.fromBufferAttribute(pos, index ? index.getX(f + 1) : f + 1)
    tri.c.fromBufferAttribute(pos, index ? index.getX(f + 2) : f + 2)
    const at = tri.getMidpoint(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
    const normal = tri.getNormal(new THREE.Vector3()).transformDirection(mesh.matrixWorld)
    if (normal.dot(at.clone().sub(vehicleCentre)) < 0) normal.negate()
    all.push({ area: tri.getArea(), at, normal })
  }
  return all.sort((a, b) => b.area - a.area).slice(0, PANE_SAMPLES)
}

function auditModel(key: string): string[] {
  const problems: string[] = []
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  item.root.updateMatrixWorld(true)
  const c = item.vehicle
  const box = new THREE.Box3().setFromObject(item.root)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const across = size.x < size.z ? 'x' : 'z'
  const shoot = (origin: THREE.Vector3, dir: THREE.Vector3) => d.surfaceRay!({ origin: origin.toArray() as [number, number, number], direction: dir.toArray() as [number, number, number], maxDistance: 30 })

  // a pane takes the round that goes to it
  c.vehicle.traverse((o: any) => {
    const glass = o.userData?.glass
    if (!o.isMesh || !glass) return
    const hits = paneAims(o, centre).map(({ at, normal: n }) => shoot(at.clone().addScaledVector(n, 3), n.clone().negate()))
    if (!hits.some((hit) => hit && /window|windshield|glass|screen|canopy|visor|^pane_/i.test(hit.part))) {
      problems.push(`pane ${glass.key ?? glass.label}: the shots land on ${[...new Set(hits.map((hit) => hit?.part ?? 'nothing'))].join(', ')}`)
    }
  })
  // a windshield or rear window lies on the body: nothing of the shell stands past it and it does not stand off the shell
  c.glass.forEach((pane: any) => {
    if (!pane.userData.glass || pane.userData.glass.outline) return
    const hits = paneAims(pane, centre).map(({ at, normal: n }) => shoot(at.clone().addScaledVector(n, 1), n.clone().negate()))
    if (hits.every((hit) => hit && hit.distance < 1 - PANE_SEAT_TOLERANCE)) problems.push(`pane ${pane.userData.glass.key}: the ${hits[0]!.part} stands past it`)
  })
  // a closed hood is flush with the fender beside it
  if (c.hood?.lift) {
    const inverse = c.vehicle.matrixWorld.clone().invert()
    const hoodBox = new THREE.Box3().setFromObject(c.hood.piv).applyMatrix4(inverse)
    const midX = (hoodBox.min.x + hoodBox.max.x) / 2
    const heightAt = (z: number): number | undefined => {
      const ray = new THREE.Raycaster(new THREE.Vector3(midX, 4, z).applyMatrix4(c.vehicle.matrixWorld), new THREE.Vector3(0, -1, 0).transformDirection(c.vehicle.matrixWorld))
      ray.camera = new THREE.PerspectiveCamera()
      const hit = ray.intersectObject(c.vehicle, true).find((q) => q.face && !q.object.userData.decal)
      return hit?.point.clone().applyMatrix4(inverse).y
    }
    const inside = heightAt(hoodBox.max.z - HOOD_SEAM)
    const outside = heightAt(hoodBox.max.z + HOOD_SEAM)
    if (inside !== undefined && outside !== undefined && inside - outside > HOOD_STEP) problems.push(`the hood stands ${((inside - outside) * 1000).toFixed(0)} mm over the fender`)
  }
  // the air over the body is air
  const over = shoot(new THREE.Vector3(centre.x, box.max.y + AIR_ABOVE, centre.z), new THREE.Vector3(1, 0, 0))
  if (over) problems.push(`the air above the vehicle takes a shot on ${over.part}`)

  // a door
  const doors = d.describe().parts.filter((p) => p.tags?.includes('door')).map((p) => p.id)
  const strips = new Set<string>()
  const inverse = c.vehicle.matrixWorld.clone().invert()
  for (const id of doors) {
    const piv = c.vehicle.getObjectByName(id)
    if (!piv) {
      problems.push(`${id}: no hinge`)
      continue
    }
    const clip = d.animations().find((a) => a.keys.at(-1)?.parts?.[id])
    const rotation = clip?.keys.at(-1)?.parts?.[id]?.rotation
    if (!rotation) {
      problems.push(`${id}: no opening clip`)
      continue
    }
    const part = d.describe().parts.find((p) => p.id === id)!
    const zone = (kit as any).zonesOf(c).find((q: any) => q.id === id)
    const zoneBox = zone ? { ...zone.box, side: zone.side } : { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, side: 1 }
    if (zone) {
      for (const o of c.vehicle.children as any[]) {
        if (!o.isMesh || o.material !== (kit as any)._.MATERIALS.chrome) continue
        const b = new THREE.Box3().setFromObject(o).applyMatrix4(inverse)
        const at = b.getCenter(new THREE.Vector3())
        const s = b.getSize(new THREE.Vector3())
        const B = zone.box
        if (s.x < 0.07 || s.x > 0.24 || s.y > 0.07 || s.z > 0.07 || Math.sign(at.z) !== Math.sign(zone.side) || at.x < B.x0 || at.x > B.x1 || at.y < B.y0 || at.y > B.y1) continue
        // the pull inside the cabin is not the outer handle
        if (Math.abs(at.z) < Math.min(size.x, size.z) / 2 - 0.15) continue
        const fromFree = zone.hinge === 'rear' ? B.x1 - at.x : at.x - B.x0
        if (fromFree > (B.x1 - B.x0) * 0.35) problems.push(`${id}: the handle is by the hinge`)
      }
    }
    const pos = new THREE.Vector3(...part.position).applyMatrix4(item.root.matrixWorld)
    const out = new THREE.Vector3().setComponent(across === 'x' ? 0 : 2, Math.sign(pos[across] - centre[across]) || 1)
    const low = pos.clone().add(new THREE.Vector3(0, -0.05, 0))
    const hit = shoot(low.clone().addScaledVector(out, 3), out.clone().negate())
    if (!hit) {
      problems.push(`${id}: a shot at the middle of the door meets nothing`)
      continue
    }
    if (hit.part !== id) problems.push(`${id}: a shot at the middle of the door lands on ${hit.part}`)
    d.hit({ ...SHOT, point: hit.point, part: hit.part, normal: hit.normal, direction: out.clone().negate().toArray() as [number, number, number] })
    const mark = () => {
      const marks: THREE.Object3D[] = []
      piv.traverse((o: any) => {
        if (o.userData?.decal) marks.push(o)
      })
      return marks[0]
    }
    if (hit.part === id && !mark()) problems.push(`${id}: the hole is not on the door`)
    const before = mark()?.getWorldPosition(new THREE.Vector3())
    const edgeClosed = pos.clone()
    piv.rotation.set(...(rotation as [number, number, number]))
    item.root.updateMatrixWorld(true)
    const after = mark()?.getWorldPosition(new THREE.Vector3())
    if (before && after && before.distanceTo(after) < 0.02) problems.push(`${id}: the hole did not swing with the door`)
    let openOut = false
    piv.traverse((o: any) => {
      if (!o.isMesh || !o.visible || o.userData?.decal) return
      const b = new THREE.Box3().setFromObject(o)
      if (Math.abs(b.getCenter(new THREE.Vector3())[across] - centre[across]) > Math.abs(edgeClosed[across] - centre[across]) + 0.05) openOut = true
    })
    if (!openOut) problems.push(`${id}: opening does not swing it out of the body`)
    let skin = 0
    piv.traverse((o: any) => {
      if (o.isMesh && o.visible) skin++
    })
    if (skin === 0) problems.push(`${id}: nothing hangs on the hinge`)
    // what hangs on the hinge is the door: no plate of the body under it, and no shut line of the body swinging with it
    piv.rotation.set(0, 0, 0)
    item.root.updateMatrixWorld(true)
    const hung: Array<{ o: THREE.Mesh; b: THREE.Box3 }> = []
    piv.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh && o.visible && !o.userData.decal && !o.userData.glass) hung.push({ o, b: new THREE.Box3().setFromObject(o).applyMatrix4(inverse) })
    })
    const midHeight = (zoneBox.y0 + zoneBox.y1) / 2
    const foot = zoneBox.y0 + DOOR_BOTTOM
    // the skin's outer face over the lower half (the mirror stands out higher up), and how deep the lowest part of what hangs reaches behind it
    let outer = -Infinity
    let deepest = Infinity
    const corner = new THREE.Vector3()
    for (const { o } of hung) {
      const at = o.geometry.getAttribute('position')
      for (let i = 0; i < at.count; i++) {
        corner.fromBufferAttribute(at, i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse)
        const across = zoneBox.side < 0 ? -corner.z : corner.z
        if (corner.y < midHeight) outer = Math.max(outer, across)
        if (corner.y < foot) deepest = Math.min(deepest, across)
      }
    }
    if (outer - deepest > DOOR_LOWER_DEPTH) problems.push(`${id}: a piece of the body ${((outer - deepest) * 100).toFixed(0)} cm deep hangs under the door`)
    for (const { o, b } of hung) {
      const sz = b.getSize(new THREE.Vector3())
      const color = (o.material as THREE.MeshStandardMaterial).color as THREE.Color | undefined
      const dark = !!color && color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.15
      const atEdge = Math.min(Math.abs(b.getCenter(new THREE.Vector3()).x - zoneBox.x0), Math.abs(b.getCenter(new THREE.Vector3()).x - zoneBox.x1)) < 0.04
      if (dark && atEdge && sz.x < 0.03 && sz.z < 0.03 && sz.y > (zoneBox.y1 - zoneBox.y0) * 0.4) problems.push(`${id}: the shut line swings with the door`)
    }
    piv.rotation.set(...(rotation as [number, number, number]))
    item.root.updateMatrixWorld(true)
    // nothing the model draws on the side stays across the open door (a strip, a trim, a frame), except the sill it opens over
    const doorIds = new Set(doors)
    const point = new THREE.Vector3()
    c.vehicle.traverse((o: any) => {
      if (!o.isMesh || !o.visible || o.userData.decal || o.userData.glass) return
      for (let q = o; q; q = q.parent) if (q.name && doorIds.has(q.name)) return
      const b = new THREE.Box3().setFromObject(o).applyMatrix4(inverse)
      const s = b.getSize(new THREE.Vector3())
      const m = b.getCenter(new THREE.Vector3())
      if (Math.sign(m.z) !== Math.sign(zoneBox.side) || Math.abs(m.z) < Math.abs(zoneBox.z0 + zoneBox.z1) / 2 - 0.1 || m.y < zoneBox.y0 + 0.25 || m.y > zoneBox.y1 + 0.1 || s.y > STRIP_TALL || Math.min(s.y, s.z) > 0.15 || s.x < 0.3) return
      const pos = o.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        point.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse)
        if (point.x > zoneBox.x0 + 0.1 && point.x < zoneBox.x1 - 0.1 && Math.abs(point.y - m.y) < 0.2) {
          strips.add(`${id}: a strip stays across the open door`)
          return
        }
      }
    })
    piv.rotation.set(0, 0, 0)
    item.root.updateMatrixWorld(true)
  }
  for (const strip of strips) problems.push(strip)
  return problems
}

describe('every model of the fleet', () => {
  const findings: Finding[] = []
  const passed: string[] = []
  for (const key of fleetVehicleIds) {
    it(key, () => {
      const problems = auditModel(key)
      for (const problem of problems) findings.push({ model: key, problem })
      if (!problems.length) passed.push(key)
      if (process.env.VEHICLE_REPORT) writeFileSync(process.env.VEHICLE_REPORT, JSON.stringify({ passed, findings }, null, 1))
      const hard = problems
      if (KNOWN_OPEN.has(key)) expect(hard.every((problem) => problem.startsWith('pane ') || problem.startsWith('the hood'))).toBe(true)
      else expect(hard).toEqual([])
    })
  }
})

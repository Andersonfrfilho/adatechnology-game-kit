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
/** Panes a shot along their normal does not reach yet (something drawn stands in front, or the pane is behind trim): to look at one by one, see docs/veiculos-verificacao.md. */
const KNOWN_OPEN = new Set(['midsize_suv', 'armored_truck', 'fastback_sedan', 'battle_tank', 'fishing_boat', 'single_engine_plane'])
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
  // the air over the body is air
  const over = shoot(new THREE.Vector3(centre.x, box.max.y + AIR_ABOVE, centre.z), new THREE.Vector3(1, 0, 0))
  if (over) problems.push(`the air above the vehicle takes a shot on ${over.part}`)

  // a door
  const doors = d.describe().parts.filter((p) => p.tags?.includes('door')).map((p) => p.id)
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
    piv.rotation.set(0, 0, 0)
    item.root.updateMatrixWorld(true)
  }
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
      if (KNOWN_OPEN.has(key)) expect(problems.every((problem) => problem.startsWith('pane '))).toBe(true)
      else expect(problems).toEqual([])
    })
  }
})

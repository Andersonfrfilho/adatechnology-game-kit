import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { makeKit } from './helpers/kit'
import { cutStripOverDoor, isDoorSeam, splitDoorSkin } from '../src/destructible/door-open'
import type { StripCutKit } from '../src/destructible/door-open'

/** A belt strip drawn as a box with one segment along its length: every triangle runs from one end of the car to the other. */
function beltStrip(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.01, 0.01), new THREE.MeshStandardMaterial())
  mesh.position.set(-0.05, 1.01, -0.76)
  mesh.updateMatrixWorld(true)
  return mesh
}

function xsOf(mesh: THREE.Mesh): number[] {
  const pos = mesh.geometry.getAttribute('position')
  const v = new THREE.Vector3()
  const xs: number[] = []
  for (let i = 0; i < pos.count; i++) xs.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).x)
  return xs
}

describe('a strip over two doors', () => {
  it('is cut at the edges of each door, whatever the length of its triangles', () => {
    const kit = makeKit() as unknown as StripCutKit
    const strip = beltStrip()
    const doors = [
      [0.33, 1.66],
      [-0.72, 0.35],
    ] as const
    const overs = doors.map(([x0, x1]) => cutStripOverDoor(kit, { strip, toVehicle: strip.matrixWorld, x0, x1 }))
    const left = xsOf(strip)
    // nothing of the body's strip is left over either door
    expect(left.filter((x) => x > -0.72 + 1e-4 && x < 1.66 - 1e-4)).toEqual([])
    expect(Math.min(...left)).toBeCloseTo(-2.35, 5)
    expect(Math.max(...left)).toBeCloseTo(2.25, 5)
    // what goes with the front door runs from its rear edge to its front edge, and the rear door takes what was still on the body over it
    overs.forEach((over) => over.matrixWorld.copy(strip.matrixWorld))
    expect(Math.min(...xsOf(overs[0]!))).toBeCloseTo(0.33, 4)
    expect(Math.max(...xsOf(overs[0]!))).toBeCloseTo(1.66, 4)
    expect(Math.min(...xsOf(overs[1]!))).toBeCloseTo(-0.72, 4)
    expect(Math.max(...xsOf(overs[1]!))).toBeCloseTo(0.33, 4)
  })
})

describe('the skin a door takes', () => {
  it('leaves the wheel house behind the door on the body and keeps its skin and its sill', () => {
    const material = new THREE.MeshStandardMaterial()
    const skin = new THREE.PlaneGeometry(0.7, 0.8, 4, 4).toNonIndexed()
    skin.translate(-0.88, 0.62, 0)
    const outer = new THREE.Mesh(skin, material)
    outer.position.z = -0.88
    // the wall of the wheel house, 25 cm inside, facing along the car
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3).rotateY(Math.PI / 2).translate(-1.15, 0.45, -0.62).toNonIndexed(), material)
    // the door's sill along its top, turned up, reaching 15 cm in
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.15).rotateX(-Math.PI / 2).translate(-0.88, 1.0, -0.8).toNonIndexed(), material)
    for (const mesh of [outer, wall, sill]) mesh.updateMatrixWorld(true)
    const [a, b, c] = splitDoorSkin(THREE, [outer, wall, sill], (mesh) => mesh.matrixWorld, -1, 0.09)
    expect(a!.deep).toBeNull()
    expect(a!.skin!.getAttribute('position').count).toBe(skin.getAttribute('position').count)
    expect(b!.skin).toBeNull()
    expect(b!.deep!.getAttribute('position').count).toBe(6)
    expect(c!.deep).toBeNull()
  })
})

describe('the shut line between two doors', () => {
  const zone = { x0: -1.28, x1: -0.48, y0: 0.14, y1: 1.01 }
  it('is the thin dark groove at a door edge, not the door trim', () => {
    const at = (x: number, w: number, h: number) => new THREE.Box3(new THREE.Vector3(x - w / 2, 0.35, -0.86), new THREE.Vector3(x + w / 2, 0.35 + h, -0.854))
    expect(isDoorSeam(THREE, { box: at(-0.48, 0.012, 0.6), zone, side: -1, dark: true })).toBe(true)
    expect(isDoorSeam(THREE, { box: at(-0.48, 0.012, 0.6), zone, side: 1, dark: true })).toBe(false)
    expect(isDoorSeam(THREE, { box: at(-0.48, 0.012, 0.6), zone, side: -1, dark: false })).toBe(false)
    expect(isDoorSeam(THREE, { box: at(-0.88, 0.012, 0.6), zone, side: -1, dark: true })).toBe(false)
    expect(isDoorSeam(THREE, { box: at(-0.48, 0.13, 0.035), zone, side: -1, dark: true })).toBe(false)
  })
})

import { breachOf, coverBodyOf, generateNetworks, pipePiecesOf, surfacePiecesOf } from '@adatechnology/game-urban/networks'
import type { CityPlanInput } from '@adatechnology/game-urban'
import type { NetworkLot } from '@adatechnology/game-urban/networks'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createUrbanThree } from '../src'
import { partsOf } from '../src/networks/surface-parts'
import { fakeDocument } from './fake-dom'

const PLAN: CityPlanInput = {
  id: 'surface_cut',
  scale: 'town',
  size: [240, 240],
  districts: [{ id: 'periphery', kind: 'residential_popular', rect: [-120, -120, 120, 120] }],
  lines: [
    { id: 'main_street', kind: 'street', width: 10, points: [[-110, 0], [110, 0]] },
    { id: 'side_street', kind: 'street', width: 10, points: [[60, 0], [60, 110]] },
  ],
}
const LOTS: readonly NetworkLot[] = [10, 22, 34].flatMap((x) => [{ id: `north_${x}`, rect: [x, -32.5, x + 12, -7.5] as const }, { id: `south_${x}`, rect: [x, 7.5, x + 12, 32.5] as const }])
const { networks } = generateNetworks({ plan: PLAN, lots: LOTS, seed: 5 })
const urban = createUrbanThree(THREE, { document: fakeDocument })

describe('the surface of the buried networks, drawn', () => {
  const pieces = surfacePiecesOf(networks)

  it('draws every piece in two draw calls and lists them', () => {
    const drawn = urban.drawNetworkSurface(networks)
    expect(drawn.pieces).toEqual(pieces)
    expect(drawn.drawCalls()).toBe(2)
    const counts = Object.fromEntries(drawn.root.children.map((mesh) => [mesh.name, (mesh as THREE.InstancedMesh).count]))
    const expected = pieces.flatMap((piece) => partsOf(piece))
    expect(counts['network:surface:boxes']).toBe(expected.filter((part) => part.shape === 'box').length)
    expect(counts['network:surface:cylinders']).toBe(expected.filter((part) => part.shape === 'cylinder').length)
    drawn.dispose()
  })

  it('lays the covers flush: the highest part of a cover or grate is under 1.5 cm over the road, and walked on', () => {
    for (const piece of pieces.filter((entry) => !entry.solid)) {
      const top = Math.max(...partsOf(piece).map((part) => part.centre[1] + (part.shape === 'box' ? part.size[1] : part.size[1]) / 2))
      expect(top, piece.id).toBeGreaterThan(0)
      expect(top, piece.id).toBeLessThan(0.015)
    }
  })

  it('stands the hydrant 0.8 m tall and the wing wall above the bank', () => {
    const hydrant = pieces.find((piece) => piece.kind === 'hydrant')!
    expect(Math.max(...partsOf(hydrant).map((part) => part.centre[1] + part.size[1] / 2))).toBeCloseTo(0.77, 2)
    const wall = pieces.find((piece) => piece.kind === 'wing_wall')
    if (wall !== undefined) expect(Math.max(...partsOf(wall).map((part) => part.centre[1] + part.size[1] / 2))).toBeCloseTo(0.8, 2)
  })

  it('hides a piece thrown off by a blast, and only that one', () => {
    const drawn = urban.drawNetworkSurface(networks)
    const boxes = drawn.root.children.find((mesh) => mesh.name === 'network:surface:boxes') as THREE.InstancedMesh
    const before = Array.from(boxes.instanceMatrix.array.slice())
    const grate = pieces.find((piece) => piece.kind === 'inlet_grate')!
    drawn.remove(grate.id)
    const after = Array.from(boxes.instanceMatrix.array)
    const changed = after.filter((value, index) => value !== before[index]).length
    expect(changed).toBeGreaterThan(0)
    expect(changed).toBeLessThan(after.length / 2)
    drawn.dispose()
  })

  it('puts a piece taken off back exactly where it was', () => {
    const drawn = urban.drawNetworkSurface(networks)
    const meshes = drawn.root.children as THREE.InstancedMesh[]
    const before = meshes.map((mesh) => Array.from(mesh.instanceMatrix.array))
    const cover = pieces.find((piece) => piece.kind === 'manhole_cover')!
    drawn.remove(cover.id)
    expect(meshes.map((mesh) => Array.from(mesh.instanceMatrix.array))).not.toEqual(before)
    drawn.restore(cover.id)
    expect(meshes.map((mesh) => Array.from(mesh.instanceMatrix.array))).toEqual(before)
    drawn.dispose()
  })

  it('leaves the scene when disposed', () => {
    const parent = new THREE.Group()
    const drawn = urban.drawNetworkSurface(networks)
    parent.add(drawn.root)
    drawn.dispose()
    expect(parent.children.length).toBe(0)
  })
})

describe('the pipes and pits under the street, drawn', () => {
  it('draws two halves of every pipe and a pit under every cover that has one, in three draw calls', () => {
    const drawn = urban.drawBuriedNetworks(networks)
    expect(drawn.drawCalls()).toBe(3)
    const pipes = drawn.root.children.find((mesh) => mesh.name === 'network:buried:pipes') as THREE.InstancedMesh
    expect(pipes.count).toBe(pipePiecesOf(networks).length * 2)
    const pits = surfacePiecesOf(networks).filter((piece) => piece.shaft !== undefined).length
    const shafts = ['network:buried:shafts', 'network:buried:boxes'].map((name) => (drawn.root.children.find((mesh) => mesh.name === name) as THREE.InstancedMesh).count)
    expect(shafts[0]! + shafts[1]!).toBe(pits)
    drawn.dispose()
  })

  it('lays every pipe under the ground it was laid under: no part of a pipe or pit pokes above the road', () => {
    const drawn = urban.drawBuriedNetworks(networks)
    const pipes = drawn.root.children.find((mesh) => mesh.name === 'network:buried:pipes') as THREE.InstancedMesh
    const matrix = new THREE.Matrix4()
    const box = new THREE.Box3()
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 8)
    geometry.computeBoundingBox()
    for (let slot = 0; slot < pipes.count; slot++) {
      pipes.getMatrixAt(slot, matrix)
      if (new THREE.Vector3().setFromMatrixScale(matrix).y === 0) continue
      expect(box.copy(geometry.boundingBox!).applyMatrix4(matrix).max.y, `pipe slot ${slot}`).toBeLessThan(0)
    }
    drawn.dispose()
  })

  it('breaks a pipe at the point of a crater: its halves stop short of the break', () => {
    const drawn = urban.drawBuriedNetworks(networks)
    const pipes = drawn.root.children.find((mesh) => mesh.name === 'network:buried:pipes') as THREE.InstancedMesh
    const pipe = drawn.pipes.find((entry) => entry.kind === 'water_main' && Math.hypot(entry.to[0] - entry.from[0], entry.to[2] - entry.from[2]) > 10)!
    const slot = drawn.pipes.indexOf(pipe) * 2
    const lengthOf = (index: number): number => {
      const matrix = new THREE.Matrix4()
      pipes.getMatrixAt(index, matrix)
      return new THREE.Vector3().setFromMatrixScale(matrix).y
    }
    const whole = lengthOf(slot) + lengthOf(slot + 1)
    drawn.sever(pipe.id, 0.5)
    expect(whole - (lengthOf(slot) + lengthOf(slot + 1))).toBeCloseTo(1.2, 2)
    drawn.dispose()
  })

  it('joins a broken pipe again', () => {
    const drawn = urban.drawBuriedNetworks(networks)
    const pipes = drawn.root.children.find((mesh) => mesh.name === 'network:buried:pipes') as THREE.InstancedMesh
    const before = Array.from(pipes.instanceMatrix.array)
    const pipe = drawn.pipes.find((entry) => entry.kind === 'water_main')!
    drawn.sever(pipe.id, 0.5)
    expect(Array.from(pipes.instanceMatrix.array)).not.toEqual(before)
    drawn.mend(pipe.id)
    expect(Array.from(pipes.instanceMatrix.array)).toEqual(before)
    drawn.dispose()
  })

  it('is what a crater reaches: the pipes breachOf names are the ones drawn', () => {
    const drawn = urban.drawBuriedNetworks(networks)
    const surface = surfacePiecesOf(networks)
    const result = breachOf({ pipes: drawn.pipes, surface }, { x: 30, z: 0, radius: 6, depth: 6 })
    expect(result.pipes.length).toBeGreaterThan(0)
    for (const reached of result.pipes) expect(drawn.pipes.some((pipe) => pipe.id === reached.id)).toBe(true)
    drawn.dispose()
  })
})

describe('the lid of a thrown cover, drawn', () => {
  const covers = surfacePiecesOf(networks).filter((piece) => piece.kind === 'manhole_cover' || piece.kind === 'inspection_cover' || piece.kind === 'inlet_grate')

  it('stands where the cast iron plate of the destruction world does: its foot at the origin and its plate as thick as the body says', () => {
    expect(covers.length).toBeGreaterThan(3)
    for (const piece of covers) {
      const lid = urban.drawCoverLid(piece)
      const box = new THREE.Box3().setFromObject(lid.root)
      const part = coverBodyOf(piece)!.spec.parts[0]!
      expect(box.min.y, piece.id).toBeCloseTo(0, 6)
      const plate = part.shape.kind === 'cylinder' ? part.shape.height : part.shape.kind === 'box' ? part.shape.size[1] : 0
      expect(box.max.y, piece.id).toBeGreaterThanOrEqual(plate - 1e-9)
      expect(box.max.y, piece.id).toBeLessThan(plate + 0.02)
      lid.dispose()
    }
  })

  it('leaves the scene when disposed', () => {
    const parent = new THREE.Group()
    const lid = urban.drawCoverLid(covers[0]!)
    parent.add(lid.root)
    lid.dispose()
    expect(parent.children.length).toBe(0)
  })
})

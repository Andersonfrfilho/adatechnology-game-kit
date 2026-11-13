import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { StaticSolid } from '../src/engine-pieces'
import { fitOrientedBoxes } from '../src/oriented-boxes'
import { PieceSystem } from '../src/pieces'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

/** A 4 x 3 m sheet pitched 30 degrees, drawn as a range of a merged mesh (the house's roof mesh): its vertices are in the house's space, the mesh itself square. */
const roofSheet = (): THREE.BufferGeometry => new THREE.PlaneGeometry(4, 3, 4, 4).rotateX(-Math.PI / 2).rotateX(Math.PI / 6).translate(0, 2, 0)

const pointsOf = (g: THREE.BufferGeometry): number[] => Array.from(g.getAttribute('position').array as ArrayLike<number>)

describe('a piece collides as it is drawn, not as the box around it', () => {
  it('fits a tilted sheet as one thin plate, and a gable (two slopes) as two', () => {
    const sheet = fitOrientedBoxes(pointsOf(roofSheet()))
    expect(sheet.length).toBe(1)
    expect([...sheet[0]!.half].sort((a, b) => a - b)).toEqual([expect.closeTo(0.01, 3), expect.closeTo(1.5, 3), expect.closeTo(2, 3)])
    const left = new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 6).translate(-0.87, 0.5, 0)
    const right = new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(-Math.PI / 6).translate(0.87, 0.5, 0)
    const gable = fitOrientedBoxes([...pointsOf(left), ...pointsOf(right)])
    expect(gable.length).toBe(2)
    for (const b of gable) expect(Math.min(...b.half)).toBeLessThan(0.02)
  })

  it('a 3 kg roof sheet made a piece pitched 30 degrees falls flat on the ground, not onto the 1.5 m tall box around it', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), eventBudgetMs: Infinity })
    world.addObject('roof', [partState('sheet', 'steel', { mass: 3 })])
    const geo = roofSheet()
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('roof', root, { parts: { sheet: { mesh, range: [0, geo.getAttribute('position').count] } } })
    renderer.makePiece('roof')
    for (let t = 0; t < 4; t += 1 / 60) renderer.update(1 / 60)
    // the highest point of the sheet as drawn
    root.updateMatrixWorld(true)
    const top = new THREE.Box3().setFromObject(root, true).max.y
    expect(top).toBeLessThan(0.15)
  })

  it('a piece made 15 cm inside a fixed shelf is out of it in the update it is made, on its top, and does not rise after', () => {
    const shelf: StaticSolid[] = [{ center: [0, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] }]
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), staticSolids: () => new Map([['shelf', shelf]]) })
    const root = new THREE.Object3D()
    // its bottom at 0.85, the shelf's top at 1
    root.position.set(0.1, 0.95, 0)
    system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    system.update(1 / 60)
    expect(root.position.y).toBeGreaterThan(1.09)
    let highest = root.position.y
    for (let i = 0; i < 120; i++) {
      system.update(1 / 60)
      highest = Math.max(highest, root.position.y)
    }
    expect(highest - 1.1).toBeLessThan(0.01)
    expect(root.position.y).toBeCloseTo(1.1, 2)
  })
})

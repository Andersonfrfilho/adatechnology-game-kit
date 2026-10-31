import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'
import { exactSnapshot } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { buildSpecimenMeshes, DEFAULT_SPECIMENS, specimenSpec } from '../src/test-area/specimens'
import { fakeDocument } from './helpers/fake-document'
import { THREE, TEMPLATES, houseOf, planOf } from './helpers/houses'

/**
 * Every bit of the houses: the seven templates of the Visor in both qualities and two seeds, at night, cut, one mesh per piece, without terrain
 * and perimeter, a building floor, the abandoned and fortified states, a breached wall and a spalled slab (the destruction renderer's scene too), and the
 * test area's specimens. Recorded on the old path (three's own geometry constructors) before the move to game-shapes, so the move cannot change
 * a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-floorplan.json')

type Root = { traverse(f: (o: unknown) => void): void }
const cases: Array<[string, () => Root]> = []
const house = (template: string, seed: number, build: Record<string, unknown> = {}, state = 'normal'): Root => houseOf(planOf(template, seed, state), {}, build as never).house.group
for (const template of Object.keys(TEMPLATES))
  for (const seed of [1, 3])
    for (const quality of ['high', 'game'] as const) cases.push([`house/${template}:${seed}:${quality}`, () => house(template, seed, { quality })])
cases.push(['house/casaA:3:night', () => house('casaA', 3, { night: true })])
cases.push(['house/sobrado:3:cut', () => house('sobrado', 3, { cut: true })])
cases.push(['house/sobrado:3:pieces', () => house('sobrado', 3, { pieces: 'meshes' })])
cases.push(['house/casaA:1:bare', () => house('casaA', 1, { terrain: false, noPerimeter: true, quality: 'game' })])
cases.push(['house/apartamento:1:floor2', () => house('apartamento', 1, { building: { floors: 4, floor: 2, unit: 1, showBuilding: true } })])

const destroyed = (hit: (s: { world: any; d: any; centre: (id: string) => number[] }) => void): Root => {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { scene, world, eventBudgetMs: Infinity })
  const { house: built } = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
  scene.add(built.group)
  const d = built.destruction
  d.activate()
  const centre = (id: string): number[] => {
    const p = built.structure.byId.get(id)
    return [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2]
  }
  hit({ world, d, centre })
  for (let t = 0; t < 1; t += 0.05) {
    world.update(0.05)
    renderer.update(0.05)
  }
  return scene
}
cases.push(['destruction/breach', () => destroyed(({ world, d, centre }) => world.hitPart(d.id, 'wall_0_0', { type: 'blunt', point: centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' }))])
cases.push(['destruction/spall', () => destroyed(({ world, d }) => world.hitPart(d.id, 'slab_1_p0', { type: 'explosive', point: d.spec.parts.find((p: any) => p.id === 'slab_1_p0').position, energy: 4e5, radius: 1.5 }))])
cases.push(['destruction/fracture', () => destroyed(({ world, d, centre }) => world.hitPart(d.id, 'wall_0_0', { type: 'explosive', point: centre('wall_0_0'), energy: 2e6, radius: 2.5, source: 'test' }))])
// the specimens include rural typologies: their pack is registered when the first specimen is drawn (after the houses)
let rural = false
for (const def of DEFAULT_SPECIMENS) cases.push([`specimen/${def.id}`, () => (rural || (registerRural(engine), (rural = true)), buildSpecimenMeshes(THREE, specimenSpec(THREE, engine as never, def, { document: fakeDocument }).spec))])
// last: registering the post-apocalyptic pack also gives the engine a seeded distribution of states for plans drawn without one
let apocalypse = false
const postApocalyptic = (state: string): Root => {
  if (!apocalypse) registerPostApocalyptic(engine)
  apocalypse = true
  return house('casaA', 3, {}, state)
}
for (const state of ['abandoned', 'fortified']) cases.push([`house/casaA:3:${state}`, () => postApocalyptic(state)])

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the houses, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 1800000)
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    expect({ hash: snapshot.hash, objects: snapshot.nodes.length }).toEqual(recorded[id])
  })
})

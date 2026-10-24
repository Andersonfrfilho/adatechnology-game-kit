import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { visualStateOf } from '@adatechnology/game-animals'
import { SPECIES } from '@adatechnology/game-animals-species'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createAnimalsThree, lineUpAnimals } from '../src'
import type { AnimalRig } from '../src'
import { createStream } from '../src/context'

import { snapshotOf, stubDocument } from './helpers'

type Fixture = {
  events: { type: string; data: Record<string, unknown> }[]
  scenes: Record<string, { objects: number; hash: string; lines: string[] }>
}
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/team-golden/animals-page.json', import.meta.url)), 'utf8')) as Fixture

// The page draws 7369 numbers of its seeded stream (`rng(7)`) for the yard, the grass and the fence before it builds the first animal; each animal then
// takes one for its start phase. The count was found by matching the dog's phase, and with it all 13 alive scenes match.
const SCENERY_DRAWS = 7369
const CLIPS = ['walk', 'trot', 'gallop']

// The page runs three r128, which keeps colours as the raw numbers it is given; r160 converts them to linear and back. With the colour management off the
// same arithmetic (the infected tint is a lerp) gives the same numbers.
let managed = true
beforeAll(() => {
  managed = THREE.ColorManagement.enabled
  THREE.ColorManagement.enabled = false
})
afterAll(() => {
  THREE.ColorManagement.enabled = managed
})

const buildPage = (): { rigs: AnimalRig[]; kit: ReturnType<typeof createAnimalsThree>; scene: THREE.Scene } => {
  const stream = createStream(7)
  for (let draw = 0; draw < SCENERY_DRAWS; draw++) stream()
  const kit = createAnimalsThree(THREE, { document: stubDocument(), random: stream })
  const scene = new THREE.Scene()
  const rigs = SPECIES.map((species) => kit.build(species))
  lineUpAnimals(rigs)
  for (const rig of rigs) scene.add(rig.root)
  // the page ran one frame at load, with the clock at zero: every animal took one step of the walk clip with no time
  for (const rig of rigs) kit.animate(rig, { time: 0, delta: 0, clip: 'walk' })
  return { rigs, kit, scene }
}

const stateOf = (rig: AnimalRig): Record<string, unknown> => ({
  species: rig.species.id,
  infected: rig.infected,
  dead: rig.dead,
  earsVisible: rig.ears.length === 0 ? true : (rig.ears[0] as THREE.Object3D).visible,
  poolVisible: rig.pool ? rig.pool.visible : false,
  triangles: rig.triangles,
})

describe('G-animals: the 13 species against the Bichos do Vale page', () => {
  it('has the dog node by node, with position, rotation, scale, geometry and colour', () => {
    const { rigs } = buildPage()
    const dog = rigs.find((rig) => rig.species.id === 'dog') as AnimalRig
    expect(snapshotOf(dog.root).lines).toEqual(fixture.scenes.dog_alive?.lines)
  })

  it('goes through alive, bitten, healed and the three clips of every species with the page hashes and flags', () => {
    const { rigs, kit } = buildPage()
    const events: { type: string; data: Record<string, unknown> }[] = []
    const hashes: Record<string, { objects: number; hash: string }> = {}
    const snapshot = (label: string, rig: AnimalRig): void => {
      const taken = snapshotOf(rig.root)
      hashes[label] = { objects: taken.objects, hash: taken.hash }
    }
    for (const rig of rigs) {
      const id = rig.species.id
      snapshot(`${id}_alive`, rig)
      events.push({ type: 'alive', data: stateOf(rig) })
      kit.setVisualState(rig, visualStateOf(rig.species.outcome, true))
      snapshot(`${id}_bitten`, rig)
      events.push({ type: 'bitten', data: stateOf(rig) })
      kit.setVisualState(rig, 'alive')
      events.push({ type: 'healed', data: stateOf(rig) })
      for (const clip of CLIPS) {
        kit.animate(rig, { time: 0.5, delta: 1 / 60, clip })
        snapshot(`${id}_${clip}`, rig)
      }
    }
    // the capture listed the animals in the order of the page's SPECIES array and the SDK builds them in the page's ORDER (the cow first): compare per species
    const bySpecies = (list: { type: string; data: Record<string, unknown> }[]): typeof list => [...list].sort((a, b) => String(a.data.species).localeCompare(String(b.data.species)))
    expect(bySpecies(events)).toEqual(bySpecies(fixture.events))
    const expected = Object.fromEntries(Object.entries(fixture.scenes).map(([label, scene]) => [label, { objects: scene.objects, hash: scene.hash }]))
    expect(hashes).toEqual(expected)
  })
})

describe('the dead look for every species', () => {
  it('lies the body down and shows the pool, for the species that do not die of the infection too', () => {
    const { rigs, kit, scene } = buildPage()
    for (const rig of rigs) {
      kit.setVisualState(rig, 'dead')
      expect(rig.dead).toBe(true)
      expect(rig.pool?.visible).toBe(true)
      expect(rig.pool?.parent).toBe(scene)
      for (let step = 0; step < 90; step++) kit.animate(rig, { time: step / 60, delta: 1 / 60, clip: 'walk' })
      if (rig.species.body.kind === 'quadruped') expect(rig.root.rotation.z).toBeGreaterThan(1.4)
      kit.setVisualState(rig, 'alive')
      expect(rig.pool?.visible).toBe(false)
      expect(rig.root.rotation.z).toBe(0)
    }
  })

  it('keeps the species that turn infected and the ones that die dead, by outcome', () => {
    expect(visualStateOf('dies', true)).toBe('dead')
    expect(visualStateOf('turns', true)).toBe('infected')
  })
})

describe('views', () => {
  it('shows the joints see-through and moves the pivots apart in the split view', () => {
    const { rigs, kit } = buildPage()
    const cow = rigs.find((rig) => rig.species.id === 'cow') as AnimalRig
    kit.setJointView(cow, true)
    expect(cow.materials.some((material) => material.transparent && material.opacity === 0.28)).toBe(true)
    expect(cow.joints.every((joint) => joint.material === kit.jointMaterial)).toBe(true)
    kit.setJointView(cow, false)
    expect(cow.joints.every((joint) => joint.material !== kit.jointMaterial)).toBe(true)
    const pivot = cow.pivots[1]
    expect(pivot).toBeDefined()
    const rest = (pivot as NonNullable<typeof pivot>).group.position.clone()
    kit.setSplit(cow, true)
    for (let step = 0; step < 120; step++) kit.updateSplit(cow, 1 / 60)
    expect((pivot as NonNullable<typeof pivot>).group.position.distanceTo(rest)).toBeGreaterThan(0.01)
    kit.setSplit(cow, false)
    for (let step = 0; step < 240; step++) kit.updateSplit(cow, 1 / 60)
    expect((pivot as NonNullable<typeof pivot>).group.position.distanceTo(rest)).toBeLessThan(0.001)
  })

  it('needs a document only for the species with a coat texture', () => {
    const kit = createAnimalsThree(THREE, { random: createStream(1) })
    const noDocument = (globalThis as { document?: unknown }).document
    if (noDocument === undefined) {
      expect(() => kit.build(SPECIES.find((species) => species.id === 'cat') as never)).toThrow(/document/)
      expect(kit.build(SPECIES.find((species) => species.id === 'dog') as never).root).toBeDefined()
    }
  })
})

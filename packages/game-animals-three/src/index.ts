/**
 * @adatechnology/game-animals-three: the three.js drawing of the animals, a literal port of the Bichos do Vale builders (`quad`, `bird`, `snake`) and
 * their animation, with the alive / infected / dead looks for every species, the joints and split views, and a GPU node skin for crowds.
 */
import { GAIT_PHASES } from '@adatechnology/game-animals'
import type { AnimalSpecies, AnimalVisualState, GaitPhases } from '@adatechnology/game-animals'
import { collectReferencedNodes, createNodeSkin } from '@adatechnology/game-props3d'
import type { NodeSkin } from '@adatechnology/game-props3d'
import type * as THREE_NS from 'three'

import { animateBird } from './animate-bird'
import { animateQuadruped } from './animate-quadruped'
import { animateSnake } from './animate-snake'
import type { AnimateParams } from './animate-types'
import { buildBird } from './bird'
import { createRig, createStream } from './context'
import { BIRD_EXTRAS, QUADRUPED_EXTRAS } from './extras'
import { buildQuadruped } from './quadruped'
import { buildSnake } from './snake'
import type { AnimalRig, AnimalsThreeOptions, DocumentLike, Three } from './types'
import { applyVisualState } from './visual-state'
import { setJointView, setSplit, updateSplit } from './views'

export type { AnimalLeg, AnimalPivot, AnimalRig, AnimalWing, AnimalsThreeOptions, CanvasLike, DocumentLike, Three } from './types'
export type { AnimateParams } from './animate-types'
export type { BirdExtra, BirdParts, ExtraContext, QuadrupedExtra, QuadrupedParts } from './extras'
export { BIRD_EXTRAS, QUADRUPED_EXTRAS } from './extras'
export { lineUpAnimals } from './line-up'
export type { LineUpOptions } from './line-up'
export { profileGeometry } from './profile'
export { createCoatTexture } from './textures'
export { applyVisualState } from './visual-state'
export { setJointView, setSplit, updateSplit } from './views'

export type AnimalsThree = {
  /** Builds one animal from its species; consumes one number of the stream for the start phase unless `phase` is given. */
  build(species: AnimalSpecies, buildOptions?: { readonly phase?: number }): AnimalRig
  /** Advances the animation of one animal (steps, flight, wings, head, tail, a dead one lying down). */
  animate(rig: AnimalRig, params: AnimateParams): void
  setVisualState(rig: AnimalRig, state: AnimalVisualState): void
  setJointView(rig: AnimalRig, on: boolean): void
  setSplit(rig: AnimalRig, on: boolean): void
  updateSplit(rig: AnimalRig, delta: number): void
  /** One mesh that stands for the whole tree, for crowds: call `skin.update()` each frame after `animate`. */
  createSkin(rig: AnimalRig): NodeSkin
  readonly jointMaterial: THREE_NS.MeshStandardMaterial
}

const countTriangles = (root: THREE_NS.Object3D): number => {
  let triangles = 0
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry
    triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
  })
  return Math.round(triangles)
}

export const createAnimalsThree = (THREE: Three, options: AnimalsThreeOptions = {}): AnimalsThree => {
  const random = options.random ?? createStream(options.seed ?? 7)
  const documentOf = (): DocumentLike => {
    const found = options.document ?? (globalThis as { document?: DocumentLike }).document
    if (!found) throw new Error('game-animals-three: a species with a coat texture needs `options.document` (no global document found)')
    return found
  }
  const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xe0a548, emissive: 0xe0a548, emissiveIntensity: 0.8, roughness: 0.4 })
  const gaits: Readonly<Record<'walk' | 'trot' | 'gallop', GaitPhases>> = GAIT_PHASES

  return {
    jointMaterial,
    build(species, buildOptions = {}) {
      const rig = createRig(THREE, species, { phase: buildOptions.phase ?? random() * 6 })
      if (species.body.kind === 'snake') buildSnake(THREE, rig)
      else if (species.body.kind === 'bird') buildBird(THREE, rig, { extra: BIRD_EXTRAS[species.id] })
      else buildQuadruped(THREE, rig, { document: species.body.texture ? documentOf() : (undefined as never), extra: QUADRUPED_EXTRAS[species.id] })
      rig.triangles = countTriangles(rig.root)
      rig.root.traverse((object) => {
        if ((object as THREE_NS.Mesh).isMesh) object.userData.speciesId = species.id
      })
      return rig
    },
    animate(rig, params) {
      const kind = rig.species.body.kind
      if (kind === 'snake') animateSnake(THREE, rig, params)
      else if (kind === 'bird') animateBird(rig, params)
      else animateQuadruped(rig, params, gaits)
    },
    setVisualState: (rig, state) => applyVisualState(THREE, rig, state),
    setJointView: (rig, on) => setJointView(rig, on, jointMaterial),
    setSplit,
    updateSplit,
    createSkin: (rig) => createNodeSkin(THREE, rig.root, { nodes: collectReferencedNodes(rig, ['species']) }),
  }
}
export { createAnimalsTestModule, ANIMALS_AREA_ID, ANIMAL_ITEM_PREFIX } from './test-area/module'
export type { AnimalsContext } from './test-area/scenarios'
export type { AnimalsTestOptions, OutbreakLike } from './test-area/types'

import type * as THREE from 'three'
import type { ModelKit } from './kit'
import type { ModelOptions, ModelParts } from './types'

/** What the pieces of a rifle share: the dimensions the page derives once and the finish of the furniture. */
export interface RifleContext {
  kit: ModelKit
  group: THREE.Group
  parts: ModelParts
  options: ModelOptions
  furniture: THREE.Material
  /** A one-piece wooden stock (`trad`, `straight`). */
  isTraditional: boolean
  /** Total and barrel length, stock length, receiver start and end (x), receiver height and width, barrel radius, barrel height, receiver length. */
  length: number
  barrelLength: number
  stockLength: number
  receiverStart: number
  receiverEnd: number
  receiverHeight: number
  receiverWidth: number
  barrelRadius: number
  barrelY: number
  receiverLength: number
}

import { readFileSync } from 'node:fs'

import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'

export type TextureMarker = { readonly kind: 'spots' | 'stripes'; readonly base: string; readonly [key: string]: unknown }

export type AnimalSpecies = {
  readonly id: string
  readonly nome: string
  readonly sub: string
  readonly sci: string
  readonly grupo: string
  readonly fase: string
  readonly inf: string
  readonly onde: string
  readonly papel: string
  readonly cuidado: string
  readonly rende: string
  readonly som: string
}

/** The body spec of a species: `q` (quadruped), `b` (bird) or `snake`, plus the step frequencies; `extra` is the builder closure the page keeps. */
export type AnimalSpec = {
  readonly q?: Readonly<Record<string, unknown>>
  readonly b?: Readonly<Record<string, unknown>>
  readonly snake?: number
  readonly walkHz: number
  readonly runHz: number
  readonly gallop?: boolean
}

export type AnimalsData = {
  readonly species: readonly AnimalSpecies[]
  readonly specs: Readonly<Record<string, AnimalSpec>>
  readonly gaits: Readonly<Record<string, readonly number[]>>
  readonly order: readonly string[]
  readonly zones: Readonly<Record<string, readonly unknown[]>>
  readonly terrain: Readonly<Record<string, unknown>>
  readonly groupColors: Readonly<Record<string, string>>
  readonly visibleText: string
}

const textures = {
  spotsTex: (base: string, spot: string): TextureMarker => ({ kind: 'spots', base, spot }),
  stripeTex: (base: string, stripe: string): TextureMarker => ({ kind: 'stripes', base, stripe }),
  add: () => undefined,
  THREE: {},
  PI: Math.PI,
}

export const extractAnimals = (): AnimalsData => {
  const source = readFileSync(SOURCE_PATHS.animals, 'utf8')
  return {
    species: extractLiteral(source, 'SPECIES'),
    specs: extractLiteral(source, 'SPEC', textures),
    gaits: extractLiteral(source, 'GAIT', { PI: Math.PI }),
    order: extractLiteral(source, 'ORDER'),
    zones: extractLiteral(source, 'ZONES'),
    terrain: extractLiteral(source, 'TER'),
    groupColors: extractLiteral(source, 'GCOL'),
    visibleText: source.split('\n')[1] ?? '',
  }
}

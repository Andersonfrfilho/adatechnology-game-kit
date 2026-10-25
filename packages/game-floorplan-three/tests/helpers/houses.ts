import { engine } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerStructure } from '@adatechnology/game-floorplan-structure'
import * as THREE from 'three'

import { create } from '../../src'
import type { BuildOptions, House, HouseRendererOptions } from '../../src'
import { fakeDocument } from './fake-document'

let registered = false
function registerPacks(): void {
  if (registered) return
  registerResidential(engine)
  registerCommercial(engine)
  registerStructure(engine)
  registered = true
}

/** The team's template ids of the Visor de casas 3D and the ids of this engine (the id map of the migration). */
export const TEMPLATES: Record<string, string> = {
  casaA: 'single_storey_a',
  apartamento: 'apartment_basic',
  sobrado: 'townhouse',
  media_terrea_moderna: 'mid_modern_single_storey',
  apartamento_novo: 'apartment_modern',
  mercado: 'market',
  farmacia: 'pharmacy',
}

/** A plan of the engine (the structure pack registered) for one of the team's template names. */
export function planOf(template: keyof typeof TEMPLATES | string, seed: number, state = 'normal', extra: Record<string, unknown> = {}): any {
  registerPacks()
  return engine.generate(TEMPLATES[template] ?? template, { seed, state, ...extra })
}

/** The plan drawn by a renderer with a canvas-less document. */
export function houseOf(plan: any, options: HouseRendererOptions = {}, build: BuildOptions = {}): { house: House; renderer: ReturnType<typeof create> } {
  const renderer = create(THREE, { document: fakeDocument, ...options })
  return { renderer, house: renderer.build(plan, { quality: 'high', night: false, ...build }) }
}

export { THREE }

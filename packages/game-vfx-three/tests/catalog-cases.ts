import * as THREE from 'three'
import type { BenchChange, ModuleBench, ModuleHost } from '@adatechnology/game-contracts'

import { createVfxTestModule } from '../src'

/** The effects of the bench (every option of its `effect` control), each played over a solid ground and caught mid-way: built from the module's own list, so a new effect is in it. */
type Root = THREE.Object3D
export type Case = [string, () => Root]

function play(effect: string, frames: number): Root {
  const listeners: Array<(change: BenchChange) => void> = []
  const updates: Array<(dt: number) => void> = []
  const scene = new THREE.Scene()
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), new THREE.MeshStandardMaterial())
  ground.name = 'ground'
  ground.position.y = -0.1
  scene.add(ground)
  const bench: ModuleBench = {
    value: () => undefined,
    layer: () => true,
    onChange: (listener) => {
      listeners.push(listener)
      return () => undefined
    },
    patch: () => undefined,
    look: () => undefined,
    sheet: () => undefined,
  }
  const host = { THREE, scene, camera: new THREE.PerspectiveCamera(), locale: 'en', groundAt: () => 0, tool: () => ({}), on: () => () => undefined, onFrame: (update: (dt: number) => void) => (updates.push(update), () => undefined), log: () => undefined, bench } as unknown as ModuleHost
  const module = createVfxTestModule({ locale: 'en' })
  module.attach!(host)
  const send = (change: BenchChange): void => listeners.forEach((listener) => listener(change))
  send({ kind: 'control', id: 'effect', value: effect })
  send({ kind: 'action', id: 'replay' })
  for (let i = 0; i < frames; i++) updates.forEach((update) => update(1 / 60))
  return scene
}

const effectControl = createVfxTestModule({ locale: 'en' }).controls!('en').find((control) => control.id === 'effect')
const effects = effectControl?.kind === 'choice' ? effectControl.options.map((option) => option.id) : []

export const cases: Case[] = effects.flatMap((effect): Case[] => [
  [`${effect}@0.2s`, () => play(effect, 12)],
  [`${effect}@2s`, () => play(effect, 120)],
])

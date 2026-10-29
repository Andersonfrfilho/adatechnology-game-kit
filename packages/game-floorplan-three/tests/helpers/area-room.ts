import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'

import { createFloorplanTestModule } from '../../src'
import { THREE, planOf } from './houses'
import { fakeDocument } from './fake-document'

let extras = false
/** The rural and post-apocalyptic packs, on top of what `planOf` registers (residential, commercial, structure). */
function registerExtras(): void {
  if (extras) return
  registerRural(engine)
  registerPostApocalyptic(engine)
  extras = true
}

/** A room reduced to what the area uses: a destruction world and its renderer, a scene, a camera, `spawn` of the module's items and the frame loop. */
export function fakeRoom(options: Record<string, unknown> = {}) {
  planOf('single_storey_a', 1)
  registerExtras()
  const world = createDestruction({ seed: 1 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { scene, world })
  const camera = new THREE.PerspectiveCamera(70, 1.6, 0.05, 400)
  camera.position.set(0, 1.7, 14)
  const frames = new Set<(dt: number) => void>()
  const blockers = new Set<(x: number, z: number, radius: number) => boolean>()
  const clears = new Set<() => void>()
  const looks: Array<{ eye: number[]; target: number[] }> = []
  const bench = { values: new Map<string, unknown>(), layers: new Map<string, boolean>(), listeners: new Set<(c: any) => void>(), sheets: [] as any[], patches: [] as any[] }
  const moduleOptions = { engine, locale: 'en', world, renderer, house: { document: fakeDocument }, ...options }
  const module = createFloorplanTestModule(moduleOptions as any)
  let counter = 0
  const host = {
    THREE,
    scene,
    camera,
    locale: 'en',
    groundAt: () => 0,
    tool: () => ({}),
    on: () => () => undefined,
    onFrame: (fn: (dt: number) => void) => (frames.add(fn), () => frames.delete(fn)),
    onClear: (fn: () => void) => (clears.add(fn), () => clears.delete(fn)),
    addBlocker: (fn: (x: number, z: number, radius: number) => boolean) => (blockers.add(fn), () => blockers.delete(fn)),
    log: () => undefined,
    bench: {
      value: (id: string) => bench.values.get(id),
      layer: (id: string) => bench.layers.get(id) ?? false,
      onChange: (fn: (c: any) => void) => (bench.listeners.add(fn), () => bench.listeners.delete(fn)),
      patch: (id: string, patch: any) => bench.patches.push([id, patch]),
      look: (eye: number[], target: number[]) => {
        looks.push({ eye, target })
        camera.position.set(eye[0], eye[1], eye[2])
        camera.lookAt(target[0], target[1], target[2])
        camera.updateMatrixWorld(true)
      },
      sheet: (sheet: any) => bench.sheets.push(sheet),
    },
  }
  // the declared bench: layers at their defaults
  for (const layer of module.layers?.('en') ?? []) bench.layers.set(layer.id, layer.default ?? false)
  const detach = module.attach!(host as any)
  const frame = (seconds: number, dt = 1 / 30): void => {
    for (let t = 0; t < seconds; t += dt) {
      for (const fn of frames) fn(dt)
      world.update(dt)
      renderer.update(dt)
    }
  }
  const act = (id: string): void => bench.listeners.forEach((fn) => fn({ kind: 'action', id }))
  const set = (id: string, value: unknown): void => {
    bench.values.set(id, value)
    bench.listeners.forEach((fn) => fn({ kind: 'control', id, value }))
  }
  const layer = (id: string, on: boolean): void => {
    bench.layers.set(id, on)
    bench.listeners.forEach((fn) => fn({ kind: 'layer', id, on }))
  }
  const items = module.items('en')
  const room = {
    world,
    renderer,
    scene,
    spawn(itemId: string, position: number[]) {
      const item = items.find((i) => i.id === itemId)!
      const root = item.build(THREE) as any
      root.position.set(position[0], position[1], position[2])
      scene.add(root)
      const id = `${itemId}_${++counter}`
      world.add((item.spec as any)(root), { id, position: position as any })
      return { objectId: id, root }
    },
  }
  const step = (seconds: number): void => { for (let t = 0; t < seconds; t += 1 / 30) { world.update(1 / 30); renderer.update(1 / 30) } }
  return { module, host, world, renderer, scene, camera, room, step, frame, act, set, layer, bench, blockers, clears, looks, detach, items }
}

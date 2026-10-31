import { lineUpLength, visualStateOf } from '@adatechnology/game-animals'
import type { AnimalSpecies, AnimalVisualState } from '@adatechnology/game-animals'
import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule } from '@adatechnology/game-contracts'
import type { NodeSkin } from '@adatechnology/game-props3d'
import type * as THREE_NS from 'three'

import { createAnimalSound } from '../audio/sound'
import type { AnimalSound } from '../audio/sound'
import { createAnimalsThree } from '../index'
import type { AnimalsThree } from '../index'
import type { AnimalRig, Three } from '../types'
import { createScenarios } from './scenarios'
import type { AnimalsContext, ScenarioDeps } from './scenarios'
import { TEXT } from './text'
import type { AnimalsTestOptions, OutbreakLike } from './types'

export const ANIMALS_AREA_ID = 'animals_area'
export const ANIMAL_ITEM_PREFIX = 'animal_'
const SKIN_COUNT = 40
const SKIN_FIELD = { x0: -18, z0: -10, columns: 8, gap: 4.5 }
const DEFAULT_TIME_SCALE = 60

type Fate = NonNullable<ReturnType<OutbreakLike['bite']>>
type Placed = { readonly id: string; readonly rig: AnimalRig; fate?: Fate; counted?: 'turned' | 'dead' }

/**
 * The animals test area as a `TestableModule`: the species of the pack in a row, each drawn by the Bichos do Vale builders, with the alive / infected / dead looks, the gait,
 * the joints and split views, the rings for how far its sound carries and how far a carcass lures, the outbreak rule with an accelerated bite clock, and a field of 40 animals
 * drawn as node skins. The species and the outbreak rule come in by option, so this package knows no game.
 */
export function createAnimalsTestModule(options: AnimalsTestOptions = {}): TestableModule<AnimalsContext> & { readonly placed: ReadonlyMap<string, unknown> } {
  const locale = options.locale ?? 'pt-BR'
  const text = TEXT[locale] ?? (TEXT['pt-BR'] as (typeof TEXT)[string])
  const species = options.species ?? []
  const settings = { visual: 'alive' as AnimalVisualState, gait: 'walk', speed: 1, outbreak: true, timeScale: DEFAULT_TIME_SCALE }
  let three: Three | null = null
  let animals: AnimalsThree | null = null
  let host: ModuleHost | null = null
  let outbreak: OutbreakLike | null = null
  let sound: AnimalSound | null = null
  let time = 0
  let clock = 0
  let skinGroup: THREE_NS.Group | null = null
  let skins: { rig: AnimalRig; skin: NodeSkin }[] = []
  let rings: THREE_NS.Object3D[] = []
  const placed = new Map<string, Placed>()
  const random = (): number => 0.5
  const drawSeed = options.seed ?? 7
  const bitten = () => ({ turned: [...placed.values()].filter((p) => p.counted === 'turned').length, dead: [...placed.values()].filter((p) => p.counted === 'dead').length })

  const ensure = (THREE: Three): AnimalsThree => {
    three = THREE
    animals ??= createAnimalsThree(THREE, { seed: drawSeed, ...(options.document ? { document: options.document } : {}) })
    return animals
  }
  const rebuildOutbreak = (): void => {
    outbreak = options.createOutbreak ? options.createOutbreak({ species, enabled: settings.outbreak, timeScale: settings.timeScale }) : null
  }
  rebuildOutbreak()

  const item = (animal: AnimalSpecies): TestableItem => ({
    id: `${ANIMAL_ITEM_PREFIX}${animal.id}`,
    name: animal.name[locale as 'en'] ?? animal.id,
    movable: false,
    build: (THREE: unknown) => {
      const rig = ensure(THREE as Three).build(animal)
      // the room puts the tree in its scene right after this; trees that never reach it are dropped at the next frame
      placed.set(rig.root.uuid, { id: rig.root.uuid, rig })
      if (settings.visual !== 'alive') animals?.setVisualState(rig, settings.visual)
      return rig.root
    },
  })

  const statusOf = (entry: Placed): void => {
    if (!entry.fate || !outbreak) return
    const state = outbreak.stateOf(entry.fate, clock)
    if (state === 'incubating') return
    entry.counted = state === 'turned' ? 'turned' : 'dead'
    animals?.setVisualState(entry.rig, visualStateOf(entry.rig.species.outcome, true, state === 'dead'))
  }

  const clearRings = (): void => {
    for (const ring of rings) ring.parent?.remove(ring)
    rings = []
  }
  const refreshLayers = (): void => {
    if (!host?.bench || !animals || !three) return
    clearRings()
    for (const entry of placed.values()) {
      animals.setJointView(entry.rig, host.bench.layer('joints'))
      animals.setSplit(entry.rig, host.bench.layer('split'))
    }
    const ring = (radius: number, color: number, parent: THREE_NS.Object3D): void => {
      const mesh = new (three as Three).Mesh(new (three as Three).RingGeometry(radius - 0.15, radius, 96).rotateX(-Math.PI / 2), new (three as Three).MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }))
      mesh.position.y = 0.03
      parent.add(mesh)
      rings.push(mesh)
    }
    for (const entry of placed.values()) {
      if (!entry.rig.root.parent) continue
      const radius = entry.rig.species.soundRangeMetres
      if (host.bench.layer('sound_range') && radius) ring(radius, 0x44aaff, entry.rig.root)
      const lure = entry.rig.species.outbreak?.carcass?.lureRadiusMetres
      if (host.bench.layer('carcass_lure') && lure) ring(lure, 0xff5533, entry.rig.root)
    }
  }

  const addSkins = (): void => {
    if (!animals || !three || !host) return
    skinGroup ??= new three.Group()
    if (!skinGroup.parent) (host.scene as THREE_NS.Object3D).add(skinGroup)
    for (let index = skins.length; index < SKIN_COUNT; index++) {
      const animal = species[index % Math.max(1, species.length)] as AnimalSpecies
      const rig = animals.build(animal)
      const skin = animals.createSkin(rig)
      rig.root.position.set(SKIN_FIELD.x0 + (index % SKIN_FIELD.columns) * SKIN_FIELD.gap, 0, SKIN_FIELD.z0 - Math.floor(index / SKIN_FIELD.columns) * SKIN_FIELD.gap)
      // the tree still drives the animation, but only the skin is drawn
      rig.root.traverse((object) => {
        if ((object as THREE_NS.Mesh).isMesh) object.visible = false
      })
      skinGroup.add(rig.root, skin.mesh)
      skins.push({ rig, skin })
    }
  }
  const clearSkins = (): void => {
    skinGroup?.parent?.remove(skinGroup)
    skinGroup = null
    skins = []
  }

  const applyVisual = (): void => {
    for (const entry of placed.values()) {
      if (entry.fate) continue
      animals?.setVisualState(entry.rig, settings.visual)
    }
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') return refreshLayers()
    if (change.kind === 'action') {
      if (change.id === 'bite_all') {
        for (const entry of placed.values()) {
          entry.fate = outbreak?.bite(entry.rig.species.id, random, clock)
          if (entry.fate) animals?.setVisualState(entry.rig, visualStateOf(entry.rig.species.outcome, true))
        }
      } else if (change.id === 'recover') {
        for (const entry of placed.values()) {
          delete entry.fate
          delete entry.counted
          animals?.setVisualState(entry.rig, settings.visual)
        }
      } else if (change.id === 'call' && sound) {
        for (const [id, entry] of placed) {
          const at = entry.rig.root.getWorldPosition(new (three as Three).Vector3())
          sound.call(entry.rig.species.id, [at.x, at.y + 0.5, at.z], { key: id })
        }
      } else if (change.id === 'skin_40') addSkins()
      else if (change.id === 'clear_skins') clearSkins()
      return
    }
    switch (change.id) {
      case 'visual_state': settings.visual = String(change.value) as AnimalVisualState; applyVisual(); break
      case 'gait': settings.gait = String(change.value); break
      case 'speed': settings.speed = Number(change.value); break
      case 'outbreak': settings.outbreak = Boolean(change.value); if (outbreak) outbreak.enabled = settings.outbreak; break
      case 'time_scale': settings.timeScale = Number(change.value); rebuildOutbreak(); break
      default: break
    }
  }

  const frame = (dt: number): void => {
    time += dt * settings.speed
    clock += dt
    sound?.update(dt)
    for (const [id, entry] of placed) {
      if (!entry.rig.root.parent) {
        placed.delete(id)
        continue
      }
      statusOf(entry)
      animals?.animate(entry.rig, { time, delta: dt * settings.speed, clip: settings.gait, split: host?.bench?.layer('split') ?? false })
      animals?.updateSplit(entry.rig, dt)
    }
    for (const { rig, skin } of skins) {
      animals?.animate(rig, { time, delta: dt * settings.speed, clip: settings.gait })
      rig.root.updateMatrixWorld(true)
      skin.update()
    }
  }

  const countMeshes = (only?: 'skins'): { drawCalls: number; triangles: number } => {
    let drawCalls = 0
    let triangles = 0
    const count = (root: THREE_NS.Object3D): void =>
      root.traverse((object) => {
        const mesh = object as THREE_NS.Mesh
        if (!mesh.isMesh || !mesh.visible) return
        drawCalls += 1
        const geometry = mesh.geometry
        triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
      })
    if (only !== 'skins') for (const entry of placed.values()) count(entry.rig.root)
    for (const { skin } of skins) count(skin.mesh)
    return { drawCalls, triangles: Math.round(triangles) }
  }

  const deps: ScenarioDeps = {
    text: text.scenarios,
    species: () => species,
    ensure: () => ensure((three ?? host?.THREE) as Three),
    outbreak: () => outbreak,
    rebuildOutbreak: (enabled) => {
      settings.outbreak = enabled
      rebuildOutbreak()
      return outbreak
    },
    skins: () => {
      ensure((three ?? host?.THREE) as Three)
      addSkins()
      return { count: skins.length, meshes: countMeshes('skins'), nodes: skins[0]?.skin.nodes.length ?? 0, rich: skins[0]?.rig.triangles ?? 0 }
    },
    clearSkins,
  }

  return {
    id: ANIMALS_AREA_ID,
    name: text.name,
    ground: { surface: 'lawn' },
    group: text.group,
    get placed() {
      return placed
    },
    items: () => species.map(item),
    area: (): ModuleArea => {
      // the page's line-up: each animal given room by its length (and a gap), the row centred on the origin
      const gap = 0.85
      let cursor = 0
      const spots = species.map((animal) => {
        const length = lineUpLength(animal.body)
        const x = cursor + length / 2
        cursor += length + gap
        return { animal, x }
      })
      const offset = -(cursor - gap) / 2
      return {
        placements: spots.map(({ animal, x }) => ({ item: `${ANIMAL_ITEM_PREFIX}${animal.id}`, position: [x + offset, 0, 0], rotationY: animal.body.kind === 'snake' ? 2.2 : 1.1 })),
        view: { eye: [0, 4, Math.max(10, (cursor - gap) * 0.55)], target: [0, 0.6, 0] },
      }
    },
    controls: (): ModuleControl[] => [
      { kind: 'choice', id: 'visual_state', name: text.controls.visual_state, hint: text.hints.visual_state, options: (['alive', 'infected', 'dead'] as const).map((id) => ({ id, name: text.options.visual_state[id] as string })), default: 'alive' },
      { kind: 'choice', id: 'gait', name: text.controls.gait, hint: text.hints.gait, options: (['idle', 'walk', 'run'] as const).map((id) => ({ id, name: text.options.gait[id] as string })), default: 'walk' },
      { kind: 'number', id: 'speed', name: text.controls.speed, min: 0, max: 4, step: 0.25, default: 1 },
      { kind: 'boolean', id: 'outbreak', name: text.controls.outbreak, hint: text.hints.outbreak, default: true },
      { kind: 'number', id: 'time_scale', name: text.controls.time_scale, hint: text.hints.time_scale, min: 1, max: 600, step: 1, default: DEFAULT_TIME_SCALE },
      { kind: 'action', id: 'bite_all', name: text.actions.bite_all },
      { kind: 'action', id: 'recover', name: text.actions.recover },
      { kind: 'action', id: 'call', name: text.actions.call },
      { kind: 'action', id: 'skin_40', name: text.actions.skin_40, slow: true },
      { kind: 'action', id: 'clear_skins', name: text.actions.clear_skins },
    ],
    layers: (): ModuleLayer[] => (['joints', 'split', 'sound_range', 'carcass_lure'] as const).map((id) => ({ id, name: text.layers[id], default: false })),
    metrics: (): ModuleMetric[] => [
      { id: 'animals', name: text.metrics.animals, read: () => placed.size + skins.length },
      { id: 'draw_calls', name: text.metrics.draw_calls, read: () => countMeshes().drawCalls },
      { id: 'triangles', name: text.metrics.triangles, read: () => countMeshes().triangles },
      { id: 'nodes_per_skin', name: text.metrics.nodes_per_skin, read: () => skins[0]?.skin.nodes.length ?? 0 },
      { id: 'incubating', name: text.metrics.incubating, read: () => [...placed.values()].filter((p) => p.fate && !p.counted).length },
      { id: 'turned', name: text.metrics.turned, read: () => bitten().turned },
      { id: 'dead', name: text.metrics.dead, read: () => bitten().dead },
    ],
    scenarios: (): ModuleScenario<AnimalsContext>[] => createScenarios(deps),
    attach(lent) {
      host = lent
      ensure(lent.THREE as Three)
      sound = lent.audio && options.sound !== false ? createAnimalSound(lent.audio, options.sound ?? {}) : null
      const stopChange = lent.bench?.onChange(onChange)
      const stopFrame = lent.onFrame(frame)
      return () => {
        stopChange?.()
        stopFrame()
        clearRings()
        clearSkins()
        sound?.dispose()
        sound = null
        host = null
      }
    },
  }

}

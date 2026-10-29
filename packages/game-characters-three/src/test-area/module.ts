import { createCharacters, createRng } from '@adatechnology/game-characters'
import type { CharacterKit, DamageCharacter, GaitProfile } from '@adatechnology/game-characters'
import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule } from '@adatechnology/game-contracts'

import { createCharacterSound } from '../audio/sound'
import type { CharacterSound } from '../audio/sound'
import { findEyes } from '../eyes'
import type { Eyes } from '../eyes'
import { createRigAnimator } from '../rich/animator'
import { createBestBuilder } from '../rich/best-builder'
import type { BestBuilder } from '../rich/best-builder'
import { createPersonBuilder } from '../rich/person-builder'
import type { PersonBuilder } from '../rich/person-builder'
import type { Three, THREE_NS } from '../three'
import { createFluidsBridge } from '../wounds/fluids-bridge'
import { woundBodyOf } from '../wounds/segment-nodes'
import type { WoundBody } from '../wounds/segment-nodes'
import { createWounds } from '../wounds/wounds'
import type { Wounds } from '../wounds/wounds'
import { createCrowd } from './crowd'
import type { Crowd } from './crowd'
import { HIT_PRESETS, hitFor, hitPresetOf } from './hits'
import { personSpecOf } from './person-spec'
import { bodyMass, knockOf, KNOCKED_DOWN_ANGLE, stepKnock } from './knock'
import type { Knock } from './knock'
import { createScenarios } from './scenarios'
import type { AreaContext, ScenarioDeps } from './scenarios'
import { TEXT } from './text'
import type { CharactersTestOptions, UndeadCard, UndeadLike } from './types'

export const CHARACTERS_AREA_ID = 'characters_area'
export const ZOMBIE_ITEM_PREFIX = 'zombie_'
export const PERSON_ITEM_PREFIX = 'person_'
const LANE_ITEM_COUNT = 5
const GAIT_MOMENT_STRIDE = 1.4
/** Triangles per body at the three levels of detail: the Bancada de Hordas budget. */
const DEFAULT_TRIANGLE_BUDGET = [2500, 800, 250] as const

type Entry = {
  readonly id: string
  readonly kind: 'zombie' | 'person'
  readonly cardId: string
  readonly root: THREE_NS.Object3D
  readonly body: WoundBody | undefined
  readonly eyes: Eyes | null
  readonly built: unknown
  character: DamageCharacter
  walk: number
  tilt: number
  /** What a blast is doing to the body now (see `knock.ts`); undefined at rest. */
  knock?: Knock
}

const MOMENTS_WITH_LIMP = new Set(['limp', 'crawl'])

/**
 * The characters test area as a `TestableModule`: the undead types and the professions as bodies the room can shoot (each one a `DestructibleImpl` of the damage model, drawn with the
 * rich builders, wounds, eyes and gait), a shooting lane, a crowd on the instanced path, and a bench with the damage rules, the hits, the protection, the moment and the layers.
 * Everything comes in by option: the packs of content (people, undead) are the host page's, so this package knows no game.
 */
export function createCharactersTestModule(options: CharactersTestOptions = {}): TestableModule<AreaContext> & { readonly entries: ReadonlyMap<string, unknown>; readonly crowd: Crowd | null } {
  const locale = options.locale ?? 'pt-BR'
  const text = TEXT[locale] ?? (TEXT['pt-BR'] as (typeof TEXT)[string])
  const undeadTypes = options.undeadTypes ?? []
  const professions = options.professions ?? []
  const settings = { decay: 0, age: 'adult', penetration: 'physical', deathRule: 'vitality-or-head', detail: 'segments', moment: 'wander', pose: 'walk', cascade: true, hit: '9x19', protection: 'none' }
  const makeKit = (): CharacterKit =>
    options.createKit
      ? options.createKit({ penetration: settings.penetration as 'physical', deathRule: settings.deathRule as 'vitality-or-head' })
      : createCharacters({ ...(options.packs ? { packs: options.packs } : {}), penetration: settings.penetration as 'physical', damage: { deathRule: settings.deathRule as 'vitality-or-head' } })
  let kit = makeKit()
  let undead: UndeadLike | null = options.createUndead ? options.createUndead(kit) : null
  const random = createRng(options.seed ?? 1)
  let seedCounter = 100
  let host: ModuleHost | null = null
  let three: Three | null = null
  let best: BestBuilder | null = null
  let people: PersonBuilder | null = null
  let wounds: Wounds | null = null
  let sound: CharacterSound | null = null
  let crowd: Crowd | null = null
  let selected: Entry | null = null
  let time = 0
  let lastCrossed = 0
  let lastEnergy = 1
  const entries = new Map<string, Entry>()
  const builtOf = new WeakMap<object, { kind: 'zombie' | 'person'; cardId: string; built: unknown }>()
  const overlays = new Map<string, THREE_NS.Object3D>()
  const gaits: Record<string, GaitProfile> = Object.fromEntries(undeadTypes.map((card) => [card.name['pt-BR'] ?? card.id, card.gait as unknown as GaitProfile]))
  const animator = createRigAnimator({ gaits })
  const typeName = (card: UndeadCard): string => card.name['pt-BR'] ?? card.id
  const eyeOf = (card: UndeadCard): number => parseInt(card.eye.color, 16)

  const ensureBuilders = (THREE: Three): void => {
    three = THREE
    best ??= createBestBuilder(THREE, { types: undeadTypes.map((card) => ({ name: typeName(card), eye: eyeOf(card) })), random })
    people ??= createPersonBuilder(THREE, { random, createCanvas: () => document.createElement('canvas') })
  }
  const nextSeed = (): number => (seedCounter += 1)
  const protectionList = (): string[] => (settings.protection === 'none' ? [] : settings.protection === 'vest_helmet' ? ['vest_police', 'helmet_combat'] : [settings.protection])

  const createCharacter = (kind: 'zombie' | 'person', cardId: string, id: string): DamageCharacter => {
    const seed = nextSeed()
    const common = { seed, id, age: settings.age as 'adult', protection: protectionList(), detail: settings.detail as 'segments' }
    if (kind === 'zombie' && undead) return undead.create(common, { type: cardId })
    return kit.create({ ...common, kind: kind === 'zombie' ? cardId : 'person', ...(kind === 'person' ? { preset: cardId } : {}) })
  }

  const trackEntry = (entry: Entry): void => {
    if (entry.body) wounds?.track(entry.body)
  }

  const wrap = (entry: Entry, character: DamageCharacter): DamageCharacter => {
    const syncTransform = (): void => {
      const root = entry.root
      character.setTransform([root.position.x, root.position.y, root.position.z], [root.quaternion.x, root.quaternion.y, root.quaternion.z, root.quaternion.w])
    }
    const draw = (events: readonly import('@adatechnology/game-contracts').DestructionEvent[]): void => {
      if (entry.body) for (const event of events) wounds?.handle(entry.body, event)
    }
    return Object.create(character, {
      hit: {
        value: (hit: Parameters<DamageCharacter['hit']>[0]) => {
          syncTransform()
          selected = entry
          const events = character.hit(hit)
          draw(events)
          const report = character.lastHit
          lastCrossed = report?.through ? 2 : 1
          lastEnergy = report && 'exitEnergy' in report ? report.exitEnergy : lastEnergy
          return events
        },
      },
      update: {
        value: (dt: number) => {
          syncTransform()
          const events = character.update(dt)
          draw(events)
          return events
        },
      },
      reset: {
        value: () => {
          character.reset()
          entry.root.visible = true
        },
      },
    }) as DamageCharacter
  }

  const makeItem = (kind: 'zombie' | 'person', cardId: string, name: string): TestableItem => ({
    id: `${kind === 'zombie' ? ZOMBIE_ITEM_PREFIX : PERSON_ITEM_PREFIX}${cardId}`,
    name,
    movable: false,
    build: (THREE: unknown) => {
      ensureBuilders(THREE as Three)
      const seed = nextSeed()
      if (kind === 'zombie') {
        const card = undeadTypes.find((entry) => entry.id === cardId) as UndeadCard
        const root = (best as BestBuilder).build({ type: typeName(card), seed, decay: settings.decay })
        builtOf.set(root, { kind, cardId, built: root })
        return root
      }
      const profession = professions.find((entry) => entry.id === cardId)
      const built = (people as PersonBuilder).build(profession ? personSpecOf(profession) : { skin: 0xc49070, hair: { s: 'short', c: 0x222222 }, top: { c: 0x445566, sl: 'long' }, pants: { c: 0x333333 }, shoes: 0x111111 })
      // the survivor builder keeps its rig on the character it returns; the wounds read it from the root, like the zombies'
      if (!built.root.userData.rig) built.root.userData.rig = built
      builtOf.set(built.root, { kind, cardId, built })
      return built.root
    },
    impl: (root: unknown, id: string) => {
      const object = root as THREE_NS.Object3D
      const made = builtOf.get(object) as { kind: 'zombie' | 'person'; cardId: string; built: unknown }
      const character = createCharacter(made.kind, made.cardId, id)
      const scale = character.spec.height / kit.body.heightMetres
      if (Math.abs(scale - 1) > 0.01) object.scale.setScalar(scale)
      const entry: Entry = { id, kind: made.kind, cardId: made.cardId, root: object, body: woundBodyOf(object), eyes: three ? findEyes(three, object) : null, built: made.built, character, walk: 0, tilt: 0 }
      entry.character = wrap(entry, character)
      const age = made.kind === 'zombie' ? undead?.traitsOf(character)?.age : undefined
      const blood = age !== undefined ? options.bloodOf?.(age) : undefined
      if (entry.body && blood) entry.body.blood = blood
      entries.set(id, entry)
      selected ??= entry
      trackEntry(entry)
      return entry.character
    },
  })

  const speedOf = (entry: Entry): number => {
    const traits = undead?.traitsOf(entry.character)
    if (!traits || !undead) return entry.kind === 'person' ? 1.4 : 0
    const moment = settings.moment
    return undead.speedFor(traits, { moment: MOMENTS_WITH_LIMP.has(moment) ? 'chase' : moment, limp: moment === 'limp', crawling: moment === 'crawl' || entry.character.limping.length > 1 })
  }

  const clearOverlays = (): void => {
    for (const object of overlays.values()) object.parent?.remove(object)
    overlays.clear()
  }

  const overlayFor = (layer: string, entry: Entry): THREE_NS.Object3D | null => {
    if (!three) return null
    const group = new three.Group()
    const material = new three.MeshBasicMaterial({ color: layer === 'capsules' ? 0x44ddff : layer === 'joints' ? 0xffee44 : 0xff4466, wireframe: layer === 'capsules', depthTest: false, transparent: true, opacity: 0.8 })
    if (layer === 'capsules') {
      for (const part of entry.character.describe().parts) {
        const shape = part.shape
        const geometry = shape.kind === 'sphere' ? new three.SphereGeometry(shape.radius, 8, 6) : shape.kind === 'cylinder' ? new three.CylinderGeometry(shape.radius, shape.radius, shape.height, 8, 1) : new three.BoxGeometry(...shape.size)
        const mesh = new three.Mesh(geometry, material)
        mesh.position.set(...part.position)
        if (part.rotation) mesh.rotation.set(...part.rotation)
        group.add(mesh)
      }
    } else if (layer === 'joints') {
      for (const joint of Object.values(entry.character.rig.joints)) {
        const mesh = new three.Mesh(new three.SphereGeometry(0.025, 6, 4), material)
        mesh.position.set(...joint)
        group.add(mesh)
      }
    } else if (layer === 'speed') {
      const length = Math.max(0.1, speedOf(entry))
      const arrow = new three.ArrowHelper(new three.Vector3(0, 0, 1), new three.Vector3(0, 2.1, 0), length, 0x66ff66)
      group.add(arrow)
    } else return null
    group.renderOrder = 10
    return group
  }

  const refreshLayers = (): void => {
    clearOverlays()
    if (!host?.bench) return
    for (const layer of ['capsules', 'joints', 'speed'] as const) {
      if (!host.bench.layer(layer)) continue
      for (const entry of entries.values()) {
        const overlay = overlayFor(layer, entry)
        if (!overlay) continue
        entry.root.add(overlay)
        overlays.set(`${layer}:${entry.id}`, overlay)
      }
    }
    const eyesOnly = host.bench.layer('eyes_only')
    for (const entry of entries.values()) entry.eyes?.isolate(eyesOnly)
  }

  const animate = (entry: Entry, dt: number): void => {
    const { root, character } = entry
    if (entry.knock) {
      const rig = root.userData.rig as { fig: { rotation: { x: number } } } | undefined
      const ground = (x: number, z: number): number => host?.groundAt(x, z) ?? 0
      const done = stepKnock(entry.knock, root.position, dt, ground, character.alive)
      if (done) entry.knock = undefined
      if (character.alive && rig) rig.fig.rotation.x = -(entry.knock?.lying ?? 0) * KNOCKED_DOWN_ANGLE
      if (entry.knock && entry.knock.lying > 0 && character.alive) {
        // down on the ground: the body does not walk
        entry.eyes?.off()
        return
      }
    }
    if (!character.alive) {
      entry.tilt = Math.min(1, entry.tilt + dt * 2)
      const rig = root.userData.rig as { fig: { rotation: { x: number } } } | undefined
      if (rig) rig.fig.rotation.x = -entry.tilt * 1.35
      entry.eyes?.off()
      return
    }
    const speed = settings.pose === 'walk' ? speedOf(entry) : 0
    entry.walk += dt * speed
    if (entry.kind === 'person') (people as PersonBuilder).pose(entry.built, false, settings.pose === 'walk' ? 1 : 0, time)
    else if (settings.pose === 'walk') {
      animator.animate(root, time, { speed: speed || GAIT_MOMENT_STRIDE })
      if (settings.cascade) animator.cascade(root.userData.rig, dt)
    }
    if (entry.body) {
      wounds?.setWalkPhase(entry.body, settings.pose === 'walk' ? entry.walk : undefined)
      wounds?.applyLimp(entry.body)
    }
  }

  const selectedOrFirst = (): Entry | null => selected ?? entries.values().next().value ?? null

  const fireOn = (entry: Entry): void => {
    const preset = hitPresetOf(settings.hit)
    const p = entry.root.position
    entry.character.hit(hitFor(preset, [p.x, p.y, p.z], 1.3, kit.calibers))
  }

  const ensureCrowd = (): Crowd => {
    if (crowd) return crowd
    const built = three as Three
    const builders = {
      buildBest: (spec: Record<string, unknown>, lod: number) => {
        ;(best as BestBuilder).setLOD(lod)
        return (best as BestBuilder).build(spec) as THREE_NS.Object3D
      },
      topMaterial: () => (best as BestBuilder).topM() as THREE_NS.Material | null,
    }
    const wanted = options.crowdTypes ?? ['walker', 'runner']
    const variantTypes = undeadTypes.map((card, index) => ({ id: card.id, name: typeName(card), index })).filter((type) => wanted.includes(type.id))
    crowd = createCrowd(built, builders, variantTypes, Object.fromEntries(undeadTypes.map((card) => [card.id, eyeOf(card)])), random)
    if (host) (host.scene as THREE_NS.Object3D).add(crowd.group)
    return crowd
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') {
      refreshLayers()
      return
    }
    if (change.kind === 'action') {
      const target = selectedOrFirst()
      if (change.id === 'heal') target?.character.reset()
      else if (change.id === 'kill' && target) target.character.hit({ type: 'ballistic', point: [target.root.position.x, 1.7, target.root.position.z + 0.3], direction: [0, 0, -1], part: 'head', energy: 3504, mass: 9.7, caliber: 7.8 })
      else if (change.id === 'infect' && target && undead?.infect) {
        const infection = undead.infect('bite', () => 0)
        if (infection) {
          infection.advance(1000)
          if (infection.reanimated) target.character = wrap(target, undead.turn(target.character))
        }
      } else if (change.id === 'fire_preset' && target) fireOn(target)
      else if ((change.id === 'voice' || change.id === 'special_call') && sound) {
        // the aimed zombie, or the first one of the area when a survivor is aimed
        const speaker = target?.kind === 'zombie' ? target : [...entries.values()].find((entry) => entry.kind === 'zombie')
        if (speaker) {
          const at = speaker.root.getWorldPosition(new (host!.THREE as Three).Vector3())
          const hurried = settings.moment === 'alert' || settings.moment === 'chase' || settings.moment === 'sprint'
          sound.voice(speaker.cardId, change.id === 'special_call' ? 'special' : hurried ? 'alert' : 'idle', [at.x, at.y + 1.5, at.z])
        }
      }
      else if (change.id === 'spawn_100' || change.id === 'spawn_1000') {
        ensureBuilders((host?.THREE as Three) ?? (three as Three))
        ensureCrowd().spawn(change.id === 'spawn_100' ? 100 : 1000)
      }
      return
    }
    const value = change.value
    switch (change.id) {
      case 'decay': settings.decay = Number(value); break
      case 'age': settings.age = String(value); break
      case 'penetration': settings.penetration = String(value); kit = makeKit(); undead = options.createUndead ? options.createUndead(kit) : null; break
      case 'death_rule': settings.deathRule = String(value); kit = makeKit(); undead = options.createUndead ? options.createUndead(kit) : null; break
      case 'detail': settings.detail = String(value); break
      case 'moment': settings.moment = String(value); refreshLayers(); break
      case 'pose': settings.pose = String(value); break
      case 'cascade': settings.cascade = Boolean(value); break
      case 'hit_preset': settings.hit = String(value); break
      case 'protection': settings.protection = String(value); break
      default: break
    }
  }

  const choice = (id: keyof typeof text.controls & keyof typeof text.options, ids: readonly string[], fallback: string) => ({
    kind: 'choice' as const,
    id,
    name: text.controls[id],
    options: ids.map((optionId) => ({ id: optionId, name: (text.options[id] as Record<string, string>)[optionId] ?? optionId })),
    default: fallback,
  })
  const withHint = <T extends ModuleControl>(control: T, hint: string | undefined): T => (hint ? { ...control, hint } : control)

  const scenarioDeps: ScenarioDeps = {
    text: text.scenarios,
    kit: () => kit,
    undead: () => undead,
    three: () => three ?? (host?.THREE as Three | null),
    ensureBuilders,
    buildZombie: (name, decay) => (best as BestBuilder).build({ type: name, seed: 7, decay }),
    typeNames: () => undeadTypes.map(typeName),
    crowd: () => {
      ensureBuilders((three ?? host?.THREE) as Three)
      return ensureCrowd()
    },
    random,
    triangleBudget: options.triangleBudget ?? DEFAULT_TRIANGLE_BUDGET,
    triangleBudgetSoftFar: options.triangleBudget === undefined,
  }

  const lane = (): string[] => professions.slice(0, LANE_ITEM_COUNT).map((profession) => `${PERSON_ITEM_PREFIX}${profession.id}`)

  return {
    id: CHARACTERS_AREA_ID,
    name: text.name,
    group: text.group,
    get entries() {
      return entries
    },
    get crowd() {
      return crowd
    },
    items: () => [
      ...undeadTypes.map((card) => makeItem('zombie', card.id, card.name[locale] ?? card.id)),
      ...professions.map((profession) => makeItem('person', profession.id, profession.name[locale] ?? profession.id)),
    ],
    area: (): ModuleArea => {
      const placements: ModuleArea['placements'] = []
      undeadTypes.forEach((card, index) => placements.push({ item: `${ZOMBIE_ITEM_PREFIX}${card.id}`, position: [-6 + index * 1.1, 0, 3], rotationY: Math.PI }))
      professions.forEach((profession, index) => placements.push({ item: `${PERSON_ITEM_PREFIX}${profession.id}`, position: [-5.45 + index * 1.1, 0, 7], rotationY: Math.PI }))
      lane().forEach((item, index) => placements.push({ item, position: [0, 0, -3 - index * 1.4], rotationY: 0 }))
      return { placements, view: { eye: [0, 5.5, 13], target: [0, 0.6, 3] } }
    },
    controls: (): ModuleControl[] => [
      withHint({ kind: 'number', id: 'decay', name: text.controls.decay, min: 0, max: 3, step: 1, default: 0 }, text.hints.decay),
      choice('age', ['child', 'young', 'adult', 'elder'], 'adult'),
      withHint(choice('penetration', ['physical', 'team-game'], 'physical'), text.hints.penetration),
      withHint(choice('death_rule', ['vitality-or-head', 'head-only'], 'vitality-or-head'), text.hints.death_rule),
      withHint(choice('detail', ['segments', 'regions'], 'segments'), text.hints.detail),
      withHint(choice('moment', ['wander', 'alert', 'chase', 'sprint', 'frenzy', 'limp', 'crawl'], 'wander'), text.hints.moment),
      choice('pose', ['walk', 'stand'], 'walk'),
      { kind: 'boolean', id: 'cascade', name: text.controls.cascade, default: true },
      withHint(choice('hit_preset', HIT_PRESETS.map((preset) => preset.id), '9x19'), text.hints.hit_preset),
      withHint(choice('protection', ['none', 'vest_police', 'vest_military', 'helmet_combat', 'turnout_gear', 'vest_helmet'], 'none'), text.hints.protection),
      { kind: 'action', id: 'fire_preset', name: text.actions.fire_preset },
      { kind: 'action', id: 'voice', name: text.actions.voice },
      { kind: 'action', id: 'special_call', name: text.actions.special_call },
      { kind: 'action', id: 'heal', name: text.actions.heal },
      { kind: 'action', id: 'kill', name: text.actions.kill },
      { kind: 'action', id: 'infect', name: text.actions.infect },
      { kind: 'action', id: 'spawn_100', name: text.actions.spawn_100 },
      { kind: 'action', id: 'spawn_1000', name: text.actions.spawn_1000 },
    ],
    layers: (): ModuleLayer[] => (['capsules', 'joints', 'bleed', 'eyes_only', 'speed'] as const).map((id) => ({ id, name: text.layers[id], default: false })),
    metrics: (): ModuleMetric[] => [
      { id: 'bodies', name: text.metrics.bodies, read: () => entries.size },
      { id: 'instances', name: text.metrics.instances, read: () => crowd?.count ?? 0 },
      { id: 'triangles', name: text.metrics.triangles, max: 250_000, read: () => Math.round(crowd?.triangles ?? 0) },
      { id: 'draw_calls', name: text.metrics.draw_calls, read: () => crowd?.drawCalls ?? 0 },
      { id: 'bake_ms', name: text.metrics.bake_ms, unit: 'ms', digits: 0, read: () => crowd?.bakeMs ?? 0 },
      { id: 'speed_now', name: text.metrics.speed, unit: 'm/s', digits: 2, read: () => { const entry = selectedOrFirst(); return entry ? speedOf(entry) : 0 } },
      { id: 'vitality', name: text.metrics.vitality, read: () => (selectedOrFirst()?.character.state().body?.vitality ?? 0) },
      { id: 'bleed_rate', name: text.metrics.bleed, digits: 3, read: () => (selectedOrFirst()?.character.bleeders().reduce((sum, bleeder) => sum + ((bleeder as { rate?: number }).rate ?? 0), 0) ?? 0) },
      { id: 'segments_hp', name: text.metrics.segments_hp, read: () => Math.round(selectedOrFirst()?.character.segments.reduce((sum, segment) => sum + segment.hp, 0) ?? 0) },
      { id: 'last_crossed', name: text.metrics.last_crossed, read: () => lastCrossed },
      { id: 'last_energy', name: text.metrics.last_energy, digits: 2, read: () => lastEnergy },
    ],
    scenarios: (): ModuleScenario<AreaContext>[] => createScenarios(scenarioDeps),
    attach(lent) {
      host = lent
      ensureBuilders(lent.THREE as Three)
      const scene = lent.scene as THREE_NS.Object3D
      const bridge = options.fluids ? createFluidsBridge({ sink: options.fluids, ...(options.film ? { film: options.film } : {}) }) : undefined
      sound = lent.audio && options.sound !== false ? createCharacterSound(lent.audio, options.sound ?? {}) : null
      wounds = createWounds(lent.THREE as Three, { random, scene, groundAt: (x, z) => lent.groundAt(x, z), ...(bridge ? { bridge } : {}), ...(sound ? { sound } : {}) })
      for (const entry of entries.values()) trackEntry(entry)
      const stopChange = lent.bench?.onChange(onChange)
      // a blast shoves the bodies the way the host shoves its loose items, and knocks them down when it is strong enough (the damage itself is the world's)
      const stopEvents = lent.on((event) => {
        if (event.type !== 'explosion') return
        for (const entry of entries.values()) {
          if (!entry.root.parent) continue
          const p = entry.root.position
          const knock = knockOf(event, [p.x, p.y, p.z], bodyMass(entry.character.spec.height, entry.character.spec.build), lent.blastShove)
          if (knock) entry.knock = entry.knock ? { ...knock, lying: entry.knock.lying } : knock
        }
      })
      const stopFrame = lent.onFrame((dt) => {
        time += dt
        for (const [id, entry] of entries) {
          // bodies the room built for its contract checks, or has removed, never reach the scene
          if (!entry.root.parent) {
            entries.delete(id)
            continue
          }
          animate(entry, dt)
        }
        wounds?.update(dt)
        sound?.update(dt)
        crowd?.update(dt, lent.camera as THREE_NS.Camera)
      })
      return () => {
        stopChange?.()
        stopEvents()
        stopFrame()
        clearOverlays()
        wounds?.dispose()
        wounds = null
        sound?.dispose()
        sound = null
        if (crowd) {
          crowd.group.parent?.remove(crowd.group)
          crowd = null
        }
        host = null
      }
    },
  }
}

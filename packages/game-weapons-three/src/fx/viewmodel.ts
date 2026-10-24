import type * as THREE_NS from 'three'
import { createToolClipPlayer, toolAnimationStep } from '@adatechnology/game-contracts'
import type { HostEvent, HostTool, ToolClipPlayer } from '@adatechnology/game-contracts'
import { muzzleEnergy } from '@adatechnology/game-weapons'
import type { Arsenal, CaliberDef, WeaponDef } from '@adatechnology/game-weapons'
import { buildToolClips } from '../animation/clip-set'
import type { WeaponAudio } from '../audio'
import { weaponEventOf } from '../audio/host-events'
import { buildWeaponModelById } from '../models'
import { applyCondition } from '../models/condition'
import { cartridgeShape } from '../models/cartridge'
import { modelKit } from '../models/kit'
import { createEffects } from './effects'
import { createLayers } from './layers'
import type { FxLayers } from './layers'
import { flameJet, launchRocket } from './heavy'
import type { HeavyContext } from './heavy'
import { createParticles } from './particles'
import { createRandom } from './random'
import { createModelRig } from './rig'
import type { FxWorld, Session } from './session'
import { toWorld, worldPositionOf } from './session'
import { createClipEventHandler } from './viewmodel-events'

const PI = Math.PI
// where the weapon sits against the camera: right, down and ahead; long guns are drawn smaller so they do not fill the view
const HAND_OFFSET: [number, number, number] = [0.2, -0.2, -0.42]
const HEAT_DISPLAY_MAX_FALLBACK = 120
// the launcher has no calibre: its shot is the game's `explosao` class, at the volume of a mid-sized blast
const LAUNCH_VOLUME = 0.6

export interface ViewmodelOptions {
  THREE: typeof THREE_NS
  scene: THREE_NS.Scene
  camera: THREE_NS.Camera
  arsenal: Arsenal
  groundAt: (x: number, z: number) => number
  audio: WeaponAudio | null
  /** Seed of the scatter of casings, smoke and sparks. */
  seed?: number
  /** The tool as it is now, for what no event announces: the barrel heat and the fuel burning. */
  tool?: () => HostTool
  /** Wear of the weapon (`new`, `used`, `worn`, `rusty`). */
  condition?: string
  /** What is drawn: read at the moment of each event, so the bench can change it live. */
  layers?: FxLayers
  /** Metres between the shooter and the listener, for the distance muffling of the shot sound (default 0). */
  soundDistance?: () => number
}

/** The weapon in the hands for the models the gallery drew: it follows the camera, plays the clips of the rule's events, and throws casings, magazines and smoke. */
export interface Viewmodel {
  /** Puts the weapon in the hands; false (and the hands stay as they were) when the gallery has no model for it. */
  equip(weapon: string): boolean
  /** Takes the weapon out of the hands. */
  unequip(): void
  handle(event: HostEvent, tool: HostTool): void
  update(dt: number): void
  setCondition(condition: string): void
  readonly inHand: string | null
  readonly casings: number
  readonly magazines: number
  dispose(): void
}

interface Task {
  delay: number
  seconds: number
  elapsed: number
  step: (progress: number, dt: number) => void
  done: (() => void) | undefined
}

const ease = (progress: number): number => (progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2)

const caliberOf = (arsenal: Arsenal, def: WeaponDef): CaliberDef | undefined => (def.action.kind === 'firearm' ? arsenal.calibers.get(def.action.caliber) : undefined)

export function createViewmodel(options: ViewmodelOptions): Viewmodel {
  const { THREE, scene, camera, arsenal, groundAt, audio } = options
  const kit = modelKit(THREE)
  const random = createRandom(options.seed ?? 1)
  const layers = options.layers ?? createLayers()
  const distance = (): number => options.soundDistance?.() ?? 0
  const particles = createParticles(THREE, scene, groundAt)
  particles.onBounce = (kind) => (kind === 'casing' ? audio?.clink() : kind === 'magazine' ? audio?.thud() : undefined)
  const effects = createEffects(kit, scene, particles, random)
  const hand = new THREE.Group()
  hand.name = 'weapon-viewmodel'
  scene.add(hand)
  const holder = new THREE.Group()
  holder.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2)
  hand.add(holder)
  let tasks: Task[] = []
  let session: Session | null = null
  let player: ToolClipPlayer | null = null
  let condition = options.condition ?? 'new'
  let lastAmmo = 0
  let smokeDebt = 0

  const world: FxWorld = {
    kit,
    scene,
    particles,
    effects,
    random,
    audio,
    layers,
    groundAt,
    schedule: (delay, seconds, step, done) => void tasks.push({ delay, seconds, elapsed: 0, step: (progress) => step(ease(progress)), done }),
  }

  const heatMax = arsenal.rules.heat.displayMax || HEAT_DISPLAY_MAX_FALLBACK

  const release = (): void => {
    if (!session) return
    session.model.root.removeFromParent()
    player = null
    session = null
    tasks = []
  }

  const heavy = (current: Session): HeavyContext => ({
    kit,
    scene,
    particles,
    effects,
    random,
    parts: current.model.parts,
    forward: () => toWorld(current, new THREE.Vector3(1, 0, 0)).normalize(),
    positionOf: (part) => worldPositionOf(current, part, new THREE.Vector3()),
    orientation: () => current.model.root.getWorldQuaternion(new THREE.Quaternion()),
    every: (seconds, step, done) => void tasks.push({ delay: 0, seconds, elapsed: 0, step, done }),
    groundAt,
  })

  const equip = (weapon: string): boolean => {
    const def = arsenal.weapons.get(weapon)
    const model = def ? buildWeaponModelById(THREE, weapon) : undefined
    if (!def || !model) return false
    release()
    const length = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).x
    const scale = length > 0.8 ? 0.55 : length > 0.4 ? 0.75 : 1
    holder.scale.setScalar(scale)
    holder.position.set(0, 0, Math.min(0.25, 0.25 * length * scale))
    holder.add(model.root)
    const caliber = caliberOf(arsenal, def)
    const dims = caliber?.cartridge
    session = {
      id: weapon,
      def,
      model,
      holderScale: scale,
      lengthMetres: length,
      caseType: caliber?.caseType ?? 'rifle',
      kit,
      cartridge: caliber && dims ? { dims, shape: cartridgeShape(caliber, dims) } : null,
      stuckCase: null,
      nextChamber: 0,
    }
    const action = def.action
    const reloadFamily = action.kind === 'firearm' || action.kind === 'flame' || action.kind === 'launcher' ? action.family : undefined
    const rpm = action.kind === 'firearm' ? action.rpm : 0
    player = createToolClipPlayer({
      clips: buildToolClips({ parts: model.parts, family: model.parts.family, caseType: session.caseType, reloadFamily }),
      rig: createModelRig(model),
      onEvent: createClipEventHandler(world, session),
      repeatInterval: () => (rpm > 0 ? 60 / rpm : 0.1),
    })
    applyCondition(kit, model, condition)
    lastAmmo = options.tool?.().ammo ?? 0
    return true
  }

  const place = (): void => {
    const [x, y, z] = HAND_OFFSET
    hand.position.set(x, y, z).applyQuaternion(camera.quaternion).add(camera.position)
    hand.quaternion.copy(camera.quaternion)
    hand.updateMatrixWorld(true)
  }

  const glow = (tool: HostTool | undefined): void => {
    if (!session) return
    const heat = (tool?.heat ?? 0) * heatMax
    const level = Math.max(0, Math.min(1, (heat - 50) / 50))
    for (const mesh of session.model.parts.glow) {
      const material = mesh.material as THREE_NS.MeshStandardMaterial
      material.emissive.setRGB(level, 0.2 * level * level, 0.02 * level * level)
      material.emissiveIntensity = 2.2 * level
    }
  }

  const handleShot = (current: Session): void => {
    const action = current.def.action
    if (action.kind === 'launcher') {
      launchRocket(heavy(current))
      audio?.play('explosion', LAUNCH_VOLUME, distance())
    }
    if (action.kind !== 'firearm') return
    const caliber = caliberOf(arsenal, current.def)
    if (!caliber) return
    audio?.shot(muzzleEnergy(caliber) * (caliber.pellets ?? 1), current.def.category, { caliber, distance: distance() })
  }

  return {
    equip,
    unequip: release,
    handle(event, tool) {
      if (event.type === 'explosion') return
      if (event.type === 'tool') equip(event.weapon)
      if (!session || !player || event.weapon !== session.id) return
      const current = session
      if (event.type === 'shot') handleShot(current)
      else if (event.type === 'reload' && event.phase === 'start') current.nextChamber = 0
      else if (event.type === 'clear' && event.phase === 'end') current.stuckCase = null
      const mechanical = weaponEventOf(event)
      if (mechanical) audio?.event(mechanical)
      const step = toolAnimationStep(event)
      if (!step) return
      const last = step.type === 'play' && step.clip === 'shot' && current.model.parts.family === 'pistol' && tool.ammo === 0
      player.apply(last ? { ...step, variant: 'last' } : step)
    },
    update(dt) {
      if (session) {
        place()
        player?.update(dt)
        const tool = options.tool?.()
        glow(tool)
        if (tool && session.def.action.kind === 'flame') {
          if (tool.ammo < lastAmmo) flameJet(heavy(session), dt, session.model.parts.launcherType === 'flame' ? 1 : 0.6)
          lastAmmo = tool.ammo
        }
        if (tool && tool.heat !== undefined && tool.heat * heatMax > 10 && session.model.parts.muzzle) {
          smokeDebt += dt * tool.heat * heatMax * 0.1
          while (smokeDebt > 1) {
            smokeDebt -= 1
            const k = 0.5 + (tool.heat * heatMax) / 60
            effects.smoke(worldPositionOf(session, session.model.parts.muzzle, new THREE.Vector3()), new THREE.Vector3((random() - 0.5) * 0.03, 0.07 + random() * 0.08, (random() - 0.5) * 0.03), 0.007 * k, 1.6 + random(), Math.min(0.42, 0.14 + k * 0.1))
          }
        }
      }
      for (const task of [...tasks]) {
        task.elapsed += dt
        if (task.elapsed < task.delay) continue
        const progress = task.seconds > 0 ? Math.min(1, (task.elapsed - task.delay) / task.seconds) : 1
        task.step(progress, dt)
        if (progress >= 1) {
          task.done?.()
          tasks = tasks.filter((other) => other !== task)
        }
      }
      effects.update(dt)
      particles.update(dt)
    },
    setCondition(next) {
      condition = next
      if (session) applyCondition(kit, session.model, condition)
    },
    get inHand() {
      return session?.id ?? null
    },
    get casings() {
      return particles.count('casing')
    },
    get magazines() {
      return particles.count('magazine')
    },
    dispose() {
      release()
      particles.dispose()
      effects.dispose()
      hand.removeFromParent()
    },
  }
}

import type * as THREE_NS from 'three'
import { createToolClipPlayer, toolAnimationStep } from '@adatechnology/game-contracts'
import type { AnimationPose, EffectSink, HandTargets, HostEvent, HostTool, HostToolAttachment, ToolAnimationStep, ToolClipPlayer, HandPose } from '@adatechnology/game-contracts'
import { createRng, muzzleEnergy } from '@adatechnology/game-weapons'
import type { Arsenal, CaliberDef, FittedAttachment, MountKind, WeaponDef } from '@adatechnology/game-weapons'
import { ease } from '../animation/clip-builder'
import { buildToolClips } from '../animation/clip-set'
import type { WeaponAudio } from '../audio'
import { weaponEventOf } from '../audio/host-events'
import { soundProfileOf } from '../audio/reload-sounds'
import type { SoundProfile } from '../audio/reload-sounds'
import { buildWeaponModelById } from '../models'
import { fitAttachmentModels } from '../models/attachments/fit'
import type { AttachmentModelRegistry, LaserRaycast } from '../models/attachments/types'
import { rigUnderbarrel } from '../models/attachments/rig-underbarrel'
import { rigStock } from '../models/rig-stock'
import { attachmentsKey } from '../attachments-key'
import { VIEWMODEL_NODE_NAME } from '../laser-raycast'
import { applyCondition } from '../models/condition'
import { cartridgeShape } from '../models/cartridge'
import { modelKit } from '../models/kit'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'
import { createEffects } from './effects'
import { createLayers } from './layers'
import { createEyeFrame, limitSupportSpan, placeOnBody } from './body-hold'
import type { FxLayers } from './layers'
import type { LightBudget, RenderPools } from '@adatechnology/game-render-three'
import { createRocketLight, flameJet, launchRocket, type HeavyContext } from './heavy'
import { createParticles } from './particles'
import { createModelRig } from './rig'
import type { FxWorld, Session } from './session'
import { toWorld, worldPositionOf } from './session'
import { createClipEventHandler } from './viewmodel-events'
import { handWorkOf, workWeights } from './hand-work'
import { HAND_HOLD, holdOfModel, targetsOf } from './hand-hold'
import type { Hold } from './hand-hold'

const PI = Math.PI
const HEAT_DISPLAY_MAX_FALLBACK = 120
/** The weapon against a wall: it comes back as far as it needs to stay `margin` in front of it, up to `max` metres, at `rate` per second; the world is probed `probe` metres ahead. */
export const WALL_PULL = { margin: 0.03, max: 1.2, rate: 14, probe: 3 }
/** The grips of the hands stay above this height of the view (-1 is the bottom edge, 0 the middle): a weapon held low (a pistol grip on a short body, a heavy gun) is raised, up to `max` metres, at `rate` per second. */
export const HAND_IN_VIEW = { floor: -0.88, max: 0.3, rate: 10 }
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
  /** Where the world is: the distance from a point along a direction to the first surface (not the weapon in the hands), or null. The weapon in the hands comes back from a wall it would go through. */
  contact?: LaserRaycast
  /** Where the body holds the tool now (`ModuleHost.holdFrame`): the tool is drawn there at its real size in every view; null or absent (no body), the frame of a body's right shoulder under the camera's eye. */
  bodyHold?: () => HandPose | null
  /** Told at every sound cue of a reload clip, at the moment the clip says it (also with no audio). */
  onSound?: (cue: { weapon: string; cue: string; profile: SoundProfile }) => void
  /** Builders of accessory models that replace or add to the ones the kit ships. */
  attachmentModels?: AttachmentModelRegistry
  /** How far a laser beam goes (metres) from a point along a direction, or null when it hits nothing. */
  raycast?: LaserRaycast
  /** The host's effects (`host.effects`): the muzzle flash, the smoke, the backblast and the flame jet are recipes it plays. Without it the viewmodel makes a world of its own for them. */
  effects?: EffectSink
  /** The rocket of a launcher flies out along the barrel (default true); false leaves the round to the host. */
  flyRocket?: boolean
  /** The host's light budget (`host.lights`): the rocket in flight and the weapon light ask it for a light. Without it they create lights of their own (deprecated, removed in the next major). */
  lights?: LightBudget
  /** The host's pools (`host.pools`): the burning droplets and the ground flames of a flamethrower take their geometry and material from them. Without them each makes its own (deprecated, removed in the next major). */
  pools?: RenderPools
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
  /** Where the hands take the weapon now (world space), or null with nothing in the hands. The right hand sits on the grip, the left on the forend, and goes to the magazine while it is changed. */
  handTargets(): HandTargets | null
  readonly inHand: string | null
  /** The clips playing now, with the seconds each lasts. */
  readonly clips: ReadonlyArray<{ name: string; seconds: number }>
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

const fittedOf = (parts: readonly HostToolAttachment[]): FittedAttachment[] =>
  parts.map((part) => ({ id: part.id, mount: part.mount as MountKind, ...(part.integral ? { integral: true } : {}), ...(part.on === undefined ? {} : { on: part.on }) }))

/** The pose the stock pivot holds when the stock is collapsed: a half turn about its axis, or the slide along the weapon. */
const collapsedStockPose = (move: NonNullable<Session['model']['parts']['stockMove']>): AnimationPose => {
  if (move.kind === 'retract') return { position: [move.travel, 0, 0] }
  return { rotation: [move.axis === 'x' ? PI : 0, move.axis === 'y' ? PI : 0, move.axis === 'z' ? PI : 0] }
}

// the shot of the launcher under the barrel and its reload have clips of their own; the rest of the weapon's clips play as they are
const underbarrelStep = (step: ToolAnimationStep, tool: HostTool): ToolAnimationStep => (tool.underbarrelActive && step.type === 'play' && (step.clip === 'shot' || step.clip === 'reload') ? { ...step, variant: 'ugl' } : step)

const caliberOf = (arsenal: Arsenal, def: WeaponDef): CaliberDef | undefined => (def.action.kind === 'firearm' ? arsenal.calibers.get(def.action.caliber) : undefined)

/**
 * The curl of the trigger finger: along the frame (`TRIGGER_FINGER.safe`) until the weapon fires, on the trigger (`ready`) for `readySeconds` after a shot, and pulled in by the turn of the
 * trigger part (the clip's pull, `TRIGGER_TURN` radians), so each shot of a burst or of full auto pulls and releases it; a burst keeps it nearly pulled, with a small tremor per shot.
 */
export const TRIGGER_FINGER = { safe: 0, ready: 0.5, pulled: 1, readySeconds: 1.5, burstSeconds: 0.14, tremor: 0.03 } as const
const TRIGGER_TURN = 0.35
const indexCurl = (turn: number, sinceShot: number): number => {
  const ready = sinceShot < TRIGGER_FINGER.readySeconds ? TRIGGER_FINGER.ready : TRIGGER_FINGER.safe
  const pull = Math.min(1, Math.max(0, turn / TRIGGER_TURN))
  const held = sinceShot < TRIGGER_FINGER.burstSeconds ? TRIGGER_FINGER.pulled - TRIGGER_FINGER.tremor * (0.5 + 0.5 * Math.sin(sinceShot * 220)) : 0
  return Math.max(ready + (TRIGGER_FINGER.pulled - ready) * pull, held)
}

export function createViewmodel(options: ViewmodelOptions): Viewmodel {
  const { THREE, scene, camera, arsenal, groundAt, audio } = options
  const kit = modelKit(THREE)
  const random = createRng(options.seed ?? 1)
  const layers = options.layers ?? createLayers()
  const distance = (): number => options.soundDistance?.() ?? 0
  const particles = createParticles(THREE, scene, groundAt)
  particles.onBounce = (kind) => (kind === 'casing' ? audio?.clink() : kind === 'magazine' ? audio?.thud() : undefined)
  // a host that lends no effect sink gets a world of its own for the flash and the smoke, stepped and drawn here (as `destruction-three` does)
  const ownVfx: VfxRenderer | undefined = options.effects ? undefined : createVfxRenderer(THREE, { scene, camera, vfx: { profile: 'medium' }, ...(options.lights ? { lights: options.lights } : {}) })
  const effects = createEffects(THREE, options.effects ?? ownVfx, random)
  const hand = new THREE.Group()
  hand.name = VIEWMODEL_NODE_NAME
  scene.add(hand)
  const rocketLight = options.lights ? undefined : createRocketLight(THREE)
  if (rocketLight) scene.add(rocketLight)
  const holder = new THREE.Group()
  holder.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2)
  hand.add(holder)
  let tasks: Task[] = []
  let session: Session | null = null
  let player: ToolClipPlayer | null = null
  let condition = options.condition ?? 'new'
  let lastAmmo = 0
  let smokeDebt = 0
  let secondsSinceShot = Number.POSITIVE_INFINITY
  let hold: Hold | null = null
  let reloading = false
  let magazineHand = 0
  // the trigger finger: the seconds since the last shot and the turn of the trigger part at rest
  let clock = 0
  let lastShot = -Infinity
  let triggerRest = 0
  // whether the feed clip of the weapon in the hands carries its own sound
  let feedCued = false
  const rootQuaternion = new THREE.Quaternion()

  const world: FxWorld = {
    kit,
    scene,
    particles,
    effects,
    random,
    audio,
    layers,
    groundAt,
    sound: (weapon, cue, profile) => {
      audio?.cue(cue, profile)
      options.onSound?.({ weapon, cue, profile })
    },
    schedule: (delay, seconds, step, done) => void tasks.push({ delay, seconds, elapsed: 0, step: (progress) => step(ease(progress)), done }),
  }

  const heatMax = arsenal.rules.heat.displayMax || HEAT_DISPLAY_MAX_FALLBACK
  const visual = arsenal.rules.heat.visual
  const hasSuppressor = (parts: readonly FittedAttachment[]): boolean => parts.some((part) => arsenal.attachments.get(part.id)?.kind === 'suppressor')

  const release = (): void => {
    if (!session) return
    session.attachments?.dispose()
    session.model.root.removeFromParent()
    player = null
    session = null
    tasks = []
    hold = null
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
    ...(options.lights ? { lights: options.lights } : {}),
    ...(options.pools ? { pools: options.pools } : {}),
    ...(rocketLight ? { rocketLight } : {}),
  })

  const equip = (weapon: string): boolean => {
    const def = arsenal.weapons.get(weapon)
    const model = def ? buildWeaponModelById(THREE, weapon) : undefined
    if (!def || !model) return false
    release()
    hold = null
    reloading = false
    magazineHand = 0
    reach = 0
    pull = 0
    lift = 0
    rigStock(THREE, model, def)
    rigUnderbarrel(THREE, model, def)
    const modelBox = new THREE.Box3().setFromObject(model.root)
    const length = modelBox.getSize(new THREE.Vector3()).x
    modelRear = modelBox.min.x
    holder.add(model.root)
    const caliber = caliberOf(arsenal, def)
    const dims = caliber?.cartridge
    const hostTool = options.tool?.()
    const onTool = hostTool?.weapon === weapon ? hostTool : undefined
    const fitted = onTool?.attachments ? fittedOf(onTool.attachments) : [...(def.fitted ?? [])]
    session = {
      id: weapon,
      def,
      caliber,
      model,
      holderScale: 1,
      lengthMetres: length,
      caseType: caliber?.caseType ?? 'rifle',
      soundProfile: soundProfileOf(weapon, model.parts.family),
      kit,
      cartridge: caliber && dims ? { dims, shape: cartridgeShape(caliber, dims) } : null,
      stuckCase: null,
      nextChamber: 0,
      attachments: null,
      attachmentsSignature: '',
      suppressed: onTool?.suppressed ?? hasSuppressor(fitted),
    }
    session.attachments = fitAttachmentModels(model, fitted, kit, { catalogue: arsenal.attachments, isDrawn: () => layers.attachments, areBeamsOn: () => layers.beams, ...(options.attachmentModels ? { overrides: options.attachmentModels } : {}), ...(options.raycast ? { raycast: options.raycast } : {}), ...(options.lights ? { lights: options.lights } : {}) })
    session.attachmentsSignature = attachmentsKey(onTool?.attachments)
    const action = def.action
    const reloadFamily = action.kind === 'firearm' || action.kind === 'flame' || action.kind === 'launcher' ? action.family : undefined
    const rpm = action.kind === 'firearm' ? action.rpm : 0
    const rig = createModelRig(model)
    const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: session.caseType, reloadFamily })
    feedCued = clips.feed?.events?.some((entry) => entry.type === 'sound') ?? false
    player = createToolClipPlayer({
      clips,
      rig,
      onEvent: createClipEventHandler(world, session),
      repeatInterval: () => (rpm > 0 ? 60 / rpm : 0.1),
    })
    if (model.parts.stockMove && onTool?.stock === 'collapsed') rig.setPartPose('stock', collapsedStockPose(model.parts.stockMove))
    applyCondition(kit, model, condition)
    lastAmmo = options.tool?.().ammo ?? 0
    hand.updateMatrixWorld(true)
    hold = holdOfModel(THREE, model, 1)
    hold = { ...hold, works: handWorkOf(THREE, model, weapon, hold.right) }
    triggerRest = model.parts.trigger?.rotation.z ?? 0
    lastShot = -Infinity
    return true
  }

  const syncAttachments = (current: Session, tool: HostTool | undefined): void => {
    if (!current.attachments || tool?.weapon !== current.id) return
    if (tool.suppressed !== undefined) current.suppressed = tool.suppressed
    if (!tool.attachments) return
    const signature = attachmentsKey(tool.attachments)
    if (signature === current.attachmentsSignature) return
    current.attachmentsSignature = signature
    const fitted = fittedOf(tool.attachments)
    if (tool.suppressed === undefined) current.suppressed = hasSuppressor(fitted)
    current.attachments.sync(fitted)
  }

  // the weapon against a wall: how far it reaches in front of the eye (measured once, with no pull) and how far it is pulled back now
  let reach = 0
  let pull = 0
  // how far the weapon is raised to keep the hands on it in view
  let lift = 0
  const ahead = new THREE.Vector3()
  const up = new THREE.Vector3()
  const seen = new THREE.Vector3()
  const eyeTurn = new THREE.Quaternion()
  const corner = new THREE.Vector3()
  const bounds = new THREE.Box3()
  const measureReach = (current: Session): number => {
    bounds.setFromObject(current.model.root)
    let farthest = 0
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) farthest = Math.max(farthest, corner.set(x, y, z).sub(camera.position).dot(ahead))
    return farthest
  }

  // the tool is the body's own, at its real size, in every view
  let modelRear = 0
  const eyeFrame = createEyeFrame(THREE, camera)
  /** How far the weapon, as placed, has to rise for the grips of both hands to stay above `HAND_IN_VIEW.floor` of the view (the grips fixed on the model, not the hands, which move to the port and the magazine, nor a hand on a part that slides). */
  const liftToKeepInView = (): number => {
    if (!hold || !session || !('fov' in camera)) return 0
    const tanHalf = Math.tan((((camera as THREE_NS.PerspectiveCamera).fov ?? 70) * PI) / 360)
    eyeTurn.copy(camera.quaternion).invert()
    const rest = targetsOf(THREE, hold, session.model.root.getWorldQuaternion(rootQuaternion), 0)
    let needed = 0
    for (const [anchor, pose] of [[hold.right, rest.R], [hold.left, rest.L]] as const) {
      if (!anchor || !pose || anchor.part !== session.model.root) continue
      seen.set(...pose.position).sub(camera.position).applyQuaternion(eyeTurn)
      if (-seen.z > 0.05) needed = Math.max(needed, HAND_IN_VIEW.floor * -seen.z * tanHalf - seen.y)
    }
    return Math.max(0, Math.min(HAND_IN_VIEW.max, needed))
  }
  const place = (dt = 0): void => {
    if (!session) return
    const family = session.model.parts.family
    session.holderScale = 1
    placeOnBody({ THREE, hand, holder, frame: options.bodyHold?.() ?? eyeFrame(), rear: modelRear, lengthMetres: session.lengthMetres, handgun: family === 'pistol' || family === 'revolver', right: hold?.right ?? null, left: hold?.left ?? null })
    hand.updateMatrixWorld(true)
    lift += (liftToKeepInView() - lift) * Math.min(1, dt * HAND_IN_VIEW.rate)
    if (lift > 1e-4) hand.position.addScaledVector(up.set(0, 1, 0).applyQuaternion(camera.quaternion), lift)
    hand.updateMatrixWorld(true)
    if (!options.contact) return
    ahead.set(0, 0, -1).applyQuaternion(camera.quaternion)
    if (reach === 0) reach = Math.max(0.01, measureReach(session))
    const free = options.contact(camera.position, ahead, WALL_PULL.probe)
    const want = free === null ? 0 : Math.max(0, Math.min(WALL_PULL.max, reach + WALL_PULL.margin - free))
    pull += (want - pull) * Math.min(1, dt * WALL_PULL.rate)
    if (pull < 1e-4) return
    hand.position.addScaledVector(ahead, -pull)
    hand.updateMatrixWorld(true)
  }

  const glow = (tool: HostTool | undefined): void => {
    if (!session) return
    const heat = (tool?.heat ?? 0) * heatMax
    const level = Math.max(0, Math.min(1, (heat - visual.glowFrom) / visual.glowSpan))
    for (const mesh of session.model.parts.glow) {
      const material = mesh.material as THREE_NS.MeshStandardMaterial
      material.emissive.setRGB(level, 0.2 * level * level, 0.02 * level * level)
      material.emissiveIntensity = 2.2 * level
    }
  }

  const handleShot = (current: Session, event: Extract<HostEvent, { type: 'shot' }>, tool: HostTool): void => {
    secondsSinceShot = 0
    if (event.suppressed !== undefined) current.suppressed = event.suppressed
    else if (tool.suppressed !== undefined) current.suppressed = tool.suppressed
    else current.suppressed = hasSuppressor(tool.attachments ? fittedOf(tool.attachments) : (current.def.fitted ?? []))
    if (tool.underbarrelActive && current.model.parts.uglMuzzle) {
      audio?.play('explosion', LAUNCH_VOLUME, distance())
      return
    }
    const action = current.def.action
    if (action.kind === 'launcher') {
      launchRocket(heavy(current), options.flyRocket !== false)
      audio?.play('explosion', LAUNCH_VOLUME, distance())
    }
    if (action.kind !== 'firearm') return
    const caliber = caliberOf(arsenal, current.def)
    if (!caliber) return
    audio?.shot(muzzleEnergy(caliber) * (caliber.pellets ?? 1), current.def.category, { caliber, distance: distance(), ...(current.suppressed ? { suppressed: true } : {}) })
  }

  return {
    equip,
    unequip: release,
    handle(event, tool) {
      if (event.type === 'explosion' || event.type === 'player') return
      if (event.type === 'tool') equip(event.weapon)
      if (!session || !player || event.weapon !== session.id) return
      const current = session
      if (event.type === 'shot') {
        lastShot = clock
        handleShot(current, event, tool)
      }
      else if (event.type === 'reload' && event.phase === 'start') {
        current.nextChamber = 0
        reloading = true
      } else if (event.type === 'reload' && event.phase === 'end') reloading = false
      else if (event.type === 'clear' && event.phase === 'end') current.stuckCase = null
      const mechanical = weaponEventOf(event)
      // the clips of the model say when each step of a reload makes its noise (`sound` cues): the rule's stage and feed events would sound it twice
      const cued = mechanical?.type === 'feed' ? feedCued : mechanical?.type === 'reload_stage' && (player.running.some(({ clip }) => clip.events?.some((entry) => entry.type === 'sound')) ?? false)
      if (mechanical && !cued) audio?.event(mechanical)
      const step = toolAnimationStep(event)
      if (!step) return
      const last = step.type === 'play' && step.clip === 'shot' && current.model.parts.family === 'pistol' && tool.ammo === 0
      player.apply(last ? { ...step, variant: 'last' } : underbarrelStep(step, tool))
    },
    update(dt) {
      clock += dt
      if (session) {
        place(dt)
        player?.update(dt)
        const wantsMagazine = reloading || options.tool?.().reloading === true
        magazineHand += ((wantsMagazine ? 1 : 0) - magazineHand) * Math.min(1, dt * HAND_HOLD.magRate)
        const tool = options.tool?.()
        syncAttachments(session, tool)
        session.attachments?.update()
        glow(tool)
        if (tool && session.def.action.kind === 'flame') {
          if (tool.ammo < lastAmmo) {
            flameJet(heavy(session), dt, session.model.parts.launcherType === 'flame' ? 1 : 0.6)
            // a flamethrower has no shot event: the trigger is down while the fuel burns
            lastShot = clock
          }
          lastAmmo = tool.ammo
        }
        secondsSinceShot += dt
        if (tool && tool.heat !== undefined && tool.heat * heatMax > visual.smokeFrom && secondsSinceShot < visual.smokeSeconds && session.model.parts.muzzle) {
          smokeDebt += dt * (tool.heat * heatMax - visual.smokeFrom) * 0.1
          while (smokeDebt > 1) {
            smokeDebt -= 1
            const k = 0.5 + (tool.heat * heatMax - visual.smokeFrom) / 60
            effects.smoke(worldPositionOf(session, session.model.parts.muzzle, new THREE.Vector3()), new THREE.Vector3((random() - 0.5) * 0.015, 0.07 + random() * 0.08, (random() - 0.5) * 0.015), 0.004 * k, 1.2 + random() * 0.6, Math.min(0.18, 0.06 + k * 0.04))
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
      particles.update(dt)
      ownVfx?.update(dt)
    },
    setCondition(next) {
      condition = next
      if (session) applyCondition(kit, session.model, condition)
    },
    handTargets() {
      if (!session || !hold) return null
      hand.updateMatrixWorld(true)
      const targets = targetsOf(THREE, hold, session.model.root.getWorldQuaternion(rootQuaternion), magazineHand, hold.works ? workWeights(hold.works, player?.running ?? []) : undefined)
      const trigger = session.model.parts.trigger
      if (trigger) targets.fingers = { index: indexCurl(trigger.rotation.z - triggerRest, clock - lastShot) }
      return limitSupportSpan(targets)
    },
    get inHand() {
      return session?.id ?? null
    },
    get clips() {
      return (player?.running ?? []).map(({ name, clip }) => ({ name, seconds: clip.duration }))
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
      ownVfx?.dispose()
      hand.removeFromParent()
      rocketLight?.removeFromParent()
      rocketLight?.dispose()
    },
  }
}

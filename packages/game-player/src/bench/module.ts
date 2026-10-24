import type { BenchChange, ModuleControl, ModuleHost, ModuleMetric, ModuleScenario, TestableModule } from '@adatechnology/game-contracts'

import { playerTextOf } from '../locales'
import { createPlayer } from '../player'
import type { Player, PlayerOptions } from '../player'
import type { PlayerAction, PlayerCrowd, PlayerInput } from '../types'
import { playerBenchTextOf } from './locale'

export type PlayerTestModuleOptions = PlayerOptions & { readonly locale?: string }

/** What the scenarios use of the context the test room passes. */
export interface PlayerScenarioLike {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export type PlayerTestModule = TestableModule<PlayerScenarioLike> & {
  /** The player in use (replaced when the bench changes the sheet, the seed or the infection). */
  readonly player: Player
}

type CameraLike = { position: { x: number; y: number; z: number }; rotation?: { y: number }; getWorldDirection?(target: unknown): { x: number; z: number } }
type ThreeLike = { Vector3?: new () => { x: number; y: number; z: number } }

const MOVING_SPEED = 0.2
const SPRINT_SPEED = 3.4
const FRAME = 1 / 30

/**
 * One agent standing behind the player for the grab test: the bench has no crowd, so this is the hand that holds. It follows `hold`, takes
 * the shove and the knife, and leaves the count once it lets go.
 */
const createGrabber = () => {
  const agent = { x: 0, z: 0, on: false, stunned: 0, hits: 0 }
  const crowd: PlayerCrowd = {
    count: () => (agent.on ? 1 : 0),
    active: () => agent.on,
    x: () => agent.x,
    z: () => agent.z,
    y: () => 0,
    floor: () => 0,
    chasing: () => agent.on,
    down: () => agent.stunned > 0,
    hold(_i, x, z, k) {
      agent.x += (x - agent.x) * k
      agent.z += (z - agent.z) * k
    },
    stun(_i, seconds) {
      agent.stunned = seconds
      agent.on = false
    },
    chase() {
      agent.on = false
    },
    damage() {
      agent.hits += 1
      agent.on = false
    },
  }
  return { agent, crowd }
}

/**
 * The player area of a test room, against the generic contracts only. The room's camera is the player: where it walks, the player walks; its speed
 * decides walking or running, so stamina, footsteps and their noise follow the viewer. The bench hurts, bites, grabs and knocks the player down,
 * switches the individual infection (off by default: a normal world) and sets the sheet. Footsteps and flesh sounds go to `host.audio`.
 */
export function createPlayerTestModule(options: PlayerTestModuleOptions = {}): PlayerTestModule {
  const locale = options.locale ?? 'pt-BR'
  const text = playerBenchTextOf(locale)
  const { locale: _locale, ...playerOptions } = options
  void _locale
  const settings = { infection: options.infection === undefined ? false : options.infection !== false, agility: options.attributes?.agility ?? 5, vigor: options.attributes?.vigor ?? 5, seed: options.seed ?? 1 }
  let host: ModuleHost | null = null
  const grabber = createGrabber()
  let lastNoise = 0
  let steps = 0
  let lastMessage = ''
  let pending: Partial<Record<PlayerAction, boolean>> = {}
  let bandage = false
  let last: { x: number; z: number } | null = null
  const offs: (() => void)[] = []

  const build = (): Player => {
    for (const off of offs.splice(0)) off()
    const made = createPlayer({ ...playerOptions, seed: settings.seed, infection: settings.infection, attributes: { ...playerOptions.attributes, agility: settings.agility, vigor: settings.vigor } })
    offs.push(made.on('noise', (e) => void (lastNoise = e.radius)))
    offs.push(made.on('step', () => void (steps += 1)))
    offs.push(made.on('message', (e) => void (lastMessage = playerTextOf(e.id, locale))))
    offs.push(made.on('sound', (e) => void host?.audio?.play({ sound: e.sound, volume: e.volume, position: e.position })))
    offs.push(made.on('died', (e) => host?.log(`player died: ${e.cause}`, { cause: e.cause })))
    lastNoise = 0
    steps = 0
    lastMessage = ''
    return made
  }
  let player = build()

  const view = (): { x: number; z: number; yaw: number } | null => {
    const camera = host?.camera as CameraLike | undefined
    if (!camera?.position) return null
    const Vector3 = (host?.THREE as ThreeLike | undefined)?.Vector3
    if (camera.getWorldDirection && Vector3) {
      const look = camera.getWorldDirection(new Vector3())
      return { x: camera.position.x, z: camera.position.z, yaw: Math.atan2(-look.x, -look.z) }
    }
    return { x: camera.position.x, z: camera.position.z, yaw: camera.rotation?.y ?? 0 }
  }

  const frame = (dt: number): void => {
    const here = view()
    const speed = here && last && dt > 0 ? Math.hypot(here.x - last.x, here.z - last.z) / dt : 0
    if (here) {
      player.state.x = here.x
      player.state.z = here.z
    }
    const input: PlayerInput = { forward: speed > MOVING_SPEED ? 1 : 0, run: speed > SPRINT_SPEED, yaw: here?.yaw ?? 0, bandage, pressed: pending }
    pending = {}
    bandage = false
    player.update(dt, input, { crowd: grabber.crowd })
    if (here) {
      player.state.x = here.x
      player.state.z = here.z
      last = { x: here.x, z: here.z }
    }
    if (grabber.agent.stunned > 0) grabber.agent.stunned = Math.max(0, grabber.agent.stunned - dt)
  }

  const grab = (): void => {
    const P = player.state
    grabber.agent.on = true
    grabber.agent.x = P.x - Math.sin(P.yaw) * player.numbers.grabOffset
    grabber.agent.z = P.z - Math.cos(P.yaw) * player.numbers.grabOffset
    player.grab(0)
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'action') {
      const id = change.id
      if (id === 'hurt') player.hurt(10)
      else if (id === 'bite') player.bite()
      else if (id === 'grab') grab()
      else if (id === 'knock') player.knock(1.5)
      else if (id === 'bandage') bandage = true
      else if (id === 'push' || id === 'knife' || id === 'crouch') pending = { ...pending, [id]: true }
      else if (id === 'reset') player = build()
      return
    }
    if (change.kind !== 'control') return
    const { id, value } = change
    if (id === 'infection' && typeof value === 'boolean' && value !== settings.infection) settings.infection = value
    else if ((id === 'agility' || id === 'vigor' || id === 'seed') && typeof value === 'number' && value !== settings[id]) settings[id] = value
    else return
    player = build()
  }

  const controls = (): ModuleControl[] => [
    { kind: 'boolean', id: 'infection', name: text.controls.infection, hint: text.hints.infection, default: settings.infection },
    { kind: 'number', id: 'agility', name: text.controls.agility, hint: text.hints.agility, min: 1, max: 8, step: 1, default: settings.agility },
    { kind: 'number', id: 'vigor', name: text.controls.vigor, hint: text.hints.vigor, min: 1, max: 8, step: 1, default: settings.vigor },
    { kind: 'number', id: 'seed', name: text.controls.seed, hint: text.hints.seed, min: 1, max: 9999, step: 1, default: settings.seed },
    { kind: 'action', id: 'hurt', name: text.controls.hurt },
    { kind: 'action', id: 'bite', name: text.controls.bite },
    { kind: 'action', id: 'grab', name: text.controls.grab, hint: text.hints.grab },
    { kind: 'action', id: 'push', name: text.controls.push, hint: text.hints.push },
    { kind: 'action', id: 'knife', name: text.controls.knife },
    { kind: 'action', id: 'bandage', name: text.controls.bandage },
    { kind: 'action', id: 'knock', name: text.controls.knock },
    { kind: 'action', id: 'crouch', name: text.controls.crouch },
    { kind: 'action', id: 'reset', name: text.controls.reset },
  ]

  const stageName = (): string => (player.state.alive ? text.stages[player.stage()] : text.stages.dead)
  const metrics = (): ModuleMetric[] => [
    { id: 'health', name: text.metrics.health, digits: 1, max: player.derived.maxHealth, read: () => Math.max(0, player.state.health) },
    { id: 'stamina', name: text.metrics.stamina, digits: 1, max: player.derived.maxStamina, read: () => player.state.stamina },
    { id: 'bleeding', name: text.metrics.bleeding, read: () => (player.state.bleeding ? text.yes : text.no) },
    { id: 'wounds', name: text.metrics.wounds, digits: 0, read: () => player.state.wounds.length },
    { id: 'stage', name: text.metrics.stage, read: stageName },
    { id: 'time_left', name: text.metrics.time_left, unit: 's', digits: 0, read: () => player.timeLeft() ?? 0 },
    { id: 'panic', name: text.metrics.panic, digits: 1, read: () => player.state.panic },
    { id: 'spread', name: text.metrics.spread, digits: 2, read: () => player.spreadFactor() },
    { id: 'grab_timer', name: text.metrics.grab, unit: 's', digits: 1, read: () => (player.state.grabbedBy >= 0 ? player.state.grabTimer : 0) },
    { id: 'noise', name: text.metrics.noise, unit: 'm', digits: 1, read: () => lastNoise },
    { id: 'steps', name: text.metrics.steps, digits: 0, read: () => steps },
    { id: 'message', name: text.metrics.message, read: () => lastMessage },
  ]

  // each scenario runs its own player, so the bench's live one is not touched
  const fresh = (extra: PlayerOptions = {}): Player => createPlayer({ ...playerOptions, ...extra })
  const run = (made: Player, seconds: number, input: PlayerInput = {}, crowd?: PlayerCrowd): void => {
    for (let t = 0; t < seconds; t += FRAME) made.update(FRAME, input, crowd ? { crowd } : undefined)
  }
  const scenarios = (): Array<ModuleScenario<PlayerScenarioLike>> => [
    {
      id: 'player_stamina',
      name: text.scenarios.stamina,
      run: ({ expect }) => {
        const made = fresh({ seed: 1 })
        const full = made.state.stamina
        run(made, 4, { forward: 1, run: true })
        const tired = made.state.stamina
        expect(tired < full - 40, 'four seconds of running spend 48 of stamina', { full, tired })
        run(made, 3)
        expect(made.state.stamina > tired, 'standing still gives it back', { tired, rested: made.state.stamina })
      },
    },
    {
      id: 'player_bleed_bandage',
      name: text.scenarios.bleed_bandage,
      run: ({ expect }) => {
        const made = fresh({ seed: 1 })
        made.bite()
        const after = made.state.health
        run(made, 2)
        expect(made.state.bleeding === 1 && made.state.health < after, 'the wound bleeds', { health: made.state.health })
        run(made, FRAME, { bandage: true })
        const dressed = made.state.health
        run(made, 2)
        expect(made.state.bleeding === 0 && made.state.health === dressed, 'dressed, it stops', { health: made.state.health })
      },
    },
    {
      id: 'player_normal_world',
      name: text.scenarios.normal_world,
      run: ({ expect }) => {
        const made = fresh({ seed: 1, infection: false })
        made.bite()
        run(made, 10)
        expect(!made.state.infected && made.state.health < made.derived.maxHealth, 'bitten, hurt, not infected', { health: made.state.health })
      },
    },
    {
      id: 'player_infection_kills',
      name: text.scenarios.infection_kills,
      run: ({ expect }) => {
        const made = fresh({ seed: 1, infection: true })
        made.bite()
        run(made, FRAME, { bandage: true })
        run(made, 40)
        expect(made.stage() === 'fever', 'fever after 30 s', { stage: made.stage() })
        run(made, 90)
        expect(!made.state.alive && made.state.cause === 'infection', 'dead at 120 s', { cause: made.state.cause })
      },
    },
    {
      id: 'player_grab_break_free',
      name: text.scenarios.grab_break_free,
      run: ({ expect }) => {
        const made = fresh({ seed: 1 })
        const { agent, crowd } = createGrabber()
        agent.on = true
        made.grab(0)
        for (let push = 0; push < 6; push++) {
          made.update(FRAME, { pressed: { push: true } }, { crowd })
          made.update(FRAME, {}, { crowd })
        }
        expect(made.state.grabbedBy === -1 && made.state.wounds.length === 0, 'free, and no bite', { grabbedBy: made.state.grabbedBy })
      },
    },
    {
      id: 'player_determinism',
      name: text.scenarios.determinism,
      run: ({ expect }) => {
        const wounds = (seed: number): string => {
          const made = fresh({ seed })
          for (let k = 0; k < 12; k++) made.hurt(1)
          return made.state.wounds.join(',')
        }
        expect(wounds(4) === wounds(4), 'the same seed gives the same wounds')
        expect(wounds(4) !== wounds(5), 'another seed gives others')
      },
    },
  ]

  const module: PlayerTestModule = {
    id: 'player_area',
    name: text.name,
    group: text.group,
    get player() {
      return player
    },
    items: () => [],
    controls: () => controls(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    attach(lent) {
      host = lent
      last = null
      const off = lent.bench?.onChange(onChange)
      const offFrame = lent.onFrame(frame)
      return () => {
        off?.()
        offFrame()
        host = null
      }
    },
  }
  return module
}

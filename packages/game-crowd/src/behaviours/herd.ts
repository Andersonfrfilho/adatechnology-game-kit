import type { Crowd } from '../crowd'
import { STATE } from '../types'

/** What an animal does besides wandering and fleeing; each is optional, an animal without one only wanders and flees. */
export type HerdRole = {
  /** Wanders within this many metres of home (8). */
  readonly range?: number
  /** Flees from the target closer than this and from agents closer than `fear·1.5 + 2` (5; 0 never flees). */
  readonly fear?: number
  /** Calls when it flees (the hen): sound, noise radius, cooldown. */
  readonly fleeCall?: { readonly sound: string; readonly noise: number; readonly cooldown: number }
  /** Alarm when the target comes within `range` (the lapwing): flies for `fly` s. */
  readonly alarm?: { readonly range: number; readonly sound: string; readonly noise: number; readonly cooldown: number; readonly fly: number }
  /** Now and then calls loud (the cow): chance per second, sound, noise, cooldown. */
  readonly call?: { readonly chance: number; readonly sound: string; readonly noise: number; readonly cooldown: number }
  /** Barks at agents within `bark` m and growls at agents within `growl` m when it is the target's companion (the dog). */
  readonly guard?: { readonly bark: number; readonly barkNoise: number; readonly barkCooldown: number; readonly growl: number; readonly growlCooldown: number; readonly sound: string }
}

export type HerdAnimalSpec = HerdRole & {
  /** The species id (any registry: `game-animals-species` has the 13 of the deliveries). */
  readonly species: string
  readonly x: number
  readonly z: number
  /** The species' gait rates and its size (`game-animals` `quadrupedLayout(body).size`, `birdSize(body)`). */
  readonly walkHz: number
  readonly runHz: number
  readonly size: number
  /** Follows 2.2 m behind the target (the companion dog). */
  readonly companion?: boolean
  /** A carcass: it does not move (the vultures circle it). */
  readonly dead?: boolean
  /** A bird of the sky (the vulture): only the flock moves it. */
  readonly sky?: boolean
}

export type HerdAnimal = {
  readonly index: number
  readonly spec: HerdAnimalSpec
  x: number
  z: number
  yaw: number
  homeX: number
  homeZ: number
  range: number
  fear: number
  clip: 'idle' | 'walk' | 'run'
  timer: number
  targetX: number
  targetZ: number
  fly: number
  cooldown: number
  walkSpeed: number
  runSpeed: number
  companion: boolean
  dead: boolean
  /** The nearest agent seen in the last look (index and distance), refreshed about a quarter of the time. */
  near: readonly [number, number] | null | undefined
}

export type HerdEventMap = {
  sound: { sound: string; volume: number; position: [number, number, number]; distance: number; animal: number }
  noise: { x: number; z: number; radius: number; animal: number }
  message: { id: 'alarm' | 'bark' | 'growl'; seconds: number; animal: number; distance?: number }
}
export type HerdEventName = keyof HerdEventMap

export type HerdNumbers = {
  readonly range: number
  readonly fear: number
  readonly walkFactor: number
  readonly walkBase: number
  readonly runFactor: number
  readonly runBase: number
  readonly activeDistance: number
  readonly companionBehind: number
  readonly companionRun: number
  readonly companionStop: number
  readonly retargetTries: number
  readonly restBase: number
  readonly restRandom: number
  readonly lookEvery: number
  readonly lookShare: number
  readonly lookRadius: number
  readonly fearAgentFactor: number
  readonly fearAgentBase: number
  readonly fleeStep: number
  readonly arrive: number
  readonly bodyHeight: number
  readonly turn: number
  readonly freeHeight: number
  readonly worldMargin: number
}

/** The game's numbers (`jogo.js` G 66592-66700 `bichoNovo`, `bichoLivre`, `bichosUpdate`). */
export const HERD_DEFAULTS: HerdNumbers = {
  range: 8,
  fear: 5,
  walkFactor: 1.05,
  walkBase: 0.25,
  runFactor: 2.2,
  runBase: 0.8,
  activeDistance: 70,
  companionBehind: 2.2,
  companionRun: 6,
  companionStop: 0.8,
  retargetTries: 6,
  restBase: 4,
  restRandom: 7,
  lookEvery: 7,
  lookShare: 0.25,
  lookRadius: 40,
  fearAgentFactor: 1.5,
  fearAgentBase: 2,
  fleeStep: 6,
  arrive: 0.3,
  bodyHeight: 0.3,
  turn: 6,
  freeHeight: 0.6,
  worldMargin: 4,
}

/**
 * The roles of the animals of the deliveries, by `game-animals-species` id: what `bichosPovoar` gives each one (`jogo.js` G 66607-66623) and the
 * calls of `bichosUpdate` (hen 30 m every 6 s; lapwing 12 m, 40 m, flies 4 s; cow 80 m, 2% a second, every 30 s; dog barks under 12 m, 60 m, every
 * 3 s, growls under 40 m every 10 s). A game passes its own or changes one.
 */
export const HERD_ROLES: Readonly<Record<string, HerdRole & { readonly sky?: boolean }>> = {
  dog: { range: 6, fear: 0, guard: { bark: 12, barkNoise: 60, barkCooldown: 3, growl: 40, growlCooldown: 10, sound: 'bark' } },
  cat: { range: 6, fear: 5 },
  chicken: { range: 5, fear: 4, fleeCall: { sound: 'cluck', noise: 30, cooldown: 6 } },
  southern_lapwing: { range: 5, fear: 0, alarm: { range: 12, sound: 'lapwing', noise: 40, cooldown: 8, fly: 4 } },
  cow: { range: 10, fear: 6, call: { chance: 0.02, sound: 'moo', noise: 80, cooldown: 30 } },
  horse: { range: 10, fear: 7 },
  pig: { range: 5, fear: 3 },
  capybara: { range: 8, fear: 15 },
  vulture: { sky: true },
}

export type HerdOptions = {
  /** Where the camera is: animals farther than 70 m rest, and sounds carry their distance from here. Default: the target. */
  readonly view?: () => { readonly x: number; readonly z: number }
  /** A spot an animal must not wander into (inside a building). */
  readonly blocked?: (x: number, z: number) => boolean
  readonly numbers?: Partial<HerdNumbers>
}

export type Herd = {
  readonly list: readonly HerdAnimal[]
  /** Adds an animal (draws its heading and its first rest, as the game does). */
  add(spec: HerdAnimalSpec): HerdAnimal
  /** A free spot `r0` to `r1` m from (x, z), or null (G 66601 `bichoLivre`). */
  free(x: number, z: number, r0: number, r1: number, tries?: number): [number, number] | null
  /** Wander, flee, follow, call (G 66648 `bichosUpdate`, without the drawing). */
  update(dt: number): void
  /** The time the herd has run (the flock reads it). */
  readonly time: number
  setCompanion(index: number, on: boolean): void
  on<K extends HerdEventName>(event: K, listener: (event: HerdEventMap[K]) => void): () => void
}

/**
 * Animals on a crowd: a literal port of the team game's animals (`jogo.js` G 66592-66700). Each wanders around home and rests 4 to 11 s, flees
 * from the target and from the crowd's agents, and may call, raise an alarm or guard the target as its companion. The calls are noises the crowd
 * hears. The drawing and the bones are the game's (`game-animals-three`).
 */
export function createHerd(crowd: Crowd, options: HerdOptions = {}): Herd {
  const N: HerdNumbers = { ...HERD_DEFAULTS, ...options.numbers }
  const R = crowd.random
  const Z = crowd.store
  const grid = crowd.grid
  const list: HerdAnimal[] = []
  let time = 0
  const listeners = new Map<HerdEventName, Set<(event: never) => void>>()
  const emit = <K extends HerdEventName>(event: K, payload: HerdEventMap[K]): void => {
    for (const listener of listeners.get(event) ?? []) (listener as (event: HerdEventMap[K]) => void)(payload)
  }
  const view = options.view ?? (() => crowd.target?.state ?? { x: 0, z: 0 })
  const free = (x0: number, z0: number, r0: number, r1: number, tries = 40): [number, number] | null => {
    for (let k = 0; k < tries; k++) {
      const a = R() * 6.28
      const r = r0 + R() * (r1 - r0)
      const x = x0 + Math.cos(a) * r
      const z = z0 + Math.sin(a) * r
      if (Math.abs(x) < grid.half - N.worldMargin && Math.abs(z) < grid.half - N.worldMargin && !grid.solidAt(x, z, N.freeHeight) && !options.blocked?.(x, z)) return [x, z]
    }
    return null
  }
  // the nearest live agent (the crowd's grid is costly for this; the fauna is small, so it sweeps all)
  const nearestAgent = (x: number, z: number, r: number): [number, number] | null => {
    let best = -1
    let bd = r * r
    for (let i = 0; i < Z.n; i++) {
      if (Z.state[i] === STATE.DORMANT) continue
      const dx = Z.x[i]! - x
      const dz = Z.z[i]! - z
      const d = dx * dx + dz * dz
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best < 0 ? null : [best, Math.sqrt(bd)]
  }
  const call = (E: HerdAnimal, sound: string, noise: number, dc: number): void => {
    crowd.emitNoise(E.x, E.z, noise)
    emit('noise', { x: E.x, z: E.z, radius: noise, animal: E.index })
    emit('sound', { sound, volume: 1, position: [E.x, 0.5, E.z], distance: dc, animal: E.index })
  }
  const update = (dt: number): void => {
    time += dt
    const t = crowd.target?.state
    const px = t?.x ?? 0
    const pz = t?.z ?? 0
    const v = view()
    for (const E of list) {
      if (E.spec.sky) continue
      const dc = Math.hypot(E.x - v.x, E.z - v.z)
      if (dc >= N.activeDistance || E.dead) continue
      E.timer -= dt
      E.cooldown -= dt
      let alvoX = E.targetX
      let alvoZ = E.targetZ
      let corre = false
      const dp = t ? Math.hypot(E.x - px, E.z - pz) : Infinity
      if (E.companion && t) {
        // follows 2.2 m behind the target
        const bx = px - Math.sin(t.yaw) * N.companionBehind
        const bz = pz - Math.cos(t.yaw) * N.companionBehind
        alvoX = bx
        alvoZ = bz
        corre = dp > N.companionRun
        if (Math.hypot(bx - E.x, bz - E.z) < N.companionStop) {
          alvoX = E.x
          alvoZ = E.z
        }
      } else if (E.timer <= 0) {
        const q = free(E.homeX, E.homeZ, 0, E.range, N.retargetTries)
        if (q) {
          E.targetX = q[0]
          E.targetZ = q[1]
        }
        E.timer = N.restBase + R() * N.restRandom
        alvoX = E.targetX
        alvoZ = E.targetZ
      }
      // fear: flees from the target (not the companion) and from agents
      const zp = (time * N.lookEvery + E.x) % 1 < N.lookShare || E.near === undefined ? (E.near = nearestAgent(E.x, E.z, N.lookRadius)) : E.near
      let fx = 0
      let fz = 0
      if (E.fear && !E.companion && dp < E.fear) {
        fx += E.x - px
        fz += E.z - pz
      }
      if (E.fear && zp && zp[1] < E.fear * N.fearAgentFactor + N.fearAgentBase) {
        fx += E.x - Z.x[zp[0]]!
        fz += E.z - Z.z[zp[0]]!
      }
      if (fx || fz) {
        const l = Math.hypot(fx, fz) || 1
        alvoX = E.x + (fx / l) * N.fleeStep
        alvoZ = E.z + (fz / l) * N.fleeStep
        corre = true
        const fc = E.spec.fleeCall
        if (fc && E.cooldown <= 0) {
          E.cooldown = fc.cooldown
          call(E, fc.sound, fc.noise, dc)
        }
      }
      // alarms
      const al = E.spec.alarm
      if (al && dp < al.range && E.cooldown <= 0) {
        E.cooldown = al.cooldown
        E.fly = al.fly
        call(E, al.sound, al.noise, dc)
        emit('message', { id: 'alarm', seconds: 2.5, animal: E.index })
      }
      const cl = E.spec.call
      if (cl && E.cooldown <= 0 && R() < dt * cl.chance) {
        E.cooldown = cl.cooldown
        call(E, cl.sound, cl.noise, dc)
      }
      const g = E.spec.guard
      if (g && zp && E.cooldown <= 0) {
        if (zp[1] < g.bark) {
          E.cooldown = g.barkCooldown
          call(E, g.sound, g.barkNoise, dc)
          if (E.companion) emit('message', { id: 'bark', seconds: 1.5, animal: E.index, distance: Math.round(zp[1]) })
        } else if (E.companion && zp[1] < g.growl) {
          E.cooldown = g.growlCooldown
          emit('message', { id: 'growl', seconds: 2.5, animal: E.index, distance: Math.round(zp[1]) })
        }
      }
      // walks
      const ax = alvoX - E.x
      const az = alvoZ - E.z
      const ad = Math.hypot(ax, az)
      let sp = 0
      if (E.fly > 0) {
        E.fly -= dt
        E.clip = 'run'
      } else if (ad > N.arrive) {
        sp = corre ? E.runSpeed : E.walkSpeed
        E.clip = corre ? 'run' : 'walk'
      } else E.clip = 'idle'
      if (sp) {
        const k = Math.min(1, (sp * dt) / ad)
        const nx = E.x + ax * k
        const nz = E.z + az * k
        if (!grid.solidAt(nx, nz, N.bodyHeight)) {
          E.x = nx
          E.z = nz
        } else E.timer = 0
        let dy = Math.atan2(ax, az) - E.yaw
        dy -= Math.round(dy / 6.2832) * 6.2832
        E.yaw += dy * Math.min(1, dt * N.turn)
      }
    }
  }
  return {
    list,
    add(spec) {
      const E: HerdAnimal = {
        index: list.length,
        spec,
        x: spec.x,
        z: spec.z,
        yaw: R() * 6.28,
        homeX: spec.x,
        homeZ: spec.z,
        range: spec.range ?? N.range,
        clip: 'idle',
        timer: R() * 4,
        targetX: spec.x,
        targetZ: spec.z,
        fear: spec.fear ?? N.fear,
        fly: 0,
        cooldown: 0,
        walkSpeed: spec.walkHz * spec.size * N.walkFactor + N.walkBase,
        runSpeed: spec.runHz * spec.size * N.runFactor + N.runBase,
        companion: !!spec.companion,
        dead: !!spec.dead,
        near: undefined,
      }
      list.push(E)
      return E
    },
    free,
    update,
    get time() {
      return time
    },
    setCompanion(index, on) {
      const E = list[index]
      if (!E) return
      E.companion = on
      E.homeX = E.x
      E.homeZ = E.z
    },
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) listeners.set(event, (set = new Set()))
      set.add(listener as (event: never) => void)
      return () => void set.delete(listener as (event: never) => void)
    },
  }
}

import type { Crowd } from '../crowd'
import { STATE } from '../types'

/** A building the civilians walk between: its rectangle, whether it is a house (it has a gate), and the side its front faces (-1: toward -z). */
export type CivilianBuilding = { readonly x: number; readonly z: number; readonly w: number; readonly d: number; readonly house?: boolean; readonly front: -1 | 1 }

export type CivilianSpec = {
  readonly id: string
  /** The building name it lives in. */
  readonly home: string
  readonly child?: boolean
  readonly color?: number
  /** `[hour, building]`: from that hour, for one hour, it walks to that building. */
  readonly routine?: readonly (readonly [number, string])[]
  /** In a group it follows this civilian when that one is in the group too, else the target. */
  readonly leader?: string
  /** How close it keeps to whom it follows (2.2 m; the game's child keeps 1.2). */
  readonly followDistance?: number
}

export type CivilianState = 'home' | 'walking' | 'group' | 'fleeing' | 'gone' | 'dead' | 'undead'

export type Civilian = {
  readonly id: string
  readonly spec: CivilianSpec
  readonly k: number
  x: number
  z: number
  yaw: number
  phase: number
  vx: number
  vz: number
  hp: number
  state: CivilianState
  path: [number, number][]
  pathIndex: number
  /** Seconds left to turn after a bite (0: not bitten). */
  biteTimer: number
  attackTimer: number
  fear: number
  /** The building it is going to (or is at). */
  goal: string
  stuckTimer: number
  /** The agent it turned into. */
  agent: number
}

export type CivilianNumbers = {
  readonly hpAdult: number
  readonly hpChild: number
  readonly childOffset: number
  readonly sightSquared: number
  readonly leaveDistance: number
  readonly attackRange: number
  readonly attackEvery: number
  readonly biteFactor: number
  readonly biteSeconds: number
  readonly fearAfterHit: number
  readonly nearMessage: number
  readonly fearRange: number
  readonly fearSpeed: number
  readonly walkSpeed: number
  readonly childSpeed: number
  readonly bittenSpeed: number
  readonly groupRunBeyond: number
  readonly groupRunSpeed: number
  readonly fleeSpeed: number
  readonly childFleeFactor: number
  readonly stuckSeconds: number
  readonly arrive: number
  readonly probe: number
  readonly whiskers: readonly number[]
  readonly doorProbe: number
  readonly steer: number
  readonly bodyHeight: number
  readonly patrolChance: number
  readonly childHeight: number
  readonly childBuild: number
  readonly cadenceBase: number
  readonly cadencePerSpeed: number
  readonly inside: number
  readonly doorInside: number
  readonly doorOutside: number
  readonly gate: number
  readonly sidewalk: number
  readonly houseOffset: number
}

/** The game's numbers (`jogo.js` G 69960-70175). */
export const CIVILIAN_DEFAULTS: CivilianNumbers = {
  hpAdult: 100,
  hpChild: 40,
  childOffset: 0.6,
  sightSquared: 100,
  leaveDistance: 18,
  attackRange: 1.0,
  attackEvery: 1.5,
  biteFactor: 1.5,
  biteSeconds: 120,
  fearAfterHit: 10,
  nearMessage: 30,
  fearRange: 6,
  fearSpeed: 3.4,
  walkSpeed: 1.3,
  childSpeed: 0.85,
  bittenSpeed: 0.8,
  groupRunBeyond: 6,
  groupRunSpeed: 3.6,
  fleeSpeed: 2.6,
  childFleeFactor: 1.1,
  stuckSeconds: 8,
  arrive: 0.25,
  probe: 0.45,
  whiskers: [0, 0.7, -0.7, 1.4, -1.4],
  doorProbe: 0.6,
  steer: 8,
  bodyHeight: 0.4,
  patrolChance: 0.2,
  childHeight: 0.65,
  childBuild: 0.7,
  cadenceBase: 0.5,
  cadencePerSpeed: 0.3,
  inside: 0.8,
  doorInside: 0.8,
  doorOutside: 0.9,
  gate: 7.6,
  sidewalk: 6,
  houseOffset: 0.8,
}

export type CivilianEventMap = {
  bitten: { id: string; near: boolean }
  died: { id: string; cause: 'attacked' }
  turned: { id: string; agent: number }
  gone: { id: string }
}
export type CivilianEventName = keyof CivilianEventMap

export type CivilianOptions = {
  readonly people: readonly CivilianSpec[]
  readonly buildings: Readonly<Record<string, CivilianBuilding>>
  /** The hour of the day now (0-24), for the routines. */
  readonly hour?: () => number
  /** The crowd type a bitten civilian turns into (default the first type). */
  readonly turnInto?: number
  /** The waypoints of a building (G 69967 `pontos`): inside, the door from inside and outside, the gate of a house, the sidewalk. */
  readonly waypoints?: (building: CivilianBuilding) => [number, number][]
  readonly numbers?: Partial<CivilianNumbers>
}

export type Civilians = {
  readonly list: readonly Civilian[]
  get(id: string): Civilian | undefined
  /** Moves the civilians, lets the agents hunt them, bites, deaths and turning (G 70144 `npcUpdate`, G 70042 `npcZombies`). */
  update(dt: number): void
  /** Joins the target's group: follows its leader or the target. */
  join(id: string): void
  /** Leaves along a path of points; at the end it is `gone`. */
  flee(id: string, path: readonly (readonly [number, number])[]): void
  /** The route between two buildings (G 69974 `rota`): the points of one, the street crossing, the points of the other reversed. */
  route(from: string, to: string): [number, number][]
  on<K extends CivilianEventName>(event: K, listener: (event: CivilianEventMap[K]) => void): () => void
}

/**
 * Civilians on a crowd: a literal port of the team game's survivors on the block (`jogo.js` G 69960-70175: `pontos`, `rota`, `npcZombies`,
 * `zChaseNpc`, `npcMorre`, `npcVira`, `npcMove`, `npcUpdate`). They keep a routine by the hour, run home when an agent is near, follow a leader in a
 * group, leave along a path, open doors on the way; agents within 10 m that are closer to them than to the target hunt them, bite, and a bitten one
 * turns after `biteSeconds`. No names, lines, radio or diary: those are the game's, through the events.
 */
export function createCivilians(crowd: Crowd, options: CivilianOptions): Civilians {
  const N: CivilianNumbers = { ...CIVILIAN_DEFAULTS, ...options.numbers }
  const Z = crowd.store
  const grid = crowd.grid
  const doors = crowd.doors
  const hourNow = options.hour ?? (() => 12)
  const turnInto = options.turnInto ?? 0
  const listeners = new Map<CivilianEventName, Set<(event: never) => void>>()
  const emit = <K extends CivilianEventName>(event: K, payload: CivilianEventMap[K]): void => {
    for (const listener of listeners.get(event) ?? []) (listener as (event: CivilianEventMap[K]) => void)(payload)
  }
  const random = crowd.random
  const R = random
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
  const casaDe = (name: string): CivilianBuilding | undefined => options.buildings[name]
  const pontos =
    options.waypoints ??
    ((b: CivilianBuilding): [number, number][] => {
      const casa = !!b.house
      const side = b.front
      const front = side < 0 ? b.z + b.d : b.z
      const back = side < 0 ? b.z : b.z + b.d
      const cx = b.x + b.w / 2
      const inw = side < 0 ? -1 : 1
      const calc = side < 0 ? -N.sidewalk : N.sidewalk
      const pts: [number, number][] = [
        [cx + (casa ? N.houseOffset : 0), (front + (front + back) / 2) / 2],
        [cx, front + inw * N.doorInside],
        [cx, front - inw * N.doorOutside],
      ]
      if (casa) pts.push([cx, side < 0 ? -N.gate : N.gate])
      pts.push([cx, calc])
      return pts
    })
  const rota = (bA: CivilianBuilding, bB: CivilianBuilding): [number, number][] => {
    const a = pontos(bA)
    const b = pontos(bB).reverse()
    const out = a.slice()
    if (Math.sign(a[a.length - 1]![1]) !== Math.sign(b[0]![1])) out.push([a[a.length - 1]![0], b[0]![1]]) // crosses the street
    return out.concat(b)
  }
  const list: Civilian[] = options.people.map((spec, k) => {
    const b = casaDe(spec.home)!
    const p = pontos(b)[0]!
    return {
      id: spec.id,
      spec,
      k,
      x: p[0] + (spec.child ? N.childOffset : 0),
      z: p[1],
      yaw: 0,
      phase: 0,
      vx: 0,
      vz: 0,
      hp: spec.child ? N.hpChild : N.hpAdult,
      state: 'home',
      path: [],
      pathIndex: 0,
      biteTimer: 0,
      attackTimer: 0,
      fear: 0,
      goal: spec.home,
      stuckTimer: 0,
      agent: -1,
    }
  })
  const byId = new Map(list.map((c) => [c.id, c]))
  const exposed = (n: Civilian): boolean => n.state !== 'dead' && n.state !== 'undead' && n.state !== 'gone'
  const target = () => crowd.target?.state ?? null
  const distToTarget = (x: number, z: number): number => {
    const t = target()
    return t ? Math.hypot(x - t.x, z - t.z) : 0
  }

  const turn = (n: Civilian): void => {
    n.state = 'undead'
    const i = crowd.spawn(n.x, n.z, turnInto)
    if (i >= 0) {
      Z.color[i] = n.spec.color ?? Z.color[i]!
      Z.named[i] = n.k
      Z.height[i] = n.spec.child ? N.childHeight : Z.height[i]!
      Z.build[i] = n.spec.child ? N.childBuild : Z.build[i]!
      Z.age[i] = 0
      Z.state[i] = STATE.CHASE
      n.agent = i
    }
    emit('turned', { id: n.id, agent: i })
  }
  const die = (n: Civilian): void => {
    if (n.biteTimer > 0) return turn(n)
    n.state = 'dead'
    n.vx = n.vz = 0
    // the body with what it carried (the game's own item stays with the game)
    crowd.corpses.add({
      x: n.x,
      z: n.z,
      yaw: n.yaw,
      height: n.spec.child ? N.childHeight : 1,
      build: n.spec.child ? N.childBuild : 1,
      missing: 0,
      color: n.spec.color ?? 0,
      variant: -1,
      skin: 0.4,
      seed: R() * 10,
      named: n.k,
    })
    crowd.effect({ effect: 'blood', point: [n.x, 1, n.z], age: 0, amount: 300, died: true })
    emit('died', { id: n.id, cause: 'attacked' })
  }

  // ----- the agents against the civilians (G 70042 npcZombies) -----
  const agentsAgainst = (dt: number): void => {
    const t = target()
    for (let i = 0; i < Z.n; i++) {
      if (Z.band[i]! > 1) continue
      const k = Z.hunts[i]!
      if (k >= 0) {
        const n = list[k]!
        if (!exposed(n)) {
          Z.hunts[i] = -1
          continue
        }
        const dx = n.x - Z.x[i]!
        const dz = n.z - Z.z[i]!
        const d = Math.hypot(dx, dz)
        if (d > N.leaveDistance) {
          Z.hunts[i] = -1
          continue
        }
        if (d < N.attackRange) {
          Z.attackTimer[i]! -= dt
          if (Z.attackTimer[i]! <= 0) {
            Z.attackTimer[i] = N.attackEvery
            const C = crowd.pack.types[Z.type[i]!]!
            n.hp -= C.damage
            n.fear = N.fearAfterHit
            crowd.sound('flesh', 0.7, n.x, 1, n.z, distToTarget(n.x, n.z))
            crowd.effect({ effect: 'blood', point: [n.x, 1.2, n.z], age: 0, amount: 30, died: false })
            if (n.biteTimer <= 0 && R() < C.bite * N.biteFactor) {
              n.biteTimer = N.biteSeconds
              emit('bitten', { id: n.id, near: distToTarget(n.x, n.z) < N.nearMessage })
            }
            if (n.hp <= 0) die(n)
          }
        }
      } else if (Z.state[i]! <= 1) {
        for (const n of list) {
          if (!exposed(n) || n.state === 'home') continue
          const dx = n.x - Z.x[i]!
          const dz = n.z - Z.z[i]!
          const d2 = dx * dx + dz * dz
          const dp = t ? (t.x - Z.x[i]!) ** 2 + (t.z - Z.z[i]!) ** 2 : Infinity
          if (d2 < N.sightSquared && d2 < dp && grid.losClear(Z.x[i]!, Z.z[i]!, n.x, n.z)) {
            Z.hunts[i] = n.k
            Z.state[i] = STATE.CHASE
            break
          }
        }
      }
    }
  }
  // the crowd calls it: an agent hunting a civilian goes straight at it (G 70073 zChaseNpc)
  crowd.setHunt((i) => {
    const n = list[Z.hunts[i]!]
    if (!n) return false
    const dx = n.x - Z.x[i]!
    const dz = n.z - Z.z[i]!
    const d = Math.hypot(dx, dz) || 1
    const sp = d < 1 ? 0 : crowd.chaseSpeed(i)
    Z.vx[i] = (dx / d) * sp
    Z.vz[i] = (dz / d) * sp
    Z.yaw[i] = Math.atan2(dx, dz)
    return true
  })

  // ----- moving (G 70125 npcMove) -----
  const move = (n: Civilian, dt: number, tx: number, tz: number, sp: number): boolean => {
    const dx = tx - n.x
    const dz = tz - n.z
    const d = Math.hypot(dx, dz)
    if (d < N.arrive) {
      n.vx = n.vz = 0
      return true
    }
    let ax = dx / d
    let az = dz / d
    // round a wall: tries 0, ±40°, ±80°
    for (const a of N.whiskers) {
      const c = Math.cos(a)
      const s = Math.sin(a)
      const bx = ax * c - az * s
      const bz = ax * s + az * c
      if (!grid.solidAt(n.x + bx * N.probe, n.z + bz * N.probe, N.bodyHeight)) {
        ax = bx
        az = bz
        break
      }
    }
    // a closed door ahead: opens it
    const c = grid.cellOf(n.x + ax * N.doorProbe, n.z + az * N.doorProbe)
    const di = doors.at(c)
    if (c >= 0 && di >= 0) {
      const D = doors.list[di]!
      if (!D.open && !D.broken && !D.planks) {
        doors.set(di, true)
        crowd.sound('wood', 0.3, D.x, 1, D.z, distToTarget(D.x, D.z))
      }
    }
    n.vx = lerp(n.vx, ax * sp, Math.min(1, dt * N.steer))
    n.vz = lerp(n.vz, az * sp, Math.min(1, dt * N.steer))
    const nx = n.x + n.vx * dt
    const nz = n.z + n.vz * dt
    if (!grid.solidAt(nx, n.z, N.bodyHeight)) n.x = nx
    if (!grid.solidAt(n.x, nz, N.bodyHeight)) n.z = nz
    n.yaw = Math.atan2(n.vx, n.vz)
    return false
  }

  const update = (dt: number): void => {
    agentsAgainst(dt)
    const h = hourNow()
    const t = target()
    for (const n of list) {
      if (n.state === 'dead' || n.state === 'undead' || n.state === 'gone') continue
      if (n.biteTimer > 0) {
        n.biteTimer -= dt
        if (n.biteTimer <= 0) {
          turn(n)
          continue
        }
      }
      // fear: an agent near sends it home (or close to its leader in a group)
      let perto = 99
      for (let i = 0; i < Z.n; i++) {
        if (Z.band[i]) continue
        const d = Math.hypot(Z.x[i]! - n.x, Z.z[i]! - n.z)
        if (d < perto) perto = d
      }
      const sp = (perto < N.fearRange ? N.fearSpeed : N.walkSpeed) * (n.spec.child ? N.childSpeed : 1) * (n.biteTimer > 0 ? N.bittenSpeed : 1)
      if (n.state === 'group') {
        const leaderCivilian = n.spec.leader ? byId.get(n.spec.leader) : undefined
        const lider = leaderCivilian && leaderCivilian.state === 'group' ? leaderCivilian : t
        if (lider) {
          const dd = Math.hypot(lider.x - n.x, lider.z - n.z)
          if (dd > (n.spec.followDistance ?? 2.2)) move(n, dt, lider.x, lider.z, dd > N.groupRunBeyond ? N.groupRunSpeed : sp)
          else {
            n.vx *= 0.8
            n.vz *= 0.8
          }
        }
      } else if (n.state === 'fleeing') {
        const p = n.path[n.pathIndex]
        if (!p) {
          n.state = 'gone'
          emit('gone', { id: n.id })
          continue
        }
        n.stuckTimer += dt
        if (move(n, dt, p[0], p[1], N.fleeSpeed * (n.spec.child ? N.childFleeFactor : 1)) || n.stuckTimer > N.stuckSeconds) {
          n.pathIndex++
          n.stuckTimer = 0
        }
      } else if (n.spec.routine) {
        // the routine by hour: walks to the building of the hour
        let alvo = n.spec.home
        for (const [hh, onde] of n.spec.routine) if (h >= hh && h < hh + 1) alvo = onde
        if (perto < N.fearRange) alvo = n.spec.home
        if (alvo !== n.goal) {
          const home = casaDe(n.spec.home)!
          n.path = rota(casaDe(n.goal) ?? home, casaDe(alvo) ?? home)
          n.pathIndex = 0
          n.goal = alvo
          n.state = 'walking'
        }
        if (n.state === 'walking') {
          const p = n.path[n.pathIndex]
          n.stuckTimer += dt
          if (!p) n.state = 'home'
          else if (move(n, dt, p[0], p[1], sp) || n.stuckTimer > N.stuckSeconds) {
            n.pathIndex++
            n.stuckTimer = 0
          }
        } else {
          n.vx *= 0.8
          n.vz *= 0.8
        }
      } else {
        n.vx *= 0.8
        n.vz *= 0.8
      }
      {
        const v = Math.hypot(n.vx, n.vz)
        n.phase += dt * (v < 0.05 ? 0 : N.cadenceBase + N.cadencePerSpeed * v)
      }
    }
    // a named agent: walks the street of its old routine slowly while it sees nobody
    for (let i = 0; i < Z.n; i++)
      if (Z.named[i]! >= 0 && Z.state[i] === STATE.WANDER && R() < dt * N.patrolChance) {
        const n = list[Z.named[i]!]
        if (!n) continue
        const p = pontos(casaDe(n.spec.home)!)
        const q = p[Math.floor(R() * p.length)]!
        Z.wx[i] = q[0]
        Z.wz[i] = q[1]
      }
  }

  return {
    list,
    get: (id) => byId.get(id),
    update,
    join(id) {
      const n = byId.get(id)
      if (n && exposed(n)) n.state = 'group'
    },
    flee(id, path) {
      const n = byId.get(id)
      if (!n || !exposed(n)) return
      n.state = 'fleeing'
      n.path = path.map(([x, z]) => [x, z])
      n.pathIndex = 0
    },
    route(from, to) {
      return rota(casaDe(from)!, casaDe(to)!)
    },
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) listeners.set(event, (set = new Set()))
      set.add(listener as (event: never) => void)
      return () => void set.delete(listener as (event: never) => void)
    },
  }
}

import defaults from './data/defaults.json'
import { createRng } from './rng'
import type {
  Attributes,
  DeathCause,
  Derived,
  DerivedFormulas,
  DerivedId,
  InfectionRule,
  LinearFormula,
  MeleeItem,
  PlayerAction,
  PlayerCrowd,
  PlayerEventMap,
  PlayerEventName,
  PlayerInput,
  PlayerMessageId,
  PlayerNumbers,
  PlayerSave,
  PlayerSoundId,
  PlayerState,
  PlayerWorld,
  WoundTable,
} from './types'

export const PLAYER_DEFAULTS = defaults as unknown as {
  readonly sources: Readonly<Record<string, string>>
  readonly attributes: Attributes
  readonly derived: DerivedFormulas
  readonly wounds: WoundTable
  readonly infection: InfectionRule
  readonly numbers: PlayerNumbers
  readonly fist: MeleeItem
}

export type PlayerOptions = {
  /** The random stream (the game passes its single stream). Default `createRng(seed)`. */
  readonly random?: () => number
  readonly seed?: number
  /** The sheet: every attribute 5 by default. */
  readonly attributes?: Partial<Attributes>
  readonly derived?: Partial<DerivedFormulas>
  readonly wounds?: WoundTable
  /** An individual infection (`true` uses the defaults; an object patches them). Off by default: the normal world comes first. */
  readonly infection?: boolean | Partial<InfectionRule>
  readonly numbers?: Partial<PlayerNumbers>
  readonly fist?: MeleeItem
  readonly position?: { readonly x?: number; readonly z?: number; readonly yaw?: number }
  readonly world?: PlayerWorld
}

export type Player = {
  readonly state: PlayerState
  readonly attributes: Attributes
  readonly derived: Derived
  readonly numbers: PlayerNumbers
  readonly infection: InfectionRule | null
  update(dt: number, input?: PlayerInput, world?: PlayerWorld): void
  /** A hit that opens a wound (drawn from the wound table) and may infect. `by` is the agent that hit, if any. */
  hurt(amount: number, by?: number): void
  /** A bite: damage, bleeding, a bite wound and (with an infection rule) the infection. */
  bite(by?: number): void
  grab(by: number, noJaw?: boolean, drown?: boolean): void
  release(): void
  knock(seconds: number): void
  infect(source: string): void
  /** Kills the player with a cause (the host's deaths: a fall, a fire). */
  die(cause: DeathCause): void
  /** Infection stage: `none`, `malaise`, `fever`, `delirium`. */
  stage(): 'none' | 'malaise' | 'fever' | 'delirium'
  /** Seconds the infection has left, or null. */
  timeLeft(): number | null
  /** What the player's state does to aim spread (panic, fever, moving); the weapon multiplies its own spread by it. */
  spreadFactor(): number
  /** The agents in front (nearest first) within `range` m and a cone of `cosMin`, as `[distance, index]`. */
  front(range: number, cosMin: number, yaw: number, crowd?: PlayerCrowd): [number, number][]
  on<K extends PlayerEventName>(event: K, listener: (event: PlayerEventMap[K]) => void): () => void
  save(): PlayerSave
  load(save: PlayerSave): void
  /** The world `update` uses when it is given none. */
  setWorld(world: PlayerWorld): void
}

const TAU_APPROX = 6.2832

const evaluate = (formula: LinearFormula, attributes: Attributes): number => {
  let value = formula.base
  for (const [attribute, coefficient] of formula.terms) value += coefficient * attributes[attribute]
  return formula.divide === undefined ? value : value / formula.divide
}

/** The derived values of a sheet (the game's `DERIV`). */
export const deriveVitals = (attributes: Attributes, formulas: DerivedFormulas = PLAYER_DEFAULTS.derived): Derived => {
  const out = {} as Record<DerivedId, number>
  for (const id of Object.keys(formulas) as DerivedId[]) out[id] = evaluate(formulas[id], attributes)
  return out
}

/** Which wound a hit opens: one draw, the kinds in the listed order, the last one takes the rest (the game's `FERIDA` draw). */
export const drawWound = (wounds: WoundTable, random: () => number): string => {
  const kinds = Object.keys(wounds)
  const draw = random()
  let acc = 0
  for (let k = 0; k < kinds.length - 1; k++) {
    acc += wounds[kinds[k]!]!.share
    if (draw < acc) return kinds[k]!
  }
  return kinds[kinds.length - 1]!
}

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const freshState = (derived: Derived, position: PlayerOptions['position']): PlayerState => ({
  x: position?.x ?? 0,
  z: position?.z ?? 0,
  y: 0,
  vx: 0,
  vz: 0,
  yaw: position?.yaw ?? 0,
  floor: 0,
  alive: true,
  turned: false,
  health: derived.maxHealth,
  stamina: derived.maxStamina,
  crouch: false,
  running: false,
  stepTimer: 0,
  phase: 0,
  hip: 0,
  grabbedBy: -1,
  grabTimer: 0,
  grabPushes: 0,
  grabNoJaw: false,
  grabDrown: false,
  infected: false,
  infectionTime: 0,
  infectionSource: '',
  wounds: [],
  bleeding: 0,
  blind: 0,
  screamBoost: 0,
  panic: 0,
  hurtFlash: 0,
  deathTime: 0,
  cause: '',
  downTimer: 0,
  burnTimer: 0,
  scentTimer: 0,
  vaultTimer: 0,
  vault: null,
})

/**
 * The player body: a literal port of the team game's `player` and `playerUpdate` (G 68427-68640) with the world, the crowd and the input as
 * arguments instead of globals. The draws on `random` happen in the game's order (wound kind, infection, the fever cough, the knife when grabbed,
 * the melee region), so a game that passes its own stream keeps its sequence.
 */
export function createPlayer(options: PlayerOptions = {}): Player {
  const random = options.random ?? createRng(options.seed ?? 1)
  const attributes: Attributes = { ...PLAYER_DEFAULTS.attributes, ...options.attributes }
  const formulas: DerivedFormulas = { ...PLAYER_DEFAULTS.derived, ...options.derived }
  const derived = deriveVitals(attributes, formulas)
  const numbers: PlayerNumbers = { ...PLAYER_DEFAULTS.numbers, ...options.numbers }
  const wounds = options.wounds ?? PLAYER_DEFAULTS.wounds
  const infection: InfectionRule | null =
    options.infection === undefined || options.infection === false ? null : options.infection === true ? PLAYER_DEFAULTS.infection : { ...PLAYER_DEFAULTS.infection, ...options.infection }
  const fist = options.fist ?? PLAYER_DEFAULTS.fist
  const listeners = new Map<PlayerEventName, Set<(event: never) => void>>()
  let P = freshState(derived, options.position)
  let defaultWorld: PlayerWorld = options.world ?? {}
  let world: PlayerWorld = defaultWorld

  const emit = <K extends PlayerEventName>(event: K, payload: PlayerEventMap[K]): void => {
    const set = listeners.get(event)
    if (set) for (const listener of set) (listener as (event: PlayerEventMap[K]) => void)(payload)
  }
  const sound = (id: PlayerSoundId, volume: number): void => emit('sound', { sound: id, volume, position: [P.x, P.y, P.z] })
  const noise = (x: number, z: number, radius: number): void => emit('noise', { x, z, radius })
  const message = (id: PlayerMessageId | DeathCause, seconds: number): void => emit('message', { id, seconds })
  const inWater = (x: number, z: number): boolean => world.inWater?.(x, z) ?? false
  const solidAt = (x: number, z: number, y: number): boolean => world.solidAt?.(x, z, y) ?? false
  const cellKind = (x: number, z: number): number => world.cellKind?.(x, z) ?? 0
  const blocked = (x: number, z: number): boolean => (world.blocked ? world.blocked(x, z) : solidAt(x, z, numbers.blockHeight))
  const chanceOf = (kind: string): number => infection?.chances?.[kind] ?? wounds[kind]?.infectionChance ?? 0

  const die = (cause: DeathCause): void => {
    if (!P.alive) return
    P.alive = false
    P.cause = cause
    P.deathTime = 0
    P.grabbedBy = -1
    message(cause, 6)
    emit('died', { cause })
  }
  const infect = (source: string): void => {
    if (P.infected || !infection) return
    P.infected = true
    P.infectionTime = 0
    P.infectionSource = source
    emit('infected', { source })
  }
  const release = (how: PlayerEventMap['released']['how'] = 'free'): void => {
    const by = P.grabbedBy
    P.grabbedBy = -1
    if (by >= 0) emit('released', { by, how })
  }
  const hurt = (amount: number): void => {
    if (!P.alive) return
    P.health -= amount
    P.hurtFlash = numbers.hurtFlash
    sound('flesh', numbers.hurtVolume)
    const kind = drawWound(wounds, random)
    P.wounds.push(kind)
    if (wounds[kind]?.bleeds) P.bleeding = 1
    emit('hurt', { amount, wound: kind })
    if (infection && !P.infected && random() < chanceOf(kind)) infect(kind)
    if (P.health <= 0) die(P.infected ? 'infected' : 'killed')
  }
  const bite = (): void => {
    P.health -= numbers.biteDamage
    P.hurtFlash = numbers.biteFlash
    P.bleeding = 1
    P.wounds.push('bite')
    sound('flesh', numbers.biteVolume)
    emit('hurt', { amount: numbers.biteDamage, wound: 'bite' })
    infect('bite')
    message('bitten', 5)
    if (P.health <= 0) die('bitten_to_death')
  }
  const grab = (by: number, noJaw = false, drown = false): void => {
    P.grabbedBy = by
    P.grabTimer = numbers.grabSeconds
    P.grabPushes = 0
    P.grabNoJaw = noJaw
    P.grabDrown = drown
    message(drown ? 'grabbed_drown' : 'grabbed', 3)
    sound('flesh', numbers.grabVolume)
    emit('grabbed', { by, noJaw, drown })
  }

  const front = (range: number, cosMin: number, yaw: number, crowd: PlayerCrowd | undefined = world.crowd): [number, number][] => {
    const out: [number, number][] = []
    if (!crowd) return out
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const n = crowd.count()
    for (let i = 0; i < n; i++) {
      if (!crowd.active(i) || crowd.floor(i) !== P.floor) continue
      const ex = crowd.x(i) - P.x
      const ez = crowd.z(i) - P.z
      const d = Math.hypot(ex, ez)
      if (d < range && (ex * fx + ez * fz) / (d || 1) > cosMin) out.push([d, i])
    }
    return out.sort((a, b) => a[0] - b[0])
  }

  const shove = (yaw: number): void => {
    sound('step', numbers.shoveVolume)
    const crowd = world.crowd
    const targets: number[] = []
    for (const [d, i] of front(numbers.shoveRange, numbers.shoveCone, yaw)) {
      crowd!.stun(i, numbers.shoveStun, ((crowd!.x(i) - P.x) / d) * numbers.shoveSpeed, ((crowd!.z(i) - P.z) / d) * numbers.shoveSpeed)
      targets.push(i)
    }
    emit('shove', { targets })
  }

  const melee = (item: MeleeItem, yaw: number): void => {
    const t = front(numbers.meleeRangeBase + (item.reach ?? 0), numbers.meleeCone, yaw)[0]
    sound('flesh', numbers.meleeVolume)
    noise(P.x, P.z, item.noise || 1)
    if (!t) return
    const crowd = world.crowd!
    const i = t[1]
    // a blow to the head is x3 in melee; on the ground or crawling it is an execution
    const region = crowd.down(i) ? 0 : random() < numbers.meleeHeadChance ? 0 : random() < numbers.meleeArmChance ? 1 : 2 + Math.floor(random() * 2)
    const damage = item.damage * (1 + (attributes.strength - numbers.meleeStrengthBase) * numbers.meleeStrengthPerPoint)
    const cut = Math.min(1, (item.crit || 0) / numbers.meleeCritToCut)
    crowd.damage(i, { region, amount: damage, distance: t[0], cut })
    emit('melee', { target: i, region, damage, distance: t[0], cut })
  }

  const update = (dt: number, input: PlayerInput = {}, frameWorld?: PlayerWorld): void => {
    world = frameWorld ?? defaultWorld
    if (!P.alive) {
      P.deathTime += dt
      if (P.infected && infection && !P.turned && P.deathTime >= infection.reanimateSeconds) {
        P.turned = true
        emit('turned', { x: P.x, z: P.z, floor: P.floor })
      }
      return
    }
    const pressed: Partial<Record<PlayerAction, boolean>> = { ...input.pressed }
    const wasPressed = (action: PlayerAction): boolean => {
      const v = pressed[action] === true
      pressed[action] = false
      return v
    }
    const viewYaw = input.yaw ?? 0
    const crowd = world.crowd
    P.screamBoost = Math.max(0, P.screamBoost - dt)
    P.blind = Math.max(0, P.blind - dt)
    P.hurtFlash = Math.max(0, P.hurtFlash - dt)
    // infection on its own clock
    if (P.infected && infection) {
      const before = P.infectionTime
      P.infectionTime += dt
      if (before <= infection.feverSeconds && P.infectionTime > infection.feverSeconds) emit('stage', { stage: 'fever' })
      if (before <= infection.deliriumSeconds && P.infectionTime > infection.deliriumSeconds) emit('stage', { stage: 'delirium' })
      const every = 1 / infection.feverNoiseEvery
      if (P.infectionTime > infection.feverSeconds && Math.floor(P.infectionTime * every) !== Math.floor((P.infectionTime - dt) * every) && random() < infection.feverNoiseChance) {
        noise(P.x, P.z, infection.feverNoiseRadius)
        sound('step', infection.feverNoiseVolume)
      }
      if (P.infectionTime > infection.deathSeconds) {
        P.health = 0
        die('infection')
        return
      }
    }
    if (P.burnTimer > 0) {
      P.burnTimer -= dt
      P.health -= numbers.burnPerSecond * dt
      if (inWater(P.x, P.z)) P.burnTimer = 0
    }
    P.scentTimer = Math.max(0, P.scentTimer - dt)
    if (P.bleeding) {
      P.health -= dt * numbers.bleedPerSecond
      if (input.bandage && P.bleeding) {
        P.bleeding = 0
        message('bandaged', 2)
      }
    }
    if (P.health <= 0) {
      die(P.infected ? 'infected' : P.bleeding ? 'bled_out' : 'hunger_thirst')
      return
    }
    // grabbed: seconds to react
    if (P.grabbedBy >= 0) {
      const i = P.grabbedBy
      P.grabTimer -= dt
      if (crowd) {
        const k = 1 - Math.exp(-dt * numbers.grabFollow) // glued to the body without a jump
        crowd.hold(i, P.x - Math.sin(P.yaw) * numbers.grabOffset, P.z - Math.cos(P.yaw) * numbers.grabOffset, k, P.x, P.z)
      }
      if (wasPressed('push') && P.stamina > numbers.grabPushMinStamina) {
        P.grabPushes++
        P.stamina -= numbers.grabPushCost
        sound('step', numbers.grabPushVolume)
      }
      if (wasPressed('knife')) {
        if (random() < numbers.grabKnifeChance) {
          crowd?.damage(i, { region: numbers.grabKnifeRegion, amount: numbers.grabKnifeDamage, distance: numbers.grabKnifeDistance, cut: numbers.grabKnifeCut })
          message('knife_head', 1.5)
          release('knife')
          return
        } else message('knife_miss', 1)
      }
      if (P.grabPushes >= numbers.grabPushes) {
        crowd?.stun(i, numbers.grabPushStun, -Math.sin(viewYaw) * numbers.grabPushSpeed, -Math.cos(viewYaw) * numbers.grabPushSpeed)
        release('push')
        message('pushed_off', 1.2)
        return
      }
      if (P.grabTimer <= 0) {
        if (P.grabDrown) {
          P.health -= numbers.drownDamage
          P.hurtFlash = numbers.drownFlash
          message('drowning', 2)
          if (P.health <= 0) {
            die('drowned')
            return
          }
          P.grabTimer = numbers.grabSeconds
          P.grabPushes = 0
          return
        }
        if (P.grabNoJaw) {
          hurt(numbers.noJawDamage)
          message('no_jaw', 2)
        } else bite()
        crowd?.chase(i, numbers.grabAttackCooldown)
        release(P.grabNoJaw ? 'scratch' : 'bite')
      }
      return
    }
    // knocked down
    if (P.downTimer > 0) {
      P.downTimer -= dt
      P.vx = P.vz = 0
      if (P.downTimer <= 0) message('stood_up', 0.8)
      return
    }
    if (world.busy?.(dt)) return
    // vaulting a low wall
    if (P.vaultTimer > 0 && P.vault) {
      P.vaultTimer -= dt
      const k = 1 - P.vaultTimer / numbers.vaultSeconds
      P.x = lerp(P.vault[0], P.vault[2], k)
      P.z = lerp(P.vault[1], P.vault[3], k)
      P.y = Math.sin(k * Math.PI) * numbers.vaultHeight
      if (P.vaultTimer <= 0) {
        P.y = 0
        noise(P.x, P.z, numbers.vaultNoise)
        sound('step', numbers.vaultLandVolume)
      }
      return
    }
    if (wasPressed('vault') && P.stamina > numbers.vaultCost && (world.canVault?.() ?? !P.floor)) {
      const fx0 = -Math.sin(viewYaw)
      const fz0 = -Math.cos(viewYaw)
      for (let a = numbers.vaultScanFrom; a <= numbers.vaultScanTo; a += numbers.vaultScanStep) {
        const c = cellKind(P.x + fx0 * a, P.z + fz0 * a)
        if (c === 2) {
          for (let e = a + numbers.vaultLandFrom; e <= a + numbers.vaultLandTo; e += numbers.vaultScanStep) {
            const ex = P.x + fx0 * e
            const ez = P.z + fz0 * e
            if (!solidAt(ex, ez, numbers.vaultCheckHeight) && !solidAt(ex + fx0 * numbers.vaultClearance, ez + fz0 * numbers.vaultClearance, numbers.vaultCheckHeight)) {
              P.vault = [P.x, P.z, ex, ez]
              P.vaultTimer = numbers.vaultSeconds
              P.stamina -= numbers.vaultCost
              sound('step', numbers.vaultStartVolume)
              emit('vault', { from: [P.x, P.z], to: [ex, ez] })
              return
            }
          }
          break
        }
        if (c > 0 && c !== 3) break
      }
    }
    // movement
    const f = input.forward ?? 0
    const s = input.right ?? 0
    if (wasPressed('crouch')) P.crouch = !P.crouch
    const want = f || s
    P.running = !!(input.run && want && P.stamina > numbers.runMinStamina && !input.aim && !P.crouch)
    const fever = P.infected && infection !== null && P.infectionTime > infection.feverSeconds
    let sp = P.running ? derived.runSpeed : P.crouch ? numbers.crouchSpeed : derived.walkSpeed * numbers.walkFactor
    if (fever) sp *= infection!.feverSpeed
    if (input.aim) sp = Math.min(sp, numbers.aimSpeedCap)
    const wet = inWater(P.x, P.z)
    if (wet) sp *= numbers.waterSpeed
    if (P.running) P.stamina = Math.max(0, P.stamina - numbers.runDrain * dt)
    else P.stamina = Math.min(derived.maxStamina, P.stamina + (want ? numbers.regenMoving : numbers.regenStill) * dt)
    const fx = -Math.sin(viewYaw)
    const fz = -Math.cos(viewYaw)
    const mx = fx * f - fz * s
    const mz = fz * f + fx * s
    const ml = Math.hypot(mx, mz) || 1
    const tvx = want ? (mx / ml) * sp : 0
    const tvz = want ? (mz / ml) * sp : 0
    P.vx = lerp(P.vx, tvx, Math.min(1, dt * numbers.acceleration))
    P.vz = lerp(P.vz, tvz, Math.min(1, dt * numbers.acceleration))
    const r = numbers.radius
    const nx = P.x + P.vx * dt
    const nz = P.z + P.vz * dt
    if (!blocked(nx + Math.sign(P.vx) * r, P.z)) P.x = nx
    if (!blocked(P.x, nz + Math.sign(P.vz) * r)) P.z = nz
    world.afterMove?.(P)
    // the player does not walk through the crowd: agents pressed against the body push it out
    if (crowd) {
      const n = crowd.count()
      const rr = numbers.pushApartRadius
      for (let i = 0; i < n; i++) {
        if (!crowd.active(i) || Math.abs(crowd.y(i) - P.y) > numbers.pushApartHeight) continue
        const ex = P.x - crowd.x(i)
        const ez = P.z - crowd.z(i)
        const e2 = ex * ex + ez * ez
        if (e2 < rr * rr && e2 > 1e-5) {
          const e = Math.sqrt(e2)
          const k = ((rr - e) / e) * 0.5
          if (!solidAt(P.x + ex * k, P.z + ez * k, numbers.blockHeight)) {
            P.x += ex * k
            P.z += ez * k
          }
        }
      }
    }
    const spd = Math.hypot(P.vx, P.vz)
    // the legs follow the move even with the torso on the aim; walking backwards flips the stride
    {
      const cy = Math.cos(P.yaw)
      const sy = Math.sin(P.yaw)
      const lx = P.vx * cy - P.vz * sy
      const lz = P.vx * sy + P.vz * cy
      const back = lz < numbers.backwardsBelow ? -1 : 1
      const hip = spd > numbers.hipMinSpeed ? clamp(Math.atan2(lx * back, lz * back), -numbers.hipLimit, numbers.hipLimit) : 0
      P.hip = P.hip + (hip - P.hip) * Math.min(1, dt * numbers.hipFollow)
      P.phase += dt * (spd < numbers.cadenceMinSpeed ? 0 : numbers.cadenceBase + numbers.cadencePerSpeed * spd) * back
    }
    // the body follows the view (fast, no snap); aiming or firing, at once
    {
      const target = viewYaw + Math.PI
      let dy = target - P.yaw
      dy -= Math.round(dy / TAU_APPROX) * TAU_APPROX
      P.yaw += input.aim || input.firing ? dy : dy * Math.min(1, dt * numbers.turnFollow)
    }
    // footsteps make noise: walk 3 m, run 8 m, crouched 1 m (x the sheet's footstep noise, x2 in water)
    P.stepTimer -= dt * spd
    if (P.stepTimer <= 0 && spd > numbers.stepMinSpeed) {
      P.stepTimer = numbers.stepEvery
      noise(P.x, P.z, (P.running ? numbers.stepNoiseRun : P.crouch ? numbers.stepNoiseCrouch : numbers.stepNoiseWalk) * derived.footstepNoise * (wet ? numbers.stepNoiseWater : 1))
      sound('step', P.running ? numbers.stepVolumeRun : numbers.stepVolumeWalk)
      emit('step', { x: P.x, z: P.z, yaw: P.yaw })
    }
    // shove and melee
    if (wasPressed('push') && P.stamina > numbers.shoveCost) {
      P.stamina -= numbers.shoveCost
      shove(viewYaw)
    }
    if (wasPressed('throw')) emit('throw', {})
    if (wasPressed('knife') && P.stamina > numbers.meleeMinStamina) {
      const item = input.melee ?? fist
      P.stamina -= (item.kg ?? 0) > numbers.meleeHeavyKg ? numbers.meleeCostHeavy : numbers.meleeCostLight
      melee(item, viewYaw)
    }
    // panic: chasing agents in sight nearby
    let near = 0
    if (crowd) {
      const n = crowd.count()
      for (let i = 0; i < n; i++) if (crowd.active(i) && crowd.chasing(i)) near += crowd.panicWeight?.(i) ?? 1
    }
    P.panic = clamp(P.panic + (near * numbers.panicGain - (near ? 0 : numbers.panicDecay)) * dt, 0, numbers.panicMax)
  }

  return {
    get state() {
      return P
    },
    attributes,
    derived,
    numbers,
    infection,
    update,
    hurt: (amount) => hurt(amount),
    bite: () => bite(),
    grab,
    release: () => release('free'),
    knock(seconds) {
      if (!P.alive) return
      P.downTimer = Math.max(P.downTimer, seconds)
      P.crouch = false
    },
    infect,
    die,
    stage() {
      if (!P.infected || !infection) return 'none'
      return P.infectionTime > infection.deliriumSeconds ? 'delirium' : P.infectionTime > infection.feverSeconds ? 'fever' : 'malaise'
    },
    timeLeft: () => (P.infected && infection ? Math.max(0, infection.deathSeconds - P.infectionTime) : null),
    spreadFactor() {
      const panic = P.panic > derived.composure * numbers.panicSpreadAt ? numbers.panicSpread : 1
      const fever = P.infected && infection && P.infectionTime > infection.feverSeconds ? infection.feverSpread : 1
      return panic * fever * (1 + Math.hypot(P.vx, P.vz) * numbers.moveSpread)
    },
    front,
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) listeners.set(event, (set = new Set()))
      set.add(listener as (event: never) => void)
      return () => void set.delete(listener as (event: never) => void)
    },
    save: () => ({ state: structuredClone(P), attributes }),
    load(save) {
      P = structuredClone(save.state)
    },
    setWorld(next) {
      defaultWorld = next
    },
  }
}

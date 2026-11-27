import { stepKnock } from '@adatechnology/game-contracts'
import type { Knock } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { Layer, PhysicsServices } from '@adatechnology/game-physics'
import { PLAYER_MASS_KG, PLAYER_WALK_PUSH_NEWTONS, createWalker } from '@adatechnology/game-player'
import type { Walker, WalkerStance } from '@adatechnology/game-player'

import { LANDING_MIN_SPEED, PLAYER_RADIUS, SLAM_MIN_SPEED, createBlockedTest } from './locomotion'
import type { Locomotion, LocomotionContext } from './locomotion'

/** What the engine path needs: the physics services of the room's loop and the numbers of the body. */
export interface EngineBody {
  readonly services: Pick<PhysicsServices, 'loop' | 'world'>
  /** Standing height, default 1.8 m. */
  readonly heightMetres?: number
  /** The most it steps up, default 0.4 m. */
  readonly stepHeight?: number
  /** Kilograms, default `PLAYER_MASS_KG`. */
  readonly mass?: number
  /** The most (N) the walk pushes what is in the way with, default `PLAYER_WALK_PUSH_NEWTONS`. */
  readonly pushNewtons?: number
}

const STANDING_HEIGHT = 1.8
const STEP_HEIGHT = 0.4
/** Per second, how fast the eye settles after the feet stepped up. */
const STEP_EASE_RATE = 20
/** The roof is looked for this far above the seat, and a body is put on it with this much to spare (m). */
const ROOF_REACH = 4
const ROOF_CLEARANCE = 0.01
const ROOF_LAYERS: readonly Layer[] = ['static', 'debris', 'prop', 'vehicle']
/** Seconds a launch may wait for the feet to leave the floor before the landing counts. */
const LAUNCH_WAIT = 0.25

type Slam = { readonly speed: number; readonly x: number; readonly z: number }

/**
 * The player's body as a walker in the physics world (spec 008, TS.9): the keys set an intent, every fixed step walks it, a blocker the world has no body for vetoes
 * the step before it is taken, and the view stands where the feet are drawn between the last two steps (`present`).
 */
export const createEngineLocomotion = (o: LocomotionContext, start: Vec3, engine: EngineBody): Locomotion => {
  const { loop, world } = engine.services
  const { blocked: blockedAt } = createBlockedTest(o)
  const floorAt = (x: number, z: number): number => o.floorAt?.(x, z) ?? 0
  const stepHeight = engine.stepHeight ?? STEP_HEIGHT
  const mass = engine.mass ?? PLAYER_MASS_KG
  const now = new Float64Array(3)
  const drawn = new Float64Array(3)
  const manual = new Float64Array(3)
  const anchor = new Float64Array(3)
  const ghost = { x: 0, y: 0, z: 0 }
  const lastStep = new Float64Array(3)
  const lastFree = new Float64Array(3)
  let wantX = 0
  let wantZ = 0
  let alpha = 0
  let stepLag = 0
  let walked = 0
  let running = false
  let mustCrouch = false
  let flying = false
  let seated = false
  let held = false
  let pendingUnpark = false
  let wasSupported = true
  let fallPeak = 0
  let landed = 0
  let slam: Slam | null = null
  let stepSpeed = 0
  let lastDx = 0
  let lastDz = 0
  let inKnock = false
  let launchWait = 0
  let lastJumpTime = -1
  const wish = { x: 0, z: 0 }

  // before the walker's own phase: what the world has no body for vetoes the step, and what the last step did is read (the landing, the stop, the step up)
  const stopPhase = loop.add(
    {
      beforeStep: (h) => {
        if (walker.parked) return
        walker.read(now)
        if (!revertIfInside(h)) observeStep(h)
        if (wantX === 0 && wantZ === 0) return walker.setIntent(0, 0)
        const feet = now[1] as number
        // caught inside something the player walks out of it, whichever way
        if (blockedAt(now[0] as number, now[2] as number, PLAYER_RADIUS, feet, 'bodiless')) return walker.setIntent(wantX, wantZ)
        const intentX = blockedAt((now[0] as number) + wantX * h, now[2] as number, PLAYER_RADIUS, feet, 'bodiless') ? 0 : wantX
        const intentZ = blockedAt(now[0] as number, (now[2] as number) + wantZ * h, PLAYER_RADIUS, feet, 'bodiless') ? 0 : wantZ
        walker.setIntent(intentX, intentZ)
      },
    },
    'actors',
  )

  const walker: Walker = createWalker(engine.services, {
    position: [start[0], floorAt(start[0], start[2]), start[2]],
    collider: { heightMetres: engine.heightMetres ?? STANDING_HEIGHT, radiusMetres: PLAYER_RADIUS },
    mass,
    stepHeight,
    strength: engine.pushNewtons ?? PLAYER_WALK_PUSH_NEWTONS,
    shadow: 'agent',
  })
  walker.read(now)
  walker.drawn(0, drawn)
  lastStep.set(now)
  lastFree.set(now)

  /**
   * What the world has no body for stops the feet where they were free: a throw or a slide that ended inside it goes back (the speed that went in is a slam). True when it went back.
   */
  const revertIfInside = (h: number): boolean => {
    const x = now[0] as number
    const z = now[2] as number
    if (!blockedAt(x, z, PLAYER_RADIUS, now[1] as number, 'bodiless')) {
      lastFree.set(now)
      return false
    }
    // caught inside it before (a piece fell on the spot): the walk out is free
    if (blockedAt(lastFree[0] as number, lastFree[2] as number, PLAYER_RADIUS, lastFree[1] as number, 'bodiless')) return false
    const speed = Math.hypot(x - (lastStep[0] as number), z - (lastStep[2] as number)) / h
    if (inKnock && !slam && Math.max(speed, stepSpeed) >= SLAM_MIN_SPEED) slam = { speed: Math.max(speed, stepSpeed), x: x - (lastFree[0] as number), z: z - (lastFree[2] as number) }
    walker.teleport([lastFree[0] as number, now[1] as number, lastFree[2] as number])
    walker.read(now)
    lastStep.set(now)
    stepSpeed = 0
    lastDx = 0
    lastDz = 0
    return true
  }

  /** What the last fixed step did, from the feet before it and after it. */
  const observeStep = (h: number): void => {
    const supported = walker.supported()
    const dx = (now[0] as number) - (lastStep[0] as number)
    const dz = (now[2] as number) - (lastStep[2] as number)
    const rise = (now[1] as number) - (lastStep[1] as number)
    if (supported && wasSupported && rise > 1e-3 && rise <= stepHeight * 1.1) stepLag += rise
    const speed = Math.hypot(dx, dz) / h
    if (inKnock && stepSpeed >= SLAM_MIN_SPEED && speed < stepSpeed * 0.5 && !slam) slam = { speed: stepSpeed, x: lastDx, z: lastDz }
    walked = speed
    stepSpeed = speed
    lastDx = dx
    lastDz = dz
    if (!supported) fallPeak = Math.max(fallPeak, -rise / h)
    else {
      if (!wasSupported) landed = Math.max(landed, fallPeak)
      fallPeak = 0
    }
    wasSupported = supported
    lastStep.set(now)
  }

  const resync = (): void => {
    walker.read(now)
    walker.drawn(alpha, drawn)
    lastStep.set(now)
    lastFree.set(now)
    stepSpeed = 0
    lastDx = 0
    lastDz = 0
    stepLag = 0
    fallPeak = 0
    wasSupported = true
  }

  const applyStance = (wanted: WalkerStance): void => {
    if (walker.stance === wanted) {
      mustCrouch = false
      return
    }
    if (walker.setStance(wanted)) {
      mustCrouch = false
      return
    }
    if (wanted === 'standing' && walker.stance === 'prone') walker.setStance('crouched')
    mustCrouch = wanted === 'standing' && walker.stance !== 'standing'
  }

  const roofOver = (at: Float64Array): Vec3 => {
    const hit = world.rayFirst([at[0] as number, (at[1] as number) + ROOF_REACH, at[2] as number], [0, -1, 0], ROOF_REACH + 1, { layers: ROOF_LAYERS })
    return [at[0] as number, hit ? (at[1] as number) + ROOF_REACH - hit.distance + ROOF_CLEARANCE : (at[1] as number) + 2.2, at[2] as number]
  }

  /** Where the body may come back, in this order: where it was put, where it went out, the far side of that, the floor under the first, the roof over where it went out, the roof over the first. */
  const exitsOf = (): readonly Vec3[] => {
    const here: Vec3 = [manual[0] as number, manual[1] as number, manual[2] as number]
    const out: Vec3 = [anchor[0] as number, anchor[1] as number, anchor[2] as number]
    const far: Vec3 = [2 * out[0] - here[0], here[1], 2 * out[2] - here[2]]
    const floor: Vec3 = [here[0], floorAt(here[0], here[2]), here[2]]
    return [here, out, far, floor, roofOver(anchor), roofOver(manual)]
  }

  const tryUnpark = (): boolean => {
    if (!walker.unpark(exitsOf())) return false
    pendingUnpark = false
    resync()
    return true
  }

  const sync = (): void => {
    const shouldPark = flying || seated || held
    if (shouldPark && !walker.parked) {
      walker.read(now)
      manual.set(now)
      anchor.set(now)
      walker.park()
      wantX = 0
      wantZ = 0
      return
    }
    if (!shouldPark && walker.parked && !tryUnpark()) pendingUnpark = true
  }

  const refreshDrawn = (): void => {
    if (!walker.parked) walker.drawn(alpha, drawn)
  }
  const parkedOrFlying = (): boolean => walker.parked
  const feetNow = (): Float64Array => {
    if (walker.parked) return manual
    walker.read(now)
    return now
  }

  const moveParked = (dx: number, dz: number): void => {
    manual[0] = (manual[0] as number) + dx
    manual[2] = (manual[2] as number) + dz
  }

  const toggleFly = (): boolean => {
    flying = !flying
    sync()
    // nothing fits where the body would come down: it stays in flight
    if (!flying && walker.parked && !seated && !held) {
      flying = true
      pendingUnpark = false
    }
    return flying
  }

  return {
    get x() {
      return feetNow()[0] as number
    },
    get z() {
      return feetNow()[2] as number
    },
    get drawnX() {
      return parkedOrFlying() ? (manual[0] as number) : (drawn[0] as number)
    },
    get drawnZ() {
      return parkedOrFlying() ? (manual[2] as number) : (drawn[2] as number)
    },
    get feet() {
      return feetNow()[1] as number
    },
    get drawnFeet() {
      return parkedOrFlying() ? (manual[1] as number) : (drawn[1] as number) - stepLag
    },
    get speed() {
      return walked
    },
    get running() {
      return running
    },
    get grounded() {
      return !flying && (walker.parked || walker.supported())
    },
    get flying() {
      return flying
    },
    get seated() {
      return seated
    },
    get mustCrouch() {
      return mustCrouch
    },
    toggleFly,
    setFly(enabled) {
      if (flying !== enabled) toggleFly()
    },
    setSeated(value) {
      seated = value
      sync()
    },
    hold(value) {
      held = value
      sync()
    },
    canStand: (x, z) => !blockedAt(x, z, PLAYER_RADIUS, feetNow()[1] as number, 'all'),
    moveBy(dx, dz) {
      if (dx === 0 && dz === 0) return
      if (walker.parked) {
        moveParked(dx, dz)
        return
      }
      wish.x += dx
      wish.z += dz
      walker.read(now)
      const feet = now[1] as number
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (PLAYER_RADIUS / 3)))
      let x = now[0] as number
      let z = now[2] as number
      for (let i = 0; i < steps; i++) {
        if (!blockedAt(x + dx / steps, z, PLAYER_RADIUS, feet, 'all')) x += dx / steps
        if (!blockedAt(x, z + dz / steps, PLAYER_RADIUS, feet, 'all')) z += dz / steps
      }
      walker.teleport([x, feet, z])
      resync()
    },
    takeWish() {
      const out: [number, number] = [wish.x, wish.z]
      wish.x = 0
      wish.z = 0
      return out
    },
    place(position) {
      const floor = floorAt(position[0], position[2])
      if (walker.parked) {
        manual[0] = position[0]
        manual[1] = flying ? position[1] : floor
        manual[2] = position[2]
        return floor
      }
      walker.read(now)
      const moved = Math.abs((now[0] as number) - position[0]) > 1e-3 || Math.abs((now[2] as number) - position[2]) > 1e-3
      if (moved || !walker.supported()) walker.teleport([position[0], floor, position[2]])
      resync()
      return floor
    },
    knocked(_knock, added) {
      if (walker.parked) return
      inKnock = true
      stepSpeed = 0
      slam = null
      walker.push([added[0] * mass, added[1] * mass, added[2] * mass])
      if (added[1] > 0.5) launchWait = LAUNCH_WAIT
    },
    stepKnock(k: Knock, dt) {
      walker.read(now)
      wantX = 0
      wantZ = 0
      const supported = walker.supported()
      if (launchWait > 0) launchWait = supported ? launchWait - dt : 0
      ghost.x = now[0] as number
      ghost.y = now[1] as number
      ghost.z = now[2] as number
      const ground = launchWait > 0 || !supported ? -Infinity : (now[1] as number)
      const vx = k.velocity[0]
      const vz = k.velocity[2]
      const done = stepKnock(k, ghost, dt, () => ground, true)
      if (slam) {
        const into = slam
        slam = null
        k.velocity[0] = 0
        k.velocity[2] = 0
        o.onSlam?.({ against: 'obstacle', speed: into.speed, direction: [into.x / Math.hypot(into.x, into.z), 0, into.z / Math.hypot(into.x, into.z)] })
      }
      if (landed > 0) {
        const speed = landed
        landed = 0
        if (k.down && speed >= SLAM_MIN_SPEED * 0.5) o.onSlam?.({ against: 'ground', speed: Math.hypot(speed, Math.hypot(vx, vz) * 0.5), direction: [0, -1, 0] })
        else if (speed >= LANDING_MIN_SPEED) o.onFeet?.({ type: 'land', speed })
      }
      applyStance(k.down ? 'prone' : 'standing')
      running = false
      stepLag *= Math.exp(-STEP_EASE_RATE * dt)
      if (done) inKnock = false
      return done
    },
    update(dt, input) {
      stepLag *= Math.exp(-STEP_EASE_RATE * dt)
      if (stepLag < 1e-4) stepLag = 0
      if (flying) {
        if (input.walkX || input.walkZ) moveParked(input.walkX * input.speed * dt, input.walkZ * input.speed * dt)
        if (input.rise !== 0) manual[1] = (manual[1] as number) + input.rise * input.speed * dt
        walked = dt > 0 ? Math.hypot(input.walkX, input.walkZ) * input.speed : 0
        running = input.running && (walked > 0 || input.rise !== 0)
        return
      }
      if (walker.parked) {
        if (pendingUnpark) tryUnpark()
        walked = 0
        running = false
        return
      }
      walker.read(now)
      applyStance(input.crouched ? 'crouched' : 'standing')
      const factor = o.speedAt?.(now[0] as number, now[2] as number) ?? 1
      const moving = (input.walkX !== 0 || input.walkZ !== 0) && !input.walkHeld
      wantX = moving ? input.walkX * input.speed * factor : 0
      wantZ = moving ? input.walkZ * input.speed * factor : 0
      running = input.running && moving
      if (landed > 0) {
        const speed = landed
        landed = 0
        if (speed >= LANDING_MIN_SPEED) o.onFeet?.({ type: 'land', speed })
      }
      if (input.jump && !input.walkHeld && loop.frame.time > lastJumpTime && walker.jump()) {
        lastJumpTime = loop.frame.time
        o.onFeet?.({ type: 'jump' })
      }
      walker.drawn(alpha, drawn)
    },
    present(next) {
      alpha = next
      refreshDrawn()
    },
    shadowBody: () => engine.services.world.characterBody(walker.id),
    dispose() {
      stopPhase()
      walker.dispose()
    },
  }
}

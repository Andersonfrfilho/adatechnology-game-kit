import { stepKnock } from '@adatechnology/game-contracts'
import type { Knock } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'

import { FOOT, LANDING_MIN_SPEED, PLAYER_RADIUS, SLAM_MIN_SPEED, createBlockedTest } from './locomotion'
import type { Locomotion, LocomotionContext } from './locomotion'

/** The widths of the body, against its full width, that say how deep something has come into it. */
const CLEAR_SHARES = [1, 0.75, 0.5, 0.25]
const JUMP = 4.6
const GRAVITY = 13
const FLOOR_CLIMB_SPEED = 3
const FLOOR_FALL_SPEED = 6
/** Per second, how fast the eye settles after the feet stepped up onto a sill or a heap (about a tenth of a second to take most of it). */
const STEP_EASE_RATE = 20

/** The room's own walk: the colliders, the blockers and the footing stop the body, a jump is a parabola, a knock slides. */
export const createOwnLocomotion = (o: LocomotionContext, start: Vec3): Locomotion => {
  const { outside, blocked: blockedAt } = createBlockedTest(o)
  let y = 0
  let vy = 0
  /** The floor under the feet at the last update (0 before the first). */
  let floorUnder = 0
  let walked = 0
  let running = false
  const px = { x: start[0], z: start[2] }
  const floorHere = (): number => o.floorAt?.(px.x, px.z) ?? 0
  let floorLevel = 0
  // metres the eye still lags below the feet after a step up: the feet are on the sill at once, the view climbs it over a few frames instead of popping
  let stepLag = 0
  let flying = false
  let flyY = 0
  let seated = false
  // the eye eases over a rim and falls into a hole instead of jumping with every cell of the ground
  const followFloor = (dt: number): void => {
    stepLag *= Math.exp(-STEP_EASE_RATE * dt)
    if (stepLag < 1e-4) stepLag = 0
    const gap = floorHere() - floorLevel
    const reach = (gap > 0 ? FLOOR_CLIMB_SPEED : FLOOR_FALL_SPEED) * dt
    const move = Math.max(-reach, Math.min(reach, gap))
    floorLevel += move
    if (move > 0) stepLag += move
  }
  const blocked = (x: number, z: number, radius = PLAYER_RADIUS): boolean => blockedAt(x, z, radius, floorLevel + y, true)
  /** The widest body that fits where the player is, or null when not even the narrowest does: how deep something has come into the player. */
  const clearRadius = (): number | null => {
    for (const share of CLEAR_SHARES) if (!blocked(px.x, px.z, PLAYER_RADIUS * share)) return PLAYER_RADIUS * share
    return null
  }
  // what the player tried to walk since the last `takeWish` (blocked or not): the room pushes what stands in the way by it
  const wish = { x: 0, z: 0 }
  const move = (dx: number, dz: number): void => {
    wish.x += dx
    wish.z += dz
    if (flying) {
      px.x += dx
      px.z += dz
      return
    }
    // caught in something (a piece fell on the spot, a piece settling touches the body) the player walks out of it, and never deeper; right inside, every way is out
    const radius = clearRadius()
    const free = (x: number, z: number): boolean => (radius === null ? !outside(x, z) : !blocked(x, z, radius))
    // in steps no longer than a third of the body's width, so a long move (a slow frame, the end of a scripted walk) cannot jump over a thin obstacle
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (PLAYER_RADIUS / 3)))
    const sx = dx / steps
    const sz = dz / steps
    for (let i = 0; i < steps; i++) {
      if (free(px.x + sx, px.z)) px.x += sx
      if (free(px.x, px.z + sz)) px.z += sz
    }
  }
  const toggleFly = (): boolean => {
    flying = !flying
    if (flying) {
      flyY = floorLevel + y
      vy = 0
    } else {
      floorLevel = floorHere()
      y = Math.max(0, flyY - floorLevel)
      const foot = o.footing?.(px.x, px.z, PLAYER_RADIUS * FOOT, flyY)
      if (foot && Number.isFinite(foot.floor) && foot.floor > floorLevel) {
        y = Math.max(y, foot.floor - floorLevel)
      }
      vy = 0
    }
    return flying
  }

  return {
    get x() {
      return px.x
    },
    get z() {
      return px.z
    },
    get feet() {
      return flying ? flyY : floorLevel + y
    },
    get drawnFeet() {
      return flying ? flyY : floorLevel + y - stepLag
    },
    get floorLevel() {
      return floorLevel
    },
    get speed() {
      return walked
    },
    get running() {
      return running
    },
    get grounded() {
      return !flying && y <= floorUnder + 1e-3 && vy <= 0
    },
    get flying() {
      return flying
    },
    get seated() {
      return seated
    },
    mustCrouch: false,
    toggleFly,
    setFly(enabled) {
      if (flying === enabled) return
      toggleFly()
    },
    setSeated(value) {
      seated = value
      y = 0
      vy = 0
    },
    canStand: (x, z) => !blocked(x, z),
    moveBy: move,
    takeWish() {
      const out: [number, number] = [wish.x, wish.z]
      wish.x = 0
      wish.z = 0
      return out
    },
    place(position: Vec3) {
      px.x = position[0]
      px.z = position[2]
      floorLevel = floorHere()
      stepLag = 0
      y = 0
      flyY = position[1]
      vy = 0
      return floorLevel
    },
    knocked(knock) {
      if (knock.airborne) vy = Math.max(vy, knock.velocity[1])
    },
    /** One step of a knock: the body flies and slides, stopped by the colliders like a walk, falls, lies and gets up; the keys wait. */
    stepKnock(k: Knock, dt) {
      const floor = Math.max(floorHere(), o.footing?.(px.x, px.z, PLAYER_RADIUS * FOOT, y).floor ?? -Infinity)
      floorUnder = floor
      const at = { x: px.x, y, z: px.z }
      const fromY = y
      const fallSpeed = Math.max(0, -k.velocity[1])
      const done = stepKnock(k, at, dt, () => floor, true)
      const wantX = at.x - px.x
      const wantZ = at.z - px.z
      const fromX = px.x
      const fromZ = px.z
      const vx = k.velocity[0]
      const vz = k.velocity[2]
      move(wantX, wantZ)
      // what stopped the body takes the speed that went into it, and the body slams into it
      const stoppedX = Math.abs(wantX) > 1e-6 && Math.abs(px.x - fromX) < Math.abs(wantX) * 0.5
      const stoppedZ = Math.abs(wantZ) > 1e-6 && Math.abs(px.z - fromZ) < Math.abs(wantZ) * 0.5
      if (stoppedX) k.velocity[0] = 0
      if (stoppedZ) k.velocity[2] = 0
      const into = Math.hypot(stoppedX ? vx : 0, stoppedZ ? vz : 0)
      if (into >= SLAM_MIN_SPEED) o.onSlam?.({ against: 'obstacle', speed: into, direction: [stoppedX ? vx / into : 0, 0, stoppedZ ? vz / into : 0] })
      y = at.y
      if (fromY > floor && y <= floor) {
        const speed = Math.max(fallSpeed, (fromY - y) / Math.max(dt, 1e-6))
        if (k.down && speed >= SLAM_MIN_SPEED * 0.5) o.onSlam?.({ against: 'ground', speed: Math.hypot(speed, Math.hypot(vx, vz) * 0.5), direction: [0, -1, 0] })
        else if (speed >= LANDING_MIN_SPEED) o.onFeet?.({ type: 'land', speed })
      }
      vy = 0
      walked = dt > 0 ? Math.hypot(px.x - fromX, px.z - fromZ) / dt : 0
      running = false
      followFloor(dt)
      return done
    },
    update(dt, input) {
      const fromX = px.x
      const fromZ = px.z
      if (flying) {
        if (input.walkX || input.walkZ) move(input.walkX * input.speed * dt, input.walkZ * input.speed * dt)
        if (input.rise !== 0) flyY += input.rise * input.speed * dt
        walked = dt > 0 ? Math.hypot(px.x - fromX, px.z - fromZ) / dt : 0
        running = input.running && (walked > 0 || input.rise !== 0)
        vy = 0
        return
      }
      const speed = input.speed * (o.speedAt?.(px.x, px.z) ?? 1)
      if ((input.walkX || input.walkZ) && !input.walkHeld) move(input.walkX * speed * dt, input.walkZ * speed * dt)
      walked = dt > 0 ? Math.hypot(px.x - fromX, px.z - fromZ) / dt : 0
      running = input.running && walked > 0
      if (seated) {
        followFloor(dt)
        return
      }
      // the floor under the feet: a step up is taken at once, a drop is a fall
      const currentFeet = floorLevel + y
      const solidFoot = o.footing?.(px.x, px.z, PLAYER_RADIUS * FOOT, currentFeet)
      const solidFloor = solidFoot && Number.isFinite(solidFoot.floor) ? solidFoot.floor - floorLevel : -Infinity
      const floor = Math.max(0, solidFloor)
      floorUnder = floor
      if (y < floor && vy <= 0) {
        stepLag += floor - y
        y = floor
      }
      if (y <= floor && input.jump && !input.walkHeld) {
        vy = JUMP
        o.onFeet?.({ type: 'jump' })
      }
      if (y > floor || vy > 0) {
        vy -= GRAVITY * dt
        y += vy * dt
        if (y <= floor) {
          y = floor
          if (-vy >= LANDING_MIN_SPEED) o.onFeet?.({ type: 'land', speed: -vy })
          vy = 0
        }
      }
      followFloor(dt)
    },
    dispose() {},
  }
}

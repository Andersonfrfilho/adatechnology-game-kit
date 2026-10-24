import type * as THREE_NS from 'three'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { DestructionRenderer } from '@adatechnology/game-destruction-three'
import { backblastEffect, blastEffect, createExplosiveBody } from '@adatechnology/game-weapons'
import type { Arsenal, Detonation, ExplosiveBody, SurfaceProbe, Use } from '@adatechnology/game-weapons'
import type { HostEvent } from '@adatechnology/game-contracts'

type Vars = Record<string, string | number>
type Fire = { temperature: number; radius: number; seconds: number }

/** Radius of the blast a cone gives to each object inside it: the blast is the object's own, not the area around it. */
const CONE_BLAST_RADIUS = 0.5

interface Projectile {
  mesh: THREE_NS.Object3D
  pos: THREE_NS.Vector3
  vel: THREE_NS.Vector3
  weapon: string
  fuse: number
  burstOnImpact: boolean
  energy: number
  radius: number
  fire?: Fire | undefined
  age: number
  /** The explosive that flies or waits (`game-weapons`): when set, it decides the flight and the blast. */
  body?: ExplosiveBody | undefined
  /** Points along its velocity (a rocket). */
  aligned?: boolean
  /** Set down where it was used: waits for its trigger instead of flying. */
  placed?: boolean
}

/** What the explosives need from the room: the world to blast, the renderer to draw it, the log and the host to tell, and the few room rules (ground, held object, fire). */
export type ExplosivesContext = {
  readonly THREE: typeof THREE_NS
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.Camera
  readonly world: Pick<DestructionWorld, 'raycast' | 'explode'>
  readonly renderer: Pick<DestructionRenderer, 'emit' | 'explode'>
  readonly arsenal: Pick<Arsenal, 'explosives' | 'rules'>
  /** The roots of the objects a blast can reach (the arena is not one). */
  readonly objects: () => readonly THREE_NS.Object3D[]
  readonly toolId: () => string
  readonly toolName: (id?: string) => string
  readonly withoutHeld: <TResult>(run: () => TResult) => TResult
  readonly groundAt: (x: number, z: number) => number
  readonly translate: (key: string, vars?: Vars) => string
  readonly format: (value: number, digits?: number) => string
  readonly action: (type: string, text: string, extra?: { data?: Record<string, unknown> }) => void
  readonly emitHost: (event: HostEvent) => void
  readonly startFire: (weapon: string, at: Vec3, fire: Fire, isImpact: boolean) => void
  readonly say: (message: string) => void
}

export type Explosives = {
  throwUse: (use: Extract<Use, { kind: 'throw' }>) => void
  placeUse: (use: Extract<Use, { kind: 'place' }>) => void
  backblastUse: (use: Extract<Use, { kind: 'backblast' }>) => void
  /** Sets off the charges set down that wait for a remote detonator or a trip wire; returns how many went off. */
  detonateCharges: () => number
  update: (dt: number) => void
  /** Removes every projectile and charge, and their meshes. */
  clear: () => void
}

const toArray = (vector: THREE_NS.Vector3): Vec3 => [vector.x, vector.y, vector.z]

/** The projectiles (grenades, molotovs, rockets) and charges set down: an `ExplosiveBody` of game-weapons flies or waits, the room only draws it and applies the blast. */
export function createExplosives(context: ExplosivesContext): Explosives {
  const { THREE, scene, camera, world, renderer, arsenal, translate, format, action } = context
  const projectiles: Projectile[] = []
  const meshes: THREE_NS.Object3D[] = []
  const up = new THREE.Vector3(0, 1, 0)

  const clear = (): void => {
    projectiles.length = 0
    for (const mesh of meshes) mesh.removeFromParent()
    meshes.length = 0
  }

  const addMesh = (geometry: THREE_NS.BufferGeometry, color: number, metalness: number, at: Vec3): THREE_NS.Mesh => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness }))
    mesh.castShadow = true
    mesh.position.set(at[0], at[1], at[2])
    scene.add(mesh)
    meshes.push(mesh)
    return mesh
  }

  const remove = (projectile: Projectile): void => {
    projectile.mesh.removeFromParent()
    const meshAt = meshes.indexOf(projectile.mesh)
    if (meshAt >= 0) meshes.splice(meshAt, 1)
    const at = projectiles.indexOf(projectile)
    if (at >= 0) projectiles.splice(at, 1)
  }

  const throwUse = (use: Extract<Use, { kind: 'throw' }>): void => {
    const isMolotov = !!use.fire
    const isRocket = use.trigger === 'impact' && (use.armDistance ?? 0) > 0
    const geometry = isRocket ? new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8) : isMolotov ? new THREE.CylinderGeometry(0.035, 0.04, 0.2, 8) : new THREE.SphereGeometry(0.045, 8, 6)
    const mesh = addMesh(geometry, isMolotov ? 0x3b7a3b : isRocket ? 0x6b705c : 0x4b5320, isMolotov ? 0 : 0.4, use.origin)
    projectiles.push({
      mesh,
      pos: new THREE.Vector3(use.origin[0], use.origin[1], use.origin[2]),
      vel: new THREE.Vector3(use.velocity[0], use.velocity[1], use.velocity[2]),
      weapon: context.toolId(),
      fuse: use.fuse,
      burstOnImpact: isMolotov && use.fuse <= 0,
      energy: use.energy,
      radius: use.radius,
      fire: use.fire,
      age: 0,
      ...(use.explosive !== undefined ? { body: createExplosiveBody(use, arsenal.explosives, arsenal.rules.explosives), aligned: isRocket } : {}),
    })
    const key = isRocket ? 'act.launch' : isMolotov ? 'act.throw.molotov' : 'act.throw.grenade'
    action(isRocket ? 'launch_projectile' : 'throw_projectile', translate(key, { weapon: context.toolName(), fuse: format(use.fuse, 1), arm: format(use.armDistance ?? 0, 0) }), {
      data: { weapon: context.toolId(), fuse: use.fuse, explosive: use.explosive },
    })
  }

  /** A charge goes where the player aims, on the first surface within reach, else on the floor 2 m ahead. */
  const placementPoint = (use: Extract<Use, { kind: 'place' }>): Vec3 => {
    const hit = context.withoutHeld(() => world.raycast(use.origin, use.direction, 3))
    if (hit) return [hit.point[0] + hit.normal[0] * 0.03, hit.point[1] + hit.normal[1] * 0.03, hit.point[2] + hit.normal[2] * 0.03]
    const x = use.origin[0] + use.direction[0] * 2
    const z = use.origin[2] + use.direction[2] * 2
    return [x, context.groundAt(x, z) + 0.03, z]
  }

  const placeUse = (use: Extract<Use, { kind: 'place' }>): void => {
    const at = placementPoint(use)
    const body = createExplosiveBody({ ...use, origin: at }, arsenal.explosives, arsenal.rules.explosives)
    if (!body) return
    const mesh = addMesh(new THREE.BoxGeometry(0.18, 0.06, 0.1), use.explosive === 'claymore' ? 0x556b2f : 0xc2a878, 0.1, at)
    mesh.rotation.y = Math.atan2(use.direction[0], use.direction[2])
    projectiles.push({ mesh, pos: new THREE.Vector3(at[0], at[1], at[2]), vel: new THREE.Vector3(), weapon: context.toolId(), fuse: 0, burstOnImpact: false, energy: use.energy, radius: use.radius, age: 0, body, placed: true })
    action('place_charge', translate('act.place', { weapon: context.toolName(), triggers: use.triggers.join('/') || '-' }), { data: { weapon: context.toolId(), explosive: use.explosive, triggers: [...use.triggers], point: at } })
  }

  /** The blast behind a launcher: a puff of dust in the cone and what lies inside it, counted. */
  const backblastUse = (use: Extract<Use, { kind: 'backblast' }>): void => {
    renderer.emit('smoke', use.origin, use.direction, 14, use.radius)
    let reached = 0
    for (const object of context.objects()) if (backblastEffect(use, toArray(object.position)) > 0) reached++
    const onPlayer = backblastEffect(use, toArray(camera.position))
    action('backblast', translate('act.backblast', { weapon: context.toolName(), radius: format(use.radius, 0), n: reached, player: format(onPlayer, 2) }), {
      data: { weapon: context.toolId(), radius: use.radius, halfAngleDeg: use.halfAngleDeg, objects: reached, onPlayer },
    })
  }

  const surfaceProbe: SurfaceProbe = (from, to) => {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const dz = to[2] - from[2]
    const length = Math.hypot(dx, dy, dz)
    if (length < 1e-6) return null
    const direction: Vec3 = [dx / length, dy / length, dz / length]
    const ray = context.withoutHeld(() => world.raycast(from, direction, length + 0.03))
    let best: { point: Vec3; normal: Vec3; ground: boolean; at: number } | null = ray && ray.distance <= length + 0.03 ? { point: ray.point, normal: ray.normal, ground: ray.normal[1] > 0.7, at: ray.distance } : null
    const floor = context.groundAt(to[0], to[2]) + 0.045
    if (to[1] < floor) {
      const point: Vec3 = [to[0], floor, to[2]]
      const at = Math.hypot(point[0] - from[0], point[1] - from[1], point[2] - from[2])
      if (!best || at < best.at) best = { point, normal: [0, 1, 0], ground: true, at }
    }
    return best ? { point: best.point, normal: best.normal, ground: best.ground } : null
  }

  /** A directional charge only reaches what is inside its cone: each object in reach takes a blast of its own at its place, scaled by how close it is. */
  const coneBlast = (detonation: Detonation): number => {
    let reached = 0
    for (const object of context.objects()) {
      const at = toArray(object.position)
      const effect = blastEffect(detonation, at)
      if (effect.zone === 'none') continue
      reached += world.explode(at, detonation.energy * effect.falloff, CONE_BLAST_RADIUS, 'player').length
    }
    return reached
  }

  /** The only place a blast is applied: the world, the drawing, the log, the player's share, the host event and the fire. */
  const detonate = (projectile: Projectile, detonation: Detonation): void => {
    const weaponName = context.toolName(projectile.weapon)
    const reach = Math.max(detonation.injuryRadius, detonation.lethalRadius)
    const reached = detonation.energy <= 0 ? 0 : detonation.cone ? coneBlast(detonation) : world.explode(detonation.point, detonation.energy, reach, 'player').length
    if (detonation.energy > 0) renderer.explode(detonation.point, detonation.energy, reach)
    if (detonation.stunSeconds !== undefined) renderer.emit('flash', detonation.point, [0, 1, 0], 1, 1)
    const onPlayer = blastEffect(detonation, toArray(camera.position))
    action('explode', translate('act.explode', { weapon: weaponName, energy: format(detonation.energy, 0), radius: format(reach, 1), n: reached }), {
      data: { weapon: projectile.weapon, explosive: detonation.explosive, cause: detonation.cause, energyJ: detonation.energy, radius: reach, point: detonation.point, player: onPlayer.zone, stunSeconds: onPlayer.stunSeconds },
    })
    if (onPlayer.zone !== 'none') {
      action('blast_player', translate('act.blast_player', { weapon: weaponName, zone: translate(`blast.zone.${onPlayer.zone}`), distance: format(onPlayer.distance, 1), stun: format(onPlayer.stunSeconds, 1) }), { data: { ...onPlayer } })
    }
    context.emitHost({ type: 'explosion', source: projectile.weapon, point: detonation.point, energy: detonation.energy, radius: reach, cause: detonation.cause })
    if (detonation.fire) context.startFire(projectile.weapon, detonation.point, detonation.fire, detonation.cause === 'impact')
  }

  /** A projectile with no `ExplosiveBody` (a use that names no explosive) blasts a sphere of its own radius, with the same effects as any other. */
  const detonateBare = (projectile: Projectile, isImpact: boolean): void => {
    detonate(projectile, {
      explosive: projectile.weapon,
      cause: isImpact ? 'impact' : 'timer',
      point: toArray(projectile.pos),
      direction: [0, 1, 0],
      at: projectile.age,
      energy: projectile.energy,
      lethalRadius: 0,
      injuryRadius: projectile.radius,
      noise: 0,
      destructionLevel: 0,
      ...(projectile.fire ? { fire: projectile.fire } : {}),
    })
  }

  const detonateCharges = (): number => {
    let count = 0
    for (const projectile of [...projectiles]) {
      if (!projectile.placed || !projectile.body) continue
      const event = projectile.body.trigger('remote') ?? projectile.body.trigger('wire')
      if (event?.type !== 'detonate') continue
      detonate(projectile, event.detonation)
      remove(projectile)
      count++
    }
    if (count === 0) context.say(translate('hud.no_charges'))
    return count
  }

  const stepBody = (projectile: Projectile, body: ExplosiveBody, dt: number): void => {
    const events = body.step(dt, surfaceProbe)
    projectile.pos.set(body.position[0], body.position[1], body.position[2])
    projectile.mesh.position.copy(projectile.pos)
    if (projectile.aligned && body.velocity[0] ** 2 + body.velocity[1] ** 2 + body.velocity[2] ** 2 > 1e-6) {
      projectile.mesh.quaternion.setFromUnitVectors(up, new THREE.Vector3(body.velocity[0], body.velocity[1], body.velocity[2]).normalize())
    } else if (!projectile.placed) projectile.mesh.rotation.x += dt * 8
    for (const event of events) {
      if (event.type === 'dud') action('dud', translate('act.dud', { weapon: context.toolName(projectile.weapon), distance: format(body.travelled, 1) }), { data: { weapon: projectile.weapon, point: event.point } })
      else if (event.type === 'detonate') detonate(projectile, event.detonation)
    }
  }

  /** Moves a bare projectile one step (gravity, bounce on the first surface or the ground); true when it bursts on impact. */
  const flyBare = (projectile: Projectile, dt: number): boolean => {
    const { gravity } = arsenal.rules.explosives
    let isBurst = false
    projectile.vel.y -= gravity * dt
    const speed = projectile.vel.length()
    const step = speed * dt
    if (step > 1e-6) {
      const direction: Vec3 = [projectile.vel.x / speed, projectile.vel.y / speed, projectile.vel.z / speed]
      const hit = context.withoutHeld(() => world.raycast(toArray(projectile.pos), direction, step + 0.05))
      if (hit && hit.distance <= step + 0.04) {
        projectile.pos.set(hit.point[0] - direction[0] * 0.03, hit.point[1] - direction[1] * 0.03, hit.point[2] - direction[2] * 0.03)
        if (projectile.burstOnImpact) isBurst = true
        else {
          const normal = hit.normal
          const normalSpeed = projectile.vel.x * normal[0] + projectile.vel.y * normal[1] + projectile.vel.z * normal[2]
          projectile.vel.x = (projectile.vel.x - 2 * normalSpeed * normal[0]) * 0.35
          projectile.vel.y = (projectile.vel.y - 2 * normalSpeed * normal[1]) * 0.35
          projectile.vel.z = (projectile.vel.z - 2 * normalSpeed * normal[2]) * 0.35
        }
      } else projectile.pos.addScaledVector(projectile.vel, dt)
    }
    const ground = context.groundAt(projectile.pos.x, projectile.pos.z) + 0.045
    if (projectile.pos.y < ground) {
      projectile.pos.y = ground
      if (projectile.burstOnImpact) isBurst = true
      else {
        projectile.vel.y = Math.abs(projectile.vel.y) * 0.35
        projectile.vel.x *= 0.7
        projectile.vel.z *= 0.7
      }
    }
    return isBurst
  }

  const update = (dt: number): void => {
    for (let index = projectiles.length - 1; index >= 0; index--) {
      const projectile = projectiles[index]
      if (!projectile) continue
      projectile.age += dt
      if (projectile.body) {
        stepBody(projectile, projectile.body, dt)
        if (projectile.body.done || (!projectile.placed && projectile.age > 60)) remove(projectile)
        continue
      }
      const isBurst = flyBare(projectile, dt)
      projectile.mesh.position.copy(projectile.pos)
      projectile.mesh.rotation.x += dt * 8
      projectile.fuse -= dt
      if (isBurst || (!projectile.burstOnImpact && projectile.fuse <= 0) || projectile.age > 30) {
        detonateBare(projectile, isBurst)
        remove(projectile)
      }
    }
  }

  return { throwUse, placeUse, backblastUse, detonateCharges, update, clear }
}

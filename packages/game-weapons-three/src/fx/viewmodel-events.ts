import type * as THREE_NS from 'three'
import type { AnimationEventSpec } from '@adatechnology/game-contracts'
import { buildCasing, buildRound } from '../models/cartridge'
import { FLASH_BY_CASE } from './effects'
import { toWorld, worldPositionOf } from './session'
import type { FxWorld, Session } from './session'

const PI = Math.PI

const restFlat = (object: THREE_NS.Object3D): void => {
  object.rotation.x = 0
  object.rotation.z = 0
}

/** The handlers of the events a clip carries (`muzzle_flash`, `eject_casing`, `drop_magazine`, `move_in`...): the effects the page spawns around the moving parts. */
export function createClipEventHandler(world: FxWorld, session: Session): (event: AnimationEventSpec) => void {
  const { kit, particles, effects, random } = world
  const { THREE } = kit
  const { parts, root } = session.model
  const vector = (x: number, y: number, z: number): THREE_NS.Vector3 => new THREE.Vector3(x, y, z)
  const positionOf = (part: THREE_NS.Object3D): THREE_NS.Vector3 => worldPositionOf(session, part, new THREE.Vector3())
  const reach = Math.max(0.55, Math.min(1.2, session.lengthMetres))

  const throwCase = (mark: THREE_NS.Object3D, velocity: THREE_NS.Vector3, spin: THREE_NS.Vector3, tilt = 0): void => {
    if (!session.cartridge || !world.layers.casings) return
    const casing = buildCasing(kit, session.cartridge.dims, session.cartridge.shape)
    casing.group.position.copy(positionOf(mark))
    casing.group.rotation.set(0, random() * 0.6 - 0.3, tilt)
    particles.spawn(casing.group, velocity, { kind: 'casing', life: 25, radius: casing.radius, bounce: 0.35, spin, onRest: restFlat, ownsGeometry: true })
  }

  const ejectFromPort = (down: boolean): void => {
    if (!parts.eject) return
    const local = down ? vector((random() - 0.5) * 0.3, -0.4, (random() - 0.5) * 0.3) : vector(-0.2 - random() * 0.4, (0.9 + random() * 0.5) * reach, (1 + random() * 0.6) * reach)
    throwCase(parts.eject, toWorld(session, local), vector(random() * 30, random() * 30, random() * 30))
  }

  const ejectAll = (marks: THREE_NS.Object3D[] | undefined, spent: (index: number) => { velocity: THREE_NS.Vector3; spin: THREE_NS.Vector3; tilt: number }): void => {
    marks?.forEach((mark, index) => {
      const { velocity, spin, tilt } = spent(index)
      throwCase(mark, toWorld(session, velocity), spin, tilt)
    })
  }

  /** A round slides from `from` to `to` (world points) in a quarter of a second, in the weapon's own space so that it follows the weapon. */
  const moveIn = (from: THREE_NS.Vector3, to: THREE_NS.Vector3, tilt: number): void => {
    if (!session.cartridge) return
    const { group } = buildRound(kit, session.cartridge.dims, session.cartridge.shape)
    const start = root.worldToLocal(from.clone())
    const end = root.worldToLocal(to.clone())
    group.rotation.z = tilt
    group.position.copy(start)
    root.add(group)
    world.schedule(0, 0.24, (eased) => group.position.lerpVectors(start, end, eased), () => {
      group.removeFromParent()
      group.traverse((child) => {
        const mesh = child as THREE_NS.Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
    })
  }

  const offsetFrom = (point: THREE_NS.Vector3, x: number, y: number, z: number): THREE_NS.Vector3 => point.clone().add(toWorld(session, vector(x, y, z), true))

  const feedRound = (from: string, next: boolean): void => {
    if (from === 'loadPort' && parts.loadPort) {
      const port = positionOf(parts.loadPort)
      moveIn(offsetFrom(port, -0.03, -0.08, 0.07), port, 0.25)
    } else if (from === 'topLoad' && parts.topLoad) {
      const point = positionOf(parts.topLoad)
      moveIn(offsetFrom(point, 0, 0.07, 0), point, 0)
    } else if (from === 'chambers' && parts.chambers) {
      const marks = next ? [parts.chambers[session.nextChamber++ % parts.chambers.length]] : parts.chambers
      for (const mark of marks) {
        if (!mark) continue
        const point = positionOf(mark)
        moveIn(offsetFrom(point, -0.07, 0, 0), offsetFrom(point, 0.006, 0, 0), 0)
      }
    } else if (from === 'breech' && parts.breech) {
      for (const mark of parts.breech) {
        const point = positionOf(mark)
        moveIn(offsetFrom(point, -0.09, 0.05, 0), offsetFrom(point, 0.02, -0.01, 0), -0.5)
      }
    }
  }

  const dropMagazine = (up: boolean): void => {
    if (!parts.mag || !world.layers.magazines) return
    root.updateWorldMatrix(true, true)
    const copy = parts.mag.clone(true)
    parts.mag.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
    particles.spawn(copy, toWorld(session, vector(up ? -0.25 : 0.05, up ? 0.9 : -0.3, 0.18)), { kind: 'magazine', life: 25, radius: 0.014, bounce: 0.15, spin: vector(1.5, 0.5, 2.5), onRest: (object) => object.rotation.set(0, object.rotation.y, PI / 2) })
  }

  const stuckCase = (): void => {
    if (!session.cartridge || !parts.eject) return
    const casing = buildCasing(kit, session.cartridge.dims, session.cartridge.shape)
    const at = root.worldToLocal(offsetFrom(positionOf(parts.eject), 0, casing.length * 0.35, 0))
    casing.group.position.copy(at)
    casing.group.rotation.set(0, 0, PI / 2 - 0.25)
    root.add(casing.group)
    session.stuckCase = casing.group
  }

  const flyJam = (jam: string): void => {
    const stuck = session.stuckCase
    session.stuckCase = null
    if (stuck) {
      root.updateWorldMatrix(true, true)
      stuck.updateWorldMatrix(true, false)
      stuck.matrixWorld.decompose(stuck.position, stuck.quaternion, stuck.scale)
      particles.spawn(stuck, toWorld(session, vector(-0.2, 1.2, 1.3)), { kind: 'casing', life: 25, radius: 0.006, bounce: 0.3, spin: vector(9, 14, 7), onRest: restFlat, ownsGeometry: true })
    } else if (jam === 'misfire' && session.cartridge && parts.eject) {
      const round = buildRound(kit, session.cartridge.dims, session.cartridge.shape)
      round.group.position.copy(positionOf(parts.eject))
      particles.spawn(round.group, toWorld(session, vector(-0.2, 1.1, 1.2)), { kind: 'round', life: 25, radius: round.radius, bounce: 0.3, spin: vector(8, 12, 6), onRest: restFlat, ownsGeometry: true })
    } else ejectFromPort(false)
  }

  return (event) => {
    const data = event.data ?? {}
    switch (event.type) {
      case 'muzzle_flash':
        if (parts.muzzle && world.layers.muzzleFlash) effects.muzzleFlash(positionOf(parts.muzzle), root.getWorldQuaternion(new THREE.Quaternion()), session.def.action.kind === 'launcher' ? 2.2 : FLASH_BY_CASE[session.caseType])
        break
      case 'eject_casing':
        if (data.from === 'chambers') ejectAll(parts.chambers, () => ({ velocity: vector(-0.5 - random() * 0.3, -0.1 + random() * 0.3, (random() - 0.5) * 0.25), spin: vector(10, 20, 5), tilt: 0 }))
        else if (data.from === 'breech') ejectAll(parts.breech, () => ({ velocity: vector(-1, 0.9, (random() - 0.5) * 0.2), spin: vector(3, 8, 12), tilt: -0.5 }))
        else ejectFromPort(data.down === true)
        break
      case 'drop_magazine':
        dropMagazine(data.up === true)
        break
      case 'move_in':
        feedRound(String(data.from), data.next === true)
        break
      case 'stuck_case':
        stuckCase()
        break
      case 'fly_jam':
        flyJam(String(data.jam))
        break
      case 'show_round':
        if (parts.round) parts.round.visible = true
        break
      case 'drop_tube':
        dropTube()
        break
      case 'seat_tube':
        root.visible = true
        break
      case 'breech_round':
        breechRound()
        break
      default:
        break
    }
  }

  function dropTube(): void {
    root.updateWorldMatrix(true, true)
    const old = root.clone(true)
    root.matrixWorld.decompose(old.position, old.quaternion, old.scale)
    root.visible = false
    particles.spawn(old, toWorld(session, vector(0.2, 0.4, 0.6)), { life: 8, radius: 0.05, bounce: 0.2, spin: vector(0, 0.8, 2.5) })
  }

  function breechRound(): void {
    const make = parts.makeRound
    if (!make) return
    const shell = make()
    session.model.inner.add(shell)
    shell.position.set(-0.25, 0, 0)
    world.schedule(0.02, 0.4, (eased) => (shell.position.x = -0.25 + 0.6 * eased), () => {
      shell.removeFromParent()
    })
  }
}

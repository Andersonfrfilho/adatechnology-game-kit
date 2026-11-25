import type * as THREE_NS from 'three'
import { discardObject3D, markShared } from '@adatechnology/game-shapes-three'
import { breachOf, leakOfPipe } from '@adatechnology/game-urban/networks'
import type { Breach, Crater, NetworkLeak, PipeContent, PipePiece } from '@adatechnology/game-urban/networks'

import type { Three } from '../kernel-types.js'
import type { RoutePoint } from './installation-routes.js'

/** The stage group whose `userData` keeps the house's buried runs (`buildInstallationsStage`). */
const INSTALLATIONS_STAGE = 'stage:4:installations'
/** Metres of a broken pipe a blast takes out where it breaks. */
const BREAK_GAP = 0.2
/** A stretch shorter than this across the ground is a riser going up into the house, not a run under the yard. */
const RISER_SPAN = 1e-3

interface StagePiece {
  readonly points: readonly RoutePoint[]
  readonly bore: number
}

/** One buried stretch of the house: the piece `breachOf` reads (world metres) and the stretch it is drawn from (the house's own frame). */
interface Stretch {
  readonly pipe: PipePiece
  readonly a: RoutePoint
  readonly b: RoutePoint
  readonly bore: number
  readonly material: THREE_NS.Material
}

export interface HouseCraterResult {
  /** What the bowl reached: the pipes whose top it got down to, and those it severed. */
  readonly breach: Breach
  /** One leak per pipe the bowl severed now (`leakOfPipe` of `game-urban`): sewage runs; the rain pipe only while it rains. */
  readonly leaks: readonly NetworkLeak[]
}

export interface HouseBuriedPipes {
  /** The house's pipes under the yard as `game-urban` pieces, world metres (sewer branches and collector, rain pipes). */
  readonly pipes: readonly PipePiece[]
  /** A bowl the ground took: the pipes it reaches show in it, those it gets down to the centre line of break and leak. */
  crater(crater: Crater, options: { readonly isRaining: boolean }): HouseCraterResult
  /** The pipes whole and buried again (the world was reset). */
  reset(): void
  dispose(): void
}

const CONTENT: Readonly<Record<'sewer' | 'rain', { readonly kind: PipePiece['kind']; readonly content: PipeContent }>> = {
  sewer: { kind: 'sewer_lateral', content: 'sewage' },
  rain: { kind: 'storm_lateral', content: 'stormwater' },
}

function stretchesOf(stage: THREE_NS.Object3D, house: THREE_NS.Object3D, THREE: Three, materials: Readonly<Record<'sewer' | 'rain', THREE_NS.Material>>): Stretch[] {
  const toWorld = (point: RoutePoint): [number, number, number] => {
    const at = stage.localToWorld(new THREE.Vector3(point[0], point[1], point[2]))
    return [at.x, at.y, at.z]
  }
  const groundAt = (point: RoutePoint): number => toWorld([point[0], 0, point[2]])[1]
  return (['sewer', 'rain'] as const).flatMap((network) => {
    const pieces = ((stage.userData[network] as { pieces?: readonly StagePiece[] } | undefined)?.pieces ?? [])
    return pieces.flatMap((piece, index) =>
      piece.points.slice(1).flatMap((b, step): Stretch[] => {
        const a = piece.points[step]!
        if (Math.hypot(b[0] - a[0], b[2] - a[2]) < RISER_SPAN) return []
        const pipe: PipePiece = { id: `${house.uuid}:${network}:${index}:${step}`, ...CONTENT[network], from: toWorld(a), to: toWorld(b), diameter: piece.bore, material: 'plastic', ground: [groundAt(a), groundAt(b)] }
        return [{ pipe, a, b, bore: piece.bore, material: materials[network] }]
      }),
    )
  })
}

/**
 * The house's buried pipes as the ground has them (`HouseBuriedPipes`), read from the installations stage the house was built with: the sewer from each drain to the inspection box
 * at the front of the lot (NBR 8160) and the rain pipes from each sand box to the kerb (NBR 10844). A bowl that reaches one is asked with the street's own rule (`breachOf` of
 * `game-urban`): its top inside the bowl shows the pipe in the hole, the bowl down to its centre line breaks it there (a gap) and it leaks (`leakOfPipe`). Nothing is drawn until a
 * bowl reaches a pipe. Undefined for a house built without its construction stages.
 */
export function createHouseBuriedPipes(THREE: Three, house: THREE_NS.Object3D): HouseBuriedPipes | undefined {
  const stage = house.getObjectByName(INSTALLATIONS_STAGE)
  if (!stage) return undefined
  house.updateMatrixWorld(true)
  const materials = { sewer: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65 }), rain: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.6 }) }
  // a pipe broken and mended again draws with the same two: they go with the house's pipes, in `dispose`
  markShared(materials.sewer, materials.rain)
  const stretches = stretchesOf(stage, house, THREE, materials)
  const byId = new Map(stretches.map((stretch) => [stretch.pipe.id, stretch]))
  const group = new THREE.Group()
  group.name = 'buried_pipes'
  // in the stage's own frame, where the stretches are
  group.position.copy(stage.position)
  group.quaternion.copy(stage.quaternion)
  house.add(group)
  const shown = new Map<string, THREE_NS.Object3D[]>()
  const severed = new Set<string>()

  const cylinder = (a: RoutePoint, b: RoutePoint, stretch: Stretch): THREE_NS.Mesh => {
    const direction = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(stretch.bore / 2, stretch.bore / 2, direction.length(), 12), stretch.material)
    mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    group.add(mesh)
    return mesh
  }
  const lerp = (stretch: Stretch, share: number): RoutePoint => [stretch.a[0] + (stretch.b[0] - stretch.a[0]) * share, stretch.a[1] + (stretch.b[1] - stretch.a[1]) * share, stretch.a[2] + (stretch.b[2] - stretch.a[2]) * share]
  const hide = (id: string): void => {
    for (const mesh of shown.get(id) ?? []) discardObject3D(mesh)
    shown.delete(id)
  }
  const draw = (stretch: Stretch, breakAt?: number): void => {
    hide(stretch.pipe.id)
    if (breakAt === undefined) {
      shown.set(stretch.pipe.id, [cylinder(stretch.a, stretch.b, stretch)])
      return
    }
    const length = Math.hypot(stretch.b[0] - stretch.a[0], stretch.b[1] - stretch.a[1], stretch.b[2] - stretch.a[2])
    const half = BREAK_GAP / 2 / Math.max(length, BREAK_GAP)
    const pieces = [[0, breakAt - half], [breakAt + half, 1]].filter(([from, to]) => to! - from! > 1e-3).map(([from, to]) => cylinder(lerp(stretch, Math.max(0, from!)), lerp(stretch, Math.min(1, to!)), stretch))
    shown.set(stretch.pipe.id, pieces)
  }

  return {
    pipes: stretches.map((stretch) => stretch.pipe),
    crater(crater, { isRaining }) {
      const breach = breachOf({ pipes: stretches.map((stretch) => stretch.pipe), surface: [] }, crater)
      const leaks: NetworkLeak[] = []
      for (const reached of breach.pipes) {
        const stretch = byId.get(reached.id)!
        if (severed.has(reached.id)) continue
        if (!reached.severed) {
          if (!shown.has(reached.id)) draw(stretch)
          continue
        }
        severed.add(reached.id)
        draw(stretch, reached.share)
        const leak = leakOfPipe(stretch.pipe, reached, { isRaining })
        if (leak) leaks.push(leak)
      }
      return { breach, leaks }
    },
    reset() {
      for (const id of [...shown.keys()]) hide(id)
      severed.clear()
    },
    dispose() {
      shown.clear()
      severed.clear()
      discardObject3D(group)
      for (const material of Object.values(materials)) material.dispose()
    },
  }
}

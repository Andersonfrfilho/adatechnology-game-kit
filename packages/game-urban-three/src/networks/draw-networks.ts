import type * as THREE_NS from 'three'

import { markKitOrigin } from '@adatechnology/game-contracts'
import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import type { LightBudget, SourceHandle } from '@adatechnology/game-render-three'
import { DEFAULT_POLES } from '@adatechnology/game-urban'
import type { DistributionSpec, LampShares, PoleDef } from '@adatechnology/game-urban'
import { networkLampsOf, slotsOfPole } from '@adatechnology/game-urban/networks'
import type { NetworkLamp, NetworkSurface, UtilityNetworks } from '@adatechnology/game-urban/networks'

import { flickerGroupOf, flickerGroupPhase, flickerLevel, physicalIntensityOf } from '../lamp-light'
import { drawPieces } from './draw-pieces'
import { drawWires } from './draw-wires'
import type { SpanRange } from './draw-wires'
import { piecesOf } from './pieces'
import { indexOf, poleFramesOf, worldOf } from './pole-frames'
import { guysOf, wireRunsOf } from './wire-runs'

type Three = typeof THREE_NS

/** Every lamp works unless the host says otherwise. */
const ALL_LAMPS_WORK: LampShares = { lit: 1, flicker: 0 }
/** Spans farther than this from the focus are drawn as lines. */
const NEAR_DISTANCE = 90

export type NetworkDrawOptions = {
  /** Night lights the lamps whose state is on. Default false. */
  readonly isNight?: boolean
  /** At night, the share of lamps that work and the share that flicker (`lampStateOf`). Default every lamp works. */
  readonly lamps?: LampShares
  /** Road, sidewalk or lot under a point (`GeneratedNetworks.surfaceAt`): a guy anchors on the sidewalk only. */
  readonly surfaceAt?: (x: number, z: number) => NetworkSurface
  /** The pole registry the nodes' `spec` ids are read from (`urban.poles`). Default the kit's `DEFAULT_POLES`. */
  readonly poles?: { get(id: string): { readonly def: PoleDef } }
  /** Spans within this of the focus (`setFocus`) are tubes, the others lines. Default 90 m. */
  readonly nearDistance?: number
  readonly root?: THREE_NS.Object3D
}

/** A lit lamp of the network drawn through the host's light budget. */
export type NetworkLight = { readonly bulb: THREE_NS.Object3D; readonly lamp: NetworkLamp; readonly source: SourceHandle }

export type DrawnNetworks = {
  readonly root: THREE_NS.Object3D
  /** Every light node with its lamp's state. */
  readonly lamps: readonly NetworkLamp[]
  readonly lights: readonly NetworkLight[]
  /** Each span's index ranges in its class's merged mesh and in the far lines (R8): what a torn span hides. */
  readonly spans: ReadonlyMap<string, SpanRange>
  /** Draw calls of the near level (tubes and instanced hardware) and of the far lines, as they stand. */
  drawCalls(): { readonly near: number; readonly far: number }
  /** Moves the near level of detail to around a point (the camera), at most one index upload per mesh when a span changes side. */
  setFocus(x: number, z: number): void
  /** Blinks the failing lamps (lens and light on their flicker group). */
  animate(t: number): void
  dispose(): void
}

const specResolver = (poles: NetworkDrawOptions['poles']): ((id: string) => DistributionSpec) => {
  return (id) => {
    const def = poles ? poles.get(id).def : DEFAULT_POLES.find((pole) => pole.id === id)
    if (!def || !slotsOfPole({ id, shape: 'distribution', spec: def.spec })) throw new Error(`the pole "${id}" a network stands on has no slots (a distribution pole)`)
    return def.spec as DistributionSpec
  }
}

/**
 * Draws the aerial networks of `game-urban/networks`: the distribution poles (masts instanced per spec, hardware and cylinders instanced), the
 * conductors merged per class with the sag the network was laid with, guys at the corner and end poles, the lamps lit by their state
 * (`networkLampsOf`) through the host's light budget. About ten draw calls near whatever the size of the district, one far.
 */
export function drawNetworks(THREE: Three, { networks, options, budget, physicalLights }: { readonly networks: UtilityNetworks; readonly options: NetworkDrawOptions; readonly budget?: LightBudget; readonly physicalLights?: boolean }): DrawnNetworks {
  const root = markKitOrigin(options.root ?? new THREE.Group(), { owner: 'game-urban-three', kind: 'networks' })
  const specOf = specResolver(options.poles)
  const index = indexOf(networks)
  const frames = new Map(poleFramesOf({ networks, index, specOf }).map((frame) => [frame.id, frame]))
  const guys = guysOf({ index, frames, ...(options.surfaceAt ? { surfaceAt: options.surfaceAt } : {}) })
  const wires = drawWires(THREE, { runs: wireRunsOf({ frames, index }, networks.edges), guys })
  const pieces = piecesOf({ frames, index, guys })
  const drawn = drawPieces(THREE, { masts: pieces.masts, boxes: pieces.boxes, cylinders: pieces.cylinders, specOf })
  const lamps = networkLampsOf({ networks, shares: options.lamps ?? ALL_LAMPS_WORK, isNight: options.isNight ?? false })
  const byPole = new Map(lamps.map((lamp) => [lamp.pole, lamp]))
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const lenses = new THREE.InstancedMesh(new (shapeGeometries(THREE).BoxGeometry)(1, 1, 1), lensMaterial, Math.max(pieces.lenses.length, 1))
  lenses.name = 'network:lenses'
  lenses.count = pieces.lenses.length
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  const flickering: Array<{ index: number; lit: number; phase: number }> = []
  pieces.lenses.forEach((lens, slot) => {
    const { box } = lens
    lenses.setMatrixAt(slot, matrix.compose(new THREE.Vector3(box.x, box.y, box.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), box.ry), new THREE.Vector3(box.width, box.height, box.depth)))
    const lamp = byPole.get(lens.pole)
    const spec = frames.get(lens.pole)!.spec
    lenses.setColorAt(slot, color.set(lamp?.on ? spec.lens.lit : spec.lens.unlit))
    if (lamp?.flicker && lamp.flickerPhase !== undefined) flickering.push({ index: slot, lit: spec.lens.lit, phase: flickerGroupPhase(flickerGroupOf(lamp.flickerPhase)) })
  })
  const lights: NetworkLight[] = []
  const animators: Array<(t: number) => void> = []
  for (const lamp of lamps) {
    const frame = frames.get(lamp.pole)
    if (!lamp.on || !frame || !budget) continue
    const { light } = frame.spec
    const bulb = new THREE.Object3D()
    bulb.position.set(...worldOf(frame, [light.reach ?? frame.spec.lamp.reach, light.y, light.z ?? 0]))
    root.add(bulb)
    const intensity = physicalLights ? physicalIntensityOf({ intensity: light.intensity, distance: light.distance, decay: 2, y: light.y }) : light.intensity
    const source = budget.addSource({ owner: 'urban.light', priority: LIGHT_PRIORITY.street, color: light.color, intensity, distance: light.distance, decay: 2, position: [0, 0, 0], follow: bulb })
    lights.push({ bulb, lamp, source })
    if (lamp.flicker && lamp.flickerPhase !== undefined) {
      const phase = flickerGroupPhase(flickerGroupOf(lamp.flickerPhase))
      animators.push((t) => source.update({ intensity: intensity * flickerLevel(t, phase) }))
    }
  }
  root.add(...drawn.meshes, ...wires.near, wires.far, lenses)
  const nearDistance = options.nearDistance ?? NEAR_DISTANCE
  return {
    root,
    lamps,
    lights,
    spans: wires.spans,
    drawCalls: () => ({ near: [...drawn.meshes, ...wires.near, lenses].filter((mesh) => mesh.visible && (!(mesh instanceof THREE.InstancedMesh) || mesh.count > 0)).length, far: wires.far.visible ? 1 : 0 }),
    setFocus: (x, z) => wires.setFocus(x, z, nearDistance),
    animate(t) {
      for (const step of animators) step(t)
      if (flickering.length === 0) return
      for (const item of flickering) lenses.setColorAt(item.index, color.set(item.lit).multiplyScalar(flickerLevel(t, item.phase)))
      lenses.instanceColor!.needsUpdate = true
    },
    dispose() {
      for (const light of lights) light.source.remove()
      root.parent?.remove(root)
      wires.dispose()
      drawn.dispose()
      lenses.dispose()
      lenses.geometry.dispose()
      lensMaterial.dispose()
    },
  }
}

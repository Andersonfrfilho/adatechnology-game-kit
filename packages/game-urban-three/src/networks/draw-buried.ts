import type * as THREE_NS from 'three'

import { markKitOrigin } from '@adatechnology/game-contracts'
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import { pipePiecesOf, surfacePiecesOf } from '@adatechnology/game-urban/networks'
import type { PipeContent, PipePiece, Shaft, SurfacePiecesOptions, UtilityNetworks } from '@adatechnology/game-urban/networks'

type Three = typeof THREE_NS

/** The paint of each pipe: sewer PVC in its ochre, water PVC in blue, drainage in concrete rings. */
const PIPE_COLOR: Readonly<Record<PipeContent, number>> = { sewage: 0xb87b4a, water: 0x2f6cae, stormwater: 0x8e8d87 }
const SHAFT_COLOR: Readonly<Record<Shaft['material'], number>> = { concrete: 0x8e8d87, plastic: 0xb87b4a, cast_iron: 0x3b3e42 }
const PIPE_SEGMENTS = 8
const SHAFT_SEGMENTS = 14
/** A severed pipe loses this much of its length around the break, metres. */
const BREAK_GAP = 1.2
/** Metres the shaft's wall goes under the bottom of its pipe (the pit's floor). */
const FLOOR = 0.1

export type DrawnBuried = {
  readonly root: THREE_NS.Object3D
  readonly pipes: readonly PipePiece[]
  /** Draw calls: the pipes, the round shafts, the square ones. */
  drawCalls(): number
  /** Breaks a pipe at a share of its length: the two halves stop short of the break, `BREAK_GAP` apart. */
  sever(id: string, share: number): void
  dispose(): void
}

/**
 * Draws the pipes and pits under the street as bodies in the ground (`pipePiecesOf`, the shafts of `surfacePiecesOf`): each pipe two halves of
 * an instanced cylinder laid at its depth, each pit an open tube or a box from its cover down to its pipe. The terrain hides them; a crater
 * deeper than their cover shows them. Three draw calls whatever the district.
 */
export function drawBuried(THREE: Three, { networks, root, options }: { readonly networks: Pick<UtilityNetworks, 'nodes' | 'edges'>; readonly root?: THREE_NS.Object3D; readonly options?: SurfacePiecesOptions }): DrawnBuried {
  const T = shapeGeometries(THREE)
  const group = markKitOrigin(root ?? new THREE.Group(), { owner: 'game-urban-three', kind: 'network-buried' })
  const pipes = pipePiecesOf(networks)
  const shafts = surfacePiecesOf(networks, options).flatMap((piece) => (piece.shaft === undefined ? [] : [{ piece, shaft: piece.shaft }]))
  const round = shafts.filter(({ shaft }) => shaft.shape === 'round')
  const square = shafts.filter(({ shaft }) => shaft.shape === 'square')
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
  const openMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide })
  const geometries = [new T.CylinderGeometry(1, 1, 1, PIPE_SEGMENTS), new T.CylinderGeometry(1, 1, 1, SHAFT_SEGMENTS, 1, true), new T.BoxGeometry(1, 1, 1)] as const
  const make = (geometry: THREE_NS.BufferGeometry, count: number, name: string, using: THREE_NS.Material): THREE_NS.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geometry, using, Math.max(count, 1))
    mesh.name = name
    mesh.count = count
    mesh.frustumCulled = false
    return mesh
  }
  const pipeMesh = make(geometries[0], pipes.length * 2, 'network:buried:pipes', material)
  const roundMesh = make(geometries[1], round.length, 'network:buried:shafts', openMaterial)
  const squareMesh = make(geometries[2], square.length, 'network:buried:boxes', material)
  const up = new THREE.Vector3(0, 1, 0)
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  const place = (mesh: THREE_NS.InstancedMesh, slot: number, from: readonly [number, number, number], to: readonly [number, number, number], radius: number): void => {
    const axis = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const length = axis.length()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, length === 0 ? up : axis.clone().normalize())
    mesh.setMatrixAt(slot, matrix.compose(new THREE.Vector3((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2), quaternion, new THREE.Vector3(radius, length, radius)))
  }
  const along = (pipe: PipePiece, share: number): [number, number, number] => [pipe.from[0] + (pipe.to[0] - pipe.from[0]) * share, pipe.from[1] + (pipe.to[1] - pipe.from[1]) * share, pipe.from[2] + (pipe.to[2] - pipe.from[2]) * share]
  /** The ends of a pipe pulled in by a few millimetres, a different amount for each: two pipes that start on one line (two services from neighbouring tees) never have their end caps in one plane (CLAUDE.md §13). */
  const trimmed = (pipe: PipePiece, index: number): PipePiece => {
    const length = Math.hypot(pipe.to[0] - pipe.from[0], pipe.to[1] - pipe.from[1], pipe.to[2] - pipe.from[2])
    if (length < 0.1) return pipe
    const [start, end] = [((index % 7) + 1) * 0.003, ((index % 5) + 1) * 0.004]
    const at = (share: number): [number, number, number] => along(pipe, share)
    return { ...pipe, from: at(start / length), to: at(1 - end / length) }
  }
  const halves = (whole: PipePiece, index: number, gap: readonly [number, number]): void => {
    const pipe = trimmed(whole, index)
    // whole until it breaks: the second half is empty, so no two caps meet in one plane
    if (gap[0] === gap[1]) {
      place(pipeMesh, index * 2, pipe.from, pipe.to, pipe.diameter / 2)
      pipeMesh.setMatrixAt(index * 2 + 1, matrix.makeScale(0, 0, 0))
      return
    }
    place(pipeMesh, index * 2, pipe.from, along(pipe, gap[0]), pipe.diameter / 2)
    place(pipeMesh, index * 2 + 1, along(pipe, gap[1]), pipe.to, pipe.diameter / 2)
  }
  const slotOf = new Map(pipes.map((pipe, index) => [pipe.id, index]))
  pipes.forEach((pipe, index) => {
    halves(pipe, index, [0.5, 0.5])
    for (const slot of [index * 2, index * 2 + 1]) pipeMesh.setColorAt(slot, color.set(PIPE_COLOR[pipe.content]))
  })
  round.forEach(({ piece, shaft }, slot) => {
    const [x, , z] = piece.at
    place(roundMesh, slot, [x, shaft.bottom - FLOOR, z], [x, shaft.top, z], shaft.width / 2)
    roundMesh.setColorAt(slot, color.set(SHAFT_COLOR[shaft.material]))
  })
  square.forEach(({ piece, shaft }, slot) => {
    const height = shaft.top - shaft.bottom + FLOOR
    squareMesh.setMatrixAt(slot, matrix.compose(new THREE.Vector3(piece.at[0], shaft.top - height / 2, piece.at[2]), new THREE.Quaternion().setFromAxisAngle(up, piece.ry), new THREE.Vector3(shaft.width, height, shaft.depth)))
    squareMesh.setColorAt(slot, color.set(SHAFT_COLOR[shaft.material]))
  })
  group.add(pipeMesh, roundMesh, squareMesh)
  return {
    root: group,
    pipes,
    drawCalls: () => [pipeMesh, roundMesh, squareMesh].filter((mesh) => mesh.count > 0).length,
    sever(id, share) {
      const index = slotOf.get(id)
      const pipe = index === undefined ? undefined : pipes[index]
      if (index === undefined || pipe === undefined) return
      const length = Math.hypot(pipe.to[0] - pipe.from[0], pipe.to[1] - pipe.from[1], pipe.to[2] - pipe.from[2])
      const half = Math.min(0.5, BREAK_GAP / 2 / Math.max(length, 1e-6))
      halves(pipe, index, [Math.max(0, share - half), Math.min(1, share + half)])
      pipeMesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      group.parent?.remove(group)
      for (const mesh of [pipeMesh, roundMesh, squareMesh]) mesh.dispose()
      for (const item of [...geometries, material, openMaterial]) item.dispose()
    },
  }
}

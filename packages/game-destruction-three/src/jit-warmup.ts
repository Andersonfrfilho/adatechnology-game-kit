import type * as THREE_NS from 'three'

import { createDestruction, inferJoints } from '@adatechnology/game-destruction'
import type { JointSpec, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsEngine, PhysicsLoop, PhysicsWorld, WorldDesc } from '@adatechnology/game-physics'
import { discardObject3D } from '@adatechnology/game-shapes-three'
import { createVfx } from '@adatechnology/game-vfx'

import type { DestructionRenderer, RendererOptions, ThreeNamespace } from './types'

/** What the warm-up runs on: the engine whose body creation, compounds and ground it heats (without one there is nothing to warm), and the numbers of the throwaway world. */
export interface JitWarmUpOptions {
  readonly engine?: PhysicsEngine
  /** The world the engine makes for the warm-up (default `KIT_WORLD`: the same code runs as in the game's world). */
  readonly world?: WorldDesc
}

/** What the warm-up saw: the loose pieces the blast made at most, and the fragments (so a test can tell the paths ran). */
export interface JitWarmUpReport {
  readonly pieces: number
  readonly fragments: number
}

const COLUMNS = 6
const ROWS = 4
const BRICK: Vec3 = [0.5, 0.25, 0.2]
const FRAMES = 150
const FRAME_SECONDS = 1 / 60
const BLAST_AT: Vec3 = [0, 0.5, -1.5]
const BLAST_ENERGY = 4_000_000
const BLAST_RADIUS = 7
const CRATER_DEPTH = 0.3
const CRATER_RADIUS = 2.5
// far from where a host puts anything: the throwaway scene never meets the game's
const ORIGIN: Vec3 = [4000, 0, 4000]

interface BlastAndRunParams {
  readonly world: ReturnType<typeof createDestruction>
  readonly loop: PhysicsLoop
  readonly renderer: DestructionRenderer
  readonly onCrater: () => void
}

const warmed = new WeakSet<object>()

/** A wall of bricks, each a part drawn by a range of one merged mesh (as the house is), and the ranges. */
const brickWall = (THREE: ThreeNamespace): { readonly parts: PartSpec[]; readonly joints: JointSpec[]; readonly mesh: THREE_NS.Mesh; readonly ranges: Array<[number, number]> } => {
  const parts: PartSpec[] = []
  const geometries: THREE_NS.BufferGeometry[] = []
  const ranges: Array<[number, number]> = []
  let vertices = 0
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const position: Vec3 = [(column - COLUMNS / 2 + 0.5 + (row % 2) * 0.25) * BRICK[0], (row + 0.5) * BRICK[1], 0]
      parts.push({ id: `brick_${row}_${column}`, material: 'brick', shape: { kind: 'box', size: BRICK }, position })
      const geometry = new THREE.BoxGeometry(...BRICK).translate(...position)
      const count = geometry.getAttribute('position').count
      geometries.push(geometry)
      ranges.push([vertices, vertices + count])
      vertices += count
    }
  }
  const merged = new THREE.BufferGeometry()
  const offsets = ['position', 'normal', 'uv'] as const
  for (const name of offsets) merged.setAttribute(name, new THREE.Float32BufferAttribute(geometries.flatMap((geometry) => Array.from(geometry.getAttribute(name).array)), name === 'uv' ? 2 : 3))
  let base = 0
  const index: number[] = []
  for (const geometry of geometries) {
    for (const entry of Array.from(geometry.getIndex()?.array ?? [])) index.push(entry + base)
    base += geometry.getAttribute('position').count
    geometry.dispose()
  }
  merged.setIndex(index)
  return { parts, joints: inferJoints(parts), mesh: new THREE.Mesh(merged, new THREE.MeshStandardMaterial()), ranges }
}

/**
 * One blast on a small wall, in a world, a scene and a renderer of its own, all freed at the end. Every path the first real explosion would run cold runs here once: the
 * fracture and the split of the loosened groups, the oriented boxes fitted to the parts, the engine's bodies and compounds, the ground laid under the pieces and written in place
 * where a crater was dug. Nothing of it touches a game world (own world, own renderer, own random stream) and nothing of it stays.
 */
const runScene = (THREE: ThreeNamespace, makeRenderer: (options: RendererOptions) => DestructionRenderer, engine: PhysicsEngine, worldDesc: WorldDesc | undefined): JitWarmUpReport => {
  const scene = new THREE.Scene()
  const world = createDestruction()
  // an effects world of its own: without one the renderer makes its own and warns the host, who did lend one
  const vfx = createVfx({})
  let craterDepth = 0
  const terrainAt = (x: number, z: number): number => -craterDepth * Math.max(0, 1 - Math.hypot(x - ORIGIN[0] - BLAST_AT[0], z - ORIGIN[2] - BLAST_AT[2]) / CRATER_RADIUS)
  let engineWorld: PhysicsWorld | undefined
  let renderer: DestructionRenderer | undefined
  let bound: string | undefined
  try {
    engineWorld = engine.createWorld(worldDesc ?? KIT_WORLD)
    const loop = createPhysicsLoop(engineWorld)
    // a grid reader as a host's terrain gives one, so the tiles read their samples down the path the host's do
    const terrainGridAt = (xs: ArrayLike<number>, zs: ArrayLike<number>, out: Float64Array): void => {
      for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) out[j * xs.length + i] = terrainAt(xs[i]!, zs[j]!)
    }
    renderer = makeRenderer({ physics: loop, scene, world, vfx, eventBudgetMs: Infinity, groundAt: terrainAt, terrainAt, terrainGridAt, jitWarmUp: false })
    const wall = brickWall(THREE)
    const root = new THREE.Group()
    root.position.set(...ORIGIN)
    root.add(wall.mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    bound = world.add({ parts: wall.parts, joints: wall.joints }, { position: ORIGIN })
    renderer.bind(bound, root, { parts: Object.fromEntries(wall.parts.map((part, index) => [part.id, { mesh: wall.mesh, range: wall.ranges[index] as [number, number] }])) })
    return blastAndRun({ world, loop, renderer, onCrater: () => (craterDepth = CRATER_DEPTH) })
  } finally {
    if (renderer && bound !== undefined) renderer.release(bound)
    renderer?.dispose()
    discardObject3D(scene.children.slice())
    vfx.clear()
    engineWorld?.dispose()
  }
}

/** The blast and the frames after it; the most pieces and fragments seen. */
const blastAndRun = ({ world, loop, renderer, onCrater }: BlastAndRunParams): JitWarmUpReport => {
  const seen = { pieces: 0, fragments: 0 }
  const point: Vec3 = [ORIGIN[0] + BLAST_AT[0], ORIGIN[1] + BLAST_AT[1], ORIGIN[2] + BLAST_AT[2]]
  const report = world.explode(point, BLAST_ENERGY, BLAST_RADIUS, 'warm-up')
  renderer.explode(point, BLAST_ENERGY, BLAST_RADIUS, { report, visual: false })
  onCrater()
  renderer.wakeRegion(point[0], point[2], CRATER_RADIUS)
  for (let frame = 0; frame < FRAMES; frame++) {
    world.update(FRAME_SECONDS)
    loop.step(FRAME_SECONDS)
    renderer.update(FRAME_SECONDS)
    const stats = renderer.stats()
    seen.pieces = Math.max(seen.pieces, stats.pieces)
    seen.fragments = Math.max(seen.fragments, stats.fragments)
  }
  return seen
}

/**
 * Runs the first explosion once, off screen, so the code it needs is warm when the real one comes. Once per engine: a second call, or a call with no engine, is a
 * no-op (`undefined`). `makeRenderer` is the renderer factory of the package, so the throwaway renderer is the real one.
 */
export const warmUpDestructionJit = (THREE: ThreeNamespace, makeRenderer: (options: RendererOptions) => DestructionRenderer, options: JitWarmUpOptions = {}): JitWarmUpReport | undefined => {
  const { engine } = options
  if (!engine || warmed.has(engine)) return undefined
  warmed.add(engine)
  return runScene(THREE, makeRenderer, engine, options.world)
}

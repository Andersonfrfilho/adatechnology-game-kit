import type * as THREE_NS from 'three'

import { createDestruction, inferJoints } from '@adatechnology/game-destruction'
import type { JointSpec, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsEngine, PhysicsLoop, PhysicsWorld, WorldDesc } from '@adatechnology/game-physics'
import { discardObject3D } from '@adatechnology/game-shapes-three'
import { createVfx } from '@adatechnology/game-vfx'

import type { DestructionRenderer, RendererOptions, ThreeNamespace } from './types'

/** What the warm-up runs on: the engine whose body creation, compounds and ground it heats (without one, the kit's own solver), and the numbers of the throwaway world. */
export interface JitWarmUpOptions {
  readonly engine?: PhysicsEngine
  /** The world the engine makes for the warm-up (default `KIT_WORLD`: the same code runs as in the game's world). */
  readonly world?: WorldDesc
}

/** What the warm-up saw: the loose pieces the blast made at most, the fragments, and what the engine was given of the ground and the drawn statics (so a test can tell the paths ran). */
export interface JitWarmUpReport {
  readonly pieces: number
  readonly fragments: number
  /** The static compounds the engine made (a crater tile's solid net, the step boxes) and the most children one had. */
  readonly groundNets: number
  readonly largestNet: number
  /** The static bodies made in a batch for the drawn fixed things (`staticSolids`), so the measuring of drawn solids ran. */
  readonly staticBodies: number
}

const COLUMNS = 6
const ROWS = 4
const BRICK: Vec3 = [0.5, 0.25, 0.2]
const FRAMES = 90
const FRAME_SECONDS = 1 / 60
const BLAST_AT: Vec3 = [0, 0.5, -1.5]
const BLAST_ENERGY = 4_000_000
const BLAST_RADIUS = 7
// a C4's crater: a bowl with a raised rim and the roughness of thrown soil, over several tiles, so a tile's solid net has hundreds of blocks as in the room
const CRATER_DEPTH = 0.9
const CRATER_RADIUS = 3
const CRATER_RIM = 0.25
const CRATER_ROUGHNESS = 0.015
const STATIC_AT: Vec3 = [8.5, 0, 0]
const STATIC_SIZE: Vec3 = [2, 0.6, 1.2]
const STATIC_NUDGE_FRAME = 20
// far from where a host puts anything: the throwaway scene never meets the game's
const ORIGIN: Vec3 = [4000, 0, 4000]

interface BlastAndRunParams {
  readonly world: ReturnType<typeof createDestruction>
  readonly loop: PhysicsLoop | undefined
  readonly renderer: DestructionRenderer
  readonly onCrater: () => void
  readonly fixedRoot: THREE_NS.Object3D
}

type BodyCounts = { nets: number; largest: number; statics: number }

const warmed = new WeakSet<object>()
const OWN_SOLVER = {}

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

/** A fixed object of its own, drawn by a mesh of its own (not a range of a merged one), far enough from the blast to stand: the engine measures what it draws and makes a static body of it. */
const fixedSlab = (THREE: ThreeNamespace, world: ReturnType<typeof createDestruction>, renderer: DestructionRenderer): { readonly id: string; readonly root: THREE_NS.Group } => {
  const part: PartSpec = { id: 'slab', material: 'concrete', shape: { kind: 'box', size: STATIC_SIZE }, position: [0, STATIC_SIZE[1] / 2, 0] }
  const id = world.add({ parts: [part], joints: [] }, { position: [ORIGIN[0] + STATIC_AT[0], ORIGIN[1], ORIGIN[2] + STATIC_AT[2]] })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...STATIC_SIZE).translate(0, STATIC_SIZE[1] / 2, 0), new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.position.set(ORIGIN[0] + STATIC_AT[0], ORIGIN[1], ORIGIN[2] + STATIC_AT[2])
  root.add(mesh)
  root.updateMatrixWorld(true)
  renderer.bind(id, root, { parts: { slab: mesh } })
  return { id, root }
}

/** Counts what the engine is given: the static compounds made one by one (the crater tile's solid net, step boxes) with the most children, and the static bodies made in a batch (the drawn fixed things). */
const countBodies = (engineWorld: PhysicsWorld, counts: BodyCounts): void => {
  const create = engineWorld.createBody.bind(engineWorld)
  engineWorld.createBody = (desc) => {
    if (desc.motion === 'static' && desc.shape.kind === 'compound') {
      counts.nets++
      counts.largest = Math.max(counts.largest, desc.shape.children.length)
    }
    return create(desc)
  }
  const createMany = engineWorld.createBodies.bind(engineWorld)
  engineWorld.createBodies = (descs) => {
    counts.statics += descs.filter((desc) => desc.motion === 'static').length
    return createMany(descs)
  }
}

/**
 * One blast on a small wall, in a world, a scene and a renderer of its own, all freed at the end. Every path the first real explosion would run cold runs here once: the
 * fracture and the split of the loosened groups, the oriented boxes fitted to the parts, the engine's bodies and compounds, the ground laid under the pieces and written in place
 * where a crater was dug. Nothing of it touches a game world (own world, own renderer, own random stream) and nothing of it stays.
 */
const runScene = (THREE: ThreeNamespace, makeRenderer: (options: RendererOptions) => DestructionRenderer, options: JitWarmUpOptions): JitWarmUpReport => {
  const scene = new THREE.Scene()
  const world = createDestruction()
  // an effects world of its own: without one the renderer makes its own and warns the host, who did lend one
  const vfx = createVfx({})
  let isDug = false
  const terrainAt = (x: number, z: number): number => {
    if (!isDug) return 0
    const distance = Math.hypot(x - ORIGIN[0] - BLAST_AT[0], z - ORIGIN[2] - BLAST_AT[2])
    if (distance >= CRATER_RADIUS * 1.5) return 0
    const bowl = distance < CRATER_RADIUS ? -CRATER_DEPTH * (1 - (distance / CRATER_RADIUS) ** 2) : CRATER_RIM * Math.sin(((distance - CRATER_RADIUS) / (CRATER_RADIUS * 0.5)) * Math.PI)
    return bowl + CRATER_ROUGHNESS * Math.sin(x * 9.1) * Math.sin(z * 7.3)
  }
  // exact bounds would need the terrain's own data; these hold for the function above and keep the tiles near the crater out of the level proof
  const terrainRangeAt = (minX: number, maxX: number, minZ: number, maxZ: number): { readonly low: number; readonly high: number } => {
    const dx = Math.max(minX - ORIGIN[0] - BLAST_AT[0], 0, ORIGIN[0] + BLAST_AT[0] - maxX)
    const dz = Math.max(minZ - ORIGIN[2] - BLAST_AT[2], 0, ORIGIN[2] + BLAST_AT[2] - maxZ)
    return !isDug || Math.hypot(dx, dz) >= CRATER_RADIUS * 1.5 ? { low: 0, high: 0 } : { low: -CRATER_DEPTH - CRATER_ROUGHNESS, high: CRATER_RIM + CRATER_ROUGHNESS }
  }
  const counts: BodyCounts = { nets: 0, largest: 0, statics: 0 }
  let engineWorld: PhysicsWorld | undefined
  let renderer: DestructionRenderer | undefined
  let bound: string | undefined
  let fixedId: string | undefined
  try {
    engineWorld = options.engine?.createWorld(options.world ?? KIT_WORLD)
    if (engineWorld) countBodies(engineWorld, counts)
    const loop: PhysicsLoop | undefined = engineWorld ? createPhysicsLoop(engineWorld) : undefined
    renderer = makeRenderer({ physics: loop ?? 'own', scene, world, vfx, eventBudgetMs: Infinity, groundAt: terrainAt, terrainAt, terrainRangeAt, jitWarmUp: false })
    const wall = brickWall(THREE)
    const root = new THREE.Group()
    root.position.set(...ORIGIN)
    root.add(wall.mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    bound = world.add({ parts: wall.parts, joints: wall.joints }, { position: ORIGIN })
    renderer.bind(bound, root, { parts: Object.fromEntries(wall.parts.map((part, index) => [part.id, { mesh: wall.mesh, range: wall.ranges[index] as [number, number] }])) })
    const fixed = fixedSlab(THREE, world, renderer)
    fixedId = fixed.id
    scene.add(fixed.root)
    const report = blastAndRun({ world, loop, renderer, fixedRoot: fixed.root, onCrater: () => (isDug = true) })
    return { ...report, groundNets: counts.nets, largestNet: counts.largest, staticBodies: counts.statics }
  } finally {
    if (renderer && bound !== undefined) renderer.release(bound)
    if (renderer && fixedId !== undefined) renderer.release(fixedId)
    renderer?.dispose()
    discardObject3D(scene.children.slice())
    vfx.clear()
    engineWorld?.dispose()
  }
}

/** The blast and the frames after it; the most pieces and fragments seen. */
const blastAndRun = ({ world, loop, renderer, onCrater, fixedRoot }: BlastAndRunParams): Pick<JitWarmUpReport, 'pieces' | 'fragments'> => {
  const seen = { pieces: 0, fragments: 0 }
  const point: Vec3 = [ORIGIN[0] + BLAST_AT[0], ORIGIN[1] + BLAST_AT[1], ORIGIN[2] + BLAST_AT[2]]
  const report = world.explode(point, BLAST_ENERGY, BLAST_RADIUS, 'warm-up')
  renderer.explode(point, BLAST_ENERGY, BLAST_RADIUS, { report, visual: false })
  onCrater()
  renderer.wakeRegion(point[0], point[2], CRATER_RADIUS)
  for (let frame = 0; frame < FRAMES; frame++) {
    // a fixed thing that moved is measured again, as one the blast touched is
    if (frame === STATIC_NUDGE_FRAME) fixedRoot.position.x += 0.02
    world.update(FRAME_SECONDS)
    loop?.step(FRAME_SECONDS)
    renderer.update(FRAME_SECONDS)
    const stats = renderer.stats()
    seen.pieces = Math.max(seen.pieces, stats.pieces)
    seen.fragments = Math.max(seen.fragments, stats.fragments)
  }
  return seen
}

/**
 * Runs the first explosion once, off screen, so the code it needs is warm when the real one comes. Once per engine (and once for the kit's own solver): a second call is a
 * no-op (`undefined`). `makeRenderer` is the renderer factory of the package, so the throwaway renderer is the real one.
 */
export const warmUpDestructionJit = (THREE: ThreeNamespace, makeRenderer: (options: RendererOptions) => DestructionRenderer, options: JitWarmUpOptions = {}): JitWarmUpReport | undefined => {
  const key = options.engine ?? OWN_SOLVER
  if (warmed.has(key)) return undefined
  warmed.add(key)
  return runScene(THREE, makeRenderer, options)
}

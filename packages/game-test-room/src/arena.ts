import type * as THREE_NS from 'three'
import type { DestructibleSpec, JointSpec, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import type { SurfaceSpec } from '@adatechnology/game-fluids'
import { brickWallSpec } from './items'

export interface ArenaObject {
  id: string
  spec: DestructibleSpec
  position: Vec3
  colors?: Record<string, number>
}

/** The static part of the room: lights, floor, grid, ruler and the destructible scenery. */
export interface Arena {
  group: THREE_NS.Group
  /** Objects to register in the world (target wall, table, shelf). */
  objects: ArenaObject[]
  surfaces: SurfaceSpec[]
  /** `[minX, minZ, maxX, maxZ]` boxes the player cannot walk into. */
  colliders: Array<[number, number, number, number]>
  playerStart: Vec3
  wallZ: number
  /** Rectangle and height of the table top (pieces rest on it while the table stands). */
  table: { minX: number; maxX: number; minZ: number; maxZ: number; top: number; id: string; topPart: string }
  tapSpout: Vec3
  /** Show or hide the water jet from the tap, `length` metres long. */
  setTapJet(on: boolean, length: number): void
  sun: THREE_NS.DirectionalLight
}

const tableSpec = (): DestructibleSpec => {
  const parts: PartSpec[] = [{ id: 'top', material: 'wood_hard', shape: { kind: 'box', size: [1.6, 0.05, 0.8] }, position: [0, 0.755, 0] }]
  const joints: JointSpec[] = []
  for (const [i, [x, z]] of [
    [-0.72, -0.32],
    [0.72, -0.32],
    [-0.72, 0.32],
    [0.72, 0.32],
  ].entries()) {
    parts.push({ id: `leg_${i + 1}`, material: 'wood_hard', shape: { kind: 'box', size: [0.06, 0.73, 0.06] }, position: [x, 0.365, z], anchored: true })
    joints.push({ a: `leg_${i + 1}`, b: 'top', kind: 'screw' })
  }
  return { name: 'table', parts, joints, tags: ['furniture'] }
}

const shelfSpec = (): DestructibleSpec => {
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  for (const [i, x] of [-0.6, 0.6].entries()) {
    parts.push({ id: `upright_${i + 1}`, material: 'wood_hard', shape: { kind: 'box', size: [0.04, 1.7, 0.4] }, position: [x, 0.85, 0], anchored: true })
  }
  for (const [i, y] of [0.4, 0.9, 1.4].entries()) {
    parts.push({ id: `board_${i + 1}`, material: 'wood_soft', shape: { kind: 'box', size: [1.2, 0.03, 0.4] }, position: [0, y, 0] })
    joints.push({ a: `board_${i + 1}`, b: 'upright_1', kind: 'screw' }, { a: `board_${i + 1}`, b: 'upright_2', kind: 'screw' })
  }
  return { name: 'shelf', parts, joints, tags: ['furniture'] }
}

export function createArena(THREE: typeof THREE_NS, size: number, scene: THREE_NS.Scene): Arena {
  const group = new THREE.Group()
  group.name = 'test-room-arena'
  scene.background = new THREE.Color(0x9fb4c8)

  group.add(new THREE.HemisphereLight(0xcfe3ff, 0x6b6257, 0.75))
  const sun = new THREE.DirectionalLight(0xffffff, 2.1)
  sun.position.set(7, 13, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  const sc = sun.shadow.camera
  sc.left = -16
  sc.right = 16
  sc.top = 16
  sc.bottom = -16
  sc.near = 1
  sc.far = 40
  sun.shadow.bias = -0.0006
  group.add(sun)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshStandardMaterial({ color: 0x8e8e8a, roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.name = 'floor'
  group.add(floor)

  const grid = new THREE.GridHelper(size * 2, size * 2, 0x4c4c52, 0x77777b)
  grid.position.y = 0.004
  group.add(grid)

  const wallZ = -11
  const playerStart: Vec3 = [0, 1.7, 5]

  // distance ruler along the left of the lane: a tick every metre (taller every 5 m) and a label every 5 m
  const pts: number[] = []
  const rx = -1.6
  for (let z = Math.round(playerStart[2]); z >= wallZ; z--) {
    const d = playerStart[2] - z
    const len = d % 5 === 0 ? 0.5 : 0.2
    pts.push(rx, 0.01, z, rx + len, 0.01, z)
  }
  pts.push(rx, 0.01, playerStart[2], rx, 0.01, wallZ)
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  group.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xffd23f })))
  for (let d = 5; playerStart[2] - d >= wallZ; d += 5) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = '#ffd23f'
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${d} m`, 64, 48)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }))
      sprite.scale.set(1.2, 0.6, 1)
      sprite.position.set(rx - 0.8, 0.45, playerStart[2] - d)
      group.add(sprite)
    } catch {
      break
    }
  }

  // tap on a post at the end of the table, spout over the tabletop
  const tableX = 3.5
  const tapMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.8, roughness: 0.35 })
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 10), tapMat)
  post.position.set(tableX + 1.15, 0.7, 0)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15 - 0.3, 10), tapMat)
  arm.rotation.z = Math.PI / 2
  arm.position.set(tableX + (1.15 + 0.3) / 2, 1.38, 0)
  const spoutMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), tapMat)
  spoutMesh.position.set(tableX + 0.3, 1.33, 0)
  for (const m of [post, arm, spoutMesh]) {
    m.castShadow = true
    group.add(m)
  }
  const tapSpout: Vec3 = [tableX + 0.3, 1.28, 0]
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x6fb7e8, transparent: true, opacity: 0.7, roughness: 0.1 }),
  )
  jet.visible = false
  jet.name = 'tap-jet'
  group.add(jet)

  const objects: ArenaObject[] = [
    { id: 'target_wall', spec: brickWallSpec(), position: [0, 0, wallZ], colors: { brick: 0xa5472e } },
    { id: 'table', spec: tableSpec(), position: [tableX, 0, 0] },
    { id: 'shelf', spec: shelfSpec(), position: [-3.5, 0, 0], colors: { wood_soft: 0xc79a62 } },
  ]

  return {
    group,
    objects,
    surfaces: [
      { id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [size, size], porosity: 0.05 },
      { id: 'table', point: [tableX, 0.78, 0], normal: [0, 1, 0], halfSize: [0.8, 0.4], porosity: 0.3 },
    ],
    colliders: [
      [tableX - 0.8, -0.4, tableX + 0.8, 0.4],
      [tableX + 1.1, -0.1, tableX + 1.2, 0.1],
      [-3.5 - 0.62, -0.2, -3.5 + 0.62, 0.2],
      [-size, wallZ - 1, size, wallZ + 0.2],
    ],
    playerStart,
    wallZ,
    table: { minX: tableX - 0.8, maxX: tableX + 0.8, minZ: -0.4, maxZ: 0.4, top: 0.78, id: 'table', topPart: 'top' },
    tapSpout,
    setTapJet(on, length) {
      jet.visible = on
      if (!on) return
      const len = Math.max(0.05, length)
      jet.scale.set(1, len, 1)
      jet.position.set(tapSpout[0], tapSpout[1] - len / 2, tapSpout[2])
    },
    sun,
  }
}

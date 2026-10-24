import type * as THREE_NS from 'three'
import type { Decal, WorkshopEngine } from '@adatechnology/game-vfx'
import { createMeshLayer } from './mesh-layer'
import { WORKSHOP_SPRITE_FRAGMENT, WORKSHOP_SPRITE_VERTEX } from './shaders/workshop-sprite'
import type { ThreeLib } from './types'

const DEBRIS_CAPACITY = 500
const DECAL_CAPACITY = 400
const RING_CAPACITY = 120
const RIPPLE_SEGMENTS = 12
const FADE_SECONDS = 0.5
const FIRE_LIGHT_COLOR = 0xff7a2a
const FIRE_LIGHT_DISTANCE = 14
const GLOSS_DRIED_AT = 0.85
const BROWN = 0x2a1610
const GROUND_COLOR = 0x888888
const FUEL_DRIED = 0x888888

export interface WorkshopLayers {
  readonly group: THREE_NS.Group
  /** Copies the pools into the draw buffers; answers how many draw calls have something to draw. */
  sync(): number
  dispose(): void
}

interface Drawn {
  readonly object: THREE_NS.Object3D
  sync(): boolean
  dispose(): void
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

function spriteLayer(THREE: ThreeLib, pool: WorkshopEngine['add'], additive: boolean, soft: number, scale: number): Drawn {
  const geometry = new THREE.BufferGeometry()
  const arrays: [string, Float32Array, number][] = [['position', pool.position, 3], ['pcol', pool.color, 3], ['size', pool.size, 1], ['alpha', pool.alpha, 1]]
  const buffers = arrays.map(([name, array, size]) => {
    const attribute = new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute(name, attribute)
    return attribute
  })
  geometry.setDrawRange(0, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: scale }, uSoft: { value: soft } },
    vertexShader: WORKSHOP_SPRITE_VERTEX,
    fragmentShader: WORKSHOP_SPRITE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = additive ? 3 : 2
  points.name = additive ? 'workshop-add' : 'workshop-normal'
  return {
    object: points,
    sync() {
      geometry.setDrawRange(0, pool.count)
      for (const buffer of buffers) buffer.needsUpdate = true
      return pool.count > 0
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

function streakLayer(THREE: ThreeLib, pool: WorkshopEngine['streaks']): Drawn {
  const geometry = new THREE.BufferGeometry()
  const position = new THREE.BufferAttribute(pool.segment, 3).setUsage(THREE.DynamicDrawUsage)
  const color = new THREE.BufferAttribute(pool.segmentColor, 3).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setAttribute('color', color)
  geometry.setDrawRange(0, 0)
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  const lines = new THREE.LineSegments(geometry, material)
  lines.frustumCulled = false
  lines.renderOrder = 4
  lines.name = 'workshop-streaks'
  return {
    object: lines,
    sync() {
      geometry.setDrawRange(0, pool.count * 2)
      position.needsUpdate = color.needsUpdate = true
      return pool.count > 0
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/** The Workshop's rain (W317-320): one line segment per streak, pale blue, 35% opaque. */
function rainLayer(THREE: ThreeLib, rain: WorkshopEngine['rain']): Drawn {
  const geometry = new THREE.BufferGeometry()
  const position = new THREE.BufferAttribute(rain.positions, 3).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setDrawRange(0, 0)
  const material = new THREE.LineBasicMaterial({ color: 0x9fb3cf, transparent: true, opacity: 0.35, depthWrite: false })
  const lines = new THREE.LineSegments(geometry, material)
  lines.frustumCulled = false
  lines.name = 'workshop-rain'
  return {
    object: lines,
    sync() {
      const drawn = rain.on && rain.count > 0
      lines.visible = drawn
      geometry.setDrawRange(0, drawn ? rain.count * 2 : 0)
      position.needsUpdate = true
      return drawn
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

function debrisLayer(THREE: ThreeLib, pool: WorkshopEngine['debris']): Drawn {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.25, flatShading: true })
  const mesh = new THREE.InstancedMesh(geometry, material, DEBRIS_CAPACITY)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.name = 'workshop-debris'
  const euler = new THREE.Euler()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  const colour = new THREE.Color()
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let index = 0; index < DEBRIS_CAPACITY; index++) mesh.setMatrixAt(index, hidden)
  mesh.setColorAt(0, colour.setHex(0xffffff))
  return {
    object: mesh,
    sync() {
      let drawn = false
      for (let index = 0; index < DEBRIS_CAPACITY; index++) {
        const piece = pool.pieces[index]!
        if (!piece.on) {
          mesh.setMatrixAt(index, hidden)
          continue
        }
        drawn = true
        const shrink = Math.min(1, piece.life / FADE_SECONDS)
        euler.set(piece.rx, piece.ry, piece.rz)
        quaternion.setFromEuler(euler)
        matrix.compose(position.set(piece.x, piece.y, piece.z), quaternion, scale.set(piece.sx * shrink, piece.sy * shrink, piece.sz * shrink))
        mesh.setMatrixAt(index, matrix)
        mesh.setColorAt(index, colour.setHex(piece.color))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return drawn
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/** A decal's current look from its fields (W276-306): it grows, a wet one creeps, dries towards its dry colour or evaporates. */
function decalLook(decal: Decal, colour: THREE_NS.Color, dryColour: THREE_NS.Color, brown: THREE_NS.Color, ground: THREE_NS.Color, index: number): { sx: number; sy: number; dried: boolean } | null {
  const grown = decal.grow > 0 ? 1 - Math.pow(1 - Math.min(1, decal.t / decal.grow), 2.4) : 1
  let sx = decal.sx * grown
  let sy = decal.sy * grown
  colour.setHex(decal.color)
  let dried = false
  const fluid = decal.fluid
  if (fluid) {
    const creep = fluid === 'oil' ? 0.5 : fluid === 'fuel' ? 0.7 : fluid === 'bile' ? 0.25 : fluid === 'water' ? 0.2 : 0.3
    const age = decal.t
    if (decal.dryTime > 0) {
      const k = clamp((age - decal.dryAt) / decal.dryTime, 0, 1)
      if (decal.dryColor >= 0) dryColour.setHex(decal.dryColor)
      else dryColour.copy(colour).multiplyScalar(0.45).lerp(brown, 0.45)
      dried = k > GLOSS_DRIED_AT
      const spread = dried ? 1 + creep : 1 + creep * (1 - Math.exp(-age / 6))
      sx *= dried ? spread : spread * (1 + 0.04 * Math.sin(age * 1.9 + index))
      sy *= dried ? spread : spread * (1 + 0.04 * Math.cos(age * 1.5 + index * 0.7))
      colour.lerp(dryColour, k)
    } else {
      const spread = 1 + creep * (1 - Math.exp(-age / 6))
      sx *= spread * (1 + 0.04 * Math.sin(age * 1.9 + index))
      sy *= spread * (1 + 0.04 * Math.cos(age * 1.5 + index * 0.7))
      if (fluid === 'fuel' || fluid === 'water') {
        const [wait, span] = fluid === 'fuel' ? [6, 5] : [40, 20]
        const gone = clamp((age - wait) / span, 0, 1)
        sx *= 1 - gone * 0.85
        sy *= 1 - gone * 0.85
        colour.lerp(ground.setHex(fluid === 'fuel' ? FUEL_DRIED : GROUND_COLOR), gone * 0.8)
        if (gone >= 1) return null
      }
    }
  }
  return { sx, sy, dried }
}

function decalLayer(THREE: ThreeLib, pool: WorkshopEngine['decals']): Drawn {
  const geometry = new THREE.CircleGeometry(0.5, RIPPLE_SEGMENTS)
  const positions = geometry.getAttribute('position')
  // a blob, not a disc: each rim vertex is pulled in by a fixed amount between .72 and 1.12
  for (let index = 1; index < positions.count; index++) {
    const k = 0.72 + (((index * 2654435761) >>> 0) / 4294967296) * 0.4
    positions.setXY(index, positions.getX(index) * k, positions.getY(index) * k)
  }
  const wet = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  const dry = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  const wetMesh = new THREE.InstancedMesh(geometry, wet, DECAL_CAPACITY)
  const dryMesh = new THREE.InstancedMesh(geometry, dry, DECAL_CAPACITY)
  const group = new THREE.Group()
  group.name = 'workshop-decals'
  for (const mesh of [wetMesh, dryMesh]) {
    mesh.frustumCulled = false
    mesh.renderOrder = 1
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(mesh)
  }
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  const colour = new THREE.Color()
  const dryColour = new THREE.Color()
  const brown = new THREE.Color(BROWN)
  const ground = new THREE.Color()
  const normal = new THREE.Vector3()
  const forward = new THREE.Vector3(0, 0, 1)
  const turn = new THREE.Quaternion()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  wetMesh.setColorAt(0, colour.setHex(0))
  dryMesh.setColorAt(0, colour.setHex(0))
  for (let index = 0; index < DECAL_CAPACITY; index++) {
    wetMesh.setMatrixAt(index, hidden)
    dryMesh.setMatrixAt(index, hidden)
  }
  return {
    object: group,
    sync() {
      let drawn = false
      for (let index = 0; index < DECAL_CAPACITY; index++) {
        const decal = pool.decals[index]!
        wetMesh.setMatrixAt(index, hidden)
        dryMesh.setMatrixAt(index, hidden)
        if (!decal.on || decal.t < 0) continue
        const look = decalLook(decal, colour, dryColour, brown, ground, index)
        if (!look) continue
        drawn = true
        normal.set(decal.normal[0], decal.normal[1], decal.normal[2])
        quaternion.setFromUnitVectors(forward, normal)
        quaternion.multiply(turn.setFromAxisAngle(forward, index * 2.399963))
        const offset = 0.004 + (index % 40) * 0.0004
        matrix.compose(position.set(decal.x + normal.x * offset, decal.y + normal.y * offset, decal.z + normal.z * offset), quaternion, scale.set(look.sx, look.sy, 1))
        const mesh = look.dried ? dryMesh : wetMesh
        mesh.setMatrixAt(index, matrix)
        mesh.setColorAt(index, colour)
      }
      for (const mesh of [wetMesh, dryMesh]) {
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
      return drawn
    },
    dispose() {
      geometry.dispose()
      wet.dispose()
      dry.dispose()
    },
  }
}

function ringLayer(THREE: ThreeLib, pool: WorkshopEngine['rings']): Drawn {
  const geometry = new THREE.RingGeometry(0.86, 1, 40)
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const mesh = new THREE.InstancedMesh(geometry, material, RING_CAPACITY)
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.name = 'workshop-rings'
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  const colour = new THREE.Color()
  const normal = new THREE.Vector3()
  const forward = new THREE.Vector3(0, 0, 1)
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  mesh.setColorAt(0, colour.setHex(0))
  for (let index = 0; index < RING_CAPACITY; index++) mesh.setMatrixAt(index, hidden)
  return {
    object: mesh,
    sync() {
      let drawn = false
      for (let index = 0; index < RING_CAPACITY; index++) {
        const ring = pool.rings[index]!
        if (!ring.on) {
          mesh.setMatrixAt(index, hidden)
          continue
        }
        drawn = true
        const k = Math.min(1, ring.t / ring.duration)
        const radius = ring.from + (ring.to - ring.from) * (1 - Math.pow(1 - k, 2))
        quaternion.setFromUnitVectors(forward, normal.set(ring.normal[0], ring.normal[1], ring.normal[2]))
        matrix.compose(position.set(ring.point[0], ring.point[1], ring.point[2]), quaternion, scale.set(radius, radius, 1))
        mesh.setMatrixAt(index, matrix)
        mesh.setColorAt(index, colour.setHex(ring.color).multiplyScalar(ring.hold ? ring.hold : 1 - k))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return drawn
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/**
 * Draws the pools of the world's Workshop engine (what `world.play` fills): the two sprite systems, the streaks, the physics debris, the decals, the
 * expanding rings and the flash and fire lights, with the page's shaders and materials.
 */
export function createWorkshopLayers(THREE: ThreeLib, engine: WorkshopEngine, pointScale: number, lightScale: number): WorkshopLayers {
  const group = new THREE.Group()
  group.name = 'workshop'
  const layers: Drawn[] = [
    spriteLayer(THREE, engine.add, true, 1, pointScale),
    spriteLayer(THREE, engine.normal, false, 0.55, pointScale),
    streakLayer(THREE, engine.streaks),
    rainLayer(THREE, engine.rain),
    debrisLayer(THREE, engine.debris),
    decalLayer(THREE, engine.decals),
    ringLayer(THREE, engine.rings),
  ]
  for (const layer of layers) group.add(layer.object)
  const meshes = createMeshLayer(THREE, engine.meshes)
  group.add(meshes.group)
  const flashLights = engine.lights.lights.map(() => new THREE.PointLight(0xffc070, 0, 14))
  const fireLights = engine.lights.fire.map(() => new THREE.PointLight(FIRE_LIGHT_COLOR, 0, FIRE_LIGHT_DISTANCE))
  for (const light of [...flashLights, ...fireLights]) group.add(light)
  return {
    group,
    sync() {
      let drawCalls = 0
      for (const layer of layers) if (layer.sync()) drawCalls++
      drawCalls += meshes.sync()
      engine.lights.lights.forEach((source, index) => {
        const light = flashLights[index]!
        light.position.set(source.x, source.y, source.z)
        light.color.setHex(source.color)
        light.distance = source.distance
        light.intensity = source.intensity * lightScale
      })
      engine.lights.fire.forEach((source, index) => {
        const light = fireLights[index]!
        light.position.set(source.x, source.y, source.z)
        light.intensity = source.intensity * lightScale
      })
      return drawCalls
    },
    dispose() {
      for (const layer of layers) layer.dispose()
      meshes.dispose()
      group.clear()
    },
  }
}

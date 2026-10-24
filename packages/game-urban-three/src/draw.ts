import type { ItemBox, PartStyle, SilhouetteWindow, UrbanPart, UrbanScene } from '@adatechnology/game-urban'

import { createPrism, createRoundedBox } from './rounded-box'
import { createTextTexture } from './text'
import type { CanvasFactory } from './text'

type Three = any

const DEFAULT_ROUGHNESS = 0.9
const DEFAULT_METALNESS = 0
const ITEM_ROUNDNESS = 0.12
const LIT_WINDOW = 0xffb45e
const DARK_WINDOW = { color: 0x0d1217, roughness: 0.3, metalness: 0.5 }
const SIGN_FONT = '700 56px "Arial Narrow", Arial, sans-serif'
const SIGN_CANVAS = { width: 512, height: 128 }

export type UrbanThreeOptions = {
  /** Where canvases come from (the page's `document`). Needed only for signs and labels. */
  document?: CanvasFactory
}

/** What a drawn scene gives back: the group to add to a scene, the per-frame animation and the cleanup. */
export type DrawnUrban = {
  root: any
  /** Moves the animated parts to time `t` (seconds): flickering lamps and sweeping searchlights. */
  animate(t: number): void
  /** Lights drawn, for a budget meter. */
  readonly lights: any[]
  dispose(): void
}

export type DrawOptions = {
  /** Group the parts go into. Default a new `THREE.Group`. */
  root?: any
}

/**
 * Draws urban scenes with three.js the way the team's page does: a mesh per part in the order they were added (boxes with the
 * rounded edge, cylinders, flat-shaded cones and prisms, planes that only receive shadows, canvas signs), then one instanced mesh for
 * the small boxes and one for each kind of window. Materials are shared by colour. The instance matrices are the page's.
 */
export function createUrbanThree(THREE: Three, options: UrbanThreeOptions = {}) {
  const geometries = new Map<string, any>()
  const materials = new Map<string, any>()
  const disposables: any[] = []

  const standard = (color: number, style?: PartStyle, flat = false): any => {
    const roughness = style?.roughness ?? DEFAULT_ROUGHNESS
    const metalness = style?.metalness ?? DEFAULT_METALNESS
    const key = `s|${color}|${roughness}|${metalness}|${flat ? 1 : 0}`
    let material = materials.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: flat })
      materials.set(key, material)
    }
    return material
  }
  const glowing = (color: number): any => {
    const key = `b|${color}`
    let material = materials.get(key)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color })
      materials.set(key, material)
    }
    return material
  }
  const roundedBox = (width: number, height: number, depth: number, radius: number): any => {
    const key = [width, height, depth, radius].map((value) => value.toFixed(3)).join('|')
    let geometry = geometries.get(key)
    if (!geometry) {
      geometry = createRoundedBox(THREE, width, height, depth, radius)
      geometries.set(key, geometry)
    }
    return geometry
  }
  const shadows = (mesh: any, style: PartStyle | undefined, cast: boolean, receive: boolean): void => {
    mesh.castShadow = style?.castShadow ?? cast
    mesh.receiveShadow = style?.receiveShadow ?? receive
  }
  const texture = (lines: readonly string[], width: number, height: number, background: string, foreground: string, font: string): any => {
    if (!options.document) throw new Error('createUrbanThree needs a document (option) to draw signs and labels')
    const map = createTextTexture(THREE, options.document, lines, { width, height, background, foreground, font })
    disposables.push(map)
    return map
  }
  const textPlane = (part: { x: number; y: number; z: number; width: number; height: number; ry: number }, map: any): any => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(part.width, part.height), new THREE.MeshBasicMaterial({ map, transparent: true }))
    mesh.userData.own = true
    mesh.position.set(part.x, part.y, part.z)
    if (part.ry) mesh.rotation.y = part.ry
    disposables.push(mesh.geometry, mesh.material)
    return mesh
  }

  const drawPart = (part: UrbanPart, animators: ((t: number) => void)[], lights: any[]): any[] => {
    switch (part.shape) {
      case 'group': {
        const group = new THREE.Group()
        group.position.set(part.x, part.y, part.z)
        if (part.ry) group.rotation.y = part.ry
        return [group]
      }
      case 'box': {
        const mesh = new THREE.Mesh(roundedBox(part.width, part.height, part.depth, part.radius), part.emissive ? glowing(part.color) : standard(part.color, part.style))
        mesh.position.set(part.x, part.y, part.z)
        if (part.ry) mesh.rotation.y = part.ry
        if (part.rz) mesh.rotation.z = part.rz
        shadows(mesh, part.style, true, true)
        return [mesh]
      }
      case 'prism': {
        const geometry = createPrism(THREE, part.width, part.height, part.depth)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style, true))
        mesh.position.set(part.x, part.y, part.z)
        if (part.ry) mesh.rotation.y = part.ry
        shadows(mesh, part.style, true, true)
        return [mesh]
      }
      case 'cylinder': {
        const geometry = new THREE.CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.segments)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style))
        mesh.position.set(part.x, part.y, part.z)
        shadows(mesh, part.style, true, true)
        return [mesh]
      }
      case 'cone': {
        const geometry = new THREE.ConeGeometry(part.radius, part.height, part.segments)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style, true))
        mesh.position.set(part.x, part.y, part.z)
        shadows(mesh, part.style, true, true)
        return [mesh]
      }
      case 'crown': {
        const geometry = new THREE.DodecahedronGeometry(part.radius, 0)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style))
        mesh.position.set(part.x, part.y, part.z)
        shadows(mesh, part.style, true, false)
        return [mesh]
      }
      case 'terrain': {
        const { grid } = part
        const geometry = new THREE.PlaneGeometry(grid.size, grid.size, grid.segments, grid.segments)
        geometry.rotateX(-Math.PI / 2)
        const position = geometry.attributes.position
        const colors = new Float32Array(position.count * 3)
        const color = new THREE.Color()
        for (let index = 0; index < position.count; index++) {
          position.setXYZ(index, grid.x[index], grid.heights[index], grid.z[index])
          color.setHex(grid.colors[index] as number)
          colors[index * 3] = color.r
          colors[index * 3 + 1] = color.g
          colors[index * 3 + 2] = color.b
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.computeVertexNormals()
        disposables.push(geometry)
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
        disposables.push(material)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.userData.own = true
        shadows(mesh, part.style, true, true)
        return [mesh]
      }
      case 'vault': {
        const geometry = new THREE.CylinderGeometry(part.radius, part.radius, part.length, part.segments, 1, false, 0, part.arc)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style))
        mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z)
        mesh.position.set(part.x, part.y, part.z)
        mesh.scale.set(part.scale.x, part.scale.y, part.scale.z)
        shadows(mesh, part.style, true, false)
        return [mesh]
      }
      case 'plane': {
        const geometry = new THREE.PlaneGeometry(part.width, part.depth).rotateX(-Math.PI / 2)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style))
        mesh.position.set(part.x, part.y, part.z)
        shadows(mesh, part.style, false, true)
        return [mesh]
      }
      case 'line': {
        const geometry = new THREE.BufferGeometry().setFromPoints(part.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
        const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: part.color }))
        mesh.userData.own = true
        disposables.push(geometry, mesh.material)
        return [mesh]
      }
      case 'sign':
        return [textPlane(part, texture([part.text], SIGN_CANVAS.width, SIGN_CANVAS.height, part.background, part.foreground, SIGN_FONT))]
      case 'label':
        return [textPlane(part, texture(part.lines, part.canvas.width, part.canvas.height, part.background, part.foreground, part.font))]
      case 'light': {
        if (part.kind === 'point') {
          const light = new THREE.PointLight(part.color, part.intensity, part.distance, part.decay)
          light.position.set(part.x, part.y, part.z)
          lights.push(light)
          if (part.flicker) {
            animators.push((t) => {
              light.intensity = part.intensity * (Math.sin(t * 23 + part.x) > 0.3 || Math.sin(t * 3.1) > 0.85 ? 0.15 : 1)
            })
          }
          return [light]
        }
        const light = new THREE.SpotLight(part.color, part.intensity, part.distance, part.angle, part.penumbra, part.decay)
        light.position.set(part.x, part.y, part.z)
        const target = new THREE.Object3D()
        target.position.set(part.target.x, part.target.y, part.target.z)
        light.target = target
        lights.push(light)
        const { sweep } = part
        if (sweep) {
          animators.push((t) => {
            target.position.set(part.x + Math.sin(t * sweep.speed + part.x) * sweep.radius, 0, part.z + Math.cos(t * sweep.speed + part.x) * sweep.radius)
          })
        }
        return [light, target]
      }
    }
  }

  const instancedItems = (list: readonly ItemBox[]): any => {
    const mesh = new THREE.InstancedMesh(roundedBox(1, 1, 1, ITEM_ROUNDNESS), standard(0xffffff), list.length)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    list.forEach((entry, index) => {
      euler.set(entry.rx, entry.ry, entry.rz)
      quaternion.setFromEuler(euler)
      matrix.compose(position.set(entry.x, entry.y + entry.height / 2, entry.z), quaternion, scale.set(entry.width, entry.height, entry.depth))
      mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, color.set(entry.color))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const instancedWindows = (list: readonly SilhouetteWindow[], material: any): any => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    disposables.push(geometry)
    const mesh = new THREE.InstancedMesh(geometry, material, list.length)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const axis = new THREE.Vector3(0, 1, 0)
    const scale = new THREE.Vector3()
    list.forEach((entry, index) => {
      quaternion.setFromAxisAngle(axis, entry.ry)
      matrix.compose(new THREE.Vector3(entry.x, entry.y, entry.z), quaternion, scale.set(entry.width, entry.height, 1))
      mesh.setMatrixAt(index, matrix)
    })
    return mesh
  }

  /** Draws a scene: its parts in order, then the instanced boxes, the lit windows and the dark windows. */
  function draw(scene: UrbanScene, drawOptions: DrawOptions = {}): DrawnUrban {
    const root = drawOptions.root ?? new THREE.Group()
    const animators: ((t: number) => void)[] = []
    const lights: any[] = []
    const objects: any[][] = []
    for (const part of scene.parts) {
      const made = drawPart(part, animators, lights)
      objects.push(made)
      const parent = part.parent < 0 ? root : (objects[part.parent] as any[])[0]
      parent.add(...made)
    }
    if (scene.items.length) root.add(instancedItems(scene.items))
    if (scene.windows.lit.length) root.add(instancedWindows(scene.windows.lit, glowing(LIT_WINDOW)))
    if (scene.windows.dark.length) root.add(instancedWindows(scene.windows.dark, standard(DARK_WINDOW.color, DARK_WINDOW)))
    return {
      root,
      lights,
      animate: (t) => animators.forEach((step) => step(t)),
      dispose: () => {
        root.parent?.remove(root)
        for (const item of disposables.splice(0)) item.dispose?.()
        for (const geometry of geometries.values()) geometry.dispose()
        for (const material of materials.values()) material.dispose()
        geometries.clear()
        materials.clear()
      },
    }
  }

  return { THREE, draw }
}

export type UrbanThree = ReturnType<typeof createUrbanThree>

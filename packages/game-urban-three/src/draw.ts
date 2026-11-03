import { markKitOrigin } from '@adatechnology/game-contracts'
import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { LightBudget, SourceHandle } from '@adatechnology/game-render-three'
import type { ItemBox, LightPart, PartStyle, SilhouetteWindow, UrbanPart, UrbanScene } from '@adatechnology/game-urban'
import { shapeGeometries } from '@adatechnology/game-shapes-three'

import { createPrism, createRoundedBox } from './rounded-box'
import { createTextTexture } from './text'
import type { CanvasFactory } from './text'
import type { PlacementResolver } from './resolvers'

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
  /** Who makes the objects of the vehicles and plants a scene places. A kind without a resolver is left empty. */
  resolvers?: { vehicle?: PlacementResolver; plant?: PlacementResolver }
  /**
   * The host's light budget: each `light` part becomes a source of it (it competes for a slot by distance; a flickering lamp and a sweeping searchlight update their source) instead of a real
   * light of the scene. `DrawnUrban.lights` then lists the sources. Without it the lights are created here (deprecated, removed in the next major).
   */
  lights?: LightBudget
}

/** What a drawn scene gives back: the group to add to a scene, the per-frame animation and the cleanup. */
export type DrawnUrban = {
  root: any
  /** Moves the animated parts to time `t` (seconds): flickering lamps and sweeping searchlights. */
  animate(t: number): void
  /** Lights drawn, for a budget meter: the lights of the scene, or (with `UrbanThreeOptions.lights`) a `BudgetedLamp` for each: its bulb in the scene and its source of the budget. */
  readonly lights: any[]
  dispose(): void
}

/** A light part drawn through the budget: the node it hangs from, the part that describes it (distance, colour...) and the source that competes for a slot. */
export type BudgetedLamp = { readonly bulb: any; readonly part: LightPart; readonly source: SourceHandle }

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
  // three with its primitive geometries made by game-shapes (bit-identical on r128 and r160, cached by parameters)
  const T = shapeGeometries(THREE) as Three
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
    const mesh = new THREE.Mesh(new T.PlaneGeometry(part.width, part.height), new THREE.MeshBasicMaterial({ map, transparent: true }))
    mesh.userData.own = true
    mesh.position.set(part.x, part.y, part.z)
    if (part.ry) mesh.rotation.y = part.ry
    disposables.push(mesh.geometry, mesh.material)
    return mesh
  }

  const forward = new THREE.Vector3(0, 0, -1)
  const aimAt = (node: any, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): void => {
    node.quaternion.setFromUnitVectors(forward, new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalize())
  }

  /** The bulb of a light part as a node of the scene, and its source of the budget. */
  const sourceOf = (part: LightPart, bulb: any, extra: Record<string, unknown>): SourceHandle =>
    options.lights!.addSource({ owner: 'urban.light', priority: LIGHT_PRIORITY.street, color: part.color, intensity: part.intensity, distance: part.distance, decay: part.decay, position: [0, 0, 0], follow: bulb, ...extra })

  const drawBudgetedLight = (part: LightPart, animators: ((t: number) => void)[], lights: any[]): any[] => {
    const bulb = new THREE.Object3D()
    bulb.position.set(part.x, part.y, part.z)
    if (part.kind === 'point') {
      const source = sourceOf(part, bulb, {})
      lights.push({ bulb, part, source } satisfies BudgetedLamp)
      if (part.flicker) animators.push((t) => source.update({ intensity: part.intensity * (Math.sin(t * 23 + part.x) > 0.3 || Math.sin(t * 3.1) > 0.85 ? 0.15 : 1) }))
      return [bulb]
    }
    aimAt(bulb, part, part.target)
    const source = sourceOf(part, bulb, { kind: 'spot', angle: part.angle, penumbra: part.penumbra })
    lights.push({ bulb, part, source } satisfies BudgetedLamp)
    const { sweep } = part
    if (sweep) animators.push((t) => aimAt(bulb, part, { x: part.x + Math.sin(t * sweep.speed + part.x) * sweep.radius, y: 0, z: part.z + Math.cos(t * sweep.speed + part.x) * sweep.radius }))
    return [bulb]
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
        const geometry = new T.CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.segments)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style))
        mesh.position.set(part.x, part.y, part.z)
        shadows(mesh, part.style, true, true)
        return [mesh]
      }
      case 'cone': {
        const geometry = new T.ConeGeometry(part.radius, part.height, part.segments)
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
        const geometry = new T.PlaneGeometry(grid.size, grid.size, grid.segments, grid.segments)
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
        const geometry = new T.CylinderGeometry(part.radius, part.radius, part.length, part.segments, 1, false, 0, part.arc)
        disposables.push(geometry)
        const mesh = new THREE.Mesh(geometry, standard(part.color, part.style))
        mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z)
        mesh.position.set(part.x, part.y, part.z)
        mesh.scale.set(part.scale.x, part.scale.y, part.scale.z)
        shadows(mesh, part.style, true, false)
        return [mesh]
      }
      case 'plane': {
        const geometry = new T.PlaneGeometry(part.width, part.depth).rotateX(-Math.PI / 2)
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
      case 'placement': {
        const holder = new THREE.Group()
        holder.position.set(part.x, part.y, part.z)
        if (part.ry) holder.rotation.y = part.ry
        if (part.scale !== 1) holder.scale.setScalar(part.scale)
        const object = options.resolvers?.[part.kind]?.(part)
        if (object) holder.add(object)
        holder.userData.placement = { kind: part.kind, id: part.id }
        return [holder]
      }
      case 'light': {
        if (options.lights) return drawBudgetedLight(part, animators, lights)
        if (part.kind === 'point') {
          // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
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
        // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
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
    const geometry = new T.PlaneGeometry(1, 1)
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
    const root = markKitOrigin(drawOptions.root ?? new THREE.Group(), { owner: 'game-urban-three', kind: 'urban' })
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
        if (options.lights) for (const lamp of lights) lamp.source.remove()
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

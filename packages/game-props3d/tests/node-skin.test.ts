import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { collectReferencedNodes, createNodeSkin } from '../src'

const meshOf = (color: number, geometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1)): THREE.Mesh => new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }))

/** root > body (group) > [torso mesh, head group > [skull mesh, eye mesh]] */
const buildTree = () => {
  const root = new THREE.Group()
  const body = new THREE.Group()
  const head = new THREE.Group()
  const torso = meshOf(0xff0000)
  const skull = meshOf(0x00ff00)
  const eye = meshOf(0x0000ff, new THREE.SphereGeometry(0.1, 8, 6))
  head.position.set(0, 1, 0)
  skull.position.set(0, 0.5, 0)
  eye.position.set(0.2, 0, 0.3)
  head.add(skull, eye)
  body.add(torso, head)
  root.add(body)
  return { root, body, head, torso, skull, eye }
}

describe('createNodeSkin', () => {
  it('merges the tree into one mesh and makes every group a node', () => {
    const { root, body, head } = buildTree()
    const skin = createNodeSkin(THREE, root)
    expect(skin.mesh).toBeInstanceOf(THREE.Mesh)
    expect(skin.nodes).toContain(root)
    expect(skin.nodes).toContain(body)
    expect(skin.nodes).toContain(head)
    expect(skin.nodes).toHaveLength(3)
    for (const name of ['position', 'normal', 'aTint', 'aSurface', 'aNodeIndex']) expect(skin.mesh.geometry.getAttribute(name)).toBeDefined()
    expect(skin.mesh.frustumCulled).toBe(false)
  })

  it('ties a vertex to the group that parents its mesh, with the mesh offset baked in', () => {
    const { root, head, skull } = buildTree()
    const skin = createNodeSkin(THREE, root)
    const index = skin.mesh.geometry.getAttribute('aNodeIndex')
    const position = skin.mesh.geometry.getAttribute('position')
    const headNode = skin.nodes.indexOf(head)
    let highest = Number.NEGATIVE_INFINITY
    for (let vertex = 0; vertex < index.count; vertex++) if (index.getX(vertex) === headNode) highest = Math.max(highest, position.getY(vertex))
    expect(highest).toBeCloseTo(skull.position.y + 0.5, 5)
  })

  it('keeps a referenced mesh as a node of its own', () => {
    const { root, eye } = buildTree()
    const skin = createNodeSkin(THREE, root, { nodes: [eye] })
    expect(skin.nodes).toContain(eye)
    expect(skin.nodes).toHaveLength(4)
  })

  it('leaves out meshes that are hidden or under a hidden group', () => {
    const { root, head } = buildTree()
    const all = createNodeSkin(THREE, root).mesh.geometry.getAttribute('position').count
    head.visible = false
    const rest = createNodeSkin(THREE, root).mesh.geometry.getAttribute('position').count
    expect(rest).toBeLessThan(all)
    expect(rest).toBe(36)
  })

  it('bakes the colour of the material, as sRGB, and the surface values', () => {
    const { root } = buildTree()
    const skin = createNodeSkin(THREE, root)
    const tint = skin.mesh.geometry.getAttribute('aTint')
    const surface = skin.mesh.geometry.getAttribute('aSurface')
    const expected = new THREE.Color(0xff0000).convertLinearToSRGB()
    expect(tint.getX(0)).toBeCloseTo(expected.r, 5)
    expect(surface.getX(0)).toBeCloseTo(1, 5)
    expect(surface.getZ(0)).toBe(0)
  })

  it('copies the world matrix of every node on update', () => {
    const { root, head } = buildTree()
    const skin = createNodeSkin(THREE, root)
    head.rotation.z = 0.5
    root.position.x = 2
    skin.update()
    const headMatrix = skin.matrices.value[skin.nodes.indexOf(head)] as THREE.Matrix4
    const position = new THREE.Vector3().setFromMatrixPosition(headMatrix)
    expect(position.x).toBeCloseTo(2, 6)
    expect(position.y).toBeCloseTo(1, 6)
    expect(headMatrix.elements[1]).toBeCloseTo(Math.sin(0.5), 6)
  })

  it('patches the vertex and fragment shaders and the depth shader to read the node matrices', () => {
    const { root } = buildTree()
    const skin = createNodeSkin(THREE, root)
    const material = skin.mesh.material as THREE.MeshStandardMaterial
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>',
    }
    material.onBeforeCompile(shader as never, null as never)
    expect(shader.uniforms.uNodes).toBe(skin.matrices)
    expect(shader.vertexShader).toContain('uniform mat4 uNodes[3]')
    expect(shader.vertexShader).toContain('uNodes[int(aNodeIndex + .5)]')
    expect(shader.fragmentShader).toContain('vec4 diffuseColor = vec4( vTint, opacity );')
    expect(shader.fragmentShader).toContain('float roughnessFactor = vSurface.x;')
    const depthShader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '' }
    skin.mesh.customDepthMaterial?.onBeforeCompile(depthShader as never, null as never)
    expect(depthShader.uniforms.uNodes).toBe(skin.matrices)
    expect(material.customProgramCacheKey()).toBe('nodeSkin3')
  })
})

describe('collectReferencedNodes', () => {
  it('finds every Object3D kept in the fields of an owner, up to three levels, and skips materials and the given keys', () => {
    const { head, eye, torso } = buildTree()
    const owner = { head, nested: { deep: { eyes: [eye] } }, material: torso.material, spec: { head: torso } }
    const found = collectReferencedNodes(owner, ['spec'])
    expect(found.has(head)).toBe(true)
    expect(found.has(eye)).toBe(true)
    expect(found.has(torso)).toBe(false)
  })
})

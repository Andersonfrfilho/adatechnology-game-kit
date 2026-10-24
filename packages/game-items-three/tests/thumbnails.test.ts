import { createGoodsItems } from '@adatechnology/game-items-goods'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { composeThumbnailScene, itemThumbnail, itemThumbnailSvg, renderItemThumbnail, shapeThumbnailSvg, SHAPES, thumbnailPatch } from '../src'

const catalog = createGoodsItems()

describe('SVG thumbnails by shape', () => {
  it('has a picture for each of the 25 shapes, in the colour of the item, with no script and no reference', () => {
    for (const shape of SHAPES) {
      const svg = shapeThumbnailSvg(shape, 0x9b3a24)
      expect(svg, shape).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 64 64">.+<\/svg>$/)
      expect(svg, shape).not.toMatch(/<script|foreignObject|\son\w+=|javascript:|xlink:href|<!ENTITY|<image|url\(/i)
      expect(new Set(SHAPES.map((other) => shapeThumbnailSvg(other, 0x9b3a24))).size).toBe(SHAPES.length)
    }
    expect(shapeThumbnailSvg('can', 0x9b3a24)).toContain('#9b3a24')
    expect(shapeThumbnailSvg('can', 0x336699)).not.toContain('#9b3a24')
  })

  it('is the same bytes every time', () => {
    expect(shapeThumbnailSvg('jerrycan', 0xa3322a)).toBe(shapeThumbnailSvg('jerrycan', 0xa3322a))
  })
})

describe('the thumbnail of every item of the goods catalog', () => {
  it('asks to render the modeled ones and draws an SVG for the others', () => {
    let rendered = 0
    let drawn = 0
    for (const item of catalog.list()) {
      const thumbnail = itemThumbnail(item)
      if (item.model !== undefined) {
        expect(thumbnail, item.id).toEqual({ render: true })
        rendered++
      } else {
        expect(thumbnail.svg, item.id).toMatch(/^<svg /)
        drawn++
      }
      expect(itemThumbnailSvg(item), item.id).toMatch(/^<svg /)
    }
    expect(rendered).toBe(23)
    expect(drawn).toBe(catalog.list().length - 23)
  })

  it('goes into a catalog as a patch', () => {
    const patch = thumbnailPatch(catalog.list())
    expect(Object.keys(patch)).toHaveLength(catalog.list().length)
    expect(patch.canned_beans).toEqual({ thumbnail: { render: true } })
    expect(patch.dvd?.thumbnail.svg).toMatch(/^<svg /)
  })
})

describe('the picture of a modeled item', () => {
  const frames = (id: string, size: [number, number, number], model: string) => {
    const { scene, camera } = composeThumbnailScene(THREE, { id, category: 'x', size, model })
    const box = new THREE.Box3().setFromObject(scene.children[0] as THREE.Object3D)
    const corners = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => new THREE.Vector3(x ? box.max.x : box.min.x, y ? box.max.y : box.min.y, z ? box.max.z : box.min.z))))
    return corners.map((corner) => corner.project(camera))
  }

  it('frames the whole item: every corner of its box is inside the picture', () => {
    for (const id of ['canned_beans', 'machete', 'crowbar', 'lpg_cylinder_13kg']) {
      const item = catalog.get(id)
      for (const corner of frames(id, [...item.size], item.model as string)) {
        expect(Math.abs(corner.x), id).toBeLessThanOrEqual(1)
        expect(Math.abs(corner.y), id).toBeLessThanOrEqual(1)
      }
    }
  })

  it('draws it with the renderer of the host and returns the PNG', () => {
    const calls: string[] = []
    const renderer = {
      setSize: (w: number, h: number) => calls.push(`size ${w}x${h}`),
      setClearColor: () => calls.push('clear'),
      render: (scene: THREE.Scene, camera: THREE.Camera) => calls.push(`render ${scene.children.length > 0 && camera !== undefined}`),
      domElement: { toDataURL: (type?: string) => `data:${type};base64,AAAA` },
    }
    const url = renderItemThumbnail(THREE, renderer, { ...catalog.get('hammer') }, { size: 96, wear: 2 })
    expect(url).toBe('data:image/png;base64,AAAA')
    expect(calls).toEqual(['size 96x96', 'clear', 'render true'])
  })

  it('shows the wear in the picture: the spoiled item has other colours than the new one', () => {
    const colorsOf = (wear: 0 | 2): number[] => {
      const { scene } = composeThumbnailScene(THREE, { ...catalog.get('canned_beans') }, { wear })
      const found: number[] = []
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) found.push((mesh.material as THREE.MeshStandardMaterial).color.getHex())
      })
      return found
    }
    expect(colorsOf(2)).not.toEqual(colorsOf(0))
  })
})

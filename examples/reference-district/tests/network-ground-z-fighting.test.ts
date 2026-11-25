import { coincidentFacesOf, describeCoincidentFaces } from '@adatechnology/game-shapes-three'
import { createTerrain } from '@adatechnology/game-terrain'
import type { Terrain } from '@adatechnology/game-terrain'
import { createUrbanThree } from '@adatechnology/game-urban-three'
import { surfacePiecesOf } from '@adatechnology/game-urban/networks'
import type { SurfacePiece } from '@adatechnology/game-urban/networks'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { planLots } from '../src/game/assemble/houses'
import { buildNetworks } from '../src/game/assemble/networks'
import { groundLayoutOf, terrainBoundsOf } from '../src/game/ground'
import { POLE_MIN_GAP } from '../src/game/roads'
import { keepOutOf } from '../src/game/service'
import { plan, site } from './helpers'

/** Metres the ground patch goes beyond the piece on each side. */
const PATCH_MARGIN = 0.6
const CELL_SIZE = 0.5

const lots = planLots(site)
const generated = buildNetworks({ plan, site, lots, avoid: keepOutOf(lots, POLE_MIN_GAP) })
const options = { surfaceAt: generated.surfaceAt, roadLevel: 0 }

/** The terrain's own surface under a piece as a mesh: the quads of `buildChunkGeometry` (a, c, b and c, d, b) over the height field, which is what the asphalt and the sidewalk are. */
function groundPatchOf(terrain: Terrain, piece: SurfacePiece): THREE.Mesh {
  const reach = Math.max(piece.size[0], piece.size[2]) / 2 + PATCH_MARGIN
  const [x0, z0] = terrain.bounds
  const first = [Math.max(0, Math.floor((piece.at[0] - reach - x0) / CELL_SIZE)), Math.max(0, Math.floor((piece.at[2] - reach - z0) / CELL_SIZE))] as const
  const last = [Math.min(terrain.columns, Math.ceil((piece.at[0] + reach - x0) / CELL_SIZE)), Math.min(terrain.rows, Math.ceil((piece.at[2] + reach - z0) / CELL_SIZE))] as const
  const across = last[0] - first[0] + 1
  const positions: number[] = []
  for (let row = first[1]; row <= last[1]; row++) for (let column = first[0]; column <= last[0]; column++) positions.push(x0 + column * CELL_SIZE, terrain.vertexHeight(column, row), z0 + row * CELL_SIZE)
  const indices: number[] = []
  for (let row = 0; row < last[1] - first[1]; row++) {
    for (let column = 0; column < across - 1; column++) {
      const [a, c] = [row * across + column, (row + 1) * across + column]
      indices.push(a, c, a + 1, c, c + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  mesh.name = `ground:${piece.id}`
  return mesh
}

/** The covers, grates and pits of the district's networks lie in the plane of the asphalt and the sidewalk: nothing of them may share it (CLAUDE.md §13). */
describe('the network surface and the ground it rests on', () => {
  const pieces = surfacePiecesOf(generated.networks, options)
  const terrain = createTerrain({ bounds: terrainBoundsOf(plan), cellSize: CELL_SIZE, layout: groundLayoutOf(plan) })
  const urban = createUrbanThree(THREE, {})

  it('has covers on the road to check', () => {
    expect(pieces.filter((piece) => piece.kind === 'manhole_cover' || piece.kind === 'inspection_cover' || piece.kind === 'inlet_grate').length).toBeGreaterThan(0)
  })

  it.each([
    ['surface', () => urban.drawNetworkSurface(generated.networks, options).root],
    ['buried', () => urban.drawBuriedNetworks(generated.networks, options).root],
  ])('%s: no face coincides with the terrain surface under any piece', (_name, draw) => {
    const root = new THREE.Group()
    root.add(draw(), ...pieces.map((piece) => groundPatchOf(terrain, piece)))
    root.updateMatrixWorld(true)
    // the patches of two neighbouring pieces overlap each other (the test's doing): only those pairs are left out
    const hits = coincidentFacesOf(root as never, { maxHits: Number.POSITIVE_INFINITY }).filter((hit) => !(hit.labelA.startsWith('ground:') && hit.labelB.startsWith('ground:')))
    expect(hits.length, describeCoincidentFaces(hits, 6)).toBe(0)
  })
})

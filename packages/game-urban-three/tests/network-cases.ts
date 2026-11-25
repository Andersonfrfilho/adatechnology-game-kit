import type * as THREE_NS from 'three'

import { generateNetworks, surfacePiecesOf } from '@adatechnology/game-urban/networks'
import type { NetworkLot } from '@adatechnology/game-urban/networks'
import type { CityPlanInput } from '@adatechnology/game-urban'

import { createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'

/** A short periphery street with a corner: end and corner poles with guys, a transformer, a telecom bundle with a splice and its coil, drops to six lots. */
const PLAN: CityPlanInput = {
  id: 'network_case',
  scale: 'town',
  size: [240, 240],
  districts: [{ id: 'periphery', kind: 'residential_popular', rect: [-120, -120, 120, 120] }],
  lines: [
    { id: 'main_street', kind: 'street', width: 10, points: [[-110, 0], [110, 0]] },
    { id: 'side_street', kind: 'street', width: 10, points: [[60, 0], [60, 110]] },
  ],
}
const LOTS: readonly NetworkLot[] = [10, 22, 34].flatMap((x) => [
  { id: `north_${x}`, rect: [x, -32.5, x + 12, -7.5] as const },
  { id: `south_${x}`, rect: [x, 7.5, x + 12, 32.5] as const },
])

/** The same street with its power underground, from the feed where it leaves the map: duct bank, boxes, pads and light columns. */
const UNDERGROUND_PLAN: CityPlanInput = { ...PLAN, id: 'network_case_underground', lines: [{ id: 'main_street', kind: 'street', width: 10, points: [[-118, 0], [110, 0]] }, PLAN.lines![1]!] }

/** The underground street: the light columns at night, the surface (box lids, pads), the duct bank and laterals under it, the box lids thrown. */
export function undergroundCases(THREE: typeof THREE_NS): Array<[string, () => THREE_NS.Object3D]> {
  const generated = generateNetworks({ plan: UNDERGROUND_PLAN, lots: LOTS, seed: 5, power: { default: 'underground' } })
  const urban = createUrbanThree(THREE, { document: fakeDocument })
  return [
    ['networks/underground_night', () => urban.drawNetworks(generated.networks, { surfaceAt: generated.surfaceAt, isNight: true, lamps: { lit: 0.7, flicker: 0.3 } }).root],
    ['networks/underground_surface', () => urban.drawNetworkSurface(generated.networks, { surfaceAt: generated.surfaceAt }).root],
    ['networks/underground_buried', () => urban.drawBuriedNetworks(generated.networks, { surfaceAt: generated.surfaceAt }).root],
    ['networks/underground_lids', () => {
      const group = new THREE.Group()
      for (const piece of surfacePiecesOf(generated.networks).filter((entry) => entry.kind === 'power_box_cover')) {
        const lid = urban.drawCoverLid(piece).root
        lid.position.set(...piece.at)
        lid.rotation.y = piece.ry
        group.add(lid)
      }
      return group
    }],
  ]
}

/** The networks drawn by day and at night with failing lamps, the surface pieces (covers, grates, hydrants, wing walls, lot boxes) and the pipes and pits under them: what the catalog tests walk. */
export function networkCases(THREE: typeof THREE_NS): Array<[string, () => THREE_NS.Object3D]> {
  const generated = generateNetworks({ plan: PLAN, lots: LOTS, seed: 5 })
  const urban = createUrbanThree(THREE, { document: fakeDocument })
  const underground = undergroundCases(THREE)
  const draw = (options: Parameters<typeof urban.drawNetworks>[1]): THREE_NS.Object3D => urban.drawNetworks(generated.networks, { surfaceAt: generated.surfaceAt, ...options }).root
  return [
    ['networks/day', () => draw({ isNight: false })],
    ['networks/night_failing', () => draw({ isNight: true, lamps: { lit: 0.7, flicker: 0.3 } })],
    ['networks/surface', () => urban.drawNetworkSurface(generated.networks, { surfaceAt: generated.surfaceAt }).root],
    ['networks/buried', () => urban.drawBuriedNetworks(generated.networks, { surfaceAt: generated.surfaceAt }).root],
    ['networks/lids', () => {
      const lids = surfacePiecesOf(generated.networks).filter((piece) => piece.kind === 'manhole_cover' || piece.kind === 'inspection_cover' || piece.kind === 'inlet_grate')
      const group = new THREE.Group()
      for (const piece of lids) {
        const lid = urban.drawCoverLid(piece).root
        lid.position.set(...piece.at)
        lid.rotation.y = piece.ry
        group.add(lid)
      }
      return group
    }],
    ...underground,
  ]
}

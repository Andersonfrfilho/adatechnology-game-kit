import { createTerrain } from '@adatechnology/game-terrain'
import * as THREE from 'three'

import { TERRAIN_STRIPS, createTerrainRenderer, createTerrainTestModule, terrainLotsGround } from '../src'

/** Every surface of the test area as drawn, untouched and after each kind of blow, plus the lots of the area and its items: built from the area's own lists, so a new surface is in them. */
type Root = THREE.Object3D
export type Case = [string, () => Root]

const CAMERA = { x: 0, y: 2, z: 0 }
const BLOWS = [['ballistic', 900], ['blunt', 400], ['explosive', 800_000]] as const

function drawn(surface: string, blow?: (typeof BLOWS)[number]): Root {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], layout: { surface } })
  const view = createTerrainRenderer(THREE, { terrain })
  view.sync(CAMERA)
  if (blow) {
    terrain.strike(blow[0], { x: 0.4, z: -0.3, energy: blow[1] })
    view.sync(CAMERA)
  }
  return view.group
}

export const cases: Case[] = [
  ...TERRAIN_STRIPS.flatMap((surface): Case[] => [[`${surface}`, () => drawn(surface)], ...BLOWS.map((blow): Case => [`${surface}/${blow[0]}`, () => drawn(surface, blow)])]),
  [
    'lots',
    () => {
      const terrain = createTerrain({ bounds: [-40, -40, 40, 40], layout: terrainLotsGround('en') })
      const view = createTerrainRenderer(THREE, { terrain })
      view.sync(CAMERA)
      return view.group
    },
  ],
  ...createTerrainTestModule({ locale: 'en' }).items('en').map((item): Case => [`item/${item.id}`, () => item.build(THREE) as Root]),
]

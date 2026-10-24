import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { visualStateOf } from '@adatechnology/game-animals'
import { SPECIES } from '@adatechnology/game-animals-species'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createAnimalsThree } from '../src'
import { createStream } from '../src/context'

import { stubDocument } from './helpers'

type SkinEvent = { type: string; data: { species: string; infected: boolean; nodes: number; vertices: number; position: string; normal: string; cor: string; rme: string; bi: string } }
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('../../game-props3d/tests/fixtures/team-golden/game-animal-skin.json', import.meta.url)), 'utf8')) as { events: SkinEvent[] }
const skins = fixture.events.filter((event) => event.type === 'skin')

const fnv = (array: ArrayLike<number>): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < array.length; index++) hash = Math.imul(hash ^ (Math.round((array[index] as number) * 1e4) | 0), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, '0')
}

describe('G-animals (skin): the GPU skin of the game (bichoPele) against the node skin of the SDK', () => {
  it('has 26 recorded skins: 13 species, healthy and bitten', () => {
    expect(skins).toHaveLength(26)
  })

  it('merges every species into the same nodes and vertices, and the attributes hash the same where the coat has no canvas texture', () => {
    const kit = createAnimalsThree(THREE, { document: stubDocument(), random: createStream(1) })
    const mismatches: string[] = []
    for (const { data } of skins) {
      const species = SPECIES.find((candidate) => candidate.id === data.species)!
      const rig = kit.build(species)
      kit.setVisualState(rig, visualStateOf(species.outcome, data.infected))
      // the game shows the wounds of a bitten animal that dies of it too (the page hides them: its `infected` is false for those species): same tree, parts on
      if (data.infected && rig.dead) for (const part of rig.infectionParts) part.visible = true
      const skin = kit.createSkin(rig)
      const geometry = skin.mesh.geometry
      const actual = { nodes: skin.nodes.length, vertices: geometry.getAttribute('position').count }
      if (actual.nodes !== data.nodes || actual.vertices !== data.vertices) mismatches.push(`${data.species}/${data.infected}: ${data.nodes}/${data.vertices} -> ${actual.nodes}/${actual.vertices}`)
      else if (!('texture' in species.body && species.body.texture)) {
        const hashes = { position: fnv(geometry.getAttribute('position').array), normal: fnv(geometry.getAttribute('normal').array), bi: fnv(geometry.getAttribute('aNodeIndex').array), cor: fnv(geometry.getAttribute('aTint').array), rme: fnv(geometry.getAttribute('aSurface').array) }
        if (hashes.position !== data.position || hashes.normal !== data.normal || hashes.bi !== data.bi || hashes.cor !== data.cor || hashes.rme !== data.rme) mismatches.push(`${data.species}/${data.infected}: ${JSON.stringify(hashes)} vs ${data.position}/${data.normal}/${data.bi}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})

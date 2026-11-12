import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createRng } from '@adatechnology/game-characters'
import * as THREE from 'three'
import { EXTRAS, FACE_FEATURES, HAND_ITEMS, HATS, bakeBody, buildInstancedBody, createBestBuilder, createPersonBuilder } from '../src'
import type { BakeBuilders, PersonSpec } from '../src'
import undeadTypes from '../../game-characters-undead/src/data/types.json'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
const PEOPLE = JSON.parse(readFileSync(join(process.cwd(), '../../specs/001-migracao-entregas-dos-times/game-slice/characters/people.json'), 'utf8')) as Array<{ b?: PersonSpec; kids?: Array<PersonSpec & { x: number }> } & Record<string, unknown>>

const canvas = (): HTMLCanvasElement => document.createElement('canvas')
const base = { skin: 0xc49070, hair: { s: 'short', c: 0x222222 }, top: { c: 0x445566, sl: 'long' }, pants: { c: 0x333333 }, shoes: 0x111111 }
const person = (spec: PersonSpec, detail = 0): THREE.Object3D => createPersonBuilder(THREE, { random: createRng(5), detail, createCanvas: canvas }).build(spec).root

const cards = undeadTypes.map((type) => ({ name: type.name['pt-BR'], eye: Number.parseInt(type.eye.color, 16) }))
const best = (spec: Parameters<ReturnType<typeof createBestBuilder>['build']>[0], lod: number): THREE.Object3D => {
  const builder = createBestBuilder(THREE, { types: cards, random: () => 0.5 })
  builder.setLOD(lod)
  return builder.build(spec)
}

export type Case = [string, () => THREE.Object3D]
export const cases: Case[] = []
for (const p of PEOPLE) cases.push([`person/${p.id}`, () => createPersonBuilder(THREE, { random: createRng(77), createCanvas: canvas }).buildPerson(p, false).root])
for (const p of PEOPLE.slice(0, 8)) cases.push([`person/${p.id}:zombie`, () => createPersonBuilder(THREE, { random: createRng(77), createCanvas: canvas }).buildPerson(p, true).root])
for (const detail of [0, 1, 2]) cases.push([`base:detail${detail}`, () => person(base, detail)])
for (const id of Object.keys(EXTRAS)) cases.push([`extra/${id}`, () => person({ ...base, ex: [[id, 0x884422, 0x2255aa]] })])
for (const hat of HATS) for (const kind of hat.kinds) cases.push([`hat/${kind}`, () => person({ ...base, hat: { k: kind, c: 0x884422, tape: 0x111111, photo: 1, nvg: 1 } })])
for (const feature of FACE_FEATURES) cases.push([`face/${feature.ids}`, () => person({ ...base, face: feature.ids })])
for (const kind of Object.keys(HAND_ITEMS)) cases.push([`hand/${kind}`, () => person({ ...base, hand: kind, lhand: kind })])
for (const type of cards) {
  for (const decay of [0, 1, 2, 3]) for (const lod of [1, 0.5]) cases.push([`best/${type.name}:d${decay}:l${lod}`, () => best({ type: type.name, decay, seed: 2 }, lod)])
  cases.push([
    `bake/${type.name}`,
    () => {
      const builder = createBestBuilder(THREE, { types: cards, random: () => 0.5 })
      const builders: BakeBuilders = { buildBest: (spec, lod) => (builder.setLOD(lod), builder.build(spec)), topMaterial: () => builder.topM() }
      return new THREE.Mesh(bakeBody(THREE, builders, { type: type.name, decay: 1, seed: 3 }, 1).geo)
    },
  ])
}
for (const segments of [5, 8]) cases.push([`instanced/${segments}`, () => new THREE.Mesh(buildInstancedBody(THREE, { segments }))])

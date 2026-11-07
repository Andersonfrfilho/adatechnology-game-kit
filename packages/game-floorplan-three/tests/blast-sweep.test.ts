import { DEFAULT_BLAST_IMPULSE, sideOnOverpressure } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { wallPiece } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { THREE, houseOf, planOf } from './helpers/houses'

/**
 * A wall against charges and distances, read against the physics of the blast wave. Two scales of it: the peak side-on overpressure at the wall
 * (`sideOnOverpressure`, Kinney and Graham) says what the wave does to the face (under about 7 kPa nothing; from about 14 kPa plaster cracks and spalls,
 * Glasstone and Dolan table 5.139), and the scaled distance Z = R / W^(1/3) says whether a charge this close knocks the masonry out where it hits (a local
 * breach is a near-charge effect that scales with Z, about Z < 1 m/kg^(1/3) for a brick wall). Whether the infill between two pillars comes down as a panel is
 * read on the reflected pressure and impulse over that panel (`PANEL_PI` of game-destruction): 4.8 kg of TNT 4 m off (Z 2.37) brings it down, a hand grenade a
 * metre or more off only cracks it, and past Z 3.5 no brick comes out. The confined wall of the kit (pillars, bond beam, ground beam) fails where it is
 * hit, not as a whole: its pillars and bond beam stay unless they lose their supports.
 */
const CHARGES = [
  { name: 'M67', energy: 200_000 },
  { name: 'P13', energy: 1_000_000 },
  { name: 'TNT 1 MJ', energy: 1_000_000 },
  { name: 'TNT 2 MJ', energy: 2_000_000 },
  { name: 'TNT 4 MJ', energy: 4_000_000 },
] as const
const DISTANCES = [0.4, 1, 2, 4, 6, 10] as const
/** Reach of the blast passed to `explode`: past the farthest distance swept. */
const RADIUS = 15
/** Overpressure (Pa) under which nothing of the masonry moves, and over which the face shows the wave (plaster spalls and cracks). */
const NO_MASONRY = 7_000
const FACE_DAMAGE = 14_000
/** Scaled distances (m/kg^(1/3)) under which a charge knocks the masonry out where it hits, and over which it takes no brick out (the infill stands, cracked). */
const BREACH_Z = 1
const NO_BREACH_Z = 3.5
/** Scaled distance past which the wall as a whole (not one panel of its infill) never comes down. */
const WALL_STANDS_Z = 2
/** Scaled distance (m/kg^(1/3)) past which the frame (pillars, bond beam, ground beam) stands whole: 4.8 kg of TNT 4 m off (Z 2.37, 140 kPa) leaves every pillar up. */
const FRAME_STANDS_Z = 2
/** Closer than this scaled distance a charge may cut the member it is against, and only that one. */
const CONTACT_Z = 0.5
const STRUCTURE = /^(wall_column_|plate_|ground_beam_)/

type Outcome = { units: number; face: number; collapsed: boolean; structureLost: string[] }

type SpecPart = { id: string; position: [number, number, number]; shape: { kind: string; size?: [number, number, number] } }

/** The point `distance` metres out from the face of the wall, on the side away from the rest of the building, at chest height. */
const inFront = (spec: { parts: SpecPart[] }, wallId: string, distance: number): [number, number, number] => {
  const wall = spec.parts.find((part) => part.id === wallId)!
  const size = wall.shape.size ?? [1, 1, 1]
  const thin = size[0] < size[2] ? 0 : 2
  const rest = spec.parts.filter((part) => part.id !== 'ground').reduce((sum, part) => sum + part.position[thin]!, 0) / Math.max(1, spec.parts.length - 1)
  const out = wall.position[thin]! >= rest ? 1 : -1
  const point: [number, number, number] = [wall.position[0], 1.2, wall.position[2]]
  point[thin] = wall.position[thin]! + out * (size[thin]! / 2 + distance)
  return point
}

const blastOn = (spec: unknown, wallId: string, energy: number, distance: number): Outcome => {
  const world = createDestruction({ seed: 1 })
  const id = world.add(spec as never, { id: 'w' })
  const wall = world.state(id)!.parts.find((part) => part.id === wallId)!
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  world.explode(inFront(spec as { parts: SpecPart[] }, wallId, distance), energy, RADIUS)
  for (let t = 0; t < 3; t += 1 / 30) world.update(1 / 30)
  const units = events.filter((event) => event.type === 'chip' && event.part === wallId).reduce((sum, event) => sum + ((event as { units?: unknown[] }).units?.length ?? 1), 0)
  const face = events.filter((event) => (event.type === 'spall' || event.type === 'crack' || event.type === 'chip') && event.part === wallId).length
  const now = world.part(id, wallId)!
  const structureLost = world.state(id)!.parts.filter((part) => STRUCTURE.test(part.id) && (part.status === 'broken' || part.status === 'collapsed')).map((part) => part.id)
  return { units, face, collapsed: now.status === 'broken' || now.status === 'collapsed' || wall.status === 'collapsed', structureLost }
}

const sweep = (spec: unknown, wallId: string) =>
  CHARGES.flatMap((charge) =>
    DISTANCES.map((distance) => {
      const tnt = charge.energy * DEFAULT_BLAST_IMPULSE.tntPerJoule
      const pressure = sideOnOverpressure(tnt, distance)
      const z = distance / Math.cbrt(tnt)
      return { charge: charge.name, distance, kPa: Math.round(pressure / 100) / 10, pressure, z: Math.round(z * 100) / 100, ...blastOn(spec, wallId, charge.energy, distance) }
    }),
  )

const report = (rows: ReturnType<typeof sweep>): string =>
  ['carga | distância (m) | Z (m/kg^1/3) | pico (kPa) | blocos fora | marcas na face | parede caiu | estrutura perdida', ...rows.map((r) => `${r.charge} | ${r.distance} | ${r.z} | ${r.kPa} | ${r.units} | ${r.face} | ${r.collapsed ? 'sim' : 'não'} | ${r.structureLost.join(', ') || '-'}`)].join('\n')

describe('a confined brick wall against charges and distances, by the overpressure of the wave', () => {
  for (const [name, build] of [
    ['the target wall (wallPiece)', () => ({ spec: wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } }).spec, wallId: 'wall_0_0' })],
    ['a wall of a house', () => ({ spec: houseOf(planOf('casaA', 1)).house.structure.spec(), wallId: 'wall_0_0' })],
  ] as const) {
    it(`${name}: nothing comes out under ${NO_MASONRY / 1000} kPa, a charge closer than Z ${BREACH_Z} breaks the masonry out, the face shows the wave past ${FACE_DAMAGE / 1000} kPa, and the frame stands`, () => {
      const { spec, wallId } = build()
      const rows = sweep(spec, wallId)
      console.log(`${name}\n${report(rows)}`)
      for (const row of rows) {
        const at = `${row.charge} at ${row.distance} m (${row.kPa} kPa, Z ${row.z})`
        if (row.pressure < NO_MASONRY) expect(row.units, at).toBe(0)
        if (row.z < BREACH_Z) expect(row.units > 0, at).toBe(true)
        if (row.z > NO_BREACH_Z) expect(row.units, at).toBe(0)
        // a hand grenade a metre or more off only cracks the infill: its wave is too short to move a panel
        if (row.charge === 'M67' && row.distance >= 1) expect(row.units, at).toBe(0)
        // 4.8 kg of TNT 4 m off brings the infill between the pillars down; the frame around it stands
        if (row.charge === 'TNT 4 MJ' && row.distance === 4) {
          expect(row.units, at).toBeGreaterThan(100)
          expect(row.structureLost, at).toEqual([])
        }
        // past a local breach the wall as a whole stands: a blast in the air does not reach the ground beam in the soil, nor bring a confined wall down
        if (row.z > WALL_STANDS_Z) expect(row.collapsed, at).toBe(false)
        if (row.pressure > FACE_DAMAGE) expect(row.face > 0, at).toBe(true)
        // past a few metres a blast leaves the frame standing: the pillars and the bond beam on them stay, damaged where the wave takes their concrete
        if (row.z > FRAME_STANDS_Z) expect(row.structureLost, at).toEqual([])
        // nearer, the wave still loads each member whole: only a charge against one cuts it, and never more than that one
        if (row.z >= CONTACT_Z) expect(row.structureLost, at).toEqual([])
        else expect(row.structureLost.length, at).toBeLessThanOrEqual(1)
      }
      for (const charge of CHARGES) {
        const ofCharge = rows.filter((row) => row.charge === charge.name)
        for (let k = 1; k < ofCharge.length; k++) expect(ofCharge[k]!.units, `${charge.name}: ${ofCharge[k]!.distance} m against ${ofCharge[k - 1]!.distance} m`).toBeLessThanOrEqual(ofCharge[k - 1]!.units)
      }
    }, 600_000)
  }
})

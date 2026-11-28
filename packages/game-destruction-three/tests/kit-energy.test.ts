import * as THREE from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { KIT_RULE, KitEnergyLedger, fallEnergyOf, kineticEnergyOf } from '../src/kit-energy'
import type { KitEnergyOver } from '../src/kit-energy'
import type { PieceBody } from '../src/internal'
import { energyHeightOf } from './energy-ruler'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
const GRAVITY = 9.81
/** Seconds between one leg broken and the next, and after the last. */
const BETWEEN = 0.75
const AFTER = 2

/**
 * The sizes of the scale sweep (`broken-catalogue-spin`): how much a start down gives grows with how long a piece is for how wide, a nudge in rad/s with how tall it is, and a
 * rule written for a metre misbehaves at 30 cm.
 */
const SIZES: ReadonlyArray<readonly [string, number, number, number]> = [
  ['as drawn', 1, 1, 1],
  ['three times as long', 3, 1, 1],
  ['three times as deep', 1, 3, 1],
  ['three times as tall', 1, 1, 3],
  ['a third of its size', 0.3, 0.3, 0.3],
]

type Box = { readonly id: string; readonly size: readonly [number, number, number]; readonly at: readonly [number, number, number]; readonly kg: number; readonly foot?: true }

/** Leg (m square, m high) at (x, z), a foot. */
const leg = (id: string, x: number, z: number, side: number, height: number): Box => ({ id, size: [side, height, side], at: [x, height / 2, z], kg: 1.5, foot: true })

/**
 * Furniture standing on feet, drawn as boxes (each a part of its own), in the proportions of the catalogue: what the rules start down when it loses a foot or the floor under
 * one. The table 4.4 m long and 46 cm deep is the one of the room that went over at 19.5 rad/s.
 */
const FURNITURE: Record<string, readonly Box[]> = {
  table: [{ id: 'top', size: [1.6, 0.04, 0.8], at: [0, 0.76, 0], kg: 12 }, ...[0, 1, 2, 3].map((i) => leg(`leg_${i}`, i & 1 ? 0.75 : -0.75, i & 2 ? 0.35 : -0.35, 0.05, 0.74))],
  long_table: [{ id: 'top', size: [4.4, 0.04, 0.46], at: [0, 0.76, 0], kg: 30 }, ...[0, 1, 2, 3].map((i) => leg(`leg_${i}`, i & 1 ? 2.15 : -2.15, i & 2 ? 0.2 : -0.2, 0.05, 0.74))],
  bed: [{ id: 'frame', size: [2, 0.35, 1.4], at: [0, 0.425, 0], kg: 60 }, ...[0, 1, 2, 3].map((i) => leg(`leg_${i}`, i & 1 ? 0.95 : -0.95, i & 2 ? 0.65 : -0.65, 0.05, 0.25))],
  stool: [
    { id: 'seat', size: [0.36, 0.03, 0.36], at: [0, 0.465, 0], kg: 1.5 },
    leg('leg_0', 0.15, 0, 0.03, 0.45),
    leg('leg_1', -0.075, 0.13, 0.03, 0.45),
    leg('leg_2', -0.075, -0.13, 0.03, 0.45),
  ],
  bench: [{ id: 'top', size: [1.6, 0.04, 0.8], at: [0, 0.76, 0], kg: 12 }, ...[0, 1, 2, 3, 4, 5].map((i) => leg(`leg_${i}`, [-0.75, 0, 0.75][i % 3] as number, i < 3 ? -0.35 : 0.35, 0.05, 0.74))],
  bookcase: [
    { id: 'side_0', size: [0.02, 1.8, 0.35], at: [-0.39, 0.9, 0], kg: 6, foot: true },
    { id: 'side_1', size: [0.02, 1.8, 0.35], at: [0.39, 0.9, 0], kg: 6, foot: true },
    ...[0, 1, 2, 3].map((i): Box => ({ id: `shelf_${i}`, size: [0.76, 0.02, 0.35], at: [0, 0.1 + i * 0.5, 0], kg: 4 })),
  ],
}

/**
 * What already made energy when this test was written (2026-11-28), by size, rule, piece and scenario, with the share of the piece's fall it gave then (given / fall,
 * rounded up). The list only shrinks and no line gets worse: a rule fixed takes its line out, and a case giving more than it did fails like a new one. Each is a decision of
 * the owner, since the fix changes how the rule looks (spec 021):
 * - three times as tall, the long table: it went over earlier and lies on its side when the next leg breaks; `goOverIfBalanced` places its push from the centre of the drawn
 *   boxes (`centreOfBoxes`), 1.08 m from the middle of the piece's box that the impulse turns it about, so the arm is 2.25 m where its reach is 1.17 m.
 * - a third of its size, the bed: `UNDERMINED_PUSH` is a speed (0.6 m/s) whatever the size, so what it gives over the fall of the piece grows as 1 / size (0.53 of the fall at
 *   full size, 1.8 at a third), in `goOverIfBalanced` and in `checkUndermined` alike.
 */
const KNOWN: ReadonlyMap<string, number> = new Map([
  ['three times as tall · goOverIfBalanced: long_table, a piece losing its feet one by one', 2.0],
  ['a third of its size · goOverIfBalanced: bed, a piece losing its feet one by one', 1.98],
  ['a third of its size · checkUndermined: bed, standing, the floor going from under one foot', 1.78],
])

type Scenario = 'a piece losing its feet one by one' | 'standing, losing one foot' | 'standing, the floor going from under one foot'
const SCENARIOS: readonly Scenario[] = ['a piece losing its feet one by one', 'standing, losing one foot', 'standing, the floor going from under one foot']

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += STEP) renderer.update(STEP)
}

/** One piece of furniture at one size through one scenario: what each rule gave over the fall of the piece it pushed, and the pushes each made. */
function measure(type: string, scale: readonly [number, number, number], scenario: Scenario): { overs: KitEnergyOver[]; pushes: Map<string, number> } {
  const [wide, tall, deep] = scale
  const boxes = (FURNITURE[type] as readonly Box[]).map((box): Box => {
    // a leg keeps its section as the piece stretches; it shrinks with the whole
    const isLeg = box.foot && box.size[0] === box.size[2]
    const across = Math.min(wide, deep, 1)
    const size: [number, number, number] = isLeg ? [box.size[0] * across, box.size[1] * tall, box.size[2] * across] : [box.size[0] * wide, box.size[1] * tall, box.size[2] * deep]
    return { ...box, size, at: [box.at[0] * wide, box.at[1] * tall, box.at[2] * deep], kg: box.kg * wide * tall * deep }
  })
  const foot = boxes.find((box) => box.foot) as Box
  const hole = { x: foot.at[0], z: foot.at[2], radius: Math.max(foot.size[0], foot.size[2]) * 1.5 }
  let dug = false
  const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - hole.x, z - hole.z) < hole.radius ? -0.5 : 0)
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const overs: KitEnergyOver[] = []
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt, onKitEnergy: (over) => overs.push(over) })
  world.addObject(type, boxes.map((box) => partState(box.id, 'wood', { mass: box.kg })))
  const root = new THREE.Group()
  const meshes = new Map(boxes.map((box) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...box.size))
    mesh.position.set(...box.at)
    root.add(mesh)
    return [box.id, mesh] as const
  }))
  markKitOrigin(root, { owner: 'test', kind: 'furniture', id: type })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(type, root, { parts: Object.fromEntries(meshes) })
  const breakPart = (box: Box): void => {
    const part = world.part(type, box.id)
    if (part) part.status = 'broken'
    world.emit({ type: 'fracture', object: type, part: box.id, point: [box.at[0], box.at[1], box.at[2]], style: 'splinter', fragments: [] })
  }
  const feet = boxes.filter((box) => box.foot)
  if (scenario === 'a piece losing its feet one by one') {
    renderer.makePiece(type)
    run(renderer, 1)
    for (const one of feet) {
      breakPart(one)
      run(renderer, BETWEEN)
    }
  } else if (scenario === 'standing, losing one foot') {
    run(renderer, 0.5)
    breakPart(foot)
  } else {
    run(renderer, 0.5)
    dug = true
    renderer.wakeRegion(hole.x, hole.z, hole.radius)
  }
  run(renderer, AFTER)
  return { overs, pushes: new Map(renderer.kitEnergy().map((tally) => [tally.rule, tally.pushes])) }
}

describe('no rule of the kit gives a piece more energy than its own fall', () => {
  it('the ledger measures a write with the ruler of spec 008: kinetic energy over m g is the energy height above the centre', () => {
    const body = {
      objectId: 'box',
      mass: 7,
      halfExtents: [0.4, 0.1, 0.25],
      velocity: [0.3, -1.2, 0.5],
      angularVelocity: [2, -1, 3],
      root: new THREE.Object3D(),
    } as unknown as PieceBody
    body.root.quaternion.setFromEuler(new THREE.Euler(0.3, 1.1, -0.4))
    const q = body.root.quaternion.clone().invert()
    const local = new THREE.Vector3(...body.angularVelocity).applyQuaternion(q)
    const height = energyHeightOf({ centreY: 0, velocity: [0.3, -1.2, 0.5], bodyAngularVelocity: [local.x, local.y, local.z], halfExtents: [0.4, 0.1, 0.25] })
    expect(kineticEnergyOf(body) / (body.mass * GRAVITY)).toBeCloseTo(height, 9)
    // standing on its thinnest side it has nothing left to fall; on end, from 40 cm to 10 cm
    body.root.quaternion.identity()
    expect(fallEnergyOf(body)).toBeCloseTo(0, 9)
    body.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    expect(fallEnergyOf(body)).toBeCloseTo(7 * GRAVITY * 0.3, 9)
  })

  it('a give over the fall is counted and told once per episode, and nothing is cut', () => {
    const told: KitEnergyOver[] = []
    const ledger = new KitEnergyLedger((over) => told.push(over))
    const body = { objectId: 'plank', mass: 2, halfExtents: [1, 0.02, 0.1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], root: new THREE.Object3D() } as unknown as PieceBody
    body.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    const fall = fallEnergyOf(body)
    for (let i = 0; i < 3; i++) {
      ledger.begin(body)
      body.angularVelocity[2] += 5
      ledger.end(KIT_RULE.TOPPLE, body)
    }
    expect(body.angularVelocity[2]).toBe(15)
    const topple = ledger.tally().find((tally) => tally.rule === KIT_RULE.TOPPLE)
    expect(topple?.pushes).toBe(3)
    expect(topple?.overs).toBe(1)
    expect(told).toHaveLength(1)
    expect(told[0]?.given).toBeGreaterThan(fall)
    expect(told[0]?.fall).toBeCloseTo(fall, 9)
  })

  // what the rules gave, case by case: a rule that names a piece here made energy the piece did not have
  it.each(SIZES)('%s: furniture losing its feet or its floor is only started down by the rules', (size, wide, deep, tall) => {
    const made: string[] = []
    const known: string[] = []
    const pushed = new Map<string, number>()
    for (const type of Object.keys(FURNITURE)) {
      for (const scenario of SCENARIOS) {
        const { overs, pushes } = measure(type, [wide, tall, deep], scenario)
        for (const over of overs) {
          const key = `${size} · ${over.rule}: ${type}, ${scenario}`
          if (over.given / over.fall <= (KNOWN.get(key) ?? 0)) known.push(key)
          else made.push(`${key}: gave ${over.given.toFixed(3)} J, its fall ${over.fall.toFixed(3)} J`)
        }
        for (const [rule, count] of pushes) pushed.set(rule, (pushed.get(rule) ?? 0) + count)
      }
    }
    expect(made).toEqual([])
    // a line of KNOWN that no longer makes energy comes out of it
    expect(new Set(known), 'KNOWN only shrinks').toEqual(new Set([...KNOWN.keys()].filter((key) => key.startsWith(`${size} · `))))
    // the cases do reach the rules they guard: a sweep that pushes nothing proves nothing
    for (const rule of Object.values(KIT_RULE)) expect(pushed.get(rule), rule).toBeGreaterThan(0)
  })
})

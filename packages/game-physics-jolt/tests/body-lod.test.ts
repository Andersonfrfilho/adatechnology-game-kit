import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { createCorpseLedger } from '@adatechnology/game-characters'
import type { BodyId, Quat, SettledCorpse, Vec3 } from '@adatechnology/game-physics'

import { report, stats } from './scenes'
import type { Scene } from './lod-scenes'
import { allAsleep, C7_BODIES, C7_PILE, frame, heapAt, kit, PEAK_MS, pileOf, sceneOf, scatter, seconds, torsoOf } from './lod-scenes'

const FRAMES_3S = 180

/** The hash `rungHash` makes, from a saved state (the same FNV over ids in order and rung codes). */
const rungHashOf = (state: { readonly records: ReadonlyArray<{ readonly id: number; readonly rung: string }> }): number => {
  const codes: Record<string, number> = { r0: 0, r1: 1, r2: 2, r2f: 3, r3: 4 }
  let hash = 0x811c9dc5
  for (const record of [...state.records].sort((a, b) => a.id - b.id)) {
    hash = Math.imul(hash ^ record.id, 0x01000193) >>> 0
    hash = Math.imul(hash ^ (codes[record.rung] as number), 0x01000193) >>> 0
  }
  return hash
}

describe('body LOD, T5.4 tests of design/pilha-e-lod.md §7', () => {
  it('1. 100 bodies falling against a wall in the KIT_WORLD: no ragdoll in the pile, asleep in 10 s, the step inside the C7 of a pile', { timeout: 120000 }, async () => {
    const scene = await sceneOf({}, true)
    const ids = Array.from({ length: 100 }, (_, i) => i + 1)
    for (const id of ids) scene.corpses.add({ id, kit, position: heapAt(id - 1), yaw: id * 0.7 })
    const costs: number[] = []
    let asleepAt = -1
    let ragdollInPile = 0
    const owners = new Map<BodyId, number>()
    for (let f = 0; f < 600; f++) {
      costs.push(frame(scene.loop))
      if (f % 6 !== 0) continue
      owners.clear()
      for (const id of ids) for (const body of scene.corpses.partsOf(id)) owners.set(body, id)
      for (const id of ids.filter((candidate) => scene.corpses.rungOf(candidate) === 'r0')) {
        const touching = new Set<number>()
        for (const body of scene.corpses.partsOf(id)) {
          const found: BodyId[] = []
          scene.world.contactBodies(body, found)
          for (const other of found) if (owners.has(other) && owners.get(other) !== id) touching.add(owners.get(other) as number)
        }
        if (touching.size >= 2) ragdollInPile++
      }
      if (asleepAt < 0 && allAsleep(scene, ids)) asleepAt = f / 60
    }
    report('lod-pile-100', { asleepAtS: asleepAt, first3s: stats(costs.slice(0, FRAMES_3S)), all: stats(costs), counts: scene.corpses.counts(), ragdollInPile })
    expect(ragdollInPile).toBeLessThanOrEqual(1)
    expect(asleepAt).toBeGreaterThan(0)
    expect(asleepAt).toBeLessThanOrEqual(10)
    expect(stats(costs.slice(0, FRAMES_3S)).median).toBeLessThanOrEqual(C7_PILE.median)
    expect(stats(costs.slice(0, FRAMES_3S)).p99).toBeLessThanOrEqual(C7_PILE.p99)
    scene.world.dispose()
  })

  it('2. 20 dead bodies in the KIT_WORLD with the production quota (1 ragdoll, the rest chains): median and p99 inside the C7', { timeout: 120000 }, async () => {
    const scene = await sceneOf()
    for (let id = 1; id <= 20; id++) scene.corpses.add({ id, kit, position: [(id % 5) * 0.9, 0.5 + Math.floor(id / 5) * 0.6, (id % 3) * 0.4], yaw: id })
    const costs: number[] = []
    for (let f = 0; f < 600; f++) costs.push(frame(scene.loop))
    const window = stats(costs.slice(0, FRAMES_3S))
    report('lod-bodies-20', { first3s: window, counts: scene.corpses.counts() })
    expect(scene.corpses.counts().r0).toBeLessThanOrEqual(1)
    expect(window.median).toBeLessThanOrEqual(C7_BODIES.median)
    expect(window.p99).toBeLessThanOrEqual(C7_BODIES.p99)
    scene.world.dispose()
  })

  it('3. a horde walking over a sleeping pile: the pile keeps sleeping', { timeout: 120000 }, async () => {
    const scene = await sceneOf({}, true)
    const ids = pileOf(scene, 100)
    expect(allAsleep(scene, ids)).toBe(true)
    const agents = Array.from({ length: 200 }, (_, i) =>
      scene.world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'kinematic', position: [-9, 0.85, 0.5 + (i % 10) * 0.2], layer: 'agent', user: 1000 + i }),
    )
    let awake = 0
    for (let f = 0; f < 600; f++) {
      for (const [i, agent] of agents.entries()) scene.world.moveKinematic(agent, [-9 + (f / 60) * 1.8 + Math.floor(i / 10) * 0.05, 0.85, 0.5 + (i % 10) * 0.2], [0, 0, 0, 1], 1 / 60)
      scene.loop.step(1 / 60)
      if (!allAsleep(scene, ids)) awake++
    }
    report('lod-horde-over-pile', { framesWithACorpseAwake: awake, counts: scene.corpses.counts() })
    expect(awake).toBe(0)
    scene.world.dispose()
  })

  it('4. a new death on a sleeping pile of 100: the frame stays under condition 10 and the pile sleeps again in 3 s', { timeout: 120000 }, async () => {
    const scene = await sceneOf({}, true)
    const ids = pileOf(scene, 100)
    expect(allAsleep(scene, ids)).toBe(true)
    expect(scene.corpses.counts().r2f).toBeGreaterThan(0)
    let top = 0
    for (const id of ids) top = Math.max(top, torsoOf(scene, id)[1])
    scene.corpses.add({ id: 101, kit, position: [0, top + 0.1, 0.9], yaw: 0.3 })
    const costs: number[] = []
    let asleepAt = -1
    for (let f = 0; f < 60 * 6; f++) {
      costs.push(frame(scene.loop))
      if (asleepAt < 0 && f > 30 && allAsleep(scene, [...ids, 101])) asleepAt = f / 60
    }
    report('lod-death-on-pile', { peak: Math.max(...costs), frames: stats(costs), asleepAtS: asleepAt, counts: scene.corpses.counts() })
    expect(Math.max(...costs)).toBeLessThanOrEqual(PEAK_MS)
    expect(asleepAt).toBeGreaterThan(0)
    expect(asleepAt).toBeLessThanOrEqual(3)
    scene.world.dispose()
  })

  it('5. 100 chains to capsules and back: under 5 ms each way, nothing inside anything, nothing under the ground, the torso within 2 cm', { timeout: 120000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 0 } })
    const ids = scatter(scene, 100)
    seconds(scene.loop, 8)
    expect(allAsleep(scene, ids)).toBe(true)
    const before = new Map(ids.map((id) => [id, torsoOf(scene, id)]))
    const away = (id: number): number => Math.hypot(...(torsoOf(scene, id).map((x, k) => x - (before.get(id) as Vec3)[k]) as [number, number, number]))
    const timed = (rung: 'r1' | 'r2'): { ms: number; refused: number } => {
      const started = performance.now()
      let refused = 0
      for (const id of ids) if (!scene.corpses.changeRung(id, rung)) refused++
      return { ms: performance.now() - started, refused }
    }
    // five round trips: the first is cold (the code is not compiled yet), and a loaded machine spoils one: the median of five is the number
    const downs: number[] = []
    const ups: number[] = []
    let refused = 0
    let worstDepth = 0
    let overlaps = 0
    let drift = 0
    const depth = new Float64Array(3)
    const found: BodyId[] = []
    for (let trip = 0; trip < 5; trip++) {
      const down = timed('r2')
      downs.push(down.ms)
      refused += down.refused
      for (const id of ids) {
        const capsule = scene.corpses.partsOf(id)[0] as BodyId
        worstDepth = Math.max(worstDepth, scene.world.penetration(capsule, depth))
        const pose = new Float64Array(7)
        scene.world.readPose(capsule, pose, 0)
        scene.world.overlapShape(kit.capsule.shape, [pose[0] as number, pose[1] as number, pose[2] as number], [pose[3] as number, pose[4] as number, pose[5] as number, pose[6] as number], found, { layers: ['corpse'], ignore: [capsule] })
        overlaps += found.length > 0 ? 1 : 0
      }
      drift = Math.max(drift, ...ids.map(away))
      const up = timed('r1')
      ups.push(up.ms)
      refused += up.refused
      drift = Math.max(drift, ...ids.map(away))
    }
    const down = { ms: stats(downs).median, refused }
    const up = { ms: stats(ups).median, refused: 0 }
    const driftDown = drift
    const driftUp = drift
    report('lod-swap-100', { toCapsuleMs: stats(downs), toChainMs: stats(ups), refused, worstDepthM: worstDepth, overlaps, driftM: drift, counts: scene.corpses.counts() })
    expect(down.refused + up.refused).toBe(0)
    expect(down.ms).toBeLessThanOrEqual(5)
    expect(up.ms).toBeLessThanOrEqual(5)
    expect(overlaps).toBe(0)
    expect(worstDepth).toBeLessThanOrEqual(0.03)
    expect(driftDown).toBeLessThanOrEqual(0.02)
    expect(driftUp).toBeLessThanOrEqual(0.02)
    scene.world.dispose()
  })

  it('6. a body pushed 3 m goes down to nothing and back: no teleport, and the host is told where it lies', { timeout: 120000 }, async () => {
    const told: SettledCorpse[] = []
    let player: Vec3 = [0, 0, 0]
    const scene = await sceneOf({ lod: { ragdollsMax: 0 }, interest: () => [player], onSettled: (corpse) => told.push(corpse) })
    scene.corpses.add({ id: 1, kit, position: [0, 0.05, 0], yaw: 0 })
    seconds(scene.loop, 5)
    expect(told).toHaveLength(0)
    for (const body of scene.corpses.partsOf(1)) scene.world.setVelocity(body, [8, 0, 0], [0, 0, 0])
    seconds(scene.loop, 6)
    const lies = torsoOf(scene, 1)
    expect(allAsleep(scene, [1])).toBe(true)
    expect(lies[0]).toBeGreaterThan(2)
    expect(told).toHaveLength(1)
    expect(Math.hypot((told[0] as SettledCorpse).x - lies[0], (told[0] as SettledCorpse).z - lies[2])).toBeLessThan(0.05)
    player = [100, 0, 0]
    seconds(scene.loop, 8)
    expect(scene.corpses.rungOf(1)).toBe('r3')
    const stored = torsoOf(scene, 1)
    player = [lies[0] + 60, 0, 0]
    seconds(scene.loop, 3)
    expect(scene.corpses.rungOf(1)).toBe('r2')
    const back = torsoOf(scene, 1)
    expect(Math.hypot(back[0] - stored[0], back[1] - stored[1], back[2] - stored[2])).toBeLessThan(0.02)
    expect(Math.hypot(back[0] - lies[0], back[2] - lies[2])).toBeLessThan(0.05)
    expect(told).toHaveLength(1)
    scene.world.dispose()
  })

  it('7. eaten, expired or pushed out with a body on top: the one on top falls and settles', { timeout: 180000 }, async () => {
    // both lie asleep, flat, one on the other: the capsule of the one below is 34 cm thick and the one above rests on it
    const flat: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]
    for (const how of ['eaten', 'expired', 'pushed out'] as const) {
      for (const frozen of [false, true]) {
        const scene = await sceneOf({ lod: { ragdollsMax: 0 } })
        const ledger = createCorpseLedger<number>({ max: how === 'pushed out' ? 3 : 4, seconds: 30 })
        ledger.subscribe(scene.corpses.follower)
        const lay = (at: number, torso: Vec3): number => {
          ledger.add(at)
          const id = (ledger.entries.find((entry) => entry.data === at) as { id: number }).id
          scene.corpses.addLying({ id, kit, torso: { position: torso, rotation: flat }, rung: 'r2' })
          return id
        }
        const below = lay(1, [0, 0.17, 0])
        const above = lay(2, [0, 0.52, 0])
        if (frozen) scene.corpses.changeRung(above, 'r2f')
        seconds(scene.loop, 3)
        const sitting = torsoOf(scene, above)[1]
        expect(sitting).toBeGreaterThan(0.45)
        expect(scene.corpses.rungOf(above)).toBe(frozen ? 'r2f' : 'r2')
        if (how === 'eaten') ledger.remove(ledger.entries.findIndex((entry) => entry.id === below))
        else if (how === 'expired') {
          ledger.entries.forEach((entry) => (entry.age = entry.id === below ? 29.5 : 0))
          ledger.update(1)
        } else {
          // two more fill the ledger, the oldest (the one below) is pushed out
          lay(3, [8, 0.17, 8])
          lay(4, [10, 0.17, 8])
        }
        expect(scene.corpses.rungOf(below)).toBeUndefined()
        expect(scene.corpses.rungOf(above)).toBeDefined()
        seconds(scene.loop, 6)
        const settledAt = torsoOf(scene, above)[1]
        report(`lod-support-lost-${how}${frozen ? '-frozen' : ''}`, { before: sitting, after: settledAt, rung: scene.corpses.rungOf(above), counts: scene.corpses.counts() })
        expect(settledAt).toBeLessThan(sitting - 0.2)
        expect(settledAt).toBeLessThan(0.25)
        expect(allAsleep(scene, [above])).toBe(true)
        scene.world.dispose()
      }
    }
  })

  it('8. the quota: with the ragdolls full a new death makes the farthest sleeping ragdoll a chain, and with none asleep it is born a chain', { timeout: 60000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 3 }, interest: () => [[0, 0, 0]] })
    const at = (id: number): Vec3 => [id * 4 - 8, 0.05, 0]
    for (const id of [1, 2, 3]) expect(scene.corpses.add({ id, kit, position: at(id), yaw: 0 })).toBe('r0')
    expect(scene.corpses.add({ id: 4, kit, position: [0, 0.05, 6], yaw: 0 })).toBe('r1')
    seconds(scene.loop, 6)
    expect(allAsleep(scene, [1, 2, 3])).toBe(true)
    // ids 1, 2, 3 lie at x = -4, 0, 4: the farthest from the player at the origin are 1 and 3 (4 m each, the lowest id of the two goes)
    expect(scene.corpses.add({ id: 5, kit, position: [0, 0.05, -6], yaw: 0 })).toBe('r0')
    expect(scene.corpses.rungOf(1)).toBe('r1')
    expect(scene.corpses.rungOf(2)).toBe('r0')
    expect(scene.corpses.rungOf(3)).toBe('r0')
    expect(scene.corpses.counts().r0).toBe(3)
    scene.world.dispose()
  })

  it('9. hysteresis: a body going back and forth over a rung edge changes at most once a second', { timeout: 120000 }, async () => {
    // a chain that sleeps, woken every 3 s, with the player going back and forth over the 50 and 55 m edges every 6 s
    let player: Vec3 = [0, 0, 0]
    const scene = await sceneOf({ lod: { ragdollsMax: 0 }, interest: () => [player] })
    scene.corpses.add({ id: 1, kit, position: [0, 0.05, 0], yaw: 0 })
    seconds(scene.loop, 6)
    const changes: number[] = []
    let last = scene.corpses.rungOf(1)
    for (let f = 0; f < 60 * 60; f++) {
      const t = f / 60
      player = [52.5 + 6 * Math.sin((t * Math.PI) / 3), 0, 0]
      if (f % 180 === 0) for (const body of scene.corpses.partsOf(1)) scene.world.wake(body)
      scene.loop.step(1 / 60)
      const now = scene.corpses.rungOf(1)
      if (now !== last) changes.push(t)
      last = now
    }
    const gaps = changes.slice(1).map((time, index) => time - (changes[index] as number))
    report('lod-hysteresis', { changes: changes.length, quickestGapS: Math.min(...gaps) })
    expect(changes.length).toBeGreaterThan(3)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1)
    scene.world.dispose()
  })

  it('10. the same rungs and poses at 60, 120 and 144 frames a second', { timeout: 180000 }, async () => {
    const hashes: string[] = []
    for (const dt of [1 / 60, 1 / 120, 1 / 144]) {
      const held: { scene?: Scene } = {}
      // the player walks away along x at 14 m/s, sampled in each fixed step: rungs go down by distance and some come back
      const born = await sceneOf({ lod: { ragdollsMax: 2 }, interest: () => [[(held.scene as Scene).loop.frame.time * 14 - 30, 0, 0]] })
      held.scene = born
      const ids = scatter(born, 40)
      let steps = 0
      born.loop.add({
        beforeStep: () => {
          steps++
          if (steps === 600) born.corpses.add({ id: 101, kit, position: [-5, 0.05, 20], yaw: 1 })
          if (steps === 900) born.corpses.remove(7)
        },
      }, 'crowd')
      let total = 0
      while (total < 1440) {
        born.loop.step(dt)
        total += born.loop.frame.steps
      }
      const poses = [...ids, 101].filter((id) => born.corpses.rungOf(id) !== undefined).flatMap((id) => torsoOf(born, id).map((x) => Math.round(x * 1e6)))
      hashes.push(`${born.corpses.rungHash()}|${poses.join(',')}|${JSON.stringify(born.corpses.counts())}`)
      born.world.dispose()
    }
    report('lod-determinism', { rungHash: hashes.map((hash) => hash.split('|')[0]), counts: hashes.map((hash) => hash.split('|')[2]) })
    expect(hashes[1]).toBe(hashes[0])
    expect(hashes[2]).toBe(hashes[0])
    expect(hashes[0]?.split('|')[2]).not.toContain('"r1":40')
  })

  it('11. save and load after 200 changes: the world and the corpses come back to the same bytes and run on to the same bytes', { timeout: 120000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 0 } })
    const ids = scatter(scene, 100)
    seconds(scene.loop, 8)
    let changes = 0
    for (const rung of ['r2', 'r1'] as const) for (const id of ids) if (scene.corpses.changeRung(id, rung)) changes++
    expect(changes).toBe(200)
    const worldSaved = scene.world.saveState()
    const corpsesSaved = scene.corpses.saveState()
    const run = (): string => {
      scene.loop.stepFixed(120)
      return `${createHash('sha256').update(scene.world.saveState()).digest('hex')}:${JSON.stringify(scene.corpses.saveState())}`
    }
    const first = run()
    expect(scene.corpses.rungHash()).toBe(rungHashOf(corpsesSaved))
    expect(scene.world.restoreState(worldSaved)).toBe(true)
    expect(scene.corpses.restoreState(corpsesSaved)).toBe(true)
    expect(Buffer.from(scene.world.saveState()).equals(Buffer.from(worldSaved))).toBe(true)
    expect(JSON.stringify(scene.corpses.saveState())).toBe(JSON.stringify(corpsesSaved))
    expect(run()).toBe(first)
    scene.world.dispose()
  })

  it('12. cycles of changes, freezing and removal give the heap back to the same byte', { timeout: 120000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 0 } })
    let next = 1
    const cycle = (): void => {
      const ids = scatter(scene, 10, next)
      next += 10
      seconds(scene.loop, 1)
      for (const id of ids) scene.corpses.changeRung(id, 'r2')
      for (const id of ids) scene.corpses.changeRung(id, 'r1')
      for (const id of ids.slice(0, 4)) scene.corpses.changeRung(id, 'r2f')
      scene.loop.stepFixed(10)
      for (const id of ids) scene.corpses.changeRung(id, 'r3')
      for (const id of ids) scene.corpses.remove(id)
    }
    for (let i = 0; i < 3; i++) cycle()
    const settled = scene.world.memoryInUse()
    for (let i = 0; i < 12; i++) cycle()
    report('lod-heap', { settled, after: scene.world.memoryInUse(), counts: scene.corpses.counts() })
    expect(scene.world.memoryInUse()).toBe(settled)
    expect(scene.corpses.counts().rigidBodies).toBe(0)
    expect(scene.world.bodyCount).toBeLessThanOrEqual(2)
    scene.world.dispose()
  })

  it('the rigid body quota: past `dynamicBodiesMax` the farthest sleepers go down a rung until it fits', { timeout: 120000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 0, dynamicBodiesMax: 150 }, interest: () => [[0, 0, 0]] })
    scatter(scene, 60)
    // all of them fall at first and none sleeps: the quota takes only sleepers
    expect(scene.corpses.counts().rigidBodies).toBe(180)
    seconds(scene.loop, 10)
    const counts = scene.corpses.counts()
    report('lod-quota-bodies', { ...counts })
    expect(counts.rigidBodies).toBeLessThanOrEqual(150)
    expect(counts.r2 + counts.r3).toBeGreaterThan(0)
    scene.world.dispose()
  })

  it('the island quota: a heap past `islandBodiesMax` has its oldest sleepers frozen into the pile', { timeout: 120000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 0, islandBodiesMax: 60 } }, true)
    for (let id = 1; id <= 40; id++) scene.corpses.add({ id, kit, position: heapAt(id - 1), yaw: id * 0.7 })
    seconds(scene.loop, 20)
    const counts = scene.corpses.counts()
    report('lod-quota-island', { ...counts })
    expect(counts.r2f).toBeGreaterThan(0)
    expect(counts.rigidBodies).toBeLessThan(120)
    scene.world.dispose()
  })

  it('the default quota of 900 rigid bodies: 300 chains asleep cost the policy next to nothing, and the quota holds', { timeout: 180000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 0 } })
    const ids = Array.from({ length: 300 }, (_, i) => i + 1)
    for (const id of ids) scene.corpses.add({ id, kit, position: [((id - 1) % 20) * 3 - 30, 0.05, Math.floor((id - 1) / 20) * 3 - 22], yaw: id })
    const falling: number[] = []
    for (let f = 0; f < 60 * 3; f++) falling.push(frame(scene.loop))
    seconds(scene.loop, 8)
    expect(allAsleep(scene, ids)).toBe(true)
    const asleep: number[] = []
    for (let f = 0; f < 60 * 3; f++) asleep.push(frame(scene.loop))
    report('lod-bodies-300', { rigid: scene.corpses.counts().rigidBodies, falling3s: stats(falling), asleep3s: stats(asleep) })
    expect(scene.corpses.counts().rigidBodies).toBeLessThanOrEqual(900)
    expect(stats(asleep).median).toBeLessThanOrEqual(0.5)
    scene.world.dispose()
  })
})

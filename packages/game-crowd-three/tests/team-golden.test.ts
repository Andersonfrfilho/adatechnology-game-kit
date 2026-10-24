import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createStore } from '@adatechnology/game-crowd'
import type { Civilian, CivilianState, Corpse, CrowdPack } from '@adatechnology/game-crowd'
import { createEventRecorder } from '@adatechnology/golden-tool'
import type { EventValue, GoldenEvent, GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createCrowdInstances } from '../src'
import type { CrowdInstance } from '../src'

const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures/team-golden/game-crowd-render.json'), 'utf8')) as GoldenRecord
const pack = undeadCrowdPack() as unknown as CrowdPack

/** The game field each packed number of an agent is, and the SDK store's name for it (the order of the harness's `RENDER_AGENT_FIELDS`). */
const AGENT_FIELDS = [
  ['x', 'x'],
  ['z', 'z'],
  ['ry', 'renderYaw'],
  ['ph', 'phase'],
  ['h', 'height'],
  ['b', 'build'],
  ['rs', 'renderSpeed'],
  ['st', 'state'],
  ['stT', 'stateTimer'],
  ['miss', 'missing'],
  ['age', 'age'],
  ['arm', 'arms'],
  ['skin', 'skin'],
  ['col', 'color'],
  ['cat', 'type'],
  ['y', 'y'],
  ['crawl', 'crawl'],
  ['vr', 'variant'],
  ['lod', 'lod'],
  ['ap', 'attackPose'],
] as const
const CIVILIAN_STATES: readonly CivilianState[] = ['home', 'walking', 'group', 'fleeing', 'gone', 'dead', 'undead']
/** Each level's batch holds as many as the game's (G ZVAR 160, 700, 2600; CB 400 at the middle body; PB 4). */
const CAPACITY = [160, 700, 2600] as const
/** The golden's fixed variant sizes (the bake is the drawing's): the same formula as the harness's `RENDER_VARIANT`. */
const variantCount = pack.types.reduce((sum, type) => sum + (type.variants ?? 1), 0)
const variants = Array.from({ length: variantCount }, (_, g) => ({ s: 1.6 + (g % 5) * 0.03, bulk: 0.9 + (g % 3) * 0.05 }))

const rows = (text: string): number[][] => (text ? text.split(';').map((row) => row.split(',').map(Number)) : [])

type Push = { v: number; l: number; n: number[]; color: number; shade: number; eye: number | null; y: number }
const pushOf = (v: number, l: number, instance: CrowdInstance): Push => ({ v, l, n: [...instance.a, ...instance.b, ...instance.c], color: instance.color, shade: instance.shade, eye: instance.eye, y: instance.y })

const replay = (event: GoldenEvent): GoldenEvent => {
  const data = event.data as Record<string, string>
  const agents = rows(data.agents!)
  const Z = createStore(Math.max(1, agents.length))
  agents.forEach((row, i) => AGENT_FIELDS.forEach(([, field], k) => void ((Z[field] as { [i: number]: number })[i] = row[k]!)))
  Z.n = agents.length
  const [cx, cz] = data.camera!.split(',').map(Number) as [number, number]
  const [tx, tz, alive] = data.target!.split(',').map(Number) as [number, number, number]
  const frame = { camera: { x: cx, z: cz }, viewYaw: Number(data.viewYaw), target: { x: tx, z: tz, alive: alive === 1 } }
  const instances = createCrowdInstances({ eyes: pack.types.map((type) => type.eye ?? null) })
  const out: Push[] = []
  const counts = new Map<string, number>()
  const take = (v: number, l: number, max: number, instance: CrowdInstance): void => {
    const key = `${v}:${l}`
    const n = counts.get(key) ?? 0
    if (n >= max) return
    counts.set(key, n + 1)
    out.push(pushOf(v, l, instance))
  }
  instances.agents(Z, variants, frame, (v, l, instance) => take(v, l, CAPACITY[l as 0 | 1 | 2], instance))
  const corpses = rows(data.corpses!).map(([x, z, yaw, seed, h, b, t, miss, skin, col, vr]) => ({ age: t!, data: { x: x!, z: z!, yaw: yaw!, seed: seed!, height: h!, build: b!, missing: miss!, skin: skin!, color: col!, variant: vr!, named: -1 } satisfies Corpse }))
  instances.corpses(corpses, variants, frame, 900, (v, l, instance) => take(v, l, CAPACITY[l as 0 | 1 | 2], instance), (instance) => take(-1, 1, 400, instance))
  if (data.civilians !== undefined) {
    const list = rows(data.civilians).map(([x, z, yaw, ph, vx, vz, child, bitT, k, st, , color]) => ({ x, z, yaw, phase: ph, vx, vz, biteTimer: bitT, k, state: CIVILIAN_STATES[st!], spec: { id: `c${k}`, home: '', child: child === 1, color } }) as unknown as Civilian)
    // the game's survivor batches are `1 + k` (0 is the player's); the shirt is the survivor's colour (G `NPC_COL`)
    instances.civilians(list, (n) => n.spec.color ?? 0x808080, (n, instance) => take(-3 - n.k, 0, 4, instance))
  }
  const recorder = createEventRecorder()
  recorder.record('render', {
    frame: (event.data as Record<string, number>).frame!,
    camera: data.camera!,
    viewYaw: data.viewYaw!,
    target: data.target!,
    agents: data.agents!,
    corpses: data.corpses!,
    ...(data.civilians !== undefined ? { civilians: data.civilians } : {}),
    out: out as unknown as EventValue,
    lod: Array.from({ length: Z.n }, (_, i) => Z.lod[i]!).join(','),
    ap: Array.from({ length: Z.n }, (_, i) => Z.attackPose[i]!).join(','),
  })
  return recorder.events()[0]!
}

const scenes = (): [string, GoldenEvent[]][] => {
  const out: [string, GoldenEvent[]][] = []
  for (const event of golden.events) {
    if (event.type === 'scene') out.push([(event.data as { id: string }).id, []])
    else out[out.length - 1]![1].push(event)
  }
  return out
}

describe('G-crowd-render: the SDK instances are the game drawing, body by body', () => {
  it('has the 11 scenes of the horde and the survivors', () => {
    expect(scenes()).toHaveLength(11)
  })
  it.each(scenes())('%s', (_id, events) => {
    for (const event of events) {
      const mine = replay(event)
      if (JSON.stringify(mine) !== JSON.stringify(event)) {
        const want = event.data as Record<string, unknown>
        const got = mine.data as Record<string, unknown>
        const key = Object.keys(want).find((k) => JSON.stringify(want[k]) !== JSON.stringify(got[k]))
        expect({ frame: want.frame, key, got: got[key!] }).toEqual({ frame: want.frame, key, got: want[key!] })
      }
    }
  })
})

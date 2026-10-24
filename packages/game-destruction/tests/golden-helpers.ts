import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertMatchesGolden, createEventRecorder, createGoldenRecord, withDeterminism } from '@adatechnology/golden-tool'
import type { EventRecorder, EventValue, GoldenRecord } from '@adatechnology/golden-tool'
import type { DestructionEvent, DestructionWorld, Fragment, Vec3 } from '../src'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'wall-golden')

const vec = (v: Vec3): EventValue => [v[0], v[1], v[2]]

const fragmentsOf = (fragments: readonly Fragment[]): EventValue => ({
  count: fragments.length,
  mass: fragments.reduce((sum, f) => sum + f.mass, 0),
  marks: fragments.reduce((sum, f) => sum + (f.marks?.length ?? 0), 0),
  first: fragments[0] ? { center: vec(fragments[0].center), size: vec(fragments[0].size) } : null,
})

/** The part of an event worth comparing: type, time and the numbers that decide what a renderer draws. */
export const eventData = (e: DestructionEvent): { readonly [key: string]: EventValue } => {
  const base = { time: e.time }
  switch (e.type) {
    case 'damage': return { ...base, part: e.part, amount: e.amount, hp: e.hp, damageType: e.damageType }
    case 'hole': return { ...base, part: e.part, at: vec(e.worldPoint), diameter: e.hole.diameter, through: e.hole.through }
    case 'crack': return { ...base, part: e.part, at: vec(e.worldPoint), rays: e.crack.rays, length: e.crack.length }
    case 'spall': return { ...base, part: e.part, layer: e.layer, at: vec(e.point), area: e.area }
    case 'stage': return { ...base, part: e.part, stage: e.stage, ...(e.opening ? { opening: { center: vec(e.opening.center), radius: e.opening.radius } } : {}), ...(e.fragments ? { fragments: fragmentsOf(e.fragments) } : {}) }
    case 'fracture': return { ...base, part: e.part, style: e.style, fragments: fragmentsOf(e.fragments) }
    case 'expose': return { ...base, part: e.part, bars: e.bars.length, first: e.bars[0] ? [vec(e.bars[0][0]), vec(e.bars[0][1])] : null }
    case 'collapse': return { ...base, parts: e.parts, mass: e.mass }
    case 'stress': return { ...base, part: e.part, stress: e.stress, load: e.load }
    case 'detach': return { ...base, joint: e.joint, by: e.by }
    case 'explode': return { ...base, part: e.part, energy: e.energy }
    case 'debris': return { ...base, part: e.part, kind: e.kind, count: e.count }
    default: return { ...base, ...('part' in e ? { part: e.part } : {}) }
  }
}

export const recordWorld = (recorder: EventRecorder, world: DestructionWorld, scenario?: string): void => {
  world.on('*', (e) => recorder.record(e.type, scenario ? { scenario, ...eventData(e) } : eventData(e)))
}

/** Runs `scenario` under the seeded, portable-math environment of tools/golden and returns the recorded events. */
export const recordGolden = (name: string, seed: number, scenario: (recorder: EventRecorder) => void): GoldenRecord =>
  withDeterminism({ seed }, () => {
    const recorder = createEventRecorder()
    scenario(recorder)
    return createGoldenRecord({ name, seed, events: recorder.events() })
  })

/** Compares with `fixtures/wall-golden/<name>.json`; `UPDATE_GOLDEN=1` writes the file instead (and a missing file is written, not accepted). */
export const matchGolden = (record: GoldenRecord): void => {
  const file = join(FIXTURES, `${record.name}.json`)
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    mkdirSync(FIXTURES, { recursive: true })
    writeFileSync(file, `${JSON.stringify(record, null, 1)}\n`)
    if (process.env.UPDATE_GOLDEN !== '1') throw new Error(`golden "${record.name}" did not exist; recorded it, review and commit it`)
    return
  }
  assertMatchesGolden(JSON.parse(readFileSync(file, 'utf8')) as GoldenRecord, record)
}

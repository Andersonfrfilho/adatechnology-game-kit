import { describe, expect, it } from 'vitest'
import { DEBRIS_FAMILIES, debrisFamily, debrisLook, MATERIALS, WOOD_ONLY_COLORS } from '@adatechnology/game-destruction'
import type { MaterialDef } from '@adatechnology/game-destruction'
import { createEffectPlayer, DEBRIS_EFFECT_FAMILIES, effectForEvent, GAME_EFFECTS, lehmer, WorkshopEngine } from '@adatechnology/game-vfx'
import type { GameEvent } from '@adatechnology/game-vfx'
import { familyPlay } from '../src/debris-events'

/** What one effect really spawned: the colours of its debris and sprites, and the size of each piece of debris. */
interface Spawned {
  readonly colors: number[]
  readonly pieces: Array<readonly [number, number, number]>
}

const VIEW = { position: [0, 1.6, 4] as const, forward: (): [number, number, number] => [0, 0, -1] }

/** Plays an effect as the renderer does (with the family colours of the material) and records every spawn it makes, its macros' included. */
function play(id: string, values: Readonly<Record<string, number>>): Spawned {
  const spawned: Spawned = { colors: [], pieces: [] }
  const trace = (kind: string, args: readonly unknown[]): void => {
    const options = args[0] as Record<string, unknown> | undefined
    if (!options || typeof options !== 'object') return
    for (const key of ['c', 'c0', 'c1'] as const) if (typeof options[key] === 'number') spawned.colors.push(options[key] as number)
    if (kind === 'debris' && Array.isArray(options.size)) spawned.pieces.push(options.size as [number, number, number])
  }
  const engine = new WorkshopEngine({ random: lehmer(7), trace })
  const player = createEffectPlayer({ engine, effects: GAME_EFFECTS, view: VIEW })
  expect(player.play(id, [0, 1, 0], { seed: 3, values }), id).not.toBeNull()
  for (let frame = 0; frame < 60; frame++) {
    player.update(1 / 60)
    engine.update(1 / 60)
  }
  return spawned
}

/** A piece four times longer than its next side is a splinter. */
const isSplinter = ([x, y, z]: readonly [number, number, number]): boolean => {
  const [small, middle, large] = [Math.abs(x), Math.abs(y), Math.abs(z)].sort((a, b) => a - b) as [number, number, number]
  return small > 0 && large >= 4 * middle
}

/** The effects the event map plays on a part of this material: the stages, a collapse, bare rebar (in concrete) and the impact of a shot on its coat. */
function effectsOf(def: MaterialDef): string[] {
  const { material } = familyPlay(def)
  const events: GameEvent[] = [
    { kind: 'stage', stage: 1, material },
    { kind: 'stage', stage: 2, material },
    { kind: 'stage', stage: 3, material },
    { kind: 'collapse', material },
  ]
  if (debrisFamily(def) === 'masonry') events.push({ kind: 'expose' })
  const impact = debrisLook(def, 'spall').impact
  if (impact) events.push({ kind: 'spall', material: impact })
  return events.map((event) => effectForEvent(event)).filter((id): id is string => id !== undefined)
}

describe('the effects of the event map match the material that broke', () => {
  it('has the same families as the destruction model', () => {
    expect([...DEBRIS_EFFECT_FAMILIES]).toEqual([...DEBRIS_FAMILIES])
  })

  for (const def of MATERIALS) {
    it(`${def.id}: no wood colour or splinter outside wood, and the debris in the material's colour`, () => {
      const family = debrisFamily(def)
      const { values } = familyPlay(def)
      const ids = effectsOf(def)
      expect(ids.length).toBeGreaterThanOrEqual(4)
      for (const id of ids) {
        const spawned = play(id, values)
        expect(spawned.colors.length + spawned.pieces.length, id).toBeGreaterThan(0)
        if (family === 'wood') continue
        for (const color of spawned.colors) expect(WOOD_ONLY_COLORS, `${def.id} ${id} colour ${color.toString(16)}`).not.toContain(color)
        for (const piece of spawned.pieces) expect(isSplinter(piece), `${def.id} ${id} splinter ${piece.join('x')}`).toBe(false)
      }
      // the stage 1 of a hit throws pieces of the material's own colour (concrete grey, brick orange), not a fixed one
      if (family !== 'metal') expect(play(`stage_crack_${family}`, values).colors).toContain(debrisLook(def, 'stage1').color)
    })
  }

  it('the stage 1 of a concrete beam throws grey chips and dust, the old wood splinters only from wood', () => {
    const concrete = MATERIALS.find((def) => def.id === 'concrete')!
    const beam = play(effectForEvent({ kind: 'stage', stage: 1, material: familyPlay(concrete).material })!, familyPlay(concrete).values)
    expect(beam.colors).toContain(0x9b9a94)
    expect(beam.pieces.some(isSplinter)).toBe(false)
    const door = play('stage_crack_wood', {})
    expect(door.pieces.some(isSplinter)).toBe(true)
  })
})

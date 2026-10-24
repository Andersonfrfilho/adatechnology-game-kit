import { describe, expect, it } from 'vitest'
import type { DestructionEvent, EffectHandle, EffectRequest, EffectSink, HostEvent, ModuleHost, PartSpec } from '../src'

function createRecordingSink(known: readonly string[]): { sink: EffectSink; played: EffectRequest[]; stopped: EffectHandle[] } {
  const played: EffectRequest[] = []
  const stopped: EffectHandle[] = []
  const sink: EffectSink = {
    play(request) {
      if (!known.includes(request.effect)) return null
      played.push(request)
      return played.length
    },
    stop: (handle) => void stopped.push(handle),
    catalog: () => known,
    stats: () => ({ played: played.length }),
  }
  return { sink, played, stopped }
}

describe('effects contract', () => {
  it('a sink plays what it knows, answers null for the rest and stops by handle', () => {
    const { sink, played, stopped } = createRecordingSink(['explosion_m67'])
    const handle = sink.play({ effect: 'explosion_m67', point: [1, 0, 2], direction: [0, 1, 0], seed: 7, scale: 1.5 })
    expect(handle).toBe(1)
    expect(sink.play({ effect: 'unknown', point: [0, 0, 0] })).toBeNull()
    sink.stop(1)
    expect(played).toHaveLength(1)
    expect(stopped).toEqual([1])
    expect(sink.catalog?.()).toEqual(['explosion_m67'])
    expect(sink.stats?.()).toEqual({ played: 1 })
  })

  it('a host may lend effects to a module, and may not', () => {
    const { sink } = createRecordingSink([])
    const lent: Pick<ModuleHost, 'effects'> = { effects: sink }
    const notLent: Pick<ModuleHost, 'effects'> = {}
    expect(lent.effects).toBe(sink)
    expect(notLent.effects).toBeUndefined()
  })

  it('the explosion event names the explosive and the explode event and part name the effect', () => {
    const hostEvent: HostEvent = { type: 'explosion', source: 'm67', point: [0, 0, 0], energy: 1, radius: 5, cause: 'fuse', explosive: 'm67' }
    const worldEvent = { type: 'explode', part: 'tank', point: [0, 0, 0], energy: 1, radius: 5, effect: 'explosion_fuel_barrel' } as DestructionEvent
    const part: Pick<PartSpec, 'explodes'> = { explodes: { energy: 1, radius: 5, effect: 'explosion_fuel_barrel' } }
    expect(hostEvent.type === 'explosion' && hostEvent.explosive).toBe('m67')
    expect(worldEvent.type === 'explode' && worldEvent.effect).toBe('explosion_fuel_barrel')
    expect(part.explodes?.effect).toBe('explosion_fuel_barrel')
  })
})

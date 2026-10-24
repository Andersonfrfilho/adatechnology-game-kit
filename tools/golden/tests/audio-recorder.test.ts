import { describe, expect, it } from 'vitest'

import { assertAudioTraceMatches, createAudioRecorder, diffAudioTrace } from '../src'

describe('audio recorder', () => {
  it('logs nodes, properties, parameters, connections, starts and stops in call order', () => {
    const recorder = createAudioRecorder()
    const context = recorder.context
    const master = context.createGain()
    master.gain.value = 0.5
    master.connect(context.destination)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 3
    filter.frequency.setValueAtTime(700, 0.25)
    filter.frequency.linearRampToValueAtTime(560, 1.1)
    const source = context.createBufferSource()
    const buffer = context.createBuffer(1, 4, context.sampleRate)
    source.buffer = buffer
    source.connect(filter).connect(master)
    source.start(0, 0.123456789012)
    source.stop(1.25)

    const { entries, buffers } = recorder.trace()
    expect(entries.map((entry) => `${entry.op}:${entry.node ?? entry.buffer ?? entry.from}`)).toEqual([
      'create:gain#1',
      'param:gain#1',
      'connect:gain#1',
      'create:biquadFilter#2',
      'set:biquadFilter#2',
      'param:biquadFilter#2',
      'param:biquadFilter#2',
      'param:biquadFilter#2',
      'create:bufferSource#3',
      'createBuffer:buffer#4',
      'set:bufferSource#3',
      'connect:bufferSource#3',
      'connect:biquadFilter#2',
      'start:bufferSource#3',
      'stop:bufferSource#3',
    ])
    expect(entries[2]).toEqual({ op: 'connect', from: 'gain#1', to: 'destination' })
    expect(entries[4]).toEqual({ op: 'set', node: 'biquadFilter#2', prop: 'type', value: 'bandpass' })
    expect(entries[7]).toEqual({ op: 'param', node: 'biquadFilter#2', param: 'frequency', method: 'linearRampToValueAtTime', args: [560, 1.1] })
    expect(entries[10]).toEqual({ op: 'set', node: 'bufferSource#3', prop: 'buffer', value: 'buffer#4' })
    expect(entries[13]).toEqual({ op: 'start', node: 'bufferSource#3', args: [0, 0.1234567890] })
    expect(buffers).toHaveLength(1)
  })

  it('connects to a parameter and disconnects', () => {
    const recorder = createAudioRecorder()
    const lfo = recorder.context.createOscillator()
    const depth = recorder.context.createGain()
    const target = recorder.context.createGain()
    lfo.connect(depth)
    depth.connect(target.gain)
    depth.disconnect(target.gain)
    lfo.disconnect()
    expect(recorder.trace().entries.slice(-4)).toEqual([
      { op: 'connect', from: 'oscillator#1', to: 'gain#2' },
      { op: 'connect', from: 'gain#2', to: 'gain#3', param: 'gain' },
      { op: 'disconnect', from: 'gain#2', to: 'gain#3' },
      { op: 'disconnect', from: 'oscillator#1' },
    ])
  })

  it('reads currentTime, sampleRate and state, and gives the same context to `new AudioContext()`', async () => {
    const recorder = createAudioRecorder({ sampleRate: 44100, currentTime: 2 })
    expect(new recorder.AudioContext()).toBe(recorder.context)
    expect(recorder.context.sampleRate).toBe(44100)
    expect(recorder.context.currentTime).toBe(2)
    recorder.setTime(3.5)
    expect(recorder.context.currentTime).toBe(3.5)
    expect(recorder.context.state).toBe('running')
    await recorder.context.close()
    expect(recorder.context.state).toBe('closed')
  })

  it('summarises buffer samples as checksums that change with the samples', () => {
    const checksumOf = (value: number): string => {
      const recorder = createAudioRecorder()
      recorder.context.createBuffer(2, 8, 48000).getChannelData(1).fill(value)
      return recorder.trace().buffers[0]!.checksums.join('/')
    }
    expect(checksumOf(0.5)).toBe(checksumOf(0.5))
    expect(checksumOf(0.5)).not.toBe(checksumOf(0.25))
    expect(checksumOf(0.5).split('/')).toHaveLength(2)
  })

  it('forgets entries with clearEntries but keeps numbering', () => {
    const recorder = createAudioRecorder()
    recorder.context.createGain()
    recorder.clearEntries()
    recorder.context.createGain()
    expect(recorder.trace().entries).toEqual([{ op: 'create', node: 'gain#2', kind: 'gain' }])
  })

  it('refuses a connection to something it did not create', () => {
    const recorder = createAudioRecorder()
    expect(() => recorder.context.createGain().connect({} as AudioNode)).toThrow(/unknown object/)
  })
})

describe('diffAudioTrace', () => {
  const build = (frequency: number, extra = false) => {
    const recorder = createAudioRecorder()
    const filter = recorder.context.createBiquadFilter()
    filter.frequency.value = frequency
    if (extra) recorder.context.createGain()
    return recorder.trace()
  }

  it('matches within the tolerance and names the difference outside it', () => {
    expect(diffAudioTrace(build(1000), build(1000 + 1e-10))).toEqual([])
    expect(diffAudioTrace(build(1000), build(1001))).toEqual(['trace.entries[1].args[0]: expected 1000, got 1001'])
    expect(diffAudioTrace(build(1000), build(1001), { tolerance: 2 })).toEqual([])
  })

  it('reports a missing entry and throws from assertAudioTraceMatches', () => {
    expect(diffAudioTrace(build(1000), build(1000, true))[0]).toContain('expected 2 items, got 3')
    expect(() => assertAudioTraceMatches(build(1000), build(1000, true))).toThrow(/audio trace differs/)
    expect(() => assertAudioTraceMatches(build(1000), build(1000))).not.toThrow()
  })
})

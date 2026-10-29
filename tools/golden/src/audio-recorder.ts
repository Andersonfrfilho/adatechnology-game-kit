/**
 * A fake `AudioContext` that logs what a sound routine does: every node it creates, every property and parameter it sets, every connection,
 * start and stop. The team's audio code runs against it under a seeded `Math.random`, the SDK's runs against another one, and the two logs
 * must match (spec 001, S3: the generated parameters are compared, not the audio).
 */
export type AudioTraceValue = number | string | boolean | null | readonly AudioTraceValue[]

/** One thing that happened. `op` is `create`, `createBuffer`, `set`, `param`, `connect`, `disconnect`, `start`, `stop` or `close`. */
export type AudioTraceEntry = {
  readonly op: string
  readonly node?: string
  readonly kind?: string
  readonly prop?: string
  readonly param?: string
  readonly method?: string
  readonly value?: AudioTraceValue
  readonly args?: readonly AudioTraceValue[]
  readonly from?: string
  readonly to?: string
  readonly buffer?: string
  readonly channels?: number
  readonly length?: number
  readonly rate?: number
}

/** The samples of an audio buffer are summarised, not stored: one FNV-1a checksum per channel of the Float32 bytes. */
export type AudioTraceBuffer = {
  readonly id: string
  readonly channels: number
  readonly length: number
  readonly rate: number
  readonly checksums: readonly string[]
}

export type AudioTrace = {
  readonly sampleRate: number
  readonly entries: readonly AudioTraceEntry[]
  readonly buffers: readonly AudioTraceBuffer[]
}

export type AudioRecorderOptions = {
  readonly sampleRate?: number
  /** What `currentTime` reads at the start (default 0, so every logged time is relative to the call). */
  readonly currentTime?: number
}

export type AudioRecorder = {
  /** What a page reads as `window.AudioContext`: `new` gives the one recorded context. */
  readonly AudioContext: new () => AudioContext
  readonly context: AudioContext
  /** Moves `currentTime`. */
  readonly setTime: (seconds: number) => void
  /** Forgets the entries so far (node numbering goes on): the log then holds only what happens after, such as the sound without its setup. */
  readonly clearEntries: () => void
  readonly trace: () => AudioTrace
}

export type AudioTraceDifferenceOptions = {
  /** Largest allowed gap between two numbers. Default 1e-9. */
  readonly tolerance?: number
  /** How many differences to list. Default 10. */
  readonly limit?: number
}

const DEFAULT_SAMPLE_RATE = 48000
const NUMBER_DECIMALS = 10
const DEFAULT_TOLERANCE = 1e-9
const DEFAULT_DIFFERENCE_LIMIT = 10
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

type ParamDefaults = Readonly<Record<string, number>>
type Reference = { readonly id: string; readonly owner?: string; readonly param?: string }

const NODE_PARAMS: Readonly<Record<string, ParamDefaults>> = {
  gain: { gain: 1 },
  bufferSource: { playbackRate: 1, detune: 0 },
  biquadFilter: { frequency: 350, Q: 1, gain: 0, detune: 0 },
  oscillator: { frequency: 440, detune: 0 },
  stereoPanner: { pan: 0 },
  dynamicsCompressor: { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 },
  convolver: {},
  delay: { delayTime: 0 },
}

const NODE_DEFAULT_PROPS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  bufferSource: { buffer: null, loop: false },
  biquadFilter: { type: 'lowpass' },
  oscillator: { type: 'sine' },
  convolver: { buffer: null },
}

function roundNumber(value: number): AudioTraceValue {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Math.round(value * 10 ** NUMBER_DECIMALS) / 10 ** NUMBER_DECIMALS
  return rounded + 0
}

function checksumOf(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
  let hash = FNV_OFFSET
  for (const byte of bytes) hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0
  return hash.toString(16).padStart(8, '0')
}

export function createAudioRecorder(options: AudioRecorderOptions = {}): AudioRecorder {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE
  const references = new WeakMap<object, Reference>()
  const bufferData = new Map<string, Float32Array[]>()
  let entries: AudioTraceEntry[] = []
  let created = 0
  let currentTime = options.currentTime ?? 0
  let state = 'running'

  const log = (entry: AudioTraceEntry): void => void entries.push(entry)

  const toTraceValue = (value: unknown): AudioTraceValue => {
    if (typeof value === 'number') return roundNumber(value)
    if (typeof value === 'string' || typeof value === 'boolean' || value === null || value === undefined) return value ?? null
    if (Array.isArray(value)) return value.map(toTraceValue)
    const reference = typeof value === 'object' ? references.get(value) : undefined
    return reference ? reference.id : String(value)
  }

  const createParam = (owner: string, name: string, initial: number): object => {
    const id = `${owner}.${name}`
    let current = initial
    const record = (method: string, args: readonly unknown[]): void => log({ op: 'param', node: owner, param: name, method, args: args.map(toTraceValue) })
    const param: Record<string, unknown> = {
      get value() {
        return current
      },
      set value(next: number) {
        current = next
        record('value', [next])
      },
    }
    for (const method of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
      param[method] = (...args: unknown[]) => {
        record(method, args)
        return param
      }
    }
    references.set(param, { id, owner, param: name })
    return param
  }

  const createNode = (kind: string): object => {
    created += 1
    const id = `${kind}#${created}`
    log({ op: 'create', node: id, kind })
    const stored: Record<string, unknown> = { ...NODE_DEFAULT_PROPS[kind] }
    const params = Object.fromEntries(Object.entries(NODE_PARAMS[kind] ?? {}).map(([name, initial]) => [name, createParam(id, name, initial)]))
    const methods: Record<string, unknown> = {
      connect(target: object) {
        const reference = references.get(target)
        if (!reference) throw new Error(`audio recorder: connect to an unknown object from ${id}`)
        log(reference.param ? { op: 'connect', from: id, to: reference.owner ?? reference.id, param: reference.param } : { op: 'connect', from: id, to: reference.id })
        return target
      },
      disconnect(target?: object) {
        const reference = target ? references.get(target) : undefined
        log(reference ? { op: 'disconnect', from: id, to: reference.owner ?? reference.id } : { op: 'disconnect', from: id })
      },
      start: (...args: unknown[]) => log({ op: 'start', node: id, args: args.map(toTraceValue) }),
      stop: (...args: unknown[]) => log({ op: 'stop', node: id, args: args.map(toTraceValue) }),
    }
    const node = new Proxy(stored, {
      get(target, key) {
        if (typeof key === 'string' && key in params) return params[key]
        if (typeof key === 'string' && key in methods) return methods[key]
        return target[key as string]
      },
      set(target, key, value) {
        if (typeof key === 'string' && key in params) {
          ;(params[key] as { value: number }).value = value
          return true
        }
        target[key as string] = value
        if (typeof value !== 'function' && typeof key === 'string') log({ op: 'set', node: id, prop: key, value: toTraceValue(value) })
        return true
      },
    })
    references.set(node, { id })
    return node
  }

  const createBuffer = (channels: number, requestedLength: number, rate: number): object => {
    const length = Math.floor(requestedLength) // an AudioBuffer takes its length as an unsigned long
    created += 1
    const id = `buffer#${created}`
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    bufferData.set(id, data)
    log({ op: 'createBuffer', buffer: id, channels, length, rate })
    const buffer = { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (channel: number) => data[channel] }
    references.set(buffer, { id })
    return buffer
  }

  const destination = { kind: 'destination' }
  references.set(destination, { id: 'destination' })

  const context = {
    destination,
    get currentTime() {
      return currentTime
    },
    sampleRate,
    get state() {
      return state
    },
    resume: async () => {
      state = 'running'
    },
    close: async () => {
      state = 'closed'
      log({ op: 'close' })
    },
    createGain: () => createNode('gain'),
    createBufferSource: () => createNode('bufferSource'),
    createBiquadFilter: () => createNode('biquadFilter'),
    createOscillator: () => createNode('oscillator'),
    createStereoPanner: () => createNode('stereoPanner'),
    createDynamicsCompressor: () => createNode('dynamicsCompressor'),
    createConvolver: () => createNode('convolver'),
    createDelay: () => createNode('delay'),
    createBuffer,
  } as unknown as AudioContext

  function RecordedAudioContext(): AudioContext {
    return context
  }

  return {
    AudioContext: RecordedAudioContext as unknown as new () => AudioContext,
    context,
    setTime(seconds) {
      currentTime = seconds
    },
    clearEntries() {
      entries = []
    },
    trace() {
      const buffers = [...bufferData].map(([id, channels]) => {
        const created = entries.find((entry) => entry.op === 'createBuffer' && entry.buffer === id)
        return { id, channels: channels.length, length: channels[0]?.length ?? 0, rate: created?.rate ?? sampleRate, checksums: channels.map(checksumOf) }
      })
      return { sampleRate, entries: [...entries], buffers }
    },
  }
}

function describeDifferences(path: string, expected: unknown, actual: unknown, tolerance: number, found: string[], limit: number): void {
  if (found.length >= limit) return
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Math.abs(expected - actual) > tolerance) found.push(`${path}: expected ${expected}, got ${actual}`)
    return
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) found.push(`${path}: expected ${expected.length} items, got ${actual.length}`)
    for (let index = 0; index < Math.min(expected.length, actual.length); index++) describeDifferences(`${path}[${index}]`, expected[index], actual[index], tolerance, found, limit)
    return
  }
  if (expected !== null && actual !== null && typeof expected === 'object' && typeof actual === 'object') {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    for (const key of keys) describeDifferences(`${path}.${key}`, (expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], tolerance, found, limit)
    return
  }
  if (expected !== actual) found.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

/** What differs between two traces (numbers within `tolerance`), the first `limit` of them, as lines a test can print. Empty when they match. */
export function diffAudioTrace(expected: AudioTrace, actual: AudioTrace, options: AudioTraceDifferenceOptions = {}): string[] {
  const found: string[] = []
  const limit = options.limit ?? DEFAULT_DIFFERENCE_LIMIT
  describeDifferences('trace', expected, actual, options.tolerance ?? DEFAULT_TOLERANCE, found, limit)
  return found
}

/** Throws with the first differing entries when the traces do not match. */
export function assertAudioTraceMatches(expected: AudioTrace, actual: AudioTrace, options: AudioTraceDifferenceOptions = {}): void {
  const differences = diffAudioTrace(expected, actual, options)
  if (differences.length > 0) throw new Error(`audio trace differs:\n${differences.join('\n')}`)
}

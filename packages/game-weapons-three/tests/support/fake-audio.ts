// a minimal AudioContext that records what is built
export const createFakeContext = () => {
  const starts: Array<{ kind: string; at: number; offset: number | undefined; filter: number | undefined }> = []
  const buffers: Float32Array[] = []
  /** Where in the noise buffer each burst starts and for how long it plays (the stop adds 0.05 s of tail). */
  const spans: Array<{ offset: number; seconds: number }> = []
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} })
  const node = <T extends object>(extra: T) => {
    const self: Record<string, unknown> = { connect: (next: unknown) => next, ...extra }
    return self as unknown as T & { connect: <N>(next: N) => N }
  }
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    resume: async () => {},
    close: async () => {},
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(), Q: param() }),
    createOscillator: () => node({ type: 'sine', frequency: param(), start: (at: number) => starts.push({ kind: 'osc', at, offset: undefined, filter: undefined }), stop() {} }),
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length)
      buffers.push(data)
      return { getChannelData: () => data }
    },
    createBufferSource: () => {
      let begin = 0
      let offset = 0
      return node({
        buffer: null,
        start: (at: number, from?: number) => {
          begin = at
          offset = from ?? 0
          starts.push({ kind: 'noise', at, offset: from, filter: undefined })
        },
        stop: (at: number) => void spans.push({ offset, seconds: at - begin - 0.05 }),
      })
    },
  }
  return { context: context as unknown as AudioContext, starts, buffers, spans }
}


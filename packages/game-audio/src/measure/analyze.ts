/**
 * Measurements of rendered sound (pure, on plain sample arrays), for the criteria C1–C9: when it starts, how loud and how bright it is, which side
 * it is on, how long it rings and how many separate hits a burst has.
 */

export type Channels = readonly Float32Array[]

/** Linear amplitude to dBFS (−Infinity for 0). */
export const dbOf = (amplitude: number): number => (amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity)

const clampIndex = (channels: Channels, index: number): number => Math.max(0, Math.min(channels[0]?.length ?? 0, Math.round(index)))

/** The loudest sample of every channel between two sample indexes (linear). */
export function peakOf(channels: Channels, start = 0, end = Number.POSITIVE_INFINITY): number {
  let peak = 0
  const from = clampIndex(channels, start)
  for (const channel of channels) {
    const to = Math.min(channel.length, end)
    for (let index = from; index < to; index++) {
      const value = Math.abs(channel[index] as number)
      if (value > peak) peak = value
    }
  }
  return peak
}

/** Index of the loudest sample (any channel) between two indexes. */
export function peakIndex(channels: Channels, start = 0, end = Number.POSITIVE_INFINITY): number {
  let peak = -1
  let at = -1
  const from = clampIndex(channels, start)
  for (const channel of channels) {
    const to = Math.min(channel.length, end)
    for (let index = from; index < to; index++) {
      const value = Math.abs(channel[index] as number)
      if (value > peak) {
        peak = value
        at = index
      }
    }
  }
  return at
}

/** First sample index at or after `start` whose amplitude (any channel) reaches `threshold`, or −1. */
export function onsetIndex(channels: Channels, start = 0, threshold = 0.001): number {
  const length = channels[0]?.length ?? 0
  for (let index = clampIndex(channels, start); index < length; index++) {
    for (const channel of channels) if (Math.abs(channel[index] as number) >= threshold) return index
  }
  return -1
}

/** RMS of all channels between two indexes, dBFS. */
export function rmsDb(channels: Channels, start: number, end: number): number {
  let sum = 0
  let count = 0
  const from = clampIndex(channels, start)
  for (const channel of channels) {
    const to = Math.min(channel.length, Math.round(end))
    for (let index = from; index < to; index++) {
      const value = channel[index] as number
      sum += value * value
      count++
    }
  }
  return count === 0 ? -Infinity : dbOf(Math.sqrt(sum / count))
}

/** Spectral centroid (Hz) of `size` samples from `start` (channels summed, Hann window, plain DFT): the brightness of the sound. */
export function centroidHz(channels: Channels, sampleRate: number, start: number, size = 2048): number {
  const from = clampIndex(channels, start)
  const frame = new Float64Array(size)
  for (const channel of channels) {
    for (let index = 0; index < size; index++) frame[index] = (frame[index] as number) + ((channel[from + index] as number | undefined) ?? 0)
  }
  for (let index = 0; index < size; index++) frame[index] = (frame[index] as number) * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1)))
  let weighted = 0
  let total = 0
  const bins = size / 2
  for (let bin = 1; bin < bins; bin++) {
    let re = 0
    let im = 0
    const step = (2 * Math.PI * bin) / size
    for (let index = 0; index < size; index++) {
      const value = frame[index] as number
      re += value * Math.cos(step * index)
      im -= value * Math.sin(step * index)
    }
    const magnitude = Math.hypot(re, im)
    weighted += magnitude * ((bin * sampleRate) / size)
    total += magnitude
  }
  return total > 0 ? weighted / total : 0
}

/** Energy balance from −1 (all left) to 1 (all right) between two indexes. */
export function balanceOf(left: Float32Array, right: Float32Array, start: number, end: number): number {
  let l = 0
  let r = 0
  const to = Math.min(left.length, right.length, Math.round(end))
  for (let index = Math.max(0, Math.round(start)); index < to; index++) {
    l += (left[index] as number) ** 2
    r += (right[index] as number) ** 2
  }
  return l + r > 0 ? (r - l) / (r + l) : 0
}

/** Seconds from `start` to the last 10 ms window louder than `floorDb` (how long the sound rings, tail included). */
export function ringSeconds(channels: Channels, sampleRate: number, start: number, floorDb = -60): number {
  const window = Math.max(1, Math.round(sampleRate * 0.01))
  const length = channels[0]?.length ?? 0
  let last = clampIndex(channels, start)
  for (let index = last; index < length; index += window) {
    if (dbOf(peakOf(channels, index, index + window)) > floorDb) last = index + window
  }
  return (last - start) / sampleRate
}

/**
 * Separate hits in a burst: attacks of the 2 ms envelope, where it jumps to twice the mean of the 20 ms before it and reaches `threshold`, at least
 * 30 ms apart (so a rapid fire over a long tail still counts every shot).
 */
export function countHits(channels: Channels, sampleRate: number, threshold: number): number {
  const window = Math.max(1, Math.round(sampleRate * 0.002))
  const length = channels[0]?.length ?? 0
  const envelope: number[] = []
  for (let index = 0; index < length; index += window) envelope.push(peakOf(channels, index, index + window))
  const history = 10
  const refractory = Math.round(0.03 / 0.002)
  let hits = 0
  let quietUntil = -1
  for (let index = 0; index < envelope.length; index++) {
    const level = envelope[index] as number
    if (index < quietUntil || level < threshold) continue
    let sum = 0
    for (let back = Math.max(0, index - history); back < index; back++) sum += envelope[back] as number
    const before = index === 0 ? 0 : sum / Math.min(history, index)
    if (level >= 2 * before) {
      hits++
      quietUntil = index + refractory
    }
  }
  return hits
}

/** Peak of the last `seconds` of a file against its own peak, dB (≤ −40: it fades out, it does not end on a cut). */
export function endDropDb(channels: Channels, sampleRate: number, seconds = 0.005): number {
  const length = channels[0]?.length ?? 0
  const whole = peakOf(channels)
  if (whole === 0) return -Infinity
  return dbOf(peakOf(channels, length - Math.round(sampleRate * seconds), length) / whole)
}

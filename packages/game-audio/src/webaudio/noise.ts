/** `length` samples of white noise, `random × 2 − 1`, drawn in order (jogo L62086, cena L1312). */
export function fillNoise(random: () => number, length: number): Float32Array {
  const samples = new Float32Array(length)
  for (let index = 0; index < length; index++) samples[index] = random() * 2 - 1
  return samples
}

/**
 * A reverb impulse: per channel, noise times `(1 − i / length)^decay` (cena L1310). `length` is `sampleRate × seconds` as the art scene computes it,
 * which is not always whole (48000 × 2.2 = 105600.00000000001): the loop runs while `i < length`, so one more number is drawn than the buffer holds,
 * exactly like the team code. The power is `exp(decay × log(base))`, which every engine computes the same.
 */
export function fillImpulse(random: () => number, options: { readonly channels: number; readonly length: number; readonly decay: number }): Float32Array[] {
  const size = Math.floor(options.length)
  return Array.from({ length: options.channels }, () => {
    const samples = new Float32Array(size)
    for (let index = 0; index < options.length; index++) {
      const value = (random() * 2 - 1) * Math.exp(options.decay * Math.log(1 - index / options.length))
      if (index < size) samples[index] = value
    }
    return samples
  })
}

/** An AudioBuffer holding the samples (one channel per array). */
export function bufferOf(context: AudioContext, channels: readonly Float32Array[], requestedLength: number): AudioBuffer {
  const buffer = context.createBuffer(channels.length, requestedLength, context.sampleRate)
  channels.forEach((samples, channel) => buffer.getChannelData(channel).set(samples))
  return buffer
}

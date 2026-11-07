import type { MixProfile } from '../mix'
import { bufferOf, fillImpulse } from './noise'

export type MixChain = { readonly master: GainNode; readonly wet?: GainNode; disconnect(): void }

const LIMITER_POINTS = 4097

/**
 * The limiter's curve over inputs `-range..range` (full scale 1): untouched up to the knee, then `knee + (ceiling − knee) × tanh((|x| − knee) / (ceiling − knee))`,
 * which leaves the knee with the same slope and never passes the ceiling.
 */
export function limiterCurve(ceilingDb: number, kneeDb: number, range: number, points = LIMITER_POINTS): Float32Array<ArrayBuffer> {
  const ceiling = 10 ** (ceilingDb / 20)
  const knee = Math.min(10 ** (kneeDb / 20), ceiling)
  const curve = new Float32Array(new ArrayBuffer(points * 4))
  for (let i = 0; i < points; i++) {
    const x = ((i / (points - 1)) * 2 - 1) * range
    const a = Math.abs(x)
    const y = a <= knee || ceiling === knee ? Math.min(a, ceiling) : knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee))
    curve[i] = Math.sign(x) * y
  }
  return curve
}

/**
 * The mixing chain in the team order (cena L1308–1311; jogo L62080): compressor to the output, master into it (or straight to the output), then the
 * convolver with an impulse drawn from `random` and the wet bus into it, back into the master.
 */
export function buildChain(context: BaseAudioContext, profile: MixProfile, random: () => number): MixChain {
  // the limiter is the last stage: a gain that brings `range` × full scale into the shaper's -1..1, and a curve that gives the level back, bent above the knee
  let limiter: { readonly input: GainNode; readonly shaper: WaveShaperNode } | undefined
  if (profile.limiter) {
    const range = profile.limiter.range ?? 4
    const input = context.createGain()
    input.gain.value = 1 / range
    const shaper = context.createWaveShaper()
    shaper.curve = limiterCurve(profile.limiter.ceiling, profile.limiter.knee, range)
    input.connect(shaper)
    shaper.connect(context.destination)
    limiter = { input, shaper }
  }
  const output: AudioNode = limiter?.input ?? context.destination
  let compressor: DynamicsCompressorNode | undefined
  if (profile.compressor) {
    compressor = context.createDynamicsCompressor()
    compressor.threshold.value = profile.compressor.threshold
    compressor.ratio.value = profile.compressor.ratio
    if (profile.compressor.knee !== undefined) compressor.knee.value = profile.compressor.knee
    if (profile.compressor.attack !== undefined) compressor.attack.value = profile.compressor.attack
    if (profile.compressor.release !== undefined) compressor.release.value = profile.compressor.release
    compressor.connect(output)
  }
  const master = context.createGain()
  master.gain.value = profile.master
  master.connect(compressor ?? output)
  if (!profile.reverb) {
    return {
      master,
      disconnect: () => {
        master.disconnect()
        compressor?.disconnect()
        limiter?.input.disconnect()
        limiter?.shaper.disconnect()
      },
    }
  }
  const convolver = context.createConvolver()
  const length = context.sampleRate * profile.reverb.seconds
  convolver.buffer = bufferOf(context, fillImpulse(random, { channels: 2, length, decay: profile.reverb.decay }), length)
  const wet = context.createGain()
  wet.gain.value = profile.reverb.wet
  wet.connect(convolver)
  convolver.connect(master)
  return {
    master,
    wet,
    disconnect: () => {
      wet.disconnect()
      convolver.disconnect()
      master.disconnect()
      compressor?.disconnect()
      limiter?.input.disconnect()
      limiter?.shaper.disconnect()
    },
  }
}

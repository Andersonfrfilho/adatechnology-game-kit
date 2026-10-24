import type { MixProfile } from '../mix'
import { bufferOf, fillImpulse } from './noise'

export type MixChain = { readonly master: GainNode; readonly wet?: GainNode; disconnect(): void }

/**
 * The mixing chain in the team order (cena L1308–1311; jogo L62080): compressor to the output, master into it (or straight to the output), then the
 * convolver with an impulse drawn from `random` and the wet bus into it, back into the master.
 */
export function buildChain(context: AudioContext, profile: MixProfile, random: () => number): MixChain {
  let compressor: DynamicsCompressorNode | undefined
  if (profile.compressor) {
    compressor = context.createDynamicsCompressor()
    compressor.threshold.value = profile.compressor.threshold
    compressor.ratio.value = profile.compressor.ratio
    if (profile.compressor.knee !== undefined) compressor.knee.value = profile.compressor.knee
    if (profile.compressor.attack !== undefined) compressor.attack.value = profile.compressor.attack
    if (profile.compressor.release !== undefined) compressor.release.value = profile.compressor.release
    compressor.connect(context.destination)
  }
  const master = context.createGain()
  master.gain.value = profile.master
  master.connect(compressor ?? context.destination)
  if (!profile.reverb) {
    return {
      master,
      disconnect: () => {
        master.disconnect()
        compressor?.disconnect()
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
    },
  }
}

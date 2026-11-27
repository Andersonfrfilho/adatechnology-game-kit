import type JoltNS from 'jolt-physics/wasm-compat'

import type { Jolt } from './constants'

/** Jolt's bytes for one walker (position, speed, ground): the same recorder `saveState` uses for the world. */
export const readCharacterBytes = (J: Jolt, character: JoltNS.CharacterVirtual): Uint8Array => {
  const chunks: Uint8Array[] = []
  const recorder = new J.StateRecorderJS()
  recorder.WriteBytes = (data: number, size: number) => {
    chunks.push(J.HEAPU8.slice(data, data + size))
  }
  recorder.ReadBytes = () => undefined
  recorder.IsEOF = () => false
  recorder.IsFailed = () => false
  character.SaveState(recorder)
  J.destroy(recorder)
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

export const writeCharacterBytes = (J: Jolt, character: JoltNS.CharacterVirtual, bytes: Uint8Array): void => {
  let at = 0
  const recorder = new J.StateRecorderJS()
  recorder.ReadBytes = (out: number, size: number) => {
    J.HEAPU8.set(bytes.subarray(at, at + size), out)
    at += size
  }
  recorder.WriteBytes = () => undefined
  recorder.IsEOF = () => at >= bytes.length
  recorder.IsFailed = () => false
  character.RestoreState(recorder)
  J.destroy(recorder)
}

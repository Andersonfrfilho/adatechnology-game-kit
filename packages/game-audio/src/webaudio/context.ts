type AudioContextConstructor = new () => AudioContext

/** A new context from the page (`AudioContext` or the old `webkitAudioContext`), or `null` in Node and workers. */
export function globalContext(): AudioContext | null {
  const scope = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor }
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext
  return Constructor ? new Constructor() : null
}

/** Browsers start a context suspended until a click or key; call from one. */
export function unlockContext(context: AudioContext): void {
  if (context.state === 'suspended') void context.resume()
}

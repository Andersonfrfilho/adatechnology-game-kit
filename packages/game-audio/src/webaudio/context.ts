type AudioContextConstructor = new () => AudioContext

/** A new context from the page (`AudioContext` or the old `webkitAudioContext`), or `null` in Node and workers. */
export function globalContext(): AudioContext | null {
  const scope = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor }
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext
  return Constructor ? new Constructor() : null
}

/** A live context (one that plays to the speakers): it can be resumed and closed; an `OfflineAudioContext` renders and cannot. */
export function isLiveContext(context: BaseAudioContext): context is AudioContext {
  return typeof (context as Partial<AudioContext>).close === 'function' && typeof (context as Partial<AudioContext>).resume === 'function'
}

/** Browsers start a context suspended until a click or key; call from one. An offline context is started by `startRendering`, never resumed. */
export function unlockContext(context: BaseAudioContext): void {
  if (context.state === 'suspended' && isLiveContext(context)) void context.resume()
}

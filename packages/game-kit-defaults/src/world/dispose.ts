/** Releases the parts in the order given, once; a part that throws does not keep the others from being released, and the first error is thrown at the end. */
export function createDispose(parts: ReadonlyArray<() => void>): () => void {
  let isDisposed = false
  return () => {
    if (isDisposed) return
    isDisposed = true
    let failure: { readonly error: unknown } | undefined
    for (const part of parts) {
      try {
        part()
      } catch (error) {
        failure ??= { error }
      }
    }
    if (failure) throw failure.error
  }
}

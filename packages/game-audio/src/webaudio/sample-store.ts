/**
 * Decoded sample buffers by url. Files load once (concurrent asks share the same promise), decode on the engine's context and stay until `clear`.
 * The bytes come from a `SampleLoader`: `fetch` by default, or anything else (a single-file page passes the files inlined as base64).
 */

/** Gets the bytes of a file. */
export type SampleLoader = (url: string) => Promise<ArrayBuffer>

export type SampleStatus = 'none' | 'loading' | 'ready' | 'failed'

export type SampleLoadReport = { readonly loaded: readonly string[]; readonly failed: readonly { readonly url: string; readonly error: string }[] }

export type SampleStore = {
  status(url: string): SampleStatus
  /** The decoded buffer, once ready. */
  buffer(url: string): AudioBuffer | undefined
  /** Whether every url is ready. */
  ready(urls: readonly string[]): boolean
  load(urls: readonly string[], context: BaseAudioContext): Promise<SampleLoadReport>
  /** Seconds of the decoded file, or `undefined` while not ready. */
  seconds(url: string): number | undefined
  clear(): void
}

/** `fetch` relative to `baseUrl` (default the page). */
export function fetchLoader(baseUrl?: string): SampleLoader {
  return async (url) => {
    const target = baseUrl ? new URL(url, baseUrl).toString() : url
    const response = await fetch(target)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${target}`)
    return response.arrayBuffer()
  }
}

/** Bytes of files given inline as base64 (or `data:` urls), by url. */
export function inlineLoader(files: Readonly<Record<string, string>>): SampleLoader {
  return async (url) => {
    const text = files[url]
    if (text === undefined) throw new Error(`no inline file for ${url}`)
    const base64 = text.startsWith('data:') ? text.slice(text.indexOf(',') + 1) : text
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes.buffer
  }
}

const decode = (context: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> =>
  new Promise((resolve, reject) => {
    // the callback form also covers old Safari, where decodeAudioData returns no promise
    const result = context.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined
    result?.catch?.(reject)
  })

export function createSampleStore(loader: SampleLoader = fetchLoader()): SampleStore {
  const buffers = new Map<string, AudioBuffer>()
  const pending = new Map<string, Promise<AudioBuffer>>()
  const failed = new Map<string, string>()
  let generation = 0

  const loadOne = (url: string, context: BaseAudioContext): Promise<AudioBuffer> => {
    const existing = buffers.get(url)
    if (existing) return Promise.resolve(existing)
    const inFlight = pending.get(url)
    if (inFlight) return inFlight
    const started = generation
    failed.delete(url)
    const promise = loader(url)
      .then((bytes) => decode(context, bytes))
      .then((buffer) => {
        if (started === generation) buffers.set(url, buffer)
        return buffer
      })
      .catch((error: unknown) => {
        if (started === generation) failed.set(url, error instanceof Error ? error.message : String(error))
        throw error
      })
      .finally(() => {
        if (pending.get(url) === promise) pending.delete(url)
      })
    pending.set(url, promise)
    return promise
  }

  return {
    status(url) {
      if (buffers.has(url)) return 'ready'
      if (pending.has(url)) return 'loading'
      if (failed.has(url)) return 'failed'
      return 'none'
    },
    buffer: (url) => buffers.get(url),
    ready: (urls) => urls.every((url) => buffers.has(url)),
    seconds: (url) => buffers.get(url)?.duration,
    async load(urls, context) {
      const results = await Promise.allSettled(urls.map((url) => loadOne(url, context)))
      const loaded: string[] = []
      const errors: { url: string; error: string }[] = []
      results.forEach((result, index) => {
        const url = urls[index] as string
        if (result.status === 'fulfilled') loaded.push(url)
        else errors.push({ url, error: result.reason instanceof Error ? result.reason.message : String(result.reason) })
      })
      return { loaded, failed: errors }
    },
    clear() {
      generation++
      buffers.clear()
      pending.clear()
      failed.clear()
    },
  }
}

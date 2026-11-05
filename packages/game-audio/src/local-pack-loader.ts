/**
 * Puts a local sound pack on an engine without touching the frame a sound is played in. Each id's files are fetched and decoded in idle time
 * (one id per idle slot), once per url (the engine's sample store shares buffers between ids and voices). Until they decode, the id plays what it
 * played before (the SDK's recording, else its synthesized recipe); once they do, the id is swapped to the files. The choice is made once, when the
 * files load: a file that fails leaves the id on the SDK's sound for good, so `play` never fetches or decodes anything.
 */
import type { LocalPackSampleOptions, LocalSoundPack } from './local-pack'
import { isShippableLicense, localPackSamples } from './local-pack'
import type { SampleSound } from './recipe'
import type { AudioEngine } from './webaudio/engine'

export const LOCAL_PACK_BANK_ID = 'local_sound_pack'
const STAGING_PREFIX = 'local_pack_staging:'

/** `pending` while loading, `file` once the pack's files play, `fallback` when they failed and the SDK's sound stays, `sdk` when the entry prefers the SDK recording and there is one. */
export type LocalPackStatus = 'pending' | 'file' | 'fallback' | 'sdk'

export type LocalPackReport = {
  readonly file: readonly string[]
  /** Ids that kept the SDK recording by preference (their files were not fetched). */
  readonly sdk: readonly string[]
  readonly fallback: readonly { readonly id: string; readonly error: string }[]
}

/** Runs a task when the page is idle; returns a cancel function. */
export type IdleScheduler = (task: () => void) => () => void

type IdleWindow = { requestIdleCallback?: (task: () => void) => number; cancelIdleCallback?: (handle: number) => void }

/** `requestIdleCallback` where there is one, else the next macrotask. */
export const defaultIdleScheduler: IdleScheduler = (task) => {
  const idle = globalThis as IdleWindow
  if (idle.requestIdleCallback && idle.cancelIdleCallback) {
    const handle = idle.requestIdleCallback(task)
    const cancel = idle.cancelIdleCallback
    return () => cancel(handle)
  }
  const handle = setTimeout(task, 0)
  return () => clearTimeout(handle)
}

export type ApplyLocalSoundPackOptions = LocalPackSampleOptions & {
  readonly schedule?: IdleScheduler
}

export type LocalPackHandle = {
  /** Resolves when every id has loaded or fallen back. */
  readonly done: Promise<LocalPackReport>
  status(id: string): LocalPackStatus | undefined
  /** The ids playing a pack file whose licence is not CC0 / CC-BY. */
  unlicensed(): readonly string[]
  /** Stops loading and gives every swapped id back the sound it had before. */
  dispose(): void
}

type Engine = Pick<AudioEngine, 'registry' | 'register' | 'loadSamples'>

export function applyLocalSoundPack(engine: Engine, pack: LocalSoundPack, options: ApplyLocalSoundPackOptions = {}): LocalPackHandle {
  const schedule = options.schedule ?? defaultIdleScheduler
  const samples = localPackSamples(pack, options)
  const statuses = new Map<string, LocalPackStatus>(samples.map((sample) => [sample.id, 'pending']))
  const priors = new Map<string, { readonly sample?: SampleSound; readonly bank?: string }>()
  const report: { file: string[]; sdk: string[]; fallback: { id: string; error: string }[] } = { file: [], sdk: [], fallback: [] }
  const queue = [...samples]
  let cancel: (() => void) | undefined
  let disposed = false
  let finish: (value: LocalPackReport) => void = () => undefined
  const done = new Promise<LocalPackReport>((resolve) => {
    finish = resolve
  })

  const swapIn = (sample: SampleSound): void => {
    const prior = engine.registry.sample(sample.id)
    const bank = engine.registry.bankOf(sample.id)
    priors.set(sample.id, { ...(prior ? { sample: prior } : {}), ...(bank ? { bank } : {}) })
    engine.register({ id: LOCAL_PACK_BANK_ID, samples: [{ ...sample, ...(prior?.fallback ? { fallback: prior.fallback } : {}) }] })
    statuses.set(sample.id, 'file')
    report.file.push(sample.id)
  }

  const loadOne = async (sample: SampleSound): Promise<void> => {
    // decided when the id's turn comes, so the SDK's own bank (registered while the page loads) is already there
    if (pack.sounds[sample.id]?.prefer === 'sdk' && engine.registry.sample(sample.id)) {
      statuses.set(sample.id, 'sdk')
      report.sdk.push(sample.id)
      return
    }
    const staging = `${STAGING_PREFIX}${sample.id}`
    engine.register({ id: LOCAL_PACK_BANK_ID, samples: [{ ...sample, id: staging }] })
    const loaded = await engine.loadSamples([staging])
    engine.registry.removeSample(staging)
    if (disposed) return
    if (loaded.failed.length === 0) return swapIn(sample)
    statuses.set(sample.id, 'fallback')
    report.fallback.push({ id: sample.id, error: loaded.failed.map((entry) => `${entry.url}: ${entry.error}`).join('; ') })
  }

  const next = (): void => {
    const sample = queue.shift()
    if (!sample || disposed) {
      if (!disposed) finish(report)
      return
    }
    void loadOne(sample).finally(() => {
      if (!disposed) cancel = schedule(next)
    })
  }
  cancel = schedule(next)

  return {
    done,
    status: (id) => statuses.get(id),
    unlicensed: () => samples.filter((sample) => statuses.get(sample.id) === 'file' && !isShippableLicense(sample.license)).map((sample) => sample.id),
    dispose() {
      disposed = true
      cancel?.()
      for (const [id, prior] of priors) {
        if (prior.sample) engine.register({ id: prior.bank ?? LOCAL_PACK_BANK_ID, samples: [prior.sample] })
        else engine.registry.removeSample(id)
      }
      priors.clear()
      finish(report)
    },
  }
}

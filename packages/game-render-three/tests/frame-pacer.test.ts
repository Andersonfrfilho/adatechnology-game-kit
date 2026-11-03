import { describe, expect, it } from 'vitest'

import { createFramePacer } from '../src'
import type { FramePacerContext } from '../src'

const fakeContext = (): { context: FramePacerContext; finish: () => void } => {
  const done = { value: true }
  const context: FramePacerContext = {
    SYNC_GPU_COMMANDS_COMPLETE: 1,
    TIMEOUT_EXPIRED: 2,
    fenceSync: () => {
      done.value = false
      return {} as WebGLSync
    },
    clientWaitSync: () => (done.value ? 3 : 2),
    deleteSync: () => undefined,
    flush: () => undefined,
  }
  return { context, finish: () => (done.value = true) }
}

describe('createFramePacer', () => {
  it('holds a draw back only once the GPU is the whole allowance behind', () => {
    const { context, finish } = fakeContext()
    const pacer = createFramePacer(context, { framesInFlight: 2 })
    expect(pacer.ready()).toBe(true)
    pacer.submitted()
    expect(pacer.ready()).toBe(true)
    pacer.submitted()
    expect(pacer.ready()).toBe(false)
    expect(pacer.skipped).toBe(1)
    finish()
    expect(pacer.ready()).toBe(true)
  })

  it('does not hold back a GPU that keeps up while its fences report late', () => {
    const { context, finish } = fakeContext()
    const pacer = createFramePacer(context)
    for (let frame = 0; frame < 30; frame++) {
      expect(pacer.ready()).toBe(true)
      pacer.submitted()
      if (frame % 2 === 1) finish()
    }
    expect(pacer.skipped).toBe(0)
  })

  it('lets a frame through after the most skips in a row', () => {
    const { context } = fakeContext()
    const pacer = createFramePacer(context, { maxSkips: 2, framesInFlight: 1 })
    pacer.submitted()
    expect([pacer.ready(), pacer.ready(), pacer.ready()]).toEqual([false, false, true])
  })

  it('never holds back a context without fences', () => {
    const pacer = createFramePacer(null)
    pacer.submitted()
    expect(pacer.ready()).toBe(true)
  })
})

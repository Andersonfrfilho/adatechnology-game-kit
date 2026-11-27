import { describe, expect, it } from 'vitest'

import { createServiceChannel } from '../src'

describe('createServiceChannel', () => {
  it('keeps what is published in order, tells each change, and takes a value out by its own stop', () => {
    const channel = createServiceChannel<string>()
    let told = 0
    const stopListening = channel.onChange(() => void told++)
    const stopA = channel.publish('a')
    const stopB = channel.publish('b')
    expect(channel.values).toEqual(['a', 'b'])
    stopA()
    expect(channel.values).toEqual(['b'])
    stopA()
    expect(told).toBe(3)
    stopListening()
    stopB()
    expect(channel.values).toEqual([])
    expect(told).toBe(3)
  })
})

import { createSheet, createStoryWorld } from '@adatechnology/game-stories'
import { describe, expect, it } from 'vitest'

import { defaultProfessionName, defaultStoryContent } from '../src'

describe('the stories preset', () => {
  it('feeds a story world and a sheet with the people pack', () => {
    const content = defaultStoryContent('en')
    const world = createStoryWorld({ names: content.names, ruleset: content.ruleset, seed: 3 })
    expect(world.people()).toEqual([])
    expect(createSheet({ ruleset: content.ruleset, profession: 'nurse' }).pool()).toBe(12)
  })

  it('names a profession in the language', () => {
    expect(defaultProfessionName('nurse', 'en')).toBeTruthy()
    expect(defaultProfessionName('nope', 'en')).toBeUndefined()
  })
})

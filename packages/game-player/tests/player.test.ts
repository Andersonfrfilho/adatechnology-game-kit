import { describe, expect, it } from 'vitest'

import { PLAYER_DEFAULTS, createPlayer, deriveVitals, drawWound, playerTextOf } from '../src'

describe('the sheet', () => {
  it('derives the game vitals from the 5-5-5-5-5-5 sheet (G 62005 DERIV)', () => {
    expect(deriveVitals(PLAYER_DEFAULTS.attributes)).toEqual({ maxHealth: 100, maxStamina: 90, runSpeed: 5.8, walkSpeed: 1.6, footstepNoise: 0.8, composure: 55 })
  })

  it('follows the attributes: an agile runner is faster and quieter', () => {
    const agile = createPlayer({ attributes: { agility: 8 } })
    expect(agile.derived.runSpeed).toBeCloseTo(5.2 + 0.96)
    expect(agile.derived.footstepNoise).toBeCloseTo(0.68)
    expect(agile.state.stamina).toBe(agile.derived.maxStamina)
  })
})

describe('normal world first', () => {
  it('has no infection unless the game turns it on', () => {
    const player = createPlayer({ seed: 3 })
    expect(player.infection).toBeNull()
    player.bite()
    for (let k = 0; k < 300; k++) player.update(0.1)
    expect(player.state.infected).toBe(false)
    expect(player.stage()).toBe('none')
  })

  it('turns the body after death when infected', () => {
    const player = createPlayer({ seed: 3, infection: true })
    const events: string[] = []
    player.on('died', (e) => events.push(`died:${e.cause}`))
    player.on('turned', () => events.push('turned'))
    player.on('stage', (e) => events.push(e.stage))
    player.bite()
    player.update(0.1, { bandage: true })
    for (let k = 0; k < 1300; k++) player.update(0.1)
    expect(events).toEqual(['fever', 'delirium', 'died:infection', 'turned'])
    expect(player.state.turned).toBe(true)
  })
})

describe('wounds', () => {
  it('draws scratch, laceration and bite in the game order, the last kind taking the rest', () => {
    const draws = [0.59, 0.6, 0.89, 0.9, 0.999]
    expect(draws.map((d) => drawWound(PLAYER_DEFAULTS.wounds, () => d))).toEqual(['scratch', 'laceration', 'laceration', 'bite', 'bite'])
  })

  it('bleeds on a laceration or a bite, not on a scratch', () => {
    const scratch = createPlayer({ random: () => 0.1 })
    scratch.hurt(5)
    expect(scratch.state.bleeding).toBe(0)
    const cut = createPlayer({ random: () => 0.7 })
    cut.hurt(5)
    expect(cut.state.bleeding).toBe(1)
  })
})

describe('the rest of the body', () => {
  it('saves and loads', () => {
    const player = createPlayer({ seed: 2 })
    player.hurt(10)
    const saved = player.save()
    player.hurt(10)
    player.load(saved)
    expect(player.state.health).toBe(saved.state.health)
  })

  it('makes the aim spread wider with panic, fever and speed', () => {
    const player = createPlayer({ infection: true })
    expect(player.spreadFactor()).toBe(1)
    player.state.panic = 40
    expect(player.spreadFactor()).toBeCloseTo(1.4)
  })

  it('makes the footstep noise of the game: 3 m walking x 0.8, 8 m running x 0.8', () => {
    const player = createPlayer()
    const radii: number[] = []
    player.on('noise', (e) => radii.push(e.radius))
    for (let k = 0; k < 90; k++) player.update(1 / 30, { forward: 1 })
    for (let k = 0; k < 90; k++) player.update(1 / 30, { forward: 1, run: true })
    expect(radii[0]).toBeCloseTo(2.4)
    expect(radii.at(-1)).toBeCloseTo(6.4)
  })

  it('has the game words and their English', () => {
    expect(playerTextOf('bandaged')).toBe('Curativo feito')
    expect(playerTextOf('bandaged', 'en')).toBe('Wound dressed')
    expect(playerTextOf('unknown_id')).toBe('unknown_id')
  })
})

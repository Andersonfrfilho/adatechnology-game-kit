import { describe, expect, it } from 'vitest'

import { CELL, createNavGrid } from '../src'

describe('NavGrid.version', () => {
  it('does not move when fillRect changes no cell', () => {
    const grid = createNavGrid({ size: 32, border: true })
    grid.fillRect(-2, -2, 2, 2, CELL.SOLID, 3)
    const written = grid.version
    grid.fillRect(-2, -2, 2, 2, CELL.SOLID, 3)
    grid.fillRect(100, 100, 120, 120, CELL.SOLID, 3)
    grid.fillRect(-1, -1, 1, 1, CELL.SOLID, 3)
    expect(grid.version).toBe(written)
  })

  it('moves when a cell changes its kind or only its height', () => {
    const grid = createNavGrid({ size: 32, border: true })
    grid.fillRect(-2, -2, 2, 2, CELL.SOLID, 3)
    const written = grid.version
    grid.fillRect(-2, -2, 2, 2, CELL.SOLID, 1)
    expect(grid.version).toBe(written + 1)
    grid.fillRect(-2, -2, 2, 2, CELL.FREE, 1)
    expect(grid.version).toBe(written + 2)
  })
})

// @ts-check
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { batterySkipReason, powerSource, readSupplies } from '../power.mjs'

/** @param {Partial<import('../power.mjs').Supply>} values @returns {import('../power.mjs').Supply} */
const supply = (values) => ({ name: 'x', type: 'Mains', scope: 'System', online: null, status: null, ...values })
const ac = (online = '1') => supply({ name: 'ACAD', type: 'Mains', online })
const battery = (status = 'Discharging') => supply({ name: 'BAT0', type: 'Battery', status })

test('a laptop on the charger runs, unplugged skips', () => {
  assert.equal(powerSource([ac('1'), battery('Charging')]), 'charger')
  assert.equal(powerSource([ac('1'), battery('Not charging')]), 'charger')
  assert.equal(powerSource([ac('0'), battery('Discharging')]), 'battery')
  // the battery full and the charger out still is the battery
  assert.equal(powerSource([ac('0'), battery('Full')]), 'battery')
})

test('a USB-C charger counts as the charger', () => {
  assert.equal(powerSource([ac('0'), supply({ name: 'ucsi-source-psy-USBC000:001', type: 'USB', online: '1' }), battery('Charging')]), 'charger')
})

test('a desktop, a machine with no list and a mouse battery never skip', () => {
  assert.equal(powerSource([ac('1')]), 'charger')
  assert.equal(powerSource([]), 'unknown')
  assert.equal(powerSource([supply({ name: 'hidpp_battery_0', type: 'Battery', scope: 'Device', status: 'Discharging' })]), 'unknown')
  assert.equal(powerSource([ac('1'), supply({ name: 'hidpp_battery_0', type: 'Battery', scope: 'Device', status: 'Discharging' })]), 'charger')
})

test('with no adapter listed, the battery status decides', () => {
  assert.equal(powerSource([battery('Discharging')]), 'battery')
  assert.equal(powerSource([battery('Charging')]), 'charger')
})

test('the skip reason, and PRE_PUSH_ON_BATTERY=1 forces the run', () => {
  const unplugged = [ac('0'), battery()]
  assert.match(batterySkipReason({}, unplugged) ?? '', /on battery/)
  assert.equal(batterySkipReason({ PRE_PUSH_ON_BATTERY: '1' }, unplugged), null)
  assert.equal(batterySkipReason({}, [ac('1'), battery('Charging')]), null)
})

test('reads the kernel folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-'))
  try {
    /** @param {string} name @param {Record<string, string>} files */
    const write = (name, files) => {
      mkdirSync(join(dir, name))
      for (const [file, value] of Object.entries(files)) writeFileSync(join(dir, name, file), `${value}\n`)
    }
    write('ACAD', { type: 'Mains', online: '0' })
    write('BAT1', { type: 'Battery', status: 'Discharging', scope: 'System' })
    assert.equal(powerSource(readSupplies(dir)), 'battery')
    assert.deepEqual(readSupplies(join(dir, 'missing')), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

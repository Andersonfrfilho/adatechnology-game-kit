#!/usr/bin/env node
// `pnpm check:items`: runs the contracts of every item's kind over the goods catalog and exits non-zero when one fails.
// Reads the built package (`dist`), so the root script builds it first.
import { MATERIALS } from '@adatechnology/game-destruction'
import { CALIBERS, WEAPONS } from '@adatechnology/game-weapons'

import { checkGoodsItems, GOODS_ITEMS, GOODS_KNOWN_GAPS } from '../dist/index.js'

const report = checkGoodsItems({
  materials: MATERIALS.map((material) => material.id),
  weaponIds: WEAPONS.map((weapon) => weapon.id),
  calibers: CALIBERS.map((caliber) => caliber.id),
})

for (const problem of report.problems) console.error(`problem: ${problem}`)
const gaps = Object.values(GOODS_KNOWN_GAPS).reduce((sum, list) => sum + list.length, 0)
console.log(`check:items: ${GOODS_ITEMS.length} items, ${report.problems.length} problems, ${report.allowed.length} allowed gaps (${gaps} listed in known-gaps.json)`)
for (const allowed of report.allowed) console.log(`  allowed: ${allowed}`)
process.exit(report.ok ? 0 : 1)

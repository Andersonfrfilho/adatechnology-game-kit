// @ts-check
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertGpuIsHardware, assertReportHasHealthyGpu, driverHealthOf, driverVerdictOf, gpuMismatchReasons, isSoftwareRenderer, normalizedGpuName, parseModuleVersion, parseSmiVersion, readDriverHealth, readGpuIdentity, tierOf, userspaceVersionOf, versionOfLibraryPath,
} from '../gpu-info.mjs'
import { explosionGateOf } from '../room-explosion.mjs'
import { mergeBase, trySaveBase } from '../room-explosion-base.mjs'

const MODULE_TEXT = 'NVRM version: NVIDIA UNIX Open Kernel Module for x86_64  615.78.08  Release Build  (root@)  \nGCC version:  gcc version 16.2.1\n'
const RTX = 'NVIDIA GeForce RTX 5070 Laptop GPU'
const driver = (/** @type {string} */ module, /** @type {boolean | 'unknown'} */ mismatch = false) => ({ module, userspace: module, mismatch })
const gpu = (/** @type {string} */ renderer, /** @type {string} */ module) => ({ renderer, vendor: 'NVIDIA Corporation', tier: /** @type {const} */ ('discrete'), driver: driver(module) })

test('renderer classification: software GL and unknown are software, a card is not; the tier follows the vendor', () => {
  for (const software of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)', 'llvmpipe (LLVM 19)', 'Mesa softpipe', 'unknown']) assert.equal(isSoftwareRenderer(software), true, software)
  assert.equal(isSoftwareRenderer(RTX), false)
  assert.equal(isSoftwareRenderer('Mesa Intel(R) Graphics (ADL GT2)'), false)
  assert.equal(tierOf(RTX), 'discrete')
  assert.equal(tierOf('AMD Radeon RX 7600'), 'discrete')
  assert.equal(tierOf('Mesa Intel(R) Graphics'), 'integrated')
})

test('readGpuIdentity takes the renderer and vendor of the page and classifies the tier', async () => {
  const identity = await readGpuIdentity({ evaluate: async () => ({ renderer: RTX, vendor: 'NVIDIA Corporation' }) })
  assert.deepEqual(identity, { renderer: RTX, vendor: 'NVIDIA Corporation', tier: 'discrete' })
})

test('assertGpuIsHardware refuses software GL and lets a card through', () => {
  assert.throws(() => assertGpuIsHardware({ renderer: 'ANGLE (SwiftShader Device)', vendor: 'Google Inc.', tier: 'integrated' }), /software GL/)
  assert.throws(() => assertGpuIsHardware({ renderer: 'unknown', vendor: 'unknown', tier: 'integrated' }), /software GL/)
  assert.doesNotThrow(() => assertGpuIsHardware({ renderer: RTX, vendor: 'NVIDIA Corporation', tier: 'discrete' }))
})

test('versions: the kernel module line, a library path and the nvidia-smi output', () => {
  assert.equal(parseModuleVersion(MODULE_TEXT), '615.78.08')
  assert.equal(parseModuleVersion('NVRM version: NVIDIA UNIX x86_64 Kernel Module  550.54  Sun Mar'), '550.54')
  assert.equal(parseModuleVersion('nothing here'), null)
  assert.equal(parseModuleVersion(undefined), null)
  assert.equal(versionOfLibraryPath('/usr/lib/libnvidia-ml.so.620.73.04'), '620.73.04')
  assert.equal(versionOfLibraryPath('/usr/lib/libnvidia-ml.so.1'), null)
  assert.equal(parseSmiVersion('620.73.04\n'), '620.73.04')
  assert.equal(parseSmiVersion('Failed to initialize NVML: Driver/library version mismatch'), null)
})

const DOCKER_LINE = 'Nov 21 09:12:01 host kernel: NVRM: API mismatch: the client has the version 550.1, but this kernel module has the version 620.73.04.'
const CHROME_LINE = 'Nov 21 09:12:01 host kernel: NVRM: API mismatch: the client chrome (pid 12) has the version 620.73.04, but this kernel module has the version 615.78.08.'

test('driver health: equal readable versions are healthy whatever the journal says (an old Docker line, a healed mismatch)', () => {
  const health = driverHealthOf({ moduleText: MODULE_TEXT, userspaceVersion: '615.78.08', journalText: `${DOCKER_LINE}\n${CHROME_LINE}` })
  assert.deepEqual(health, { module: '615.78.08', userspace: '615.78.08', mismatch: false, journalLines: 2 })
})

test('driver health: module 615 against userspace 620 is a mismatch (the 2026-11-21 incident)', () => {
  assert.deepEqual(driverHealthOf({ moduleText: MODULE_TEXT, userspaceVersion: '620.73.04' }), { module: '615.78.08', userspace: '620.73.04', mismatch: true, journalLines: 0 })
})

test('driver health: without the library version, nvidia-smi decides: its failure text is a mismatch, a success is healthy', () => {
  const failing = driverHealthOf({ moduleText: MODULE_TEXT, smi: () => ({ ok: false, text: 'Failed to initialize NVML: Driver/library version mismatch' }) })
  assert.equal(failing.mismatch, true)
  const healthy = driverHealthOf({ moduleText: MODULE_TEXT, smi: () => ({ ok: true, text: '615.78.08\n' }) })
  assert.equal(healthy.mismatch, false)
  assert.equal(healthy.userspace, '615.78.08')
  assert.equal(driverHealthOf({ moduleText: MODULE_TEXT, smi: () => ({ ok: false, text: 'could not communicate with the NVIDIA driver' }) }).mismatch, 'unknown')
})

test('driver health: the journal only counts with everything unreadable, and only lines that name the browser', () => {
  assert.equal(driverHealthOf({ journalText: CHROME_LINE }).mismatch, true)
  assert.equal(driverHealthOf({ journalText: DOCKER_LINE }).mismatch, 'unknown')
  assert.equal(driverHealthOf({ moduleText: MODULE_TEXT, journalText: CHROME_LINE }).mismatch, 'unknown')
})

test('driver health: everything unreadable is unknown, with the reason', () => {
  assert.deepEqual(driverHealthOf({}), { module: null, userspace: null, mismatch: 'unknown', reason: 'userspace not found', journalLines: 0 })
  assert.equal(driverHealthOf({ userspaceVersion: '620.73.04' }).reason, 'kernel module version not readable')
})

/** A temp tree of library directories: `<dir>/libnvidia-ml.so.1` linking to a versioned file, plus leftovers. @returns {{ first: string, second: string }} */
const libraryTree = () => {
  const root = mkdtempSync(join(tmpdir(), 'gpu-info-'))
  const first = join(root, 'lib')
  const second = join(root, 'lib64')
  for (const directory of [first, second]) mkdirSync(directory)
  writeFileSync(join(first, 'libnvidia-ml.so.615.78.08'), '')
  writeFileSync(join(first, 'libnvidia-ml.so.620.73.04'), '')
  symlinkSync('libnvidia-ml.so.620.73.04', join(first, 'libnvidia-ml.so.1'))
  writeFileSync(join(second, 'libnvidia-ml.so.550.1'), '')
  symlinkSync('libnvidia-ml.so.550.1', join(second, 'libnvidia-ml.so.1'))
  return { first, second }
}

test('userspaceVersionOf follows the libnvidia-ml.so.1 link of the first directory: a stale leftover beside it never hides a mismatch', () => {
  const { first, second } = libraryTree()
  assert.equal(userspaceVersionOf({ directories: [first, second], realpath: realpathSync }), '620.73.04')
  assert.equal(userspaceVersionOf({ directories: [second, first], realpath: realpathSync }), '550.1')
  assert.equal(userspaceVersionOf({ directories: [join(first, 'missing'), second], realpath: realpathSync }), '550.1')
  assert.equal(userspaceVersionOf({ directories: [join(first, 'missing')], realpath: realpathSync }), null)
  assert.equal(driverHealthOf({ moduleText: MODULE_TEXT, userspaceVersion: userspaceVersionOf({ directories: [first], realpath: realpathSync }) }).mismatch, true)
})

const FAIL = (/** @type {string} */ code) => () => { throw Object.assign(new Error(code), { code }) }
const machineOf = (/** @type {Partial<import('../gpu-info.mjs').MachineAccess>} */ parts) => ({ readFile: FAIL('ENOENT'), realpath: FAIL('ENOENT'), run: () => undefined, ...parts })

test('readDriverHealth never throws: a missing tool, a refused read, a timeout and a huge output each leave a source out', () => {
  const huge = { ok: true, text: 'x'.repeat(5_000_000) }
  const failures = [
    machineOf({}),
    machineOf({ readFile: FAIL('EACCES'), realpath: FAIL('EACCES'), run: FAIL('EACCES') }),
    machineOf({ run: () => undefined }),
    machineOf({ run: FAIL('ETIMEDOUT') }),
    machineOf({ run: () => huge }),
  ]
  for (const machine of failures) {
    const health = readDriverHealth({ platform: 'linux', renderer: RTX, machine })
    assert.equal(health.mismatch, 'unknown')
    assert.equal(health.reason, 'userspace not found')
  }
})

test('readDriverHealth reads the module, the library link and nvidia-smi through the injected machine', () => {
  const { first } = libraryTree()
  const machine = machineOf({ readFile: () => MODULE_TEXT, realpath: realpathSync })
  assert.deepEqual(readDriverHealth({ platform: 'linux', renderer: RTX, machine, libraryDirectories: [first] }), { module: '615.78.08', userspace: '620.73.04', mismatch: true, journalLines: 0 })
  const noLibrary = machineOf({ readFile: () => MODULE_TEXT, run: (command) => (command === 'nvidia-smi' ? { ok: false, text: 'Driver/library version mismatch' } : undefined) })
  assert.equal(readDriverHealth({ platform: 'linux', renderer: RTX, machine: noLibrary }).mismatch, true)
})

test('readDriverHealth skips without looking outside Linux or without an NVIDIA renderer', () => {
  const unknown = { module: null, userspace: null, mismatch: 'unknown' }
  const exploding = machineOf({ readFile: () => { throw new Error('must not be read') }, run: () => { throw new Error('must not run') } })
  assert.deepEqual(readDriverHealth({ platform: 'darwin', renderer: RTX, machine: exploding }), unknown)
  assert.deepEqual(readDriverHealth({ platform: 'linux', renderer: 'Mesa Intel(R) Graphics', machine: exploding }), unknown)
})

test('driverVerdictOf: a mismatch on NVIDIA throws a reboot message, unknown warns, healthy and non-NVIDIA are silent', () => {
  assert.throws(() => driverVerdictOf({ renderer: RTX, vendor: 'NVIDIA Corporation', driver: driver('615.78.08', true) }), /reboot/)
  assert.match(String(driverVerdictOf({ renderer: RTX, vendor: 'NVIDIA Corporation', driver: driver('615.78.08', 'unknown') })), /WARNING/)
  assert.equal(driverVerdictOf({ renderer: RTX, vendor: 'NVIDIA Corporation', driver: driver('620.73.04') }), undefined)
  assert.equal(driverVerdictOf({ renderer: 'Mesa Intel(R) Graphics', vendor: 'Intel', driver: { module: null, userspace: null, mismatch: 'unknown' } }), undefined)
})

test('a report is refused as a base without machine.gpu, on software GL or with a driver mismatch', () => {
  assert.throws(() => assertReportHasHealthyGpu({}), /no machine.gpu/)
  assert.throws(() => assertReportHasHealthyGpu({ machine: {} }), /no machine.gpu/)
  assert.throws(() => assertReportHasHealthyGpu({ machine: { gpu: { ...gpu('llvmpipe (LLVM 19)', '620.73.04') } } }), /software GL/)
  assert.throws(() => assertReportHasHealthyGpu({ machine: { gpu: { ...gpu(RTX, '615.78.08'), driver: driver('615.78.08', true) } } }), /API mismatch/)
  assert.doesNotThrow(() => assertReportHasHealthyGpu({ machine: { gpu: gpu(RTX, '620.73.04') } }))
  assert.doesNotThrow(() => assertReportHasHealthyGpu({ machine: { gpu: { ...gpu(RTX, '620.73.04'), driver: driver('620.73.04', 'unknown') } } }))
})

test('normalizedGpuName drops the version-like parts only', () => {
  assert.equal(normalizedGpuName('ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 5070 Laptop GPU/PCIe/SSE2, OpenGL ES 3.2)'), 'ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 5070 Laptop GPU/PCIe/SSE2, OpenGL ES)')
  assert.equal(normalizedGpuName('Mesa Intel(R) Graphics 24.1.2'), 'Mesa Intel(R) Graphics')
})

test('gpuMismatchReasons: one reason per cause; same GPU and driver, or a version suffix alone, compare', () => {
  const other = gpuMismatchReasons(gpu(RTX, '615.78.08'), gpu('AMD Radeon RX 7600', '620.73.04'))
  assert.equal(other.length, 2)
  assert.match(other[0] ?? '', /AMD Radeon/)
  assert.match(other[1] ?? '', /615\.78\.08.*620\.73\.04/)
  assert.equal(gpuMismatchReasons(gpu(RTX, '615.78.08'), gpu(RTX, '620.73.04')).length, 1)
  assert.deepEqual(gpuMismatchReasons(gpu(RTX, '620.73.04'), gpu(RTX, '620.73.04')), [])
  assert.deepEqual(gpuMismatchReasons(gpu(`${RTX} OpenGL ES 3.2`, '620.73.04'), gpu(`${RTX} OpenGL ES 3.3`, '620.73.04')), [])
  assert.deepEqual(gpuMismatchReasons(gpu(RTX, '620.73.04'), { renderer: RTX, driver: { module: null } }), [])
})

test('a base without machine.gpu is not comparable: its numbers may be of another driver', () => {
  const reasons = gpuMismatchReasons(undefined, gpu(RTX, '620.73.04'))
  assert.equal(reasons.length, 1)
  assert.match(reasons[0] ?? '', /não registra a placa/)
})

const VARIANT = 'jolt-d4-worker'
const metric = (/** @type {number} */ f0Ms) => ({ variant: VARIANT, throttle: 1, kind: 'blast', f0Ms, afterMs: 25 })
const night = (/** @type {number} */ f0Ms, /** @type {ReturnType<typeof gpu>} */ machineGpu) => ({ budgetMode: 'deadline', cells: [{ variant: VARIANT, throttle: 1, kind: 'blast', p99: 5, max: 20 }], frameMetrics: [metric(f0Ms)], machine: { gpu: machineGpu } })

test('mergeBase: a night on another renderer or driver neither merges into nor replaces the base', () => {
  const base = night(65, gpu(RTX, '620.73.04'))
  assert.equal(mergeBase(base, night(40, gpu('AMD Radeon RX 7600', '620.73.04'))), base)
  assert.equal(mergeBase(base, night(40, gpu(RTX, '615.78.08'))), base)
  assert.equal(mergeBase(base, night(40, gpu(RTX, '620.73.04')))?.frameMetrics?.[0]?.f0Ms, 40)
})

test('mergeBase: a base from before the GPU was recorded is neither merged nor replaced', () => {
  const legacy = { budgetMode: 'deadline', frameMetrics: [metric(65)] }
  assert.equal(mergeBase(legacy, night(60, gpu(RTX, '620.73.04'))), legacy)
})

test('trySaveBase says why the base was left as it was, so the nightly can warn; nothing to say when it merged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gpu-skip-'))
  const report = join(dir, 'report.json')
  const baseFile = join(dir, 'base.json')
  const HEAD = 'b'.repeat(40)
  const build = { commit: HEAD, dirty: false, builtAt: '2026-11-21T00:00:00.000Z' }
  writeFileSync(baseFile, JSON.stringify(night(65, gpu(RTX, '615.78.08'))))
  writeFileSync(report, JSON.stringify({ ...night(60, gpu(RTX, '620.73.04')), pageBuild: build }))
  const skipped = trySaveBase(report, baseFile, HEAD)
  assert.equal(skipped.ok && skipped.skipped !== undefined, true)
  writeFileSync(baseFile, JSON.stringify(night(65, gpu(RTX, '620.73.04'))))
  assert.deepEqual(trySaveBase(report, baseFile, HEAD), { ok: true })
})

test('explosionGateOf: a base from another GPU or driver is not compared and says why; the same one blocks a regression', () => {
  const measure = { metrics: [metric(100)], problems: [] }
  const params = { measure, mode: 'deadline', explosive: 'c4', gated: new Set([1]) }
  const base = night(65, gpu(RTX, '620.73.04'))
  const other = explosionGateOf({ ...params, savedBase: base, gpu: gpu(RTX, '615.78.08') })
  assert.equal(other.isBaseInMode, false)
  assert.equal(other.frameVerdict.compared, false)
  assert.equal(other.frameVerdict.status, 'other-gpu')
  assert.match(other.frameVerdict.reason, /615\.78\.08/)
  assert.equal(other.frameVerdict.regressions.length, 0)
  const same = explosionGateOf({ ...params, savedBase: base, gpu: gpu(RTX, '620.73.04') })
  assert.equal(same.isBaseInMode, true)
  assert.equal(same.frameVerdict.regressions.length, 1)
})

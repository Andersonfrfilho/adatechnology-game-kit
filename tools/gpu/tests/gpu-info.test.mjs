// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertGpuIsHardware, assertReportHasHealthyGpu, driverHealthOf, driverVerdictOf, gpuMismatchReason, isSoftwareRenderer, parseModuleVersion, parseSmiVersion, readDriverHealth, readGpuIdentity, tierOf, userspaceVersionsOf,
} from '../gpu-info.mjs'
import { explosionGateOf } from '../room-explosion.mjs'
import { mergeBase } from '../room-explosion-base.mjs'

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

test('versions: the kernel module line, the libnvidia-ml file names and the nvidia-smi output', () => {
  assert.equal(parseModuleVersion(MODULE_TEXT), '615.78.08')
  assert.equal(parseModuleVersion('NVRM version: NVIDIA UNIX x86_64 Kernel Module  550.54  Sun Mar'), '550.54')
  assert.equal(parseModuleVersion('nothing here'), null)
  assert.equal(parseModuleVersion(undefined), null)
  assert.deepEqual(userspaceVersionsOf(['libnvidia-ml.so', 'libnvidia-ml.so.1', 'libnvidia-ml.so.620.73.04', 'libcuda.so.620.73.04']), ['620.73.04'])
  assert.equal(parseSmiVersion('620.73.04\n'), '620.73.04')
  assert.equal(parseSmiVersion('Failed to initialize NVML: Driver/library version mismatch'), null)
})

test('driver health: module 615 against userspace 620 is a mismatch, equal versions are healthy', () => {
  assert.deepEqual(driverHealthOf({ moduleText: MODULE_TEXT, libraryNames: ['libnvidia-ml.so.620.73.04'] }), { module: '615.78.08', userspace: '620.73.04', mismatch: true })
  assert.deepEqual(driverHealthOf({ moduleText: MODULE_TEXT, libraryNames: ['libnvidia-ml.so.615.78.08'] }), { module: '615.78.08', userspace: '615.78.08', mismatch: false })
  assert.equal(driverHealthOf({ moduleText: MODULE_TEXT, libraryNames: ['libnvidia-ml.so.620.73.04', 'libnvidia-ml.so.615.78.08'] }).mismatch, false)
})

test('driver health: nvidia-smi falling back to the userspace version, and its failure text as the mismatch signal', () => {
  assert.deepEqual(driverHealthOf({ moduleText: MODULE_TEXT, smi: { ok: true, text: '615.78.08\n' } }), { module: '615.78.08', userspace: '615.78.08', mismatch: false })
  assert.equal(driverHealthOf({ moduleText: MODULE_TEXT, smi: { ok: true, text: '620.73.04\n' } }).mismatch, true)
  assert.equal(driverHealthOf({ smi: { ok: false, text: 'Failed to initialize NVML: Driver/library version mismatch\nNVML library version: 620.73' } }).mismatch, true)
  assert.equal(driverHealthOf({ smi: { ok: false, text: 'NVIDIA-SMI has failed because it could not communicate with the NVIDIA driver' } }).mismatch, 'unknown')
})

test('driver health: the kernel journal line is a mismatch signal, a clean journal alone is not proof', () => {
  const line = 'Nov 21 09:12:01 host kernel: NVRM: API mismatch: the client has the version 620.73.04, but this kernel module has the version 615.78.08.'
  assert.equal(driverHealthOf({ journalText: line }).mismatch, true)
  assert.equal(driverHealthOf({ moduleText: MODULE_TEXT, libraryNames: ['libnvidia-ml.so.615.78.08'], journalText: line }).mismatch, true)
  assert.equal(driverHealthOf({ journalText: 'Nov 21 kernel: all quiet' }).mismatch, 'unknown')
  assert.equal(driverHealthOf({}).mismatch, 'unknown')
})

test('readDriverHealth skips without looking outside Linux or without an NVIDIA renderer', () => {
  const unknown = { module: null, userspace: null, mismatch: 'unknown' }
  assert.deepEqual(readDriverHealth({ platform: 'darwin', renderer: RTX }), unknown)
  assert.deepEqual(readDriverHealth({ platform: 'linux', renderer: 'Mesa Intel(R) Graphics' }), unknown)
  assert.doesNotThrow(() => readDriverHealth({ platform: 'linux', renderer: RTX }))
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

test('gpuMismatchReason: another renderer or driver module differs, the same one and a base without GPU compare', () => {
  assert.match(String(gpuMismatchReason(gpu(RTX, '620.73.04'), gpu('AMD Radeon RX 7600', '620.73.04'))), /AMD Radeon/)
  assert.match(String(gpuMismatchReason(gpu(RTX, '615.78.08'), gpu(RTX, '620.73.04'))), /615\.78\.08.*620\.73\.04/)
  assert.equal(gpuMismatchReason(gpu(RTX, '620.73.04'), gpu(RTX, '620.73.04')), undefined)
  assert.equal(gpuMismatchReason(undefined, gpu(RTX, '620.73.04')), undefined)
  assert.equal(gpuMismatchReason(gpu(RTX, '620.73.04'), { renderer: RTX, driver: { module: null } }), undefined)
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

test('mergeBase: a base from before the GPU was recorded still merges and takes the GPU of the night', () => {
  const merged = mergeBase({ budgetMode: 'deadline', frameMetrics: [metric(65)] }, night(60, gpu(RTX, '620.73.04')))
  assert.equal(merged?.machine?.gpu?.renderer, RTX)
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

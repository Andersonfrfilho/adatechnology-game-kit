// @ts-check
// Which GPU drew a measurement, and whether its driver was healthy. On 2026-11-21 the NVIDIA userspace was upgraded without a reboot (620.73.04 over a 615.78.08
// kernel module): six hours of gauge runs logged `NVRM: API mismatch` and read the frame after an explosion at ~105 ms instead of ~26 ms, and nothing in the report said so.
// The pure parts are exported for tests; `readDriverHealth` is the thin wrapper over the machine and never throws.

import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'

/** @typedef {{ renderer: string, vendor: string, tier: 'discrete' | 'integrated' }} GpuIdentity */
/** @typedef {{ module: string | null, userspace: string | null, mismatch: boolean | 'unknown', reason?: string, journalLines?: number }} DriverHealth */
/** @typedef {GpuIdentity & { driver: DriverHealth }} Gpu */

export const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|unknown/i
const NVIDIA_PATTERN = /nvidia/i
const SMI_MISMATCH = /driver\/library version mismatch|failed to initialize nvml/i
const API_MISMATCH = /NVRM: API mismatch/i
const BROWSER_CLIENT = /chrome|chromium|playwright|node/i
const UNKNOWN_DRIVER = /** @type {DriverHealth} */ ({ module: null, userspace: null, mismatch: 'unknown' })

/** @param {string} renderer */
export const isSoftwareRenderer = (renderer) => SOFTWARE_RENDERERS.test(renderer)

/** @param {string} text a renderer or vendor string */
export const isNvidia = (text) => NVIDIA_PATTERN.test(text)

/** @param {string} renderer @returns {'discrete' | 'integrated'} */
export const tierOf = (renderer) => (/nvidia|radeon|amd/i.test(renderer) && !/intel/i.test(renderer) ? 'discrete' : 'integrated')

const readGpuInPage = () => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const info = gl?.getExtension('WEBGL_debug_renderer_info')
  if (!gl || !info) return { renderer: 'unknown', vendor: 'unknown' }
  return { renderer: String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)), vendor: String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)) }
}

/**
 * The renderer and vendor the browser's own WebGL context reports, with the tier.
 * @param {{ evaluate: (fn: (arg: undefined) => { renderer: string, vendor: string }, arg: undefined) => Promise<{ renderer: string, vendor: string }> }} page
 * @returns {Promise<GpuIdentity>}
 */
export const readGpuIdentity = async (page) => {
  const { renderer, vendor } = await page.evaluate(readGpuInPage, undefined)
  return { renderer, vendor, tier: tierOf(renderer) }
}

/** A gauge on software GL measures the CPU rasterizer: its times never count. @param {GpuIdentity} identity */
export const assertGpuIsHardware = (identity) => {
  if (isSoftwareRenderer(identity.renderer)) throw new Error(`room-explosion: WebGL draws on ${identity.renderer} (software GL): its times never count, refusing to measure (needs the real GPU)`)
}

/** "NVRM version: NVIDIA UNIX Open Kernel Module for x86_64  615.78.08  Release Build ..." -> "615.78.08". @param {string | undefined} text @returns {string | null} */
export const parseModuleVersion = (text) => /NVRM version:.*?\s(\d+\.\d+(?:\.\d+)?)\s/.exec(text ?? '')?.[1] ?? null

/** `nvidia-smi --query-gpu=driver_version --format=csv,noheader` output -> the version, or null. @param {string | undefined} text @returns {string | null} */
export const parseSmiVersion = (text) => /^(\d+\.\d+(?:\.\d+)?)$/m.exec((text ?? '').trim())?.[1] ?? null

/** The version in the file name a `libnvidia-ml.so.1` link resolves to. @param {string | undefined} path @returns {string | null} */
export const versionOfLibraryPath = (path) => /libnvidia-ml\.so\.(\d+\.\d+(?:\.\d+)?)$/.exec(path ?? '')?.[1] ?? null

/** The `NVRM: API mismatch` lines of a kernel log; `clientOnly` keeps those that name the browser or the gauge as the client. @param {string | undefined} text @param {boolean} clientOnly @returns {string[]} */
export const apiMismatchLinesOf = (text, clientOnly) =>
  (text ?? '').split('\n').filter((line) => API_MISMATCH.test(line) && (!clientOnly || BROWSER_CLIENT.test(line)))

/**
 * The health of the NVIDIA driver. The VERSION COMPARISON is authoritative: the kernel module (/proc/driver/nvidia/version) against the userspace library on disk; equal and readable is
 * `false` whatever the journal says (a line of the boot may come from a Docker VM or a flatpak, or be of a mismatch that healed). Without the userspace version, `nvidia-smi` decides (its
 * failure text is the mismatch signal; a success is healthy). Only with both unreadable does the journal count, and then only the lines naming the browser as the client.
 * @param {{ moduleText?: string, userspaceVersion?: string | null, smi?: () => { ok: boolean, text: string } | undefined, journalText?: string }} sources
 * @returns {DriverHealth}
 */
export const driverHealthOf = ({ moduleText, userspaceVersion = null, smi, journalText }) => {
  const module = parseModuleVersion(moduleText)
  const journalLines = apiMismatchLinesOf(journalText, false).length
  if (module !== null && userspaceVersion !== null) return { module, userspace: userspaceVersion, mismatch: module !== userspaceVersion, journalLines }
  const smiResult = smi?.()
  if (smiResult && !smiResult.ok && SMI_MISMATCH.test(smiResult.text)) return { module, userspace: userspaceVersion, mismatch: true, reason: 'nvidia-smi: driver/library version mismatch', journalLines }
  const smiVersion = smiResult?.ok ? parseSmiVersion(smiResult.text) : null
  if (smiVersion !== null) return { module, userspace: smiVersion, mismatch: false, reason: 'userspace library not found, nvidia-smi answers', journalLines }
  if (module === null && userspaceVersion === null && apiMismatchLinesOf(journalText, true).length > 0) return { module, userspace: userspaceVersion, mismatch: true, reason: 'journal: NVRM API mismatch from the browser', journalLines }
  return { module, userspace: userspaceVersion, mismatch: 'unknown', reason: userspaceVersion === null ? 'userspace not found' : 'kernel module version not readable', journalLines }
}

const LIBRARY_DIRECTORIES = ['/usr/lib', '/usr/lib64', '/usr/lib/x86_64-linux-gnu']
const TOOL_TIMEOUT_MS = 1000

/** @param {string} command @param {string[]} args @returns {{ ok: boolean, text: string } | undefined} undefined when the tool is missing, times out or cannot run */
const runTool = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: TOOL_TIMEOUT_MS, maxBuffer: 1024 * 1024 })
  if (result.error || result.status === null) return undefined
  return { ok: result.status === 0, text: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

/** @typedef {{ readFile: (path: string) => string, realpath: (path: string) => string, run: (command: string, args: string[]) => { ok: boolean, text: string } | undefined }} MachineAccess */
/** @type {MachineAccess} */
const REAL_MACHINE = { readFile: (path) => readFileSync(path, 'utf8'), realpath: (path) => realpathSync(path), run: runTool }

/** @template T @param {() => T} read @returns {T | undefined} */
const safely = (read) => {
  try {
    return read()
  } catch {
    return undefined
  }
}

/**
 * The userspace library the loader would use: the target of `libnvidia-ml.so.1` in the first of the standard directories that has one (the order of `directories`; a stale file left
 * in a later directory or beside the link never counts). Its file name carries the version.
 * @param {{ directories?: string[], realpath: MachineAccess['realpath'] }} params @returns {string | null}
 */
export const userspaceVersionOf = ({ directories = LIBRARY_DIRECTORIES, realpath }) => {
  for (const directory of directories) {
    const version = versionOfLibraryPath(safely(() => realpath(`${directory}/libnvidia-ml.so.1`)))
    if (version !== null) return version
  }
  return null
}

/**
 * Reads the driver health on Linux with an NVIDIA renderer; anywhere else it is `unknown` without looking. Best effort and never throws: a missing tool, a timeout or a
 * refused read leaves its source out. The child processes together stay under 3 s (1 s each, `nvidia-smi` only when the library version is unreadable).
 * @param {{ platform?: string, renderer: string, machine?: MachineAccess, libraryDirectories?: string[] }} params
 * @returns {DriverHealth}
 */
export const readDriverHealth = ({ platform = process.platform, renderer, machine = REAL_MACHINE, libraryDirectories }) => {
  if (platform !== 'linux' || !isNvidia(renderer)) return UNKNOWN_DRIVER
  return driverHealthOf({
    moduleText: safely(() => machine.readFile('/proc/driver/nvidia/version')),
    userspaceVersion: userspaceVersionOf({ ...(libraryDirectories ? { directories: libraryDirectories } : {}), realpath: machine.realpath }),
    smi: () => safely(() => machine.run('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader'])),
    journalText: safely(() => machine.run('journalctl', ['-k', '-b', '--no-pager', '--since', '-10min', '-n', '200'])?.text),
  })
}

/**
 * Refuses an NVIDIA run whose driver is in API mismatch (reboot needed); returns a warning when the health could not be told, undefined when fine or not NVIDIA.
 * @param {Pick<Gpu, 'renderer' | 'vendor' | 'driver'>} gpu @returns {string | undefined}
 */
export const driverVerdictOf = (gpu) => {
  if (!isNvidia(`${gpu.renderer} ${gpu.vendor}`)) return undefined
  if (gpu.driver.mismatch === true) {
    throw new Error(`room-explosion: NVIDIA driver in API mismatch (kernel module ${gpu.driver.module ?? '?'}, userspace ${gpu.driver.userspace ?? '?'}): the frame times are wrong, reboot the machine and run again`)
  }
  if (gpu.driver.mismatch === 'unknown') return `room-explosion: WARNING the NVIDIA driver health could not be read (${gpu.driver.reason ?? 'versions unknown'}): check dmesg or journalctl -k -b for NVRM: API mismatch before trusting the times`
  return undefined
}

/** The GPU name without version-like parts ("OpenGL ES 3.2", "Mesa 24.1"), so a driver bump alone does not make it another GPU. @param {string} renderer */
export const normalizedGpuName = (renderer) => renderer.replace(/\b\d+(?:\.\d+)+\b/g, '').replace(/\s+/g, ' ').replace(/\s+([,)/])/g, '$1').trim()

/**
 * Why a base must not be compared with this run, one reason per cause (another GPU, another driver module, a base that does not say which GPU it was measured on); empty when it can be.
 * @param {{ renderer?: string, driver?: { module?: string | null } } | undefined} baseGpu @param {{ renderer?: string, driver?: { module?: string | null } } | undefined} nowGpu
 * @returns {string[]}
 */
export const gpuMismatchReasons = (baseGpu, nowGpu) => {
  if (!nowGpu?.renderer) return []
  if (!baseGpu?.renderer) return ['a base não registra a placa (anterior ao campo machine.gpu): os números dela podem ser de outro driver']
  const reasons = []
  if (normalizedGpuName(baseGpu.renderer) !== normalizedGpuName(nowGpu.renderer)) reasons.push(`a base medida na placa ${baseGpu.renderer}, esta rodada em ${nowGpu.renderer}`)
  const was = baseGpu.driver?.module
  const now = nowGpu.driver?.module
  if (was && now && was !== now) reasons.push(`a base medida com o driver ${was}, esta rodada com ${now}`)
  return reasons
}

/**
 * A report is only fit to be a base when it says which GPU drew, on hardware, with a driver not in API mismatch.
 * @param {{ machine?: { gpu?: Partial<Gpu> } }} report
 */
export const assertReportHasHealthyGpu = (report) => {
  const gpu = report.machine?.gpu
  if (!gpu?.renderer) throw new Error('base: the report has no machine.gpu (the gauge did not record which GPU drew): refusing to save it as the base')
  if (isSoftwareRenderer(gpu.renderer)) throw new Error(`base: the report was measured on ${gpu.renderer} (software GL): refusing to save it as the base`)
  if (gpu.driver?.mismatch === true) throw new Error(`base: the report was measured with the NVIDIA driver in API mismatch (module ${gpu.driver.module ?? '?'}, userspace ${gpu.driver.userspace ?? '?'}): refusing to save it as the base`)
}

// @ts-check
// Which GPU drew a measurement, and whether its driver was healthy. On 2026-11-21 the NVIDIA userspace was upgraded without a reboot (620.73.04 over a 615.78.08
// kernel module): six hours of gauge runs logged `NVRM: API mismatch` and read the frame after an explosion at ~105 ms instead of ~26 ms, and nothing in the report said so.
// The pure parts are exported for tests; `readDriverHealth` is the thin wrapper over the machine and never throws.

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

/** @typedef {{ renderer: string, vendor: string, tier: 'discrete' | 'integrated' }} GpuIdentity */
/** @typedef {{ module: string | null, userspace: string | null, mismatch: boolean | 'unknown' }} DriverHealth */
/** @typedef {GpuIdentity & { driver: DriverHealth }} Gpu */

export const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|unknown/i
const NVIDIA_PATTERN = /nvidia/i
const SMI_MISMATCH = /driver\/library version mismatch|failed to initialize nvml/i
const API_MISMATCH = /NVRM: API mismatch/i
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

/** The versions of the libnvidia-ml.so.<version> files of a library directory (the userspace the browser and nvidia-smi load). @param {string[]} fileNames @returns {string[]} */
export const userspaceVersionsOf = (fileNames) =>
  fileNames.flatMap((name) => /^libnvidia-ml\.so\.(\d+\.\d+(?:\.\d+)?)$/.exec(name)?.[1] ?? [])

/** `nvidia-smi --query-gpu=driver_version --format=csv,noheader` output -> the version, or null. @param {string | undefined} text @returns {string | null} */
export const parseSmiVersion = (text) => /^(\d+\.\d+(?:\.\d+)?)$/m.exec((text ?? '').trim())?.[1] ?? null

/**
 * The health of the NVIDIA driver from what the machine says; a positive signal of mismatch (versions that differ, nvidia-smi's own failure text, the kernel's
 * `NVRM: API mismatch`) wins, `false` needs both versions known and equal, anything else is `unknown`.
 * @param {{ moduleText?: string, libraryNames?: string[], smi?: { ok: boolean, text: string }, journalText?: string }} sources
 * @returns {DriverHealth}
 */
export const driverHealthOf = ({ moduleText, libraryNames = [], smi, journalText }) => {
  const module = parseModuleVersion(moduleText)
  const libraryVersions = userspaceVersionsOf(libraryNames)
  const smiVersion = smi?.ok ? parseSmiVersion(smi.text) : null
  const userspace = module !== null && libraryVersions.includes(module) ? module : (libraryVersions[0] ?? smiVersion)
  const hasSignal = (smi !== undefined && !smi.ok && SMI_MISMATCH.test(smi.text)) || API_MISMATCH.test(journalText ?? '')
  if (hasSignal || (module !== null && userspace !== null && module !== userspace)) return { module, userspace, mismatch: true }
  if (module !== null && userspace !== null) return { module, userspace, mismatch: false }
  return { module, userspace, mismatch: 'unknown' }
}

/** @param {() => string | undefined} read @returns {string | undefined} */
const safely = (read) => {
  try {
    return read()
  } catch {
    return undefined
  }
}

const LIBRARY_DIRECTORIES = ['/usr/lib', '/usr/lib64', '/usr/lib/x86_64-linux-gnu']

/** @param {string} command @param {string[]} args @returns {{ ok: boolean, text: string } | undefined} undefined when the tool is missing */
const runTool = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 * 1024 })
  if (result.error) return undefined
  return { ok: result.status === 0, text: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

/**
 * Reads the driver health on Linux with an NVIDIA renderer; anywhere else it is `unknown` without looking. Best effort: a missing tool or file leaves its source out.
 * @param {{ platform?: string, renderer: string }} params
 * @returns {DriverHealth}
 */
export const readDriverHealth = ({ platform = process.platform, renderer }) => {
  if (platform !== 'linux' || !isNvidia(renderer)) return UNKNOWN_DRIVER
  const libraryNames = LIBRARY_DIRECTORIES.flatMap((directory) => {
    try {
      return readdirSync(directory)
    } catch {
      return []
    }
  })
  return driverHealthOf({
    moduleText: safely(() => readFileSync('/proc/driver/nvidia/version', 'utf8')),
    libraryNames,
    smi: runTool('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader']),
    journalText: runTool('journalctl', ['-k', '-b', '--no-pager'])?.text,
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
  if (gpu.driver.mismatch === 'unknown') return 'room-explosion: WARNING the NVIDIA driver health could not be read (module/userspace versions unknown): check `dmesg`/`journalctl -k -b` for `NVRM: API mismatch` before trusting the times'
  return undefined
}

/**
 * Why a base measured on another GPU or driver must not be compared with this run, or undefined when it can be. A base without a recorded GPU (older than this field) is compared.
 * @param {{ renderer?: string, driver?: { module?: string | null } } | undefined} baseGpu @param {{ renderer?: string, driver?: { module?: string | null } } | undefined} nowGpu
 * @returns {string | undefined}
 */
export const gpuMismatchReason = (baseGpu, nowGpu) => {
  if (!baseGpu?.renderer || !nowGpu?.renderer) return undefined
  if (baseGpu.renderer !== nowGpu.renderer) return `a base medida na placa ${baseGpu.renderer}, esta rodada em ${nowGpu.renderer}`
  const was = baseGpu.driver?.module
  const now = nowGpu.driver?.module
  if (was && now && was !== now) return `a base medida com o driver ${was}, esta rodada com ${now}`
  return undefined
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

/** Desktop-only graphics policy and next-launch preference storage. */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

/** Supported preferences, in menu order. */
export const desktopGpuModes = ['automatic', 'integrated', 'discrete'] as const
/** A preference for the application's GPU on its next launch. */
export type DesktopGpuMode = typeof desktopGpuModes[number]

/**
 * Detect an internal switchable Intel/AMD pair from macOS's display inventory.
 * @param inventory - Decoded system_profiler SPDisplaysDataType output.
 * @returns Whether both switchable adapters are present.
 */
export function hasSwitchableIntelAmdGpus(inventory: unknown): boolean {
  if (typeof inventory !== 'object' || inventory === null || !('SPDisplaysDataType' in inventory)
    || !Array.isArray(inventory.SPDisplaysDataType)) return false
  const vendors = new Set<string>()
  for (const entry of inventory.SPDisplaysDataType as unknown[]) {
    if (typeof entry !== 'object' || entry === null || !('spdisplays_vendor' in entry)
      || !('spdisplays_automatic_graphics_switching' in entry)
      || entry.spdisplays_automatic_graphics_switching !== 'spdisplays_supported') continue
    const vendor = entry.spdisplays_vendor
    if (vendor === 'Intel' || vendor === 'sppci_vendor_intel') vendors.add('intel')
    if (vendor === 'AMD' || vendor === 'sppci_vendor_amd') vendors.add('amd')
  }
  return vendors.has('intel') && vendors.has('amd')
}

/**
 * Resolve a Chromium switch before Electron starts its GPU process.
 * @param mode - App preference; automatic leaves Chromium's policy alone.
 * @returns Switch name without the leading dashes, or no override.
 */
export function desktopGpuSwitch(mode: DesktopGpuMode): string | undefined {
  switch (mode) {
    case 'automatic': return undefined
    case 'integrated': return 'force_low_power_gpu'
    case 'discrete': return 'force_high_performance_gpu'
  }
}

/**
 * Probe using an OS utility because Electron GPU info arrives after startup GPU policy is set.
 * @param platform - Node platform.
 * @param arch - Node architecture.
 * @returns Whether the selector may be used; probe failures leave it unavailable.
 */
export function supportsDesktopGpuPreference(platform: string, arch: string): boolean {
  if (platform !== 'darwin' || arch !== 'x64') return false
  try {
    const raw = execFileSync('/usr/sbin/system_profiler', ['-json', 'SPDisplaysDataType'], {
      encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'pipe'],
    })
    return hasSwitchableIntelAmdGpus(JSON.parse(raw))
  } catch (_error) {
    console.warn('desktop GPU preference: hardware inventory unavailable')
    return false
  }
}

/** App-local preference, separate from Host settings and sessions. */
export class DesktopGpuPreference {
  private readonly path: string

  /** @param userData - Electron app userData directory. */
  constructor(userData: string) { this.path = join(userData, 'desktop', 'gpu-preference') }

  /** @returns Saved choice or automatic if absent, unreadable, or unrecognized. */
  read(): DesktopGpuMode {
    try {
      const mode = readFileSync(this.path, 'utf8').trim()
      if (mode === 'automatic' || mode === 'integrated' || mode === 'discrete') return mode
      console.warn('desktop GPU preference: unrecognized preference; using automatic')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('desktop GPU preference: unable to read preference; using automatic')
      }
    }
    return 'automatic'
  }

  /**
   * Atomically replace the choice for the next launch. Does not modify the running process.
   * @param mode - Choice selected in the native menu.
   * @returns After the choice is persisted; rejects on a storage failure.
   */
  async save(mode: DesktopGpuMode): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
    await writeFileAtomic(this.path, `${mode}\n`, { mode: 0o600 })
  }
}

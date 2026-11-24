import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { DesktopGpuPreference, desktopGpuSwitch, hasSwitchableIntelAmdGpus, supportsDesktopGpuPreference } from '../src/gpu-preference.ts'

const execFileSync = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ execFileSync }))

const device = (vendor: string, switching = 'spdisplays_supported') => ({
  spdisplays_vendor: vendor, spdisplays_automatic_graphics_switching: switching,
})
const intel = device('Intel')
const amd = device('sppci_vendor_amd')
const inventory = { SPDisplaysDataType: [intel, amd] }

it('requires both vendors to report switchable graphics', () => {
  expect(hasSwitchableIntelAmdGpus(inventory)).toBe(true)
  expect(hasSwitchableIntelAmdGpus({ SPDisplaysDataType: [amd, intel] })).toBe(true)
  expect(hasSwitchableIntelAmdGpus({ SPDisplaysDataType: [intel] })).toBe(false)
  expect(hasSwitchableIntelAmdGpus({ SPDisplaysDataType: [intel, device('AMD', 'spdisplays_unsupported')] })).toBe(false)
  expect(hasSwitchableIntelAmdGpus({ SPDisplaysDataType: [intel, device('NVIDIA')] })).toBe(false)
  expect(hasSwitchableIntelAmdGpus({ SPDisplaysDataType: [null, 42, {}, intel] })).toBe(false)
  expect(hasSwitchableIntelAmdGpus(undefined)).toBe(false)
})

it('probes only Intel macOS and hides the selector if probing fails', () => {
  expect(supportsDesktopGpuPreference('darwin', 'arm64')).toBe(false)
  expect(supportsDesktopGpuPreference('win32', 'x64')).toBe(false)
  expect(execFileSync).not.toHaveBeenCalled()
  execFileSync.mockReturnValueOnce(JSON.stringify(inventory)).mockImplementationOnce(() => { throw new Error('timeout') })
  expect(supportsDesktopGpuPreference('darwin', 'x64')).toBe(true)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try { expect(supportsDesktopGpuPreference('darwin', 'x64')).toBe(false) }
  finally { warn.mockRestore() }
})

it('uses no switch for automatic and distinct Chromium switches for forced GPUs', () => {
  expect(desktopGpuSwitch('automatic')).toBeUndefined()
  expect(desktopGpuSwitch('integrated')).toBe('force_low_power_gpu')
  expect(desktopGpuSwitch('discrete')).toBe('force_high_performance_gpu')
})

it('persists the next-launch choice in app userData and safely defaults on invalid content', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'dsh-gpu-preference-'))
  try {
    const p = new DesktopGpuPreference(sandbox)
    expect(p.read()).toBe('automatic')
    await p.save('discrete')
    expect(new DesktopGpuPreference(sandbox).read()).toBe('discrete')
    await p.save('integrated')
    expect(new DesktopGpuPreference(sandbox).read()).toBe('integrated')
    await p.save('automatic')
    expect(new DesktopGpuPreference(sandbox).read()).toBe('automatic')
    await writeFile(join(sandbox, 'desktop', 'gpu-preference'), '--unexpected-switch\n')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { expect(new DesktopGpuPreference(sandbox).read()).toBe('automatic') }
    finally { warn.mockRestore() }
  } finally {
    await rm(sandbox, { recursive: true, force: true })
  }
})

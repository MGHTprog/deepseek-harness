// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { DESKTOP_IPC } from '../src/ipc.ts'
import { installGpuMenuButton } from '../src/preload-gpu-menu.ts'

const invoke = vi.hoisted(() => vi.fn<(channel: string) => Promise<boolean>>())
vi.mock('electron', () => ({ ipcRenderer: { invoke } }))

const addWorkspace = (): void => {
  const shell = document.createElement('div')
  shell.dataset.shellOverlay = ''
  document.body.append(shell)
}

const install = (): void => {
  installGpuMenuButton()
  window.dispatchEvent(new Event('DOMContentLoaded'))
}

afterEach(() => {
  for (const style of document.head.querySelectorAll('style')) {
    if (style.textContent.includes('data-desktop-gpu-menu')) style.remove()
  }
  document.body.replaceChildren()
  invoke.mockReset()
})

it('waits for the workspace before mounting the GPU selector', async () => {
  invoke.mockResolvedValue(true)
  install()
  expect(invoke).not.toHaveBeenCalled()
  expect(document.querySelector('[data-desktop-gpu-menu]')).toBeNull()
  addWorkspace()
  await vi.waitFor(() => expect(document.querySelector('[data-desktop-gpu-menu]')).not.toBeNull())
  expect(invoke).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.gpuAvailable)
})

it('does not mount the selector when the main process reports unsupported hardware', async () => {
  invoke.mockResolvedValue(false)
  addWorkspace()
  install()
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.gpuAvailable))
  expect(document.querySelector('[data-desktop-gpu-menu]')).toBeNull()
})

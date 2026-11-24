import type { BrowserWindow, IpcMainInvokeEvent, MenuItemConstructorOptions, PopupOptions } from 'electron'
import { beforeEach, expect, it, vi } from 'vitest'
import { installDesktopGpuMenu } from '../src/gpu-menu.ts'
import { DesktopGpuPreference } from '../src/gpu-preference.ts'
import { DESKTOP_IPC } from '../src/ipc.ts'
import { resolveDesktopLocale } from '../src/locale.ts'

const { handle, popup, buildFromTemplate, showMessageBox } = vi.hoisted(() => ({
  handle: vi.fn<(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => void>(),
  popup: vi.fn<(options: PopupOptions) => void>(),
  buildFromTemplate: vi.fn<(items: MenuItemConstructorOptions[]) => { popup: (options: PopupOptions) => void }>(),
  showMessageBox: vi.fn(),
}))
vi.mock('electron', () => ({ ipcMain: { handle }, Menu: { buildFromTemplate }, dialog: { showMessageBox } }))

const event = {} as IpcMainInvokeEvent
const window = { isDestroyed: () => false, webContents: { getZoomFactor: () => 1.25 } } as BrowserWindow

function setup(supported: boolean) {
  const preference = new DesktopGpuPreference('/unused')
  const save = vi.spyOn(preference, 'save').mockResolvedValue(undefined)
  const authorize = vi.fn(() => window)
  const blocked = vi.fn(() => false)
  installDesktopGpuMenu({ preference: supported ? preference : undefined, initialMode: 'automatic', authorize,
    locale: () => resolveDesktopLocale('en'), blocked })
  const invoke = (channel: string, ...args: unknown[]) => handle.mock.calls.find(([name]) => name === channel)![1](event, ...args)
  return { authorize, blocked, invoke, save }
}

beforeEach(() => {
  vi.clearAllMocks()
  buildFromTemplate.mockImplementation(() => ({ popup }))
})

it('authorizes availability and popup against the same owning window check', async () => {
  const { authorize, invoke } = setup(true)
  authorize.mockImplementation(() => { throw new Error('rejected sender') })
  expect(() => invoke(DESKTOP_IPC.gpuAvailable)).toThrow('rejected sender')
  await expect(invoke(DESKTOP_IPC.gpuMenu, 16, 16)).rejects.toThrow('rejected sender')
  expect(popup).not.toHaveBeenCalled()
})

it('refuses unsupported hardware, blocked states, and malformed anchors', async () => {
  const unsupported = setup(false)
  expect(unsupported.invoke(DESKTOP_IPC.gpuAvailable)).toBe(false)
  await unsupported.invoke(DESKTOP_IPC.gpuMenu, 8, 8)
  handle.mockClear()
  const supported = setup(true)
  expect(supported.invoke(DESKTOP_IPC.gpuAvailable)).toBe(true)
  await expect(supported.invoke(DESKTOP_IPC.gpuMenu, '8', 8)).rejects.toThrow('invalid popup anchor')
  await expect(supported.invoke(DESKTOP_IPC.gpuMenu, 8, Infinity)).rejects.toThrow('invalid popup anchor')
  supported.blocked.mockReturnValue(true)
  await supported.invoke(DESKTOP_IPC.gpuMenu, 8, 8)
  expect(popup).not.toHaveBeenCalled()
})

it('persists only native menu selections and explains that restart is manual', async () => {
  const { invoke, save } = setup(true)
  const open = invoke(DESKTOP_IPC.gpuMenu, 16, 32, 'integrated')
  const options = popup.mock.lastCall![0]
  expect(options).toMatchObject({ window, x: 20, y: 40 })
  const items = buildFromTemplate.mock.lastCall![0]
  expect(items.slice(0, 3).map(({ label, checked }) => ({ label, checked }))).toEqual([
    { label: 'Automatic', checked: true }, { label: 'Intel integrated', checked: false }, { label: 'AMD discrete', checked: false },
  ])
  expect(save).not.toHaveBeenCalled()
  items[2]!.click?.({} as Electron.MenuItem, window, {} as Electron.KeyboardEvent)
  options.callback?.()
  await open
  expect(save).toHaveBeenCalledExactlyOnceWith('discrete')
  expect(showMessageBox).toHaveBeenCalledWith(window, expect.objectContaining({ message: 'Applies after you quit and reopen the app.' }))
  const reopen = invoke(DESKTOP_IPC.gpuMenu, 16, 32)
  expect(buildFromTemplate.mock.lastCall![0][2]!.checked).toBe(true)
  popup.mock.lastCall![0].callback?.()
  await reopen
  expect(save).toHaveBeenCalledTimes(1)
})

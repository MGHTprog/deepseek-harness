/** Main-process GPU picker. Only native menu clicks can persist a preference. */
import { dialog, ipcMain, Menu, type BrowserWindow, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron'
import { desktopGpuMessages } from './gpu-locale.ts'
import { desktopGpuModes, type DesktopGpuMode, type DesktopGpuPreference } from './gpu-preference.ts'
import { DESKTOP_IPC } from './ipc.ts'
import type { DesktopLocale } from './locale.ts'

interface GpuMenuOptions {
  preference: DesktopGpuPreference | undefined
  initialMode: DesktopGpuMode
  authorize: (event: IpcMainInvokeEvent) => BrowserWindow
  locale: () => DesktopLocale
  blocked: () => boolean
}

/**
 * Register private capability and popup IPC for the desktop preload.
 * @param options - Hardware-gated storage, trusted window check and current shell state.
 */
export function installDesktopGpuMenu({ preference, initialMode, authorize, locale, blocked }: GpuMenuOptions): void {
  let mode = initialMode
  let busy = false
  ipcMain.handle(DESKTOP_IPC.gpuAvailable, (event) => {
    authorize(event)
    return preference !== undefined
  })
  ipcMain.handle(DESKTOP_IPC.gpuMenu, async (event, x: unknown, y: unknown) => {
    const window = authorize(event)
    if (preference === undefined || blocked() || busy) return
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || y < 0 || x > 100_000 || y > 100_000) throw new Error('desktop GPU menu: invalid popup anchor')
    const zoom = window.webContents.getZoomFactor()
    const messages = desktopGpuMessages(locale().id)
    busy = true
    try {
      const selected = await new Promise<DesktopGpuMode | undefined>((resolve) => {
        let choice: DesktopGpuMode | undefined
        const items = desktopGpuModes.map((value): MenuItemConstructorOptions => ({
          type: 'radio', label: messages[value], checked: value === mode,
          click: () => { choice = value },
        }))
        Menu.buildFromTemplate([...items, { type: 'separator' }, { label: messages.restart, enabled: false }])
          .popup({ window, x: Math.round(x * zoom), y: Math.round(y * zoom), callback: () => { resolve(choice) } })
      })
      if (selected === undefined || selected === mode || window.isDestroyed() || blocked()) return
      let failure = false
      try {
        await preference.save(selected)
        mode = selected
      } catch (error) {
        failure = true
        console.error('desktop GPU preference: save failed', error)
      }
      if (window.isDestroyed() || blocked()) return
      await dialog.showMessageBox(window, {
        type: failure ? 'error' : 'info', title: messages.title,
        message: failure ? messages.failure : messages.restart,
        buttons: [locale().messages.updateAcknowledge],
      })
    } finally {
      busy = false
    }
  })
}

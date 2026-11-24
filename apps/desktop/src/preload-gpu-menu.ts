/** Compact macOS control that opens a native GPU menu at its own location. */
import { ipcRenderer } from 'electron'
import { desktopGpuMessages, gpuButtonLabel } from './gpu-locale.ts'
import { DESKTOP_IPC } from './ipc.ts'
import { resolveDesktopLocale } from './locale.ts'

/** Install only in the trusted top-level app document and only on supported hardware. */
export function installGpuMenuButton(): void {
  const mount = async (): Promise<void> => {
    if (await ipcRenderer.invoke(DESKTOP_IPC.gpuAvailable) !== true) return
    const host = document.createElement('div')
    host.dataset.desktopGpuMenu = ''
    const placement = document.createElement('style')
    placement.textContent = `
      [data-desktop-gpu-menu] { position: fixed; top: 11px; left: 88px; z-index: 15; }
      html[data-fullscreen] [data-desktop-gpu-menu] { left: 48px; }
      html:has([data-shell-leading]) [data-desktop-gpu-menu] { left: 160px; }
      html[data-fullscreen]:has([data-shell-leading]) [data-desktop-gpu-menu] { left: 84px; }
      html:has([data-shell-leading][inert]) [data-desktop-gpu-menu] { display: none; }
      html:has([data-desktop-gpu-menu]) :is([data-sidebar-collapsed], [data-sidebar-drawer]):has(> [data-shell-leading]) {
        --dsh-frame-leading-clearance: 208px;
      }
      html[data-fullscreen]:has([data-desktop-gpu-menu]) :is([data-sidebar-collapsed], [data-sidebar-drawer]):has(> [data-shell-leading]) {
        --dsh-frame-leading-clearance: 132px;
      }
    `
    const shadow = host.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = `
      :host { -webkit-app-region: no-drag; }
      button { -webkit-app-region: no-drag; width: 40px; height: 28px; padding: 0; border: 0;
        border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-secondary);
        font: 13px var(--dsw-font-family); cursor: pointer; }
      button:hover, button[aria-expanded=true] { background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary); }
      button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }
    `
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = gpuButtonLabel
    button.setAttribute('aria-haspopup', 'menu')
    button.setAttribute('aria-expanded', 'false')
    const updateLabel = (): void => {
      const { title, restart } = desktopGpuMessages(resolveDesktopLocale(document.documentElement.lang).id)
      button.setAttribute('aria-label', title)
      button.title = `${title}. ${restart}`
    }
    updateLabel()
    new MutationObserver(updateLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    const open = async (): Promise<void> => {
      const rect = button.getBoundingClientRect()
      button.setAttribute('aria-expanded', 'true')
      try { await ipcRenderer.invoke(DESKTOP_IPC.gpuMenu, rect.left, rect.bottom) }
      catch (error) { console.error('Desktop GPU menu failed', error) }
      finally { button.setAttribute('aria-expanded', 'false') }
    }
    button.addEventListener('click', (event) => {
      if (event.isTrusted && button.getAttribute('aria-expanded') !== 'true') void open()
    })
    shadow.append(style, button)
    document.head.append(placement)
    document.body.append(host)
  }
  const start = (): void => {
    const attach = (): void => {
      if (document.querySelector('[data-shell-overlay]') === null) return
      observer.disconnect()
      void mount().catch((error: unknown) => { console.error('Desktop GPU control unavailable', error) })
    }
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    attach()
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}

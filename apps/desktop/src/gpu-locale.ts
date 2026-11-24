/** Desktop-owned GPU control copy. */
import type { DesktopLocale } from './locale.ts'

const gpuButtonLabel = 'GPU'
/** Compact technical label shared across the shipped languages. */
export { gpuButtonLabel }

const messages = {
  en: ['GPU preference', 'Automatic', 'Intel integrated', 'AMD discrete', 'Applies after you quit and reopen the app.', 'Could not save the GPU preference. Check that the app’s settings directory is writable and try again.'],
  'zh-CN': ['GPU 偏好设置', '自动', 'Intel 集成显卡', 'AMD 独立显卡', '退出并重新打开应用后生效。', '无法保存 GPU 偏好设置。请检查应用设置目录是否可写，然后重试。'],
  ja: ['GPU 設定', '自動', 'Intel 内蔵 GPU', 'AMD ディスクリート GPU', 'アプリを終了して開き直すと適用されます。', 'GPU 設定を保存できませんでした。設定フォルダーの書き込み権限を確認して、もう一度お試しください。'],
  es: ['Preferencia de GPU', 'Automática', 'Intel integrada', 'AMD dedicada', 'Se aplica al salir de la aplicación y volver a abrirla.', 'No se pudo guardar la preferencia de GPU. Comprueba los permisos de escritura de la carpeta de configuración e inténtalo de nuevo.'],
  fr: ['Préférence GPU', 'Automatique', 'Intel intégré', 'AMD dédié', 'S’applique après avoir quitté et rouvert l’application.', 'Impossible d’enregistrer la préférence GPU. Vérifiez les droits d’écriture du dossier des paramètres et réessayez.'],
  de: ['GPU-Einstellung', 'Automatisch', 'Integrierte Intel-GPU', 'Dedizierte AMD-GPU', 'Gilt nach dem Beenden und erneuten Öffnen der App.', 'Die GPU-Einstellung konnte nicht gespeichert werden. Prüfen Sie den Schreibzugriff auf den Einstellungsordner und versuchen Sie es erneut.'],
  ru: ['Настройки GPU', 'Автоматически', 'Встроенный Intel', 'Дискретный AMD', 'Применится после выхода из приложения и повторного запуска.', 'Не удалось сохранить настройки GPU. Проверьте права на запись в папку настроек и повторите попытку.'],
  pt: ['Preferência de GPU', 'Automática', 'Intel integrada', 'AMD dedicada', 'Entra em vigor após sair do aplicativo e abri-lo novamente.', 'Não foi possível salvar a preferência de GPU. Verifique a permissão de escrita na pasta de configurações e tente novamente.'],
} as const satisfies Record<DesktopLocale['id'], readonly [string, string, string, string, string, string]>

/** @param locale - Active Desktop locale. @returns Menu labels and feedback for the GPU selector. */
export function desktopGpuMessages(locale: DesktopLocale['id']) {
  const [title, automatic, integrated, discrete, restart, failure] = messages[locale]
  return { title, automatic, integrated, discrete, restart, failure }
}

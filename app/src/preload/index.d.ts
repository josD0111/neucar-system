import { ElectronAPI } from '@electron-toolkit/preload'

// Ver preload/index.ts: puente para abrir un PDF generado en memoria con el
// lector de PDF del sistema (Sprint 2, 06/11/2026 — HU-12).
interface Api {
  abrirPdf: (base64: string, nombreArchivo: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

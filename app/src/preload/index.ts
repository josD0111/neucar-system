import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
//
// abrirPdf (Sprint 2, 06/11/2026): puente para que el renderer pueda abrir
// un PDF generado en memoria (ej. comprobante de saldo de cliente, HU-12)
// con el lector de PDF del sistema operativo — ver la nota larga en
// main/index.ts (ipcMain.handle('pdf:abrir', ...)) sobre por qué hace falta
// este viaje por IPC en vez de window.open(blob:...).
const api = {
  abrirPdf: (base64: string, nombreArchivo: string): Promise<void> =>
    ipcRenderer.invoke('pdf:abrir', base64, nombreArchivo)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

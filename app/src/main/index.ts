import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { Server } from 'node:http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db/client'
import { startServer } from './api/server'
import { seedUsuarios } from './db/seed'
let apiServer: Server | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    
  })

  // --- Inicialización de la base de datos (PGlite + Drizzle) ---
  // Prueba temporal de persistencia (ver stack-tecnologico.md, sección 7):
  // se puede borrar este bloque una vez confirmado que funciona.
  const db = await initDb()
    // TEMPORAL de diagnóstico: muestra la causa real del error del seed.
  await seedUsuarios(db)
  // --- Servidor local (Express) que expone la lógica de negocio ---
  // Ver src/main/api/server.ts y stack-tecnologico.md, sección 3.
  apiServer = startServer(db)

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  apiServer?.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
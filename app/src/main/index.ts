import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db/client'
import { startServer } from './api/server'
import { seedUsuarios } from './db/seed'
let apiServer: Server | null = null

// Abre un PDF generado por el renderer (ej. comprobante de saldo de
// cliente, HU-12) con el lector de PDF predeterminado del sistema.
//
// Por qué no alcanza con window.open(URL.createObjectURL(blob)) desde el
// renderer: una URL blob: vive solo dentro del proceso (webContents) que la
// creó. window.open() intenta abrir otra ventana —y por lo tanto otro
// webContents—, que no puede resolver esa URL; el setWindowOpenHandler de
// acá abajo la termina pasando a shell.openExternal(), que tampoco entiende
// el esquema blob: (de ahí el error "No se ha podido abrir el URI" /
// "La ubicación especificada no está soportada" al intentarlo). La forma
// correcta en Electron es mandar el contenido del PDF (como base64, vía
// IPC) al proceso principal, que lo escribe a un archivo temporal real y lo
// abre con shell.openPath — mismo mecanismo que usa cualquier aplicación de
// escritorio para "abrir con la app predeterminada".
ipcMain.handle('pdf:abrir', async (_evento, base64: string, nombreArchivo: string) => {
  // Se sanitiza el nombre por las dudas (viene del backend, pero un archivo
  // temporal no debería depender de eso para ser seguro) y se le antepone
  // un timestamp para no pisar un PDF anterior con el mismo nombre que
  // pueda seguir abierto en el lector del sistema.
  const nombreSeguro = nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, '_') || 'comprobante.pdf'
  const rutaArchivo = join(app.getPath('temp'), `neucar-${Date.now()}-${nombreSeguro}`)
  await writeFile(rutaArchivo, Buffer.from(base64, 'base64'))

  // Importante: NO se espera (await) la promesa de shell.openPath() para
  // resolver este handler. En Linux (sobre todo con escritorios que usan
  // xdg-desktop-portal, como GNOME en Debian), esa promesa no se resuelve
  // hasta que el usuario CIERRA el lector de PDF que se abrió — no es un
  // detalle de implementación nuestro, es así como responde el portal del
  // sistema. Si se esperara acá, el renderer (ver client.ts,
  // abrirPdfAutenticado) quedaría con el botón en "Generando…" todo el
  // tiempo que el usuario tenga el PDF abierto, en vez de solo mientras se
  // prepara el archivo. Lo que a nosotros nos interesa es que el archivo ya
  // esté escrito y que se haya disparado la apertura; si falla, se loguea
  // acá (no hay forma simple de devolverle el error al renderer sin volver
  // a bloquear la respuesta por lo mismo).
  shell.openPath(rutaArchivo).then((error) => {
    if (error) console.error(`No se pudo abrir el PDF temporal (${rutaArchivo}):`, error)
  })
})

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    // Tamaño aumentado en Sprint 2 (25/10/2026): el 900x670 original (Sprint
    // 1) se quedó chico para VentaScreen.tsx, cuya tabla de ítems (hasta 8
    // columnas para el rol Administrador: producto, lote, cantidad, precio
    // base, precio a cobrar, forma de pago, garantía, fecha de pago
    // prevista) necesita más ancho disponible que el resto de las pantallas
    // de Sprint 1. `minWidth`/`minHeight` evitan que se pueda achicar por
    // debajo de un tamaño donde el sidebar (220px) deja de tener sentido.
    width: 1200,
    height: 760,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Letra más grande (pedido del dueño, ver sprint-2-backlog.md punto 6).
  //
  // Historia de esto (para no repetir los mismos dos bugs):
  // 1) Al principio se usaba la propiedad CSS `zoom` en tokens.css. Esa,
  //    combinada con los contenedores con scroll propio de App.tsx, hacía
  //    que el scroll de las pantallas largas se cortara antes de llegar al
  //    final (bug reportado 07/11/2026).
  // 2) Se cambió a `webContents.setZoomFactor()`, el zoom NATIVO de
  //    Electron/Chromium (lo mismo que Ctrl+/Ctrl- en un navegador). Eso
  //    sacó el bug de scroll, pero trajo uno nuevo y peor (encontrado
  //    08/11/2026): con setZoomFactor activo, `window.innerHeight` y
  //    getBoundingClientRect() reportan la geometría "zoomeada" bien, pero
  //    lo que Chromium efectivamente PINTA en pantalla queda escalado una
  //    vez más sobre eso — confirmado comparando capturas reales contra las
  //    coordenadas que da el DOM: el contenido cercano al borde inferior
  //    (ej. el botón "Cerrar sesión" del sidebar) se renderizaba ~80px más
  //    abajo de donde el layout decía, quedando recortado por el borde de
  //    la ventana sin ninguna forma de scrollearlo (el propio Chromium cree
  //    que no hay overflow). No es un problema de cuándo se aplica el zoom
  //    ni de position:fixed — se probó reordenar vs. maximize() y sacar el
  //    position:fixed del sidebar, sin cambios.
  //
  // La solución (acá) es no usar NINGÚN mecanismo de zoom de Electron, y en
  // cambio escalar la interfaz con `transform: scale()` en CSS puro, en el
  // componente raíz (ver App.tsx) — eso no pasa por el pipeline de zoom de
  // Electron, así que no hereda ninguno de los dos bugs.
  mainWindow.on('ready-to-show', () => {
    // Pedido del dueño (07/11/2026): que la ventana arranque maximizada en
    // vez del tamaño fijo de arriba (1200x760) — con una pantalla chica del
    // taller, un tamaño fijo deja franjas de escritorio sin usar.
    //
    // Corrección 08/11/2026: mainWindow.maximize() le pide al gestor de
    // ventanas que maximice, pero algunos entornos de escritorio Linux
    // responden con el tamaño COMPLETO de la pantalla (1280x720, por
    // ejemplo), sin descontar la barra superior del sistema — confirmado
    // con datos reales de DevTools de un equipo real: el contenido de la
    // sidebar entraba perfecto dentro de la ventana (scrollHeight ==
    // clientHeight, sin overflow), pero la parte de abajo (el botón
    // "Cerrar sesión") quedaba tapada por esa barra superior, fuera del
    // área visible. En vez de confiar en maximize(), se fija el tamaño y
    // posición de la ventana directamente al "workArea" que reporta el
    // sistema operativo — que si descuenta correctamente barras y paneles.
    const areaUtil = screen.getPrimaryDisplay().workArea
    mainWindow.setBounds(areaUtil)
    mainWindow.show()
  })

  // Corrección 08/11/2026: Chromium guarda el nivel de zoom nativo POR
  // ORIGEN y lo vuelve a aplicar solo en cada arranque, aunque el código no
  // llame a setZoomFactor en absoluto (quedó guardado de cuando esta app sí
  // lo usaba, antes de pasar a `transform: scale()` en App.tsx — ver la
  // nota larga más arriba). Sin este freno, ese 1.15 heredado se suma al
  // 1.15 de `transform: scale()`, dando un zoom real de ~1.32x en vez de
  // 1.15x (confirmado midiendo devicePixelRatio: daba 1.15 en vez de 1
  // antes de este fix). Por eso se fuerza explícitamente a 1 acá: así el
  // ÚNICO zoom que se aplica es el de `transform: scale()`.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1)
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

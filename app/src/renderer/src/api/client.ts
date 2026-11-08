// src/renderer/src/api/client.ts
//
// Dos clientes HTTP conviven acá a propósito, cada uno resuelto en el merge
// de dev/sprint01 con origin/feat/login-clientes (20/10/2026):
//
// - `api` / `request()`: el cliente original, sin autenticación, usado por
//   categorias/productos/proveedores/compras (recursos que todavía no
//   exigen sesión). Lanza ApiClientError — las pantallas lo capturan con
//   try/catch (ver StockScreen.tsx, CategoriaScreen.tsx, etc.).
// - `apiFetch()`: el cliente con soporte de sesión (token + aviso de sesión
//   vencida), usado por AuthContext.tsx y ClienteScreen.tsx. Nunca lanza:
//   devuelve siempre { ok, ... } para que esas pantallas decidan qué hacer
//   con un error de login sin un try/catch.
//
// Quedan dos formas de pedir datos porque hoy son necesidades distintas
// (recursos públicos vs. recursos que exigen sesión) — si en un futuro
// sprint todos los endpoints pasan a requerir autenticación, tiene sentido
// unificarlos en uno solo.

// Dirección de la API local (debe coincidir con API_HOST y API_PORT de
// main/api/server.ts). Las dos variantes de abajo comparten el mismo host y
// puerto; difieren solo en si incluyen o no el prefijo "/api", para no tener
// que tocar las rutas que ya llamaba cada cliente.
const API_HOST_BASE = 'http://127.0.0.1:4000'
const API_BASE = `${API_HOST_BASE}/api`
export const API_URL = API_HOST_BASE

// Formas de respuesta de la API (ver main/api/response.ts), compartidas por
// ambos clientes.
export interface ApiOk<T> {
  ok: true
  data: T
}
export interface ApiFail {
  ok: false
  error: { message: string; code?: string }
}
type ApiResponseBody<T> = ApiOk<T> | ApiFail

// --- Cliente sin autenticación (categorías, productos, proveedores, compras) ---

export class ApiClientError extends Error {
  code?: string
  status?: number

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers
      }
    })
  } catch {
    // La API local no respondió (servidor no inicializado, puerto distinto, etc.)
    throw new ApiClientError(
      'No se pudo conectar con el servidor local. Reintentá en unos segundos.'
    )
  }

  // GET /api/productos/listado-pdf no sigue la convención { ok, data } — el
  // cuerpo es el PDF en sí. Lo dejamos pasar sin parsear.
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new ApiClientError(`Error del servidor (${res.status}).`, res.status)
    return undefined as T
  }

  const body = (await res.json()) as ApiResponseBody<T>
  if (!body.ok) {
    throw new ApiClientError(body.error.message, res.status, body.error.code)
  }
  return body.data
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined
    }),
  patch: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined
    }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' })
}

// Filtros que acepta el PDF del listado de stock: son los mismos que tiene
// la pantalla de Stock (ver routes/productos.ts, GET /listado-pdf).
export interface FiltrosPdfStock {
  categoriaId?: number
  q?: string
  soloConStock?: boolean
  soloStockBajo?: boolean
}

// Arma la URL del PDF del listado de existencias con los filtros activos
// (Sprint 2, punto 6, adenda a HU-05). Solo se envían los filtros que
// tienen valor, para no ensuciar la URL con parámetros vacíos; sin filtros
// la URL queda igual que antes y el PDF trae el stock completo.
export function urlPdfListadoStock(filtros: FiltrosPdfStock = {}): string {
  const params = new URLSearchParams()
  // El backend exige un entero positivo: un 0 o un valor vacío no se envía.
  if (filtros.categoriaId && filtros.categoriaId > 0) {
    params.set('categoriaId', String(filtros.categoriaId))
  }
  if (filtros.q?.trim()) params.set('q', filtros.q.trim())
  // Los booleanos se envían como el texto 'true' (el backend solo acepta
  // 'true' o 'false'); si están apagados simplemente no se mandan.
  if (filtros.soloConStock) params.set('soloConStock', 'true')
  if (filtros.soloStockBajo) params.set('soloStockBajo', 'true')
  const qs = params.toString()
  return `${API_BASE}/productos/listado-pdf${qs ? `?${qs}` : ''}`
}

// --- Cliente con sesión (auth, clientes) ---

interface Opciones {
  method?: string // GET por defecto
  body?: unknown // si se envía, se manda como JSON
  token?: string | null // si se envía, va en el header Authorization
}

// Función que se ejecuta cuando el servidor dice que la sesión ya no es válida
// (por ejemplo, porque la app se reinició). La registra el AuthProvider.
let alSesionVencida: (() => void) | null = null
export function registrarSesionVencida(fn: (() => void) | null): void {
  alSesionVencida = fn
}

// Hace una petición a la API y devuelve SIEMPRE un objeto { ok, ... }:
// nunca lanza excepciones, así las pantallas solo revisan "ok".
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, token }: Opciones = {}
): Promise<ApiOk<T> | ApiFail> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // Solo avisamos que mandamos JSON si realmente hay cuerpo.
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // El token de sesión viaja como "Bearer <token>" (ver middleware/auth.ts).
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    // La API siempre responde JSON con { ok: true, data } o { ok: false, error }.
    const json = (await res.json()) as ApiOk<T> | ApiFail

    // Si mandamos un token y el servidor lo rechaza, la sesión se perdió:
    // avisamos para que la app vuelva a la pantalla de login.
    // (Un login con contraseña incorrecta no manda token, así que no entra acá.)
    if (token && !json.ok && json.error.code === 'UNAUTHORIZED') alSesionVencida?.()

    return json
  } catch {
    // Falla de red (servidor caído, puerto ocupado) o respuesta que no es JSON.
    return {
      ok: false,
      error: { message: 'No se pudo conectar con el servidor local', code: 'NETWORK' }
    }
  }
}

// Descarga un PDF que exige sesión (ej.: comprobante de saldo de cliente,
// HU-12). A diferencia de urlPdfListadoStock (productos, sin sesión), acá no
// alcanza con un <a href>: el navegador no manda el header Authorization en
// una navegación simple, así que el servidor respondería 401. Se pide con
// fetch() + token y el PDF resultante se manda al proceso principal por IPC
// para que lo abra con el lector de PDF del sistema.
//
// Nota (bug encontrado 06/11/2026): la primera versión de esta función
// abría el PDF con `window.open(URL.createObjectURL(blob))`, pero en
// Electron una URL blob: vive solo en el proceso (webContents) que la creó.
// window.open() abre otra ventana que no puede resolver esa URL, y el
// setWindowOpenHandler de main/index.ts la termina pasando a
// shell.openExternal(), que tampoco entiende el esquema blob: — de ahí el
// error "No se ha podido abrir el URI" que se veía al apretar el botón. Se
// reemplazó por window.api.abrirPdf() (ver preload/index.ts), que manda el
// PDF como base64 al proceso principal, lo escribe a un archivo temporal
// real y lo abre con shell.openPath (ver main/index.ts, ipcMain.handle
// 'pdf:abrir').
//
// `nombreSugerido` es el nombre con el que se guarda el archivo temporal
// (ej. "saldo-cliente-5.pdf"); lo arma el llamador porque ya conoce el
// contexto (ver api/creditos.ts) — así se evita depender del header
// Content-Disposition, que el fetch del renderer no puede leer salvo que el
// servidor lo exponga explícitamente por CORS (Access-Control-Expose-Headers).
export async function abrirPdfAutenticado(
  path: string,
  token: string | null,
  nombreSugerido = 'comprobante.pdf'
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/pdf')) {
      // No vino el PDF: el cuerpo es el error de la API ({ ok:false, error }).
      const body = (await res.json().catch(() => null)) as ApiFail | null
      return { ok: false, mensaje: body?.error.message ?? `Error del servidor (${res.status}).` }
    }
    const buffer = await res.arrayBuffer()
    await window.api.abrirPdf(arrayBufferABase64(buffer), nombreSugerido)
    return { ok: true }
  } catch {
    return { ok: false, mensaje: 'No se pudo generar o abrir el PDF.' }
  }
}

// Convierte un ArrayBuffer a base64 sin depender de Buffer (no disponible
// en el renderer). Se arma en bloques de a 32 KB: pasar un array muy grande
// de una sola vez a String.fromCharCode(...bytes) puede superar el límite
// de argumentos del motor de JS en PDFs grandes.
function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  const tamanoBloque = 0x8000
  for (let i = 0; i < bytes.length; i += tamanoBloque) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanoBloque))
  }
  return btoa(binario)
}
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

export function urlPdfListadoStock(): string {
  return `${API_BASE}/productos/listado-pdf`
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
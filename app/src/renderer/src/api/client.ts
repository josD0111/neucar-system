// src/renderer/src/api/client.ts
//
// Cliente HTTP mínimo contra el servidor local (ver src/main/api/server.ts).
// Sin librerías externas: fetch directo al puerto fijo de la API local
// (API_PORT en src/main/api/server.ts). Traduce la convención de respuesta
// del backend ({ ok: true, data } / { ok: false, error }) en una promesa que
// resuelve con `data` o rechaza con un ApiClientError con el mensaje listo
// para mostrar en la interfaz.

const API_BASE = 'http://127.0.0.1:4000/api'

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

interface ApiSuccess<T> {
  ok: true
  data: T
}

interface ApiErrorBody {
  ok: false
  error: { message: string; code?: string }
}

type ApiResponseBody<T> = ApiSuccess<T> | ApiErrorBody

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
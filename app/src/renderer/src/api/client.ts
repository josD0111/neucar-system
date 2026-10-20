// src/renderer/src/api/client.ts
//
// Cliente HTTP mínimo para hablar con la API local (Express, proceso main).
// Centraliza la URL base, el header del token y la forma de la respuesta,
// para que ninguna pantalla repita esa lógica.

// Dirección de la API local (debe coincidir con API_HOST y API_PORT de main/api/server.ts).
export const API_URL = 'http://127.0.0.1:4000'

// Formas de respuesta de la API (ver main/api/response.ts).
export interface ApiOk<T> {
  ok: true
  data: T
}
export interface ApiFail {
  ok: false
  error: { message: string; code?: string }
}

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
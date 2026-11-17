// src/renderer/src/data/AuthContext.tsx
//
// Estado de sesión compartido por toda la app: quién está logueado, su token,
// y las acciones de iniciar y cerrar sesión. Reemplaza al selector "Ver como"
// del prototipo (el rol ahora viene del usuario real autenticado).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { apiFetch, registrarSesionVencida } from '../api/client'
import type { Rol } from '../components/Sidebar'
// Datos públicos del usuario (la contraseña nunca sale del servidor).
export interface Usuario {
  id: number
  nombre: string
  usuarioLogin: string
  rol: Rol
}

interface AuthContextValue {
  usuario: Usuario | null // null = nadie logueado
  token: string | null
  cargando: boolean // true mientras se verifica una sesión guardada al abrir la app
  // Devuelve null si el login fue exitoso, o el mensaje de error si falló.
  iniciarSesion: (usuarioLogin: string, contrasena: string) => Promise<string | null>
  cerrarSesion: () => Promise<void>
}

// Clave bajo la cual se guarda el token en sessionStorage, para que una
// recarga de la ventana (Ctrl+R) no obligue a loguearse de nuevo.
const TOKEN_KEY = 'neucar.token'

// Lectura y escritura protegidas: si el storage no está disponible, la app sigue funcionando.
function leerToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function guardarToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* sin storage: la sesión dura solo mientras no se recargue la ventana */
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

    // Si el servidor rechaza el token en cualquier petición, cerramos la sesión
  // local y la app vuelve sola a la pantalla de login.
  useEffect(() => {
    registrarSesionVencida(() => {
      guardarToken(null)
      setToken(null)
      setUsuario(null)
    })
    return () => registrarSesionVencida(null)
  }, [])
  // Al abrir la app: si había un token guardado, le preguntamos al servidor
  // si sigue siendo válido (GET /api/auth/me) para restaurar la sesión.
  useEffect(() => {
    const guardado = leerToken()
    if (!guardado) {
      setCargando(false)
      return
    }
    apiFetch<{ usuario: Usuario }>('/api/auth/me', { token: guardado }).then((r) => {
      if (r.ok) {
        setUsuario(r.data.usuario)
        setToken(guardado)
      } else {
        guardarToken(null) // token vencido o inválido (por ejemplo, se reinició la app)
      }
      setCargando(false)
    })
  }, [])

  // Pide el login al servidor y, si sale bien, guarda usuario y token.
  const iniciarSesion = useCallback(
    async (usuarioLogin: string, contrasena: string): Promise<string | null> => {
      const r = await apiFetch<{ token: string; usuario: Usuario }>('/api/auth/login', {
        method: 'POST',
        body: { usuarioLogin, contrasena }
      })
      if (!r.ok) return r.error.message
      guardarToken(r.data.token)
      setToken(r.data.token)
      setUsuario(r.data.usuario)
      return null
    },
    []
  )

  // Avisa al servidor para que borre la sesión y limpia el estado local.
  const cerrarSesion = useCallback(async (): Promise<void> => {
    if (token) await apiFetch('/api/auth/logout', { method: 'POST', token })
    guardarToken(null)
    setToken(null)
    setUsuario(null)
  }, [token])

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para leer la sesión desde cualquier componente.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
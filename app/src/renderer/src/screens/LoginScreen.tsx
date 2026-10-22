// src/renderer/src/screens/LoginScreen.tsx
//
// Pantalla de inicio de sesión. Se muestra mientras no haya un usuario
// autenticado; reemplaza al selector de rol del prototipo.

import { useState, type FormEvent } from 'react'
import { useAuth } from '../data/AuthContext'

export function LoginScreen(): React.JSX.Element {
  const { iniciarSesion } = useAuth()
  const [usuarioLogin, setUsuarioLogin ] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false) // evita enviar dos veces el formulario

  // Se ejecuta al presionar "Ingresar" o la tecla Enter.
  async function manejarEnvio(e: FormEvent): Promise<void> {
    e.preventDefault() // evita que el navegador recargue la página
    setError(null)
    setEnviando(true)
    const mensaje = await iniciarSesion(usuarioLogin.trim(), contrasena)
    setEnviando(false)
    // Si salió bien, el AuthContext ya cargó el usuario y App muestra el sistema.
    if (mensaje) setError(mensaje)
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <form
        onSubmit={manejarEnvio}
        style={{
          width: 320,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)'
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 26, fontWeight: 600 }}>
            Neucar
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Iniciá sesión para continuar
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          Usuario
          <input
            value={usuarioLogin}
            maxLength={50}
            onChange={(e) => setUsuarioLogin(e.target.value)}
            autoFocus
            autoComplete="username"
            style={{
              padding: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)'
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          Contraseña
          <input
            type="password"
            maxLength={200}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete="current-password"
            style={{
              padding: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)'
            }}
          />
        </label>

        {/* Mensaje de error (usuario o contraseña incorrectos, servidor caído, etc.) */}
        {error && (
          <div
            style={{
              background: 'var(--color-alert-bg)',
              color: 'var(--color-alert)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius)',
              fontSize: 13
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando || !usuarioLogin || !contrasena}
          style={{
            padding: 'var(--space-2)',
            border: 'none',
            borderRadius: 'var(--radius)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontWeight: 600,
            opacity: enviando || !usuarioLogin || !contrasena ? 0.6 : 1
          }}
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
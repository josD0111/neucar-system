// src/renderer/src/components/Sidebar.tsx
//
// Navegación lateral. "Stock" va primero: es la funcionalidad que el dueño
// identificó como más importante del sistema.
// En la parte inferior muestra quién está logueado y el botón para cerrar sesión
// (reemplaza al selector "Ver como" del prototipo).

import { useAuth } from '../data/AuthContext'

export type Pantalla = 'stock' | 'venta' | 'servicio' | 'cliente'
export type Rol = 'Administrador' | 'Empleado'

interface SidebarProps {
  pantallaActiva: Pantalla
  onCambiarPantalla: (p: Pantalla) => void
}

const items: { id: Pantalla; label: string }[] = [
  { id: 'stock', label: 'Control de stock' },
  { id: 'venta', label: 'Nueva venta' },
  { id: 'servicio', label: 'Orden de servicio' },
  { id: 'cliente', label: 'Ficha de cliente' }
]

export function Sidebar({ pantallaActiva, onCambiarPantalla }: SidebarProps) {
  // Datos del usuario logueado y la acción de cerrar sesión.
  const { usuario, cerrarSesion } = useAuth()

  return (
    <aside
      className="no-print"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-4) 0',
        flexShrink: 0,
        boxSizing: 'border-box',
        zIndex: 10
      }}
    >
      <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div style={{ fontFamily: 'var(--font-data)', fontSize: 22, fontWeight: 600, letterSpacing: 0.5 }}>Neucar</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sistema de taller</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onCambiarPantalla(item.id)}
            style={{
              textAlign: 'left',
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              background: pantallaActiva === item.id ? 'var(--color-bg)' : 'transparent',
              borderLeft: pantallaActiva === item.id ? '3px solid var(--color-accent)' : '3px solid transparent',
              fontWeight: pantallaActiva === item.id ? 600 : 400,
              color: 'var(--color-text)'
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zona inferior: usuario actual y cierre de sesión */}
      <div style={{ marginTop: 'auto', padding: '0 var(--space-4)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sesión iniciada como</div>
        <div style={{ fontWeight: 600 }}>{usuario?.nombre}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
          {usuario?.rol}
        </div>
        <button
          onClick={() => cerrarSesion()}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--color-text)'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
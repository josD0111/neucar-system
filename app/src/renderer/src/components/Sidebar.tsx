// src/renderer/src/components/Sidebar.tsx
//
// Navegación lateral. "Stock" va primero: es la funcionalidad que el dueño
// identificó como más importante del sistema.
// En la parte inferior muestra quién está logueado y el botón para cerrar sesión
// (reemplaza al selector "Ver como" del prototipo).

import { useEffect } from 'react'
import { useAuth } from '../data/AuthContext'
import { useStockAlert } from '../data/StockAlertContext'

export type Pantalla =
  | 'stock'
  | 'categorias'
  | 'proveedores'
  | 'venta'
  | 'ventas'
  | 'servicio'
  | 'historialServicios'
  | 'tiposServicio'
  | 'cliente'
export type Rol = 'Administrador' | 'Empleado'

interface SidebarProps {
  pantallaActiva: Pantalla
  onCambiarPantalla: (p: Pantalla) => void
}

const items: { id: Pantalla; label: string; soloAdmin?: boolean }[] = [
  { id: 'stock', label: 'Control de stock' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'venta', label: 'Nueva venta' },
  { id: 'ventas', label: 'Historial de ventas' },
  { id: 'servicio', label: 'Orden de servicio' },
  { id: 'historialServicios', label: 'Historial de servicios' },
  // Catálogo de tipos de servicio: lo gestiona solo el Administrador.
  { id: 'tiposServicio', label: 'Tipos de servicio', soloAdmin: true },
  { id: 'cliente', label: 'Ficha de cliente' }
]

export function Sidebar({ pantallaActiva, onCambiarPantalla }: SidebarProps): React.JSX.Element {
  // Datos del usuario logueado y la acción de cerrar sesión.
  const { usuario, cerrarSesion } = useAuth()

  // Contador de "Control de stock" (HU-08): se recalcula cada vez que se
  // cambia de pantalla — para Empleado no hace nada, porque refrescar() ya
  // se frena solo cuando el rol no es Administrador (ver StockAlertContext).
  const { contador: stockBajo, refrescar: refrescarStockBajo } = useStockAlert()
  useEffect(() => {
    refrescarStockBajo()
  }, [pantallaActiva, refrescarStockBajo])

  return (
    <aside
      className="no-print"
      style={{
        // Corrección 07-08/11/2026 (ver también App.tsx y main/index.ts):
        // este <aside> usaba position: fixed y no tenía overflow-y, así que
        // si su contenido no entraba en la altura disponible, la parte de
        // abajo (el botón "Cerrar sesión") quedaba recortada sin forma de
        // scrollearla. Ahora es un ítem flex normal, hermano de <main>, con
        // su propio overflow-y: auto como red de seguridad si alguna vez el
        // contenido no entra (logo + muchos ítems de menú en una ventana
        // chica, por ejemplo).
        height: '100%',
        width: 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-4) 0',
        flexShrink: 0,
        boxSizing: 'border-box',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 0.5
          }}
        >
          Neucar
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sistema de taller</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items
          .filter((item) => !item.soloAdmin || usuario?.rol === 'Administrador')
          .map((item) => (
          <button
            key={item.id}
            onClick={() => onCambiarPantalla(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              background: pantallaActiva === item.id ? 'var(--color-bg)' : 'transparent',
              borderLeft:
                pantallaActiva === item.id
                  ? '3px solid var(--color-accent)'
                  : '3px solid transparent',
              fontWeight: pantallaActiva === item.id ? 600 : 400,
              color: 'var(--color-text)'
            }}
          >
            <span>{item.label}</span>
            {/* Recordatorio de stock bajo (HU-08), solo Administrador y solo
                si hay algo que mostrar — decisión del dueño, 16/11/2026: no
                filtra solo al hacer clic, es nada más un recordatorio para
                que entre y use los filtros que ya tiene ahí. */}
            {item.id === 'stock' && usuario?.rol === 'Administrador' && !!stockBajo && (
              <span
                className="font-data"
                title={`${stockBajo} producto${stockBajo === 1 ? '' : 's'} con stock bajo`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: 'var(--color-alert)',
                  borderRadius: 999,
                  minWidth: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px'
                }}
              >
                {stockBajo}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Zona inferior: usuario actual y cierre de sesión */}
      <div style={{ marginTop: 'auto', padding: '0 var(--space-4)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sesión iniciada como</div>
        <div style={{ fontWeight: 600 }}>{usuario?.nombre}</div>
        <div
          style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}
        >
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

// src/renderer/src/screens/CompraScreen.tsx
//
// Alta de compras (HU-14, HU-15, HU-16), separada del historial (ver
// HistorialComprasScreen) y de Control de stock. Reusa los formularios de
// StockScreen.tsx sin cambiar su lógica de negocio (lotes, garantía, etc.).
// Dos modos: compra de un producto existente, o producto nuevo con su
// primer lote.

import { useEffect, useState } from 'react'
import { useCategorias, useProductos, useProveedores } from '../api/hooks'
import { FormularioCompra, FormularioProductoNuevo } from './StockScreen'
import type { Producto } from '../api/types'

type Modo = 'existente' | 'nuevo'

const panel: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 'var(--space-4)',
  marginBottom: 'var(--space-3)'
}

function botonModo(activo: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    border: `1px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius)',
    background: activo ? 'var(--color-accent)' : 'var(--color-surface)',
    color: activo ? '#fff' : 'var(--color-text)',
    fontWeight: activo ? 600 : 400
  }
}

export function CompraScreen(): React.JSX.Element {
  const [modo, setModo] = useState<Modo>('existente')
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Debounce del buscador (300 ms) para no pedir en cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 300)
    return () => clearTimeout(id)
  }, [texto])

  const proveedores = useProveedores()
  const categorias = useCategorias()
  const resultados = useProductos({ q: q || undefined, pagina: 1, porPagina: 8 })

  const cambiarModo = (m: Modo): void => {
    setModo(m)
    setElegido(null)
    setAviso(null)
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Nueva compra</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Cada compra crea un lote de stock. El historial está en &ldquo;Historial de compras&rdquo;.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <button onClick={() => cambiarModo('existente')} style={botonModo(modo === 'existente')}>
          Producto existente
        </button>
        <button onClick={() => cambiarModo('nuevo')} style={botonModo(modo === 'nuevo')}>
          Producto nuevo
        </button>
      </div>

      {aviso && (
        <div style={{ ...panel, color: 'var(--color-ok)', fontWeight: 600, fontSize: 13 }}>
          {aviso}
        </div>
      )}

      {modo === 'nuevo' ? (
        <FormularioProductoNuevo
          categorias={categorias.datos}
          proveedores={proveedores.datos}
          onCategoriaCreada={categorias.refrescar}
          onProveedorCreado={proveedores.refrescar}
          onCerrar={() => setModo('existente')}
          onGuardado={() => setAviso('Producto y primer lote registrados.')}
        />
      ) : elegido ? (
        <div style={panel}>
          <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 14 }}>
            Compra de: {elegido.nombre}
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <FormularioCompra
                productoId={elegido.id}
                proveedores={proveedores.datos}
                onProveedorCreado={proveedores.refrescar}
                onCerrar={() => setElegido(null)}
                onGuardado={() => setAviso(`Compra registrada: ${elegido.nombre}.`)}
              />
            </tbody>
          </table>
        </div>
      ) : (
        <div style={panel}>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
            Buscar producto
          </label>
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej: batería, filtro..."
            style={{
              padding: 4,
              width: 260,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)'
            }}
          />
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-3)' }}
          >
            {resultados.datos.items.length === 0 && !resultados.cargando && (
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                No hay productos con ese nombre. Si es nuevo, usá &ldquo;Producto nuevo&rdquo;.
              </span>
            )}
            {resultados.datos.items.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setElegido(p)
                  setAviso(null)
                }}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>{p.nombre}</span>
                <span className="font-data" style={{ color: 'var(--color-text-muted)' }}>
                  stock {p.stock}
                </span>
              </button>
            ))}
            {resultados.datos.total > resultados.datos.items.length && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Hay {resultados.datos.total} productos: afiná la búsqueda para ver los demás.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
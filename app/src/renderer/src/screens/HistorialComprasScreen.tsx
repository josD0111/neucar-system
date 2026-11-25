// src/renderer/src/screens/HistorialComprasScreen.tsx
//
// Historial de compras (HU-38), separado de CompraScreen (que solo registra),
// con el mismo patrón que VentasScreen: bloques de 7 días calendario
// completos y "Cargar 7 días anteriores" con el cursor `antesDe`. Los filtros
// (proveedor, rango de fechas) se aplican en el servidor, antes de paginar.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../data/AuthContext'
import { useProveedores } from '../api/hooks'
import { historialComprasApi } from '../api/historialCompras'
import type { CompraListado } from '../api/types'

const DIAS_POR_PAGINA = 7

const panel: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 'var(--space-4)',
  marginBottom: 'var(--space-3)'
}
const estiloInput: React.CSSProperties = {
  padding: 4,
  height: 31,
  boxSizing: 'border-box',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}
const estiloBoton: React.CSSProperties = {
  padding: '0 12px',
  height: 31,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)'
}

const gs = (v: number | string): string => Number(v).toLocaleString('es-PY')

// `clave` es 'AAAA-MM-DD' (la fecha de una compra no tiene hora).
function etiquetaDia(clave: string): string {
  const [y, m, d] = clave.split('-').map(Number)
  const t = new Date(y, m - 1, d).toLocaleDateString('es-PY', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

interface GrupoDia {
  clave: string
  compras: CompraListado[]
  total: number
}

export function HistorialComprasScreen(): React.JSX.Element {
  const { token } = useAuth()
  const proveedores = useProveedores()

  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const hayFiltros = proveedorId !== '' || fechaDesde !== '' || fechaHasta !== ''

  const [compras, setCompras] = useState<CompraListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  // Cambia con cada filtro nuevo: permite descartar la respuesta de
  // "cargar anteriores" si los filtros cambiaron mientras estaba en vuelo.
  const generacion = useRef(0)

  // Primer bloque: se pide de nuevo al cambiar un filtro o con "↻ Actualizar".
  useEffect(() => {
    generacion.current++
    let cancelado = false
    historialComprasApi
      .listar(token, {
        proveedorId: proveedorId || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        dias: DIAS_POR_PAGINA
      })
      .then((r) => {
        if (cancelado) return
        setCargando(false)
        if (!r.ok) {
          setError(r.error.message)
          return
        }
        setError(null)
        setCompras(r.data.items)
        setHayMas(r.data.hayMas)
        setCursor(r.data.antesDe)
      })
    return () => {
      cancelado = true
    }
  }, [token, proveedorId, fechaDesde, fechaHasta, tick])

  const cargarAnteriores = (): void => {
    if (!cursor) return
    const generacionAlPedir = generacion.current
    setCargandoMas(true)
    historialComprasApi
      .listar(token, {
        proveedorId: proveedorId || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        dias: DIAS_POR_PAGINA,
        antesDe: cursor
      })
      .then((r) => {
        setCargandoMas(false)
        if (generacionAlPedir !== generacion.current) return
        if (!r.ok) {
          setError(r.error.message)
          return
        }
        setCompras((prev) => [...prev, ...r.data.items])
        setHayMas(r.data.hayMas)
        setCursor(r.data.antesDe)
      })
  }

  // El servidor ordena por fecha desc: alcanza con abrir un grupo nuevo
  // cada vez que cambia el día.
  const grupos = useMemo(() => {
    const res: GrupoDia[] = []
    for (const c of compras) {
      const monto = Number(c.precioCompra) * c.cantidad
      const ultimo = res[res.length - 1]
      if (ultimo && ultimo.clave === c.fecha) {
        ultimo.compras.push(c)
        ultimo.total += monto
      } else {
        res.push({ clave: c.fecha, compras: [c], total: monto })
      }
    }
    return res
  }, [compras])

  const limpiar = (): void => {
    setProveedorId('')
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Historial de compras</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Compras registradas a proveedores, agrupadas por día. Para cargar una compra nueva usá
        &ldquo;Nueva compra&rdquo;.
      </p>

      <div style={panel}>
        <div
          style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
              Proveedor
            </label>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value === '' ? '' : Number(e.target.value))}
              style={estiloInput}
            >
              <option value="">Todos</option>
              {proveedores.datos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              style={estiloInput}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              style={estiloInput}
            />
          </div>
          {hayFiltros && (
            <button onClick={limpiar} style={estiloBoton}>
              Limpiar filtros
            </button>
          )}
          <button onClick={() => setTick((t) => t + 1)} style={estiloBoton}>
            ↻ Actualizar
          </button>
        </div>
        {error && (
          <p style={{ color: 'var(--color-alert)', fontSize: 12, margin: '8px 0 0 0' }}>{error}</p>
        )}
      </div>

      {cargando ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando compras…</p>
      ) : grupos.length === 0 ? (
        <div style={panel}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>
            No hay compras que coincidan con el filtro.
          </p>
        </div>
      ) : (
        <>
          {grupos.map((g) => (
            <div key={g.clave} style={panel}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 'var(--space-2)'
                }}
              >
                <span style={{ fontWeight: 600 }}>{etiquetaDia(g.clave)}</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {g.compras.length} compra{g.compras.length === 1 ? '' : 's'} ·{' '}
                  <strong className="font-data" style={{ color: 'var(--color-text)' }}>
                    Gs. {gs(g.total)}
                  </strong>
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                    <th style={{ paddingBottom: 6 }}>Producto</th>
                    <th style={{ paddingBottom: 6 }}>Proveedor</th>
                    <th style={{ paddingBottom: 6 }}>Cant.</th>
                    <th style={{ paddingBottom: 6 }}>Disp.</th>
                    <th style={{ paddingBottom: 6 }}>Precio unit.</th>
                    <th style={{ paddingBottom: 6 }}>Total</th>
                    <th style={{ paddingBottom: 6 }}>Garantía</th>
                    <th style={{ paddingBottom: 6 }}>Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {g.compras.map((c) => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 8px 6px 0', fontWeight: 600 }}>{c.productoNombre}</td>
                      <td style={{ padding: 6 }}>{c.proveedorNombre}</td>
                      <td className="font-data" style={{ padding: 6 }}>{c.cantidad}</td>
                      <td className="font-data" style={{ padding: 6 }}>{c.cantidadDisponible}</td>
                      <td className="font-data" style={{ padding: 6 }}>{gs(c.precioCompra)}</td>
                      <td className="font-data" style={{ padding: 6 }}>
                        {gs(Number(c.precioCompra) * c.cantidad)}
                      </td>
                      <td style={{ padding: 6 }}>
                        {c.garantiaProveedor ? `${c.garantiaProveedor} meses` : '—'}
                      </td>
                      <td style={{ padding: 6 }}>{c.factura ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {hayMas && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={cargarAnteriores} disabled={cargandoMas} style={estiloBoton}>
                {cargandoMas ? 'Cargando…' : `Cargar ${DIAS_POR_PAGINA} días anteriores`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
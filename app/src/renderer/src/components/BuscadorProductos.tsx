// src/renderer/src/components/BuscadorProductos.tsx
//
// Franja A1 del nuevo flujo de Ventas (ver docs/03-gestion-proyecto/
// plan-tecnico-pantalla-ventas.md, Etapa 2, y el prototipo HTML de
// referencia). Busca contra el servidor (GET /api/productos?q=...), con
// debounce, igual criterio que el buscador de Cliente ya existente en
// VentaScreen.tsx — evita el bug ya resuelto de filtrar sobre una copia
// local paginada del catálogo.
//
// Marca: se muestra resuelta (marcaId -> nombre) vía la prop `nombreMarca`,
// que arma VentaScreen.tsx una sola vez con useMarcas(token) — mismo patrón
// que ya usa StockScreen.tsx. La búsqueda en sí sigue siendo solo por
// nombre: el filtro `q` del backend (routes/productos.ts) todavía no hace
// OR contra marcas.nombre, y `codigo` sigue sin existir en el esquema.

import { useEffect, useState } from 'react'
import { productosApi } from '../api/productos'
import type { Producto } from '../api/types'
import { useRetardo } from '../screens/useRetardo'
import { InputLimpiable } from './InputLimpiable'

// Mismo criterio de formato que CobroCredito.tsx / VentasScreen.tsx /
// HistorialServiciosScreen.tsx: moneda local (Gs.) con separador de miles,
// sin decimales (no se manejan centavos de guaraníes en el taller).
function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

interface BuscadorProductosProps {
  onSeleccionar: (producto: Producto) => void
  // Productos a excluir de los resultados (ya están en el detalle de la
  // venta como línea única por producto, si corresponde) — opcional: por
  // ahora el prototipo no excluye nada, un mismo producto puede agregarse
  // más de una vez (ej. con distinto lote). Se deja el hook por si cambia.
  soloConStock?: boolean
  // Cualquier cambio de valor (ej. incrementar un contador) fuerza un
  // nuevo pedido al servidor aunque la búsqueda no haya cambiado. Lo usa
  // VentaScreen.tsx después de registrar una venta: sin esto, el stock que
  // se ve acá quedaba desactualizado hasta cambiar de pantalla y volver.
  refrescarTrigger?: number
  // Resuelve marcaId -> nombre de marca (o null si no tiene). La arma
  // VentaScreen.tsx una sola vez con useMarcas(token) y se pasa acá para no
  // duplicar el pedido a GET /api/marcas.
  nombreMarca?: (marcaId: number | null) => string | null
}

export function BuscadorProductos({
  onSeleccionar,
  soloConStock = false,
  refrescarTrigger = 0,
  nombreMarca
}: BuscadorProductosProps): React.JSX.Element {
  const [texto, setTexto] = useState('')
  const textoRetardado = useRetardo(texto, 300)
  const [resultados, setResultados] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    productosApi
      .listar({ q: textoRetardado || undefined, soloConStock, porPagina: 20 })
      .then((res) => {
        if (!cancelado) setResultados(res.items)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el catálogo de productos.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [textoRetardado, soloConStock, refrescarTrigger])

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <h2
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: 'var(--color-text-muted)',
          margin: '0 0 var(--space-1) 0'
        }}
      >
        Búsqueda de productos / repuestos
      </h2>

      <InputLimpiable
        value={texto}
        onChange={setTexto}
        placeholder="Buscar por nombre..."
        autoFocus
        style={{
          width: '100%',
          padding: '6px 9px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-1)'
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg)' }}>
              <th style={celdaCabecera}>Producto</th>
              <th style={{ ...celdaCabecera, width: 120 }}>Marca</th>
              <th style={{ ...celdaCabecera, textAlign: 'center', width: 80 }}>Stock</th>
              <th style={{ ...celdaCabecera, textAlign: 'right', width: 110 }}>Precio base</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={4} style={{ ...celda, textAlign: 'center', color: 'var(--color-alert)' }}>
                  {error}
                </td>
              </tr>
            )}
            {!error && !cargando && resultados.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...celda, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {texto ? `No se encontraron productos con "${texto}".` : 'Sin productos para mostrar.'}
                </td>
              </tr>
            )}
            {resultados.map((p) => {
              const stockBajo = p.stockMinimo != null && p.stock <= p.stockMinimo
              return (
                <tr
                  key={p.id}
                  onClick={() => onSeleccionar(p)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={celda}>{p.nombre}</td>
                  <td style={{ ...celda, color: 'var(--color-text-muted)' }}>
                    {nombreMarca?.(p.marcaId) ?? '—'}
                  </td>
                  <td
                    style={{
                      ...celda,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: stockBajo ? 'var(--color-alert)' : 'var(--color-text)'
                    }}
                  >
                    {p.stock}
                  </td>
                  <td style={{ ...celda, textAlign: 'right', fontWeight: 600 }}>
                    Gs. {gs(p.precioBase)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const celdaCabecera: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  color: 'var(--color-text-muted)',
  padding: '5px 8px',
  borderBottom: '1px solid var(--color-border)'
}

const celda: React.CSSProperties = {
  padding: '5px 8px',
  borderBottom: '1px solid var(--color-border)'
}

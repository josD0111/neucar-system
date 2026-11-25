// src/renderer/src/components/TablaDetalleVenta.tsx
//
// Franja C del nuevo flujo de Ventas (ver docs/03-gestion-proyecto/
// plan-tecnico-pantalla-ventas.md, Etapa 2, y el prototipo HTML de
// referencia): lista los ítems ya agregados a la venta en curso. Clic en
// una fila → se carga en la Franja B (FormularioItemEdicion.tsx) para
// editarla; el botón de la columna "Acción" elimina la fila directo, sin
// pasar por edición.
//
// Es un componente de presentación puro: no guarda estado propio ni llama a
// ningún endpoint — recibe `items` de quien ensambla la pantalla (Etapa 3)
// y notifica clics hacia arriba. El tipo `LineaVenta` es el mismo que arma
// FormularioItemEdicion.tsx al confirmar un ítem (con `idLinea` siempre
// presente acá, a diferencia de `ItemEdicion`, donde puede ser `null`
// mientras no se agregó todavía).

import type { Producto } from '../api/types'

// Mismo criterio de formato que CobroCredito.tsx / VentasScreen.tsx /
// HistorialServiciosScreen.tsx: moneda local (Gs.) con separador de miles.
function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

export interface LineaVenta {
  idLinea: number
  producto: Producto
  compraId: number | ''
  // Mismo texto que el selector de Lote de la Franja B (`#id - (fecha) -
  // proveedor`), resuelto ahí y guardado acá para no tener que volver a
  // pedir los lotes/proveedores solo para mostrar esta columna. `null` si
  // no aplica (rol Empleado, sin selección de lote).
  loteTexto: string | null
  cantidad: number
  precioUnitario: number
  garantiaOfrecida: number | ''
}

interface TablaDetalleVentaProps {
  items: LineaVenta[]
  // Fila que se está editando en este momento en la Franja B, para
  // resaltarla (mismo criterio visual que `.editing-row` en el prototipo).
  idLineaEditando: number | null
  esAdmin: boolean
  onEditar: (linea: LineaVenta) => void
  onEliminar: (idLinea: number) => void
  // Resuelve marcaId -> nombre de marca (o null si no tiene), armado una
  // sola vez en VentaScreen.tsx con useMarcas(token) — mismo patrón que
  // BuscadorProductos.tsx y FormularioItemEdicion.tsx. Se muestra como
  // subtexto bajo el nombre del producto (mismo patrón visual que ya usa
  // StockScreen.tsx), para distinguir productos iguales de distinta marca.
  nombreMarca?: (marcaId: number | null) => string | null
}

export function TablaDetalleVenta({
  items,
  idLineaEditando,
  esAdmin,
  onEditar,
  onEliminar,
  nombreMarca
}: TablaDetalleVentaProps): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--color-text-muted)',
              margin: 0
            }}
          >
            Ítems en el detalle de venta
          </h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            (clic en una fila para editar)
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 10px',
            borderRadius: 999,
            background: 'var(--color-bg)',
            color: 'var(--color-text-muted)'
          }}
        >
          {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg)' }}>
              <th style={celdaCabecera}>Producto / repuesto</th>
              {esAdmin && <th style={{ ...celdaCabecera, width: 190 }}>Lote</th>}
              <th style={{ ...celdaCabecera, width: 60, textAlign: 'center' }}>Cant.</th>
              <th style={{ ...celdaCabecera, width: 110, textAlign: 'right' }}>Precio unit.</th>
              {esAdmin && <th style={{ ...celdaCabecera, width: 90, textAlign: 'center' }}>Garantía</th>}
              <th style={{ ...celdaCabecera, width: 120, textAlign: 'right' }}>Subtotal</th>
              <th style={{ ...celdaCabecera, width: 60, textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={esAdmin ? 7 : 5}
                  style={{
                    ...celda,
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                    padding: '24px 10px'
                  }}
                >
                  Todavía no agregaste ningún producto a esta venta.
                </td>
              </tr>
            )}
            {items.map((linea) => {
              const enEdicion = linea.idLinea === idLineaEditando
              const subtotal = linea.cantidad * linea.precioUnitario
              return (
                <tr
                  key={linea.idLinea}
                  onClick={() => onEditar(linea)}
                  style={{
                    cursor: 'pointer',
                    background: enEdicion ? 'var(--color-bg)' : 'transparent',
                    outline: enEdicion ? '1px solid var(--color-accent)' : 'none',
                    outlineOffset: -1
                  }}
                  onMouseEnter={(e) => {
                    if (!enEdicion) e.currentTarget.style.background = 'var(--color-bg)'
                  }}
                  onMouseLeave={(e) => {
                    if (!enEdicion) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <td style={celda}>
                    {linea.producto.nombre}
                    {(() => {
                      const marca = nombreMarca?.(linea.producto.marcaId)
                      return (
                        marca && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11,
                              fontWeight: 400,
                              color: 'var(--color-text-muted)'
                            }}
                          >
                            {marca}
                          </span>
                        )
                      )
                    })()}
                  </td>
                  {esAdmin && (
                    <td style={{ ...celda, fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {linea.loteTexto ?? `Lote #${linea.compraId}`}
                    </td>
                  )}
                  <td style={{ ...celda, textAlign: 'center' }}>{linea.cantidad}</td>
                  <td style={{ ...celda, textAlign: 'right' }}>Gs. {gs(linea.precioUnitario)}</td>
                  {esAdmin && (
                    <td style={{ ...celda, textAlign: 'center' }}>
                      {linea.garantiaOfrecida !== '' && linea.garantiaOfrecida > 0
                        ? `${linea.garantiaOfrecida} m`
                        : '—'}
                    </td>
                  )}
                  <td style={{ ...celda, textAlign: 'right', fontWeight: 600 }}>Gs. {gs(subtotal)}</td>
                  <td style={{ ...celda, textAlign: 'center' }}>
                    <button
                      type="button"
                      title="Eliminar ítem"
                      onClick={(e) => {
                        e.stopPropagation() // no dispara onEditar al eliminar
                        onEliminar(linea.idLinea)
                      }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'var(--color-alert)',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      ✕
                    </button>
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
  padding: '6px 10px',
  borderBottom: '1px solid var(--color-border)',
  position: 'sticky',
  top: 0,
  background: 'var(--color-bg)'
}

const celda: React.CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid var(--color-border)'
}

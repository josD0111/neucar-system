// src/renderer/src/screens/StockScreen.tsx
//
// Pantalla priorizada explícitamente por el dueño: el control de stock es
// lo más importante del sistema. Muestra el stock total por producto
// (agregado de sus lotes — ver entidades-dominio.md, secciones 5 y 14) y
// permite expandir el desglose por lote/proveedor/garantía, además de
// registrar una nueva compra.

import { useState, Fragment } from 'react'
import { useAppData } from '../data/AppDataContext'

function Panel({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-3)'
      }}
    >
      {title && <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 14, fontWeight: 600 }}>{title}</h3>}
      {children}
    </div>
  )
}

function FormularioCompra({ productoId, onCerrar }: { productoId: number; onCerrar: () => void }) {
  const { registrarCompra } = useAppData()
  const [proveedorNombre, setProveedorNombre] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [cantidad, setCantidad] = useState(1)
  const [precioCompra, setPrecioCompra] = useState(0)
  const [garantia, setGarantia] = useState<number | ''>('')

  const guardar = () => {
    if (!proveedorNombre.trim()) return
    registrarCompra(
      productoId,
      proveedorNombre,
      fecha,
      cantidad,
      precioCompra,
      garantia === '' ? null : garantia
    )
    onCerrar()
  }

  return (
    <tr style={{ background: 'var(--color-bg)' }}>
      <td colSpan={5} style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>Proveedor</label>
            <input
              value={proveedorNombre}
              onChange={(e) => setProveedorNombre(e.target.value)}
              placeholder="Nombre del proveedor"
              style={{ padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="font-data"
              style={{ padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>Cantidad</label>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="font-data"
              style={{ width: 70, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>Precio compra (unit.)</label>
            <input
              type="number"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(Number(e.target.value))}
              className="font-data"
              style={{ width: 110, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
              Garantía proveedor (meses, opcional)
            </label>
            <input
              type="number"
              value={garantia}
              onChange={(e) => setGarantia(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ width: 90, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <button
            onClick={guardar}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontWeight: 600
            }}
          >
            Guardar lote
          </button>
          <button
            onClick={onCerrar}
            style={{ padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
}

export function StockScreen() {
  const { productos, lotesDeProducto, stockDeProducto } = useAppData()
  const [expandido, setExpandido] = useState<number | null>(null)
  const [formularioAbierto, setFormularioAbierto] = useState<number | null>(null)

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Control de stock</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        El stock de cada producto es la suma de sus lotes de compra. Desplegá un producto para ver el detalle por
        proveedor y garantía.
      </p>

      <Panel>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
              <th style={{ paddingBottom: 8 }} />
              <th style={{ paddingBottom: 8 }}>Producto</th>
              <th style={{ paddingBottom: 8 }}>Categoría</th>
              <th style={{ paddingBottom: 8 }}>Stock total</th>
              <th style={{ paddingBottom: 8 }} />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const stock = stockDeProducto(p.id)
              const bajoMinimo = stock <= p.stockMinimo
              const abierto = expandido === p.id
              const lotes = lotesDeProducto(p.id)

              return (
                <Fragment key={p.id}>
                  <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 8, width: 24 }}>
                      <button
                        onClick={() => setExpandido(abierto ? null : p.id)}
                        style={{ border: 'none', background: 'none', fontSize: 14 }}
                        aria-label="Ver lotes"
                      >
                        {abierto ? '▾' : '▸'}
                      </button>
                    </td>
                    <td style={{ padding: 8 }}>{p.nombre}</td>
                    <td style={{ padding: 8, color: 'var(--color-text-muted)' }}>{p.categoria}</td>
                    <td className="font-data" style={{ padding: 8 }}>
                      <span style={{ fontWeight: 600, color: bajoMinimo ? 'var(--color-alert)' : 'var(--color-text)' }}>
                        {stock}
                      </span>
                      {bajoMinimo && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius)',
                            background: 'var(--color-alert-bg)',
                            color: 'var(--color-alert)'
                          }}
                        >
                          Stock bajo (mín. {p.stockMinimo})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      <button
                        onClick={() => setFormularioAbierto(formularioAbierto === p.id ? null : p.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius)',
                          background: 'var(--color-bg)'
                        }}
                      >
                        + Registrar compra
                      </button>
                    </td>
                  </tr>

                  {formularioAbierto === p.id && (
                    <FormularioCompra productoId={p.id} onCerrar={() => setFormularioAbierto(null)} />
                  )}

                  {abierto && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 8px 12px 32px' }}>
                        {lotes.length === 0 ? (
                          <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Sin lotes con stock disponible.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '4px 8px 4px 0' }}>Proveedor</th>
                                <th style={{ padding: 4 }}>Fecha</th>
                                <th style={{ padding: 4 }}>Disponible</th>
                                <th style={{ padding: 4 }}>Garantía proveedor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lotes.map((lote) => (
                                <tr key={lote.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '4px 8px 4px 0' }}>{lote.proveedorNombre}</td>
                                  <td className="font-data" style={{ padding: 4 }}>
                                    {lote.fecha}
                                  </td>
                                  <td className="font-data" style={{ padding: 4 }}>
                                    {lote.cantidadDisponible}
                                  </td>
                                  <td style={{ padding: 4 }}>
                                    {lote.garantiaProveedorMeses ? `${lote.garantiaProveedorMeses} meses` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
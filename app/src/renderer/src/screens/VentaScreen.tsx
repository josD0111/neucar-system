// src/renderer/src/screens/VentaScreen.tsx
//
// Cubre 3 de los 5 flujos críticos del prototipo (ver plan-gestion-proyecto.md,
// sección 2.1):
//  1. Venta con productos mixtos (contado + crédito) — entidades-dominio.md, sección 12
//  2. Garantía validada contra el lote (Compra) específico — sección 14
//  3. Vista diferenciada por rol: el Empleado no ve el campo de ajuste de
//     precio — HU-17/HU-18
//
// El precio que carga el Administrador puede ser MENOR o MAYOR al precio
// base (no solo un descuento) — se muestra neutral, sin asumir dirección.

import { useMemo, useState } from 'react'
import { useAppData } from '../data/AppDataContext'
import type { Rol } from '../components/Sidebar'

interface LineaVenta {
  id: number
  productoId: number
  compraId: number
  cantidad: number
  precioUnitario: number
  tipoPago: 'Contado' | 'Crédito'
  garantiaOfrecida: number | ''
}

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

function lineaInicial(id: number, productoId: number, compraId: number, precioUnitario: number): LineaVenta {
  return { id, productoId, compraId, cantidad: 1, precioUnitario, tipoPago: 'Contado', garantiaOfrecida: '' }
}

export function VentaScreen({ rol }: { rol: Rol }) {
  const { productos, clientes, lotesDeProducto, registrarVenta } = useAppData()

  const primerProducto = productos[0]
  const primerLote = lotesDeProducto(primerProducto.id)[0]

  const [clienteId, setClienteId] = useState<number | ''>('')
  const [lineas, setLineas] = useState<LineaVenta[]>([
    lineaInicial(1, primerProducto.id, primerLote?.id ?? 0, primerProducto.precioBase)
  ])
  const [mensaje, setMensaje] = useState<string | null>(null)

  const agregarLinea = () => {
    const nextId = lineas.length ? Math.max(...lineas.map((l) => l.id)) + 1 : 1
    const p = productos[0]
    const lote = lotesDeProducto(p.id)[0]
    setLineas([...lineas, lineaInicial(nextId, p.id, lote?.id ?? 0, p.precioBase)])
  }

  const actualizarLinea = (id: number, cambios: Partial<LineaVenta>) => {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)))
  }

  const quitarLinea = (id: number) => {
    setLineas((prev) => prev.filter((l) => l.id !== id))
  }

  const total = useMemo(() => lineas.reduce((acc, l) => acc + l.precioUnitario * l.cantidad, 0), [lineas])
  const totalCredito = useMemo(
    () => lineas.filter((l) => l.tipoPago === 'Crédito').reduce((acc, l) => acc + l.precioUnitario * l.cantidad, 0),
    [lineas]
  )

  const clienteRequerido = lineas.some((l) => l.tipoPago === 'Crédito')
  const puedeRegistrar = lineas.length > 0 && !(clienteRequerido && clienteId === '') && !mensaje

  const handleRegistrar = () => {
    registrarVenta(clienteId === '' ? null : clienteId, lineas)
    setMensaje(
      `Venta registrada por Gs. ${total.toLocaleString('es-PY')}` +
        (totalCredito > 0 ? ` (Gs. ${totalCredito.toLocaleString('es-PY')} a crédito).` : '.')
    )
  }

  const nuevaVenta = () => {
    const p = productos[0]
    const lote = lotesDeProducto(p.id)[0]
    setLineas([lineaInicial(1, p.id, lote?.id ?? 0, p.precioBase)])
    setClienteId('')
    setMensaje(null)
  }

  if (mensaje) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Nueva venta</h2>
        <Panel>
          <p style={{ color: 'var(--color-ok)', fontWeight: 600, marginTop: 0 }}>✓ {mensaje}</p>
          <button
            onClick={nuevaVenta}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontWeight: 600
            }}
          >
            Registrar otra venta
          </button>
        </Panel>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Nueva venta</h2>

      <Panel title="Cliente">
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', minWidth: 260 }}
        >
          <option value="">Cliente casual (sin registrar)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} — {c.cedula}
            </option>
          ))}
        </select>
        {clienteRequerido && clienteId === '' && (
          <p style={{ color: 'var(--color-alert)', fontSize: 12, marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Hay ítems a crédito en esta venta: se requiere seleccionar un cliente registrado (ver HU-10).
          </p>
        )}
      </Panel>

      <Panel title="Productos">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
              <th style={{ paddingBottom: 8 }}>Producto</th>
              <th style={{ paddingBottom: 8 }}>Lote / garantía proveedor</th>
              <th style={{ paddingBottom: 8 }}>Cant.</th>
              <th style={{ paddingBottom: 8 }}>Precio base</th>
              {rol === 'Administrador' && <th style={{ paddingBottom: 8 }}>Precio a cobrar</th>}
              <th style={{ paddingBottom: 8 }}>Pago</th>
              <th style={{ paddingBottom: 8 }}>Garantía al cliente</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => {
              const producto = productos.find((p) => p.id === linea.productoId)!
              const lotesDisponibles = lotesDeProducto(linea.productoId)
              const loteSeleccionado = lotesDisponibles.find((c) => c.id === linea.compraId)
              const garantiaMax = loteSeleccionado?.garantiaProveedorMeses ?? null
              const diferenciaPrecio = linea.precioUnitario - producto.precioBase

              return (
                <tr key={linea.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 8px 8px 0' }}>
                    <select
                      value={linea.productoId}
                      onChange={(e) => {
                        const productoId = Number(e.target.value)
                        const nuevoProducto = productos.find((p) => p.id === productoId)!
                        const primerLote = lotesDeProducto(productoId)[0]
                        actualizarLinea(linea.id, {
                          productoId,
                          precioUnitario: nuevoProducto.precioBase,
                          compraId: primerLote?.id ?? 0,
                          garantiaOfrecida: ''
                        })
                      }}
                      style={{ padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                    >
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: 8 }}>
                    <select
                      value={linea.compraId}
                      onChange={(e) => actualizarLinea(linea.id, { compraId: Number(e.target.value), garantiaOfrecida: '' })}
                      style={{ padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                    >
                      {lotesDisponibles.map((lote) => (
                        <option key={lote.id} value={lote.id}>
                          {lote.proveedorNombre} ({lote.fecha}) ·{' '}
                          {lote.garantiaProveedorMeses ? `${lote.garantiaProveedorMeses}m garantía` : 'sin garantía'} ·{' '}
                          {lote.cantidadDisponible} disp.
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min={1}
                      max={loteSeleccionado?.cantidadDisponible ?? 1}
                      value={linea.cantidad}
                      onChange={(e) => actualizarLinea(linea.id, { cantidad: Number(e.target.value) })}
                      className="font-data"
                      style={{ width: 56, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                    />
                  </td>

                  <td className="font-data" style={{ padding: 8, color: 'var(--color-text-muted)' }}>
                    {producto.precioBase.toLocaleString('es-PY')}
                  </td>

                  {rol === 'Administrador' && (
                    <td style={{ padding: 8 }}>
                      <input
                        type="number"
                        value={linea.precioUnitario}
                        onChange={(e) => actualizarLinea(linea.id, { precioUnitario: Number(e.target.value) })}
                        className="font-data"
                        style={{ width: 90, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                      />
                      {diferenciaPrecio !== 0 && (
                        <div style={{ fontSize: 11, color: diferenciaPrecio < 0 ? 'var(--color-ok)' : 'var(--color-info)' }}>
                          {diferenciaPrecio < 0 ? '↓ ' : '↑ '}
                          {Math.abs(diferenciaPrecio).toLocaleString('es-PY')} vs. base
                        </div>
                      )}
                    </td>
                  )}

                  <td style={{ padding: 8 }}>
                    <select
                      value={linea.tipoPago}
                      onChange={(e) => actualizarLinea(linea.id, { tipoPago: e.target.value as 'Contado' | 'Crédito' })}
                      style={{ padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                    >
                      <option value="Contado">Contado</option>
                      <option value="Crédito">Crédito</option>
                    </select>
                  </td>

                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      placeholder={garantiaMax ? `máx. ${garantiaMax}m` : 'sin garantía'}
                      disabled={garantiaMax === null}
                      value={linea.garantiaOfrecida}
                      onChange={(e) =>
                        actualizarLinea(linea.id, { garantiaOfrecida: e.target.value === '' ? '' : Number(e.target.value) })
                      }
                      className="font-data"
                      style={{
                        width: 90,
                        padding: 4,
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                        background: garantiaMax === null ? 'var(--color-bg)' : 'var(--color-surface)'
                      }}
                    />
                    {garantiaMax !== null && typeof linea.garantiaOfrecida === 'number' && linea.garantiaOfrecida > garantiaMax && (
                      <div style={{ fontSize: 11, color: 'var(--color-alert)' }}>Supera garantía del proveedor ({garantiaMax}m)</div>
                    )}
                  </td>

                  <td style={{ padding: 8 }}>
                    <button onClick={() => quitarLinea(linea.id)} style={{ border: 'none', background: 'none', color: 'var(--color-alert)' }} aria-label="Quitar línea">
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <button
          onClick={agregarLinea}
          style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)' }}
        >
          + Agregar producto
        </button>
      </Panel>

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="font-data" style={{ fontSize: 22 }}>
              Total: Gs. {total.toLocaleString('es-PY')}
            </div>
            {totalCredito > 0 && (
              <div style={{ fontSize: 12, color: 'var(--color-alert)' }}>
                Gs. {totalCredito.toLocaleString('es-PY')} queda a crédito
              </div>
            )}
          </div>
          <button
            disabled={!puedeRegistrar}
            onClick={handleRegistrar}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: puedeRegistrar ? 'var(--color-accent)' : 'var(--color-border)',
              color: '#fff',
              fontWeight: 600,
              cursor: puedeRegistrar ? 'pointer' : 'not-allowed'
            }}
          >
            Registrar venta
          </button>
        </div>
      </Panel>
    </div>
  )
}
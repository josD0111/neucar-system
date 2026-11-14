// src/renderer/src/components/HistorialOrdenes.tsx
//
// Historial de órdenes de servicio (HU-26). Se usa de dos formas:
//   <HistorialOrdenes clienteId={3} />    → órdenes de un cliente (ficha del cliente)
//   <HistorialOrdenes vehiculoId={5} />   → órdenes de un vehículo (por chapa)
//
// Muestra las más recientes primero; al tocar una fila se despliega el detalle
// de cada tarea. No muestra saldos: el cobro de las órdenes a crédito es del
// módulo de pagos; acá solo se ve la forma de pago y la fecha prevista.
//
// Si el padre cambia de cliente o vehículo, conviene pasarle un `key` distinto
// (ej. key={cliente.id}) para que el componente se monte de nuevo y no muestre
// por un instante los datos del anterior.

import { useState } from 'react'
import { useOrdenesServicio } from '../api/hooks'
import type { OrdenServicio } from '../api/types'
import { useAuth } from '../data/AuthContext'

interface Props {
  clienteId?: number
  vehiculoId?: number
}

// Formato de guaraníes: 150000 → "150.000".
const gs = (n: number): string => n.toLocaleString('es-PY')

// "2026-12-15" → "15/12/2026".
function fechaPrevista(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Fecha y hora de la orden, en hora local (la API la entrega como texto ISO).
function fechaOrden(iso: string): string {
  return new Date(iso).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
}

function textoVehiculo(o: OrdenServicio): string {
  return [o.vehiculoChapa ?? 'Sin chapa', o.vehiculoMarca, o.vehiculoColor].filter(Boolean).join(' · ')
}

function textoPago(o: OrdenServicio): string {
  if (o.tipoPago !== 'Crédito') return 'Contado'
  return o.fechaPagoPrevista ? `Crédito · pago previsto ${fechaPrevista(o.fechaPagoPrevista)}` : 'Crédito'
}

export function HistorialOrdenes({ clienteId, vehiculoId }: Props): React.JSX.Element {
  const { token } = useAuth()
  const { datos: ordenes, cargando, error } = useOrdenesServicio(token, { clienteId, vehiculoId, limite: 100 })
  const [abierta, setAbierta] = useState<number | null>(null)

  // Si ya se filtra por cliente, no hace falta repetir su nombre en cada fila
  // (y lo mismo con el vehículo).
  const verVehiculo = vehiculoId === undefined
  const verCliente = clienteId === undefined
  const columnas = 4 + (verVehiculo ? 1 : 0) + (verCliente ? 1 : 0)

  if (cargando) return <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Cargando…</p>
  if (error) return <p style={{ margin: 0, color: 'var(--color-alert)', fontSize: 13 }}>{error}</p>
  if (ordenes.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>No hay órdenes de servicio registradas.</p>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
          <th style={{ paddingBottom: 8 }}>Fecha</th>
          {verVehiculo && <th style={{ paddingBottom: 8 }}>Vehículo</th>}
          {verCliente && <th style={{ paddingBottom: 8 }}>Cliente</th>}
          <th style={{ paddingBottom: 8 }}>Tareas</th>
          <th style={{ paddingBottom: 8, textAlign: 'right' }}>Total</th>
          <th style={{ paddingBottom: 8 }}>Pago</th>
        </tr>
      </thead>
      <tbody>
        {ordenes.map((o) => {
          const estaAbierta = abierta === o.id
          return (
            <FilaOrden
              key={o.id}
              orden={o}
              estaAbierta={estaAbierta}
              columnas={columnas}
              verVehiculo={verVehiculo}
              verCliente={verCliente}
              onAlternar={() => setAbierta(estaAbierta ? null : o.id)}
            />
          )
        })}
      </tbody>
    </table>
  )
}

// Una orden: fila resumen y, si está abierta, el detalle de cada tarea.
function FilaOrden({
  orden,
  estaAbierta,
  columnas,
  verVehiculo,
  verCliente,
  onAlternar
}: {
  orden: OrdenServicio
  estaAbierta: boolean
  columnas: number
  verVehiculo: boolean
  verCliente: boolean
  onAlternar: () => void
}): React.JSX.Element {
  return (
    <>
      <tr
        onClick={onAlternar}
        style={{
          borderTop: '1px solid var(--color-border)',
          cursor: 'pointer',
          background: estaAbierta ? 'var(--color-bg)' : 'transparent'
        }}
      >
        <td className="font-data" style={{ padding: 8, whiteSpace: 'nowrap' }}>{fechaOrden(orden.fecha)}</td>
        {verVehiculo && <td className="font-data" style={{ padding: 8 }}>{textoVehiculo(orden)}</td>}
        {verCliente && <td style={{ padding: 8 }}>{orden.clienteNombre ?? 'Cliente casual'}</td>}
        <td style={{ padding: 8 }}>{orden.servicios.map((s) => s.tipoServicio).join(', ')}</td>
        <td className="font-data" style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
          Gs. {gs(Number(orden.montoTotal))}
        </td>
        <td style={{ padding: 8 }}>{textoPago(orden)}</td>
      </tr>
      {estaAbierta && (
        <tr style={{ background: 'var(--color-bg)' }}>
          <td colSpan={columnas} style={{ padding: '4px 8px 12px 8px' }}>
            {orden.servicios.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>
                  {s.tipoServicio}
                  {s.detalle ? ` (${s.detalle})` : ''}
                </span>
                <span className="font-data">Gs. {gs(Number(s.monto))}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Orden #{orden.id} · registrada por {orden.usuarioNombre}
              {orden.tipoComprobante ? ` · ${orden.tipoComprobante}` : ''}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
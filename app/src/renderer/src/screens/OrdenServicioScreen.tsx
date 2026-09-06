// src/renderer/src/screens/OrdenServicioScreen.tsx
//
// Cubre el flujo crítico "carga de varios servicios en una misma visita"
// (ver plan-gestion-proyecto.md, sección 2.1, y entidades-dominio.md, sección 11).

import { useMemo, useState } from 'react'
import { useAppData } from '../data/AppDataContext'

interface LineaServicio {
  id: number
  tipoServicio: string
  monto: number
}

const TIPOS_SERVICIO = ['Alineación', 'Balanceo', 'Cambio de aceite', 'Montaje', 'Gomería', 'Otro']

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

export function OrdenServicioScreen() {
  const { clientes, registrarOrdenServicio } = useAppData()

  const [clienteId, setClienteId] = useState<number | ''>('')
  const [marca, setMarca] = useState('')
  const [chapa, setChapa] = useState('')
  const [tipoPago, setTipoPago] = useState<'Contado' | 'Crédito'>('Contado')
  const [garantiaDias, setGarantiaDias] = useState<number | ''>('')
  const [servicios, setServicios] = useState<LineaServicio[]>([{ id: 1, tipoServicio: 'Alineación', monto: 60000 }])
  const [mensaje, setMensaje] = useState<string | null>(null)

  const agregarServicio = () => {
    const nextId = servicios.length ? Math.max(...servicios.map((s) => s.id)) + 1 : 1
    setServicios([...servicios, { id: nextId, tipoServicio: TIPOS_SERVICIO[0], monto: 0 }])
  }

  const actualizarServicio = (id: number, cambios: Partial<LineaServicio>) => {
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)))
  }

  const quitarServicio = (id: number) => {
    setServicios((prev) => prev.filter((s) => s.id !== id))
  }

  const total = useMemo(() => servicios.reduce((acc, s) => acc + s.monto, 0), [servicios])
  const puedeRegistrar = servicios.length > 0 && !(tipoPago === 'Crédito' && clienteId === '')

  const handleRegistrar = () => {
    registrarOrdenServicio(
      clienteId === '' ? null : clienteId,
      servicios,
      tipoPago,
      garantiaDias === '' ? null : garantiaDias
    )
    setMensaje(
      `Orden de servicio registrada por Gs. ${total.toLocaleString('es-PY')}` +
        (tipoPago === 'Crédito' ? ' (a crédito).' : '.')
    )
  }

  const nuevaOrden = () => {
    setServicios([{ id: 1, tipoServicio: 'Alineación', monto: 60000 }])
    setClienteId('')
    setMarca('')
    setChapa('')
    setTipoPago('Contado')
    setGarantiaDias('')
    setMensaje(null)
  }

  if (mensaje) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Nueva orden de servicio</h2>
        <Panel>
          <p style={{ color: 'var(--color-ok)', fontWeight: 600, marginTop: 0 }}>✓ {mensaje}</p>
          <button
            onClick={nuevaOrden}
            style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', borderRadius: 'var(--radius)', background: 'var(--color-accent)', color: '#fff', fontWeight: 600 }}
          >
            Registrar otra orden
          </button>
        </Panel>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Nueva orden de servicio</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Los datos de la visita se completan una sola vez; cada tarea se agrega como una línea aparte.
      </p>

      <Panel title="Datos de la visita">
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', minWidth: 220 }}
            >
              <option value="">Cliente casual</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Marca del vehículo</label>
            <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej. Toyota" style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Chapa</label>
            <input value={chapa} onChange={(e) => setChapa(e.target.value)} placeholder="Ej. ABC 123" className="font-data" style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }} />
          </div>
        </div>
      </Panel>

      <Panel title="Tareas realizadas">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
              <th style={{ paddingBottom: 8 }}>Tarea</th>
              <th style={{ paddingBottom: 8 }}>Monto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 8px 8px 0' }}>
                  <select
                    value={s.tipoServicio}
                    onChange={(e) => actualizarServicio(s.id, { tipoServicio: e.target.value })}
                    style={{ padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                  >
                    {TIPOS_SERVICIO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    value={s.monto}
                    onChange={(e) => actualizarServicio(s.id, { monto: Number(e.target.value) })}
                    className="font-data"
                    style={{ width: 110, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => quitarServicio(s.id)} style={{ border: 'none', background: 'none', color: 'var(--color-alert)' }} aria-label="Quitar tarea">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={agregarServicio}
          style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)' }}
        >
          + Agregar otra tarea a esta visita
        </button>
      </Panel>

      <Panel title="Pago y garantía de la visita">
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Forma de pago (aplica a toda la visita)</label>
            <select value={tipoPago} onChange={(e) => setTipoPago(e.target.value as 'Contado' | 'Crédito')} style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
              <option value="Contado">Contado</option>
              <option value="Crédito">Crédito</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Garantía ofrecida (días, opcional)</label>
            <input
              type="number"
              value={garantiaDias}
              onChange={(e) => setGarantiaDias(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Sin garantía"
              className="font-data"
              style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', width: 140 }}
            />
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="font-data" style={{ fontSize: 22 }}>
              Total: Gs. {total.toLocaleString('es-PY')}
            </div>
          </div>
        </div>

        {tipoPago === 'Crédito' && clienteId === '' && (
          <p style={{ color: 'var(--color-alert)', fontSize: 12, marginTop: 'var(--space-3)' }}>
            Esta visita quedaría a crédito: se requiere seleccionar un cliente registrado.
          </p>
        )}

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'right' }}>
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
            Registrar orden de servicio
          </button>
        </div>
      </Panel>
    </div>
  )
}
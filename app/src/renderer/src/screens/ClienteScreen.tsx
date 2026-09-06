// src/renderer/src/screens/ClienteScreen.tsx
//
// Cubre el flujo crítico "ficha de cliente con saldo detallado" (ver
// plan-gestion-proyecto.md, sección 2.1, y entidades-dominio.md, secciones
// 12 y 13). "Registrar pago" reduce el saldo del ítem/orden puntual sin
// afectar a los demás. "Imprimir comprobante de saldo" (HU-12) dispara el
// diálogo de impresión nativo sobre una vista limpia, pensada para que el
// cliente la firme como respaldo de la deuda.

import { useState } from 'react'
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

export function ClienteScreen() {
  const { clientes, deudaDeCliente, registrarPago } = useAppData()
  const [clienteId, setClienteId] = useState<number>(clientes[0].id)
  const [pagoEnCurso, setPagoEnCurso] = useState<{ deudaId: number; monto: string } | null>(null)

  const cliente = clientes.find((c) => c.id === clienteId)!
  const deuda = deudaDeCliente(clienteId)
  const saldoTotal = deuda.reduce((acc, d) => acc + d.saldoPendiente, 0)

  const confirmarPago = () => {
    if (!pagoEnCurso) return
    const monto = Number(pagoEnCurso.monto)
    if (monto > 0) registrarPago(pagoEnCurso.deudaId, monto)
    setPagoEnCurso(null)
  }

  const imprimirComprobante = () => {
    // En el prototipo, dispara el diálogo de impresión nativo del SO sobre
    // esta misma vista. En Sprint 1, se reemplazaría por una plantilla
    // impresa dedicada (ver .print-only / .no-print más abajo).
    window.print()
  }

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print">
        <h2 style={{ marginTop: 0 }}>Ficha de cliente</h2>
        <Panel>
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(Number(e.target.value))
              setPagoEnCurso(null)
            }}
            style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', minWidth: 260 }}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Panel>
      </div>

      <Panel title="Datos">
        <h2 style={{ display: 'none' }} className="print-only">
          Comprobante de saldo — {cliente.nombre}
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-5)', fontSize: 13 }}>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Cliente</div>
            <div className="font-data">{cliente.nombre}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Cédula</div>
            <div className="font-data">{cliente.cedula}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Celular</div>
            <div className="font-data">{cliente.celular}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Saldo pendiente">
        {deuda.length === 0 ? (
          <p style={{ color: 'var(--color-ok)', margin: 0 }}>Sin deudas pendientes.</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  <th style={{ paddingBottom: 8 }}>Origen</th>
                  <th style={{ paddingBottom: 8 }}>Detalle</th>
                  <th style={{ paddingBottom: 8 }}>Fecha</th>
                  <th style={{ paddingBottom: 8 }}>Monto original</th>
                  <th style={{ paddingBottom: 8 }}>Saldo pendiente</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {deuda.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 8 }}>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 'var(--radius)', background: 'var(--color-bg)', color: 'var(--color-info)' }}>
                        {d.origen}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{d.descripcion}</td>
                    <td className="font-data" style={{ padding: 8 }}>
                      {d.fecha}
                    </td>
                    <td className="font-data" style={{ padding: 8, color: 'var(--color-text-muted)' }}>
                      Gs. {d.montoOriginal.toLocaleString('es-PY')}
                    </td>
                    <td className="font-data" style={{ padding: 8, color: 'var(--color-alert)', fontWeight: 600 }}>
                      Gs. {d.saldoPendiente.toLocaleString('es-PY')}
                    </td>
                    <td className="no-print" style={{ padding: 8 }}>
                      {pagoEnCurso?.deudaId === d.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="number"
                            autoFocus
                            placeholder="Monto"
                            value={pagoEnCurso.monto}
                            onChange={(e) => setPagoEnCurso({ deudaId: d.id, monto: e.target.value })}
                            className="font-data"
                            style={{ width: 90, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                          />
                          <button
                            onClick={confirmarPago}
                            style={{ padding: '4px 8px', fontSize: 12, border: 'none', borderRadius: 'var(--radius)', background: 'var(--color-ok)', color: '#fff' }}
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setPagoEnCurso(null)}
                            style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'transparent' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPagoEnCurso({ deudaId: d.id, monto: '' })}
                          style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)' }}
                        >
                          Registrar pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-3)',
                borderTop: '2px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Saldo total del cliente</div>
                <div className="font-data" style={{ fontSize: 24, color: 'var(--color-alert)', fontWeight: 600 }}>
                  Gs. {saldoTotal.toLocaleString('es-PY')}
                </div>
              </div>
              <button
                onClick={imprimirComprobante}
                className="no-print"
                style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}
              >
                Imprimir comprobante de saldo
              </button>
              <div className="print-only" style={{ display: 'none', fontSize: 12, marginTop: 40 }}>
                Firma del cliente: ______________________________
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
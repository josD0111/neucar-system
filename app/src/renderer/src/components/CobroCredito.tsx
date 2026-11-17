// src/renderer/src/components/CobroCredito.tsx
//
// Cobro de una cuota sobre un crédito, sea un Ítem de Venta o una Orden de
// Servicio (ver src/main/services/pagos.ts: registrarPagoItem /
// registrarPagoOrden — son la misma operación con dos orígenes distintos).
//
// Antes de este archivo existían dos componentes casi idénticos: `CobroItem`
// (vivía dentro de VentasScreen.tsx) y `CobroOrden` (components/CobroOrden.tsx,
// agregado el 15/11/2026 para la Fase 5). Se unificaron acá porque, con
// Ficha de Cliente ahora cobrando también Ítems de Venta (además de Órdenes
// de Servicio, que ya cobraba, y del propio Historial de servicios), iban a
// terminar siendo TRES copias del mismo formulario. `CobroOrden.tsx` queda
// eliminado; donde antes importaban `CobroOrden`, ahora importan
// `CobroCredito` con `credito.origen: 'orden'`.
//
// Se usa desde:
// - VentasScreen.tsx (ItemDetalle), con origen 'item' — reemplaza al CobroItem
//   que vivía ahí.
// - ClienteScreen.tsx, dentro de la tabla de "Saldo pendiente": origen 'item'
//   u 'orden' según la fila.
// - HistorialServiciosScreen.tsx (DetalleOrden), origen 'orden'.

import { useEffect, useState } from 'react'
import { pagosApi } from '../api/pagos'
import type { Pago } from '../api/types'

const METODOS_PAGO_COBRO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const

function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

function formatearFechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Mismo criterio de usabilidad ya aplicado en VentaScreen.tsx: Enter mueve el
// foco al siguiente campo en vez de intentar enviar el formulario.
function manejarEnterComoTab(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>): void {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const form = e.currentTarget.form
  if (!form) return
  const focosables = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([disabled]), select:not([disabled])'
    )
  )
  const idx = focosables.indexOf(e.currentTarget)
  if (idx >= 0 && idx < focosables.length - 1) focosables[idx + 1].focus()
}

const estiloInput: React.CSSProperties = {
  padding: 'var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

const estiloLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  marginBottom: 4
}

const estiloBotonSecundario: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-bg)'
}

// Lo mínimo que este componente necesita del crédito a cobrar, sea cual sea
// su origen. `montoOriginal` es el monto total de ese ítem/orden (antes de
// cualquier pago) — se usa solo para sugerir la primera cuota (mitad del
// total), nunca se envía al servidor.
export type CreditoACobrar =
  | {
      origen: 'item'
      itemVentaId: number
      montoOriginal: number
      saldoPendiente: number
      fechaPagoPrevista: string | null
    }
  | {
      origen: 'orden'
      ordenServicioId: number
      montoOriginal: number
      saldoPendiente: number
      fechaPagoPrevista: string | null
    }

export function CobroCredito({
  credito,
  token,
  onPagoRegistrado
}: {
  credito: CreditoACobrar
  token: string | null
  // Se llama con el Pago recién registrado (ya con el monto aplicado, clamp
  // del servidor incluido) para que la pantalla que llama actualice lo que
  // tenga que actualizar: el saldo total del cliente, el detalle de una
  // venta puntual, o el saldoPendiente de una fila del historial.
  onPagoRegistrado: (pago: Pago) => void
}): React.JSX.Element {
  const id = credito.origen === 'item' ? credito.itemVentaId : credito.ordenServicioId

  // Historial de pagos ya registrados: se pide siempre (acá solo se llega
  // para créditos — ver cada pantalla que llama), para poder mostrarlo solo
  // si ya tiene pagos y para sugerir el monto de la próxima cuota.
  const [pagos, setPagos] = useState<Pago[] | null>(null)

  useEffect(() => {
    let cancelado = false
    const listar = credito.origen === 'item' ? pagosApi.listarPorItem : pagosApi.listarPorOrden
    listar(token, id).then((r) => {
      if (cancelado || !r.ok) return
      setPagos(r.data)
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, credito.origen, id])

  const [formAbierto, setFormAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO_COBRO)[number]>('Efectivo')
  const [fechaPagoPrevista, setFechaPagoPrevista] = useState(credito.fechaPagoPrevista ?? '')
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const abrirForm = (): void => {
    // Monto sugerido (acordado con el dueño): los créditos se pagan
    // mensualmente, como máximo en 2 cuotas, y cada cobro debería ser el
    // total que corresponde a esa cuota — no hay una entidad "Cuota" en el
    // modelo (ver entidades-dominio.md, 12.1), así que esto es una
    // SUGERENCIA editable, no un monto fijo: primera cuota = mitad del
    // total; de la segunda en adelante, se sugiere el saldo restante
    // completo (lo habitual es que sea la última).
    const sugerido =
      !pagos || pagos.length === 0 ? Math.round(credito.montoOriginal / 2) : credito.saldoPendiente
    setMonto(String(Math.min(sugerido, credito.saldoPendiente)))
    setMetodoPago('Efectivo')
    setFechaPagoPrevista(credito.fechaPagoPrevista ?? '')
    setErrorForm(null)
    setFormAbierto(true)
  }

  const montoNumero = Number(monto)
  const montoValido = Number.isFinite(montoNumero) && montoNumero > 0
  // Mismo cálculo que hace el servidor (clamp al saldo — ver
  // services/pagos.ts, registrarPagoItem/registrarPagoOrden).
  const saldoLuegoDelPago = montoValido
    ? Math.max(credito.saldoPendiente - montoNumero, 0)
    : credito.saldoPendiente
  const vuelto = montoValido ? Math.max(montoNumero - credito.saldoPendiente, 0) : 0

  const confirmar = (): void => {
    if (!montoValido) {
      setErrorForm('Ingresá un monto mayor a 0.')
      return
    }
    setEnviando(true)
    setErrorForm(null)
    const registrar = credito.origen === 'item' ? pagosApi.registrarPorItem : pagosApi.registrarPorOrden
    registrar(token, id, {
      monto: montoNumero,
      metodoPago,
      // Si con este pago queda saldado, no tiene sentido pedir una fecha
      // para una cuota que ya no va a existir.
      fechaPagoPrevista: saldoLuegoDelPago > 0 ? fechaPagoPrevista || null : undefined
    }).then((r) => {
      setEnviando(false)
      if (!r.ok) {
        setErrorForm(r.error.message)
        return
      }
      setFormAbierto(false)
      setPagos((prev) => [r.data, ...(prev ?? [])])
      onPagoRegistrado(r.data)
    })
  }

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      {pagos && pagos.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 13,
            marginBottom: 'var(--space-2)'
          }}
        >
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Pagos registrados:</span>
          {pagos.map((p) => (
            <div key={p.id} className="font-data" style={{ display: 'flex', gap: 8, color: 'var(--color-text)' }}>
              <span>{formatearFechaCorta(p.fecha)}</span>
              <span style={{ fontWeight: 600 }}>Gs. {gs(p.monto)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({p.metodoPago})</span>
            </div>
          ))}
        </div>
      )}

      {credito.saldoPendiente > 0 &&
        (!formAbierto ? (
          <button
            type="button"
            onClick={abrirForm}
            style={{ ...estiloBotonSecundario, fontSize: 13, fontWeight: 600 }}
          >
            Cobrar
          </button>
        ) : (
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              alignItems: 'flex-end',
              padding: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              background: 'var(--color-surface)',
              minWidth: 320
            }}
          >
            <div>
              <label style={estiloLabel}>Monto recibido</label>
              <input
                type="number"
                min={1}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                onKeyDown={manejarEnterComoTab}
                autoFocus
                className="font-data"
                style={{ ...estiloInput, width: 120 }}
              />
            </div>

            <div>
              <label style={estiloLabel}>Método</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as (typeof METODOS_PAGO_COBRO)[number])}
                onKeyDown={manejarEnterComoTab}
                style={estiloInput}
              >
                {METODOS_PAGO_COBRO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {saldoLuegoDelPago > 0 && (
              <div>
                <label style={estiloLabel}>Próxima cuota</label>
                <input
                  type="date"
                  value={fechaPagoPrevista}
                  onChange={(e) => setFechaPagoPrevista(e.target.value)}
                  onKeyDown={manejarEnterComoTab}
                  className="font-data"
                  style={estiloInput}
                />
              </div>
            )}

            <div className="font-data" style={{ fontSize: 13, color: 'var(--color-text)', paddingBottom: 6 }}>
              {vuelto > 0 ? (
                <span>
                  Se aplican Gs. {gs(credito.saldoPendiente)} al saldo.
                  <br />
                  <strong style={{ color: 'var(--color-ok)' }}>Vuelto: Gs. {gs(vuelto)}</strong>
                </span>
              ) : (
                saldoLuegoDelPago > 0 && <span>Queda Gs. {gs(saldoLuegoDelPago)} pendiente.</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                style={{
                  ...estiloBotonSecundario,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--color-ok)',
                  color: '#fff',
                  borderColor: 'var(--color-ok)'
                }}
              >
                {enviando ? 'Guardando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setFormAbierto(false)}
                disabled={enviando}
                style={{ ...estiloBotonSecundario, fontSize: 13 }}
              >
                Cancelar
              </button>
            </div>

            {errorForm && (
              <div style={{ width: '100%', fontSize: 13, color: 'var(--color-alert)' }}>{errorForm}</div>
            )}
          </form>
        ))}
    </div>
  )
}

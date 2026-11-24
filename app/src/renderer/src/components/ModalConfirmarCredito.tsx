// src/renderer/src/components/ModalConfirmarCredito.tsx
//
// Último componente de la Etapa 2 (ver docs/03-gestion-proyecto/
// plan-tecnico-pantalla-ventas.md): se abre al presionar "Guardar venta" en
// FooterVenta.tsx SOLO si tipoPago === 'Crédito' (si es Contado, se guarda
// directo, sin pasar por acá — ver plan técnico). Pide el pago inicial
// (HU-39) y la fecha prevista de pago (HU-10.2).
//
// Reglas de negocio (ver desiciones-alcance.md, secciones 2.4, 7.6 y 9.1):
//  - Toda venta a crédito exige un pago inicial MAYOR A CERO. El dueño no
//    precisó un mínimo — "mayor a cero" es una decisión PROVISIONAL del
//    equipo (20/11/2026), todavía sin confirmar. Si cambia, el único lugar
//    a tocar en el frontend es la validación de este modal.
//  - La fecha prevista tiene un valor sugerido por defecto (créditos de
//    hasta 2 meses, normalmente 2 cuotas), pero el Administrador puede
//    definir otra libremente — no es un bloqueo. El valor sugerido real lo
//    calcula el servidor si se omite (hoy + 1 mes, ver
//    services/ventas.ts::hoyMasUnMes); acá se precalcula el mismo valor
//    solo para no mostrar el campo vacío, pero el servidor manda si se deja
//    tal cual.
//
// Pendiente de backend (no es parte de esta Etapa 2): `VentaInput` todavía
// no tiene un campo para el pago inicial — hoy el servidor solo genera un
// Pago automático para Contado (ver services/ventas.ts). Hasta que eso se
// resuelva (Etapa 1 ampliada o Etapa 4), quien ensamble la pantalla deberá
// registrar la Venta y, si corresponde, el pago inicial como una llamada
// aparte a POST /api/ventas/:id/pagos con estos mismos datos — confirmar
// con el compañero cuál de las dos formas se va a implementar.

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { gs, posicionTrasNDigitos } from './formatoMoneda'

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const
type MetodoPago = (typeof METODOS_PAGO)[number]

export interface DatosConfirmacionCredito {
  montoInicial: number
  metodoPagoInicial: MetodoPago
  fechaPagoPrevista: string // 'YYYY-MM-DD'
}

interface ModalConfirmarCreditoProps {
  abierto: boolean
  total: number
  onConfirmar: (datos: DatosConfirmacionCredito) => void
  onCancelar: () => void
  confirmando?: boolean
}

// Mismo cálculo que `hoyMasUnMes()` en services/ventas.ts, solo para que el
// campo no arranque vacío — el servidor recalcula si se omite.
function hoyMasUnMes(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export function ModalConfirmarCredito({
  abierto,
  total,
  onConfirmar,
  onCancelar,
  confirmando = false
}: ModalConfirmarCreditoProps): React.JSX.Element | null {
  const [monto, setMonto] = useState<number | ''>('')
  const refInputMonto = useRef<HTMLInputElement>(null)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [fechaPrevista, setFechaPrevista] = useState(hoyMasUnMes())
  const [error, setError] = useState<string | null>(null)

  // El formulario es un solo componente que se reabre venta tras venta (no
  // se desmonta), así que sin esto el pago inicial, la forma de pago y la
  // fecha de la última venta quedaban "pegados" al abrir el modal de nuevo.
  useEffect(() => {
    if (abierto) {
      setMonto('')
      setMetodoPago('Efectivo')
      setFechaPrevista(hoyMasUnMes())
      setError(null)
    }
  }, [abierto])

  if (!abierto) return null

  const confirmar = (e: FormEvent): void => {
    e.preventDefault()
    if (monto === '' || monto <= 0) {
      setError(
        'El pago inicial debe ser mayor a cero — el taller no da crédito sin un pago inicial.'
      )
      return
    }
    if (monto > total) {
      setError('El pago inicial no puede superar el total de la venta.')
      return
    }
    if (!fechaPrevista) {
      setError('Elegí una fecha prevista de pago.')
      return
    }
    setError(null)
    onConfirmar({
      montoInicial: monto,
      metodoPagoInicial: metodoPago,
      fechaPagoPrevista: fechaPrevista
    })
  }

  const cambiarMonto = (e: ChangeEvent<HTMLInputElement>): void => {
    const input = e.target
    const cursorPrevio = input.selectionStart ?? input.value.length
    // Cuántos dígitos había antes del cursor en lo que el usuario ve ahora
    // (ya con la tecla recién tipeada/borrada, todavía sin reformatear).
    const digitosAntesDelCursor = input.value.slice(0, cursorPrevio).replace(/\D/g, '').length

    const soloDigitos = input.value.replace(/\D/g, '')
    const nuevoMonto = soloDigitos === '' ? '' : Number(soloDigitos)
    setMonto(nuevoMonto)

    // El valor ya formateado (con puntos de miles) todavía no está en el
    // DOM — recién lo va a pintar React en este mismo ciclo — así que la
    // posición del cursor se calcula contra ese string y se aplica después
    // del repintado (requestAnimationFrame alcanza y sobra para eso).
    const nuevoFormateado = nuevoMonto === '' ? '' : gs(nuevoMonto)
    const nuevaPosicion = posicionTrasNDigitos(nuevoFormateado, digitosAntesDelCursor)
    requestAnimationFrame(() => {
      refInputMonto.current?.setSelectionRange(nuevaPosicion, nuevaPosicion)
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tituloModalCredito"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60
      }}
    >
      <form
        onSubmit={confirmar}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-4)',
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)'
        }}
      >
        <h3 id="tituloModalCredito" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          Venta a crédito — pago inicial
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Total de la venta: <strong style={{ color: 'var(--color-text)' }}>Gs. {gs(total)}</strong>
          . Toda venta a crédito necesita un pago inicial mayor a cero.
        </p>

        <Campo label="Monto del pago inicial *">
          <input
            ref={refInputMonto}
            type="text"
            inputMode="numeric"
            autoFocus
            value={monto === '' ? '' : gs(monto)}
            onChange={cambiarMonto}
            placeholder="0"
            style={estiloInput}
          />
        </Campo>

        <Campo label="Forma de pago del inicial">
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
            style={estiloInput}
          >
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Fecha prevista de pago (sugerida: hoy + 1 mes, editable)">
          <input
            type="date"
            value={fechaPrevista}
            onChange={(e) => setFechaPrevista(e.target.value)}
            style={estiloInput}
          />
        </Campo>

        {monto !== '' && monto > 0 && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)'
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
              Saldo que queda pendiente:{' '}
            </span>
            <strong style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-accent)' }}>
              Gs. {gs(Math.max(0, total - monto))}
            </strong>
          </div>
        )}

        {error && <div style={{ color: 'var(--color-alert)', fontSize: 12 }}>{error}</div>}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-2)'
          }}
        >
          <button
            type="button"
            onClick={onCancelar}
            style={{ ...estiloBoton, background: 'var(--color-bg)', color: 'var(--color-text)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={confirmando}
            style={{ ...estiloBoton, background: 'var(--color-ok)', color: '#fff' }}
          >
            {confirmando ? 'Guardando...' : 'Confirmar y guardar venta'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Campo({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          marginBottom: 2
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  fontSize: 13
}

const estiloBoton: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '7px 14px',
  borderRadius: 'var(--radius)',
  border: 'none',
  cursor: 'pointer'
}

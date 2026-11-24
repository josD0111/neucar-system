// src/renderer/src/components/FooterVenta.tsx
//
// Franja D del nuevo flujo de Ventas (ver docs/03-gestion-proyecto/
// plan-tecnico-pantalla-ventas.md, Etapa 2, y el prototipo HTML de
// referencia): total a pagar + acciones de confirmación.
//
// Ojo: el prototipo HTML (construido el 22/11/2026) NO incluye el selector
// de método de pago en esta franja — solo total y los botones Cancelar/
// Guardar. Pero `desiciones-alcance.md`, sección 7.7, ya había decidido que
// el método de pago va en "la sección de totales/confirmación (Sección D
// del prototipo)" — el prototipo quedó desactualizado en ese punto. Este
// componente sigue la decisión escrita, no el HTML literal; lo marco acá
// para que quien revise sepa por qué no hay una franja de "método de pago"
// calcada 1:1 del archivo que pasaste.
//
// Rol Empleado (calculadora, HU-17): sin método de pago, sin botones de
// confirmación — solo ve el total a precio base. No llama nunca a
// POST /api/ventas (la decisión de no mostrarle botones acá es, de hecho,
// la defensa de UI; el servidor igual rechaza el registro por rol).

// Mismo criterio de formato que CobroCredito.tsx / VentasScreen.tsx /
// HistorialServiciosScreen.tsx: moneda local (Gs.) con separador de miles.
function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

interface FooterVentaProps {
  esAdmin: boolean
  total: number
  metodoPago: MetodoPago
  onCambiarMetodoPago: (metodo: MetodoPago) => void
  // Falso mientras no haya al menos un ítem, o mientras se está editando
  // una línea sin confirmar (se arma afuera, en la Etapa 3) — acá solo se
  // refleja deshabilitando el botón.
  puedeGuardar: boolean
  guardando: boolean
  onGuardar: () => void
  onCancelar: () => void
}

export function FooterVenta({
  esAdmin,
  total,
  metodoPago,
  onCambiarMetodoPago,
  puedeGuardar,
  guardando,
  onGuardar,
  onCancelar
}: FooterVentaProps): React.JSX.Element {
  return (
    <footer
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {esAdmin && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)'
                }}
              >
                Método de pago
              </span>
              <select
                value={metodoPago}
                onChange={(e) => onCambiarMetodoPago(e.target.value as MetodoPago)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)',
                  fontSize: 13
                }}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            {/* Cancelar queda pegado (a la izquierda) de Guardar, en vez de
                separado por el selector de método de pago. */}
            <button type="button" onClick={onCancelar} style={estiloBotonCancelar}>
              ✕ Cancelar venta
            </button>

            <button type="button" onClick={onGuardar} disabled={!puedeGuardar || guardando} style={estiloBotonGuardar}>
              {guardando ? 'Guardando...' : '✓ Guardar venta'}
            </button>
          </>
        )}
        {!esAdmin && (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Calculadora de precios — esta pantalla no registra la venta.
          </span>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: 'var(--color-text-muted)'
          }}
        >
          Total a pagar
        </span>
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-accent)' }}>
          Gs. {gs(total)}
        </span>
      </div>
    </footer>
  )
}

const estiloBotonCancelar: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-alert)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer'
}

const estiloBotonGuardar: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 'var(--radius)',
  border: 'none',
  background: 'var(--color-ok)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer'
}

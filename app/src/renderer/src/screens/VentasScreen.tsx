// src/renderer/src/screens/VentasScreen.tsx
//
// Historial de ventas registradas (GET /api/ventas, GET /api/ventas/:id).
// Visible para Administrador y Empleado por igual: la restricción de rol de
// Ventas es solo sobre REGISTRAR (HU-17.1, ver services/ventas.ts), no sobre
// consultar lo ya vendido — routes/ventas.ts no exige `requireRole` acá.
//
// Patrón de carga: el listado trae clienteNombre/cantidadItems ya
// resueltos (ver services/ventas.ts, VentaListado) para no pedir el detalle
// de cada venta solo para mostrar la tabla. El detalle completo (ítems,
// saldo pendiente por ítem) se pide recién al expandir una fila, y queda en
// caché — mismo criterio que StockScreen.tsx con los lotes de un producto.
//
// Paginación (acordada el 02/11/2026): el servidor devuelve DÍAS CALENDARIO
// COMPLETOS, no una cantidad fija de ventas (ver services/ventas.ts,
// listarVentas) — así nunca se corta a la mitad un día en esta vista
// agrupada por día. Todos los filtros (cliente, método de pago, rango de
// fechas, solo con saldo pendiente) se mandan al servidor: tienen que
// aplicarse ANTES de paginar, porque filtrar en el cliente después de traer
// un bloque llevaría a perderse ventas viejas que cumplen el filtro pero
// todavía no se pidieron. "Cargar semana anterior" pide el siguiente bloque
// con el cursor `antesDe` que devolvió el bloque anterior, y lo suma a lo
// ya mostrado (nunca reemplaza ni duplica).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../data/AuthContext'
import { ventasApi } from '../api/ventas'
import { pagosApi } from '../api/pagos'
import type { ItemVentaDetalle, Pago, VentaDetalle, VentaListado } from '../api/types'

const METODOS_PAGO_FILTRO = ['Todos', 'Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const
// Mismas 4 opciones, sin 'Todos' — para el formulario de cobro (ver CobroItem).
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const

function Panel({
  children,
  title
}: {
  children: React.ReactNode
  title?: string
}): React.JSX.Element {
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
      {title && (
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 14, fontWeight: 600 }}>{title}</h3>
      )}
      {children}
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  padding: 'var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

const estiloLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  marginBottom: 4
}

const estiloBotonSecundario: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)'
}

function estiloBadge(color: string, fondo: string): React.CSSProperties {
  return {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    color,
    background: fondo
  }
}

// Clave de agrupación por día, en el calendario LOCAL del usuario (no UTC):
// con `fecha` ya como timestamptz (ver db/schema.ts), `v.fecha` es un
// instante absoluto correcto, pero una venta de las 23:30 en Paraguay cae en
// el día siguiente en UTC. Agrupar o filtrar por el string ISO crudo
// (`v.fecha.slice(0, 10)`) corría el día en esos casos — por eso se arma la
// clave a partir de los componentes locales de un `Date` ya convertido.
function claveFechaLocal(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Etiqueta legible para el encabezado de un grupo de día, con atajos para
// "Hoy"/"Ayer" (lo más común al revisar el historial del taller).
function etiquetaDia(clave: string): string {
  const hoy = claveFechaLocal(new Date())
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)

  const [y, m, d] = clave.split('-').map(Number)
  const fechaLegible = new Date(y, m - 1, d).toLocaleDateString('es-PY', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  const capitalizada = fechaLegible.charAt(0).toUpperCase() + fechaLegible.slice(1)

  if (clave === hoy) return `Hoy · ${capitalizada}`
  if (clave === claveFechaLocal(ayer)) return `Ayer · ${capitalizada}`
  return capitalizada
}

function formatearHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

// --- Cobro de un ítem a crédito: historial de pagos + registrar uno nuevo -

function formatearFechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function CobroItem({
  item,
  token,
  onPagoRegistrado
}: {
  item: ItemVentaDetalle
  token: string | null
  onPagoRegistrado: () => void
}): React.JSX.Element {
  // Historial de pagos del ítem: se pide siempre que el ítem es a Crédito
  // (acá nunca se llega para Contado — ver ItemDetalle), para poder mostrarlo
  // automático si ya tiene pagos (acordado con el dueño: "podemos probar
  // mostrarlo de manera automática si ya tiene pagos") y para sugerir el
  // monto de la próxima cuota.
  const [pagosItem, setPagosItem] = useState<Pago[] | null>(null)

  useEffect(() => {
    let cancelado = false
    pagosApi.listarPorItem(token, item.id).then((r) => {
      if (cancelado || !r.ok) return
      setPagosItem(r.data)
    })
    return () => {
      cancelado = true
    }
  }, [token, item.id])

  const [formAbierto, setFormAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO)[number]>('Efectivo')
  const [fechaPagoPrevista, setFechaPagoPrevista] = useState(item.fechaPagoPrevista ?? '')
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const montoItem = Number(item.precioUnitario) * item.cantidad

  const abrirForm = (): void => {
    // Monto sugerido (acordado con el dueño): los créditos se pagan
    // mensualmente, como máximo en 2 cuotas, y cada cobro debería ser el
    // total que corresponde a esa cuota — no hay una entidad "Cuota" en el
    // modelo (ver entidades-dominio.md, 12.1), así que esto es una
    // SUGERENCIA editable, no un monto fijo: primera cuota = mitad del
    // total del ítem; de la segunda en adelante, se sugiere el saldo
    // restante completo (lo habitual es que sea la última).
    const sugerido =
      !pagosItem || pagosItem.length === 0 ? Math.round(montoItem / 2) : item.saldoPendiente
    setMonto(String(Math.min(sugerido, item.saldoPendiente)))
    setMetodoPago('Efectivo')
    setFechaPagoPrevista(item.fechaPagoPrevista ?? '')
    setErrorForm(null)
    setFormAbierto(true)
  }

  const montoNumero = Number(monto)
  const montoValido = Number.isFinite(montoNumero) && montoNumero > 0
  // Mismo cálculo que hace el servidor (clamp al saldo, ver
  // services/pagos.ts): se usa para decidir si todavía tiene sentido pedir
  // una fecha para la cuota siguiente, y para mostrar el vuelto.
  const saldoLuegoDelPago = montoValido
    ? Math.max(item.saldoPendiente - montoNumero, 0)
    : item.saldoPendiente
  const vuelto = montoValido ? Math.max(montoNumero - item.saldoPendiente, 0) : 0

  const confirmar = (): void => {
    if (!montoValido) {
      setErrorForm('Ingresá un monto mayor a 0.')
      return
    }
    setEnviando(true)
    setErrorForm(null)
    pagosApi
      .registrarPorItem(token, item.id, {
        monto: montoNumero,
        metodoPago,
        // Si con este pago el ítem queda saldado, no tiene sentido pedir
        // una fecha para una cuota que ya no va a existir.
        fechaPagoPrevista: saldoLuegoDelPago > 0 ? fechaPagoPrevista || null : undefined
      })
      .then((r) => {
        setEnviando(false)
        if (!r.ok) {
          setErrorForm(r.error.message)
          return
        }
        setFormAbierto(false)
        setPagosItem((prev) => [r.data, ...(prev ?? [])])
        onPagoRegistrado() // refresca el saldo/fecha del ítem en la venta (fuente de verdad: el servidor)
      })
  }

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      {pagosItem && pagosItem.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 13,
            marginBottom: 'var(--space-2)'
          }}
        >
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
            Pagos registrados:
          </span>
          {pagosItem.map((p) => (
            <div
              key={p.id}
              className="font-data"
              style={{ display: 'flex', gap: 8, color: 'var(--color-text)' }}
            >
              <span>{formatearFechaCorta(p.fecha)}</span>
              <span style={{ fontWeight: 600 }}>Gs. {gs(p.monto)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({p.metodoPago})</span>
            </div>
          ))}
        </div>
      )}

      {item.saldoPendiente > 0 &&
        (!formAbierto ? (
          <button
            type="button"
            onClick={abrirForm}
            style={{ ...estiloBotonSecundario, fontSize: 13, fontWeight: 600 }}
          >
            Cobrar
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              alignItems: 'flex-end',
              padding: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              background: 'var(--color-surface)'
            }}
          >
            <div>
              <label style={estiloLabel}>Monto recibido</label>
              <input
                type="number"
                min={1}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="font-data"
                style={{ ...estiloInput, width: 120 }}
              />
            </div>

            <div>
              <label style={estiloLabel}>Método</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as (typeof METODOS_PAGO)[number])}
                style={estiloInput}
              >
                {METODOS_PAGO.map((m) => (
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
                  className="font-data"
                  style={estiloInput}
                />
              </div>
            )}

            <div
              className="font-data"
              style={{ fontSize: 13, color: 'var(--color-text)', paddingBottom: 6 }}
            >
              {vuelto > 0 ? (
                <span>
                  Se aplican Gs. {gs(item.saldoPendiente)} al saldo.
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
              <div style={{ width: '100%', fontSize: 13, color: 'var(--color-alert)' }}>
                {errorForm}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

// --- Un ítem dentro del detalle de una venta ------------------------------

function ItemDetalle({
  item,
  token,
  onPagoRegistrado
}: {
  item: ItemVentaDetalle
  token: string | null
  onPagoRegistrado: () => void
}): React.JSX.Element {
  const subtotal = Number(item.precioUnitario) * item.cantidad
  const precioModificado = Number(item.precioUnitario) !== Number(item.precioBase)
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
        // Blanco, no el gris de la bandeja que lo contiene (ItemDetalle se
        // dibuja dentro del `<div>` gris de DetalleVenta/VentasScreen): con
        // el mismo gris de fondo, la tarjeta del ítem quedaba invisible
        // contra su contenedor.
        background: 'var(--color-surface)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{item.productoNombre}</div>
          <div className="font-data" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {item.cantidad} × Gs. {gs(item.precioUnitario)}
            {precioModificado && ` (base: Gs. ${gs(item.precioBase)})`}
            {' = '}
            <strong style={{ color: 'var(--color-text)' }}>Gs. {gs(subtotal)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={estiloBadge(
              item.tipoPago === 'Crédito' ? 'var(--color-alert)' : 'var(--color-ok)',
              item.tipoPago === 'Crédito' ? 'var(--color-alert-bg)' : '#e7efe9'
            )}
          >
            {item.tipoPago}
          </span>
          {item.garantiaOfrecida != null && (
            <span style={estiloBadge('var(--color-info)', '#e4ebed')}>
              {item.garantiaOfrecida}m garantía
            </span>
          )}
        </div>
      </div>

      {item.tipoPago === 'Crédito' && (
        <>
          <div
            style={{
              marginTop: 'var(--space-2)',
              fontSize: 13,
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap'
            }}
          >
            {item.fechaPagoPrevista && (
              <span style={{ color: 'var(--color-text)' }}>
                Pago previsto:{' '}
                <span className="font-data" style={{ fontWeight: 600 }}>
                  {item.fechaPagoPrevista}
                </span>
              </span>
            )}
            <span
              className="font-data"
              style={{
                fontWeight: 600,
                color: item.saldoPendiente > 0 ? 'var(--color-alert)' : 'var(--color-ok)'
              }}
            >
              {item.saldoPendiente > 0
                ? `Saldo pendiente: Gs. ${gs(item.saldoPendiente)}`
                : 'Pagado'}
            </span>
          </div>

          <CobroItem item={item} token={token} onPagoRegistrado={onPagoRegistrado} />
        </>
      )}
    </div>
  )
}

// --- Detalle de una venta (ítems), cargado a demanda al expandir --------

function DetalleVenta({
  venta,
  token,
  onPagoRegistrado
}: {
  venta: VentaDetalle
  token: string | null
  onPagoRegistrado: () => void
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Registrada por{' '}
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{venta.usuarioNombre}</span>
        {venta.tipoComprobante && ` · ${venta.tipoComprobante}`}
      </div>

      {venta.items.map((item) => (
        <ItemDetalle key={item.id} item={item} token={token} onPagoRegistrado={onPagoRegistrado} />
      ))}
    </div>
  )
}

// --- Pantalla principal ---------------------------------------------------

const DIAS_POR_PAGINA = 7

export function VentasScreen(): React.JSX.Element {
  const { token } = useAuth()

  // --- Filtros: se mandan al servidor (ver nota al principio del archivo).
  // El texto de cliente se debounce (400ms) para no disparar un pedido por
  // cada tecla; los demás filtros son controles discretos (select,
  // checkbox, date picker) y disparan al cambiar, sin debounce.
  const [textoCliente, setTextoCliente] = useState('')
  const [textoClienteDebounced, setTextoClienteDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setTextoClienteDebounced(textoCliente), 400)
    return () => clearTimeout(id)
  }, [textoCliente])

  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO_FILTRO)[number]>('Todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [soloConSaldoPendiente, setSoloConSaldoPendiente] = useState(false)

  const hayFiltrosActivos =
    textoCliente.trim() !== '' ||
    metodoPago !== 'Todos' ||
    fechaDesde !== '' ||
    fechaHasta !== '' ||
    soloConSaldoPendiente

  const limpiarFiltros = (): void => {
    setTextoCliente('')
    setTextoClienteDebounced('')
    setMetodoPago('Todos')
    setFechaDesde('')
    setFechaHasta('')
    setSoloConSaldoPendiente(false)
  }

  // --- Datos: `ventas` son los bloques de 7 días ya cargados, acumulados.
  const [ventas, setVentas] = useState<VentaListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  // Dispara una recarga del primer bloque sin tocar `cargando` desde afuera
  // (mismo criterio que useRecursoAsync en api/hooks.ts).
  const [tick, setTick] = useState(0)

  // Se incrementa cada vez que cambia algún filtro (o "↻ Actualizar"), para
  // que cargarSemanaAnterior pueda darse cuenta si eso pasó mientras su
  // pedido estaba en vuelo y descartar la respuesta en vez de sumarla a una
  // lista que ya fue reemplazada por otra cosa.
  const generacion = useRef(0)

  // Primer bloque: se vuelve a pedir desde cero cada vez que cambia algún
  // filtro (o se pide "↻ Actualizar"), reemplazando lo que hubiera.
  // `cargando` solo es true en la carga inicial (no se resetea acá dentro
  // del efecto) — mismo criterio que useRecursoAsync en api/hooks.ts, tanto
  // para no violar react-hooks/set-state-in-effect como para no hacer
  // parpadear la lista con un estado de carga cada vez que se toca un
  // filtro: se sigue viendo lo anterior hasta que llega lo nuevo.
  useEffect(() => {
    generacion.current++
    let cancelado = false
    ventasApi
      .listar(token, {
        q: textoClienteDebounced || undefined,
        metodoPago: metodoPago !== 'Todos' ? metodoPago : undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        soloConSaldoPendiente: soloConSaldoPendiente || undefined,
        dias: DIAS_POR_PAGINA
      })
      .then((r) => {
        if (cancelado) return
        setCargando(false)
        if (!r.ok) {
          setError(r.error.message)
          return
        }
        setError(null)
        setVentas(r.data.items)
        setHayMas(r.data.hayMas)
        setCursor(r.data.antesDe)
      })
    return () => {
      cancelado = true
    }
  }, [
    token,
    textoClienteDebounced,
    metodoPago,
    fechaDesde,
    fechaHasta,
    soloConSaldoPendiente,
    tick
  ])

  const cargar = (): void => setTick((t) => t + 1)

  // Bloques siguientes: se suman a lo ya cargado, con el cursor que devolvió
  // el bloque anterior — nunca reemplazan ni vuelven a pedir lo ya visto.
  const cargarSemanaAnterior = (): void => {
    if (!cursor) return
    const generacionAlPedir = generacion.current
    setCargandoMas(true)
    ventasApi
      .listar(token, {
        q: textoClienteDebounced || undefined,
        metodoPago: metodoPago !== 'Todos' ? metodoPago : undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        soloConSaldoPendiente: soloConSaldoPendiente || undefined,
        dias: DIAS_POR_PAGINA,
        antesDe: cursor
      })
      .then((r) => {
        setCargandoMas(false)
        if (generacionAlPedir !== generacion.current) return // los filtros cambiaron mientras esperaba
        if (!r.ok) {
          setError(r.error.message)
          return
        }
        setVentas((prev) => [...prev, ...r.data.items])
        setHayMas(r.data.hayMas)
        setCursor(r.data.antesDe)
      })
  }

  // Ventas ya cargadas, agrupadas por día calendario local. `ventas` viene
  // ordenada de más reciente a más antigua (el servidor ordena por fecha
  // desc, y cada bloque nuevo se agrega al final), así que alcanza con abrir
  // un grupo nuevo cada vez que cambia la clave.
  interface GrupoDia {
    clave: string
    ventas: VentaListado[]
    total: number
  }
  const gruposPorDia = useMemo(() => {
    const grupos: GrupoDia[] = []
    for (const v of ventas) {
      const clave = claveFechaLocal(new Date(v.fecha))
      const ultimo = grupos[grupos.length - 1]
      if (ultimo && ultimo.clave === clave) {
        ultimo.ventas.push(v)
        ultimo.total += Number(v.montoTotal)
      } else {
        grupos.push({ clave, ventas: [v], total: Number(v.montoTotal) })
      }
    }
    return grupos
  }, [ventas])

  // --- Día expandido (nivel superior: qué día se ve abierto) ---
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null)
  const alternarDia = (clave: string): void =>
    setDiaAbierto((actual) => (actual === clave ? null : clave))

  // --- Detalle expandido, cargado y cacheado a demanda ---
  const [expandida, setExpandida] = useState<number | null>(null)
  const [detallePorVenta, setDetallePorVenta] = useState<Record<number, VentaDetalle>>({})
  const [cargandoDetalle, setCargandoDetalle] = useState<number | null>(null)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)

  const alternarExpandida = (id: number): void => {
    if (expandida === id) {
      setExpandida(null)
      return
    }
    setExpandida(id)
    setErrorDetalle(null)
    if (id in detallePorVenta) return
    setCargandoDetalle(id)
    ventasApi.obtener(token, id).then((r) => {
      setCargandoDetalle(null)
      if (!r.ok) {
        setErrorDetalle(r.error.message)
        return
      }
      setDetallePorVenta((prev) => ({ ...prev, [id]: r.data }))
    })
  }

  // Tras registrar un pago (CobroItem), se vuelve a pedir el detalle de esa
  // venta para que el saldo pendiente/fecha prevista del ítem se actualicen
  // con el valor que calculó el servidor (fuente de verdad), en vez de
  // estimarlo en el cliente. No toca `ventas` (la fila del listado, con
  // `tieneSaldoPendiente`) — para eso todavía hace falta "↻ Actualizar".
  const refrescarDetalleVenta = (id: number): void => {
    ventasApi.obtener(token, id).then((r) => {
      if (r.ok) setDetallePorVenta((prev) => ({ ...prev, [id]: r.data }))
    })
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Historial de ventas</h2>

      <Panel title="Filtros">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            alignItems: 'flex-end'
          }}
        >
          <div style={{ flex: '1 1 220px' }}>
            <label style={estiloLabel}>Cliente</label>
            <input
              value={textoCliente}
              onChange={(e) => setTextoCliente(e.target.value)}
              placeholder="Buscar por nombre…"
              style={{ ...estiloInput, width: '100%' }}
            />
          </div>

          <div>
            <label style={estiloLabel}>Método de pago</label>
            <select
              value={metodoPago}
              onChange={(e) =>
                setMetodoPago(e.target.value as (typeof METODOS_PAGO_FILTRO)[number])
              }
              style={estiloInput}
            >
              {METODOS_PAGO_FILTRO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={estiloLabel}>Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="font-data"
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="font-data"
              style={estiloInput}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              paddingBottom: 8,
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={soloConSaldoPendiente}
              onChange={(e) => setSoloConSaldoPendiente(e.target.checked)}
            />
            Solo con saldo pendiente
          </label>

          {hayFiltrosActivos && (
            <button type="button" onClick={limpiarFiltros} style={estiloBotonSecundario}>
              Limpiar filtros
            </button>
          )}

          <button
            type="button"
            onClick={cargar}
            style={{ ...estiloBotonSecundario, marginLeft: 'auto' }}
          >
            ↻ Actualizar
          </button>
        </div>
      </Panel>

      <Panel>
        {cargando ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Cargando…</p>
        ) : error ? (
          <p style={{ margin: 0, color: 'var(--color-alert)' }}>{error}</p>
        ) : ventas.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            {hayFiltrosActivos
              ? 'Ninguna venta coincide con los filtros.'
              : 'Todavía no se registró ninguna venta.'}
          </p>
        ) : (
          <>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-3)'
              }}
            >
              {ventas.length} venta{ventas.length === 1 ? '' : 's'} cargada
              {ventas.length === 1 ? '' : 's'} en {gruposPorDia.length} día
              {gruposPorDia.length === 1 ? '' : 's'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {gruposPorDia.map((grupo) => {
                const diaExpandido = diaAbierto === grupo.clave
                return (
                  <div
                    key={grupo.clave}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => alternarDia(grupo.clave)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        border: 'none',
                        // Fondo blanco en los dos estados (antes se ponía del
                        // mismo gris que el contenido de abajo al expandir, y
                        // todo el bloque se volvía un solo gris indistinguible).
                        // El límite entre encabezado y contenido se marca con
                        // un borde, no con un cambio de color de fondo.
                        background: 'var(--color-surface)',
                        borderBottom: diaExpandido ? '1px solid var(--color-border)' : 'none',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: 14, width: 14, flexShrink: 0 }}>
                        {diaExpandido ? '▾' : '▸'}
                      </span>

                      <div style={{ flex: '1 1 auto', fontWeight: 600 }}>
                        {etiquetaDia(grupo.clave)}
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {grupo.ventas.length} venta{grupo.ventas.length === 1 ? '' : 's'}
                      </div>

                      <div
                        className="font-data"
                        style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap' }}
                      >
                        Gs. {gs(grupo.total)}
                      </div>
                    </button>

                    {diaExpandido && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2)',
                          borderTop: '1px solid var(--color-border)',
                          background: 'var(--color-bg)'
                        }}
                      >
                        {grupo.ventas.map((v) => {
                          const abierta = expandida === v.id
                          const detalle = detallePorVenta[v.id]
                          return (
                            <div
                              key={v.id}
                              style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius)',
                                overflow: 'hidden',
                                background: 'var(--color-surface)'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => alternarExpandida(v.id)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-3)',
                                  padding: 'var(--space-3)',
                                  border: 'none',
                                  // Mismo criterio que el encabezado de día:
                                  // blanco siempre, el límite se marca con un
                                  // borde (no con el gris de la bandeja que
                                  // está detrás).
                                  background: 'var(--color-surface)',
                                  borderBottom: abierta ? '1px solid var(--color-border)' : 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                              >
                                <span style={{ fontSize: 13, width: 14, flexShrink: 0 }}>
                                  {abierta ? '▾' : '▸'}
                                </span>

                                <div
                                  className="font-data"
                                  style={{
                                    flex: '0 0 72px',
                                    fontSize: 13,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  {formatearHora(v.fecha)}
                                </div>

                                <div style={{ flex: '2 1 160px', minWidth: 0, fontWeight: 600 }}>
                                  {v.clienteNombre ?? 'Cliente casual'}
                                </div>

                                <div
                                  style={{
                                    flex: '1 1 100px',
                                    fontSize: 13,
                                    color: 'var(--color-text-muted)'
                                  }}
                                >
                                  {v.cantidadItems} ítem{v.cantidadItems === 1 ? '' : 's'}
                                </div>

                                <span style={estiloBadge('var(--color-info)', '#e4ebed')}>
                                  {v.metodoPago}
                                </span>

                                <div
                                  className="font-data"
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 15,
                                    marginLeft: 'auto',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Gs. {gs(v.montoTotal)}
                                </div>
                              </button>

                              {abierta && (
                                <div
                                  style={{
                                    padding: 'var(--space-3)',
                                    borderTop: '1px solid var(--color-border)',
                                    background: 'var(--color-bg)'
                                  }}
                                >
                                  {cargandoDetalle === v.id ? (
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: 13,
                                        color: 'var(--color-text-muted)'
                                      }}
                                    >
                                      Cargando detalle…
                                    </p>
                                  ) : errorDetalle && !detalle ? (
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: 13,
                                        color: 'var(--color-alert)'
                                      }}
                                    >
                                      {errorDetalle}
                                    </p>
                                  ) : detalle ? (
                                    <DetalleVenta
                                      venta={detalle}
                                      token={token}
                                      onPagoRegistrado={() => refrescarDetalleVenta(v.id)}
                                    />
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {hayMas && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={cargarSemanaAnterior}
                  disabled={cargandoMas}
                  style={estiloBotonSecundario}
                >
                  {cargandoMas ? 'Cargando…' : `Cargar ${DIAS_POR_PAGINA} días anteriores`}
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}

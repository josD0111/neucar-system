// src/renderer/src/screens/HistorialServiciosScreen.tsx
//
// Historial de servicios (HU-26), con el mismo formato que el Historial de
// ventas: las órdenes se agrupan por día (con el total de cada día), cada día se
// despliega y cada orden se despliega para ver sus tareas. Al abrir la pantalla
// ya se ven los últimos 7 días, sin necesidad de buscar nada.
//
// Paginación: el servidor devuelve DÍAS CALENDARIO COMPLETOS (ver
// services/ordenesServicio.ts, historialOrdenes), así nunca se corta un día a la
// mitad. Todos los filtros se mandan al servidor y se aplican ANTES de paginar.
// "Cargar 7 días anteriores" suma el siguiente bloque con el cursor `antesDe`.
//
// El buscador de vehículo se mantiene (chapa, marca o nombre del dueño): al elegir
// un vehículo, el historial se limita a ese vehículo. Es la única forma de
// encontrar las órdenes de clientes casuales (sin cliente registrado), que se
// identifican por la chapa.
//
// Las órdenes no guardan el método de cobro (efectivo, tarjeta, etc.), solo si
// fueron al contado o a crédito: por eso el filtro es "Forma de pago".
//
// El saldo pendiente de una orden a crédito se puede cobrar directamente
// desde acá (botón "Cobrar" dentro de cada orden desplegada — ver
// DetalleOrden), con CobroCredito (components/CobroCredito.tsx), compartido
// también con ClienteScreen.tsx (su tabla de "Saldo pendiente", ahí para
// Ítems de Venta y Órdenes de Servicio) y VentasScreen.tsx (ItemDetalle).
// Estas pantallas apuntan al mismo lugar en la base de datos; se dejan varias
// porque sirven para momentos distintos: acá para cuando se está recorriendo
// el trabajo hecho en general, en Ficha de Cliente para cuando ya se sabe
// quién viene a pagar.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useVehiculos } from '../api/hooks'
import { ordenesServicioApi } from '../api/ordenesServicio'
import type { OrdenListado, Pago, Vehiculo } from '../api/types'
import { CobroCredito } from '../components/CobroCredito'
import { InputLimpiable } from '../components/InputLimpiable'
import { useAuth } from '../data/AuthContext'
import { useRetardo } from './useRetardo'

const FORMAS_PAGO_FILTRO = ['Todos', 'Contado', 'Crédito'] as const
const DIAS_POR_PAGINA = 7
// Máximo de vehículos que se listan al buscar (para no llenar la pantalla).
const MAX_RESULTADOS = 8

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

// --- Utilidades ---------------------------------------------------------------

// Clave de agrupación por día en el calendario LOCAL del usuario (no UTC): una
// orden de las 23:30 en Paraguay cae en el día siguiente en UTC. Misma lógica que
// VentasScreen.tsx.
function claveFechaLocal(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Etiqueta legible para el encabezado de un día, con atajos para "Hoy"/"Ayer".
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

// Formato de guaraníes: 150000 → "150.000".
function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

// "2026-12-15" → "15/12/2026" (para la fecha de pago prevista).
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function textoVehiculo(v: Vehiculo): string {
  return [v.chapa ?? 'Sin chapa', v.marca, v.color].filter(Boolean).join(' · ')
}

function textoVehiculoOrden(o: OrdenListado): string {
  return [o.vehiculoChapa ?? 'Sin chapa', o.vehiculoMarca, o.vehiculoColor]
    .filter(Boolean)
    .join(' · ')
}

// "4 ruedas" / "1 rueda". Es el mismo texto que el servidor guarda como detalle
// cuando no se escribió uno (ver services/ordenesServicio.ts, crearOrden).
function textoRuedas(n: number): string {
  return `${n} ${n === 1 ? 'rueda' : 'ruedas'}`
}

// --- Detalle de una orden (tareas) ------------------------------------------------

function DetalleOrden({
  orden,
  token,
  onPagoRegistrado
}: {
  orden: OrdenListado
  token: string | null
  onPagoRegistrado: (ordenServicioId: number, pago: Pago) => void
}): React.JSX.Element {
  const esCredito = orden.tipoPago === 'Crédito'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {orden.servicios.map((s) => {
        // Ruedas y detalle, sin repetir el "4 ruedas" automático.
        const extras: string[] = []
        if (s.cantidadRuedas !== null) extras.push(textoRuedas(s.cantidadRuedas))
        if (s.detalle && s.detalle !== (s.cantidadRuedas !== null ? textoRuedas(s.cantidadRuedas) : null)) {
          extras.push(s.detalle)
        }
        // Precio distinto al de referencia de ese momento = descuento (o recargo).
        const cambioPrecio = s.montoBase !== null && Number(s.monto) !== Number(s.montoBase)
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              fontSize: 13
            }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>{s.tipoServicio}</span>
              {extras.length > 0 && (
                <span style={{ color: 'var(--color-text-muted)' }}> ({extras.join(' · ')})</span>
              )}
            </div>
            <div className="font-data">
              {s.montoBase !== null && cambioPrecio && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                  precio base Gs. {gs(s.montoBase)} ·{' '}
                </span>
              )}
              Gs. {gs(s.monto)}
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        Orden #{orden.id} · registrada por {orden.usuarioNombre}
        {orden.tipoComprobante ? ` · ${orden.tipoComprobante}` : ''}
      </div>
      {orden.kilometraje !== null && (
        <div style={{ fontSize: 13 }}>
          Kilometraje:{' '}
          <span className="font-data" style={{ fontWeight: 600 }}>
            {orden.kilometraje.toLocaleString('es-PY')} km
          </span>
          {orden.proximoMantenimientoKm !== null && (
            <>
              {' · '}Próximo mantenimiento:{' '}
              <span className="font-data" style={{ fontWeight: 600 }}>
                {orden.proximoMantenimientoKm.toLocaleString('es-PY')} km
              </span>
            </>
          )}
        </div>
      )}
      {esCredito && (
        <>
          <div
            style={{
              fontSize: 13,
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap'
            }}
          >
            {orden.fechaPagoPrevista && (
              <span>
                Pago previsto:{' '}
                <span className="font-data" style={{ fontWeight: 600 }}>
                  {fechaCorta(orden.fechaPagoPrevista)}
                </span>
              </span>
            )}
            <span
              className="font-data"
              style={{
                fontWeight: 600,
                color: orden.saldoPendiente > 0 ? 'var(--color-alert)' : 'var(--color-ok)'
              }}
            >
              {orden.saldoPendiente > 0
                ? `Saldo pendiente: Gs. ${gs(orden.saldoPendiente)}`
                : 'Pagado'}
            </span>
          </div>

          {/* Fuera de la fila de arriba, en su propio bloque: así el historial de
              pagos y el formulario de cobro de CobroCredito ocupan todo el ancho
              disponible en vez de aparecer como un tercer elemento de ese flex row
              (bug encontrado el 18/11/2026 — se veía corrido hacia el centro de la
              tarjeta, mismo problema que ya se había resuelto en ClienteScreen.tsx
              poniéndolo en una fila propia). */}
          <CobroCredito
            credito={{
              origen: 'orden',
              ordenServicioId: orden.id,
              montoOriginal: Number(orden.montoTotal),
              saldoPendiente: orden.saldoPendiente,
              fechaPagoPrevista: orden.fechaPagoPrevista
            }}
            token={token}
            onPagoRegistrado={(pago) => onPagoRegistrado(orden.id, pago)}
          />
        </>
      )}
    </div>
  )
}

// --- Pantalla principal -------------------------------------------------------

interface GrupoDia {
  clave: string
  ordenes: OrdenListado[]
  total: number
}

export function HistorialServiciosScreen(): React.JSX.Element {
  const { token } = useAuth()

  // --- Filtro de vehículo: el buscador de siempre, que ahora limita el historial.
  const [busqueda, setBusqueda] = useState('')
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const q = useRetardo(busqueda.trim(), 300)
  const { datos: encontrados, cargando: buscando } = useVehiculos(token, { q })
  const hayBusqueda = busqueda.trim() !== ''

  // --- Demás filtros (controles discretos: disparan al cambiar).
  const [formaPago, setFormaPago] = useState<(typeof FORMAS_PAGO_FILTRO)[number]>('Todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [soloConSaldoPendiente, setSoloConSaldoPendiente] = useState(false)

  const hayFiltrosActivos =
    vehiculo !== null ||
    formaPago !== 'Todos' ||
    fechaDesde !== '' ||
    fechaHasta !== '' ||
    soloConSaldoPendiente

  const limpiarFiltros = (): void => {
    setBusqueda('')
    setVehiculo(null)
    setFormaPago('Todos')
    setFechaDesde('')
    setFechaHasta('')
    setSoloConSaldoPendiente(false)
  }

  // Filtros tal como se mandan al servidor. Se arman una sola vez (useMemo) y se
  // usan tanto en la carga inicial como en "Cargar 7 días anteriores".
  const vehiculoId = vehiculo?.id
  const filtros = useMemo(
    () => ({
      vehiculoId,
      tipoPago: formaPago !== 'Todos' ? formaPago : undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      soloConSaldoPendiente: soloConSaldoPendiente || undefined,
      dias: DIAS_POR_PAGINA
    }),
    [vehiculoId, formaPago, fechaDesde, fechaHasta, soloConSaldoPendiente]
  )

  // --- Datos: `ordenes` son los bloques de 7 días ya cargados, acumulados.
  const [ordenes, setOrdenes] = useState<OrdenListado[]>([])

  // Tras cobrar una cuota desde acá (CobroCredito, ver DetalleOrden), se
  // actualiza solo el saldoPendiente de esa orden puntual en la lista ya
  // cargada, sin volver a pedir todo el historial. El monto del Pago es el
  // que devuelve el servidor, ya con el clamp al saldo aplicado — no hace
  // falta recalcularlo acá.
  const actualizarSaldoOrden = (ordenServicioId: number, pago: Pago): void => {
    setOrdenes((prev) =>
      prev.map((o) =>
        o.id === ordenServicioId
          ? { ...o, saldoPendiente: Math.max(o.saldoPendiente - Number(pago.monto), 0) }
          : o
      )
    )
  }
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  // Dispara una recarga del primer bloque ("↻ Actualizar").
  const [tick, setTick] = useState(0)

  // Se incrementa cada vez que cambian los filtros (o se actualiza), para
  // descartar la respuesta de "Cargar más" si llegó cuando la lista ya fue
  // reemplazada por otra.
  const generacion = useRef(0)

  // Día y orden abiertos.
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null)
  const [ordenAbierta, setOrdenAbierta] = useState<number | null>(null)

  // Primer bloque: se pide desde cero cada vez que cambia un filtro, reemplazando
  // lo que hubiera. Mientras llega lo nuevo se sigue viendo lo anterior.
  useEffect(() => {
    generacion.current++
    let cancelado = false
    ordenesServicioApi.historial(token, filtros).then((r) => {
      if (cancelado) return
      setCargando(false)
      if (!r.ok) {
        setError(r.error.message)
        return
      }
      setError(null)
      setOrdenes(r.data.items)
      setHayMas(r.data.hayMas)
      setCursor(r.data.antesDe)
      // Se muestran ya los datos: si el día que estaba abierto sigue existiendo se
      // conserva; si no, se abre el más reciente.
      const claves = new Set(r.data.items.map((o) => claveFechaLocal(new Date(o.fecha))))
      const masReciente = r.data.items.length
        ? claveFechaLocal(new Date(r.data.items[0].fecha))
        : null
      setDiaAbierto((actual) => (actual !== null && claves.has(actual) ? actual : masReciente))
    })
    return () => {
      cancelado = true
    }
  }, [token, filtros, tick])

  // Bloques siguientes: se suman a lo ya cargado con el cursor del bloque anterior.
  const cargarDiasAnteriores = (): void => {
    if (!cursor) return
    const generacionAlPedir = generacion.current
    setCargandoMas(true)
    ordenesServicioApi.historial(token, { ...filtros, antesDe: cursor }).then((r) => {
      setCargandoMas(false)
      if (generacionAlPedir !== generacion.current) return // los filtros cambiaron mientras esperaba
      if (!r.ok) {
        setError(r.error.message)
        return
      }
      setOrdenes((prev) => [...prev, ...r.data.items])
      setHayMas(r.data.hayMas)
      setCursor(r.data.antesDe)
    })
  }

  // Órdenes ya cargadas, agrupadas por día local. Vienen de la más reciente a la
  // más antigua, así que alcanza con abrir un grupo nuevo cada vez que cambia la clave.
  const gruposPorDia = useMemo(() => {
    const grupos: GrupoDia[] = []
    for (const o of ordenes) {
      const clave = claveFechaLocal(new Date(o.fecha))
      const ultimo = grupos[grupos.length - 1]
      if (ultimo && ultimo.clave === clave) {
        ultimo.ordenes.push(o)
        ultimo.total += Number(o.montoTotal)
      } else {
        grupos.push({ clave, ordenes: [o], total: Number(o.montoTotal) })
      }
    }
    return grupos
  }, [ordenes])

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Historial de servicios</h2>

      <Panel title="Filtros">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            alignItems: 'flex-end'
          }}
        >
          {/* Vehículo: el buscador de siempre, ahora como filtro opcional */}
          <div style={{ flex: '1 1 280px' }}>
            <label style={estiloLabel}>Vehículo</label>
            {vehiculo ? (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}
              >
                <span className="font-data">{textoVehiculo(vehiculo)}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {vehiculo.clienteNombre
                    ? `Dueño: ${vehiculo.clienteNombre}`
                    : 'Sin dueño registrado'}
                </span>
                <button
                  type="button"
                  onClick={() => setVehiculo(null)}
                  style={{ ...estiloBotonSecundario, marginLeft: 'auto' }}
                >
                  Quitar
                </button>
              </div>
            ) : (
              <InputLimpiable
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por chapa, marca o nombre del dueño"
                style={{ ...estiloInput, width: '100%', boxSizing: 'border-box' }}
              />
            )}
          </div>

          <div>
            <label style={estiloLabel}>Forma de pago</label>
            <select
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value as (typeof FORMAS_PAGO_FILTRO)[number])}
              style={estiloInput}
            >
              {FORMAS_PAGO_FILTRO.map((f) => (
                <option key={f} value={f}>
                  {f}
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
            onClick={() => setTick((t) => t + 1)}
            style={{ ...estiloBotonSecundario, marginLeft: 'auto' }}
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Resultados de la búsqueda de vehículo */}
        {!vehiculo && hayBusqueda && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            {buscando ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                Buscando…
              </p>
            ) : encontrados.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                No hay vehículos que coincidan.
              </p>
            ) : (
              <>
                {encontrados.slice(0, MAX_RESULTADOS).map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => {
                      setVehiculo(v)
                      setBusqueda('')
                    }}
                    style={{
                      ...estiloBotonSecundario,
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      marginBottom: 4
                    }}
                  >
                    <span className="font-data">{textoVehiculo(v)}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {v.clienteNombre ? `  —  ${v.clienteNombre}` : '  —  sin dueño'}
                    </span>
                  </button>
                ))}
                {encontrados.length > MAX_RESULTADOS && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Hay {encontrados.length - MAX_RESULTADOS} más: afiná la búsqueda.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Panel>

      <Panel>
        {cargando ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Cargando…</p>
        ) : error ? (
          <p style={{ margin: 0, color: 'var(--color-alert)' }}>{error}</p>
        ) : ordenes.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            {hayFiltrosActivos
              ? 'Ninguna orden de servicio coincide con los filtros.'
              : 'Todavía no se registró ninguna orden de servicio.'}
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
              {ordenes.length} orden{ordenes.length === 1 ? '' : 'es'} cargada
              {ordenes.length === 1 ? '' : 's'} en {gruposPorDia.length} día
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
                      onClick={() => setDiaAbierto(diaExpandido ? null : grupo.clave)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        border: 'none',
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
                        {grupo.ordenes.length} orden{grupo.ordenes.length === 1 ? '' : 'es'}
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
                          background: 'var(--color-bg)'
                        }}
                      >
                        {grupo.ordenes.map((o) => {
                          const abierta = ordenAbierta === o.id
                          const esCredito = o.tipoPago === 'Crédito'
                          return (
                            <div
                              key={o.id}
                              style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius)',
                                overflow: 'hidden',
                                background: 'var(--color-surface)'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setOrdenAbierta(abierta ? null : o.id)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 'var(--space-3)',
                                  padding: 'var(--space-3)',
                                  border: 'none',
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
                                  style={{ flex: '0 0 56px', fontSize: 13 }}
                                >
                                  {formatearHora(o.fecha)}
                                </div>

                                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                                  <div style={{ fontWeight: 600 }}>
                                    {o.clienteNombre ?? 'Cliente casual'}
                                  </div>
                                  <div
                                    className="font-data"
                                    style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
                                  >
                                    {textoVehiculoOrden(o)}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    flex: '2 1 160px',
                                    fontSize: 13,
                                    color: 'var(--color-text-muted)'
                                  }}
                                >
                                  {o.servicios.map((s) => s.tipoServicio).join(', ')}
                                </div>

                                <span
                                  style={estiloBadge(
                                    esCredito ? 'var(--color-alert)' : 'var(--color-ok)',
                                    esCredito ? 'var(--color-alert-bg)' : '#e7efe9'
                                  )}
                                >
                                  {o.tipoPago}
                                </span>

                                {esCredito && (
                                  <span
                                    className="font-data"
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color:
                                        o.saldoPendiente > 0
                                          ? 'var(--color-alert)'
                                          : 'var(--color-ok)'
                                    }}
                                  >
                                    {o.saldoPendiente > 0
                                      ? `Saldo Gs. ${gs(o.saldoPendiente)}`
                                      : 'Pagado'}
                                  </span>
                                )}

                                <div
                                  className="font-data"
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 15,
                                    marginLeft: 'auto',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Gs. {gs(o.montoTotal)}
                                </div>
                              </button>

                              {abierta && (
                                <div
                                  style={{
                                    padding: 'var(--space-3)',
                                    background: 'var(--color-bg)'
                                  }}
                                >
                                  <DetalleOrden
                                    orden={o}
                                    token={token}
                                    onPagoRegistrado={actualizarSaldoOrden}
                                  />
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
                  onClick={cargarDiasAnteriores}
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
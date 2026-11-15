// src/renderer/src/screens/OrdenServicioScreen.tsx
//
// Registro de órdenes de servicio (HU-22 a HU-27, sin HU-25), conectado a la
// API real (/api/ordenes-servicio y /api/vehiculos).
//
// Una orden es la VISITA: se elige (o se da de alta) el vehículo, se indica el
// cliente si corresponde, se cargan una o más tareas con su monto y se elige
// contado o crédito. El monto total lo calcula el servidor; el que se ve acá
// es solo una cotización informativa (HU-24) que no se guarda.
//
// Reglas que también valida el servidor (acá solo se anticipan para guiar):
//   - Una orden a crédito exige un cliente registrado (HU-27).
//   - Si el vehículo tiene dueño, la orden es de ese dueño.
//   - Sin cliente = cliente casual (solo posible al contado).

import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { useClientes, useTiposServicio, useVehiculos } from '../api/hooks'
import { ordenesServicioApi } from '../api/ordenesServicio'
import { vehiculosApi } from '../api/vehiculos'
import type { Cliente, OrdenServicio, TipoPago, TipoServicio, Vehiculo } from '../api/types'
import { useAuth } from '../data/AuthContext'
import { useNavegacionConEnter } from './useNavegacionConEnter'
import { InputLimpiable } from '../components/InputLimpiable'

// Máximo de resultados que se muestran al buscar (para no llenar la pantalla).
const MAX_RESULTADOS = 6

// Máximo de ruedas por servicio (el servidor aplica el mismo límite).
const MAX_RUEDAS = 20

// Una tarea de la orden.
interface LineaServicio {
  id: number
  tipoServicioId: number | null // tipo elegido del catálogo
  cantidadRuedas: string // texto mientras se escribe; solo cuenta si el tipo requiere ruedas
  // null = se cobra el precio de referencia; texto = precio cambiado a mano (solo Administrador
  // si el tipo tiene precio fijo; libre si no tiene).
  montoManual: string | null
  detalle: string
}

const lineaVacia = (id: number): LineaServicio => ({
  id,
  tipoServicioId: null,
  cantidadRuedas: '',
  montoManual: null,
  detalle: ''
})

const estiloInput = {
  padding: 'var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

const estiloBotonSecundario = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-bg)'
}

const estiloEtiqueta = {
  fontSize: 12,
  color: 'var(--color-text-muted)',
  display: 'block',
  marginBottom: 4
}

function Panel({ children, title }: { children: React.ReactNode; title?: string }): React.JSX.Element {
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

// --- Utilidades ---------------------------------------------------------------

// Formato de guaraníes: 150000 → "150.000".
const gs = (n: number): string => n.toLocaleString('es-PY')

// Fecha local en formato AAAA-MM-DD (como espera un <input type="date">).
function fechaLocalISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Fecha sugerida para el pago de una orden a crédito: hoy + 1 mes (HU-10.2).
// Si el mes siguiente es más corto (ej. 31 de enero), cae en su último día.
function hoyMasUnMes(): string {
  const hoy = new Date()
  const ultimoDiaMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0).getDate()
  const dia = Math.min(hoy.getDate(), ultimoDiaMesSiguiente)
  return fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia))
}

// "2026-12-15" → "15/12/2026" (para mostrar).
function fechaParaMostrar(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Un monto es válido si es un número mayor a cero con hasta 2 decimales
// (el servidor aplica la misma regla).
function montoValido(texto: string): boolean {
  if (texto.trim() === '') return false
  const n = Number(texto)
  return Number.isFinite(n) && n > 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6
}

// ¿Es una cantidad de ruedas válida? (entero entre 1 y MAX_RUEDAS)
function ruedasValidas(texto: string): boolean {
  const n = Number(texto)
  return texto.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_RUEDAS
}

// Precio de referencia de una tarea, en guaraníes, o null si no se puede calcular:
// el tipo no tiene precio fijo, o requiere ruedas y todavía falta la cantidad.
// Mismo cálculo que hace el servidor: base × ruedas si requiere ruedas, o la base sola.
function precioReferencia(tipo: TipoServicio | undefined, ruedas: string): number | null {
  if (!tipo || tipo.montoBase === null) return null
  const base = Number(tipo.montoBase)
  if (!tipo.requiereRuedas) return base
  if (!ruedasValidas(ruedas)) return null
  return Math.round(base * Number(ruedas) * 100) / 100
}

// Monto que se cobra por una tarea: el editado a mano o, si no hay, el de
// referencia ('' si no hay ninguno de los dos).
function montoDeLinea(l: LineaServicio, tipo: TipoServicio | undefined): string {
  if (l.montoManual !== null) return l.montoManual
  const ref = precioReferencia(tipo, l.cantidadRuedas)
  return ref === null ? '' : String(ref)
}

// Devuelve el valor con un retraso: evita pedir datos al servidor por cada
// letra que se escribe en un buscador.
function useRetardo<T>(valor: T, ms: number): T {
  const [retardado, setRetardado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setRetardado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return retardado
}

// Descripción corta de un vehículo para mostrar en listas y fichas.
function textoVehiculo(v: Vehiculo): string {
  const partes = [v.chapa ?? 'Sin chapa', v.marca, v.color].filter(Boolean)
  return partes.join(' · ')
}

// --- Formulario ---------------------------------------------------------------

// Se separa de la pantalla para que, al registrar otra orden, el formulario se
// monte de nuevo y useNavegacionConEnter vuelva a poner el cursor en el primer campo.
function FormularioOrden({ onRegistrada }: { onRegistrada: (o: OrdenServicio) => void }): React.JSX.Element {
  const { token, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador'

  // Vehículo: uno existente (vehiculo), o uno nuevo que se crea al registrar.
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const [creandoVehiculo, setCreandoVehiculo] = useState(false)
  const [busquedaVeh, setBusquedaVeh] = useState('')
  const [nuevoVeh, setNuevoVeh] = useState({ marca: '', chapa: '', color: '' })

  // Cliente elegido a mano (solo se usa si el vehículo no tiene dueño).
  const [clienteElegido, setClienteElegido] = useState<{ id: number; nombre: string } | null>(null)
  const [busquedaCli, setBusquedaCli] = useState('')
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [nombreNuevoCli, setNombreNuevoCli] = useState('')
  const [errorCliente, setErrorCliente] = useState<string | null>(null)

  // Tareas y pago.
  const [lineas, setLineas] = useState<LineaServicio[]>([lineaVacia(1)])
  const [tipoPago, setTipoPago] = useState<TipoPago>('Contado')
  const [fechaPago, setFechaPago] = useState(hoyMasUnMes) // sugerida, editable

  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Búsquedas con retraso de 300 ms.
  const qVeh = useRetardo(busquedaVeh.trim(), 300)
  const qCli = useRetardo(busquedaCli.trim(), 300)
  const { datos: vehiculosEncontrados } = useVehiculos(token, { q: qVeh })
  const { datos: clientesEncontrados } = useClientes(token, qCli)

  // Catálogo de tipos de servicio (solo los activos).
  const { datos: tipos } = useTiposServicio(token)
  const tipoDe = (l: LineaServicio): TipoServicio | undefined =>
    tipos.find((t) => t.id === l.tipoServicioId)

  // Cliente efectivo de la orden: el dueño del vehículo si lo tiene; si no, el elegido.
  const duenoVehiculo =
    vehiculo && vehiculo.clienteId !== null
      ? { id: vehiculo.clienteId, nombre: vehiculo.clienteNombre ?? 'Cliente registrado' }
      : null
  const cliente = duenoVehiculo ?? clienteElegido

  // --- Tareas ---
  const agregarLinea = (): void => {
    const siguiente = lineas.length ? Math.max(...lineas.map((l) => l.id)) + 1 : 1
    setLineas([...lineas, lineaVacia(siguiente)])
  }
  const actualizarLinea = (id: number, cambios: Partial<LineaServicio>): void =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)))
  const quitarLinea = (id: number): void => setLineas((prev) => prev.filter((l) => l.id !== id))

  // Al cambiar el tipo se descartan las ruedas y el monto editado de esa tarea.
  const elegirTipo = (id: number, valor: string): void =>
    actualizarLinea(id, {
      tipoServicioId: valor === '' ? null : Number(valor),
      cantidadRuedas: '',
      montoManual: null
    })

  // Al cambiar las ruedas de un tipo con precio fijo, el precio se vuelve a calcular
  // (un descuento puesto a mano para otra cantidad ya no aplica). Si el tipo no
  // tiene precio fijo, el monto escrito se conserva.
  const cambiarRuedas = (l: LineaServicio, valor: string): void => {
    const tipo = tipoDe(l)
    actualizarLinea(l.id, {
      cantidadRuedas: valor,
      ...(tipo && tipo.montoBase !== null ? { montoManual: null } : {})
    })
  }

  // Cotización (HU-24): suma de las tareas con monto válido. Es solo informativa.
  const lineasCotizables = lineas.filter(
    (l) => l.tipoServicioId !== null && montoValido(montoDeLinea(l, tipoDe(l)))
  )
  const total = lineasCotizables.reduce(
    (suma, l) => suma + Number(montoDeLinea(l, tipoDe(l))),
    0
  )

  // --- Validaciones de pantalla (el servidor vuelve a validar todo) ---
  const vehiculoListo =
    vehiculo !== null || (creandoVehiculo && (nuevoVeh.marca.trim() !== '' || nuevoVeh.chapa.trim() !== ''))
  const lineasValidas =
    lineas.length > 0 &&
    lineas.every((l) => {
      const tipo = tipoDe(l)
      if (!tipo) return false
      if (tipo.requiereRuedas && !ruedasValidas(l.cantidadRuedas)) return false
      return montoValido(montoDeLinea(l, tipo))
    })
  const faltaClienteCredito = tipoPago === 'Crédito' && cliente === null
  const puedeRegistrar = vehiculoListo && lineasValidas && !faltaClienteCredito && !guardando

  // --- Acciones ---
  const elegirVehiculo = (v: Vehiculo): void => {
    setVehiculo(v)
    setBusquedaVeh('')
    // Si el vehículo tiene dueño, el cliente de la orden es ese dueño.
    if (v.clienteId !== null) setClienteElegido(null)
  }

  const crearClienteRapido = async (): Promise<void> => {
    const nombre = nombreNuevoCli.trim()
    if (!nombre) return
    setErrorCliente(null)
    const r = await apiFetch<Cliente>('/api/clientes', { method: 'POST', body: { nombre }, token })
    if (!r.ok) {
      setErrorCliente(r.error.message)
      return
    }
    setClienteElegido({ id: r.data.id, nombre: r.data.nombre })
    setCreandoCliente(false)
    setNombreNuevoCli('')
  }

  const registrar = async (): Promise<void> => {
    if (!puedeRegistrar) return
    setError(null)
    setGuardando(true)

    // 1) Si el vehículo es nuevo, se crea primero (con el cliente como dueño, si hay).
    let vehiculoId = vehiculo?.id
    if (vehiculoId === undefined) {
      const rv = await vehiculosApi.crear(token, {
        clienteId: cliente?.id ?? null,
        marca: nuevoVeh.marca,
        chapa: nuevoVeh.chapa,
        color: nuevoVeh.color
      })
      if (!rv.ok) {
        setError(rv.error.message) // por ejemplo: chapa repetida para ese cliente
        setGuardando(false)
        return
      }
      // Queda seleccionado: si la orden falla, el reintento no vuelve a crearlo.
      setVehiculo(rv.data)
      vehiculoId = rv.data.id
    }

    // 2) Se registra la orden. El total lo calcula el servidor.
    const ro = await ordenesServicioApi.registrar(token, {
      vehiculoId,
      ...(cliente ? { clienteId: cliente.id } : {}),
      tipoPago,
      fechaPagoPrevista: tipoPago === 'Crédito' ? fechaPago || null : null,
      servicios: lineas.map((l) => {
        const tipo = tipoDe(l)
        return {
          tipoServicioId: l.tipoServicioId as number, // lineasValidas garantiza que hay tipo
          cantidadRuedas: tipo?.requiereRuedas ? Number(l.cantidadRuedas) : null,
          monto: Number(montoDeLinea(l, tipo)),
          detalle: l.detalle.trim() || null
        }
      })
    })
    setGuardando(false)
    if (!ro.ok) {
      setError(ro.error.message)
      return
    }
    onRegistrada(ro.data)
  }

  // Enter pasa al campo siguiente; en el último campo (la fecha de pago, si es
  // a crédito) registra la orden.
  const nav = useNavegacionConEnter(() => {
    if (puedeRegistrar) void registrar()
  })

  return (
    <div ref={nav.ref} onKeyDown={nav.onKeyDown}>
      <h2 style={{ marginTop: 0 }}>Nueva orden de servicio</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Los datos de la visita se completan una sola vez; cada tarea se agrega como una línea aparte.
      </p>

      {/* ---------- Vehículo ---------- */}
      <Panel title="Vehículo">
        {vehiculo ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="font-data">{textoVehiculo(vehiculo)}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {vehiculo.clienteNombre ? `Dueño: ${vehiculo.clienteNombre}` : 'Sin dueño registrado'}
            </span>
            <button type="button" onClick={() => setVehiculo(null)} style={{ ...estiloBotonSecundario, marginLeft: 'auto' }}>
              Cambiar vehículo
            </button>
          </div>
        ) : creandoVehiculo ? (
          <div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div>
                <label style={estiloEtiqueta}>Marca</label>
                <InputLimpiable
                  value={nuevoVeh.marca}
                  onChange={(v) => setNuevoVeh({ ...nuevoVeh, marca: v })}
                  placeholder="Ej. Toyota"
                  maxLength={80}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloEtiqueta}>Chapa</label>
                <InputLimpiable
                  value={nuevoVeh.chapa}
                  onChange={(v) => setNuevoVeh({ ...nuevoVeh, chapa: v.toUpperCase() })}
                  placeholder="Ej. ABC 123"
                  maxLength={30}
                  className="font-data"
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloEtiqueta}>Color</label>
                <InputLimpiable
                  value={nuevoVeh.color}
                  onChange={(v) => setNuevoVeh({ ...nuevoVeh, color: v })}
                  placeholder="Ej. Rojo"
                  maxLength={40}
                  style={estiloInput}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 'var(--space-2) 0' }}>
              Hace falta al menos la marca o la chapa. El vehículo se registra al guardar la orden.
            </p>
            <button type="button" onClick={() => setCreandoVehiculo(false)} style={estiloBotonSecundario}>
              Buscar uno ya registrado
            </button>
          </div>
        ) : (
          <div>
            <InputLimpiable
              value={busquedaVeh}
              onChange={setBusquedaVeh}
              placeholder="Buscar por chapa, marca o nombre del dueño"
              style={{ ...estiloInput, minWidth: 320 }}
            />
            {busquedaVeh.trim() !== '' && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                {vehiculosEncontrados.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                    No hay vehículos que coincidan.
                  </p>
                ) : (
                  <>
                    {vehiculosEncontrados.slice(0, MAX_RESULTADOS).map((v) => (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => elegirVehiculo(v)}
                        style={{ ...estiloBotonSecundario, display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                      >
                        <span className="font-data">{textoVehiculo(v)}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {v.clienteNombre ? `  —  ${v.clienteNombre}` : '  —  sin dueño'}
                        </span>
                      </button>
                    ))}
                    {vehiculosEncontrados.length > MAX_RESULTADOS && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Hay {vehiculosEncontrados.length - MAX_RESULTADOS} más: afiná la búsqueda.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <button type="button" onClick={() => setCreandoVehiculo(true)} style={estiloBotonSecundario}>
                + Registrar vehículo nuevo
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* ---------- Cliente ---------- */}
      <Panel title="Cliente">
        {duenoVehiculo ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            Cliente: <strong>{duenoVehiculo.nombre}</strong>{' '}
            <span style={{ color: 'var(--color-text-muted)' }}>(dueño del vehículo)</span>
          </p>
        ) : clienteElegido ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>
              Cliente: <strong>{clienteElegido.nombre}</strong>
            </span>
            <button type="button" onClick={() => setClienteElegido(null)} style={estiloBotonSecundario}>
              Quitar
            </button>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 var(--space-2) 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
              Sin cliente = cliente casual. Para una orden a crédito hace falta un cliente registrado.
            </p>
            <InputLimpiable
              value={busquedaCli}
              onChange={setBusquedaCli}
              placeholder="Buscar cliente por nombre, cédula o celular"
              style={{ ...estiloInput, minWidth: 320 }}
            />
            {busquedaCli.trim() !== '' && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                {clientesEncontrados.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                    No hay clientes que coincidan.
                  </p>
                ) : (
                  <>
                    {clientesEncontrados.slice(0, MAX_RESULTADOS).map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setClienteElegido({ id: c.id, nombre: c.nombre })
                          setBusquedaCli('')
                        }}
                        style={{ ...estiloBotonSecundario, display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                      >
                        {c.nombre}
                        <span className="font-data" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {c.cedula ? `  —  ${c.cedula}` : ''}
                        </span>
                      </button>
                    ))}
                    {clientesEncontrados.length > MAX_RESULTADOS && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Hay {clientesEncontrados.length - MAX_RESULTADOS} más: afiná la búsqueda.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <div style={{ marginTop: 'var(--space-3)' }}>
              {creandoCliente ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <InputLimpiable
                    value={nombreNuevoCli}
                    onChange={setNombreNuevoCli}
                    placeholder="Nombre del cliente nuevo"
                    maxLength={150}
                    style={estiloInput}
                  />
                  <button
                    type="button"
                    onClick={() => void crearClienteRapido()}
                    disabled={!nombreNuevoCli.trim()}
                    style={{ ...estiloBotonSecundario, opacity: nombreNuevoCli.trim() ? 1 : 0.6 }}
                  >
                    Guardar cliente
                  </button>
                  <button type="button" onClick={() => setCreandoCliente(false)} style={estiloBotonSecundario}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setCreandoCliente(true)} style={estiloBotonSecundario}>
                  + Cliente nuevo (solo nombre)
                </button>
              )}
              {errorCliente && (
                <div style={{ color: 'var(--color-alert)', fontSize: 13, marginTop: 'var(--space-2)' }}>
                  {errorCliente}
                </div>
              )}
              {creandoCliente && (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 0 0' }}>
                  Los demás datos (cédula, celular, RUC) se pueden completar después en Clientes.
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* ---------- Tareas ---------- */}
      <Panel title="Tareas realizadas">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
              <th style={{ paddingBottom: 8 }}>Tarea</th>
              <th style={{ paddingBottom: 8 }}>Ruedas</th>
              <th style={{ paddingBottom: 8 }}>Detalle (opcional)</th>
              <th style={{ paddingBottom: 8 }}>Monto (Gs.)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const tipo = tipoDe(l)
              const tienePrecioFijo = tipo !== undefined && tipo.montoBase !== null
              const puedeEditarMonto = !tienePrecioFijo || esAdmin
              const valorMonto = montoDeLinea(l, tipo)

              return (
                <tr key={l.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 8px 8px 0' }}>
                    <select
                      value={l.tipoServicioId ?? ''}
                      onChange={(e) => elegirTipo(l.id, e.target.value)}
                      style={{ ...estiloInput, width: 210 }}
                    >
                      <option value="">Elegir tarea…</option>
                      {tipos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 8 }}>
                    {tipo?.requiereRuedas ? (
                      <input
                        type="number"
                        min={1}
                        max={MAX_RUEDAS}
                        value={l.cantidadRuedas}
                        onChange={(e) => cambiarRuedas(l, e.target.value)}
                        placeholder="Cant."
                        className="font-data"
                        style={{ ...estiloInput, width: 80 }}
                      />
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      value={l.detalle}
                      onChange={(e) => actualizarLinea(l.id, { detalle: e.target.value })}
                      placeholder="Ej. Tren delantero"
                      maxLength={255}
                      style={{ ...estiloInput, width: 210 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min={0}
                      value={valorMonto}
                      disabled={!puedeEditarMonto}
                      onChange={(e) => {
                        const val = e.target.value
                        actualizarLinea(l.id, {
                          montoManual: val === '' && tienePrecioFijo ? null : val
                        })
                      }}
                      className="font-data"
                      style={{
                        ...estiloInput,
                        width: 130,
                        background: puedeEditarMonto ? undefined : 'var(--color-bg)',
                        color: puedeEditarMonto ? undefined : 'var(--color-text-muted)'
                      }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => quitarLinea(l.id)}
                      disabled={lineas.length === 1} // la orden necesita al menos una tarea
                      aria-label="Quitar tarea"
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'var(--color-alert)',
                        opacity: lineas.length === 1 ? 0.3 : 1
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button type="button" onClick={agregarLinea} style={{ ...estiloBotonSecundario, marginTop: 'var(--space-3)' }}>
          + Agregar otra tarea a esta visita
        </button>
      </Panel>

      {/* ---------- Cotización previa (HU-24): solo en pantalla ---------- */}
      <Panel title="Cotización previa">
        {lineasCotizables.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Cargá las tareas con su monto para ver el costo que se le informa al cliente.
          </p>
        ) : (
          <div style={{ fontSize: 13 }}>
            {lineasCotizables.map((l) => {
              const tipo = tipoDe(l)
              const monto = Number(montoDeLinea(l, tipo))
              const extras = [
                tipo?.requiereRuedas && l.cantidadRuedas ? `${l.cantidadRuedas} ruedas` : null,
                l.detalle.trim() || null
              ].filter(Boolean)

              return (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>
                    {tipo?.nombre ?? 'Servicio'}
                    {extras.length > 0 ? ` (${extras.join(' · ')})` : ''}
                  </span>
                  <span className="font-data">Gs. {gs(monto)}</span>
                </div>
              )
            })}
            <div
              className="font-data"
              style={{ borderTop: '1px solid var(--color-border)', marginTop: 6, paddingTop: 6, fontSize: 18, textAlign: 'right' }}
            >
              Total: Gs. {gs(total)}
            </div>
          </div>
        )}
        <p style={{ margin: 'var(--space-2) 0 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
          Es solo informativa: no se guarda. El total definitivo lo calcula el sistema al registrar la orden.
        </p>
      </Panel>

      {/* ---------- Pago ---------- */}
      <Panel title="Forma de pago de la visita">
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={estiloEtiqueta}>Forma de pago (aplica a toda la visita)</label>
            <select value={tipoPago} onChange={(e) => setTipoPago(e.target.value as TipoPago)} style={estiloInput}>
              <option value="Contado">Contado</option>
              <option value="Crédito">Crédito</option>
            </select>
          </div>
          {tipoPago === 'Crédito' && (
            <div>
              <label style={estiloEtiqueta}>Fecha de pago prevista (sugerida, editable)</label>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="font-data"
                style={estiloInput}
              />
            </div>
          )}
        </div>

        {faltaClienteCredito && (
          <p style={{ color: 'var(--color-alert)', fontSize: 12, marginBottom: 0 }}>
            Esta visita quedaría a crédito: se requiere un cliente registrado.
          </p>
        )}

        {error && (
          <div
            style={{
              background: 'var(--color-alert-bg)',
              color: 'var(--color-alert)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              marginTop: 'var(--space-3)'
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'right' }}>
          <button
            type="button"
            disabled={!puedeRegistrar}
            onClick={() => void registrar()}
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
            {guardando ? 'Registrando…' : 'Registrar orden de servicio'}
          </button>
        </div>
      </Panel>
    </div>
  )
}

// --- Pantalla -----------------------------------------------------------------

export function OrdenServicioScreen(): React.JSX.Element {
  const [registrada, setRegistrada] = useState<OrdenServicio | null>(null)

  if (registrada) {
    const esCredito = registrada.tipoPago === 'Crédito'
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Nueva orden de servicio</h2>
        <Panel>
          <p style={{ color: 'var(--color-ok)', fontWeight: 600, marginTop: 0 }}>
            ✓ Orden #{registrada.id} registrada por Gs. {gs(Number(registrada.montoTotal))}
            {esCredito ? ' (a crédito).' : '.'}
          </p>
          <p style={{ fontSize: 13, margin: '0 0 var(--space-2) 0' }}>
            Vehículo:{' '}
            <span className="font-data">
              {[registrada.vehiculoChapa, registrada.vehiculoMarca, registrada.vehiculoColor].filter(Boolean).join(' · ')}
            </span>
            {' — '}
            {registrada.clienteNombre ?? 'Cliente casual'}
          </p>
          {esCredito && registrada.fechaPagoPrevista && (
            <p style={{ fontSize: 13, margin: '0 0 var(--space-2) 0' }}>
              Pago previsto: {fechaParaMostrar(registrada.fechaPagoPrevista)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setRegistrada(null)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontWeight: 600,
              marginTop: 'var(--space-2)'
            }}
          >
            Registrar otra orden
          </button>
        </Panel>
      </div>
    )
  }

  return <FormularioOrden onRegistrada={setRegistrada} />
}
// src/renderer/src/screens/VentaScreen.tsx
//
// Reconstruida sobre la API real (Sprint 2), en reemplazo de AppDataContext.
// Vista diferenciada por rol (ver desiciones-alcance.md, sección 8.4, e
// historias-usuario.md, HU-17/HU-17.1 — corregidas 23/10/2026):
//
//  - Empleado: SOLO calculadora. Arma líneas de producto + cantidad y ve el
//    total a precio base, sin lote, sin forma de pago, sin cliente y sin
//    ninguna acción para confirmar — no llama nunca a POST /api/ventas.
//  - Administrador: flujo completo. Cliente, método de pago, selección
//    MANUAL del lote (compra) por línea — no hay PEPS/FIFO automático, ver
//    entidades-dominio.md sección 14 —, precio editable, forma de pago por
//    ítem, garantía validada contra el lote, y confirmación (HU-17.1).
//
// Feedback de usabilidad del dueño (reunion-sprint01--2026-10-23.md,
// aplicado acá vía `manejarEnterComoTab` y `autoFocus` en el primer campo):
// el cursor arranca en el primer input, y Enter mueve el foco al siguiente
// campo en vez de intentar enviar el formulario.
//
// Revisión de UX (26/10/2026, feedback directo probando la pantalla):
//  - Elegir y configurar un producto se separó del detalle ya agregado: hay
//    un panel "Agregar producto" aparte, con buscador, y recién al confirmar
//    ahí se suma como una línea al detalle de abajo.
//  - El detalle de la venta dejó de ser una tabla ancha con scroll
//    horizontal: ahora es una lista de tarjetas apiladas, una por línea.
//  - El carrito ya NO arranca con una línea vacía precargada.
//  - Cliente y Producto usan un buscador en vez de un <select> plano.
//
// Revisión de UX (27/10/2026, segunda ronda de feedback):
//  - El buscador de Cliente ya no abre la lista solo por tener el foco (ej.
//    al entrar a la pantalla, por el autoFocus): antes se desplegaba sola
//    apenas se abría "Nueva venta", aunque la venta fuera a un cliente
//    casual. Ahora hace falta un clic, tipear algo, o una flecha para
//    abrirla — el foco por sí solo ya no la despliega.
//  - El input del buscador se agrandó (320px → ancho completo del panel,
//    hasta 420px) y el placeholder de Cliente se acortó: no entraba
//    completo en el ancho anterior.
//  - "Método de pago" dejó de ser un panel aparte casi vacío: ahora comparte
//    panel con Cliente ("Cliente y forma de pago"), uno al lado del otro.
//  - El buscador de Producto dejó de filtrar sobre una copia local de hasta
//    100 productos (tope de una sola página, ver routes/productos.ts) — con
//    el catálogo real, un producto fuera de las primeras 100 filas
//    alfabéticas simplemente no aparecía (bug reportado: buscar "filtros"
//    no encontraba nada acá, pero sí en Control de stock). Ahora busca
//    directo contra el servidor (`GET /api/productos?q=...`, el mismo
//    endpoint que usa Control de stock), con debounce, así que encuentra
//    cualquier producto del catálogo sin importar cuántos haya.
//
// Deliberadamente fuera de esta pantalla (ver desiciones-alcance.md, 7.4):
// anulación de venta (no entra en el MVP) y comprobante de venta en PDF
// (se hace después de tener esta base funcionando).

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAuth } from '../data/AuthContext'
import { productosApi } from '../api/productos'
import { ventasApi } from '../api/ventas'
import { apiFetch } from '../api/client'
import { ApiClientError } from '../api/client'
import type { Compra, Producto, TipoPago, VentaConItems } from '../api/types'

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const

interface Cliente {
  id: number
  nombre: string
  cedula: string | null
}

// Una línea ya agregada al detalle de la venta. Guarda el Producto completo
// (no solo su id): el buscador trae los resultados directo del servidor
// (ver BuscadorProducto más abajo), así que no hace falta mantener una copia
// local de "todos los productos" para poder mostrar el nombre después. Para
// el Empleado solo importan producto/cantidad; el resto se ignora al
// renderizar (no se le muestra ni se envía a ningún lado).
interface LineaForm {
  id: number
  producto: Producto
  compraId: number | ''
  cantidad: number
  precioUnitario: number
  tipoPago: TipoPago
  garantiaOfrecida: number | ''
  fechaPagoPrevista: string
}

// El producto que se está configurando ANTES de agregarlo al detalle (ver
// nota de UX al principio del archivo).
interface Borrador {
  producto: Producto | null
  compraId: number | ''
  cantidad: number
  precioUnitario: number
  tipoPago: TipoPago
  garantiaOfrecida: number | ''
  fechaPagoPrevista: string
}

const borradorVacio: Borrador = {
  producto: null,
  compraId: '',
  cantidad: 1,
  precioUnitario: 0,
  tipoPago: 'Contado',
  garantiaOfrecida: '',
  fechaPagoPrevista: ''
}

function hoyMasUnMes(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

// Enter mueve el foco al siguiente campo del formulario en vez de intentar
// enviarlo (pedido del dueño, ver encabezado del archivo).
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
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  marginBottom: 4
}

const estiloCardLinea: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 'var(--space-3)',
  background: 'var(--color-bg)'
}

const estiloBotonQuitar: React.CSSProperties = {
  border: 'none',
  background: 'none',
  color: 'var(--color-alert)',
  fontSize: 16,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 2
}

const estiloBotonAgregar: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontWeight: 600,
  color: '#fff'
}

const estiloListaFlotante: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 2px)',
  left: 0,
  right: 0,
  margin: 0,
  padding: 4,
  listStyle: 'none',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  maxHeight: 240,
  overflowY: 'auto',
  zIndex: 20
}

function estiloOpcionLista(activa: boolean): React.CSSProperties {
  return {
    padding: '6px 8px',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    cursor: 'pointer',
    background: activa ? 'var(--color-bg)' : 'transparent'
  }
}

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

// --- Buscador de Cliente -----------------------------------------------
//
// Combo con lista flotante, mismo patrón que SelectorBuscable en
// StockScreen.tsx (lista en el flujo normal del documento en vez de
// <datalist> — ver ahí el razonamiento completo), pero sin "alta rápida":
// acá no corresponde crear un cliente nuevo a mitad de una venta. A
// diferencia de BuscadorProducto (más abajo), filtra en memoria sobre la
// lista de clientes ya cargada entera (GET /api/clientes no pagina — ver
// routes/clientes.ts), así que no hace falta pedirle al servidor en cada
// tecla.
//
// Corrección 27/10/2026: la lista YA NO se abre solo por tener el foco
// (antes `onFocus` llamaba a `abrir()`, así que con el `autoFocus` del
// primer campo la lista se desplegaba sola apenas se entraba a la
// pantalla). Ahora hace falta un clic, tipear, o una flecha para abrirla.
interface OpcionCliente {
  id: number
  etiqueta: string
  subtitulo?: string
}

function BuscadorCliente({
  items,
  valor,
  onSeleccionar,
  placeholder,
  autoFocus
}: {
  items: OpcionCliente[]
  valor: number | ''
  onSeleccionar: (id: number | '') => void
  placeholder: string
  autoFocus?: boolean
}): React.JSX.Element {
  const listboxId = useId()
  const contenedorRef = useRef<HTMLDivElement>(null)

  const seleccionado = items.find((i) => i.id === valor) ?? null
  const [texto, setTexto] = useState(seleccionado?.etiqueta ?? '')
  const [abierto, setAbierto] = useState(false)
  const [tecleando, setTecleando] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const ultimoValorPropio = useRef(valor)

  const notificarCambio = (nuevoValor: number | ''): void => {
    ultimoValorPropio.current = nuevoValor
    onSeleccionar(nuevoValor)
  }

  // Si `valor` cambia desde afuera (ej. se resetea el formulario tras
  // registrar la venta), el texto visible se vuelve a sincronizar.
  useEffect(() => {
    if (ultimoValorPropio.current === valor) return
    ultimoValorPropio.current = valor
    const sel = items.find((i) => i.id === valor) ?? null
    setTexto(sel?.etiqueta ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  useEffect(() => {
    if (!abierto) return
    const manejarClicFuera = (e: MouseEvent): void => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', manejarClicFuera)
    return () => document.removeEventListener('mousedown', manejarClicFuera)
  }, [abierto])

  const filtrados =
    tecleando && texto.trim()
      ? items.filter(
          (i) =>
            i.etiqueta.toLowerCase().includes(texto.trim().toLowerCase()) ||
            (i.subtitulo ?? '').toLowerCase().includes(texto.trim().toLowerCase())
        )
      : items

  const abrir = (): void => {
    setAbierto(true)
    setTecleando(false)
    setIndiceActivo(0)
  }

  const elegir = (item: OpcionCliente): void => {
    notificarCambio(item.id)
    setTexto(item.etiqueta)
    setAbierto(false)
    setTecleando(false)
  }

  const limpiar = (e: React.MouseEvent): void => {
    e.preventDefault()
    setTexto('')
    setTecleando(false)
    notificarCambio('')
    setAbierto(true)
    setIndiceActivo(0)
  }

  const manejarCambioTexto = (nuevoTexto: string): void => {
    setTexto(nuevoTexto)
    setTecleando(true)
    setAbierto(true)
    setIndiceActivo(0)
    const exacto = items.find((i) => i.etiqueta.toLowerCase() === nuevoTexto.trim().toLowerCase())
    notificarCambio(exacto ? exacto.id : '')
  }

  const manejarBlur = (): void => {
    window.setTimeout(() => {
      setAbierto(false)
      const encontrado = items.find((i) => i.etiqueta.toLowerCase() === texto.trim().toLowerCase())
      setTexto(encontrado ? encontrado.etiqueta : '')
      if (!encontrado) notificarCambio('')
    }, 150)
  }

  const manejarTeclado = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      abrir()
      return
    }
    if (e.key === 'Enter' && !abierto) {
      manejarEnterComoTab(e)
      return
    }
    if (!abierto || filtrados.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceActivo((i) => Math.min(i + 1, filtrados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtrados[indiceActivo]
      if (item) {
        elegir(item)
        manejarEnterComoTab(e)
      }
    } else if (e.key === 'Escape') {
      setAbierto(false)
      setTexto(seleccionado?.etiqueta ?? '')
    }
  }

  return (
    <div ref={contenedorRef} style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <input
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={texto}
        onChange={(e) => manejarCambioTexto(e.target.value)}
        onClick={abrir}
        onBlur={manejarBlur}
        onKeyDown={manejarTeclado}
        placeholder={placeholder}
        style={{ ...estiloInput, width: '100%', paddingRight: texto ? 22 : estiloInput.padding }}
      />
      {texto !== '' && (
        <button
          type="button"
          aria-label="Quitar selección"
          title="Quitar selección"
          onMouseDown={limpiar}
          style={{
            position: 'absolute',
            right: 2,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 15,
            lineHeight: 1,
            padding: '2px 4px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      )}
      {abierto && (
        <ul id={listboxId} role="listbox" style={estiloListaFlotante}>
          {filtrados.length === 0 ? (
            <li style={{ padding: '6px 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Sin resultados.
            </li>
          ) : (
            filtrados.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={item.id === valor}
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(item)
                }}
                onMouseEnter={() => setIndiceActivo(i)}
                style={{
                  ...estiloOpcionLista(i === indiceActivo),
                  fontWeight: item.id === valor ? 600 : 400
                }}
              >
                <div>{item.etiqueta}</div>
                {item.subtitulo && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {item.subtitulo}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// --- Buscador de Producto (contra el servidor) --------------------------
//
// A diferencia de BuscadorCliente, NO filtra sobre una lista ya cargada
// entera: GET /api/productos pagina (tope de 100 por página, ver
// routes/productos.ts), así que con más productos que eso, filtrar en el
// cliente dejaba productos reales sin encontrar (bug reportado 27/10/2026).
// Acá cada tecla (con debounce de 250ms) dispara una búsqueda real contra
// `GET /api/productos?q=...`, el mismo endpoint que ya usa Control de stock
// — por eso encuentra siempre lo mismo que esa pantalla.
//
// Al elegir un resultado, el campo se vacía y la lista se cierra (no deja
// el nombre escrito): lo elegido pasa a mostrarse en el panel de
// configuración de abajo, así que no hace falta mantenerlo repetido acá.
function BuscadorProducto({
  onSeleccionar,
  autoFocus
}: {
  onSeleccionar: (producto: Producto) => void
  autoFocus?: boolean
}): React.JSX.Element {
  const listboxId = useId()
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [resultados, setResultados] = useState<Producto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [indiceActivo, setIndiceActivo] = useState(0)

  useEffect(() => {
    // Si se borró el texto, no hace falta tocar ningún estado: la lista ya
    // queda oculta por el `texto.trim()` del render (ver más abajo), así que
    // cualquier resultado viejo no se llega a mostrar.
    if (!texto.trim()) return

    let cancelado = false
    // `setBuscando(true)` va DENTRO del callback del timeout (no acá, en el
    // cuerpo síncrono del efecto) para no violar react-hooks/set-state-in-effect
    // — mismo criterio que api/hooks.ts.
    const temporizador = window.setTimeout(() => {
      setBuscando(true)
      productosApi
        .listar({ q: texto.trim(), porPagina: 20, soloConStock: true })
        .then((r) => {
          if (cancelado) return
          setResultados(r.items)
          setErrorBusqueda(null)
          setIndiceActivo(0)
        })
        .catch((err) => {
          if (!cancelado)
            setErrorBusqueda(err instanceof ApiClientError ? err.message : 'Error al buscar.')
        })
        .finally(() => !cancelado && setBuscando(false))
    }, 250)
    return () => {
      cancelado = true
      window.clearTimeout(temporizador)
    }
  }, [texto])

  useEffect(() => {
    if (!abierto) return
    const manejarClicFuera = (e: MouseEvent): void => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', manejarClicFuera)
    return () => document.removeEventListener('mousedown', manejarClicFuera)
  }, [abierto])

  const elegir = (producto: Producto): void => {
    onSeleccionar(producto)
    setTexto('')
    setResultados([])
    setAbierto(false)
  }

  const manejarCambioTexto = (nuevoTexto: string): void => {
    setTexto(nuevoTexto)
    setAbierto(true)
  }

  const manejarTeclado = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && (!abierto || resultados.length === 0)) {
      manejarEnterComoTab(e)
      return
    }
    if (!abierto || resultados.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceActivo((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const producto = resultados[indiceActivo]
      if (producto) {
        elegir(producto)
        manejarEnterComoTab(e)
      }
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  return (
    <div ref={contenedorRef} style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <input
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={texto}
        onChange={(e) => manejarCambioTexto(e.target.value)}
        onClick={() => texto.trim() && setAbierto(true)}
        onKeyDown={manejarTeclado}
        placeholder="Buscar producto por nombre…"
        style={{ ...estiloInput, width: '100%' }}
      />
      {abierto && texto.trim() && (
        <ul id={listboxId} role="listbox" style={estiloListaFlotante}>
          {buscando ? (
            <li style={{ padding: '6px 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Buscando…
            </li>
          ) : errorBusqueda ? (
            <li style={{ padding: '6px 8px', fontSize: 12, color: 'var(--color-alert)' }}>
              {errorBusqueda}
            </li>
          ) : resultados.length === 0 ? (
            <li style={{ padding: '6px 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Sin resultados.
            </li>
          ) : (
            resultados.map((p, i) => (
              <li
                key={p.id}
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(p)
                }}
                onMouseEnter={() => setIndiceActivo(i)}
                style={estiloOpcionLista(i === indiceActivo)}
              >
                <div>{p.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Gs. {Number(p.precioBase).toLocaleString('es-PY')} · stock: {p.stock}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// --- Campo numérico con separador de miles y edición sin "fantasmas" ----
//
// Reemplaza el <input type="number"> nativo en Cantidad/Precio/Garantía
// (pedido 31/10/2026). Dos problemas del nativo que esto resuelve:
//
//  - Al borrar hasta dejarlo en "0" y seguir borrando, el campo no podía
//    quedar realmente vacío: `Number('')` se interpreta como 0, el input
//    controlado se volvía a renderizar mostrando "0" de nuevo, y el
//    siguiente dígito tipeado se insertaba AL LADO de ese "0" fantasma
//    ("03" en vez de "3"). Acá, mientras el campo está enfocado se edita un
//    buffer de texto propio (no se lo fuerza por `Number(...)` en cada
//    tecla), así que puede quedar genuinamente vacío mientras se edita.
//  - No mostraba separador de miles. Acá, cuando el campo NO está enfocado
//    se muestra el valor formateado ("1.000"); al enfocarlo se edita en
//    dígitos simples sin el punto, para no pelear con la posición del
//    cursor mientras se tipea.
//
// Pensado para enteros (cantidades, precios en guaraníes, meses de
// garantía): el dominio no maneja decimales en ningún lado de esta pantalla
// (siempre `Number(...).toLocaleString('es-PY')` sin decimales), así que
// cualquier carácter que no sea dígito se descarta al tipear.
function formatearMiles(n: number): string {
  return n.toLocaleString('es-PY')
}

function soloDigitos(texto: string): string {
  return texto.replace(/[^\d]/g, '')
}

// Para Cantidad y Precio: siempre un número (nunca queda "sin valor" una
// vez que se sale del campo — `min` decide a qué vuelve si se deja vacío).
function CampoNumerico({
  value,
  onChange,
  min = 0,
  placeholder,
  onKeyDown,
  style
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  placeholder?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  style?: React.CSSProperties
}): React.JSX.Element {
  const [enfocado, setEnfocado] = useState(false)
  const [texto, setTexto] = useState('')

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={enfocado ? texto : value ? formatearMiles(value) : ''}
      onFocus={() => {
        setEnfocado(true)
        setTexto(value ? String(value) : '')
      }}
      onChange={(e) => {
        const limpio = soloDigitos(e.target.value)
        setTexto(limpio)
        if (limpio !== '') onChange(Number(limpio))
      }}
      onBlur={() => {
        setEnfocado(false)
        if (texto === '') onChange(min)
      }}
      onKeyDown={onKeyDown}
      className="font-data"
      style={style}
    />
  )
}

// Para Garantía ofrecida: puede quedar genuinamente sin valor ('' ≠ 0 — "no
// se especificó garantía" es distinto de "se ofrecieron 0 meses", ver
// services/ventas.ts: `garantiaOfrecida === '' ? null : garantiaOfrecida`).
// A diferencia de CampoNumerico, acá dejar el campo vacío al salir SE
// RESPETA en vez de volver a un mínimo.
function CampoNumericoOpcional({
  value,
  onChange,
  placeholder,
  onKeyDown,
  style
}: {
  value: number | ''
  onChange: (n: number | '') => void
  placeholder?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  style?: React.CSSProperties
}): React.JSX.Element {
  const [enfocado, setEnfocado] = useState(false)
  const [texto, setTexto] = useState('')

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={enfocado ? texto : value === '' ? '' : formatearMiles(value)}
      onFocus={() => {
        setEnfocado(true)
        setTexto(value === '' ? '' : String(value))
      }}
      onChange={(e) => {
        const limpio = soloDigitos(e.target.value)
        setTexto(limpio)
        onChange(limpio === '' ? '' : Number(limpio))
      }}
      onBlur={() => setEnfocado(false)}
      onKeyDown={onKeyDown}
      className="font-data"
      style={style}
    />
  )
}

export function VentaScreen(): React.JSX.Element {
  const { usuario, token } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador'

  // Ya no se precarga "todo" el catálogo (ver BuscadorProducto arriba): acá
  // solo hace falta saber si hay AL MENOS un producto cargado, para decidir
  // si mostrar la pantalla o el aviso de "todavía no hay stock".
  const [catalogoVerificado, setCatalogoVerificado] = useState(false)
  const [hayProductos, setHayProductos] = useState(true)
  const [errorProductos, setErrorProductos] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    productosApi
      .listar({ porPagina: 1 })
      .then((r) => {
        if (cancelado) return
        setHayProductos(r.total > 0)
        setErrorProductos(null)
      })
      .catch((err) => {
        if (!cancelado)
          setErrorProductos(
            err instanceof ApiClientError ? err.message : 'Error al cargar productos.'
          )
      })
      .finally(() => !cancelado && setCatalogoVerificado(true))
    return () => {
      cancelado = true
    }
  }, [])

  // El detalle de la venta arranca VACÍO a propósito (26/10/2026: antes
  // quedaba precargada una primera línea con el primer producto del
  // catálogo, lo cual confundía — parecía que ya había algo cargado sin que
  // el usuario lo hubiera elegido).
  const [lineas, setLineas] = useState<LineaForm[]>([])

  // --- Clientes (solo hace falta para el flujo de Administrador) ---
  const [clientes, setClientes] = useState<Cliente[]>([])
  useEffect(() => {
    if (!esAdmin) return
    let cancelado = false
    apiFetch<Cliente[]>('/api/clientes', { token }).then((r) => {
      if (!cancelado && r.ok) setClientes(r.data)
    })
    return () => {
      cancelado = true
    }
  }, [esAdmin, token])

  // --- Lotes por producto (solo Administrador: selección manual del lote) ---
  const [lotesPorProducto, setLotesPorProducto] = useState<Record<number, Compra[]>>({})

  const [clienteId, setClienteId] = useState<number | ''>('')
  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO)[number]>('Efectivo')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [ventaRegistrada, setVentaRegistrada] = useState<VentaConItems | null>(null)

  // El producto que se está configurando antes de agregarlo al detalle (ver
  // nota de UX al principio del archivo).
  const [borrador, setBorrador] = useState<Borrador>(borradorVacio)

  // Trae los lotes de cada producto que aparece en el detalle o se está por
  // agregar, y todavía no está en caché. Solo para Administrador (el
  // Empleado no elige lote).
  useEffect(() => {
    if (!esAdmin) return
    const idsRelevantes = [
      ...lineas.map((l) => l.producto.id),
      ...(borrador.producto ? [borrador.producto.id] : [])
    ]
    const pendientes = [...new Set(idsRelevantes)].filter((id) => !(id in lotesPorProducto))
    if (pendientes.length === 0) return
    let cancelado = false
    Promise.all(
      pendientes.map((id) =>
        productosApi
          .obtener(id)
          .then((p) => [id, p.lotes] as const)
          .catch(() => [id, []] as const)
      )
    ).then((pares) => {
      if (cancelado) return
      setLotesPorProducto((prev) => ({ ...prev, ...Object.fromEntries(pares) }))
      // Si el producto que se está configurando (todavía sin lote elegido)
      // resultó tener un solo lote con stock, se elige solo: no tiene
      // sentido obligar a abrir el desplegable y confirmar "el único que
      // hay" cuando no existe otra opción real (pedido 27/10/2026). Con dos
      // o más lotes, sigue siendo manual (HU-20, entidades-dominio.md
      // sección 14) — acá no se "adivina" cuál usar. Va dentro de este
      // `.then()` (no en un efecto aparte reaccionando a `lotesPorProducto`)
      // para no violar react-hooks/set-state-in-effect — mismo criterio que
      // el resto del archivo.
      const loteDelBorrador = pares.find(([id]) => id === borrador.producto?.id)
      if (loteDelBorrador && loteDelBorrador[1].length === 1) {
        const unicoLote = loteDelBorrador[1][0]
        setBorrador((b) => (b.compraId === '' ? { ...b, compraId: unicoLote.id } : b))
      }
    })
    return () => {
      cancelado = true
    }
  }, [esAdmin, lineas, borrador.producto, lotesPorProducto])

  const opcionesCliente: OpcionCliente[] = useMemo(
    () =>
      clientes.map((c) => ({
        id: c.id,
        etiqueta: c.nombre,
        subtitulo: c.cedula ?? undefined
      })),
    [clientes]
  )

  // Elegir un producto en el buscador reinicia el resto del borrador (lote,
  // garantía, etc.) y precarga el precio base como punto de partida. Si los
  // lotes de ese producto ya están en caché (se vio antes en esta misma
  // venta) y es uno solo, se elige de una — mismo criterio que el `.then()`
  // del efecto de arriba para cuando todavía no estaban en caché.
  const elegirProductoBorrador = (producto: Producto): void => {
    const lotesConocidos = lotesPorProducto[producto.id]
    setBorrador({
      ...borradorVacio,
      producto,
      precioUnitario: Number(producto.precioBase),
      compraId: lotesConocidos && lotesConocidos.length === 1 ? lotesConocidos[0].id : ''
    })
  }

  const lotesBorrador = borrador.producto ? (lotesPorProducto[borrador.producto.id] ?? []) : []
  const loteBorrador = lotesBorrador.find((c) => c.id === borrador.compraId) ?? null
  const garantiaMaxBorrador = loteBorrador?.garantiaProveedor ?? null

  const puedeAgregarBorrador = esAdmin
    ? borrador.producto !== null &&
      loteBorrador !== null &&
      borrador.cantidad > 0 &&
      borrador.cantidad <= loteBorrador.cantidadDisponible
    : borrador.producto !== null && borrador.cantidad > 0

  const agregarABorrador = (): void => {
    if (!puedeAgregarBorrador || !borrador.producto) return
    const nextId = lineas.length ? Math.max(...lineas.map((l) => l.id)) + 1 : 1
    setLineas((prev) => [
      ...prev,
      {
        id: nextId,
        producto: borrador.producto as Producto,
        compraId: borrador.compraId,
        cantidad: borrador.cantidad,
        precioUnitario: borrador.precioUnitario,
        tipoPago: borrador.tipoPago,
        garantiaOfrecida: borrador.garantiaOfrecida,
        fechaPagoPrevista: borrador.fechaPagoPrevista
      }
    ])
    setBorrador(borradorVacio)
  }

  const actualizarLinea = (id: number, cambios: Partial<LineaForm>): void => {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)))
  }

  const quitarLinea = (id: number): void => {
    setLineas((prev) => prev.filter((l) => l.id !== id))
  }

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.precioUnitario * l.cantidad, 0),
    [lineas]
  )
  const totalCredito = useMemo(
    () =>
      lineas
        .filter((l) => l.tipoPago === 'Crédito')
        .reduce((acc, l) => acc + l.precioUnitario * l.cantidad, 0),
    [lineas]
  )

  const clienteRequerido = esAdmin && lineas.some((l) => l.tipoPago === 'Crédito')

  // Una línea está lista para registrarse si tiene lote elegido y la
  // cantidad no supera lo disponible de ESE lote (selección manual, no hay
  // reparto automático — ver entidades-dominio.md, sección 14).
  const lineaValida = (l: LineaForm): boolean => {
    if (l.compraId === '') return false
    const lote = (lotesPorProducto[l.producto.id] ?? []).find((c) => c.id === l.compraId)
    if (!lote) return false
    return l.cantidad > 0 && l.cantidad <= lote.cantidadDisponible
  }

  const puedeRegistrar =
    esAdmin &&
    lineas.length > 0 &&
    lineas.every(lineaValida) &&
    !(clienteRequerido && clienteId === '') &&
    !enviando

  const handleRegistrar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!puedeRegistrar) return
    setEnviando(true)
    setErrorEnvio(null)
    const r = await ventasApi.registrar(token, {
      clienteId: clienteId === '' ? null : clienteId,
      metodoPago,
      items: lineas.map((l) => ({
        productoId: l.producto.id,
        compraId: l.compraId as number,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        garantiaOfrecida: l.garantiaOfrecida === '' ? null : l.garantiaOfrecida,
        tipoPago: l.tipoPago,
        fechaPagoPrevista: l.tipoPago === 'Crédito' ? l.fechaPagoPrevista || undefined : undefined
      }))
    })
    setEnviando(false)
    if (!r.ok) {
      setErrorEnvio(r.error.message)
      return
    }
    setVentaRegistrada(r.data)
    // El stock de los lotes usados cambió: se descarta la caché para que la
    // próxima venta vuelva a pedir cantidades disponibles frescas.
    setLotesPorProducto({})
  }

  const nuevaVenta = (): void => {
    setLineas([])
    setBorrador(borradorVacio)
    setClienteId('')
    setMetodoPago('Efectivo')
    setVentaRegistrada(null)
    setErrorEnvio(null)
  }

  if (!catalogoVerificado) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>{esAdmin ? 'Nueva venta' : 'Calculadora de venta'}</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando…</p>
      </div>
    )
  }

  if (errorProductos) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>{esAdmin ? 'Nueva venta' : 'Calculadora de venta'}</h2>
        <Panel>
          <p style={{ color: 'var(--color-alert)', margin: 0 }}>{errorProductos}</p>
        </Panel>
      </div>
    )
  }

  if (!hayProductos) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>{esAdmin ? 'Nueva venta' : 'Calculadora de venta'}</h2>
        <Panel>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Todavía no hay productos cargados — primero hace falta registrar stock.
          </p>
        </Panel>
      </div>
    )
  }

  // Vista de resultado, solo Administrador (el Empleado nunca registra nada).
  if (esAdmin && ventaRegistrada) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Nueva venta</h2>
        <Panel>
          <p style={{ color: 'var(--color-ok)', fontWeight: 600, marginTop: 0 }}>
            ✓ Venta #{ventaRegistrada.id} registrada por Gs.{' '}
            {Number(ventaRegistrada.montoTotal).toLocaleString('es-PY')}
          </p>
          <button
            autoFocus
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
      <h2 style={{ marginTop: 0 }}>{esAdmin ? 'Nueva venta' : 'Calculadora de venta'}</h2>
      {!esAdmin && (
        <p
          style={{
            marginTop: -8,
            marginBottom: 'var(--space-3)',
            fontSize: 13,
            color: 'var(--color-text-muted)'
          }}
        >
          Esta sección sirve para calcular el total a precio base e informar al cliente. El registro
          de la venta lo hace el Administrador (ver HU-17).
        </p>
      )}

      <form onSubmit={handleRegistrar}>
        {esAdmin && (
          <Panel title="Cliente y forma de pago">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div style={{ flex: '1 1 260px' }}>
                <label style={estiloLabel}>Cliente</label>
                <BuscadorCliente
                  items={opcionesCliente}
                  valor={clienteId}
                  onSeleccionar={setClienteId}
                  placeholder="Buscar cliente por nombre o cédula…"
                  autoFocus
                />
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    margin: 'var(--space-2) 0 0 0'
                  }}
                >
                  Se deja vacío para un cliente casual (sin registrar).
                </p>
                {clienteRequerido && clienteId === '' && (
                  <p
                    style={{
                      color: 'var(--color-alert)',
                      fontSize: 12,
                      margin: 'var(--space-2) 0 0 0'
                    }}
                  >
                    Hay ítems a crédito en esta venta: se requiere seleccionar un cliente registrado
                    (HU-10).
                  </p>
                )}
              </div>

              <div style={{ flex: '0 0 auto' }}>
                <label style={estiloLabel}>Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as (typeof METODOS_PAGO)[number])}
                  onKeyDown={manejarEnterComoTab}
                  style={estiloInput}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>
        )}

        <Panel title="Agregar producto">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={estiloLabel}>Producto</label>
              <BuscadorProducto onSeleccionar={elegirProductoBorrador} autoFocus={!esAdmin} />
            </div>

            {borrador.producto && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  alignItems: 'flex-end'
                }}
              >
                <div style={{ flexBasis: '100%', fontWeight: 600 }}>{borrador.producto.nombre}</div>

                {esAdmin && (
                  <div>
                    <label style={estiloLabel}>Lote (selección manual)</label>
                    <select
                      value={borrador.compraId}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          compraId: e.target.value ? Number(e.target.value) : '',
                          garantiaOfrecida: ''
                        }))
                      }
                      onKeyDown={manejarEnterComoTab}
                      style={estiloInput}
                    >
                      <option value="">Elegir lote…</option>
                      {lotesBorrador.map((lote) => (
                        <option key={lote.id} value={lote.id}>
                          Compra #{lote.id} ({lote.fecha}) ·{' '}
                          {lote.garantiaProveedor
                            ? `${lote.garantiaProveedor}m garantía`
                            : 'sin garantía'}{' '}
                          · {lote.cantidadDisponible} disp.
                        </option>
                      ))}
                      {lotesBorrador.length === 0 && <option disabled>Sin lotes con stock</option>}
                    </select>
                  </div>
                )}

                <div>
                  <label style={estiloLabel}>Cantidad</label>
                  <CampoNumerico
                    min={1}
                    value={borrador.cantidad}
                    onChange={(cantidad) => setBorrador((b) => ({ ...b, cantidad }))}
                    onKeyDown={manejarEnterComoTab}
                    style={{ ...estiloInput, width: 70 }}
                  />
                  {esAdmin &&
                    loteBorrador &&
                    borrador.cantidad > loteBorrador.cantidadDisponible && (
                      <div style={{ fontSize: 11, color: 'var(--color-alert)', marginTop: 2 }}>
                        Supera el stock del lote ({loteBorrador.cantidadDisponible})
                      </div>
                    )}
                </div>

                {esAdmin && (
                  <div>
                    <label style={estiloLabel}>Precio a cobrar</label>
                    <CampoNumerico
                      value={borrador.precioUnitario}
                      onChange={(precioUnitario) => setBorrador((b) => ({ ...b, precioUnitario }))}
                      onKeyDown={manejarEnterComoTab}
                      style={{ ...estiloInput, width: 100 }}
                    />
                  </div>
                )}

                {esAdmin && (
                  <div>
                    <label style={estiloLabel}>Pago</label>
                    <select
                      value={borrador.tipoPago}
                      onChange={(e) => {
                        const tipoPago = e.target.value as TipoPago
                        setBorrador((b) => ({
                          ...b,
                          tipoPago,
                          fechaPagoPrevista:
                            tipoPago === 'Crédito' && !b.fechaPagoPrevista
                              ? hoyMasUnMes()
                              : b.fechaPagoPrevista
                        }))
                      }}
                      onKeyDown={manejarEnterComoTab}
                      style={estiloInput}
                    >
                      <option value="Contado">Contado</option>
                      <option value="Crédito">Crédito</option>
                    </select>
                  </div>
                )}

                {esAdmin && garantiaMaxBorrador !== null && (
                  <div>
                    <label style={estiloLabel}>Garantía al cliente</label>
                    <CampoNumericoOpcional
                      placeholder={`máx. ${garantiaMaxBorrador}m`}
                      value={borrador.garantiaOfrecida}
                      onChange={(garantiaOfrecida) =>
                        setBorrador((b) => ({ ...b, garantiaOfrecida }))
                      }
                      onKeyDown={manejarEnterComoTab}
                      style={{ ...estiloInput, width: 90 }}
                    />
                    {typeof borrador.garantiaOfrecida === 'number' &&
                      borrador.garantiaOfrecida > garantiaMaxBorrador && (
                        <div style={{ fontSize: 11, color: 'var(--color-alert)', marginTop: 2 }}>
                          Supera garantía del proveedor ({garantiaMaxBorrador}m)
                        </div>
                      )}
                  </div>
                )}

                {esAdmin && borrador.tipoPago === 'Crédito' && (
                  <div>
                    <label style={estiloLabel}>Pago previsto</label>
                    <input
                      type="date"
                      value={borrador.fechaPagoPrevista}
                      onChange={(e) =>
                        setBorrador((b) => ({ ...b, fechaPagoPrevista: e.target.value }))
                      }
                      onKeyDown={manejarEnterComoTab}
                      className="font-data"
                      style={estiloInput}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={agregarABorrador}
                  disabled={!puedeAgregarBorrador}
                  style={{
                    ...estiloBotonAgregar,
                    background: puedeAgregarBorrador
                      ? 'var(--color-accent)'
                      : 'var(--color-border)',
                    cursor: puedeAgregarBorrador ? 'pointer' : 'not-allowed'
                  }}
                >
                  + Agregar a la venta
                </button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title={`Detalle de la venta${lineas.length ? ` (${lineas.length})` : ''}`}>
          {lineas.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Todavía no agregaste ningún producto. Buscalo arriba para empezar.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {lineas.map((linea) => {
                const lotesLinea = lotesPorProducto[linea.producto.id] ?? []
                const lote = lotesLinea.find((c) => c.id === linea.compraId)
                const subtotal = linea.precioUnitario * linea.cantidad
                const superaStock = esAdmin && lote && linea.cantidad > lote.cantidadDisponible
                const garantiaMaxLinea = lote?.garantiaProveedor ?? null
                const superaGarantia =
                  esAdmin &&
                  garantiaMaxLinea !== null &&
                  typeof linea.garantiaOfrecida === 'number' &&
                  linea.garantiaOfrecida > garantiaMaxLinea

                return (
                  <div key={linea.id} style={estiloCardLinea}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 'var(--space-2)'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{linea.producto.nombre}</div>
                      <button
                        type="button"
                        onClick={() => quitarLinea(linea.id)}
                        style={estiloBotonQuitar}
                        aria-label="Quitar línea"
                      >
                        ✕
                      </button>
                    </div>

                    {esAdmin && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <label style={estiloLabel}>Lote (selección manual)</label>
                        <select
                          value={linea.compraId}
                          onChange={(e) =>
                            actualizarLinea(linea.id, {
                              compraId: e.target.value ? Number(e.target.value) : '',
                              garantiaOfrecida: ''
                            })
                          }
                          onKeyDown={manejarEnterComoTab}
                          style={{ ...estiloInput, fontSize: 13 }}
                        >
                          <option value="">Elegir lote…</option>
                          {lotesLinea.map((l) => (
                            <option key={l.id} value={l.id}>
                              Compra #{l.id} ({l.fecha}) ·{' '}
                              {l.garantiaProveedor
                                ? `${l.garantiaProveedor}m garantía`
                                : 'sin garantía'}{' '}
                              · {l.cantidadDisponible} disp.
                            </option>
                          ))}
                          {lotesLinea.length === 0 && <option disabled>Sin lotes con stock</option>}
                        </select>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)',
                        marginTop: 'var(--space-3)',
                        alignItems: 'flex-end',
                        fontSize: 14
                      }}
                    >
                      <div>
                        <label style={estiloLabel}>Cantidad</label>
                        <CampoNumerico
                          min={1}
                          value={linea.cantidad}
                          onChange={(cantidad) => actualizarLinea(linea.id, { cantidad })}
                          onKeyDown={manejarEnterComoTab}
                          style={{ ...estiloInput, width: 64 }}
                        />
                      </div>

                      {esAdmin ? (
                        <div>
                          <label style={estiloLabel}>Precio a cobrar</label>
                          <CampoNumerico
                            value={linea.precioUnitario}
                            onChange={(precioUnitario) =>
                              actualizarLinea(linea.id, { precioUnitario })
                            }
                            onKeyDown={manejarEnterComoTab}
                            style={{ ...estiloInput, width: 110 }}
                          />
                        </div>
                      ) : (
                        <div>
                          <label style={estiloLabel}>Precio base</label>
                          <div className="font-data" style={{ padding: 'var(--space-2) 0' }}>
                            Gs. {linea.precioUnitario.toLocaleString('es-PY')}
                          </div>
                        </div>
                      )}

                      <div>
                        <label style={estiloLabel}>Subtotal</label>
                        <div
                          className="font-data"
                          style={{ fontWeight: 600, padding: 'var(--space-2) 0' }}
                        >
                          Gs. {subtotal.toLocaleString('es-PY')}
                        </div>
                      </div>

                      {esAdmin && (
                        <div>
                          <label style={estiloLabel}>Pago</label>
                          <select
                            value={linea.tipoPago}
                            onChange={(e) => {
                              const tipoPago = e.target.value as TipoPago
                              actualizarLinea(linea.id, {
                                tipoPago,
                                fechaPagoPrevista:
                                  tipoPago === 'Crédito' && !linea.fechaPagoPrevista
                                    ? hoyMasUnMes()
                                    : linea.fechaPagoPrevista
                              })
                            }}
                            onKeyDown={manejarEnterComoTab}
                            style={estiloInput}
                          >
                            <option value="Contado">Contado</option>
                            <option value="Crédito">Crédito</option>
                          </select>
                        </div>
                      )}

                      {esAdmin && garantiaMaxLinea !== null && (
                        <div>
                          <label style={estiloLabel}>Garantía al cliente</label>
                          <CampoNumericoOpcional
                            placeholder={`máx. ${garantiaMaxLinea}m`}
                            value={linea.garantiaOfrecida}
                            onChange={(garantiaOfrecida) =>
                              actualizarLinea(linea.id, { garantiaOfrecida })
                            }
                            onKeyDown={manejarEnterComoTab}
                            style={{ ...estiloInput, width: 100 }}
                          />
                        </div>
                      )}

                      {esAdmin && linea.tipoPago === 'Crédito' && (
                        <div>
                          <label style={estiloLabel}>Pago previsto</label>
                          <input
                            type="date"
                            value={linea.fechaPagoPrevista}
                            onChange={(e) =>
                              actualizarLinea(linea.id, { fechaPagoPrevista: e.target.value })
                            }
                            onKeyDown={manejarEnterComoTab}
                            className="font-data"
                            style={estiloInput}
                          />
                        </div>
                      )}
                    </div>

                    {(superaStock || superaGarantia) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-alert)',
                          marginTop: 'var(--space-2)'
                        }}
                      >
                        {superaStock && (
                          <div>Supera el stock del lote ({lote?.cantidadDisponible})</div>
                        )}
                        {superaGarantia && (
                          <div>Supera garantía del proveedor ({garantiaMaxLinea}m)</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)'
            }}
          >
            <div>
              <div className="font-data" style={{ fontSize: 22 }}>
                Total: Gs. {total.toLocaleString('es-PY')}
              </div>
              {esAdmin && totalCredito > 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-alert)' }}>
                  Gs. {totalCredito.toLocaleString('es-PY')} queda a crédito
                </div>
              )}
            </div>

            {esAdmin && (
              <div style={{ textAlign: 'right' }}>
                {errorEnvio && (
                  <p
                    style={{
                      color: 'var(--color-alert)',
                      fontSize: 13,
                      margin: '0 0 var(--space-2) 0'
                    }}
                  >
                    {errorEnvio}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!puedeRegistrar}
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
                  {enviando ? 'Registrando…' : 'Registrar venta'}
                </button>
              </div>
            )}
          </div>
        </Panel>
      </form>
    </div>
  )
}

// src/renderer/src/screens/StockScreen.tsx
//
// Versión conectada a la API real (ver docs/03-gestion-proyecto/
// sprint-1-backlog.md, punto 2 y 3). Reemplaza el AppDataContext en memoria
// por llamadas HTTP a src/main/api/server.ts (categorías, productos, compras,
// proveedores). El stock de cada producto sigue siendo la suma de sus lotes
// de compra (ver entidades-dominio.md, secciones 5 y 14): el detalle por
// lote se pide a demanda (GET /api/productos/:id) al expandir una fila, en
// vez de traerlo para todos los productos de entrada.
//
// Nota de alcance (18/10/2026): no existe todavía una pantalla propia de
// Categorías ni de Proveedores (ver sprint-1-backlog.md, puntos 2 y 3, aún
// sin pantalla dedicada). Acá se resuelve con un alta rápida inline donde
// hace falta elegir una categoría o un proveedor, para no bloquear el
// registro de compras/productos nuevos. Falta construir esas pantallas de
// CRUD completo (editar/eliminar categoría, editar proveedor) aparte.
//
// Ajustes de UX (19-20/10/2026), a pedido del dueño del taller al probar:
//  - Los <select> de categoría/proveedor se reemplazaron por un combo con
//    buscador (SelectorBuscable, basado en <input list> + <datalist>, sin
//    agregar ninguna librería nueva), porque con muchos registros cargados
//    buscar en un <select> común era tedioso.
//  - En el alta de producto nuevo, los datos del primer lote de compra pasan
//    a ir ANTES que el precio de venta y el stock mínimo — el flujo natural
//    es "¿qué compré?" antes que "¿a cuánto lo vendo?".
//  - Los campos numéricos obligatorios que antes arrancaban en 0 o 1
//    (cantidad, precio de compra, precio base) ahora arrancan vacíos, con
//    el valor de ejemplo como placeholder. Con un 0 fijo como valor inicial,
//    al tipear se insertaba antes del cero (ej. "0123" en vez de "123") y
//    había que borrarlo a mano cada vez.

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { useCategorias, useProductos, useProveedores } from '../api/hooks'
import { categoriasApi } from '../api/categorias'
import { proveedoresApi } from '../api/proveedores'
import { productosApi } from '../api/productos'
import { comprasApi } from '../api/compras'
import { urlPdfListadoStock, ApiClientError } from '../api/client'
import type { Compra, Proveedor, Producto } from '../api/types'

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
      {title && (
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 14, fontWeight: 600 }}>{title}</h3>
      )}
      {children}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  padding: 4,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

const estiloBotonPrincipal: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600
}

const estiloBotonSecundario: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)'
}

function MensajeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <p style={{ color: 'var(--color-alert)', fontSize: 12, margin: 'var(--space-2) 0 0 0' }}>
      {mensaje}
    </p>
  )
}

// --- Selector con buscador (categoría / proveedor) + alta rápida ---------
//
// Combobox propio (input + lista flotante dibujada con CSS), en reemplazo
// del anterior basado en <input list> + <datalist>. Se abandona el
// datalist nativo por dos problemas reales detectados al usarlo:
//  - La lista de sugerencias la dibuja el navegador como una capa aparte,
//    anclada a la posición de pantalla del input en el momento de abrirse:
//    si la página se scrollea con la lista abierta, el input se mueve pero
//    la lista queda flotando en su posición original, superpuesta al resto.
//  - El datalist no deja controlar su alto máximo ni su scroll interno —
//    con muchas opciones cargadas, el tamaño y el comportamiento de la
//    lista quedan a criterio del navegador, no del diseño de la pantalla.
//
// La lista ahora es un <ul> propio, con `position: absolute` dentro de un
// contenedor `position: relative` (ver el <div> que envuelve el <input>):
// al formar parte del flujo normal del documento, se desplaza junto con la
// página al scrollear, en vez de quedar anclada a una posición de pantalla
// fija. Tiene un alto máximo (`ALTO_MAXIMO_LISTA`) con scroll propio para
// cuando hay muchas opciones, en vez de estirarse sin límite.
//
// Comportamiento de búsqueda: al abrir el selector (foco o clic) se
// muestran todas las opciones sin filtrar, para poder recorrerlas aunque ya
// haya un valor cargado. En cuanto se empieza a tipear, la lista se filtra
// por coincidencia parcial en cualquier parte del nombre (no hace falta
// escribirlo completo ni respetar mayúsculas). Se puede navegar con las
// flechas y confirmar con Enter/clic, igual que con el datalist anterior,
// pero sin sus limitaciones visuales. `useId()` sigue evitando que dos
// selectores iguales abiertos a la vez (ej. el alta de producto y la
// edición de un lote) choquen por el mismo id de lista.

const ALTO_MAXIMO_LISTA = 220

interface ItemConNombre {
  id: number
  nombre: string
}

function SelectorBuscable<T extends ItemConNombre>({
  items,
  valor,
  onCambiar,
  onCrear,
  onCreado,
  etiquetaCampo,
  etiquetaBotonNuevo,
  placeholderBuscar,
  placeholderNuevo
}: {
  items: T[]
  valor: number | ''
  onCambiar: (id: number | '') => void
  onCrear: (nombre: string) => Promise<T>
  onCreado: () => void
  etiquetaCampo: string
  etiquetaBotonNuevo: string
  placeholderBuscar: string
  placeholderNuevo: string
}) {
  const listboxId = useId()
  const contenedorRef = useRef<HTMLDivElement>(null)

  const [alta, setAlta] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seleccionado = items.find((i) => i.id === valor) ?? null
  const [texto, setTexto] = useState(seleccionado?.nombre ?? '')
  const [abierto, setAbierto] = useState(false)
  const [tecleando, setTecleando] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)

  // Último valor que ESTE selector le pidió al padre a través de
  // `onCambiar` (ej. al tipear sin coincidencia exacta, o al elegir una
  // opción). El efecto de sincronización de abajo lo usa para distinguir
  // un cambio de `valor` que originamos nosotros mismos (no hay que volver
  // a pisar `texto`: el usuario puede estar en medio de escribir algo) de
  // uno que vino de afuera (ej. se reseteó el formulario).
  const ultimoValorPropio = useRef(valor)

  const notificarCambio = (nuevoValor: number | ''): void => {
    ultimoValorPropio.current = nuevoValor
    onCambiar(nuevoValor)
  }

  // Si `valor` cambia desde afuera (ej. se seleccionó por el alta rápida,
  // o se reseteó el formulario), el texto visible se vuelve a sincronizar.
  // Si el cambio lo originamos nosotros mismos (ver `notificarCambio`), se
  // ignora: sin este chequeo, tipear algo que no coincide con ningún ítem
  // llama a `onCambiar('')`, el padre actualiza `valor` a '', este efecto
  // se dispara por ese cambio de `valor` y terminaba pisando con un texto
  // vacío lo que el usuario recién había tipeado (bug reportado: "escribo
  // algo después de seleccionar y se borra todo").
  useEffect(() => {
    if (ultimoValorPropio.current === valor) return
    ultimoValorPropio.current = valor
    setTexto(seleccionado?.nombre ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  // Cierra la lista al hacer clic fuera del selector. Sin esto, la lista
  // solo se cerraría al perder el foco el input (ver manejarBlur), lo que
  // deja afuera, por ejemplo, un clic en otra parte de la pantalla que no
  // mueve el foco.
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
      ? items.filter((i) => i.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
      : items

  const abrir = (): void => {
    setAbierto(true)
    setTecleando(false)
    setIndiceActivo(0)
  }

  const elegir = (item: T): void => {
    notificarCambio(item.id)
    setTexto(item.nombre)
    setAbierto(false)
    setTecleando(false)
  }

  // Quita la selección actual y deja el campo listo para elegir de nuevo.
  // onMouseDown (no onClick) + preventDefault, igual que en las opciones de
  // la lista: evita que el input pierda el foco antes de procesar el clic.
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
    // Si lo tipeado coincide exacto con una opción (ej. se pegó el nombre
    // completo), se toma como seleccionada; si no, se limpia la selección
    // hasta que el usuario elija de la lista o salga del campo.
    const exacto = items.find((i) => i.nombre.toLowerCase() === nuevoTexto.trim().toLowerCase())
    notificarCambio(exacto ? exacto.id : '')
  }

  const manejarBlur = (): void => {
    // El cierre se retrasa un instante para que un clic sobre una opción
    // de la lista (ver onMouseDown más abajo) ya haya sido procesado antes
    // de que esta función la descarte; si no, el blur llega primero y el
    // clic nunca se registra.
    window.setTimeout(() => {
      setAbierto(false)
      const encontrado = items.find((i) => i.nombre.toLowerCase() === texto.trim().toLowerCase())
      setTexto(encontrado ? encontrado.nombre : '')
      if (!encontrado) notificarCambio('')
    }, 150)
  }

  const manejarTeclado = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      abrir()
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
      if (item) elegir(item)
    } else if (e.key === 'Escape') {
      setAbierto(false)
      setTexto(seleccionado?.nombre ?? '')
    }
  }

  const crear = async (): Promise<void> => {
    if (!nombreNuevo.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const creado = await onCrear(nombreNuevo.trim())
      onCreado()
      notificarCambio(creado.id)
      setTexto(creado.nombre)
      setNombreNuevo('')
      setAlta(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear.')
    } finally {
      setGuardando(false)
    }
  }

  if (alta) {
    return (
      <Campo label={`${etiquetaCampo} nueva`}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder={placeholderNuevo}
            style={estiloInput}
          />
          <button type="button" onClick={crear} disabled={guardando} style={estiloBotonSecundario}>
            Agregar
          </button>
          <button type="button" onClick={() => setAlta(false)} style={estiloBotonSecundario}>
            ×
          </button>
        </div>
        <MensajeError mensaje={error} />
      </Campo>
    )
  }

  return (
    <Campo label={etiquetaCampo}>
      <div ref={contenedorRef} style={{ display: 'flex', gap: 4 }}>
        <div style={{ position: 'relative', width: 220 }}>
          <input
            role="combobox"
            aria-expanded={abierto}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            value={texto}
            onChange={(e) => manejarCambioTexto(e.target.value)}
            onFocus={abrir}
            onClick={abrir}
            onBlur={manejarBlur}
            onKeyDown={manejarTeclado}
            placeholder={placeholderBuscar}
            style={{
              ...estiloInput,
              width: '100%',
              paddingRight: texto ? 22 : estiloInput.padding
            }}
          />
          {texto !== '' && (
            <button
              type="button"
              aria-label={`Quitar ${etiquetaCampo.toLowerCase()} seleccionada`}
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
            <ul
              id={listboxId}
              role="listbox"
              style={{
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
                maxHeight: ALTO_MAXIMO_LISTA,
                overflowY: 'auto',
                zIndex: 20
              }}
            >
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
                    // onMouseDown (no onClick) + preventDefault para que la
                    // opción se elija ANTES de que el input pierda el foco:
                    // si no, el blur del input (ver manejarBlur) se dispara
                    // primero y alcanza a cerrar/limpiar la lista.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      elegir(item)
                    }}
                    onMouseEnter={() => setIndiceActivo(i)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      cursor: 'pointer',
                      background: i === indiceActivo ? 'var(--color-bg)' : 'transparent',
                      fontWeight: item.id === valor ? 600 : 400
                    }}
                  >
                    {item.nombre}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAlta(true)}
          style={estiloBotonSecundario}
          title={etiquetaBotonNuevo}
        >
          {etiquetaBotonNuevo}
        </button>
      </div>
    </Campo>
  )
}

// --- Formulario: registrar compra sobre un producto existente ----------

function FormularioCompra({
  productoId,
  proveedores,
  onProveedorCreado,
  onCerrar,
  onGuardado
}: {
  productoId: number
  proveedores: Proveedor[]
  onProveedorCreado: () => void
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [precioCompra, setPrecioCompra] = useState<number | ''>('')
  const [garantia, setGarantia] = useState<number | ''>('')
  const [factura, setFactura] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    if (!proveedorId) {
      setError('Elegí un proveedor.')
      return
    }
    if (cantidad === '' || cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }
    if (precioCompra === '') {
      setError('El precio de compra es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await comprasApi.registrar({
        productoId,
        proveedorId,
        fecha,
        cantidad,
        precioCompra: Number(precioCompra),
        garantiaProveedor: garantia === '' ? null : garantia,
        factura: factura.trim() || null
      })
      onGuardado()
      onCerrar()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo registrar la compra.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <tr style={{ background: 'var(--color-bg)' }}>
      <td colSpan={6} style={{ padding: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <SelectorBuscable
            items={proveedores}
            valor={proveedorId}
            onCambiar={setProveedorId}
            onCrear={(nombre) => proveedoresApi.crear(nombre)}
            onCreado={onProveedorCreado}
            etiquetaCampo="Proveedor"
            etiquetaBotonNuevo="+ nuevo"
            placeholderBuscar="Buscar proveedor..."
            placeholderNuevo="Nombre del proveedor"
          />
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="font-data"
              style={estiloInput}
            />
          </Campo>
          <Campo label="Cantidad">
            <input
              type="number"
              min={1}
              value={cantidad}
              placeholder="1"
              onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 70 }}
            />
          </Campo>
          <Campo label="Precio compra (unit.)">
            <input
              type="number"
              value={precioCompra}
              placeholder="0"
              onChange={(e) => setPrecioCompra(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Garantía proveedor (meses)">
            <input
              type="number"
              value={garantia}
              onChange={(e) => setGarantia(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 90 }}
            />
          </Campo>
          <Campo label="N° factura (opcional)">
            <input
              value={factura}
              onChange={(e) => setFactura(e.target.value)}
              style={{ ...estiloInput, width: 120 }}
            />
          </Campo>
          <button onClick={guardar} disabled={guardando} style={estiloBotonPrincipal}>
            Guardar lote
          </button>
          <button onClick={onCerrar} style={estiloBotonSecundario}>
            Cancelar
          </button>
        </div>
        <MensajeError mensaje={error} />
      </td>
    </tr>
  )
}

// --- Formulario: editar un producto existente ---------------------------

function FormularioEdicion({
  producto,
  categorias,
  onCategoriaCreada,
  onCerrar,
  onGuardado
}: {
  producto: Producto
  categorias: { id: number; nombre: string }[]
  onCategoriaCreada: () => void
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(producto.nombre)
  const [categoriaId, setCategoriaId] = useState<number | ''>(producto.categoriaId)
  const [precioBase, setPrecioBase] = useState(producto.precioBase)
  const [stockMinimo, setStockMinimo] = useState<number | ''>(producto.stockMinimo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    if (!nombre.trim() || !categoriaId) {
      setError('Nombre y categoría son obligatorios.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await productosApi.editar(producto.id, {
        nombre: nombre.trim(),
        categoriaId,
        precioBase: Number(precioBase),
        stockMinimo: stockMinimo === '' ? null : stockMinimo
      })
      onGuardado()
      onCerrar()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar el producto.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <tr style={{ background: 'var(--color-bg)' }}>
      <td colSpan={6} style={{ padding: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <Campo label="Nombre">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ ...estiloInput, width: 200 }}
            />
          </Campo>
          <SelectorBuscable
            items={categorias}
            valor={categoriaId}
            onCambiar={setCategoriaId}
            onCrear={(nombre) => categoriasApi.crear(nombre)}
            onCreado={onCategoriaCreada}
            etiquetaCampo="Categoría"
            etiquetaBotonNuevo="+ nueva"
            placeholderBuscar="Buscar categoría..."
            placeholderNuevo="Nombre de la categoría"
          />
          <Campo label="Precio base">
            <input
              type="number"
              value={precioBase}
              onChange={(e) => setPrecioBase(e.target.value)}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Stock mínimo (opcional)">
            <input
              type="number"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 90 }}
            />
          </Campo>
          <button onClick={guardar} disabled={guardando} style={estiloBotonPrincipal}>
            Guardar cambios
          </button>
          <button onClick={onCerrar} style={estiloBotonSecundario}>
            Cancelar
          </button>
        </div>
        <MensajeError mensaje={error} />
      </td>
    </tr>
  )
}

// --- Formulario: alta de producto nuevo (siempre junto a su primera compra) --
//
// Orden deliberado (ajustado el 20/10/2026 a pedido del dueño): primero lo
// mínimo para identificar el producto (nombre y categoría), después los
// datos del lote que se está comprando ahora mismo —que es lo que
// disparó el alta—, y recién al final el precio de venta y el stock
// mínimo, que son decisiones de catálogo más que de esta compra puntual.

function FormularioProductoNuevo({
  categorias,
  proveedores,
  onCategoriaCreada,
  onProveedorCreado,
  onCerrar,
  onGuardado
}: {
  categorias: { id: number; nombre: string }[]
  proveedores: Proveedor[]
  onCategoriaCreada: () => void
  onProveedorCreado: () => void
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [precioCompra, setPrecioCompra] = useState<number | ''>('')
  const [garantia, setGarantia] = useState<number | ''>('')
  const [factura, setFactura] = useState('')
  const [precioBase, setPrecioBase] = useState<number | ''>('')
  const [stockMinimo, setStockMinimo] = useState<number | ''>('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    if (!nombre.trim() || !categoriaId) {
      setError('Nombre y categoría del producto son obligatorios.')
      return
    }
    if (!proveedorId) {
      setError('Elegí un proveedor para el primer lote.')
      return
    }
    if (cantidad === '' || cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }
    if (precioCompra === '') {
      setError('El precio de compra es obligatorio.')
      return
    }
    if (precioBase === '') {
      setError('El precio de venta (precio base) es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await comprasApi.registrar({
        productoNuevo: {
          nombre: nombre.trim(),
          categoriaId,
          precioBase,
          stockMinimo: stockMinimo === '' ? null : stockMinimo
        },
        proveedorId,
        fecha,
        cantidad,
        precioCompra: Number(precioCompra),
        garantiaProveedor: garantia === '' ? null : garantia,
        factura: factura.trim() || null
      })
      onGuardado()
      onCerrar()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo registrar el producto.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel title="Nuevo producto (con su primer lote de compra)">
      <div
        style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <Campo label="Nombre del producto">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{ ...estiloInput, width: 200 }}
          />
        </Campo>
        <SelectorBuscable
          items={categorias}
          valor={categoriaId}
          onCambiar={setCategoriaId}
          onCrear={(nombre) => categoriasApi.crear(nombre)}
          onCreado={onCategoriaCreada}
          etiquetaCampo="Categoría"
          etiquetaBotonNuevo="+ nueva"
          placeholderBuscar="Buscar categoría..."
          placeholderNuevo="Nombre de la categoría"
        />
      </div>

      <div
        style={{
          borderTop: '1px dashed var(--color-border)',
          margin: 'var(--space-3) 0',
          paddingTop: 'var(--space-3)'
        }}
      >
        <p
          style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 var(--space-2) 0' }}
        >
          Datos del primer lote de compra
        </p>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <SelectorBuscable
            items={proveedores}
            valor={proveedorId}
            onCambiar={setProveedorId}
            onCrear={(nombre) => proveedoresApi.crear(nombre)}
            onCreado={onProveedorCreado}
            etiquetaCampo="Proveedor"
            etiquetaBotonNuevo="+ nuevo"
            placeholderBuscar="Buscar proveedor..."
            placeholderNuevo="Nombre del proveedor"
          />
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="font-data"
              style={estiloInput}
            />
          </Campo>
          <Campo label="Cantidad">
            <input
              type="number"
              min={1}
              value={cantidad}
              placeholder="1"
              onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 70 }}
            />
          </Campo>
          <Campo label="Precio compra (unit.)">
            <input
              type="number"
              value={precioCompra}
              placeholder="0"
              onChange={(e) => setPrecioCompra(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Garantía proveedor (meses)">
            <input
              type="number"
              value={garantia}
              onChange={(e) => setGarantia(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 90 }}
            />
          </Campo>
          <Campo label="N° factura (opcional)">
            <input
              value={factura}
              onChange={(e) => setFactura(e.target.value)}
              style={{ ...estiloInput, width: 120 }}
            />
          </Campo>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px dashed var(--color-border)',
          margin: 'var(--space-3) 0',
          paddingTop: 'var(--space-3)'
        }}
      >
        <p
          style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 var(--space-2) 0' }}
        >
          Precio de venta y stock
        </p>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <Campo label="Precio base (venta)">
            <input
              type="number"
              value={precioBase}
              placeholder="0"
              onChange={(e) => setPrecioBase(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Stock mínimo (opcional)">
            <input
              type="number"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 90 }}
            />
          </Campo>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={guardar} disabled={guardando} style={estiloBotonPrincipal}>
          Guardar producto y lote
        </button>
        <button onClick={onCerrar} style={estiloBotonSecundario}>
          Cancelar
        </button>
      </div>
      <MensajeError mensaje={error} />
    </Panel>
  )
}

// --- Formulario: editar un lote de compra ya registrado ------------------

function FormularioEdicionLote({
  lote,
  proveedores,
  onProveedorCreado,
  onCerrar,
  onGuardado
}: {
  lote: Compra
  proveedores: Proveedor[]
  onProveedorCreado: () => void
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [proveedorId, setProveedorId] = useState<number | ''>(lote.proveedorId)
  const [fecha, setFecha] = useState(lote.fecha)
  const [cantidad, setCantidad] = useState(lote.cantidad)
  const [precioCompra, setPrecioCompra] = useState(lote.precioCompra)
  const [garantia, setGarantia] = useState<number | ''>(lote.garantiaProveedor ?? '')
  const [factura, setFactura] = useState(lote.factura ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    if (!proveedorId) {
      setError('Elegí un proveedor.')
      return
    }
    if (cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await comprasApi.editar(lote.id, {
        proveedorId,
        fecha,
        cantidad,
        precioCompra: Number(precioCompra),
        garantiaProveedor: garantia === '' ? null : garantia,
        factura: factura.trim() || null
      })
      onGuardado()
      onCerrar()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar el lote.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <tr style={{ background: 'var(--color-bg)' }}>
      <td colSpan={7} style={{ padding: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <SelectorBuscable
            items={proveedores}
            valor={proveedorId}
            onCambiar={setProveedorId}
            onCrear={(nombre) => proveedoresApi.crear(nombre)}
            onCreado={onProveedorCreado}
            etiquetaCampo="Proveedor"
            etiquetaBotonNuevo="+ nuevo"
            placeholderBuscar="Buscar proveedor..."
            placeholderNuevo="Nombre del proveedor"
          />
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="font-data"
              style={estiloInput}
            />
          </Campo>
          <Campo label="Cantidad">
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 70 }}
            />
          </Campo>
          <Campo label="Precio compra (unit.)">
            <input
              type="number"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(e.target.value)}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Garantía proveedor (meses)">
            <input
              type="number"
              value={garantia}
              onChange={(e) => setGarantia(e.target.value === '' ? '' : Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 90 }}
            />
          </Campo>
          <Campo label="N° factura (opcional)">
            <input
              value={factura}
              onChange={(e) => setFactura(e.target.value)}
              style={{ ...estiloInput, width: 120 }}
            />
          </Campo>
          <button onClick={guardar} disabled={guardando} style={estiloBotonPrincipal}>
            Guardar cambios
          </button>
          <button onClick={onCerrar} style={estiloBotonSecundario}>
            Cancelar
          </button>
        </div>
        <p
          style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 0 0' }}
        >
          &ldquo;Cantidad&rdquo; es la cantidad total del lote; si ya se vendió parte, el stock
          disponible se ajusta por la diferencia, no se reemplaza.
        </p>
        <MensajeError mensaje={error} />
      </td>
    </tr>
  )
}

// --- Detalle de lotes de un producto (a demanda) -------------------------

function DetalleLotes({
  productoId,
  proveedores,
  onProveedorCreado,
  onCambioStock
}: {
  productoId: number
  proveedores: Proveedor[]
  onProveedorCreado: () => void
  onCambioStock: () => void
}) {
  const [lotes, setLotes] = useState<Compra[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [edicionLoteAbierta, setEdicionLoteAbierta] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    productosApi
      .obtener(productoId)
      .then((p) => !cancelado && setLotes(p.lotes))
      .catch(
        (err) =>
          !cancelado &&
          setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar el detalle.')
      )
    return () => {
      cancelado = true
    }
  }, [productoId, recarga])

  const nombreProveedor = (id: number) => proveedores.find((p) => p.id === id)?.nombre ?? `#${id}`

  if (error) return <MensajeError mensaje={error} />
  if (lotes === null)
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Cargando lotes…</p>

  if (lotes.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
        Sin lotes con stock disponible.
      </p>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
          <th style={{ padding: '4px 8px 4px 0' }}>Proveedor</th>
          <th style={{ padding: 4 }}>Fecha</th>
          <th style={{ padding: 4 }}>Disponible</th>
          <th style={{ padding: 4 }}>Precio compra</th>
          <th style={{ padding: 4 }}>Garantía proveedor (meses)</th>
          <th style={{ padding: 4 }}>Factura</th>
          <th style={{ padding: 4 }} />
        </tr>
      </thead>
      <tbody>
        {lotes.map((lote) => (
          <Fragment key={lote.id}>
            <tr style={{ borderTop: '1px solid var(--color-border)' }}>
              <td style={{ padding: '4px 8px 4px 0' }}>{nombreProveedor(lote.proveedorId)}</td>
              <td className="font-data" style={{ padding: 4 }}>
                {lote.fecha}
              </td>
              <td className="font-data" style={{ padding: 4 }}>
                {lote.cantidadDisponible}
              </td>
              <td className="font-data" style={{ padding: 4 }}>
                {Number(lote.precioCompra).toLocaleString('es-PY')}
              </td>
              <td style={{ padding: 4 }}>
                {lote.garantiaProveedor ? `${lote.garantiaProveedor} meses` : '—'}
              </td>
              <td style={{ padding: 4 }}>{lote.factura ?? '—'}</td>
              <td style={{ padding: 4, textAlign: 'right' }}>
                <button
                  onClick={() =>
                    setEdicionLoteAbierta(edicionLoteAbierta === lote.id ? null : lote.id)
                  }
                  style={{ ...estiloBotonSecundario, padding: '2px 8px', fontSize: 11 }}
                >
                  Editar
                </button>
              </td>
            </tr>
            {edicionLoteAbierta === lote.id && (
              <FormularioEdicionLote
                lote={lote}
                proveedores={proveedores}
                onProveedorCreado={onProveedorCreado}
                onCerrar={() => setEdicionLoteAbierta(null)}
                onGuardado={() => {
                  setRecarga((n) => n + 1)
                  onCambioStock()
                }}
              />
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

// --- Pantalla principal ---------------------------------------------------

// --- Filtro tipo "chip" (checkbox con apariencia de botón) --------------
//
// Reemplaza el <label><input type="checkbox">…</label> suelto que tenían
// "Solo con existencias" y "Solo stock bajo": al no tener ningún borde ni
// fondo, quedaban visualmente más débiles que los demás campos del filtro
// (que sí tienen etiqueta + recuadro) y costaba notar, de un vistazo,
// cuáles estaban activos. Acá el estado "activo" se ve en el propio chip
// (borde y fondo con el color de acento), no solo en el tilde del
// checkbox. `colorActivo` deja usar el color de alerta para "Solo stock
// bajo", coherente con el badge rojo que ya se usa en la tabla para lo
// mismo.
function FiltroToggle({
  checked,
  onChange,
  children,
  colorActivo = 'accent'
}: {
  checked: boolean
  onChange: (valor: boolean) => void
  children: React.ReactNode
  colorActivo?: 'accent' | 'alert'
}): React.JSX.Element {
  const color = colorActivo === 'alert' ? 'var(--color-alert)' : 'var(--color-accent)'
  const fondo =
    colorActivo === 'alert'
      ? 'var(--color-alert-bg)'
      : 'rgba(227, 139, 41, 0.12)' /* tinte de --color-accent */

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        padding: '0 10px',
        height: 31 /* misma altura que los <input>/<select> de al lado (padding 4 + borde 1 x2 + línea de texto) */,
        borderRadius: 'var(--radius)',
        border: `1px solid ${checked ? color : 'var(--color-border)'}`,
        background: checked ? fondo : 'var(--color-surface)',
        color: checked ? color : 'var(--color-text)',
        fontWeight: checked ? 600 : 400,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap'
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: color }}
      />
      {children}
    </label>
  )
}

// Cantidad fija de productos por página (paginación procesada en el
// backend, ver routes/productos.ts). Si en algún momento se quiere dejar
// que el usuario la cambie, alcanza con convertir esto en un estado más.
const PRODUCTOS_POR_PAGINA = 20

export function StockScreen() {
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [q, setQ] = useState('')
  const [soloConStock, setSoloConStock] = useState(false)
  const [verStockBajo, setVerStockBajo] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [formularioCompraAbierto, setFormularioCompraAbierto] = useState<number | null>(null)
  const [edicionAbierta, setEdicionAbierta] = useState<number | null>(null)
  const [altaAbierta, setAltaAbierta] = useState(false)

  const categorias = useCategorias()
  const proveedores = useProveedores()
  // "Solo stock bajo" es un filtro más del mismo listado paginado (ver
  // soloStockBajo en FiltrosProductos), no un endpoint aparte: corrección
  // del 20/10/2026 — antes usaba GET /productos/stock-bajo, que no conocía
  // la categoría, la búsqueda ni "solo con existencias" ya elegidos, así que
  // activarlo descartaba en silencio los demás filtros en vez de
  // combinarse con ellos.
  const listado = useProductos({
    categoriaId: categoriaId || undefined,
    q: q || undefined,
    soloConStock,
    soloStockBajo: verStockBajo,
    pagina,
    porPagina: PRODUCTOS_POR_PAGINA
  })

  // Si cambia algún filtro, hay que volver a la página 1: de lo contrario
  // se podría quedar "parado" en una página que ya no existe para el nuevo
  // filtro (ej. estar en la página 4 y filtrar a una categoría con 1 sola
  // página de resultados). Se resetea en cada manejador de filtro (ver más
  // abajo), no con un useEffect: hacer setState síncrono dentro de un
  // efecto dispara una re-renderización en cascada (regla de lint
  // react-hooks/set-state-in-effect) — mismo criterio ya aplicado en
  // api/hooks.ts para `cargando`.
  const cambiarQ = (nuevoQ: string): void => {
    setQ(nuevoQ)
    setPagina(1)
  }
  const cambiarCategoriaId = (nuevoId: number | ''): void => {
    setCategoriaId(nuevoId)
    setPagina(1)
  }
  const cambiarSoloConStock = (valor: boolean): void => {
    setSoloConStock(valor)
    setPagina(1)
  }
  const cambiarVerStockBajo = (valor: boolean): void => {
    setVerStockBajo(valor)
    setPagina(1)
  }

  const productos = listado.datos.items
  const cargando = listado.cargando
  const errorListado = listado.error
  const totalPaginas = Math.max(1, Math.ceil(listado.datos.total / PRODUCTOS_POR_PAGINA))

  const refrescarListado = () => {
    listado.refrescar()
  }

  const nombreCategoria = (id: number) => categorias.datos.find((c) => c.id === id)?.nombre ?? '—'

  const hayFiltrosActivos = q !== '' || categoriaId !== '' || soloConStock || verStockBajo
  const limpiarFiltros = () => {
    setQ('')
    setCategoriaId('')
    setSoloConStock(false)
    setVerStockBajo(false)
    setPagina(1)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Control de stock</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            El stock de cada producto es la suma de sus lotes de compra. Desplegá un producto para
            ver el detalle por proveedor y garantía.
          </p>
        </div>

        {/* Acciones de la pantalla (no son filtros): separadas del panel de
            abajo para que la barra de filtros no quede mezclada con ellas. */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          <a
            href={urlPdfListadoStock()}
            target="_blank"
            rel="noreferrer"
            style={{ ...estiloBotonSecundario, textDecoration: 'none' }}
          >
            Descargar listado (PDF)
          </a>
          {/* El botón mantiene siempre el mismo texto y sigue funcionando
              como toggle (un segundo clic cierra el formulario): el cierre
              explícito ya lo resuelve el "Cancelar" propio del formulario,
              más abajo. Es el mismo patrón que ya usan "Editar" y
              "+ Registrar compra" en cada fila, que tampoco cambian de
              texto al abrirse. Antes este botón se renombraba a
              "Cancelar" al abrir el formulario, duplicando el botón
              "Cancelar" que el formulario ya tiene en su parte inferior. */}
          <button onClick={() => setAltaAbierta((v) => !v)} style={estiloBotonPrincipal}>
            + Nuevo producto
          </button>
        </div>
      </div>

      <Panel>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <Campo label="Buscar por nombre">
            <input
              value={q}
              onChange={(e) => cambiarQ(e.target.value)}
              placeholder="Ej: filtro, batería..."
              style={{ ...estiloInput, width: 180, height: 31, boxSizing: 'border-box' }}
            />
          </Campo>
          <Campo label="Categoría">
            <select
              value={categoriaId}
              onChange={(e) =>
                cambiarCategoriaId(e.target.value === '' ? '' : Number(e.target.value))
              }
              style={{ ...estiloInput, height: 31, boxSizing: 'border-box' }}
            >
              <option value="">Todas</option>
              {categorias.datos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          {/* Separador vertical: marca visualmente que lo que sigue son
              "modos de vista" sobre el listado, distinto de buscar/filtrar
              por un criterio puntual. */}
          <div
            aria-hidden
            style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border)' }}
          />

          {/* Mismo truco que en Campo: una etiqueta invisible mantiene la
              altura alineada con "Buscar por nombre" y "Categoría", que sí
              tienen una etiqueta visible arriba. */}
          <Campo label={'\u00A0'}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <FiltroToggle checked={soloConStock} onChange={cambiarSoloConStock}>
                Solo con existencias
              </FiltroToggle>
              <FiltroToggle
                checked={verStockBajo}
                onChange={cambiarVerStockBajo}
                colorActivo="alert"
              >
                Solo stock bajo
              </FiltroToggle>
            </div>
          </Campo>

          {hayFiltrosActivos && (
            <Campo label={'\u00A0'}>
              <button
                onClick={limpiarFiltros}
                style={{ ...estiloBotonSecundario, height: 31, padding: '0 10px', fontSize: 12 }}
              >
                Limpiar filtros
              </button>
            </Campo>
          )}
        </div>

        {errorListado && <MensajeError mensaje={errorListado} />}
      </Panel>

      {altaAbierta && (
        <FormularioProductoNuevo
          categorias={categorias.datos}
          proveedores={proveedores.datos}
          onCategoriaCreada={categorias.refrescar}
          onProveedorCreado={proveedores.refrescar}
          onCerrar={() => setAltaAbierta(false)}
          onGuardado={refrescarListado}
        />
      )}

      <Panel>
        {cargando ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando productos…</p>
        ) : productos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            No hay productos que coincidan con el filtro.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <th style={{ paddingBottom: 8 }} />
                <th style={{ paddingBottom: 8 }}>Producto</th>
                <th style={{ paddingBottom: 8 }}>Categoría</th>
                <th style={{ paddingBottom: 8 }}>Precio base</th>
                <th style={{ paddingBottom: 8 }}>Stock total</th>
                <th style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const bajoMinimo = p.stockMinimo != null && p.stock <= p.stockMinimo
                const abierto = expandido === p.id

                return (
                  <Fragment key={p.id}>
                    <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 8, width: 24 }}>
                        <button
                          onClick={() => setExpandido(abierto ? null : p.id)}
                          style={{ border: 'none', background: 'none', fontSize: 14 }}
                          aria-label="Ver lotes"
                        >
                          {abierto ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={{ padding: 8 }}>{p.nombre}</td>
                      <td style={{ padding: 8, color: 'var(--color-text-muted)' }}>
                        {nombreCategoria(p.categoriaId)}
                      </td>
                      <td className="font-data" style={{ padding: 8 }}>
                        {Number(p.precioBase).toLocaleString('es-PY')}
                      </td>
                      <td className="font-data" style={{ padding: 8 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: bajoMinimo ? 'var(--color-alert)' : 'var(--color-text)'
                          }}
                        >
                          {p.stock}
                        </span>
                        {p.stockMinimo != null && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              color: 'var(--color-text-muted)'
                            }}
                          >
                            / mín. {p.stockMinimo}
                          </span>
                        )}
                        {bajoMinimo && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius)',
                              background: 'var(--color-alert-bg)',
                              color: 'var(--color-alert)'
                            }}
                          >
                            Stock bajo
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setEdicionAbierta(edicionAbierta === p.id ? null : p.id)}
                            style={{ ...estiloBotonSecundario, padding: '4px 10px', fontSize: 12 }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              setFormularioCompraAbierto(
                                formularioCompraAbierto === p.id ? null : p.id
                              )
                            }
                            style={{ ...estiloBotonSecundario, padding: '4px 10px', fontSize: 12 }}
                          >
                            + Registrar compra
                          </button>
                        </div>
                      </td>
                    </tr>

                    {edicionAbierta === p.id && (
                      <FormularioEdicion
                        producto={p}
                        categorias={categorias.datos}
                        onCategoriaCreada={categorias.refrescar}
                        onCerrar={() => setEdicionAbierta(null)}
                        onGuardado={refrescarListado}
                      />
                    )}

                    {formularioCompraAbierto === p.id && (
                      <FormularioCompra
                        productoId={p.id}
                        proveedores={proveedores.datos}
                        onProveedorCreado={proveedores.refrescar}
                        onCerrar={() => setFormularioCompraAbierto(null)}
                        onGuardado={refrescarListado}
                      />
                    )}

                    {abierto && (
                      <tr>
                        <td colSpan={6} style={{ padding: '0 8px 12px 32px' }}>
                          <DetalleLotes
                            productoId={p.id}
                            proveedores={proveedores.datos}
                            onProveedorCreado={proveedores.refrescar}
                            onCambioStock={refrescarListado}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Paginación: aplica siempre, "Solo stock bajo" incluido — ahora es
            un filtro más sobre el mismo endpoint paginado (ver más arriba),
            no un listado aparte sin paginar. */}
        {!cargando && !errorListado && productos.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border)'
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Página {listado.datos.pagina} de {totalPaginas} — {listado.datos.total} producto
              {listado.datos.total === 1 ? '' : 's'} en total
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                style={{ ...estiloBotonSecundario, opacity: pagina <= 1 ? 0.5 : 1 }}
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                style={{ ...estiloBotonSecundario, opacity: pagina >= totalPaginas ? 0.5 : 1 }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
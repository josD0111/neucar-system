// src/renderer/src/components/FormularioItemEdicion.tsx
//
// Franja B del nuevo flujo de Ventas (ver docs/03-gestion-proyecto/
// plan-tecnico-pantalla-ventas.md, Etapa 2, y el prototipo HTML de
// referencia): edita el producto que se acaba de elegir en A1, o la fila de
// la Franja C que se haya clickeado (mismo panel sirve para ambos casos —
// `itemEnEdicion` distingue uno de otro). Agrega/actualiza una línea en el
// detalle de la venta; NO llama a ningún endpoint de Ventas — eso es
// responsabilidad de quien ensamble la pantalla (Etapa 3).
//
// Reglas de negocio que replica, sin alterarlas (ver desiciones-alcance.md,
// sección 7.3, y entidades-dominio.md, sección 14):
//  - Selección de lote MANUAL (no PEPS/FIFO): el Administrador elige de qué
//    Compra sale el ítem, viendo `cantidadDisponible` y `garantiaProveedor`
//    de cada lote.
//  - Stock insuficiente en el lote elegido BLOQUEA el agregado (HU-20): no
//    es una advertencia, el botón queda deshabilitado.
//  - Rol Empleado (HU-17, calculadora): sin lote, sin garantía, sin precio
//    editable — solo cantidad, a precio base. Mismo criterio que el
//    `esAdmin` ya usado en la versión vieja de VentaScreen.tsx.
//
// Carga los lotes del producto por su cuenta (GET /api/productos/:id) al
// cambiar `producto`, igual que BuscadorProductos pide sus propios datos:
// mantiene el componente autónomo y testeable en aislamiento.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { productosApi } from '../api/productos'
import { proveedoresApi } from '../api/proveedores'
import type { Compra, Producto, Proveedor } from '../api/types'
import { gs, posicionTrasNDigitos } from './formatoMoneda'

// Mismo criterio de formato que CobroCredito.tsx / VentasScreen.tsx /
// HistorialServiciosScreen.tsx: fecha corta dd/mm/aaaa, para el texto de
// cada lote de compra en el selector.
function formatearFechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export interface ItemEdicion {
  // Presente solo si se está editando una fila ya agregada al detalle
  // (Franja C) — null si viene de seleccionar un producto nuevo en A1.
  idLinea: number | null
  producto: Producto
  compraId: number | ''
  cantidad: number
  precioUnitario: number | ''
  garantiaOfrecida: number | ''
}

interface FormularioItemEdicionProps {
  // El producto a configurar: viene de A1 (línea nueva) o de hacer clic en
  // una fila de C (edición). `null` = panel vacío, a la espera.
  itemEnEdicion: ItemEdicion | null
  esAdmin: boolean
  // `loteTexto`: mismo texto que se ve en el selector de Lote (`#id - (fecha)
  // - proveedor`), ya resuelto acá (este componente es el que tiene los
  // lotes y los proveedores cargados) — se arma una sola vez al confirmar,
  // para que la Franja C lo muestre igual sin tener que recalcularlo.
  onConfirmar: (item: ItemEdicion, loteTexto: string | null) => void
  onCancelarEdicion: () => void
}

export function FormularioItemEdicion({
  itemEnEdicion,
  esAdmin,
  onConfirmar,
  onCancelarEdicion
}: FormularioItemEdicionProps): React.JSX.Element {
  const [lotes, setLotes] = useState<Compra[]>([])
  const [cargandoLotes, setCargandoLotes] = useState(false)

  // Proveedores, para mostrar su nombre en el selector de lote (en vez de
  // solo el proveedorId). Se cargan una sola vez: la lista de proveedores
  // del taller es chica y cambia poco, no hace falta recargarla por cada
  // producto elegido.
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  useEffect(() => {
    let cancelado = false
    proveedoresApi.listar().then((lista) => {
      if (!cancelado) setProveedores(lista)
    })
    return () => {
      cancelado = true
    }
  }, [])
  const nombreProveedor = useMemo(() => {
    const mapa = new Map(proveedores.map((p) => [p.id, p.nombre]))
    return (proveedorId: number): string => mapa.get(proveedorId) ?? `Proveedor #${proveedorId}`
  }, [proveedores])

  // Estado editable del formulario, sincronizado con `itemEnEdicion` cada
  // vez que cambia (nuevo producto elegido, o se entra a editar otra fila).
  const [compraId, setCompraId] = useState<number | ''>('')
  const [cantidad, setCantidad] = useState<number>(1)
  const [precioUnitario, setPrecioUnitario] = useState<number | ''>('')
  const [garantiaOfrecida, setGarantiaOfrecida] = useState<number | ''>('')

  // Refs para el flujo de navegación con Enter: cantidad -> precio unit. ->
  // garantía -> agregar (o, si el producto tiene varios lotes y ninguno fue
  // elegido todavía, al selector de lote en su lugar).
  const refCantidad = useRef<HTMLInputElement>(null)
  const refPrecio = useRef<HTMLInputElement>(null)
  const refGarantia = useRef<HTMLInputElement>(null)
  const refLote = useRef<HTMLSelectElement>(null)

  // Foco (y, si corresponde, selección) de Cantidad.
  const enfocarCantidad = (): void => {
    refCantidad.current?.focus()
    refCantidad.current?.select()
  }

  // Foco en el selector de Lote, intentando además abrir su desplegable
  // nativo (Chromium/Electron soporta `showPicker()`). Si el navegador no lo
  // soporta, o lo bloquea por no venir de un gesto directo del usuario, el
  // foco solo ya alcanza para que Tab/flechas/Enter lo abran igual.
  const enfocarYAbrirLote = (): void => {
    const select = refLote.current
    if (!select) return
    select.focus()
    try {
      ;(select as HTMLSelectElement & { showPicker?: () => void }).showPicker?.()
    } catch {
      // Ignorado: ver comentario arriba.
    }
  }

  useEffect(() => {
    if (!itemEnEdicion) {
      // Panel vacío (recién se agregó/actualizó un ítem, o se canceló la
      // edición): limpiar también los campos editables, para que no quede
      // "pegado" lo último cargado (cantidad, precio, garantía) a la vista
      // aunque estén deshabilitados.
      setLotes([])
      setCompraId('')
      setCantidad(1)
      setPrecioUnitario('')
      setGarantiaOfrecida('')
      return
    }
    setCompraId(itemEnEdicion.compraId)
    setCantidad(itemEnEdicion.cantidad)
    setPrecioUnitario(itemEnEdicion.precioUnitario)
    setGarantiaOfrecida(itemEnEdicion.garantiaOfrecida)

    // Solo un producto recién elegido en A1 (todavía sin lote asignado)
    // dispara la selección/foco automático de lote. Si se está editando una
    // fila ya agregada (viene de la Franja C), el lote ya quedó elegido
    // antes y no hay que tocarlo ni redirigir el foco.
    const esProductoNuevo = itemEnEdicion.idLinea === null

    if (!esAdmin) {
      // El Empleado no ve lotes: foco directo a Cantidad.
      if (esProductoNuevo) window.setTimeout(enfocarCantidad, 0)
      return
    }

    let cancelado = false
    setCargandoLotes(true)
    productosApi
      .obtener(itemEnEdicion.producto.id)
      .then((p) => {
        if (cancelado) return
        const disponibles = p.lotes.filter((l) => l.cantidadDisponible > 0)
        setLotes(disponibles)

        if (!esProductoNuevo) return // editando fila existente: no se toca el lote ni el foco

        if (disponibles.length === 1) {
          // Único lote posible: se autoselecciona y se sigue directo a Cantidad.
          setCompraId(disponibles[0].id)
          window.setTimeout(enfocarCantidad, 0)
        } else if (disponibles.length > 1) {
          // Varios lotes posibles: no hay autoselección (selección manual,
          // no PEPS/FIFO) — se lleva el foco al selector para elegir ahí.
          window.setTimeout(enfocarYAbrirLote, 0)
        } else {
          // Sin lotes disponibles: no hay nada para elegir, foco a Cantidad.
          window.setTimeout(enfocarCantidad, 0)
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoLotes(false)
      })
    return () => {
      cancelado = true
    }
  }, [itemEnEdicion, esAdmin])

  const loteElegido = lotes.find((l) => l.id === compraId) ?? null

  const stockInsuficiente =
    esAdmin && loteElegido !== null && cantidad > loteElegido.cantidadDisponible

  // Cuando el producto tiene más de un lote posible y todavía no se eligió
  // ninguno, no alcanza con cantidad/precio/garantía: hace falta que el
  // Administrador elija el lote de forma manual (no hay PEPS/FIFO).
  const requiereElegirLote = esAdmin && compraId === '' && lotes.length > 1

  const puedeConfirmar =
    itemEnEdicion !== null &&
    cantidad > 0 &&
    (esAdmin
      ? compraId !== '' && !stockInsuficiente && precioUnitario !== '' && precioUnitario >= 0
      : true)

  const confirmar = (e?: FormEvent): void => {
    e?.preventDefault()
    if (!itemEnEdicion) return
    // Si falta elegir lote entre varios disponibles, en vez de bloquear en
    // silencio se lleva el foco al selector para que el usuario lo resuelva.
    if (requiereElegirLote) {
      refLote.current?.focus()
      return
    }
    if (!puedeConfirmar) return
    const loteTexto =
      esAdmin && loteElegido
        ? `#${loteElegido.id} - (${formatearFechaCorta(loteElegido.fecha)}) - ${nombreProveedor(loteElegido.proveedorId)}`
        : null
    onConfirmar(
      {
        ...itemEnEdicion,
        compraId,
        cantidad,
        precioUnitario,
        garantiaOfrecida
      },
      loteTexto
    )
  }

  // Enter en Cantidad -> Precio unit. (Administrador) o agrega directo
  // (Empleado, que no tiene precio/garantía editables).
  const onEnterCantidad = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (esAdmin) refPrecio.current?.focus()
    else confirmar()
  }

  const cambiarPrecio = (e: ChangeEvent<HTMLInputElement>): void => {
    const input = e.target
    const cursorPrevio = input.selectionStart ?? input.value.length
    const digitosAntesDelCursor = input.value.slice(0, cursorPrevio).replace(/\D/g, '').length

    const soloDigitos = input.value.replace(/\D/g, '')
    const nuevoPrecio = soloDigitos === '' ? '' : Number(soloDigitos)
    setPrecioUnitario(nuevoPrecio)

    const nuevoFormateado = nuevoPrecio === '' ? '' : gs(nuevoPrecio)
    const nuevaPosicion = posicionTrasNDigitos(nuevoFormateado, digitosAntesDelCursor)
    requestAnimationFrame(() => {
      refPrecio.current?.setSelectionRange(nuevaPosicion, nuevaPosicion)
    })
  }

  const valorPrecio = esAdmin
    ? precioUnitario === ''
      ? ''
      : gs(precioUnitario)
    : itemEnEdicion
      ? `Gs. ${gs(itemEnEdicion.producto.precioBase)}`
      : ''

  // Enter en Precio unit. -> Garantía ofrecida.
  const onEnterPrecio = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    refGarantia.current?.focus()
  }

  // Enter en Garantía ofrecida -> agrega el ítem (o, si falta elegir lote
  // entre varios, lleva el foco al selector de lote).
  const onEnterGarantia = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    confirmar()
  }

  const vacio = itemEnEdicion === null

  return (
    <form
      onSubmit={confirmar}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)'
      }}
    >
      {/* Fila 1: identificación del producto y del lote de origen (solo
          lectura de garantía de proveedor / cantidad disponible, como
          referencia para elegir el lote — no son editables acá). */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: esAdmin ? '2fr 3fr 130px 150px' : '1fr',
          gap: 'var(--space-1)',
          alignItems: 'end'
        }}
      >
        <Campo label="Producto / repuesto">
          <input
            readOnly
            value={vacio ? 'Elegí un producto en el buscador...' : itemEnEdicion.producto.nombre}
            style={estiloReadOnly}
          />
        </Campo>

        {esAdmin && (
          <Campo label="Lote de compra">
            <select
              ref={refLote}
              value={compraId}
              disabled={vacio || cargandoLotes}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : ''
                setCompraId(id)
                // El precio sugerido pasa a ser el precio base del producto;
                // el Administrador puede editarlo igual (HU-18).
                if (id !== '' && precioUnitario === '') {
                  setPrecioUnitario(Number(itemEnEdicion?.producto.precioBase ?? 0))
                }
                // Lote ya elegido (manual o único) -> seguir directo a Cantidad.
                if (id !== '') window.setTimeout(enfocarCantidad, 0)
              }}
              style={{
                ...estiloInput,
                border: requiereElegirLote ? '1px solid var(--color-alert)' : estiloInput.border
              }}
            >
              <option value="">{cargandoLotes ? 'Cargando...' : '-- Elegir lote --'}</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.id} - ({formatearFechaCorta(l.fecha)}) - {nombreProveedor(l.proveedorId)}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {esAdmin && (
          <Campo label="Garantía proveedor">
            <input
              readOnly
              value={
                loteElegido
                  ? loteElegido.garantiaProveedor != null
                    ? `${loteElegido.garantiaProveedor} m`
                    : 'Sin garantía'
                  : '—'
              }
              style={{ ...estiloReadOnly, textAlign: 'center' }}
            />
          </Campo>
        )}

        {esAdmin && (
          <Campo label="Cant. disponible">
            <input
              readOnly
              value={loteElegido ? loteElegido.cantidadDisponible : '—'}
              style={{ ...estiloReadOnly, textAlign: 'center' }}
            />
          </Campo>
        )}
      </div>

      {/* Fila 2: lo que el Administrador (o el Empleado, en modo
          calculadora) completa para agregar la línea al detalle. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: esAdmin ? '110px 140px 140px 150px' : '110px 140px 150px',
          gap: 'var(--space-1)',
          alignItems: 'end'
        }}
      >
        <Campo label="Cant.">
          <input
            ref={refCantidad}
            type="number"
            min={1}
            disabled={vacio}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            onKeyDown={onEnterCantidad}
            style={{ ...estiloInput, textAlign: 'center' }}
          />
        </Campo>

        <Campo label="Precio unit. (Gs.)">
          <input
            ref={refPrecio}
            type="text"
            inputMode="numeric"
            disabled={vacio || !esAdmin}
            value={valorPrecio}
            onChange={cambiarPrecio}
            onKeyDown={onEnterPrecio}
            placeholder={esAdmin ? '0' : undefined}
            style={{ ...estiloInput, textAlign: 'right' }}
          />
        </Campo>

        {esAdmin && (
          <Campo label="Garantía (meses)">
            <input
              ref={refGarantia}
              type="number"
              min={0}
              disabled={vacio}
              value={garantiaOfrecida}
              onChange={(e) =>
                setGarantiaOfrecida(e.target.value === '' ? '' : Number(e.target.value))
              }
              onKeyDown={onEnterGarantia}
              style={estiloInput}
            />
          </Campo>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" disabled={!puedeConfirmar} style={estiloBotonPrimario}>
            {itemEnEdicion?.idLinea != null ? 'Actualizar' : 'Agregar'}
          </button>
          {itemEnEdicion?.idLinea != null && (
            <button
              type="button"
              onClick={onCancelarEdicion}
              style={estiloBotonSecundario}
              title="Cancelar edición"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {requiereElegirLote && (
        <div style={{ fontSize: 12, color: 'var(--color-alert)' }}>
          Este producto tiene varios lotes disponibles: elegí de cuál sale antes de agregarlo.
        </div>
      )}

      {!requiereElegirLote && stockInsuficiente && (
        <div style={{ fontSize: 12, color: 'var(--color-alert)' }}>
          La cantidad supera el stock disponible del lote ({loteElegido?.cantidadDisponible}). No se
          puede agregar.
        </div>
      )}
    </form>
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
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 1
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
  padding: '5px 7px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  fontSize: 13
}

const estiloReadOnly: React.CSSProperties = {
  ...estiloInput,
  background: 'var(--color-bg)',
  color: 'var(--color-text-muted)'
}

const estiloBotonPrimario: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 'var(--radius)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const estiloBotonSecundario: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  cursor: 'pointer'
}

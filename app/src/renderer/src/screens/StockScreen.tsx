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

import { Fragment, useEffect, useState } from 'react'
import { useCategorias, useProductos, useProveedores, useStockBajo } from '../api/hooks'
import { categoriasApi } from '../api/categorias'
import { proveedoresApi } from '../api/proveedores'
import { productosApi } from '../api/productos'
import { comprasApi } from '../api/compras'
import { urlPdfListadoStock, ApiClientError } from '../api/client'
import type { Categoria, Compra, Proveedor, Producto } from '../api/types'

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

// --- Selector de categoría con alta rápida ------------------------------

function SelectorCategoria({
  categorias,
  valor,
  onCambiar,
  onCategoriaCreada
}: {
  categorias: Categoria[]
  valor: number | ''
  onCambiar: (id: number) => void
  onCategoriaCreada: () => void
}) {
  const [alta, setAlta] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crear = async () => {
    if (!nombreNuevo.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const creada = await categoriasApi.crear(nombreNuevo.trim())
      onCategoriaCreada()
      onCambiar(creada.id)
      setNombreNuevo('')
      setAlta(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear la categoría.')
    } finally {
      setGuardando(false)
    }
  }

  if (alta) {
    return (
      <Campo label="Categoría nueva">
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre de la categoría"
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
    <Campo label="Categoría">
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={valor}
          onChange={(e) => onCambiar(Number(e.target.value))}
          style={estiloInput}
        >
          <option value="" disabled>
            Elegir...
          </option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAlta(true)}
          style={estiloBotonSecundario}
          title="Nueva categoría"
        >
          + nueva
        </button>
      </div>
    </Campo>
  )
}

// --- Selector de proveedor con alta rápida ------------------------------

function SelectorProveedor({
  proveedores,
  valor,
  onCambiar,
  onProveedorCreado
}: {
  proveedores: Proveedor[]
  valor: number | ''
  onCambiar: (id: number) => void
  onProveedorCreado: () => void
}) {
  const [alta, setAlta] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crear = async () => {
    if (!nombreNuevo.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const creado = await proveedoresApi.crear(nombreNuevo.trim())
      onProveedorCreado()
      onCambiar(creado.id)
      setNombreNuevo('')
      setAlta(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear el proveedor.')
    } finally {
      setGuardando(false)
    }
  }

  if (alta) {
    return (
      <Campo label="Proveedor nuevo">
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre del proveedor"
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
    <Campo label="Proveedor">
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={valor}
          onChange={(e) => onCambiar(Number(e.target.value))}
          style={estiloInput}
        >
          <option value="" disabled>
            Elegir...
          </option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAlta(true)}
          style={estiloBotonSecundario}
          title="Nuevo proveedor"
        >
          + nuevo
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
  const [cantidad, setCantidad] = useState(1)
  const [precioCompra, setPrecioCompra] = useState(0)
  const [garantia, setGarantia] = useState<number | ''>('')
  const [factura, setFactura] = useState('')
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
      await comprasApi.registrar({
        productoId,
        proveedorId,
        fecha,
        cantidad,
        precioCompra,
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
          <SelectorProveedor
            proveedores={proveedores}
            valor={proveedorId}
            onCambiar={setProveedorId}
            onProveedorCreado={onProveedorCreado}
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
              onChange={(e) => setPrecioCompra(Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Garantía proveedor (días/meses)">
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
  categorias: Categoria[]
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
          <SelectorCategoria
            categorias={categorias}
            valor={categoriaId}
            onCambiar={setCategoriaId}
            onCategoriaCreada={onCategoriaCreada}
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

function FormularioProductoNuevo({
  categorias,
  proveedores,
  onCategoriaCreada,
  onProveedorCreado,
  onCerrar,
  onGuardado
}: {
  categorias: Categoria[]
  proveedores: Proveedor[]
  onCategoriaCreada: () => void
  onProveedorCreado: () => void
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [precioBase, setPrecioBase] = useState(0)
  const [stockMinimo, setStockMinimo] = useState<number | ''>('')
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [cantidad, setCantidad] = useState(1)
  const [precioCompra, setPrecioCompra] = useState(0)
  const [garantia, setGarantia] = useState<number | ''>('')
  const [factura, setFactura] = useState('')
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
    if (cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0.')
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
        precioCompra,
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
        <SelectorCategoria
          categorias={categorias}
          valor={categoriaId}
          onCambiar={setCategoriaId}
          onCategoriaCreada={onCategoriaCreada}
        />
        <Campo label="Precio base (venta)">
          <input
            type="number"
            value={precioBase}
            onChange={(e) => setPrecioBase(Number(e.target.value))}
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
          <SelectorProveedor
            proveedores={proveedores}
            valor={proveedorId}
            onCambiar={setProveedorId}
            onProveedorCreado={onProveedorCreado}
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
              onChange={(e) => setPrecioCompra(Number(e.target.value))}
              className="font-data"
              style={{ ...estiloInput, width: 110 }}
            />
          </Campo>
          <Campo label="Garantía proveedor">
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

// --- Detalle de lotes de un producto (a demanda) -------------------------

function DetalleLotes({
  productoId,
  proveedores
}: {
  productoId: number
  proveedores: Proveedor[]
}) {
  const [lotes, setLotes] = useState<Compra[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  }, [productoId])

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
          <th style={{ padding: 4 }}>Garantía proveedor</th>
          <th style={{ padding: 4 }}>Factura</th>
        </tr>
      </thead>
      <tbody>
        {lotes.map((lote) => (
          <tr key={lote.id} style={{ borderTop: '1px solid var(--color-border)' }}>
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
              {lote.garantiaProveedor ? `${lote.garantiaProveedor}` : '—'}
            </td>
            <td style={{ padding: 4 }}>{lote.factura ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// --- Pantalla principal ---------------------------------------------------

export function StockScreen() {
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [q, setQ] = useState('')
  const [soloConStock, setSoloConStock] = useState(false)
  const [verStockBajo, setVerStockBajo] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [formularioCompraAbierto, setFormularioCompraAbierto] = useState<number | null>(null)
  const [edicionAbierta, setEdicionAbierta] = useState<number | null>(null)
  const [altaAbierta, setAltaAbierta] = useState(false)

  const categorias = useCategorias()
  const proveedores = useProveedores()
  const listado = useProductos({
    categoriaId: categoriaId || undefined,
    q: q || undefined,
    soloConStock
  })
  const stockBajo = useStockBajo()

  const productos = verStockBajo ? stockBajo.datos : listado.datos
  const cargando = verStockBajo ? stockBajo.cargando : listado.cargando
  const errorListado = verStockBajo ? stockBajo.error : listado.error

  const refrescarListado = () => {
    listado.refrescar()
    stockBajo.refrescar()
  }

  const nombreCategoria = (id: number) => categorias.datos.find((c) => c.id === id)?.nombre ?? '—'

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Control de stock</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        El stock de cada producto es la suma de sus lotes de compra. Desplegá un producto para ver
        el detalle por proveedor y garantía.
      </p>

      <Panel>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-3)'
          }}
        >
          <Campo label="Buscar por nombre">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: filtro, batería..."
              style={{ ...estiloInput, width: 180 }}
            />
          </Campo>
          <Campo label="Categoría">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value === '' ? '' : Number(e.target.value))}
              style={estiloInput}
            >
              <option value="">Todas</option>
              {categorias.datos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(e) => setSoloConStock(e.target.checked)}
            />
            Solo con existencias
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={verStockBajo}
              onChange={(e) => setVerStockBajo(e.target.checked)}
            />
            Solo stock bajo
          </label>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
            <a
              href={urlPdfListadoStock()}
              target="_blank"
              rel="noreferrer"
              style={{ ...estiloBotonSecundario, textDecoration: 'none' }}
            >
              Descargar listado (PDF)
            </a>
            <button onClick={() => setAltaAbierta((v) => !v)} style={estiloBotonPrincipal}>
              {altaAbierta ? 'Cancelar' : '+ Nuevo producto'}
            </button>
          </div>
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
                            Stock bajo (mín. {p.stockMinimo})
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
                          <DetalleLotes productoId={p.id} proveedores={proveedores.datos} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
// src/main/api/routes/compras.ts
//
// Registro de Compras (HU-16). Cada Compra crea un lote de stock y suma al
// stock agregado del Producto (ver entidades-dominio.md, sección 14).
//
// Decisión del 15/10/2026: este es el único punto de entrada para dar de
// alta un Producto nuevo. El formulario de Compra admite producto existente
// (productoId) o producto nuevo (productoNuevo); si es nuevo, el Producto y
// su primer lote se crean en la misma operación, dentro de una transacción.
//
// Corrección del 19/10/2026: se agregó PATCH /:id para corregir un lote mal
// cargado (error de tipeo en proveedor, fecha, cantidad, precio, garantía o
// factura). `garantiaProveedor` se expresa en MESES (quedaba "a definir" en
// el comentario original de schema.ts; se confirmó con el equipo). Si viene
// `cantidad`, se recalcula `cantidadDisponible` y el `stock` agregado del
// producto por la diferencia, en la misma transacción — ver
// entidades-dominio.md, sección 14. Como Ventas todavía no existe (Sprint 2),
// hoy `cantidadDisponible` siempre es igual a `cantidad`, así que esto no
// puede resultar en un valor negativo en la práctica; igual se valida por
// si se edita un lote que ya tuvo alguna salida de stock en el futuro.
//
// Agregado el 20/10/2026: DELETE /:id, para corregir un lote cargado con el
// producto equivocado (no alcanza con "editar": el producto de un lote no es
// un campo editable, ver PATCH más arriba — cambiarlo a mano dejaría el
// stock del producto viejo y del nuevo desincronizados). Se descuenta del
// Producto la `cantidadDisponible` del lote (no la `cantidad` original): son
// iguales hoy porque Ventas no existe todavía, pero `cantidadDisponible` es
// la que efectivamente integra el `stock` agregado (ver entidades-dominio.md,
// sección 14, y el comentario de `stock` en schema.ts). Si en Sprint 2 ya
// hay Ítems de Venta que referencian este lote (`compra_id`), el borrado
// debe rechazarse en vez de dejar ventas "huérfanas" sin su lote de origen;
// se resuelve igual que en categorias.ts: se intenta el DELETE y se detecta
// la violación de clave foránea (23503) en vez de consultar antes "¿tiene
// ventas asociadas?" (evita una condición de carrera entre ambas consultas).

import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../../db/schema'
import type { Db } from '../server'
import { sendOk, sendBadRequest, sendNotFound } from '../response'

interface ProductoNuevoInput {
  nombre?: string
  categoriaId?: number
  precioBase?: number | string
  stockMinimo?: number | null
}

class ErrorValidacion extends Error {}

interface PgError {
  code?: string
  cause?: { code?: string }
}

// Mismo criterio que en routes/categorias.ts: Drizzle envuelve el error real
// de Postgres/PGlite en un DrizzleQueryError, y el código (ej. "23503" =
// violación de FK) queda en `err.cause.code`, no en `err.code` directamente.
function esViolacionFk(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as PgError
  return e.code === '23503' || e.cause?.code === '23503'
}

export function comprasRouter(db: Db): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const { productoId } = req.query
    const rows = productoId
      ? await db
          .select()
          .from(schema.compras)
          .where(eq(schema.compras.productoId, Number(productoId)))
      : await db.select().from(schema.compras)
    sendOk(res, rows)
  })

  router.post('/', async (req, res) => {
    const {
      productoId,
      productoNuevo,
      proveedorId,
      fecha,
      cantidad,
      precioCompra,
      garantiaProveedor,
      factura
    } = req.body ?? {}

    if (!proveedorId) {
      sendBadRequest(res, 'El proveedor es obligatorio.')
      return
    }
    if (!fecha) {
      sendBadRequest(res, 'La fecha es obligatoria.')
      return
    }
    const cantidadNum = Number(cantidad)
    if (!cantidadNum || cantidadNum <= 0) {
      sendBadRequest(res, 'La cantidad debe ser mayor a 0.')
      return
    }
    if (precioCompra === undefined || precioCompra === null) {
      sendBadRequest(res, 'El precio de compra es obligatorio.')
      return
    }
    if (!productoId && !productoNuevo) {
      sendBadRequest(res, 'Debe indicarse un producto existente o los datos de un producto nuevo.')
      return
    }

    try {
      const lote = await db.transaction(async (tx) => {
        let idProducto: number

        if (productoId) {
          idProducto = Number(productoId)
        } else {
          const datos = productoNuevo as ProductoNuevoInput
          if (!datos.nombre || !datos.categoriaId || datos.precioBase === undefined) {
            throw new ErrorValidacion(
              'Para dar de alta un producto nuevo se necesita nombre, categoría y precio base.'
            )
          }
          const [nuevo] = await tx
            .insert(schema.productos)
            .values({
              nombre: datos.nombre,
              categoriaId: Number(datos.categoriaId),
              precioBase: String(datos.precioBase),
              stockMinimo: datos.stockMinimo ?? null,
              stock: 0
            })
            .returning()
          idProducto = nuevo.id
        }

        const [loteCreado] = await tx
          .insert(schema.compras)
          .values({
            productoId: idProducto,
            proveedorId: Number(proveedorId),
            fecha,
            cantidad: cantidadNum,
            cantidadDisponible: cantidadNum,
            precioCompra: String(precioCompra),
            garantiaProveedor: garantiaProveedor ?? null,
            factura: factura ?? null
          })
          .returning()

        await tx
          .update(schema.productos)
          .set({ stock: sql`${schema.productos.stock} + ${cantidadNum}` })
          .where(eq(schema.productos.id, idProducto))

        return loteCreado
      })

      sendOk(res, lote, 201)
    } catch (err) {
      if (err instanceof ErrorValidacion) {
        sendBadRequest(res, err.message)
        return
      }
      throw err
    }
  })

  router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id)
    const { proveedorId, fecha, cantidad, precioCompra, garantiaProveedor, factura } =
      req.body ?? {}

    const [compraActual] = await db.select().from(schema.compras).where(eq(schema.compras.id, id))
    if (!compraActual) {
      sendNotFound(res, 'Lote de compra no encontrado.')
      return
    }

    const valores: Partial<typeof schema.compras.$inferInsert> = {}
    if (proveedorId !== undefined) valores.proveedorId = Number(proveedorId)
    if (fecha !== undefined) valores.fecha = fecha
    if (precioCompra !== undefined) valores.precioCompra = String(precioCompra)
    if (garantiaProveedor !== undefined) valores.garantiaProveedor = garantiaProveedor
    if (factura !== undefined) valores.factura = factura

    let deltaCantidad = 0
    if (cantidad !== undefined) {
      const cantidadNueva = Number(cantidad)
      if (!cantidadNueva || cantidadNueva <= 0) {
        sendBadRequest(res, 'La cantidad debe ser mayor a 0.')
        return
      }
      deltaCantidad = cantidadNueva - compraActual.cantidad
      const disponibleNuevo = compraActual.cantidadDisponible + deltaCantidad
      if (disponibleNuevo < 0) {
        sendBadRequest(
          res,
          'No se puede reducir la cantidad por debajo de lo que ya salió de este lote (ventas/servicios).'
        )
        return
      }
      valores.cantidad = cantidadNueva
      valores.cantidadDisponible = disponibleNuevo
    }

    if (Object.keys(valores).length === 0) {
      sendBadRequest(res, 'No se enviaron campos para actualizar.')
      return
    }

    const lote = await db.transaction(async (tx) => {
      const [actualizado] = await tx
        .update(schema.compras)
        .set(valores)
        .where(eq(schema.compras.id, id))
        .returning()

      if (deltaCantidad !== 0) {
        await tx
          .update(schema.productos)
          .set({ stock: sql`${schema.productos.stock} + ${deltaCantidad}` })
          .where(eq(schema.productos.id, compraActual.productoId))
      }

      return actualizado
    })

    sendOk(res, lote)
  })

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id)

    const [compraActual] = await db.select().from(schema.compras).where(eq(schema.compras.id, id))
    if (!compraActual) {
      sendNotFound(res, 'Lote de compra no encontrado.')
      return
    }

    try {
      await db.transaction(async (tx) => {
        await tx.delete(schema.compras).where(eq(schema.compras.id, id))
        await tx
          .update(schema.productos)
          .set({ stock: sql`${schema.productos.stock} - ${compraActual.cantidadDisponible}` })
          .where(eq(schema.productos.id, compraActual.productoId))
      })
      sendOk(res, { id })
    } catch (err) {
      if (esViolacionFk(err)) {
        sendBadRequest(
          res,
          'No se puede eliminar: ya se registraron ventas o servicios que descontaron stock de este lote.'
        )
        return
      }
      throw err
    }
  })

  return router
}
// src/main/api/routes/productos.ts
//
// Productos, listado/filtro/búsqueda, stock bajo (HU-08) y listado en PDF
// (HU-05). El alta de un producto nuevo no ocurre acá: ocurre junto con el
// registro de su primera Compra (ver routes/compras.ts). Acá solo se edita
// un producto ya existente.

import { Router } from 'express'
import { and, asc, eq, ilike, sql, type SQL } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import * as schema from '../../db/schema'
import type { Db } from '../server'
import { sendOk, sendBadRequest, sendNotFound } from '../response'

export function productosRouter(db: Db): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const { categoriaId, q, soloConStock, soloStockBajo, pagina, porPagina } = req.query
    // Anotación explícita: sin ella, un array vacío se infiere como
    // `never[]` y cada `.push(...)` de abajo queda marcado como error de
    // tipos (bug preexistente, detectado al correr `npm run typecheck`
    // junto con el cambio de paginación del 20/10/2026).
    const condiciones: SQL[] = []
    if (categoriaId) condiciones.push(eq(schema.productos.categoriaId, Number(categoriaId)))
    if (typeof q === 'string' && q.trim())
      condiciones.push(ilike(schema.productos.nombre, `%${q.trim()}%`))
    if (soloConStock === 'true') condiciones.push(sql`${schema.productos.stock} > 0`)
    // "Stock bajo" como filtro combinable con los demás (corrección
    // 20/10/2026): antes vivía únicamente en GET /stock-bajo, un endpoint
    // aparte sin los otros filtros, así que activar "Solo stock bajo" en la
    // pantalla ignoraba la categoría/búsqueda/solo-existencias ya elegidos.
    // Misma condición que usaba ese endpoint (ver más abajo, que se
    // mantiene sin cambios por si algo más lo necesita standalone).
    if (soloStockBajo === 'true')
      condiciones.push(
        sql`${schema.productos.stockMinimo} IS NOT NULL AND ${schema.productos.stock} <= ${schema.productos.stockMinimo}`
      )
    const condicion = condiciones.length ? and(...condiciones) : undefined

    // Paginación procesada en el backend (pedido explícito, 20/10/2026): el
    // listado de productos puede crecer bastante con el tiempo, y traer todo
    // de una sola vez para paginar solo en el cliente no escala. `pagina` es
    // 1-based; `porPagina` se acota a un máximo razonable para evitar que el
    // cliente pida una página desproporcionada por error.
    const paginaNum = Math.max(1, Math.trunc(Number(pagina)) || 1)
    const porPaginaNum = Math.min(100, Math.max(1, Math.trunc(Number(porPagina)) || 20))
    const offset = (paginaNum - 1) * porPaginaNum

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.productos)
      .where(condicion)

    const items = await db
      .select()
      .from(schema.productos)
      .where(condicion)
      // Sin ORDER BY, Postgres/PGlite devuelve las filas en el orden físico
      // en que las encuentra al recorrer la tabla, que no tiene por qué ser
      // el de alta y que puede cambiar con cada UPDATE (ej. al editar un
      // producto, la fila reescrita puede terminar al final del recorrido).
      // Se ordena explícitamente por nombre, sin distinguir mayúsculas de
      // minúsculas, para que el listado sea siempre alfabético y estable.
      // Imprescindible además para que la paginación (LIMIT/OFFSET) sea
      // estable entre una página y la siguiente.
      .orderBy(asc(sql`lower(${schema.productos.nombre})`))
      .limit(porPaginaNum)
      .offset(offset)

    sendOk(res, { items, total, pagina: paginaNum, porPagina: porPaginaNum })
  })

  router.get('/stock-bajo', async (_req, res) => {
    const rows = await db
      .select()
      .from(schema.productos)
      .where(
        sql`${schema.productos.stockMinimo} IS NOT NULL AND ${schema.productos.stock} <= ${schema.productos.stockMinimo}`
      )
      .orderBy(asc(sql`lower(${schema.productos.nombre})`))
    sendOk(res, rows)
  })

  router.get('/listado-pdf', async (_req, res) => {
    const productos = await db
      .select()
      .from(schema.productos)
      .orderBy(asc(sql`lower(${schema.productos.nombre})`))
    const categorias = await db.select().from(schema.categorias)
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=listado-stock.pdf')

    const doc = new PDFDocument({ margin: 40 })
    doc.pipe(res)

    doc.fontSize(16).text('Listado de existencias', { align: 'center' })
    doc.moveDown()
    doc.fontSize(10)

    if (productos.length === 0) {
      doc.text('No hay productos cargados.')
    } else {
      productos.forEach((p) => {
        const bajo = p.stockMinimo != null && p.stock <= p.stockMinimo
        const categoria = nombreCategoria.get(p.categoriaId) ?? 'Sin categoría'
        const linea = `${p.nombre} — ${categoria} — stock: ${p.stock}${bajo ? '  (stock bajo)' : ''}`
        doc.text(linea)
      })
    }

    doc.end()
  })

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id)
    const [producto] = await db.select().from(schema.productos).where(eq(schema.productos.id, id))
    if (!producto) {
      sendNotFound(res, 'Producto no encontrado.')
      return
    }
    const lotes = await db
      .select()
      .from(schema.compras)
      .where(and(eq(schema.compras.productoId, id), sql`${schema.compras.cantidadDisponible} > 0`))
    sendOk(res, { ...producto, lotes })
  })

  router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id)
    const { nombre, categoriaId, precioBase, stockMinimo } = req.body ?? {}
    const valores: Partial<typeof schema.productos.$inferInsert> = {}
    if (nombre !== undefined) valores.nombre = nombre
    if (categoriaId !== undefined) valores.categoriaId = Number(categoriaId)
    if (precioBase !== undefined) valores.precioBase = String(precioBase)
    if (stockMinimo !== undefined)
      valores.stockMinimo = stockMinimo === null ? null : Number(stockMinimo)

    if (Object.keys(valores).length === 0) {
      sendBadRequest(res, 'No se enviaron campos para actualizar.')
      return
    }

    const [row] = await db
      .update(schema.productos)
      .set(valores)
      .where(eq(schema.productos.id, id))
      .returning()
    if (!row) {
      sendNotFound(res, 'Producto no encontrado.')
      return
    }
    sendOk(res, row)
  })

  return router
}
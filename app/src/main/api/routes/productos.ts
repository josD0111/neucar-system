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

  // Rediseño del 20/10/2026 (HU-05): el listado original era una lista de
  // líneas de texto plano, sin agrupar ni jerarquía visual — difícil de
  // escanear parado en el depósito, que es justamente el caso de uso (ver
  // comentario de la ruta al principio del archivo). Ahora: productos
  // agrupados por categoría (con encabezado de sección), una tabla real con
  // columnas alineadas, y stock bajo resaltado igual que en StockScreen
  // (mismo color de alerta), para que se note de un vistazo sin tener que
  // leer cada línea.
  router.get('/listado-pdf', async (_req, res) => {
    const productos = await db
      .select()
      .from(schema.productos)
      .orderBy(asc(sql`lower(${schema.productos.nombre})`))
    const categorias = await db.select().from(schema.categorias)
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))

    // Agrupar por nombre de categoría. Los productos ya vienen ordenados
    // alfabéticamente por nombre (ver ORDER BY arriba), así que alcanza con
    // preservar ese orden dentro de cada grupo.
    const porCategoria = new Map<string, typeof productos>()
    for (const p of productos) {
      const nombreCat = nombreCategoria.get(p.categoriaId) ?? 'Sin categoría'
      if (!porCategoria.has(nombreCat)) porCategoria.set(nombreCat, [])
      porCategoria.get(nombreCat)!.push(p)
    }
    const categoriasOrdenadas = [...porCategoria.keys()].sort((a, b) => a.localeCompare(b, 'es'))

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=listado-stock.pdf')

    // `bufferPages: true` para poder volver a cada página ya generada y
    // agregar el pie de página (número de página) una vez que se sabe
    // cuántas hubo en total — no se puede saber de antemano.
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
    doc.info.Title = 'Listado de existencias — Neucar'
    doc.pipe(res)

    // Paleta alineada a design/tokens.css, para que el PDF se sienta parte
    // de la misma identidad visual que la pantalla de Stock (no se embebe
    // la tipografía de la app —Inter/Barlow Condensed—: son fuentes web, no
    // están disponibles como archivo acá, y sumar esa dependencia solo para
    // el PDF no se justifica; Helvetica, la fuente base de pdfkit, da un
    // resultado prolijo sin agregar un asset nuevo al proyecto).
    const COLOR_TEXTO = '#22262b'
    const COLOR_TEXTO_MUTED = '#5c6570'
    const COLOR_BORDE = '#dedad2'
    const COLOR_ACENTO = '#e38b29'
    const COLOR_ALERTA = '#b23b3b'
    const COLOR_ALERTA_BG = '#f6e6e2'
    const COLOR_FONDO = '#f4f3f0'

    const xIzq = doc.page.margins.left
    const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const anchoStock = 60
    const anchoMinimo = 60
    const anchoEstado = 90
    const anchoNombre = anchoPagina - anchoStock - anchoMinimo - anchoEstado
    const xStock = xIzq + anchoNombre
    const xMinimo = xStock + anchoStock
    const xEstado = xMinimo + anchoMinimo
    const altoFila = 18

    function encabezadoTabla(): void {
      const y = doc.y
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO_MUTED)
      doc.text('Producto', xIzq, y, { width: anchoNombre })
      doc.text('Stock', xStock, y, { width: anchoStock, align: 'right' })
      doc.text('Mínimo', xMinimo, y, { width: anchoMinimo, align: 'right' })
      doc.text('Estado', xEstado, y, { width: anchoEstado, align: 'right' })
      doc.y = y + 14
      doc
        .moveTo(xIzq, doc.y)
        .lineTo(xIzq + anchoPagina, doc.y)
        .strokeColor(COLOR_BORDE)
        .lineWidth(1)
        .stroke()
      doc.y += 4
    }

    // Antes de dibujar algo de `alto` puntos, chequea si entra en lo que
    // queda de página; si no, abre una nueva y repite el encabezado de
    // columnas (y, si se cortó en medio de una categoría, un recordatorio
    // de cuál es) para no perder contexto al dar vuelta la hoja.
    function asegurarEspacio(alto: number, categoriaEnCurso: string | null): void {
      const limite = doc.page.height - doc.page.margins.bottom
      if (doc.y + alto <= limite) return
      doc.addPage()
      if (categoriaEnCurso) {
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(COLOR_TEXTO_MUTED)
          .text(`${categoriaEnCurso} (continuación)`, xIzq, doc.y, { width: anchoPagina })
        doc.y += 6
      }
      encabezadoTabla()
    }

    // --- Encabezado del documento ---
    doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(18).text('Listado de existencias')
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_TEXTO_MUTED)
      .text(`Neucar — generado el ${new Date().toLocaleString('es-PY')}`)
    doc.moveDown(1)

    if (productos.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(COLOR_TEXTO).text('No hay productos cargados.')
    } else {
      for (const nombreCat of categoriasOrdenadas) {
        const items = porCategoria.get(nombreCat)!

        // Franja de categoría + encabezado de columnas: 26pt de la franja
        // más una fila, para no dejar un título de categoría solo al pie de
        // la página sin ninguna fila debajo.
        asegurarEspacio(26 + altoFila, null)
        const yCat = doc.y
        doc.rect(xIzq, yCat, anchoPagina, 20).fill(COLOR_FONDO)
        doc
          .fillColor(COLOR_ACENTO)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(nombreCat, xIzq + 8, yCat + 5)
        doc.y = yCat + 26
        encabezadoTabla()

        items.forEach((p, i) => {
          asegurarEspacio(altoFila, nombreCat)
          const bajo = p.stockMinimo != null && p.stock <= p.stockMinimo
          const y = doc.y

          // Bandas alternadas (zebra striping): ayuda a seguir una fila con
          // la vista en una lista larga sin tener que marcarla con el dedo.
          if (i % 2 === 1) {
            doc.rect(xIzq, y - 2, anchoPagina, altoFila).fill(COLOR_FONDO)
          }

          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(COLOR_TEXTO)
            .text(p.nombre, xIzq + 4, y, { width: anchoNombre - 8 })

          doc
            .font('Helvetica-Bold')
            .fillColor(bajo ? COLOR_ALERTA : COLOR_TEXTO)
            .text(String(p.stock), xStock, y, { width: anchoStock - 6, align: 'right' })

          doc
            .font('Helvetica')
            .fillColor(COLOR_TEXTO_MUTED)
            .text(p.stockMinimo != null ? String(p.stockMinimo) : '—', xMinimo, y, {
              width: anchoMinimo - 6,
              align: 'right'
            })

          if (bajo) {
            const anchoBadge = 66
            const xBadge = xEstado + anchoEstado - anchoBadge - 2
            doc.roundedRect(xBadge, y - 1, anchoBadge, 13, 2).fill(COLOR_ALERTA_BG)
            doc
              .font('Helvetica-Bold')
              .fontSize(7.5)
              .fillColor(COLOR_ALERTA)
              .text('STOCK BAJO', xBadge, y + 2, { width: anchoBadge, align: 'center' })
          }

          doc.y = y + altoFila
        })

        doc.moveDown(0.6)
      }
    }

    // --- Pie de página (número de página + total de productos) ---
    const totalPaginas = doc.bufferedPageRange().count
    const margenInferiorOriginal = doc.page.margins.bottom
    for (let i = 0; i < totalPaginas; i++) {
      doc.switchToPage(i)
      // El pie va DENTRO del margen inferior reservado (`margin: 40`), por
      // debajo de donde termina el contenido normal. Si se escribe ahí con
      // el margen "real" puesto, pdfkit interpreta que el texto no entra en
      // la página y agrega una página en blanco de más — bug detectado
      // probando esta misma lógica: terminaban generándose el doble de
      // páginas de las esperadas. Se baja el margen a 0 solo mientras se
      // dibuja el pie, página por página, y se restaura después.
      doc.page.margins.bottom = 0
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_TEXTO_MUTED)
        .text(
          `Página ${i + 1} de ${totalPaginas} — ${productos.length} productos en total`,
          xIzq,
          doc.page.height - margenInferiorOriginal + 12,
          { width: anchoPagina, align: 'center' }
        )
      doc.page.margins.bottom = margenInferiorOriginal
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
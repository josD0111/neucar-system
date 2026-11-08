// src/main/api/routes/ventas.ts
//
// Rutas de Ventas, montadas bajo /api/ventas (ver server.ts). Todas exigen
// sesión iniciada. A diferencia de categorías/productos/proveedores/compras
// en Sprint 1 (ver sprint-1-backlog.md, "Deuda técnica registrada"), estas
// rutas quedan protegidas desde el inicio (ver sprint-2-backlog.md, punto 5).
//
// Permisos por rol:
//   - Listar / ver el detalle de una venta: Administrador y Empleado.
//   - Registrar una venta (POST):           solo Administrador (HU-17.1).
//     El Empleado usa la pantalla como calculadora en el cliente (HU-17),
//     sin llamar nunca a este endpoint; aun así, también se valida el rol
//     dentro del servicio (ver services/ventas.ts) como defensa en
//     profundidad, no solo acá en la ruta.
//
//   GET  /api/ventas    → página de ventas (7 días calendario completos por
//                          defecto — ver services/ventas.ts), más recientes
//                          primero. Filtros opcionales: clienteId, q (nombre
//                          de cliente), metodoPago, fechaDesde/fechaHasta
//                          ('YYYY-MM-DD' locales), soloConSaldoPendiente,
//                          antesDe (cursor de paginación, el `antesDe` que
//                          devolvió la página anterior), dias (días por
//                          página, default 7).
//   GET  /api/ventas/:id                  → una venta con el detalle de sus ítems
//   GET  /api/ventas/:id/comprobante-pdf  → comprobante de venta en PDF (HU-21)
//   POST /api/ventas                      → registrar una venta (solo Administrador)
//
// Nota sobre el comprobante (HU-21, 06/11/2026): se implementa recién ahora
// porque se decidió (ver sprint-2-backlog.md, punto 1) dejarlo para después
// de tener las bases del módulo (servicio + endpoint de registro +
// pantallas) terminadas. No exige `requireRole('Administrador')` como el
// registro de la venta (HU-17.1): es solo una reimpresión de una venta que
// ya existe, y un Empleado puede necesitar reimprimir un comprobante para
// un cliente sin tener que llamar al Administrador — mismo criterio que
// GET /api/ventas/:id, que tampoco restringe por rol.

import { Router, type Response } from 'express'
import PDFDocument from 'pdfkit'
import type { Db } from '../server'
import { requireAuth, requireRole } from '../middleware/auth'
import { sendBadRequest, sendError, sendOk } from '../response'
import { listarVentas, obtenerVenta, registrarVenta, type Resultado } from '../../services/ventas'

function leerId(valor: string): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

function responder<T>(res: Response, resultado: Resultado<T>, statusExito = 200): void {
  if (resultado.ok) sendOk(res, resultado.data, statusExito)
  else sendError(res, resultado.status, resultado.mensaje)
}

export function ventasRouter(db: Db): Router {
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (req, res, next) => {
    try {
      const {
        clienteId,
        q,
        metodoPago,
        fechaDesde,
        fechaHasta,
        soloConSaldoPendiente,
        antesDe,
        dias
      } = req.query

      const leerTexto = (v: unknown): string | undefined =>
        typeof v === 'string' && v.trim() ? v.trim() : undefined

      sendOk(
        res,
        await listarVentas(db, {
          clienteId:
            typeof clienteId === 'string' && clienteId.trim() ? Number(clienteId) : undefined,
          q: leerTexto(q),
          metodoPago: leerTexto(metodoPago),
          fechaDesde: leerTexto(fechaDesde),
          fechaHasta: leerTexto(fechaHasta),
          soloConSaldoPendiente: soloConSaldoPendiente === 'true',
          antesDe: leerTexto(antesDe),
          dias: typeof dias === 'string' && dias.trim() ? Number(dias) : undefined
        })
      )
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const id = leerId(req.params.id)
      if (id === null) return sendBadRequest(res, 'Id de venta no válido')
      responder(res, await obtenerVenta(db, id))
    } catch (err) {
      next(err)
    }
  })

  // Comprobante de venta en PDF (HU-21). A diferencia del resto de las
  // rutas de este router, la respuesta no sigue la convención { ok, data }:
  // el cuerpo es el PDF en sí (mismo criterio que
  // GET /api/productos/listado-pdf y GET /api/clientes/:id/saldo-pdf).
  router.get('/:id/comprobante-pdf', async (req, res, next) => {
    try {
      const id = leerId(req.params.id)
      if (id === null) return sendBadRequest(res, 'Id de venta no válido')

      const resultado = await obtenerVenta(db, id)
      if (!resultado.ok) return sendError(res, resultado.status, resultado.mensaje)
      const venta = resultado.data

      // Paleta alineada a design/tokens.css (mismo criterio que
      // routes/productos.ts y routes/clientes.ts): Helvetica alcanza para
      // un comprobante, no hace falta embeber la tipografía de la app.
      const COLOR_TEXTO = '#22262b'
      const COLOR_TEXTO_MUTED = '#5c6570'
      const COLOR_BORDE = '#dedad2'
      const COLOR_ALERTA = '#b23b3b'
      const COLOR_OK = '#3a7a4e'

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=venta-${id}.pdf`)

      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
      doc.info.Title = `Comprobante de venta #${id}`
      doc.pipe(res)

      const xIzq = doc.page.margins.left
      const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right

      // --- Encabezado ---
      // tipoComprobante queda null hasta que el flujo de SIFEN (factura
      // electrónica) esté implementado (ver desiciones-alcance.md, sección
      // 6); mientras tanto, el MVP solo emite factura común, así que se usa
      // ese texto fijo como respaldo si no hay nada guardado en la venta.
      doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(18).text('Comprobante de venta')
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_TEXTO_MUTED)
        .text(
          `Neucar — ${venta.tipoComprobante ?? 'Factura común'} — generado el ${new Date().toLocaleString('es-PY')}`
        )
      doc.moveDown(1)

      doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR_TEXTO).text(`Venta #${venta.id}`)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COLOR_TEXTO_MUTED)
        .text(`Fecha: ${venta.fecha.toLocaleString('es-PY')}`)
      doc.text(`Cliente: ${venta.clienteNombre ?? 'Cliente casual'}`)
      doc.text(`Atendido por: ${venta.usuarioNombre}`)
      doc.text(`Método de pago: ${venta.metodoPago}`)
      doc.moveDown(1)

      // --- Detalle de ítems ---
      const anchoProducto = 170
      const anchoCantidad = 50
      const anchoPrecio = 80
      const anchoForma = 70
      const anchoGarantia = 55
      const anchoSaldo =
        anchoPagina - anchoProducto - anchoCantidad - anchoPrecio - anchoForma - anchoGarantia
      // Corrección (07/11/2026): "Precio unit." quedaba pegado a "Pago" —
      // al alinear el precio a la derecha dentro de su columna, el texto se
      // empuja hasta el borde derecho de esa columna, que es exactamente
      // donde arranca (a la izquierda) la columna siguiente. Sin un margen
      // de por medio, un precio corto termina tocando la palabra de al
      // lado. Se usa esta constante para angostar un poco el ancho que se
      // le pasa a .text() en las columnas alineadas a la derecha que tienen
      // otra columna pegada a su derecha (acá, Precio), sin mover las
      // posiciones reales de las columnas (xForma, etc. quedan iguales).
      const GUTTER = 8
      const xCantidad = xIzq + anchoProducto
      const xPrecio = xCantidad + anchoCantidad
      const xForma = xPrecio + anchoPrecio
      const xGarantia = xForma + anchoForma
      const xSaldo = xGarantia + anchoGarantia

      const y0 = doc.y
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO_MUTED)
      doc.text('Producto', xIzq, y0, { width: anchoProducto })
      doc.text('Cant.', xCantidad, y0, { width: anchoCantidad, align: 'right' })
      doc.text('Precio unit.', xPrecio, y0, { width: anchoPrecio - GUTTER, align: 'right' })
      doc.text('Pago', xForma, y0, { width: anchoForma })
      doc.text('Garantía', xGarantia, y0, { width: anchoGarantia })
      doc.text('Saldo', xSaldo, y0, { width: anchoSaldo, align: 'right' })
      doc.y = y0 + 14
      doc
        .moveTo(xIzq, doc.y)
        .lineTo(xIzq + anchoPagina, doc.y)
        .strokeColor(COLOR_BORDE)
        .lineWidth(1)
        .stroke()
      doc.y += 4

      venta.items.forEach((item, i) => {
        const y = doc.y
        // Precio base vs. precio aplicado (HU-18, trazabilidad de
        // descuento): si el Administrador modificó el precio, se aclara
        // entre paréntesis para que quede constancia en el comprobante.
        const descuentoAplicado = Number(item.precioUnitario) !== Number(item.precioBase)
        const lineaPrecio = descuentoAplicado
          ? `Gs. ${Number(item.precioUnitario).toLocaleString('es-PY')} (antes Gs. ${Number(item.precioBase).toLocaleString('es-PY')})`
          : `Gs. ${Number(item.precioUnitario).toLocaleString('es-PY')}`

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLOR_TEXTO)
          .text(item.productoNombre, xIzq, y, { width: anchoProducto })
        doc.text(String(item.cantidad), xCantidad, y, { width: anchoCantidad, align: 'right' })
        doc
          .fontSize(descuentoAplicado ? 7.5 : 9)
          .text(lineaPrecio, xPrecio, y, { width: anchoPrecio - GUTTER, align: 'right' })
        doc.fontSize(9).text(item.tipoPago, xForma, y, { width: anchoForma })
        doc.text(
          item.garantiaOfrecida != null ? `${item.garantiaOfrecida} meses` : '—',
          xGarantia,
          y,
          {
            width: anchoGarantia
          }
        )
        doc
          .font(item.saldoPendiente > 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(item.saldoPendiente > 0 ? COLOR_ALERTA : COLOR_OK)
          .text(
            item.saldoPendiente > 0
              ? `Gs. ${item.saldoPendiente.toLocaleString('es-PY')}`
              : 'Pagado',
            xSaldo,
            y,
            { width: anchoSaldo, align: 'right' }
          )

        doc.y = Math.max(doc.y, y + 16)
        if (i < venta.items.length - 1) {
          doc
            .moveTo(xIzq, doc.y)
            .lineTo(xIzq + anchoPagina, doc.y)
            .strokeColor(COLOR_BORDE)
            .lineWidth(0.5)
            .stroke()
          doc.y += 4
        }
      })

      doc.moveDown(2)
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(COLOR_TEXTO)
        .text(`Total: Gs. ${Number(venta.montoTotal).toLocaleString('es-PY')}`, { align: 'right' })

      const totalPendiente = venta.items.reduce((acc, it) => acc + it.saldoPendiente, 0)
      if (totalPendiente > 0) {
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(COLOR_ALERTA)
          .text(`Saldo pendiente: Gs. ${totalPendiente.toLocaleString('es-PY')}`, {
            align: 'right'
          })
      }

      doc.end()
    } catch (err) {
      next(err)
    }
  })

  // Solo Administrador: ver nota de permisos al principio del archivo.
  router.post('/', requireRole('Administrador'), async (req, res, next) => {
    try {
      responder(res, await registrarVenta(db, req.usuario!, req.body), 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}

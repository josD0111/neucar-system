// src/main/api/routes/pagos.ts
//
// Rutas de Pagos sobre Ventas (Fase 3 del reparto) y sobre Órdenes de
// Servicio (Fase 5, agregada el 15/11/2026) — ver docs/03-gestion-proyecto/
// tareas-ventas-creditopagos-deudatecnica.md. Montadas bajo /api/pagos (ver
// server.ts).
//
// Permisos: a diferencia del registro de una Venta (HU-17.1, solo
// Administrador), el dueño no pidió restringir quién cobra una cuota —
// alcanza con sesión iniciada (Administrador o Empleado). Si eso cambia,
// alcanza con agregar requireRole acá. Mismo criterio para las dos rutas
// (venta y orden de servicio): es el mismo tipo de operación.
//
// Cambio de alcance (22/11/2026 — ver entidades-dominio.md, sección 12): la
// ruta de pagos sobre un Ítem de Venta puntual (`/item/:itemVentaId`) pasa a
// ser sobre la Venta completa (`/venta/:ventaId`), acompañando el cambio de
// `tipoPago` de Ítem de Venta a Venta.
//
//   GET  /api/pagos/venta/:ventaId          → pagos registrados de esa venta
//   POST /api/pagos/venta/:ventaId          → registrar un pago sobre esa venta
//   GET  /api/pagos/orden/:ordenServicioId   → pagos registrados de esa orden
//   POST /api/pagos/orden/:ordenServicioId   → registrar un pago sobre esa orden

import { Router, type Response } from 'express'
import type { Db } from '../server'
import { requireAuth } from '../middleware/auth'
import { sendBadRequest, sendError, sendOk } from '../response'
import {
  listarPagosVenta,
  listarPagosOrden,
  registrarPagoVenta,
  registrarPagoOrden,
  type Resultado
} from '../../services/pagos'

function leerId(valor: string): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

function responder<T>(res: Response, resultado: Resultado<T>, statusExito = 200): void {
  if (resultado.ok) sendOk(res, resultado.data, statusExito)
  else sendError(res, resultado.status, resultado.mensaje)
}

export function pagosRouter(db: Db): Router {
  const router = Router()

  router.use(requireAuth)

  router.get('/venta/:ventaId', async (req, res, next) => {
    try {
      const id = leerId(req.params.ventaId)
      if (id === null) return sendBadRequest(res, 'Id de venta no válido')
      responder(res, await listarPagosVenta(db, id))
    } catch (err) {
      next(err)
    }
  })

  router.post('/venta/:ventaId', async (req, res, next) => {
    try {
      const id = leerId(req.params.ventaId)
      if (id === null) return sendBadRequest(res, 'Id de venta no válido')
      responder(res, await registrarPagoVenta(db, id, req.body), 201)
    } catch (err) {
      next(err)
    }
  })

  router.get('/orden/:ordenServicioId', async (req, res, next) => {
    try {
      const id = leerId(req.params.ordenServicioId)
      if (id === null) return sendBadRequest(res, 'Id de orden de servicio no válido')
      responder(res, await listarPagosOrden(db, id))
    } catch (err) {
      next(err)
    }
  })

  router.post('/orden/:ordenServicioId', async (req, res, next) => {
    try {
      const id = leerId(req.params.ordenServicioId)
      if (id === null) return sendBadRequest(res, 'Id de orden de servicio no válido')
      responder(res, await registrarPagoOrden(db, id, req.body), 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}

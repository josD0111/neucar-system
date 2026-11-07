// src/main/api/routes/pagos.ts
//
// Rutas de Pagos sobre Ítems de Venta (Fase 3 del reparto — ver
// docs/03-gestion-proyecto/tareas-ventas-creditopagos-deudatecnica.md).
// Montadas bajo /api/pagos (ver server.ts). Los pagos sobre Órdenes de
// Servicio (Fase 5, después del punto de sincronización con el compañero)
// se agregan más adelante a este mismo router, con su propio prefijo
// (/api/pagos/orden/:id), sin romper lo de acá.
//
// Permisos: a diferencia del registro de una Venta (HU-17.1, solo
// Administrador), el dueño no pidió restringir quién cobra una cuota —
// alcanza con sesión iniciada (Administrador o Empleado). Si eso cambia,
// alcanza con agregar requireRole acá.
//
//   GET  /api/pagos/item/:itemVentaId   → pagos registrados de ese ítem
//   POST /api/pagos/item/:itemVentaId   → registrar un pago sobre ese ítem

import { Router, type Response } from 'express'
import type { Db } from '../server'
import { requireAuth } from '../middleware/auth'
import { sendBadRequest, sendError, sendOk } from '../response'
import { listarPagosItem, registrarPagoItem, type Resultado } from '../../services/pagos'

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

  router.get('/item/:itemVentaId', async (req, res, next) => {
    try {
      const id = leerId(req.params.itemVentaId)
      if (id === null) return sendBadRequest(res, 'Id de ítem de venta no válido')
      responder(res, await listarPagosItem(db, id))
    } catch (err) {
      next(err)
    }
  })

  router.post('/item/:itemVentaId', async (req, res, next) => {
    try {
      const id = leerId(req.params.itemVentaId)
      if (id === null) return sendBadRequest(res, 'Id de ítem de venta no válido')
      responder(res, await registrarPagoItem(db, id, req.body), 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}

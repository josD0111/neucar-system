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
//   GET  /api/ventas/:id → una venta con el detalle de sus ítems
//   POST /api/ventas     → registrar una venta (solo Administrador)

import { Router, type Response } from 'express'
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

// src/main/api/routes/ordenesServicio.ts
//
// Rutas de órdenes de servicio, montadas bajo /api/ordenes-servicio (ver server.ts).
// Todas exigen sesión iniciada. Administrador y Empleado pueden registrar y consultar
// órdenes (HU-22: "Administrador o Empleado"). No hay edición ni borrado: las órdenes
// son el historial del taller.
//
//   GET  /api/ordenes-servicio?clienteId=3&vehiculoId=5&limite=50  → historial (HU-26)
//   GET  /api/ordenes-servicio/:id                                 → una orden con sus servicios
//   POST /api/ordenes-servicio                                     → registrar una orden

import { Router, type Response } from "express";
import type { Db } from "../server";
import { requireAuth } from "../middleware/auth";
import { sendBadRequest, sendError, sendOk, sendUnauthorized } from "../response";
import { crearOrden, historialOrdenes, listarOrdenes, obtenerOrden } from "../../services/ordenesServicio";
import type { Resultado } from "../../services/clientes";

// Convierte un id recibido por URL en número entero positivo (o null si no es válido).
function leerId(valor: string): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Traduce el Resultado de un servicio a la respuesta HTTP correspondiente.
function responder<T>(res: Response, resultado: Resultado<T>, statusExito = 200): void {
  if (resultado.ok) sendOk(res, resultado.data, statusExito);
  else sendError(res, resultado.status, resultado.mensaje);
}

export function ordenesServicioRouter(db: Db): Router {
  const router = Router();

  // Todas las rutas de este router requieren un usuario autenticado.
  router.use(requireAuth);

  // Historial de órdenes. Parámetros opcionales: clienteId, vehiculoId y limite (1 a 500).
  router.get("/", async (req, res, next) => {
    try {
      let clienteId: number | undefined;
      if (req.query.clienteId !== undefined) {
        const id = typeof req.query.clienteId === "string" ? leerId(req.query.clienteId) : null;
        if (id === null) return sendBadRequest(res, "clienteId debe ser un número entero positivo");
        clienteId = id;
      }

      let vehiculoId: number | undefined;
      if (req.query.vehiculoId !== undefined) {
        const id = typeof req.query.vehiculoId === "string" ? leerId(req.query.vehiculoId) : null;
        if (id === null) return sendBadRequest(res, "vehiculoId debe ser un número entero positivo");
        vehiculoId = id;
      }

      let limite: number | undefined;
      if (req.query.limite !== undefined) {
        const n = typeof req.query.limite === "string" ? leerId(req.query.limite) : null;
        if (n === null || n > 500) return sendBadRequest(res, "limite debe ser un número entre 1 y 500");
        limite = n;
      }

      sendOk(res, await listarOrdenes(db, { clienteId, vehiculoId, limite }));
    } catch (err) {
      next(err);
    }
  });
  // Historial paginado por días (pantalla Historial de servicios). Va ANTES de
  // "/:id": si no, Express interpretaría "historial" como un id.
  // Parámetros opcionales: clienteId, vehiculoId, tipoPago (Contado | Crédito),
  // fechaDesde / fechaHasta (AAAA-MM-DD locales), soloConSaldoPendiente=true,
  // antesDe (cursor que devolvió la página anterior) y dias (días por página, 1 a 31).
  // La validación de cada parámetro la hace el servicio (responde 400 si no es válido).
  router.get("/historial", async (req, res, next) => {
    try {
      const leerTexto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
      const leerNumero = (v: unknown): number | undefined => {
        const t = leerTexto(v);
        return t === undefined ? undefined : Number(t); // si no es número da NaN y el servicio lo rechaza
      };

      responder(
        res,
        await historialOrdenes(db, {
          clienteId: leerNumero(req.query.clienteId),
          vehiculoId: leerNumero(req.query.vehiculoId),
          tipoPago: leerTexto(req.query.tipoPago),
          fechaDesde: leerTexto(req.query.fechaDesde),
          fechaHasta: leerTexto(req.query.fechaHasta),
          soloConSaldoPendiente: req.query.soloConSaldoPendiente === "true",
          antesDe: leerTexto(req.query.antesDe),
          dias: leerNumero(req.query.dias),
        }),
      );
    } catch (err) {
      next(err);
    }
  });
  // Una orden por id, con sus servicios.
  router.get("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de orden no válido");
      responder(res, await obtenerOrden(db, id));
    } catch (err) {
      next(err);
    }
  });

  // Registro de una orden. Responde 201 (creada). El usuario que la registra sale
  // de la sesión, no del cuerpo de la petición.
  router.post("/", async (req, res, next) => {
    try {
      // requireAuth ya garantiza el usuario; esta comprobación es para TypeScript.
      if (!req.usuario) return sendUnauthorized(res, "Sesión no válida o vencida");
      responder(res, await crearOrden(db, req.usuario.id, req.usuario.rol, req.body), 201);
        } catch (err) {
      next(err);
    }
    
  });

  return router;
}
// src/main/api/routes/tiposServicio.ts
//
// Catálogo de tipos de servicio, montado bajo /api/tipos-servicio (ver server.ts).
// Todas las rutas exigen sesión. Cualquier usuario puede LISTAR los tipos activos
// (para elegirlos al cargar una orden); crear, editar y ver los deshabilitados es
// solo del Administrador. No hay DELETE: los tipos se deshabilitan.
//
//   GET   /api/tipos-servicio?incluirInactivos=true  → catálogo (inactivos: solo Administrador)
//   POST  /api/tipos-servicio                        → crear (Administrador)
//   PATCH /api/tipos-servicio/:id                    → editar / deshabilitar (Administrador)

import { Router, type Response } from "express";
import type { Db } from "../server";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendBadRequest, sendError, sendForbidden, sendOk } from "../response";
import { actualizarTipoServicio, crearTipoServicio, listarTiposServicio } from "../../services/tiposServicio";
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

export function tiposServicioRouter(db: Db): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const incluirInactivos = req.query.incluirInactivos === "true";
    // Los deshabilitados solo los ve el Administrador (la validación es acá, no solo en la pantalla).
    if (incluirInactivos && req.usuario?.rol !== "Administrador") {
      return sendForbidden(res, "No tenés permiso para ver los tipos de servicio deshabilitados");
    }
    sendOk(res, await listarTiposServicio(db, incluirInactivos));
  });

  router.post("/", requireRole("Administrador"), async (req, res) => {
    responder(res, await crearTipoServicio(db, req.body), 201);
  });

  router.patch("/:id", requireRole("Administrador"), async (req, res) => {
    const id = leerId(req.params.id);
    if (id === null) return sendBadRequest(res, "Id de tipo de servicio no válido");
    responder(res, await actualizarTipoServicio(db, id, req.body));
  });

  return router;
}
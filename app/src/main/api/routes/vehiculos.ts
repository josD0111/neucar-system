// src/main/api/routes/vehiculos.ts
//
// Rutas de vehículos, montadas bajo /api/vehiculos (ver server.ts).
// Todas exigen sesión iniciada. Administrador y Empleado pueden usarlas todas:
// el Empleado también registra órdenes de servicio (HU-22), así que necesita
// poder elegir o dar de alta el vehículo. No hay borrado (ver services/vehiculos.ts).
//
// Cambio de dueño: asignar dueño a un vehículo que no tiene lo pueden hacer ambos
// roles; cambiar o quitar un dueño ya registrado es solo del Administrador (lo
// valida el servicio, tanto en PUT como en PATCH /:id/dueno).
//
//   GET   /api/vehiculos?clienteId=3&q=texto   → lista (filtros opcionales)
//   GET   /api/vehiculos/:id                   → un vehículo
//   POST  /api/vehiculos                       → crear
//   PUT   /api/vehiculos/:id                   → editar
//   PATCH /api/vehiculos/:id/dueno             → asignar dueño ({ clienteId })

import { Router, type Response } from "express";
import type { Db } from "../server";
import { requireAuth } from "../middleware/auth";
import { sendBadRequest, sendError, sendOk, sendUnauthorized } from "../response";
import {
  actualizarVehiculo,
  asignarDuenoVehiculo,
  crearVehiculo,
  listarVehiculos,
  obtenerVehiculo,
} from "../../services/vehiculos";
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

export function vehiculosRouter(db: Db): Router {
  const router = Router();

  // Todas las rutas de este router requieren un usuario autenticado.
  router.use(requireAuth);

  // Lista de vehículos. Parámetros opcionales: clienteId y q (búsqueda).
  router.get("/", async (req, res, next) => {
    try {
      let clienteId: number | undefined;
      if (req.query.clienteId !== undefined) {
        const id = typeof req.query.clienteId === "string" ? leerId(req.query.clienteId) : null;
        if (id === null) return sendBadRequest(res, "clienteId debe ser un número entero positivo");
        clienteId = id;
      }
      const busqueda = typeof req.query.q === "string" ? req.query.q : undefined;
      sendOk(res, await listarVehiculos(db, { clienteId, busqueda }));
    } catch (err) {
      next(err);
    }
  });

  // Un vehículo por id.
  router.get("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de vehículo no válido");
      responder(res, await obtenerVehiculo(db, id));
    } catch (err) {
      next(err);
    }
  });

  // Alta de vehículo. Responde 201 (creado).
  router.post("/", async (req, res, next) => {
    try {
      responder(res, await crearVehiculo(db, req.body), 201);
    } catch (err) {
      next(err);
    }
  });

  // Edición de un vehículo. El rol sale de la sesión, nunca del cuerpo de la petición.
  router.put("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de vehículo no válido");
      if (!req.usuario) return sendUnauthorized(res, "Sesión no válida o vencida");
      responder(res, await actualizarVehiculo(db, id, req.usuario.rol, req.body));
    } catch (err) {
      next(err);
    }
  });

  // Asignar (o, el Administrador, cambiar) el dueño de un vehículo.
  router.patch("/:id/dueno", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de vehículo no válido");
      if (!req.usuario) return sendUnauthorized(res, "Sesión no válida o vencida");
      responder(res, await asignarDuenoVehiculo(db, id, req.usuario.rol, req.body));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
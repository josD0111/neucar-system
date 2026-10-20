// src/main/api/routes/clientes.ts
//
// Rutas de clientes, montadas bajo /api/clientes (ver server.ts).
// Todas exigen sesión iniciada. Permisos por rol:
//   - Listar, ver, crear y editar: Administrador y Empleado (HU-09).
//   - Deshabilitar / habilitar:    solo Administrador.
//
//   GET   /api/clientes?q=texto&inactivos=true   → lista (con búsqueda opcional)
//   GET   /api/clientes/:id                      → un cliente
//   POST  /api/clientes                          → crear
//   PUT   /api/clientes/:id                      → editar datos
//   PATCH /api/clientes/:id/estado               → { "activo": true | false }

import { Router, type Response } from "express";
import type { Db } from "../server";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendBadRequest, sendError, sendOk } from "../response";
import {
  actualizarCliente,
  cambiarEstadoCliente,
  crearCliente,
  listarClientes,
  obtenerCliente,
  type Resultado,
} from "../../services/clientes";

// Convierte el id de la URL en número entero positivo (o null si no es válido).
function leerId(valor: string): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Traduce el Resultado de un servicio a la respuesta HTTP correspondiente.
function responder<T>(res: Response, resultado: Resultado<T>, statusExito = 200): void {
  if (resultado.ok) sendOk(res, resultado.data, statusExito);
  else sendError(res, resultado.status, resultado.mensaje);
}

export function clientesRouter(db: Db): Router {
  const router = Router();

  // Todas las rutas de este router requieren un usuario autenticado.
  router.use(requireAuth);

  // Lista de clientes. Parámetros opcionales: q (búsqueda) e inactivos=true.
  router.get("/", async (req, res, next) => {
    try {
      const busqueda = typeof req.query.q === "string" ? req.query.q : undefined;
      const incluirInactivos = req.query.inactivos === "true";
      sendOk(res, await listarClientes(db, { busqueda, incluirInactivos }));
    } catch (err) {
      next(err);
    }
  });

  // Un cliente por id.
  router.get("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await obtenerCliente(db, id));
    } catch (err) {
      next(err);
    }
  });

  // Alta de cliente. Responde 201 (creado).
  router.post("/", async (req, res, next) => {
    try {
      responder(res, await crearCliente(db, req.body), 201);
    } catch (err) {
      next(err);
    }
  });

  // Edición de los datos de un cliente.
  router.put("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await actualizarCliente(db, id, req.body));
    } catch (err) {
      next(err);
    }
  });

  // Deshabilitar o habilitar (solo Administrador; el Empleado recibe 403).
  router.patch("/:id/estado", requireRole("Administrador"), async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await cambiarEstadoCliente(db, id, req.body?.activo));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
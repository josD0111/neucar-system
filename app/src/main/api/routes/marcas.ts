// src/main/api/routes/marcas.ts
//
// Marcas de producto (HU-37), montado bajo /api/marcas. Todas las rutas
// exigen sesión. Listar es para ambos roles; crear, editar y eliminar es
// solo del Administrador (se valida acá, no solo en la pantalla).

import { Router, type Response } from "express";
import type { Db } from "../server";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendBadRequest, sendError, sendOk } from "../response";
import { actualizarMarca, crearMarca, eliminarMarca, listarMarcas } from "../../services/marcas";
import type { Resultado } from "../../services/clientes";

function leerId(valor: string): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function responder<T>(res: Response, resultado: Resultado<T>, statusExito = 200): void {
  if (resultado.ok) sendOk(res, resultado.data, statusExito);
  else sendError(res, resultado.status, resultado.mensaje);
}

export function marcasRouter(db: Db): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (_req, res) => {
    sendOk(res, await listarMarcas(db));
  });

  router.post("/", requireRole("Administrador"), async (req, res) => {
    responder(res, await crearMarca(db, req.body), 201);
  });

  router.patch("/:id", requireRole("Administrador"), async (req, res) => {
    const id = leerId(req.params.id);
    if (id === null) return sendBadRequest(res, "Id de marca no válido");
    responder(res, await actualizarMarca(db, id, req.body));
  });

  router.delete("/:id", requireRole("Administrador"), async (req, res) => {
    const id = leerId(req.params.id);
    if (id === null) return sendBadRequest(res, "Id de marca no válido");
    responder(res, await eliminarMarca(db, id));
  });

  return router;
}
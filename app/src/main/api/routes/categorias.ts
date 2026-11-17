// src/main/api/routes/categorias.ts
//
// CRUD de Categorías (HU-01.1). El Administrador gestiona libremente las
// categorías; no existe una lista fija. Se usan para filtrar productos.

import { Router } from "express";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../server";
import { sendOk, sendBadRequest, sendNotFound } from "../response";

interface PgError {
  code?: string;
  cause?: { code?: string };
}

// Drizzle envuelve el error real de Postgres/PGlite en un DrizzleQueryError:
// el código de error (ej. "23503" = violación de FK) queda en `err.cause.code`,
// no en `err.code` directamente. Se verifica en ambos lugares por las dudas.
function esViolacionFk(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as PgError;
  return e.code === "23503" || e.cause?.code === "23503";
}

export function categoriasRouter(db: Db): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const rows = await db.select().from(schema.categorias);
    sendOk(res, rows);
  });

  router.post("/", async (req, res) => {
    const { nombre } = req.body ?? {};
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      sendBadRequest(res, "El nombre de la categoría es obligatorio.");
      return;
    }
    const [row] = await db.insert(schema.categorias).values({ nombre: nombre.trim() }).returning();
    sendOk(res, row, 201);
  });

  router.patch("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { nombre } = req.body ?? {};
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      sendBadRequest(res, "El nombre de la categoría es obligatorio.");
      return;
    }
    const [row] = await db
      .update(schema.categorias)
      .set({ nombre: nombre.trim() })
      .where(eq(schema.categorias.id, id))
      .returning();
    if (!row) {
      sendNotFound(res, "Categoría no encontrada.");
      return;
    }
    sendOk(res, row);
  });

  router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
      const [row] = await db
        .delete(schema.categorias)
        .where(eq(schema.categorias.id, id))
        .returning();
      if (!row) {
        sendNotFound(res, "Categoría no encontrada.");
        return;
      }
      sendOk(res, { id });
    } catch (err) {
      if (esViolacionFk(err)) {
        sendBadRequest(
          res,
          "No se puede eliminar: hay productos que usan esta categoría. Reasigná esos productos a otra categoría primero.",
        );
        return;
      }
      throw err;
    }
  });

  return router;
}
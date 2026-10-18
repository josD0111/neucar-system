// src/main/api/routes/proveedores.ts
//
// CRUD de Proveedores (HU-14, HU-15). Sin pantalla previa en el prototipo.

import { Router } from "express";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../server";
import { sendOk, sendBadRequest, sendNotFound } from "../response";

export function proveedoresRouter(db: Db): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const rows = await db.select().from(schema.proveedores);
    sendOk(res, rows);
  });

  router.post("/", async (req, res) => {
    const { nombre, contacto } = req.body ?? {};
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      sendBadRequest(res, "El nombre del proveedor es obligatorio.");
      return;
    }
    const [row] = await db
      .insert(schema.proveedores)
      .values({ nombre: nombre.trim(), contacto: contacto ?? null })
      .returning();
    sendOk(res, row, 201);
  });

  router.patch("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { nombre, contacto } = req.body ?? {};
    const valores: Partial<typeof schema.proveedores.$inferInsert> = {};
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        sendBadRequest(res, "El nombre del proveedor no puede quedar vacío.");
        return;
      }
      valores.nombre = nombre.trim();
    }
    if (contacto !== undefined) valores.contacto = contacto;

    if (Object.keys(valores).length === 0) {
      sendBadRequest(res, "No se enviaron campos para actualizar.");
      return;
    }

    const [row] = await db
      .update(schema.proveedores)
      .set(valores)
      .where(eq(schema.proveedores.id, id))
      .returning();
    if (!row) {
      sendNotFound(res, "Proveedor no encontrado.");
      return;
    }
    sendOk(res, row);
  });

  return router;
}
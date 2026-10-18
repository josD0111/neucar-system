// src/main/api/routes/compras.ts
//
// Registro de Compras (HU-16). Cada Compra crea un lote de stock y suma al
// stock agregado del Producto (ver entidades-dominio.md, sección 14).
//
// Decisión del 15/10/2026: este es el único punto de entrada para dar de
// alta un Producto nuevo. El formulario de Compra admite producto existente
// (productoId) o producto nuevo (productoNuevo); si es nuevo, el Producto y
// su primer lote se crean en la misma operación, dentro de una transacción.

import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../server";
import { sendOk, sendBadRequest } from "../response";

interface ProductoNuevoInput {
  nombre?: string;
  categoriaId?: number;
  precioBase?: number | string;
  stockMinimo?: number | null;
}

class ErrorValidacion extends Error {}

export function comprasRouter(db: Db): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const { productoId } = req.query;
    const rows = productoId
      ? await db.select().from(schema.compras).where(eq(schema.compras.productoId, Number(productoId)))
      : await db.select().from(schema.compras);
    sendOk(res, rows);
  });

  router.post("/", async (req, res) => {
    const {
      productoId,
      productoNuevo,
      proveedorId,
      fecha,
      cantidad,
      precioCompra,
      garantiaProveedor,
      factura,
    } = req.body ?? {};

    if (!proveedorId) {
      sendBadRequest(res, "El proveedor es obligatorio.");
      return;
    }
    if (!fecha) {
      sendBadRequest(res, "La fecha es obligatoria.");
      return;
    }
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      sendBadRequest(res, "La cantidad debe ser mayor a 0.");
      return;
    }
    if (precioCompra === undefined || precioCompra === null) {
      sendBadRequest(res, "El precio de compra es obligatorio.");
      return;
    }
    if (!productoId && !productoNuevo) {
      sendBadRequest(res, "Debe indicarse un producto existente o los datos de un producto nuevo.");
      return;
    }

    try {
      const lote = await db.transaction(async (tx) => {
        let idProducto: number;

        if (productoId) {
          idProducto = Number(productoId);
        } else {
          const datos = productoNuevo as ProductoNuevoInput;
          if (!datos.nombre || !datos.categoriaId || datos.precioBase === undefined) {
            throw new ErrorValidacion(
              "Para dar de alta un producto nuevo se necesita nombre, categoría y precio base.",
            );
          }
          const [nuevo] = await tx
            .insert(schema.productos)
            .values({
              nombre: datos.nombre,
              categoriaId: Number(datos.categoriaId),
              precioBase: String(datos.precioBase),
              stockMinimo: datos.stockMinimo ?? null,
              stock: 0,
            })
            .returning();
          idProducto = nuevo.id;
        }

        const [loteCreado] = await tx
          .insert(schema.compras)
          .values({
            productoId: idProducto,
            proveedorId: Number(proveedorId),
            fecha,
            cantidad: cantidadNum,
            cantidadDisponible: cantidadNum,
            precioCompra: String(precioCompra),
            garantiaProveedor: garantiaProveedor ?? null,
            factura: factura ?? null,
          })
          .returning();

        await tx
          .update(schema.productos)
          .set({ stock: sql`${schema.productos.stock} + ${cantidadNum}` })
          .where(eq(schema.productos.id, idProducto));

        return loteCreado;
      });

      sendOk(res, lote, 201);
    } catch (err) {
      if (err instanceof ErrorValidacion) {
        sendBadRequest(res, err.message);
        return;
      }
      throw err;
    }
  });

  return router;
}
// src/main/services/marcas.ts
//
// Marcas de producto (HU-37). Entidad propia, igual que Categoría. Las
// marcas se pueden eliminar solo si ningún producto las usa.

import { eq, sql } from "drizzle-orm";
import type { Db } from "../api/server";
import { marcas, productos } from "../db/schema";
import type { Resultado } from "./clientes";

export type Marca = typeof marcas.$inferSelect;

const MAX_NOMBRE = 80;

// Devuelve el nombre sin espacios sobrantes, o null si no es válido.
function nombreValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  return t !== "" && t.length <= MAX_NOMBRE ? t : null;
}

// ¿Ya hay otra marca con ese nombre? (sin distinguir mayúsculas)
async function existeNombre(db: Db, nombre: string, exceptoId?: number): Promise<boolean> {
  const filas = await db
    .select({ id: marcas.id })
    .from(marcas)
    .where(sql`lower(${marcas.nombre}) = ${nombre.toLowerCase()}`);
  return filas.some((f) => f.id !== exceptoId);
}

export async function listarMarcas(db: Db): Promise<Marca[]> {
  return db.select().from(marcas).orderBy(sql`lower(${marcas.nombre})`);
}

export async function crearMarca(db: Db, body: unknown): Promise<Resultado<Marca>> {
  const b = (body ?? {}) as Record<string, unknown>;
  const nombre = nombreValido(b.nombre);
  if (nombre === null) {
    return { ok: false, status: 400, mensaje: `El nombre es obligatorio (máximo ${MAX_NOMBRE} caracteres)` };
  }
  if (await existeNombre(db, nombre)) {
    return { ok: false, status: 400, mensaje: `Ya existe una marca llamada «${nombre}»` };
  }
  const [fila] = await db.insert(marcas).values({ nombre }).returning();
  return { ok: true, data: fila };
}

export async function actualizarMarca(db: Db, id: number, body: unknown): Promise<Resultado<Marca>> {
  const b = (body ?? {}) as Record<string, unknown>;
  const nombre = nombreValido(b.nombre);
  if (nombre === null) {
    return { ok: false, status: 400, mensaje: `El nombre es obligatorio (máximo ${MAX_NOMBRE} caracteres)` };
  }
  if (await existeNombre(db, nombre, id)) {
    return { ok: false, status: 400, mensaje: `Ya existe una marca llamada «${nombre}»` };
  }
  const [fila] = await db.update(marcas).set({ nombre }).where(eq(marcas.id, id)).returning();
  if (!fila) return { ok: false, status: 404, mensaje: "Marca no encontrada" };
  return { ok: true, data: fila };
}

export async function eliminarMarca(db: Db, id: number): Promise<Resultado<{ id: number }>> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(productos)
    .where(eq(productos.marcaId, id));
  if (total > 0) {
    return {
      ok: false,
      status: 400,
      mensaje: "No se puede eliminar: hay productos con esta marca. Cambiales la marca primero.",
    };
  }
  const [fila] = await db.delete(marcas).where(eq(marcas.id, id)).returning();
  if (!fila) return { ok: false, status: 404, mensaje: "Marca no encontrada" };
  return { ok: true, data: { id } };
}
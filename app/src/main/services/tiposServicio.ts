// src/main/services/tiposServicio.ts
//
// Catálogo de tipos de servicio (alineación, balanceo, mantenimiento, etc.).
// Cada tipo tiene un monto base opcional y un indicador de si pide la cantidad
// de ruedas al cargarlo en una orden. Los tipos no se borran: se deshabilitan,
// para no romper las órdenes que ya los usaron.

import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../api/server";
import { tiposServicio } from "../db/schema";
import type { Resultado } from "./clientes";
import { aCentavos, centavosATexto } from "./ordenesServicio";

export type TipoServicio = typeof tiposServicio.$inferSelect;

const MAX_NOMBRE = 100;

// Devuelve el nombre sin espacios sobrantes, o null si no es válido.
function nombreValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  return t !== "" && t.length <= MAX_NOMBRE ? t : null;
}

// Interpreta el monto base recibido:
//   - ausente / null / "" → null (el servicio no tiene precio fijo)
//   - número > 0 con hasta 2 decimales → ese monto como texto ("117600.00")
//   - cualquier otra cosa → undefined (inválido)
function montoBaseOpcional(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null || valor === "") return null;
  const centavos = aCentavos(valor);
  return centavos === null ? undefined : centavosATexto(centavos);
}

const MAX_INTERVALO_KM = 1_000_000;
const MENSAJE_INTERVALO = `El intervalo debe ser un entero entre 1 y ${MAX_INTERVALO_KM} km, o quedar vacío`;

// ausente / null / "" → null (sin aviso de mantenimiento); entero válido → ese valor; otra cosa → undefined.
function intervaloKmOpcional(valor: unknown): number | null | undefined {
  if (valor === undefined || valor === null || valor === "") return null;
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0 && valor <= MAX_INTERVALO_KM
    ? valor
    : undefined;
}

// ¿Ya hay otro tipo con ese nombre? (sin distinguir mayúsculas)
async function existeNombre(db: Db, nombre: string, exceptoId?: number): Promise<boolean> {
  const filas = await db
    .select({ id: tiposServicio.id })
    .from(tiposServicio)
    .where(sql`lower(${tiposServicio.nombre}) = ${nombre.toLowerCase()}`);
  return filas.some((f) => f.id !== exceptoId);
}

// Lista el catálogo ordenado por nombre. Por defecto solo los activos (los que
// se pueden elegir en una orden); la pantalla de administración pide todos.
export async function listarTiposServicio(db: Db, incluirInactivos = false): Promise<TipoServicio[]> {
  return db
    .select()
    .from(tiposServicio)
    .where(incluirInactivos ? undefined : eq(tiposServicio.activo, true))
    .orderBy(asc(tiposServicio.nombre));
}

export async function crearTipoServicio(db: Db, body: unknown): Promise<Resultado<TipoServicio>> {
  const b = (body ?? {}) as Record<string, unknown>;

  const nombre = nombreValido(b.nombre);
  if (nombre === null) {
    return { ok: false, status: 400, mensaje: `El nombre es obligatorio (máximo ${MAX_NOMBRE} caracteres)` };
  }

  const montoBase = montoBaseOpcional(b.montoBase);
  if (montoBase === undefined) {
    return {
      ok: false,
      status: 400,
      mensaje: "El monto base debe ser un número mayor a cero, con hasta 2 decimales, o quedar vacío",
    };
  }

  if (b.requiereRuedas !== undefined && typeof b.requiereRuedas !== "boolean") {
    return { ok: false, status: 400, mensaje: "requiereRuedas debe ser verdadero o falso" };
  }
  const requiereRuedas = b.requiereRuedas === true;

  const intervaloKm = intervaloKmOpcional(b.intervaloKm);
  if (intervaloKm === undefined) return { ok: false, status: 400, mensaje: MENSAJE_INTERVALO };

  if (await existeNombre(db, nombre)) {
    return { ok: false, status: 400, mensaje: `Ya existe un tipo de servicio llamado «${nombre}»` };
  }

  const [fila] = await db.insert(tiposServicio).values({ nombre, montoBase, requiereRuedas, intervaloKm }).returning();
  return { ok: true, data: fila };
}

// Edición parcial: solo se cambian los campos que vengan en el cuerpo.
// Cambiar el monto o las ruedas NO modifica las órdenes ya registradas
// (guardan su propia copia del precio de referencia).
export async function actualizarTipoServicio(db: Db, id: number, body: unknown): Promise<Resultado<TipoServicio>> {
  const b = (body ?? {}) as Record<string, unknown>;

  const [actual] = await db.select().from(tiposServicio).where(eq(tiposServicio.id, id)).limit(1);
  if (!actual) return { ok: false, status: 404, mensaje: "Tipo de servicio no encontrado" };

  const cambios: Partial<typeof tiposServicio.$inferInsert> = {};

  if ("nombre" in b) {
    const nombre = nombreValido(b.nombre);
    if (nombre === null) {
      return { ok: false, status: 400, mensaje: `El nombre es obligatorio (máximo ${MAX_NOMBRE} caracteres)` };
    }
    if (await existeNombre(db, nombre, id)) {
      return { ok: false, status: 400, mensaje: `Ya existe un tipo de servicio llamado «${nombre}»` };
    }
    cambios.nombre = nombre;
  }

  if ("montoBase" in b) {
    const montoBase = montoBaseOpcional(b.montoBase);
    if (montoBase === undefined) {
      return {
        ok: false,
        status: 400,
        mensaje: "El monto base debe ser un número mayor a cero, con hasta 2 decimales, o quedar vacío",
      };
    }
    cambios.montoBase = montoBase;
  }

  if ("requiereRuedas" in b) {
    if (typeof b.requiereRuedas !== "boolean") {
      return { ok: false, status: 400, mensaje: "requiereRuedas debe ser verdadero o falso" };
    }
    cambios.requiereRuedas = b.requiereRuedas;
  }

  if ("intervaloKm" in b) {
    const intervaloKm = intervaloKmOpcional(b.intervaloKm);
    if (intervaloKm === undefined) return { ok: false, status: 400, mensaje: MENSAJE_INTERVALO };
    cambios.intervaloKm = intervaloKm;
  }

  if ("activo" in b) {
    if (typeof b.activo !== "boolean") {
      return { ok: false, status: 400, mensaje: "activo debe ser verdadero o falso" };
    }
    cambios.activo = b.activo;
  }

  if (Object.keys(cambios).length === 0) {
    return { ok: false, status: 400, mensaje: "No hay cambios para guardar" };
  }

  const [fila] = await db.update(tiposServicio).set(cambios).where(eq(tiposServicio.id, id)).returning();
  return { ok: true, data: fila };
}
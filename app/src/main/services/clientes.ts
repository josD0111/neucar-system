// src/main/services/clientes.ts
//
// Lógica de negocio de Clientes (HU-09): validación, búsqueda, alta, edición
// y habilitación/deshabilitación. Los clientes NUNCA se borran: se marcan
// como inactivos para no romper el historial de ventas y servicios.

import { and, asc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import type { Db } from "../api/server";
import { clientes } from "../db/schema";

// Tipo de una fila de la tabla clientes (derivado del esquema).
export type Cliente = typeof clientes.$inferSelect;

// Datos que el usuario puede cargar o editar de un cliente.
export interface DatosCliente {
  nombre: string;
  cedula: string | null;
  celular: string | null;
  ruc: string | null;
}

// Resultado de una operación: éxito con datos, o error con un código HTTP
// y un mensaje listo para mostrar al usuario.
export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; mensaje: string };

// Normaliza un campo de texto opcional:
//   - vacío o ausente → null
//   - texto válido    → texto sin espacios sobrantes
//   - inválido (no es texto o es demasiado largo) → undefined
function textoOpcional(valor: unknown, max: number): string | null | undefined {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") return undefined;
  const t = valor.trim();
  if (t === "") return null;
  return t.length <= max ? t : undefined;
}

// Valida y limpia el cuerpo recibido. Solo el nombre es obligatorio: un cliente
// de confianza puede registrarse con el nombre solamente (ver HU-27).
export function validarDatosCliente(body: unknown): Resultado<DatosCliente> {
  const b = (body ?? {}) as Record<string, unknown>;

  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : "";
  if (!nombre) return { ok: false, status: 400, mensaje: "El nombre es obligatorio" };
  if (nombre.length > 150) {
    return { ok: false, status: 400, mensaje: "El nombre es demasiado largo (máximo 150 caracteres)" };
  }

  const cedula = textoOpcional(b.cedula, 30);
  if (cedula === undefined) return { ok: false, status: 400, mensaje: "La cédula no es válida (máximo 30 caracteres)" };

  const celular = textoOpcional(b.celular, 30);
  if (celular === undefined) return { ok: false, status: 400, mensaje: "El celular no es válido (máximo 30 caracteres)" };
  // El celular solo admite dígitos y los símbolos habituales de un teléfono
  // (+, -, paréntesis y espacios), y debe tener al menos un número.
  if (celular !== null && (!/^[0-9+\-()\s]+$/.test(celular) || !/[0-9]/.test(celular))) {
    return {
      ok: false,
      status: 400,
      mensaje: "El celular solo puede contener números (también + - ( ) y espacios)",
    };
  }
  // El RUC se guarda en mayúsculas y con formato número-DV: empieza con un dígito,
  // puede llevar letras (algunos RUC antiguos las tienen) y, opcionalmente, un guion
  // seguido de un solo carácter, el dígito verificador. Ej.: 80080099-0
  const rucTexto = textoOpcional(b.ruc, 30);
  if (rucTexto === undefined) return { ok: false, status: 400, mensaje: "El RUC no es válido (máximo 30 caracteres)" };
  const ruc = rucTexto === null ? null : rucTexto.toUpperCase();
  if (ruc !== null && !/^[0-9][0-9A-Z]*(-[0-9A-Z])?$/.test(ruc)) {
    return {
      ok: false,
      status: 400,
      mensaje: "El RUC no es válido. Usá el formato número-dígito, por ejemplo 80080099-0",
    };
  }
  return { ok: true, data: { nombre, cedula, celular, ruc } };
}

// Indica si ya hay OTRO cliente con esa cédula (para no duplicar registros).
// "excluirId" evita que un cliente se compare consigo mismo al editarlo.
async function cedulaEnUso(db: Db, cedula: string, excluirId?: number): Promise<boolean> {
  const condiciones: SQL[] = [eq(clientes.cedula, cedula)];
  if (excluirId !== undefined) condiciones.push(ne(clientes.id, excluirId));
  const filas = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(...condiciones))
    .limit(1);
  return filas.length > 0;
}

// Lista clientes ordenados por nombre. Por defecto solo los activos.
// "busqueda" filtra por nombre, cédula o celular (sin distinguir mayúsculas).
export async function listarClientes(
  db: Db,
  opciones: { busqueda?: string; incluirInactivos?: boolean } = {},
): Promise<Cliente[]> {
  const condiciones: SQL[] = [];
  if (!opciones.incluirInactivos) condiciones.push(eq(clientes.activo, true));

  const texto = opciones.busqueda?.trim();
  if (texto) {
    const patron = `%${texto}%`;
    condiciones.push(
      or(
        ilike(clientes.nombre, patron),
        ilike(clientes.cedula, patron),
        ilike(clientes.celular, patron),
      ) as SQL,
    );
  }

  return db
    .select()
    .from(clientes)
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(asc(clientes.nombre));
}

// Obtiene un cliente por id (activo o no).
export async function obtenerCliente(db: Db, id: number): Promise<Resultado<Cliente>> {
  const [fila] = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  if (!fila) return { ok: false, status: 404, mensaje: "Cliente no encontrado" };
  return { ok: true, data: fila };
}

// Crea un cliente nuevo (siempre queda activo).
export async function crearCliente(db: Db, body: unknown): Promise<Resultado<Cliente>> {
  const v = validarDatosCliente(body);
  if (!v.ok) return v;

  if (v.data.cedula && (await cedulaEnUso(db, v.data.cedula))) {
    return { ok: false, status: 409, mensaje: "Ya existe un cliente con esa cédula" };
  }

  const [fila] = await db.insert(clientes).values(v.data).returning();
  return { ok: true, data: fila };
}

// Edita los datos de un cliente existente (no cambia su estado activo/inactivo).
export async function actualizarCliente(db: Db, id: number, body: unknown): Promise<Resultado<Cliente>> {
  const v = validarDatosCliente(body);
  if (!v.ok) return v;

  if (v.data.cedula && (await cedulaEnUso(db, v.data.cedula, id))) {
    return { ok: false, status: 409, mensaje: "Ya existe otro cliente con esa cédula" };
  }

  const [fila] = await db.update(clientes).set(v.data).where(eq(clientes.id, id)).returning();
  if (!fila) return { ok: false, status: 404, mensaje: "Cliente no encontrado" };
  return { ok: true, data: fila };
}

// Deshabilita (activo = false) o vuelve a habilitar (activo = true) a un cliente.
export async function cambiarEstadoCliente(db: Db, id: number, activo: unknown): Promise<Resultado<Cliente>> {
  if (typeof activo !== "boolean") {
    return { ok: false, status: 400, mensaje: "Indicá si el cliente queda activo (true) o inactivo (false)" };
  }
  const [fila] = await db.update(clientes).set({ activo }).where(eq(clientes.id, id)).returning();
  if (!fila) return { ok: false, status: 404, mensaje: "Cliente no encontrado" };
  return { ok: true, data: fila };
}
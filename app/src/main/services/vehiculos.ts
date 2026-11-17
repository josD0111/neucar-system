// src/main/services/vehiculos.ts
//
// Lógica de negocio de Vehículos (soporte de HU-22, HU-26 y HU-27): validación,
// búsqueda, alta y edición. Un cliente puede tener varios vehículos, y también
// existen vehículos de cliente "casual" (clienteId = null). Los vehículos NO
// se borran: las Órdenes de Servicio los referencian y su historial (HU-26)
// debe conservarse.

import { and, asc, eq, ilike, isNull, ne, or, type SQL } from "drizzle-orm";
import type { Db } from "../api/server";
import { clientes, vehiculos } from "../db/schema";
import type { Resultado } from "./clientes";
import type { Rol } from "./auth";

// Vehículo tal como lo devuelve la API: sus datos más el nombre del dueño
// (null si es de un cliente casual), para mostrarlo sin una segunda consulta.
export interface Vehiculo {
  id: number;
  clienteId: number | null;
  marca: string | null;
  chapa: string | null;
  color: string | null;
  clienteNombre: string | null;
}

// Datos que el usuario puede cargar o editar de un vehículo.
export interface DatosVehiculo {
  clienteId: number | null;
  marca: string | null;
  chapa: string | null;
  color: string | null;
}

// Columnas que se leen de la base (vehículo + nombre del cliente dueño).
const columnas = {
  id: vehiculos.id,
  clienteId: vehiculos.clienteId,
  marca: vehiculos.marca,
  chapa: vehiculos.chapa,
  color: vehiculos.color,
  clienteNombre: clientes.nombre,
};

// Normaliza un campo de texto opcional (misma lógica que en services/clientes.ts):
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

// Valida y limpia el cuerpo recibido.
//   - clienteId: opcional (null = cliente casual); si viene, entero positivo.
//   - chapa: se guarda en mayúsculas y sin espacios (ABC 123 → ABC123), para que
//     la misma chapa escrita de distintas formas no genere registros duplicados.
//   - Se exige al menos la marca o la chapa: un vehículo sin ningún dato de
//     identificación no sirve para el historial.
export function validarDatosVehiculo(body: unknown): Resultado<DatosVehiculo> {
  const b = (body ?? {}) as Record<string, unknown>;

  let clienteId: number | null = null;
  if (b.clienteId !== undefined && b.clienteId !== null) {
    if (typeof b.clienteId !== "number" || !Number.isInteger(b.clienteId) || b.clienteId <= 0) {
      return { ok: false, status: 400, mensaje: "El cliente indicado no es válido" };
    }
    clienteId = b.clienteId;
  }

  const marca = textoOpcional(b.marca, 80);
  if (marca === undefined) return { ok: false, status: 400, mensaje: "La marca no es válida (máximo 80 caracteres)" };

  const chapaTexto = textoOpcional(b.chapa, 30);
  if (chapaTexto === undefined) return { ok: false, status: 400, mensaje: "La chapa no es válida (máximo 30 caracteres)" };
  const chapa = chapaTexto === null ? null : chapaTexto.replace(/\s+/g, "").toUpperCase();
  if (chapa !== null && !/^[A-Z0-9-]+$/.test(chapa)) {
    return { ok: false, status: 400, mensaje: "La chapa solo puede contener letras, números y guiones" };
  }

  const color = textoOpcional(b.color, 40);
  if (color === undefined) return { ok: false, status: 400, mensaje: "El color no es válido (máximo 40 caracteres)" };

  if (!marca && !chapa) {
    return { ok: false, status: 400, mensaje: "Indicá al menos la marca o la chapa del vehículo" };
  }

  return { ok: true, data: { clienteId, marca, chapa, color } };
}

// Indica si ya hay OTRO vehículo con esa chapa para el mismo cliente (o entre los
// de cliente casual, si clienteId es null). La misma chapa SÍ puede existir bajo
// distintos clientes: un vehículo puede cambiar de dueño. "excluirId" evita que
// un vehículo se compare consigo mismo al editarlo.
async function chapaEnUso(db: Db, chapa: string, clienteId: number | null, excluirId?: number): Promise<boolean> {
  const condiciones: SQL[] = [
    eq(vehiculos.chapa, chapa),
    clienteId === null ? isNull(vehiculos.clienteId) : eq(vehiculos.clienteId, clienteId),
  ];
  if (excluirId !== undefined) condiciones.push(ne(vehiculos.id, excluirId));
  const filas = await db
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(and(...condiciones))
    .limit(1);
  return filas.length > 0;
}

// Reglas que dependen de la base de datos (el cliente existe, la chapa no está
// repetida). Devuelve el error a informar, o null si todo está bien.
async function comprobarReglas(
  db: Db,
  datos: DatosVehiculo,
  excluirId?: number,
): Promise<{ status: number; mensaje: string } | null> {
  if (datos.clienteId !== null) {
    const [cliente] = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.id, datos.clienteId)).limit(1);
    if (!cliente) return { status: 400, mensaje: "El cliente indicado no existe" };
  }
  if (datos.chapa && (await chapaEnUso(db, datos.chapa, datos.clienteId, excluirId))) {
    return { status: 409, mensaje: "Ya existe un vehículo con esa chapa para ese cliente" };
  }
  return null;
}

// Lista vehículos ordenados por chapa. Filtros opcionales:
//   - clienteId: solo los vehículos de ese cliente (para elegirlos al cargar una orden).
//   - busqueda: por chapa, marca o nombre del cliente (sin distinguir mayúsculas).
export async function listarVehiculos(
  db: Db,
  opciones: { clienteId?: number; busqueda?: string } = {},
): Promise<Vehiculo[]> {
  const condiciones: SQL[] = [];
  if (opciones.clienteId !== undefined) condiciones.push(eq(vehiculos.clienteId, opciones.clienteId));

  const texto = opciones.busqueda?.trim();
  if (texto) {
    const patron = `%${texto}%`;
    // La chapa se guarda sin espacios, así que se busca también sin ellos.
    const patronChapa = `%${texto.replace(/\s+/g, "")}%`;
    condiciones.push(
      or(ilike(vehiculos.chapa, patronChapa), ilike(vehiculos.marca, patron), ilike(clientes.nombre, patron)) as SQL,
    );
  }

  return db
    .select(columnas)
    .from(vehiculos)
    .leftJoin(clientes, eq(vehiculos.clienteId, clientes.id))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(asc(vehiculos.chapa));
}

// Obtiene un vehículo por id.
export async function obtenerVehiculo(db: Db, id: number): Promise<Resultado<Vehiculo>> {
  const [fila] = await db
    .select(columnas)
    .from(vehiculos)
    .leftJoin(clientes, eq(vehiculos.clienteId, clientes.id))
    .where(eq(vehiculos.id, id))
    .limit(1);
  if (!fila) return { ok: false, status: 404, mensaje: "Vehículo no encontrado" };
  return { ok: true, data: fila };
}

// Crea un vehículo nuevo.
export async function crearVehiculo(db: Db, body: unknown): Promise<Resultado<Vehiculo>> {
  const v = validarDatosVehiculo(body);
  if (!v.ok) return v;

  const error = await comprobarReglas(db, v.data);
  if (error) return { ok: false, ...error };

  const [fila] = await db.insert(vehiculos).values(v.data).returning({ id: vehiculos.id });
  return obtenerVehiculo(db, fila.id);
}

const MENSAJE_CAMBIO_DUENO =
  "Solo el Administrador puede cambiar o quitar el dueño de un vehículo que ya tiene uno";

// Edita los datos de un vehículo existente (incluido su dueño). Asignar dueño a un
// vehículo que no tiene lo puede hacer cualquier usuario; cambiar o quitar un dueño
// ya registrado es solo del Administrador (la validación es acá, no solo en la pantalla).
export async function actualizarVehiculo(db: Db, id: number, rol: Rol, body: unknown): Promise<Resultado<Vehiculo>> {
  const v = validarDatosVehiculo(body);
  if (!v.ok) return v;

  const [actual] = await db.select({ clienteId: vehiculos.clienteId }).from(vehiculos).where(eq(vehiculos.id, id)).limit(1);
  if (!actual) return { ok: false, status: 404, mensaje: "Vehículo no encontrado" };
  if (actual.clienteId !== null && v.data.clienteId !== actual.clienteId && rol !== "Administrador") {
    return { ok: false, status: 403, mensaje: MENSAJE_CAMBIO_DUENO };
  }

  const error = await comprobarReglas(db, v.data, id);
  if (error) return { ok: false, ...error };

  const [fila] = await db.update(vehiculos).set(v.data).where(eq(vehiculos.id, id)).returning({ id: vehiculos.id });
  if (!fila) return { ok: false, status: 404, mensaje: "Vehículo no encontrado" };
  return obtenerVehiculo(db, fila.id);
}

// Asigna un dueño a un vehículo (por ejemplo, uno que estaba registrado sin dueño y
// ahora se quiere vincular a un cliente para poder hacerle servicios a crédito).
//   - clienteId: obligatorio; el cliente debe existir y estar activo.
//   - Si el vehículo ya tiene otro dueño, solo el Administrador puede cambiarlo.
//   - Si el cliente ya tiene otro vehículo con la misma chapa, se rechaza (409).
//   - Si ya es el dueño, no hay nada que cambiar y se devuelve el vehículo tal cual.
export async function asignarDuenoVehiculo(db: Db, id: number, rol: Rol, body: unknown): Promise<Resultado<Vehiculo>> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.clienteId !== "number" || !Number.isInteger(b.clienteId) || b.clienteId <= 0) {
    return { ok: false, status: 400, mensaje: "Indicá el cliente que será el dueño del vehículo" };
  }
  const nuevoClienteId = b.clienteId;

  const [vehiculo] = await db
    .select({ id: vehiculos.id, clienteId: vehiculos.clienteId, chapa: vehiculos.chapa })
    .from(vehiculos)
    .where(eq(vehiculos.id, id))
    .limit(1);
  if (!vehiculo) return { ok: false, status: 404, mensaje: "Vehículo no encontrado" };

  if (vehiculo.clienteId === nuevoClienteId) return obtenerVehiculo(db, id);
  if (vehiculo.clienteId !== null && rol !== "Administrador") {
    return { ok: false, status: 403, mensaje: MENSAJE_CAMBIO_DUENO };
  }

  const [cliente] = await db
    .select({ id: clientes.id, activo: clientes.activo })
    .from(clientes)
    .where(eq(clientes.id, nuevoClienteId))
    .limit(1);
  if (!cliente) return { ok: false, status: 400, mensaje: "El cliente indicado no existe" };
  if (!cliente.activo) return { ok: false, status: 400, mensaje: "El cliente indicado está deshabilitado" };

  if (vehiculo.chapa && (await chapaEnUso(db, vehiculo.chapa, nuevoClienteId, id))) {
    return { ok: false, status: 409, mensaje: "Ese cliente ya tiene registrado otro vehículo con la misma chapa" };
  }

  await db.update(vehiculos).set({ clienteId: nuevoClienteId }).where(eq(vehiculos.id, id));
  return obtenerVehiculo(db, id);
}
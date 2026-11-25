// src/main/services/compras.ts
//
// Historial de compras (HU-38). Pagina por DÍAS CALENDARIO COMPLETOS, igual
// que el historial de ventas. Como compras.fecha es una columna `date` (texto
// 'AAAA-MM-DD', sin hora), no hay problema de huso horario: se pide primero
// la lista de días distintos y después las filas de esos días.

import { and, desc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
import type { Db } from "../api/server";
import { compras, productos, proveedores } from "../db/schema";
import type { Resultado } from "./clientes";

export interface CompraListado {
  id: number;
  fecha: string;
  productoId: number;
  productoNombre: string;
  proveedorId: number;
  proveedorNombre: string;
  cantidad: number;
  cantidadDisponible: number;
  precioCompra: string;
  garantiaProveedor: number | null;
  factura: string | null;
}

export interface FiltrosListarCompras {
  proveedorId?: number;
  productoId?: number;
  fechaDesde?: string; // 'AAAA-MM-DD', inclusive
  fechaHasta?: string; // 'AAAA-MM-DD', inclusive
  antesDe?: string; // cursor: días estrictamente anteriores a esta fecha
  dias?: number; // cuántos días calendario devolver
}

export interface PaginaCompras {
  items: CompraListado[];
  hayMas: boolean;
  antesDe: string | null;
}

const DIAS_POR_PAGINA_DEFECTO = 7;
const MAX_DIAS = 60;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function idInvalido(v: number | undefined): boolean {
  return v !== undefined && !(Number.isInteger(v) && v > 0);
}

export async function listarCompras(
  db: Db,
  filtros: FiltrosListarCompras = {},
): Promise<Resultado<PaginaCompras>> {
  for (const [nombre, valor] of [
    ["fechaDesde", filtros.fechaDesde],
    ["fechaHasta", filtros.fechaHasta],
    ["antesDe", filtros.antesDe],
  ] as const) {
    if (valor !== undefined && !FECHA_RE.test(valor)) {
      return { ok: false, status: 400, mensaje: `${nombre} debe tener el formato AAAA-MM-DD` };
    }
  }
  if (idInvalido(filtros.proveedorId) || idInvalido(filtros.productoId)) {
    return { ok: false, status: 400, mensaje: "El proveedor o el producto indicado no es válido" };
  }
  if (filtros.dias !== undefined && !Number.isInteger(filtros.dias)) {
    return { ok: false, status: 400, mensaje: "dias debe ser un número entero" };
  }
  const dias = Math.min(MAX_DIAS, Math.max(1, filtros.dias ?? DIAS_POR_PAGINA_DEFECTO));

  const condiciones: SQL[] = [];
  if (filtros.proveedorId !== undefined) condiciones.push(eq(compras.proveedorId, filtros.proveedorId));
  if (filtros.productoId !== undefined) condiciones.push(eq(compras.productoId, filtros.productoId));
  if (filtros.fechaDesde) condiciones.push(gte(compras.fecha, filtros.fechaDesde));
  if (filtros.fechaHasta) condiciones.push(lte(compras.fecha, filtros.fechaHasta));
  if (filtros.antesDe) condiciones.push(lt(compras.fecha, filtros.antesDe));

  // Un día de más que los pedidos: si aparece, hay más páginas.
  const filasDias = await db
    .selectDistinct({ fecha: compras.fecha })
    .from(compras)
    .where(and(...condiciones))
    .orderBy(desc(compras.fecha))
    .limit(dias + 1);

  const hayMas = filasDias.length > dias;
  const diasIncluidos = filasDias.slice(0, dias).map((f) => f.fecha);
  if (diasIncluidos.length === 0) {
    return { ok: true, data: { items: [], hayMas: false, antesDe: null } };
  }
  const ultimoDia = diasIncluidos[diasIncluidos.length - 1];

  const items = await db
    .select({
      id: compras.id,
      fecha: compras.fecha,
      productoId: compras.productoId,
      productoNombre: productos.nombre,
      proveedorId: compras.proveedorId,
      proveedorNombre: proveedores.nombre,
      cantidad: compras.cantidad,
      cantidadDisponible: compras.cantidadDisponible,
      precioCompra: compras.precioCompra,
      garantiaProveedor: compras.garantiaProveedor,
      factura: compras.factura,
    })
    .from(compras)
    .innerJoin(productos, eq(compras.productoId, productos.id))
    .innerJoin(proveedores, eq(compras.proveedorId, proveedores.id))
    .where(and(...condiciones, gte(compras.fecha, ultimoDia)))
    .orderBy(desc(compras.fecha), desc(compras.id));

  return { ok: true, data: { items, hayMas, antesDe: hayMas ? ultimoDia : null } };
}
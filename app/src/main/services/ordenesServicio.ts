// src/main/services/ordenesServicio.ts
//
// Lógica de negocio de Órdenes de Servicio (HU-22, HU-22.1, HU-23, HU-26, HU-27).
// Una Orden representa la VISITA del cliente: agrupa vehículo, cliente, quién la
// registró y la forma de pago, y contiene uno o más Servicios de detalle (tipo,
// monto y un detalle opcional). Las órdenes NO se borran ni se editan en este
// sprint: son el historial del taller (HU-26).
//
// Esta capa NO registra pagos ni calcula saldos: eso es del servicio de Pagos
// (punto 4). Solo deja guardados el monto_total (calculado acá, en el servidor)
// y, si la orden es a crédito, la fecha de pago prevista (HU-10.2).

import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Db } from "../api/server";
import { clientes, ordenesServicio, servicios, usuarios, vehiculos } from "../db/schema";
import type { Resultado } from "./clientes";

// Formas de pago y de comprobante admitidas (coinciden con los comentarios de schema.ts).
export type TipoPago = "Contado" | "Crédito";
const TIPOS_COMPROBANTE: readonly string[] = ["Factura común", "Factura electrónica"];

// Límites razonables. MAX_CENTAVOS corresponde al máximo de numeric(12,2) del esquema.
const MAX_SERVICIOS = 50;
const MAX_CENTAVOS = 999_999_999_999;

// Un Servicio de detalle tal como lo devuelve la API. "monto" es texto con dos
// decimales (ej. "150000.00"), que es como Postgres devuelve las columnas numeric.
export interface ServicioDetalle {
  id: number;
  ordenId: number;
  tipoServicio: string;
  monto: string;
  detalle: string | null;
}

// Una Orden con sus datos de cliente, vehículo y usuario ya resueltos (para
// mostrarla sin consultas extra) y su lista de servicios.
export interface OrdenServicio {
  id: number;
  fecha: Date;
  clienteId: number;
  clienteNombre: string;
  vehiculoId: number;
  vehiculoMarca: string | null;
  vehiculoChapa: string | null;
  vehiculoColor: string | null;
  usuarioId: number;
  usuarioNombre: string;
  tipoPago: string;
  montoTotal: string;
  fechaPagoPrevista: string | null;
  tipoComprobante: string | null;
  servicios: ServicioDetalle[];
}

// Datos ya validados de un servicio. El monto se maneja en centavos (entero)
// para sumar sin errores de redondeo de decimales.
interface DatosServicio {
  tipoServicio: string;
  centavos: number;
  detalle: string | null;
}

// Datos ya validados de una orden nueva.
export interface DatosOrden {
  clienteId: number;
  vehiculoId: number;
  tipoPago: TipoPago;
  fechaPagoPrevista: string | null;
  tipoComprobante: string | null;
  servicios: DatosServicio[];
}

// --- Utilidades de validación ---------------------------------------------

// Devuelve el número si es un entero positivo; si no, null.
function enteroPositivo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0 ? valor : null;
}

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

// Comprueba que un texto AAAA-MM-DD sea una fecha real (rechaza 2026-02-31).
function fechaValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
}

// Convierte un monto recibido (número) a centavos enteros. Devuelve null si no
// es un número positivo, finito y con a lo sumo dos decimales.
function aCentavos(monto: unknown): number | null {
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) return null;
  const centavos = Math.round(monto * 100);
  if (Math.abs(monto * 100 - centavos) > 1e-6) return null; // más de 2 decimales
  return centavos > MAX_CENTAVOS ? null : centavos;
}

// Convierte centavos enteros al texto con dos decimales que espera la columna
// numeric (ej. 15000050 → "150000.50").
function centavosATexto(centavos: number): string {
  const entero = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return `${entero}.${String(resto).padStart(2, "0")}`;
}

// Valida y limpia el cuerpo recibido para crear una orden. Reglas:
//   - clienteId y vehiculoId: obligatorios (enteros positivos).
//   - tipoPago: "Contado" o "Crédito" (se acepta "Credito" sin tilde).
//   - fechaPagoPrevista: solo se conserva si la orden es a crédito; formato AAAA-MM-DD.
//   - servicios: al menos uno; cada uno con tipo (obligatorio), monto > 0 y detalle opcional.
//     El monto TOTAL no se recibe: se calcula acá como la suma de los servicios.
export function validarDatosOrden(body: unknown): Resultado<DatosOrden> {
  const b = (body ?? {}) as Record<string, unknown>;

  const clienteId = enteroPositivo(b.clienteId);
  if (clienteId === null) return { ok: false, status: 400, mensaje: "Indicá el cliente de la orden" };

  const vehiculoId = enteroPositivo(b.vehiculoId);
  if (vehiculoId === null) return { ok: false, status: 400, mensaje: "Indicá el vehículo de la orden" };

  const tp = typeof b.tipoPago === "string" ? b.tipoPago.trim() : "";
  let tipoPago: TipoPago;
  if (tp === "Contado") tipoPago = "Contado";
  else if (tp === "Crédito" || tp === "Credito") tipoPago = "Crédito";
  else return { ok: false, status: 400, mensaje: "La forma de pago debe ser Contado o Crédito" };

  const fechaTexto = textoOpcional(b.fechaPagoPrevista, 10);
  if (fechaTexto === undefined || (fechaTexto !== null && !fechaValida(fechaTexto))) {
    return { ok: false, status: 400, mensaje: "La fecha de pago prevista debe tener el formato AAAA-MM-DD" };
  }
  // Una orden al contado no tiene fecha de pago pendiente: se descarta si vino.
  const fechaPagoPrevista = tipoPago === "Crédito" ? fechaTexto : null;

  const tipoComprobante = textoOpcional(b.tipoComprobante, 30);
  if (tipoComprobante === undefined || (tipoComprobante !== null && !TIPOS_COMPROBANTE.includes(tipoComprobante))) {
    return { ok: false, status: 400, mensaje: "El tipo de comprobante debe ser Factura común o Factura electrónica" };
  }

  if (!Array.isArray(b.servicios) || b.servicios.length === 0) {
    return { ok: false, status: 400, mensaje: "La orden necesita al menos un servicio" };
  }
  if (b.servicios.length > MAX_SERVICIOS) {
    return { ok: false, status: 400, mensaje: `Una orden admite como máximo ${MAX_SERVICIOS} servicios` };
  }

  const listaServicios: DatosServicio[] = [];
  let totalCentavos = 0;
  for (let i = 0; i < b.servicios.length; i++) {
    const s = (b.servicios[i] ?? {}) as Record<string, unknown>;
    const n = i + 1; // número de servicio para los mensajes ("Servicio 2: ...")

    const tipoServicio = typeof s.tipoServicio === "string" ? s.tipoServicio.trim() : "";
    if (!tipoServicio) return { ok: false, status: 400, mensaje: `Servicio ${n}: indicá el tipo de servicio` };
    if (tipoServicio.length > 100) {
      return { ok: false, status: 400, mensaje: `Servicio ${n}: el tipo es demasiado largo (máximo 100 caracteres)` };
    }

    const centavos = aCentavos(s.monto);
    if (centavos === null) {
      return {
        ok: false,
        status: 400,
        mensaje: `Servicio ${n}: el monto debe ser un número mayor a cero, con hasta 2 decimales`,
      };
    }

    const detalle = textoOpcional(s.detalle, 255);
    if (detalle === undefined) {
      return { ok: false, status: 400, mensaje: `Servicio ${n}: el detalle no es válido (máximo 255 caracteres)` };
    }

    totalCentavos += centavos;
    listaServicios.push({ tipoServicio, centavos, detalle });
  }
  if (totalCentavos > MAX_CENTAVOS) {
    return { ok: false, status: 400, mensaje: "El monto total de la orden es demasiado grande" };
  }

  return { ok: true, data: { clienteId, vehiculoId, tipoPago, fechaPagoPrevista, tipoComprobante, servicios: listaServicios } };
}

// --- Lectura ----------------------------------------------------------------

// Columnas de la orden más el nombre del cliente, los datos del vehículo y el
// nombre del usuario que la registró.
const columnas = {
  id: ordenesServicio.id,
  fecha: ordenesServicio.fecha,
  clienteId: ordenesServicio.clienteId,
  clienteNombre: clientes.nombre,
  vehiculoId: ordenesServicio.vehiculoId,
  vehiculoMarca: vehiculos.marca,
  vehiculoChapa: vehiculos.chapa,
  vehiculoColor: vehiculos.color,
  usuarioId: ordenesServicio.usuarioId,
  usuarioNombre: usuarios.nombre,
  tipoPago: ordenesServicio.tipoPago,
  montoTotal: ordenesServicio.montoTotal,
  fechaPagoPrevista: ordenesServicio.fechaPagoPrevista,
  tipoComprobante: ordenesServicio.tipoComprobante,
};

// Carga órdenes (las más recientes primero) junto con sus servicios, usando solo
// dos consultas sin importar cuántas órdenes se pidan.
async function cargarOrdenes(db: Db, condicion: SQL | undefined, limite: number): Promise<OrdenServicio[]> {
  const filas = await db
    .select(columnas)
    .from(ordenesServicio)
    .innerJoin(clientes, eq(ordenesServicio.clienteId, clientes.id))
    .innerJoin(vehiculos, eq(ordenesServicio.vehiculoId, vehiculos.id))
    .innerJoin(usuarios, eq(ordenesServicio.usuarioId, usuarios.id))
    .where(condicion)
    .orderBy(desc(ordenesServicio.fecha), desc(ordenesServicio.id))
    .limit(limite);
  if (filas.length === 0) return [];

  const detalles = await db
    .select()
    .from(servicios)
    .where(inArray(servicios.ordenId, filas.map((f) => f.id)))
    .orderBy(asc(servicios.id));

  // Agrupa los servicios por orden.
  const porOrden = new Map<number, ServicioDetalle[]>();
  for (const d of detalles) {
    const lista = porOrden.get(d.ordenId) ?? [];
    lista.push(d);
    porOrden.set(d.ordenId, lista);
  }
  return filas.map((f) => ({ ...f, servicios: porOrden.get(f.id) ?? [] }));
}

// Historial de órdenes (HU-26). Filtros opcionales: por cliente y/o por vehículo.
// Devuelve como máximo "limite" órdenes (por defecto 100), las más recientes primero.
export async function listarOrdenes(
  db: Db,
  opciones: { clienteId?: number; vehiculoId?: number; limite?: number } = {},
): Promise<OrdenServicio[]> {
  const condiciones: SQL[] = [];
  if (opciones.clienteId !== undefined) condiciones.push(eq(ordenesServicio.clienteId, opciones.clienteId));
  if (opciones.vehiculoId !== undefined) condiciones.push(eq(ordenesServicio.vehiculoId, opciones.vehiculoId));
  return cargarOrdenes(db, condiciones.length ? and(...condiciones) : undefined, opciones.limite ?? 100);
}

// Obtiene una orden por id, con sus servicios.
export async function obtenerOrden(db: Db, id: number): Promise<Resultado<OrdenServicio>> {
  const [orden] = await cargarOrdenes(db, eq(ordenesServicio.id, id), 1);
  if (!orden) return { ok: false, status: 404, mensaje: "Orden de servicio no encontrada" };
  return { ok: true, data: orden };
}

// --- Alta ---------------------------------------------------------------------

// Registra una orden de servicio con todos sus servicios. "usuarioId" es quien
// la registra (sale de la sesión, nunca del cuerpo de la petición).
export async function crearOrden(db: Db, usuarioId: number, body: unknown): Promise<Resultado<OrdenServicio>> {
  const v = validarDatosOrden(body);
  if (!v.ok) return v;
  const datos = v.data;

  // El cliente debe existir y estar activo (un cliente deshabilitado no recibe órdenes nuevas).
  const [cliente] = await db
    .select({ id: clientes.id, activo: clientes.activo })
    .from(clientes)
    .where(eq(clientes.id, datos.clienteId))
    .limit(1);
  if (!cliente) return { ok: false, status: 400, mensaje: "El cliente indicado no existe" };
  if (!cliente.activo) return { ok: false, status: 400, mensaje: "El cliente indicado está deshabilitado" };

  // El vehículo debe existir y no pertenecer a OTRO cliente. Un vehículo de
  // cliente casual (sin dueño registrado) sí puede usarse con cualquier cliente.
  const [vehiculo] = await db
    .select({ id: vehiculos.id, clienteId: vehiculos.clienteId })
    .from(vehiculos)
    .where(eq(vehiculos.id, datos.vehiculoId))
    .limit(1);
  if (!vehiculo) return { ok: false, status: 400, mensaje: "El vehículo indicado no existe" };
  if (vehiculo.clienteId !== null && vehiculo.clienteId !== datos.clienteId) {
    return { ok: false, status: 400, mensaje: "El vehículo pertenece a otro cliente" };
  }

  // monto_total = suma de los servicios, calculado acá (no se confía en la pantalla).
  const totalCentavos = datos.servicios.reduce((suma, s) => suma + s.centavos, 0);

  // La orden y sus servicios se guardan juntos: si algo falla a mitad de camino,
  // no queda una orden "vacía" ni servicios sueltos.
  const id = await db.transaction(async (tx) => {
    const [orden] = await tx
      .insert(ordenesServicio)
      .values({
        vehiculoId: datos.vehiculoId,
        clienteId: datos.clienteId,
        usuarioId,
        tipoPago: datos.tipoPago,
        montoTotal: centavosATexto(totalCentavos),
        fechaPagoPrevista: datos.fechaPagoPrevista,
        tipoComprobante: datos.tipoComprobante,
      })
      .returning({ id: ordenesServicio.id });

    await tx.insert(servicios).values(
      datos.servicios.map((s) => ({
        ordenId: orden.id,
        tipoServicio: s.tipoServicio,
        monto: centavosATexto(s.centavos),
        detalle: s.detalle,
      })),
    );
    return orden.id;
  });

  return obtenerOrden(db, id);
}
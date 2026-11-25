// src/main/services/ordenesServicio.ts
// Lógica de negocio de Órdenes de Servicio (HU-22, HU-22.1, HU-23, HU-26, HU-27).
// Una Orden representa la VISITA del cliente: agrupa vehículo, cliente, quién la
// registró y la forma de pago, y contiene uno o más Servicios de detalle (tipo,
// monto y un detalle opcional). Las órdenes NO se borran ni se editan en este
// sprint: son el historial del taller (HU-26).
// Esta capa NO registra pagos ni calcula saldos: eso es del servicio de Pagos
// (punto 4). Solo deja guardados el monto_total (calculado acá, en el servidor)
// y, si la orden es a crédito, la fecha de pago prevista (HU-10.2).

import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "../api/server";
import { clientes, ordenesServicio, pagos, servicios, tiposServicio, usuarios, vehiculos } from "../db/schema";
import type { Rol } from "./auth";
import type { Resultado } from "./clientes";



// Formas de pago y de comprobante admitidas (coinciden con los comentarios de schema.ts).
export type TipoPago = "Contado" | "Crédito";
const TIPOS_COMPROBANTE: readonly string[] = ["Factura común", "Factura electrónica"];

// Límites razonables. MAX_CENTAVOS corresponde al máximo de numeric(12,2) del esquema.
const MAX_SERVICIOS = 50;
const MAX_CENTAVOS = 999_999_999_999;
// Máximo de ruedas por servicio (cubre hasta camiones).
const MAX_RUEDAS = 20;
// Un Servicio de detalle tal como lo devuelve la API. "monto" es texto con dos
// decimales (ej. "150000.00"), que es como Postgres devuelve las columnas numeric.
// Tope de kilometraje aceptado (HU-41).
const MAX_KM = 9_999_999;
export interface ServicioDetalle {
  id: number;
  ordenId: number;
  tipoServicioId: number | null; // null en órdenes anteriores al catálogo
  tipoServicio: string; // nombre del tipo al momento de la orden
  cantidadRuedas: number | null;
  montoBase: string | null; // precio de referencia de ese momento
  monto: string; // precio realmente cobrado
  detalle: string | null;
}

// Una Orden con sus datos de cliente, vehículo y usuario ya resueltos (para
// mostrarla sin consultas extra) y su lista de servicios.
export interface OrdenServicio {
  id: number;
  fecha: Date;
  clienteId: number | null;  
   clienteNombre: string | null;
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
  kilometraje: number | null;
  // km de la visita + intervalo más corto de sus tipos; null si no se puede calcular (HU-41).
  proximoMantenimientoKm: number | null;
  // Solo en la respuesta del alta: avisos que no bloquean (ej. el km bajó).
  aviso?: string | null;
}

// Datos ya validados (solo formato) de un servicio. Las reglas que dependen del
// catálogo y del rol se aplican después, en crearOrden.
interface DatosServicio {
  tipoServicioId: number;
  cantidadRuedas: number | null;
  // Monto indicado por quien registra, en centavos. null = usar el precio de referencia.
  centavos: number | null;
  detalle: string | null;
}

// Datos ya validados de una orden nueva.
export interface DatosOrden {
  clienteId: number | null; 
  vehiculoId: number;
  tipoPago: TipoPago;
  fechaPagoPrevista: string | null;
  tipoComprobante: string | null;
  servicios: DatosServicio[];
  kilometraje: number | null;
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
export function aCentavos(monto: unknown): number | null {
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) return null;
  const centavos = Math.round(monto * 100);
  if (Math.abs(monto * 100 - centavos) > 1e-6) return null; // más de 2 decimales
  return centavos > MAX_CENTAVOS ? null : centavos;
}

// Convierte centavos enteros al texto con dos decimales que espera la columna
// numeric (ej. 15000050 → "150000.50").
export function centavosATexto(centavos: number): string {
  const entero = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return `${entero}.${String(resto).padStart(2, "0")}`;
}

// Valida y limpia el cuerpo recibido para crear una orden. Reglas:
//   - vehiculoId: obligatorios (enteros positivos).
//   - tipoPago: "Contado" o "Crédito" (se acepta "Credito" sin tilde).
//   - fechaPagoPrevista: solo se conserva si la orden es a crédito; formato AAAA-MM-DD.
//   - servicios: al menos uno; cada uno con tipo (obligatorio), monto > 0 y detalle opcional.
//     El monto TOTAL no se recibe: se calcula acá como la suma de los servicios.
// El cliente es opcional (cliente casual). Si viene, tiene que ser un id válido.
export function validarDatosOrden(body: unknown): Resultado<DatosOrden> {
  const b = (body ?? {}) as Record<string, unknown>;


  let clienteId: number | null = null;
  if (b.clienteId !== undefined && b.clienteId !== null) {
    clienteId = enteroPositivo(b.clienteId);
    if (clienteId === null) return { ok: false, status: 400, mensaje: "El cliente indicado no es válido" };
  }

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
  for (let i = 0; i < b.servicios.length; i++) {
    const s = (b.servicios[i] ?? {}) as Record<string, unknown>;
    const n = i + 1; // número de servicio para los mensajes ("Servicio 2: ...")

    const tipoServicioId = enteroPositivo(s.tipoServicioId);
    if (tipoServicioId === null) {
      return { ok: false, status: 400, mensaje: `Servicio ${n}: elegí el tipo de servicio` };
    }

    // La cantidad de ruedas es opcional acá: si el tipo la requiere, crearOrden la exige.
    let cantidadRuedas: number | null = null;
    if (s.cantidadRuedas !== undefined && s.cantidadRuedas !== null) {
      const r = enteroPositivo(s.cantidadRuedas);
      if (r === null || r > MAX_RUEDAS) {
        return {
          ok: false,
          status: 400,
          mensaje: `Servicio ${n}: la cantidad de ruedas debe ser un entero entre 1 y ${MAX_RUEDAS}`,
        };
      }
      cantidadRuedas = r;
    }

    // El monto es opcional: si no viene, se usa el precio de referencia del tipo.
    let centavos: number | null = null;
    if (s.monto !== undefined && s.monto !== null) {
      centavos = aCentavos(s.monto);
      if (centavos === null) {
        return {
          ok: false,
          status: 400,
          mensaje: `Servicio ${n}: el monto debe ser un número mayor a cero, con hasta 2 decimales`,
        };
      }
    }

    const detalle = textoOpcional(s.detalle, 255);
    if (detalle === undefined) {
      return { ok: false, status: 400, mensaje: `Servicio ${n}: el detalle no es válido (máximo 255 caracteres)` };
    }

    listaServicios.push({ tipoServicioId, cantidadRuedas, centavos, detalle });
  }
  // Kilometraje opcional (HU-41): entero entre 0 y MAX_KM.
  let kilometraje: number | null = null;
  if (b.kilometraje !== undefined && b.kilometraje !== null && b.kilometraje !== "") {
    const k = b.kilometraje;
    if (typeof k !== "number" || !Number.isInteger(k) || k < 0 || k > MAX_KM) {
      return { ok: false, status: 400, mensaje: `El kilometraje debe ser un entero entre 0 y ${MAX_KM}` };
    }
    kilometraje = k;
  }
    return { ok: true, data: { clienteId, vehiculoId, tipoPago, fechaPagoPrevista, tipoComprobante, kilometraje, servicios: listaServicios } };
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
  kilometraje: ordenesServicio.kilometraje,
};

// Carga órdenes (las más recientes primero) junto con sus servicios, usando solo
// dos consultas sin importar cuántas órdenes se pidan.
// leftJoin: una orden de cliente casual no tiene cliente, y con innerJoin
// desaparecería del historial.
async function cargarOrdenes(db: Db, condicion: SQL | undefined, limite: number): Promise<OrdenServicio[]> {
  const filas = await db
    .select(columnas)
    .from(ordenesServicio)
    .leftJoin(clientes, eq(ordenesServicio.clienteId, clientes.id))   
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

  // Intervalos (km) de los tipos usados, para calcular el próximo mantenimiento (HU-41).
  const tipoIds = Array.from(
    new Set(detalles.map((d) => d.tipoServicioId).filter((t): t is number => t !== null)),
  );
  const intervalos = new Map<number, number>();
  if (tipoIds.length > 0) {
    const ts = await db
      .select({ id: tiposServicio.id, intervaloKm: tiposServicio.intervaloKm })
      .from(tiposServicio)
      .where(inArray(tiposServicio.id, tipoIds));
    for (const t of ts) if (t.intervaloKm !== null) intervalos.set(t.id, t.intervaloKm);
  }

  return filas.map((f) => {
    const lista = porOrden.get(f.id) ?? [];
    // Intervalo más corto entre los tipos de esta orden; sin km o sin intervalo → null.
    const cortos = lista
      .map((s) => (s.tipoServicioId !== null ? intervalos.get(s.tipoServicioId) : undefined))
      .filter((n): n is number => n !== undefined);
    const proximoMantenimientoKm =
      f.kilometraje !== null && cortos.length > 0 ? f.kilometraje + Math.min(...cortos) : null;
    return { ...f, servicios: lista, proximoMantenimientoKm };
  });
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
// Un servicio ya resuelto contra el catálogo, listo para guardar.
interface LineaResuelta {
  tipoServicioId: number;
  tipoServicio: string;
  cantidadRuedas: number | null;
  montoBase: string | null;
  centavos: number;
  detalle: string | null;
}

// Registra una orden de servicio con todos sus servicios. "usuarioId" y "rol" son
// de quien la registra (salen de la sesión, nunca del cuerpo de la petición).
// Aviso (no bloquea): el km no debería ser menor al de la última visita que lo anotó (HU-41).
export async function crearOrden(db: Db, usuarioId: number, rol: Rol, body: unknown): Promise<Resultado<OrdenServicio>> {
  const v = validarDatosOrden(body);
  if (!v.ok) return v;
  const datos = v.data;

  // 1) El vehículo debe existir.
  
  const [vehiculo] = await db
    .select({ id: vehiculos.id, clienteId: vehiculos.clienteId })
    .from(vehiculos)
    .where(eq(vehiculos.id, datos.vehiculoId))
    .limit(1);
  if (!vehiculo) return { ok: false, status: 400, mensaje: "El vehículo indicado no existe" };

  let aviso: string | null = null;
  if (datos.kilometraje !== null) {
    const [previa] = await db
      .select({ km: ordenesServicio.kilometraje })
      .from(ordenesServicio)
      .where(and(eq(ordenesServicio.vehiculoId, datos.vehiculoId), isNotNull(ordenesServicio.kilometraje)))
      .orderBy(desc(ordenesServicio.fecha), desc(ordenesServicio.id))
      .limit(1);
    if (previa && previa.km !== null && datos.kilometraje < previa.km) {
      aviso = `El kilometraje (${datos.kilometraje.toLocaleString("es-PY")}) es menor al de la visita anterior (${previa.km.toLocaleString("es-PY")}). Se registró igual: revisalo si fue un error.`;
    }
  }
  // 2) Cliente efectivo de la orden:
  //    - sin cliente en la petición → hereda el dueño del vehículo (puede ser null = casual);
  //    - con cliente → no puede contradecir al dueño registrado del vehículo.
  let clienteId = datos.clienteId;
  if (clienteId === null) {
    clienteId = vehiculo.clienteId;
  } else if (vehiculo.clienteId !== null && vehiculo.clienteId !== clienteId) {
    return { ok: false, status: 400, mensaje: "El vehículo pertenece a otro cliente" };
  }

  // 3) HU-27: una orden a crédito exige un cliente registrado (sin cliente no hay a quién cargarle la deuda).
  if (datos.tipoPago === "Crédito" && clienteId === null) {
    return { ok: false, status: 400, mensaje: "Una orden a crédito requiere un cliente registrado" };
  }

  // 4) Si hay cliente, debe existir y estar activo.
  if (clienteId !== null) {
    const [cliente] = await db
      .select({ id: clientes.id, activo: clientes.activo })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);
    if (!cliente) return { ok: false, status: 400, mensaje: "El cliente indicado no existe" };
    if (!cliente.activo) return { ok: false, status: 400, mensaje: "El cliente indicado está deshabilitado" };
  }

  // 5) Resolver cada servicio contra el catálogo: validar el tipo, las ruedas,
  //    calcular el precio de referencia y decidir qué monto se cobra.
  const ids = Array.from(new Set(datos.servicios.map((s) => s.tipoServicioId)));
  const tipos = await db.select().from(tiposServicio).where(inArray(tiposServicio.id, ids));
  const tipoPorId = new Map(tipos.map((t) => [t.id, t] as const));

  const lineas: LineaResuelta[] = [];
  let totalCentavos = 0;
  for (let i = 0; i < datos.servicios.length; i++) {
    const s = datos.servicios[i];
    const n = i + 1;

    const tipo = tipoPorId.get(s.tipoServicioId);
    if (!tipo) return { ok: false, status: 400, mensaje: `Servicio ${n}: el tipo de servicio no existe` };
    if (!tipo.activo) {
      return { ok: false, status: 400, mensaje: `Servicio ${n}: «${tipo.nombre}» está deshabilitado` };
    }

    // Ruedas: obligatorias solo si el tipo las requiere; si no, se descartan.
    let cantidadRuedas: number | null = null;
    if (tipo.requiereRuedas) {
      if (s.cantidadRuedas === null) {
        return { ok: false, status: 400, mensaje: `Servicio ${n}: «${tipo.nombre}» requiere indicar la cantidad de ruedas` };
      }
      cantidadRuedas = s.cantidadRuedas;
    }

    // Precio de referencia (en centavos): base × ruedas si requiere ruedas, o la base sola.
    let referencia: number | null = null;
    if (tipo.montoBase !== null) {
      referencia = Math.round(Number(tipo.montoBase) * 100) * (cantidadRuedas ?? 1);
      if (referencia > MAX_CENTAVOS) {
        return { ok: false, status: 400, mensaje: `Servicio ${n}: el monto calculado es demasiado grande` };
      }
    }

    // Monto que se cobra.
    let centavos: number;
    if (s.centavos === null) {
      if (referencia === null) {
        return { ok: false, status: 400, mensaje: `Servicio ${n}: «${tipo.nombre}» no tiene precio fijo, indicá el monto` };
      }
      centavos = referencia;
    } else {
      // Cambiar el precio de referencia (descuento) es solo del Administrador.
      // Si el tipo no tiene precio fijo no hay base de la cual descontar: el monto es libre.
      if (referencia !== null && s.centavos !== referencia && rol !== "Administrador") {
        return {
          ok: false,
          status: 403,
          mensaje: `Servicio ${n}: solo el Administrador puede modificar el precio de «${tipo.nombre}»`,
        };
      }
      centavos = s.centavos;
    }

    // Si no hay detalle escrito y hay ruedas, queda "4 ruedas" para que el historial lo muestre.
    const detalle =
      s.detalle ?? (cantidadRuedas !== null ? `${cantidadRuedas} ${cantidadRuedas === 1 ? "rueda" : "ruedas"}` : null);

    totalCentavos += centavos;
    lineas.push({
      tipoServicioId: tipo.id,
      tipoServicio: tipo.nombre,
      cantidadRuedas,
      montoBase: referencia === null ? null : centavosATexto(referencia),
      centavos,
      detalle,
    });
  }
  if (totalCentavos > MAX_CENTAVOS) {
    return { ok: false, status: 400, mensaje: "El monto total de la orden es demasiado grande" };
  }

 // La orden y sus servicios se guardan juntos: si algo falla a mitad de camino,
  // no queda una orden "vacía" ni servicios sueltos.
  const id = await db.transaction(async (tx) => {
    const [orden] = await tx
      .insert(ordenesServicio)
      .values({
        vehiculoId: datos.vehiculoId,
        clienteId,
        usuarioId,
        tipoPago: datos.tipoPago,
        montoTotal: centavosATexto(totalCentavos),
        fechaPagoPrevista: datos.fechaPagoPrevista,
        tipoComprobante: datos.tipoComprobante,
        kilometraje: datos.kilometraje,
      })
      .returning({ id: ordenesServicio.id });

    await tx.insert(servicios).values(
      lineas.map((l) => ({
        ordenId: orden.id,
        tipoServicioId: l.tipoServicioId,
        tipoServicio: l.tipoServicio,
        cantidadRuedas: l.cantidadRuedas,
        montoBase: l.montoBase,
        monto: centavosATexto(l.centavos),
        detalle: l.detalle,
      })),
    );
    return orden.id;
  });

  const creada = await obtenerOrden(db, id);
  return creada.ok ? { ok: true, data: { ...creada.data, aviso } } : creada;
}

// --- Historial paginado por días (pantalla Historial de servicios) -----------

// Filtros de GET /api/ordenes-servicio/historial. fechaDesde y fechaHasta son
// fechas LOCALES ('AAAA-MM-DD', como las manda un <input type="date">), no UTC.
export interface FiltrosHistorialOrdenes {
  clienteId?: number;
  vehiculoId?: number;
  tipoPago?: string; // "Contado" | "Crédito"
  fechaDesde?: string;
  fechaHasta?: string;
  soloConSaldoPendiente?: boolean;
  // Cursor de paginación: trae órdenes estrictamente anteriores a esta fecha
  // (el `antesDe` que devolvió la página anterior).
  antesDe?: string;
  // Cuántos DÍAS calendario completos devolver (no cuántas órdenes).
  dias?: number;
}

// Una orden del historial, con su saldo pendiente ya calculado. Para una orden
// al contado el saldo es siempre 0.
export interface OrdenListado extends OrdenServicio {
  saldoPendiente: number;
}

// Una "página" son N días completos, no una cantidad fija de filas (mismo
// criterio que listarVentas). `antesDe` es el cursor para pedir la siguiente.
export interface PaginaOrdenes {
  items: OrdenListado[];
  hayMas: boolean;
  antesDe: string | null;
}

const DIAS_POR_PAGINA_DEFECTO = 7;
const MAX_DIAS_POR_PAGINA = 31;
const LOTE_INICIAL = 60;
const MAX_INTENTOS = 6;
const CREDITO = "Crédito";

// Clave de agrupación por día en el calendario LOCAL de esta máquina
// ('AAAA-MM-DD'). Misma función que en services/ventas.ts: nunca se usa
// `fecha::date` en SQL, porque Postgres lo interpretaría con el huso horario de
// la sesión de PGlite, que no tiene por qué coincidir con el del usuario.
function claveFechaLocal(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Lista órdenes paginadas por DÍAS CALENDARIO COMPLETOS, más recientes primero.
// Mismo algoritmo que listarVentas: se pide un lote de filas (más grande que
// `dias`, porque no se sabe cuántas órdenes tiene cada día) y, como el orden es
// descendente, ver aparecer un día MÁS de los pedidos confirma que el último día
// incluido está completo. Si el lote se agota antes, también hay certeza (no hay
// más datos). Si ninguna de las dos cosas pasa, se agranda el lote y se reintenta.
// Caso borde aceptado: un solo día con una cantidad enorme de órdenes; ahí se
// devuelve lo que se pudo traer con hayMas = true.
// Todos los filtros se aplican ANTES de paginar (en la consulta), no sobre lo ya traído.
export async function historialOrdenes(db: Db, filtros: FiltrosHistorialOrdenes = {}): Promise<Resultado<PaginaOrdenes>> {
  // --- Validación de los parámetros ---
  const dias = filtros.dias ?? DIAS_POR_PAGINA_DEFECTO;
  if (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_POR_PAGINA) {
    return { ok: false, status: 400, mensaje: `dias debe ser un entero entre 1 y ${MAX_DIAS_POR_PAGINA}` };
  }
  if (filtros.clienteId !== undefined && enteroPositivo(filtros.clienteId) === null) {
    return { ok: false, status: 400, mensaje: "clienteId debe ser un número entero positivo" };
  }
  if (filtros.vehiculoId !== undefined && enteroPositivo(filtros.vehiculoId) === null) {
    return { ok: false, status: 400, mensaje: "vehiculoId debe ser un número entero positivo" };
  }

  let tipoPago: TipoPago | undefined;
  if (filtros.tipoPago !== undefined) {
    if (filtros.tipoPago === "Contado") tipoPago = "Contado";
    else if (filtros.tipoPago === "Crédito" || filtros.tipoPago === "Credito") tipoPago = "Crédito";
    else return { ok: false, status: 400, mensaje: "La forma de pago debe ser Contado o Crédito" };
  }

  for (const [nombre, valor] of [["fechaDesde", filtros.fechaDesde], ["fechaHasta", filtros.fechaHasta]] as const) {
    if (valor !== undefined && !fechaValida(valor)) {
      return { ok: false, status: 400, mensaje: `${nombre} debe tener el formato AAAA-MM-DD` };
    }
  }

  let corte: Date | undefined;
  if (filtros.antesDe !== undefined) {
    corte = new Date(filtros.antesDe);
    if (Number.isNaN(corte.getTime())) return { ok: false, status: 400, mensaje: "antesDe no es una fecha válida" };
  }

  // --- Condiciones ---
  const condiciones: SQL[] = [];
  if (filtros.clienteId !== undefined) condiciones.push(eq(ordenesServicio.clienteId, filtros.clienteId));
  if (filtros.vehiculoId !== undefined) condiciones.push(eq(ordenesServicio.vehiculoId, filtros.vehiculoId));
  if (tipoPago) condiciones.push(eq(ordenesServicio.tipoPago, tipoPago));
  if (corte) condiciones.push(sql`${ordenesServicio.fecha} < ${corte}`);

  // Límites de fecha calculados en JS con los componentes LOCALES (nunca se le
  // pasa a Postgres un texto de fecha para que lo interprete él).
  if (filtros.fechaDesde) {
    const [y, m, d] = filtros.fechaDesde.split("-").map(Number);
    condiciones.push(sql`${ordenesServicio.fecha} >= ${new Date(y, m - 1, d)}`);
  }
  if (filtros.fechaHasta) {
    const [y, m, d] = filtros.fechaHasta.split("-").map(Number);
    // Límite EXCLUSIVO: medianoche local del día siguiente al elegido.
    condiciones.push(sql`${ordenesServicio.fecha} < ${new Date(y, m - 1, d + 1)}`);
  }

  // Saldo pendiente: solo las órdenes a crédito cuyo total supera lo pagado. Va
  // como subconsulta para aplicarse antes de paginar.
  if (filtros.soloConSaldoPendiente) {
    condiciones.push(sql`(
      ${ordenesServicio.tipoPago} = ${CREDITO}
      AND ${ordenesServicio.montoTotal} > COALESCE(
        (SELECT SUM(${pagos.monto}) FROM ${pagos} WHERE ${pagos.ordenServicioId} = ${ordenesServicio.id}),
        0
      )
    )`);
  }

  const where = condiciones.length ? and(...condiciones) : undefined;

  // --- Lote de filas livianas (solo id y fecha), para decidir qué días entran ---
  let tamanoLote = Math.max(dias * 10, LOTE_INICIAL);
  let filas: { id: number; fecha: Date }[] = [];
  let agotado = false;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    filas = await db
      .select({ id: ordenesServicio.id, fecha: ordenesServicio.fecha })
      .from(ordenesServicio)
      .where(where)
      .orderBy(desc(ordenesServicio.fecha), desc(ordenesServicio.id))
      .limit(tamanoLote);

    agotado = filas.length < tamanoLote;
    const diasEnLote = new Set(filas.map((f) => claveFechaLocal(f.fecha))).size;
    if (agotado || diasEnLote > dias) break;
    tamanoLote *= 3;
  }

  const diasVistos: string[] = [];
  for (const f of filas) {
    const c = claveFechaLocal(f.fecha);
    if (diasVistos[diasVistos.length - 1] !== c) diasVistos.push(c);
  }
  const hayDiaDeMasConfirmado = diasVistos.length > dias;
  const diasIncluidos = new Set(hayDiaDeMasConfirmado ? diasVistos.slice(0, dias) : diasVistos);
  const filasIncluidas = filas.filter((f) => diasIncluidos.has(claveFechaLocal(f.fecha)));

  // hayMas = true tanto si se confirmó un día de más (el caso normal) como si se
  // agotaron los intentos sin confirmar nada (el caso borde): en ambos podría haber más.
  const hayMas = hayDiaDeMasConfirmado || !agotado;
  const ultima = filasIncluidas[filasIncluidas.length - 1];
  const antesDe = hayMas && ultima ? ultima.fecha.toISOString() : null;

  if (filasIncluidas.length === 0) return { ok: true, data: { items: [], hayMas: false, antesDe: null } };

  // --- Carga completa de las órdenes incluidas (con cliente, vehículo y servicios) ---
  const ids = filasIncluidas.map((f) => f.id);
  const ordenes = await cargarOrdenes(db, inArray(ordenesServicio.id, ids), ids.length);

  // --- Saldo pendiente de las órdenes a crédito, en bloque (una sola consulta) ---
  const idsCredito = ordenes.filter((o) => o.tipoPago === CREDITO).map((o) => o.id);
  const pagadoPorOrden = new Map<number, number>();
  if (idsCredito.length > 0) {
    const filasPagos = await db
      .select({ ordenServicioId: pagos.ordenServicioId, monto: pagos.monto })
      .from(pagos)
      .where(inArray(pagos.ordenServicioId, idsCredito));
    for (const p of filasPagos) {
      if (p.ordenServicioId === null) continue;
      pagadoPorOrden.set(p.ordenServicioId, (pagadoPorOrden.get(p.ordenServicioId) ?? 0) + Number(p.monto));
    }
  }

  const items: OrdenListado[] = ordenes.map((o) => {
    // Contado: saldo siempre 0. Crédito: total − pagos (nunca negativo, a 2 decimales).
    const saldo =
      o.tipoPago === CREDITO
        ? Math.max(0, Math.round((Number(o.montoTotal) - (pagadoPorOrden.get(o.id) ?? 0)) * 100) / 100)
        : 0;
    return { ...o, saldoPendiente: saldo };
  });

  return { ok: true, data: { items, hayMas, antesDe } };
}
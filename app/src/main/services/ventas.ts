// src/main/services/ventas.ts
//
// Servicio de negocio de Ventas (HU-17 a HU-21). Registra una Venta con uno
// o más Ítems de Venta, descontando stock del lote (Compra) elegido por el
// Administrador para cada ítem.
//
// Decisiones de diseño aplicadas acá (ver docs/01-analisis/desiciones-alcance.md,
// sección 7.3, y docs/03-gestion-proyecto/sprint-2-backlog.md, punto 1):
//
// - Solo el rol Administrador registra una Venta (HU-17.1). El Empleado usa
//   la sección de Ventas como calculadora en el cliente, sin llamar a este
//   servicio — por eso la validación de rol se hace también acá, no solo en
//   el middleware de la ruta, como defensa en profundidad (HU-17, criterio
//   de aceptación sobre manipulación directa de la API).
// - Selección de lote MANUAL, no PEPS/FIFO: cada Ítem de Venta trae su
//   propio `compraId`, elegido explícitamente. Si una venta debe repartirse
//   entre varios lotes del mismo producto, el llamador manda varios ítems
//   (uno por lote), no se reparte automáticamente acá.
// - Stock insuficiente en el lote elegido: BLOQUEA la venta completa (HU-20).
//   La validación es contra el lote puntual (`compraId`), no contra el stock
//   agregado del producto, porque la selección de lote es manual.
// - Pago que supera el saldo pendiente: no aplica acá (ver services/pagos.ts,
//   Fase 3 del reparto) — este servicio solo registra la venta.
// - Ítem a crédito: nunca genera un Pago acá — queda con saldo pendiente
//   completo hasta que se cobre una cuota (ver services/pagos.ts).
// - Ítem al contado: SÍ genera acá, en la misma transacción, un Pago
//   automático por el monto total del ítem (decisión cerrada 25/10/2026,
//   ver entidades-dominio.md, sección 7.2, y tarea 15 del reparto). Así
//   `saldo_pendiente` (monto − suma(pagos)) da 0 para Contado sin necesidad
//   de que services/pagos.ts distinga el tipo de pago del ítem.

import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../api/server'
import { compras, productos, itemsVenta, pagos, ventas, clientes, usuarios } from '../db/schema'
import type { Rol } from './auth'
import { calcularSaldoPendienteItem } from './pagos'

export type TipoPago = 'Contado' | 'Crédito'
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export type Venta = typeof ventas.$inferSelect
export type ItemVenta = typeof itemsVenta.$inferSelect
export type VentaConItems = Venta & { items: ItemVenta[] }

// Fila de listado (GET /api/ventas): la venta sola no dice a quién se le
// vendió ni cuántos ítems tiene, y pedir el detalle completo de cada una
// solo para mostrar el listado sería un N+1 contra el servidor. Se resuelve
// acá con dos selects adicionales (sobre clientes e itemsVenta, por los ids
// de la página actual) compuestos en JS, mismo criterio que el resto del
// archivo: no se usa JOIN de Drizzle en ningún otro service todavía.
export type VentaListado = Venta & {
  clienteNombre: string | null // null tanto si es cliente casual como si el cliente fue dado de baja
  cantidadItems: number
  // true si ALGÚN ítem de la venta todavía tiene saldo pendiente (siempre
  // false para ítems Contado, que quedan pagados solos al registrarse — ver
  // entidades-dominio.md, sección 7.2). Para el filtro "Solo con saldo
  // pendiente" del historial de ventas (módulo de Pagos).
  tieneSaldoPendiente: boolean
}

// Filtros de GET /api/ventas — ver listarVentas más abajo. `fechaDesde` y
// `fechaHasta` son fechas LOCALES ('YYYY-MM-DD', como las manda un
// <input type="date">), no UTC.
export interface FiltrosListarVentas {
  clienteId?: number
  q?: string // nombre de cliente; 'cliente casual'/sus variantes matchean clienteId NULL
  metodoPago?: string
  fechaDesde?: string
  fechaHasta?: string
  soloConSaldoPendiente?: boolean
  // Cursor de paginación: trae ventas estrictamente anteriores a esta fecha
  // (el `antesDe` que devolvió la página anterior). Sin esto, arranca desde
  // la venta más reciente.
  antesDe?: string
  // Cuántos DÍAS calendario completos devolver (no cuántas ventas) — ver
  // PaginaVentas.
  dias?: number
}

// Una "página" acá son N días completos, no una cantidad fija de filas: ver
// la nota larga sobre el algoritmo en listarVentas. `antesDe` es el cursor
// a mandar en la siguiente llamada para seguir donde terminó esta.
export interface PaginaVentas {
  items: VentaListado[]
  hayMas: boolean
  antesDe: string | null
}

// Detalle de una venta puntual (GET /api/ventas/:id): cada ítem viaja con el
// nombre del producto (la pantalla de historial no tiene por qué pedir todo
// el catálogo aparte solo para traducir productoId) y su saldoPendiente ya
// calculado, reutilizando la misma fórmula que services/pagos.ts (HU-10.1,
// HU-11) en vez de duplicarla en el cliente.
export type ItemVentaDetalle = ItemVenta & { productoNombre: string; saldoPendiente: number }
export type VentaDetalle = Venta & {
  clienteNombre: string | null
  usuarioNombre: string
  items: ItemVentaDetalle[]
}

export interface ItemVentaInput {
  productoId: number
  compraId: number
  cantidad: number
  // Precio final del ítem. Si no se manda, se usa el precioBase vigente del
  // producto. Al ser este servicio exclusivo del rol Administrador (ver
  // arriba), no hace falta una restricción de "Empleado no puede modificar
  // precio": el Empleado nunca llega a esta función.
  precioUnitario?: number | string
  garantiaOfrecida?: number | null
  tipoPago: TipoPago
  // Solo tiene sentido si tipoPago = 'Crédito'. Si no se manda, se calcula
  // un valor sugerido (hoy + 1 mes) — ver HU-10.2.
  fechaPagoPrevista?: string | null
}

export interface VentaInput {
  clienteId?: number | null
  metodoPago: string
  tipoComprobante?: string | null
  items: ItemVentaInput[]
}

export type Resultado<T> = { ok: true; data: T } | { ok: false; status: number; mensaje: string }

// Error de validación "esperado" (datos del usuario), distinto de un error
// de infraestructura. Mismo patrón que routes/compras.ts.
export class ErrorValidacionVenta extends Error {}

function hoyMasUnMes(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function fechaValida(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor))
}

// Valida la forma general del body, sin tocar la base de datos todavía
// (eso requiere conocer compras/productos reales — ver registrarVenta).
function validarForma(body: unknown): Resultado<VentaInput> {
  const b = (body ?? {}) as Record<string, unknown>

  const metodoPago = typeof b.metodoPago === 'string' ? b.metodoPago : ''
  if (!METODOS_PAGO.includes(metodoPago as MetodoPago)) {
    return {
      ok: false,
      status: 400,
      mensaje: `El método de pago debe ser uno de: ${METODOS_PAGO.join(', ')}.`
    }
  }

  let clienteId: number | null = null
  if (b.clienteId !== undefined && b.clienteId !== null) {
    const n = Number(b.clienteId)
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, status: 400, mensaje: 'El cliente indicado no es válido.' }
    }
    clienteId = n
  }

  const tipoComprobante =
    typeof b.tipoComprobante === 'string' && b.tipoComprobante.trim()
      ? b.tipoComprobante.trim()
      : null

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return { ok: false, status: 400, mensaje: 'La venta debe tener al menos un ítem.' }
  }

  const items: ItemVentaInput[] = []
  for (const [i, crudo] of b.items.entries()) {
    const it = (crudo ?? {}) as Record<string, unknown>
    const productoId = Number(it.productoId)
    const compraId = Number(it.compraId)
    const cantidad = Number(it.cantidad)

    if (!Number.isInteger(productoId) || productoId <= 0) {
      return { ok: false, status: 400, mensaje: `Ítem ${i + 1}: el producto no es válido.` }
    }
    if (!Number.isInteger(compraId) || compraId <= 0) {
      return {
        ok: false,
        status: 400,
        mensaje: `Ítem ${i + 1}: debe indicarse de qué lote de compra sale (selección manual, ver HU-20).`
      }
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return { ok: false, status: 400, mensaje: `Ítem ${i + 1}: la cantidad debe ser mayor a 0.` }
    }

    const tipoPago = it.tipoPago
    if (tipoPago !== 'Contado' && tipoPago !== 'Crédito') {
      return {
        ok: false,
        status: 400,
        mensaje: `Ítem ${i + 1}: la forma de pago debe ser Contado o Crédito.`
      }
    }

    let precioUnitario: number | undefined
    if (it.precioUnitario !== undefined && it.precioUnitario !== null) {
      const p = Number(it.precioUnitario)
      if (!Number.isFinite(p) || p < 0) {
        return { ok: false, status: 400, mensaje: `Ítem ${i + 1}: el precio no es válido.` }
      }
      precioUnitario = p
    }

    let garantiaOfrecida: number | null = null
    if (it.garantiaOfrecida !== undefined && it.garantiaOfrecida !== null) {
      const g = Number(it.garantiaOfrecida)
      if (!Number.isInteger(g) || g < 0) {
        return {
          ok: false,
          status: 400,
          mensaje: `Ítem ${i + 1}: la garantía ofrecida no es válida.`
        }
      }
      garantiaOfrecida = g
    }

    let fechaPagoPrevista: string | null | undefined
    if (it.fechaPagoPrevista !== undefined && it.fechaPagoPrevista !== null) {
      if (typeof it.fechaPagoPrevista !== 'string' || !fechaValida(it.fechaPagoPrevista)) {
        return {
          ok: false,
          status: 400,
          mensaje: `Ítem ${i + 1}: la fecha de pago prevista no es válida.`
        }
      }
      fechaPagoPrevista = it.fechaPagoPrevista
    }

    items.push({
      productoId,
      compraId,
      cantidad,
      precioUnitario,
      garantiaOfrecida,
      tipoPago,
      fechaPagoPrevista
    })
  }

  // HU-10: un ítem a crédito exige cliente registrado (rechaza cliente casual).
  if (!clienteId && items.some((it) => it.tipoPago === 'Crédito')) {
    return {
      ok: false,
      status: 400,
      mensaje: 'Una venta con algún ítem a crédito debe estar asociada a un cliente registrado.'
    }
  }

  return { ok: true, data: { clienteId, metodoPago, tipoComprobante, items } }
}

// Registra la Venta completa dentro de una transacción. Solo puede invocarlo
// un usuario con rol Administrador (HU-17.1) — ver nota de defensa en
// profundidad al principio del archivo.
export async function registrarVenta(
  db: Db,
  usuario: { id: number; rol: Rol },
  body: unknown
): Promise<Resultado<VentaConItems>> {
  if (usuario.rol !== 'Administrador') {
    return {
      ok: false,
      status: 403,
      mensaje: 'Solo el Administrador puede registrar una venta.'
    }
  }

  const v = validarForma(body)
  if (!v.ok) return v
  const { clienteId, metodoPago, tipoComprobante, items } = v.data

  try {
    const resultado = await db.transaction(async (tx) => {
      // Cuánto se va consumiendo de cada lote DENTRO de esta misma venta,
      // para detectar sobreventa del mismo lote entre dos ítems (ej. el
      // Administrador reparte manualmente una cantidad grande entre dos
      // ítems que apuntan al mismo compraId por error).
      const consumidoPorCompra = new Map<number, number>()
      const productosCache = new Map<number, typeof productos.$inferSelect>()

      const itemsAInsertar: Array<{
        productoId: number
        compraId: number
        cantidad: number
        precioBase: string
        precioUnitario: string
        garantiaOfrecida: number | null
        tipoPago: TipoPago
        fechaPagoPrevista: string | null
      }> = []

      let montoTotal = 0

      for (const [i, item] of items.entries()) {
        const [compra] = await tx.select().from(compras).where(eq(compras.id, item.compraId))
        if (!compra) {
          throw new ErrorValidacionVenta(`Ítem ${i + 1}: el lote de compra indicado no existe.`)
        }
        if (compra.productoId !== item.productoId) {
          throw new ErrorValidacionVenta(
            `Ítem ${i + 1}: el producto no coincide con el lote de compra seleccionado.`
          )
        }

        let producto = productosCache.get(item.productoId)
        if (!producto) {
          const [p] = await tx.select().from(productos).where(eq(productos.id, item.productoId))
          if (!p) throw new ErrorValidacionVenta(`Ítem ${i + 1}: el producto indicado no existe.`)
          producto = p
          productosCache.set(item.productoId, p)
        }

        // Stock insuficiente en el lote elegido → bloquea (HU-20, decisión
        // del equipo 23/10/2026). Se valida contra lo que queda del lote
        // DESPUÉS de descontar lo ya reservado por ítems anteriores de esta
        // misma venta sobre el mismo lote.
        const yaReservado = consumidoPorCompra.get(item.compraId) ?? 0
        const disponible = compra.cantidadDisponible - yaReservado
        if (item.cantidad > disponible) {
          throw new ErrorValidacionVenta(
            `Ítem ${i + 1} (${producto.nombre}): stock insuficiente en el lote seleccionado ` +
              `(disponible: ${disponible}, solicitado: ${item.cantidad}).`
          )
        }
        consumidoPorCompra.set(item.compraId, yaReservado + item.cantidad)

        // Garantía ofrecida no puede superar la garantía del proveedor del
        // lote específico (HU-06). Si el lote no tiene garantía cargada
        // (producto sin garantía aplicable), queda a criterio del Admin.
        if (
          item.garantiaOfrecida != null &&
          compra.garantiaProveedor != null &&
          item.garantiaOfrecida > compra.garantiaProveedor
        ) {
          throw new ErrorValidacionVenta(
            `Ítem ${i + 1} (${producto.nombre}): la garantía ofrecida (${item.garantiaOfrecida} meses) ` +
              `no puede superar la garantía del proveedor de ese lote (${compra.garantiaProveedor} meses).`
          )
        }

        const precioUnitario =
          item.precioUnitario !== undefined
            ? Number(item.precioUnitario)
            : Number(producto.precioBase)

        // tipoPago = Contado nunca guarda fecha_pago_prevista, aunque venga
        // en el body (coherencia del dato, ver entidades-dominio.md 7.1).
        const fechaPagoPrevista =
          item.tipoPago === 'Crédito' ? (item.fechaPagoPrevista ?? hoyMasUnMes()) : null

        montoTotal += precioUnitario * item.cantidad

        itemsAInsertar.push({
          productoId: item.productoId,
          compraId: item.compraId,
          cantidad: item.cantidad,
          precioBase: producto.precioBase,
          precioUnitario: String(precioUnitario),
          garantiaOfrecida: item.garantiaOfrecida ?? null,
          tipoPago: item.tipoPago,
          fechaPagoPrevista
        })
      }

      const [ventaCreada] = await tx
        .insert(ventas)
        .values({
          clienteId,
          usuarioId: usuario.id,
          montoTotal: String(montoTotal),
          tipoComprobante,
          metodoPago
        })
        .returning()

      const itemsCreados: ItemVenta[] = []
      for (const item of itemsAInsertar) {
        const [fila] = await tx
          .insert(itemsVenta)
          .values({ ...item, ventaId: ventaCreada.id })
          .returning()
        itemsCreados.push(fila)

        // Descuento de stock: cantidad_disponible del lote y stock agregado
        // del producto, en la misma transacción (ver entidades-dominio.md,
        // sección 14, y routes/compras.ts para el mismo patrón de delta).
        await tx
          .update(compras)
          .set({ cantidadDisponible: sql`${compras.cantidadDisponible} - ${item.cantidad}` })
          .where(eq(compras.id, item.compraId))
        await tx
          .update(productos)
          .set({ stock: sql`${productos.stock} - ${item.cantidad}` })
          .where(eq(productos.id, item.productoId))

        // Ítem al contado → se considera pagado al momento de la venta: se
        // genera automáticamente su Pago por el monto total (ver nota de
        // diseño al principio del archivo).
        if (item.tipoPago === 'Contado') {
          const montoItem = Number(item.precioUnitario) * item.cantidad
          await tx.insert(pagos).values({
            itemVentaId: fila.id,
            monto: String(montoItem),
            metodoPago
          })
        }
      }

      return { ...ventaCreada, items: itemsCreados }
    })

    return { ok: true, data: resultado }
  } catch (err) {
    if (err instanceof ErrorValidacionVenta) {
      return { ok: false, status: 400, mensaje: err.message }
    }
    throw err
  }
}

// Enriquece un lote ya resuelto de filas de `ventas` con clienteNombre,
// cantidadItems y tieneSaldoPendiente — dos selects adicionales (clientes,
// itemsVenta/pagos) por los ids del lote, compuestos en JS, igual que el
// resto del archivo. Pensado para lotes chicos (una página), no para toda
// la tabla — ver listarVentas.
async function enriquecerVentas(db: Db, filas: Venta[]): Promise<VentaListado[]> {
  if (filas.length === 0) return []

  const idsClientes = [...new Set(filas.map((v) => v.clienteId).filter((id) => id !== null))]
  const filasClientes = idsClientes.length
    ? await db
        .select({ id: clientes.id, nombre: clientes.nombre })
        .from(clientes)
        .where(inArray(clientes.id, idsClientes))
    : []
  const nombrePorCliente = new Map(filasClientes.map((c) => [c.id, c.nombre]))

  const idsVentas = filas.map((v) => v.id)
  const filasItems = await db
    .select({
      id: itemsVenta.id,
      ventaId: itemsVenta.ventaId,
      precioUnitario: itemsVenta.precioUnitario,
      cantidad: itemsVenta.cantidad
    })
    .from(itemsVenta)
    .where(inArray(itemsVenta.ventaId, idsVentas))
  const cantidadPorVenta = new Map<number, number>()
  for (const it of filasItems) {
    cantidadPorVenta.set(it.ventaId, (cantidadPorVenta.get(it.ventaId) ?? 0) + 1)
  }

  // tieneSaldoPendiente por venta: se resuelve el saldo de cada ítem en
  // bloque (misma fórmula que calcularSaldoPendienteItem, de
  // services/pagos.ts, pero sin un round-trip por ítem) y se marca la venta
  // si algún ítem suyo quedó con saldo > 0.
  const idsItems = filasItems.map((it) => it.id)
  const filasPagos = idsItems.length
    ? await db
        .select({ itemVentaId: pagos.itemVentaId, monto: pagos.monto })
        .from(pagos)
        .where(inArray(pagos.itemVentaId, idsItems))
    : []
  const pagadoPorItem = new Map<number, number>()
  for (const p of filasPagos) {
    if (p.itemVentaId === null) continue
    pagadoPorItem.set(p.itemVentaId, (pagadoPorItem.get(p.itemVentaId) ?? 0) + Number(p.monto))
  }
  const ventaConSaldo = new Set<number>()
  for (const it of filasItems) {
    const montoItem = Number(it.precioUnitario) * it.cantidad
    const pagado = pagadoPorItem.get(it.id) ?? 0
    if (montoItem - pagado > 0) ventaConSaldo.add(it.ventaId)
  }

  return filas.map((v) => ({
    ...v,
    clienteNombre: v.clienteId !== null ? (nombrePorCliente.get(v.clienteId) ?? null) : null,
    cantidadItems: cantidadPorVenta.get(v.id) ?? 0,
    tieneSaldoPendiente: ventaConSaldo.has(v.id)
  }))
}

// Clave de agrupación por día en el calendario LOCAL de esta máquina
// ('YYYY-MM-DD'). Es la app de escritorio la que corre acá — main y
// renderer comparten el reloj del sistema operativo del usuario — así que
// esto da el mismo día que `claveFechaLocal` en VentasScreen.tsx. Nunca se
// usa `fecha::date` en una consulta SQL para esto: Postgres lo
// interpretaría con el timezone de SESIÓN de PGlite, que no tiene por qué
// coincidir con el del usuario (la misma clase de bug que el de las 3 horas
// corregido el 01/11/2026 — ver db/schema.ts).
function claveFechaLocal(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DIAS_POR_PAGINA_DEFECTO = 7
const LOTE_INICIAL = 60
const MAX_INTENTOS = 6

// Lista ventas paginadas por DÍAS CALENDARIO COMPLETOS (no por cantidad de
// filas) — ver la conversación de planificación del 02/11/2026. La pantalla
// de Historial agrupa por día; paginar por cantidad fija de ventas podía
// devolver un día a medias (ej. 3 de las 5 ventas del martes en una página,
// las otras 2 en la siguiente), lo cual es confuso en una vista agrupada.
//
// Algoritmo: se pide un lote de filas (más grande que `dias`, porque no se
// sabe de antemano cuántas ventas tiene cada día) ordenado por fecha desc.
// Como el orden es descendente, ver aparecer un día MÁS de los pedidos
// confirma que ya se vieron todas las ventas del último día pedido — ese es
// el único momento en que se puede estar seguro de no haber cortado un día
// a la mitad. Si el lote se agota (no hay más filas que cumplan el filtro)
// antes de ver ese día de más, también hay certeza: no hay nada después. Si
// ninguna de las dos cosas pasa, se agranda el lote y se reintenta.
//
// Caso borde documentado y aceptado: un único día con una cantidad de
// ventas tan grande que ni agrandando el lote `MAX_INTENTOS` veces se llega
// a ver el día siguiente. Ahí se devuelve lo que se pudo traer de ese día
// (posiblemente incompleto) con hayMas=true, en vez de arriesgarse a decir
// "no hay más" cuando sí las hay. Para el volumen de un taller esto no
// debería pasar nunca en la práctica.
export async function listarVentas(
  db: Db,
  filtros: FiltrosListarVentas = {}
): Promise<PaginaVentas> {
  const diasPedidos = Math.max(1, Math.trunc(filtros.dias ?? DIAS_POR_PAGINA_DEFECTO))

  const condiciones: SQL[] = []
  if (filtros.clienteId) condiciones.push(eq(ventas.clienteId, filtros.clienteId))
  if (filtros.metodoPago) condiciones.push(eq(ventas.metodoPago, filtros.metodoPago))
  if (filtros.antesDe) condiciones.push(sql`${ventas.fecha} < ${new Date(filtros.antesDe)}`)

  // Límites de fecha calculados en JS a partir de los componentes LOCALES
  // (mismo motivo que claveFechaLocal más arriba): nunca se le pasa a
  // Postgres un string de fecha para que lo interprete él.
  if (filtros.fechaDesde) {
    const [y, m, d] = filtros.fechaDesde.split('-').map(Number)
    condiciones.push(sql`${ventas.fecha} >= ${new Date(y, m - 1, d)}`)
  }
  if (filtros.fechaHasta) {
    const [y, m, d] = filtros.fechaHasta.split('-').map(Number)
    // Límite EXCLUSIVO: medianoche local del día siguiente al elegido.
    condiciones.push(sql`${ventas.fecha} < ${new Date(y, m - 1, d + 1)}`)
  }

  if (filtros.q && filtros.q.trim()) {
    const texto = filtros.q.trim()
    const filasClientes = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(ilike(clientes.nombre, `%${texto}%`))
    const idsClientes = filasClientes.map((c) => c.id)
    const incluyeCasual = 'cliente casual'.includes(texto.toLowerCase())

    if (idsClientes.length === 0 && !incluyeCasual) {
      // Ningún cliente matchea el texto, y tampoco matchea "Cliente casual":
      // no hay nada que esta venta pueda cumplir. Corta acá, no tiene
      // sentido pedirle el resto a la base.
      return { items: [], hayMas: false, antesDe: null }
    }
    const condicionCliente = incluyeCasual
      ? idsClientes.length
        ? (or(inArray(ventas.clienteId, idsClientes), isNull(ventas.clienteId)) as SQL)
        : isNull(ventas.clienteId)
      : inArray(ventas.clienteId, idsClientes)
    condiciones.push(condicionCliente)
  }

  // Único filtro de este archivo resuelto con una subconsulta SQL
  // correlacionada en vez de selects simples compuestos en JS (ver la nota
  // de estilo en VentaListado, más arriba): tiene que aplicarse ANTES de
  // paginar, porque si se resolviera en JS después de traer un lote, un
  // lote entero sin ninguna venta con saldo pendiente no diría nada sobre
  // si hay más viniendo más atrás en el tiempo. Se probó contra una base
  // real (ver abajo de este archivo en el historial de la tarea) antes de
  // dejarlo así.
  if (filtros.soloConSaldoPendiente) {
    condiciones.push(sql`EXISTS (
      SELECT 1 FROM ${itemsVenta}
      WHERE ${itemsVenta.ventaId} = ${ventas.id}
        AND (${itemsVenta.precioUnitario} * ${itemsVenta.cantidad}) > COALESCE(
          (SELECT SUM(${pagos.monto}) FROM ${pagos} WHERE ${pagos.itemVentaId} = ${itemsVenta.id}),
          0
        )
    )`)
  }

  const where = condiciones.length ? and(...condiciones) : undefined

  let tamanoLote = Math.max(diasPedidos * 10, LOTE_INICIAL)
  let filas: Venta[] = []
  let agotado = false
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const consulta = db.select().from(ventas).orderBy(desc(ventas.fecha)).limit(tamanoLote)
    filas = where ? await consulta.where(where) : await consulta

    agotado = filas.length < tamanoLote
    const diasEnLote = new Set(filas.map((v) => claveFechaLocal(v.fecha))).size
    if (agotado || diasEnLote > diasPedidos) break
    tamanoLote *= 3
  }

  const diasVistos: string[] = []
  for (const v of filas) {
    const c = claveFechaLocal(v.fecha)
    if (diasVistos[diasVistos.length - 1] !== c) diasVistos.push(c)
  }
  const hayDiaDeMasConfirmado = diasVistos.length > diasPedidos
  const diasIncluidos = new Set(
    hayDiaDeMasConfirmado ? diasVistos.slice(0, diasPedidos) : diasVistos
  )
  const filasIncluidas = filas.filter((v) => diasIncluidos.has(claveFechaLocal(v.fecha)))

  // hayMas=true tanto si se confirmó un día de más (el caso normal) como si
  // se agotaron los intentos sin confirmar nada (el caso borde documentado
  // arriba) — en ambos casos podría haber más datos después.
  const hayMas = hayDiaDeMasConfirmado || !agotado
  const ultimaFila = filasIncluidas[filasIncluidas.length - 1]
  const antesDe = hayMas && ultimaFila ? ultimaFila.fecha.toISOString() : null

  return { items: await enriquecerVentas(db, filasIncluidas), hayMas, antesDe }
}

// Una venta puntual, con el detalle de sus ítems (nombre de producto y
// saldo pendiente ya resueltos — ver VentaDetalle más arriba).
export async function obtenerVenta(db: Db, id: number): Promise<Resultado<VentaDetalle>> {
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, id))
  if (!venta) return { ok: false, status: 404, mensaje: 'Venta no encontrada.' }

  const items = await db.select().from(itemsVenta).where(eq(itemsVenta.ventaId, id))

  const idsProductos = [...new Set(items.map((i) => i.productoId))]
  const filasProductos = idsProductos.length
    ? await db
        .select({ id: productos.id, nombre: productos.nombre })
        .from(productos)
        .where(inArray(productos.id, idsProductos))
    : []
  const nombrePorProducto = new Map(filasProductos.map((p) => [p.id, p.nombre]))

  let clienteNombre: string | null = null
  if (venta.clienteId !== null) {
    const [c] = await db
      .select({ nombre: clientes.nombre })
      .from(clientes)
      .where(eq(clientes.id, venta.clienteId))
    clienteNombre = c?.nombre ?? null
  }

  const [u] = await db
    .select({ nombre: usuarios.nombre })
    .from(usuarios)
    .where(eq(usuarios.id, venta.usuarioId))

  const itemsConDetalle: ItemVentaDetalle[] = await Promise.all(
    items.map(async (it) => ({
      ...it,
      productoNombre: nombrePorProducto.get(it.productoId) ?? `Producto #${it.productoId}`,
      saldoPendiente: await calcularSaldoPendienteItem(db, it)
    }))
  )

  return {
    ok: true,
    data: { ...venta, clienteNombre, usuarioNombre: u?.nombre ?? '—', items: itemsConDetalle }
  }
}

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
// - Venta a crédito: nunca genera un Pago acá — queda con saldo pendiente
//   completo hasta que se cobre una cuota (ver services/pagos.ts).
// - Venta al contado: SÍ genera acá, en la misma transacción, un Pago
//   automático por el monto total de la Venta (decisión cerrada 25/10/2026,
//   ver entidades-dominio.md, sección 7.2, y tarea 15 del reparto). Así
//   `saldo_pendiente` (monto − suma(pagos)) da 0 para Contado sin necesidad
//   de que services/pagos.ts distinga el tipo de pago.
//
// Cambio de alcance (22/11/2026, planificación técnica del Sprint 3, punto
// 1 — ver entidades-dominio.md, sección 12, y desiciones-alcance.md, sección
// 7.7): el crédito (`tipoPago`/`fechaPagoPrevista`/`saldoPendiente`) se movió
// de Ítem de Venta a Venta completa. Una Venta ya NO admite mezclar ítems al
// contado y a crédito — decisión del equipo, todavía no confirmada con el
// dueño.

import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../api/server'
import { compras, productos, itemsVenta, pagos, ventas, clientes, usuarios } from '../db/schema'
import type { Rol } from './auth'
import { calcularSaldoPendienteVenta } from './pagos'

export type TipoPago = 'Contado' | 'Crédito'
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export type Venta = typeof ventas.$inferSelect
export type ItemVenta = typeof itemsVenta.$inferSelect
export type VentaConItems = Venta & { items: ItemVenta[] }

// Aviso de stock bajo tras una Venta (HU-08, plan del 16/11/2026): un
// producto vendido que, después de descontar el stock de esta Venta, quedó
// con `stock <= stockMinimo`. Se avisa cada vez que pasa (opción A, no solo
// la primera vez que lo cruza) — decisión del dueño, para no depender de
// que se acuerde de que ya estaba bajo; el contador del panel lateral (ver
// api/routes/productos.ts) cubre el resto del tiempo. `stockMinimo` nunca
// es null acá: un producto sin mínimo cargado no puede estar "bajo" nada.
export interface ProductoStockBajo {
  productoId: number
  nombre: string
  stock: number
  stockMinimo: number
}

// Fila de listado (GET /api/ventas): la venta sola no dice a quién se le
// vendió ni cuántos ítems tiene, y pedir el detalle completo de cada una
// solo para mostrar el listado sería un N+1 contra el servidor. Se resuelve
// acá con dos selects adicionales (sobre clientes e itemsVenta, por los ids
// de la página actual) compuestos en JS, mismo criterio que el resto del
// archivo: no se usa JOIN de Drizzle en ningún otro service todavía.
export type VentaListado = Venta & {
  clienteNombre: string | null // null tanto si es cliente casual como si el cliente fue dado de baja
  cantidadItems: number
  // true si la Venta (a nivel completo, desde el 22/11/2026 — ver nota al
  // principio del archivo) todavía tiene saldo pendiente (siempre false para
  // Contado, que queda pagada sola al registrarse — ver entidades-dominio.md,
  // sección 7.2). Para el filtro "Solo con saldo pendiente" del historial de
  // ventas (módulo de Pagos).
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
// el catálogo aparte solo para traducir productoId). El saldo pendiente ya
// NO es por ítem (ver cambio de alcance 22/11/2026 al principio del
// archivo): es un único valor a nivel de la Venta completa, reutilizando la
// misma fórmula que services/pagos.ts (HU-10.1, HU-11).
export type ItemVentaDetalle = ItemVenta & { productoNombre: string }
export type VentaDetalle = Venta & {
  clienteNombre: string | null
  usuarioNombre: string
  items: ItemVentaDetalle[]
  saldoPendiente: number
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
}

// Pago inicial obligatorio de una venta a crédito (HU-39, Sprint 3 punto 1).
// `metodoPago` es opcional: si no se manda, se usa el mismo método de pago
// de la Venta (`VentaInput.metodoPago`) — en la práctica suelen coincidir
// (ej. "pagó la seña en efectivo, lo mismo que puso en el total"), y no
// tiene sentido obligar al Administrador a repetirlo si es igual.
export interface PagoInicialInput {
  monto: number | string
  metodoPago?: string
}

export interface VentaInput {
  clienteId?: number | null
  metodoPago: string
  tipoComprobante?: string | null
  // tipoPago y fechaPagoPrevista viven acá (a nivel de toda la Venta) desde
  // el 22/11/2026 — ver nota de cambio de alcance al principio del archivo.
  tipoPago: TipoPago
  // Solo tiene sentido si tipoPago = 'Crédito'. Si no se manda, se calcula
  // un valor sugerido (hoy + 1 mes) — ver HU-10.2.
  fechaPagoPrevista?: string | null
  // Obligatorio si tipoPago = 'Crédito' (HU-39): el taller no da crédito sin
  // cobrar algo primero. Se ignora si tipoPago = 'Contado' (esa venta ya
  // genera su propio Pago automático por el total — ver más abajo).
  pagoInicial?: PagoInicialInput | null
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

  // tipoPago vive a nivel de toda la Venta desde el 22/11/2026 — ver nota de
  // cambio de alcance al principio del archivo.
  const tipoPago = b.tipoPago
  if (tipoPago !== 'Contado' && tipoPago !== 'Crédito') {
    return {
      ok: false,
      status: 400,
      mensaje: 'La forma de pago de la venta debe ser Contado o Crédito.'
    }
  }

  let fechaPagoPrevista: string | null | undefined
  if (b.fechaPagoPrevista !== undefined && b.fechaPagoPrevista !== null) {
    if (typeof b.fechaPagoPrevista !== 'string' || !fechaValida(b.fechaPagoPrevista)) {
      return { ok: false, status: 400, mensaje: 'La fecha de pago prevista no es válida.' }
    }
    fechaPagoPrevista = b.fechaPagoPrevista
  }

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

    items.push({
      productoId,
      compraId,
      cantidad,
      precioUnitario,
      garantiaOfrecida
    })
  }

  // HU-10: una venta a crédito exige cliente registrado (rechaza cliente casual).
  if (!clienteId && tipoPago === 'Crédito') {
    return {
      ok: false,
      status: 400,
      mensaje: 'Una venta a crédito debe estar asociada a un cliente registrado.'
    }
  }

  // HU-39 (Sprint 3, 20/11/2026): toda venta a crédito exige un pago inicial
  // mayor a cero — el taller no da crédito sin cobrar algo primero. "Mayor a
  // cero" es la decisión PROVISIONAL del equipo (sin mínimo específico,
  // todavía sin confirmar con el dueño — ver desiciones-alcance.md, sección
  // 7.6): si el dueño pide un mínimo distinto (ej. 30%), este es el único
  // lugar que hace falta tocar. No se valida acá que el monto no supere el
  // total de la Venta: eso requiere el precio final de cada ítem, que recién
  // se resuelve dentro de la transacción (ver registrarVenta).
  let pagoInicial: PagoInicialInput | null = null
  if (tipoPago === 'Crédito') {
    const pi = (b.pagoInicial ?? {}) as Record<string, unknown>
    const monto = Number(pi.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      return {
        ok: false,
        status: 400,
        mensaje: 'Una venta a crédito exige un pago inicial mayor a cero.'
      }
    }
    let metodoPagoInicial = metodoPago // por defecto, el mismo método que la Venta
    if (pi.metodoPago !== undefined && pi.metodoPago !== null) {
      if (typeof pi.metodoPago !== 'string' || !METODOS_PAGO.includes(pi.metodoPago as MetodoPago)) {
        return {
          ok: false,
          status: 400,
          mensaje: `La forma de pago del pago inicial debe ser una de: ${METODOS_PAGO.join(', ')}.`
        }
      }
      metodoPagoInicial = pi.metodoPago
    }
    pagoInicial = { monto, metodoPago: metodoPagoInicial }
  }

  return {
    ok: true,
    data: { clienteId, metodoPago, tipoComprobante, tipoPago, fechaPagoPrevista, pagoInicial, items }
  }
}

// Registra la Venta completa dentro de una transacción. Solo puede invocarlo
// un usuario con rol Administrador (HU-17.1) — ver nota de defensa en
// profundidad al principio del archivo.
export async function registrarVenta(
  db: Db,
  usuario: { id: number; rol: Rol },
  body: unknown
): Promise<Resultado<VentaConItems & { productosStockBajo: ProductoStockBajo[] }>> {
  if (usuario.rol !== 'Administrador') {
    return {
      ok: false,
      status: 403,
      mensaje: 'Solo el Administrador puede registrar una venta.'
    }
  }

  const v = validarForma(body)
  if (!v.ok) return v
  const { clienteId, metodoPago, tipoComprobante, tipoPago, pagoInicial, items } = v.data

  // tipoPago = Contado nunca guarda fecha_pago_prevista, aunque venga en el
  // body (coherencia del dato, ver entidades-dominio.md, sección 7). Vive a
  // nivel de Venta desde el 22/11/2026 — ver nota al principio del archivo.
  const fechaPagoPrevista =
    tipoPago === 'Crédito' ? (v.data.fechaPagoPrevista ?? hoyMasUnMes()) : null

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

        montoTotal += precioUnitario * item.cantidad

        itemsAInsertar.push({
          productoId: item.productoId,
          compraId: item.compraId,
          cantidad: item.cantidad,
          precioBase: producto.precioBase,
          precioUnitario: String(precioUnitario),
          garantiaOfrecida: item.garantiaOfrecida ?? null
        })
      }

      const [ventaCreada] = await tx
        .insert(ventas)
        .values({
          clienteId,
          usuarioId: usuario.id,
          montoTotal: String(montoTotal),
          tipoComprobante,
          metodoPago,
          tipoPago,
          fechaPagoPrevista
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
      }

      // Venta al contado → se considera pagada al momento de registrarse: se
      // genera automáticamente UN Pago por el monto total de la Venta (ver
      // nota de diseño al principio del archivo). Cambio de alcance
      // 22/11/2026: antes era un Pago por cada ítem al contado; ahora es un
      // único Pago a nivel de la Venta completa.
      if (tipoPago === 'Contado') {
        await tx.insert(pagos).values({
          ventaId: ventaCreada.id,
          monto: String(montoTotal),
          metodoPago
        })
      }

      // Venta a crédito → el pago inicial (HU-39) se registra acá, en la
      // MISMA transacción que la Venta: si algo de esto falla, no queda una
      // venta a crédito "fantasma" sin su pago inicial. `pagoInicial` nunca
      // es null acá porque `validarForma` ya lo exige para tipoPago =
      // 'Crédito' — el chequeo contra `montoTotal` SÍ tiene que ser acá, no
      // en validarForma, porque el precio final de cada ítem (y por lo
      // tanto el total) recién se conoce una vez resueltos los lotes/precios
      // arriba en esta misma función.
      if (tipoPago === 'Crédito' && pagoInicial) {
        const montoInicial = Number(pagoInicial.monto)
        if (montoInicial > montoTotal) {
          throw new ErrorValidacionVenta(
            `El pago inicial ($${montoInicial.toFixed(2)}) no puede superar el total de la venta ` +
              `($${montoTotal.toFixed(2)}).`
          )
        }
        await tx.insert(pagos).values({
          ventaId: ventaCreada.id,
          monto: String(montoInicial),
          metodoPago: pagoInicial.metodoPago ?? metodoPago
        })
      }

      // Aviso de stock bajo (HU-08): se mira DESPUÉS de todos los descuentos
      // de stock de esta Venta (no después de cada ítem), para que si un
      // mismo producto aparece en dos ítems el resultado sea el stock final,
      // no uno intermedio. Una sola consulta por los productos distintos que
      // tocó esta Venta, no una por ítem.
      const productoIdsAfectados = [...new Set(itemsAInsertar.map((i) => i.productoId))]
      const productosFinales = await tx
        .select({ id: productos.id, nombre: productos.nombre, stock: productos.stock, stockMinimo: productos.stockMinimo })
        .from(productos)
        .where(inArray(productos.id, productoIdsAfectados))
      const productosStockBajo: ProductoStockBajo[] = productosFinales
        .filter((p) => p.stockMinimo !== null && p.stock <= p.stockMinimo)
        .map((p) => ({ productoId: p.id, nombre: p.nombre, stock: p.stock, stockMinimo: p.stockMinimo as number }))

      return { ...ventaCreada, items: itemsCreados, productosStockBajo }
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
    .select({ id: itemsVenta.id, ventaId: itemsVenta.ventaId })
    .from(itemsVenta)
    .where(inArray(itemsVenta.ventaId, idsVentas))
  const cantidadPorVenta = new Map<number, number>()
  for (const it of filasItems) {
    cantidadPorVenta.set(it.ventaId, (cantidadPorVenta.get(it.ventaId) ?? 0) + 1)
  }

  // tieneSaldoPendiente por venta (cambio de alcance 22/11/2026: antes se
  // resolvía por ítem — ver nota al principio del archivo): se resuelve el
  // saldo de cada Venta a crédito del lote en bloque (misma fórmula que
  // calcularSaldoPendienteVenta, de services/pagos.ts, pero sin un
  // round-trip por venta).
  const idsVentasCredito = filas.filter((v) => v.tipoPago === 'Crédito').map((v) => v.id)
  const filasPagos = idsVentasCredito.length
    ? await db
        .select({ ventaId: pagos.ventaId, monto: pagos.monto })
        .from(pagos)
        .where(inArray(pagos.ventaId, idsVentasCredito))
    : []
  const pagadoPorVenta = new Map<number, number>()
  for (const p of filasPagos) {
    if (p.ventaId === null) continue
    pagadoPorVenta.set(p.ventaId, (pagadoPorVenta.get(p.ventaId) ?? 0) + Number(p.monto))
  }
  const ventaConSaldo = new Set<number>()
  for (const v of filas) {
    if (v.tipoPago !== 'Crédito') continue
    const pagado = pagadoPorVenta.get(v.id) ?? 0
    if (Number(v.montoTotal) - pagado > 0) ventaConSaldo.add(v.id)
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
  // Cambio de alcance (22/11/2026): el saldo pendiente ya no se evalúa por
  // ítem, sino sobre la Venta completa (monto_total vs. pagos de la venta) —
  // ver nota al principio del archivo.
  if (filtros.soloConSaldoPendiente) {
    condiciones.push(sql`${ventas.tipoPago} = 'Crédito' AND ${ventas.montoTotal} > COALESCE(
      (SELECT SUM(${pagos.monto}) FROM ${pagos} WHERE ${pagos.ventaId} = ${ventas.id}),
      0
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

  // Sin .orderBy(), el orden de las filas no está garantizado y puede
  // cambiar entre una llamada y la siguiente (por ejemplo, después de un
  // INSERT en `pagos` al cobrar una cuota, aunque esa tabla no toque a
  // itemsVenta) — es la misma causa que el .orderBy() agregado el
  // 16/11/2026 en saldoClientes.ts, acá en el lugar donde en verdad hacía
  // falta: esta es la consulta que arma el detalle de una Venta para
  // VentasScreen.tsx, donde se vio un ítem "saltar" de posición justo
  // después de cobrarle una cuota al otro.
  const items = await db
    .select()
    .from(itemsVenta)
    .where(eq(itemsVenta.ventaId, id))
    .orderBy(itemsVenta.id)

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

  const itemsConDetalle: ItemVentaDetalle[] = items.map((it) => ({
    ...it,
    productoNombre: nombrePorProducto.get(it.productoId) ?? `Producto #${it.productoId}`
  }))

  // Saldo pendiente a nivel de toda la Venta (cambio de alcance 22/11/2026 —
  // ver nota al principio del archivo), reutilizando la misma fórmula que
  // Orden de Servicio.
  const saldoPendiente = await calcularSaldoPendienteVenta(db, venta)

  return {
    ok: true,
    data: {
      ...venta,
      clienteNombre,
      usuarioNombre: u?.nombre ?? '—',
      items: itemsConDetalle,
      saldoPendiente
    }
  }
}

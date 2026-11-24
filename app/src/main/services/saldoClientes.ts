// src/main/services/saldoClientes.ts
//
// Saldo de Cliente (HU-11) y listado de créditos vencidos (HU-10.2).
// Fase 6 del reparto — ver docs/03-gestion-proyecto/
// tareas-ventas-creditopagos-deudatecnica.md.
//
// Decisión de diseño: el saldo de un Cliente es la suma del saldo pendiente
// de sus Ventas a Crédito MÁS sus Órdenes de Servicio a Crédito (ver
// entidades-dominio.md, sección 7.2 y 12.1).
//
// Las fórmulas de saldo pendiente (tanto de Venta como de Orden de Servicio,
// ya con sus Pagos de la Fase 5 descontados) se reutilizan de
// services/pagos.ts (calcularSaldoPendienteVenta / calcularSaldoPendienteOrden)
// para no duplicarlas ni arriesgarse a que queden desincronizadas.
//
// Cambio de alcance (22/11/2026, ver entidades-dominio.md, sección 12): el
// crédito de Venta pasó de Ítem de Venta a Venta completa. La "deuda" que
// antes era por Ítem de Venta ahora es por Venta completa (con sus
// productos listados, para no perder el detalle que mostraba HU-11).

import { and, eq, isNotNull, lt } from 'drizzle-orm'
import type { Db } from '../api/server'
import { clientes, itemsVenta, ordenesServicio, productos, ventas } from '../db/schema'
import { calcularSaldoPendienteVenta, calcularSaldoPendienteOrden } from './pagos'

export type Resultado<T> = { ok: true; data: T } | { ok: false; status: number; mensaje: string }

// Deuda pendiente de una Venta a crédito. `productos` lista los nombres de
// los productos incluidos, para no perder el detalle que antes daba el
// desglose por Ítem de Venta.
export interface DeudaItemVenta {
  tipo: 'venta'
  ventaId: number
  productos: string[]
  fecha: string
  montoTotal: number
  saldoPendiente: number
  fechaPagoPrevista: string | null
}

// Deuda pendiente de una Orden de Servicio a crédito.
export interface DeudaOrdenServicio {
  tipo: 'orden'
  ordenServicioId: number
  fecha: string
  montoTotal: number
  saldoPendiente: number
  fechaPagoPrevista: string | null
}

export type DeudaPendiente = DeudaItemVenta | DeudaOrdenServicio

export interface SaldoCliente {
  clienteId: number
  clienteNombre: string
  saldoTotal: number
  deudas: DeudaPendiente[]
}

// Una fila del listado global de créditos vencidos (HU-10.2): mezcla Ventas
// y Órdenes de Servicio, siempre con el cliente ya resuelto (un cliente
// casual, sin clienteId, no tiene ficha donde avisarle, así que se descarta
// del listado).
export interface CreditoVencido {
  tipo: 'venta' | 'orden'
  id: number // ventaId u ordenServicioId según `tipo`
  clienteId: number
  clienteNombre: string
  fechaPagoPrevista: string
  saldoPendiente: number
  diasVencido: number
}

// Días corridos entre dos fechas 'YYYY-MM-DD' (positivo si `hasta` es
// posterior a `desde`). Se usa para "días vencido" en el listado de HU-10.2.
function diasEntre(desde: string, hasta: string): number {
  const msPorDia = 24 * 60 * 60 * 1000
  const a = Date.parse(`${desde}T00:00:00Z`)
  const b = Date.parse(`${hasta}T00:00:00Z`)
  return Math.round((b - a) / msPorDia)
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Saldo total y detalle de deudas de un Cliente (HU-11).
export async function calcularSaldoCliente(db: Db, clienteId: number): Promise<Resultado<SaldoCliente>> {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, clienteId))
  if (!cliente) return { ok: false, status: 404, mensaje: 'Cliente no encontrado.' }

  // --- Ventas a crédito de este cliente (cambio de alcance 22/11/2026: antes
  // se consultaba por Ítem de Venta — ver nota al principio del archivo) ---
  const filasVentas = await db
    .select({
      ventaId: ventas.id,
      montoTotal: ventas.montoTotal,
      fechaPagoPrevista: ventas.fechaPagoPrevista,
      fecha: ventas.fecha
    })
    .from(ventas)
    .where(and(eq(ventas.clienteId, clienteId), eq(ventas.tipoPago, 'Crédito')))
    // Sin esto, el orden de las filas no está garantizado (puede cambiar
    // entre llamadas, por ejemplo después de un INSERT en otra tabla como
    // `pagos` — no hace falta que toque esta tabla para que el motor decida
    // devolver las filas en otro orden) — mismo motivo que ya motivó este
    // mismo .orderBy() el 16/11/2026.
    .orderBy(ventas.id)

  const deudasItems: DeudaItemVenta[] = []
  for (const v of filasVentas) {
    const saldo = await calcularSaldoPendienteVenta(db, { id: v.ventaId, montoTotal: v.montoTotal })
    if (saldo <= 0) continue // ya saldada: no se muestra como deuda

    // Nombres de los productos de la venta, para no perder el detalle que
    // antes daba el desglose por Ítem de Venta en el saldo del cliente.
    const filasProductos = await db
      .select({ productoNombre: productos.nombre })
      .from(itemsVenta)
      .innerJoin(productos, eq(itemsVenta.productoId, productos.id))
      .where(eq(itemsVenta.ventaId, v.ventaId))
      .orderBy(itemsVenta.id)

    deudasItems.push({
      tipo: 'venta',
      ventaId: v.ventaId,
      productos: filasProductos.map((p) => p.productoNombre),
      fecha: v.fecha.toISOString(),
      montoTotal: Number(v.montoTotal),
      saldoPendiente: saldo,
      fechaPagoPrevista: v.fechaPagoPrevista
    })
  }

  // --- Órdenes de Servicio a crédito de este cliente ---
  // (ver nota de diseño al principio del archivo: hoy no hay filas, pero la
  // consulta ya está lista para cuando el módulo de Servicios las cargue).
  const filasOrdenes = await db
    .select()
    .from(ordenesServicio)
    .where(and(eq(ordenesServicio.clienteId, clienteId), eq(ordenesServicio.tipoPago, 'Crédito')))
    // Mismo motivo que el .orderBy() de arriba, en la consulta de Ítems de
    // Venta: sin orden explícito, dos Órdenes del mismo día (misma `fecha`
    // a nivel de día) podrían reordenarse entre llamadas.
    .orderBy(ordenesServicio.id)

  const deudasOrdenes: DeudaOrdenServicio[] = []
  for (const orden of filasOrdenes) {
    const saldo = await calcularSaldoPendienteOrden(db, orden)
    if (saldo <= 0) continue
    deudasOrdenes.push({
      tipo: 'orden',
      ordenServicioId: orden.id,
      fecha: orden.fecha.toISOString(),
      montoTotal: Number(orden.montoTotal),
      saldoPendiente: saldo,
      fechaPagoPrevista: orden.fechaPagoPrevista
    })
  }

  // Más antigua primero: igual que una cuenta corriente real, para ver qué
  // deuda viene arrastrándose desde hace más tiempo.
  const deudas: DeudaPendiente[] = [...deudasItems, ...deudasOrdenes].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  )
  const saldoTotal = deudas.reduce((acc, d) => acc + d.saldoPendiente, 0)

  return {
    ok: true,
    data: { clienteId, clienteNombre: cliente.nombre, saldoTotal, deudas }
  }
}

// Listado global de créditos vencidos (HU-10.2): Ítems de Venta y Órdenes de
// Servicio a crédito cuya fechaPagoPrevista ya pasó y todavía tienen saldo.
// Se usa tanto para un aviso en el dashboard/Clientes como, a futuro, para
// una notificación proactiva (fuera del alcance de este punto).
export async function listarCreditosVencidos(db: Db): Promise<CreditoVencido[]> {
  const hoy = hoyIso()
  const resultado: CreditoVencido[] = []

  // Cambio de alcance 22/11/2026: se consulta `ventas` directamente, no
  // `itemsVenta` — ver nota al principio del archivo.
  const filasVentas = await db
    .select({
      ventaId: ventas.id,
      montoTotal: ventas.montoTotal,
      fechaPagoPrevista: ventas.fechaPagoPrevista,
      clienteId: ventas.clienteId,
      clienteNombre: clientes.nombre
    })
    .from(ventas)
    .leftJoin(clientes, eq(ventas.clienteId, clientes.id))
    .where(
      and(
        eq(ventas.tipoPago, 'Crédito'),
        isNotNull(ventas.fechaPagoPrevista),
        lt(ventas.fechaPagoPrevista, hoy)
      )
    )

  for (const f of filasVentas) {
    if (f.clienteId === null) continue // cliente casual: sin ficha donde avisar
    const saldo = await calcularSaldoPendienteVenta(db, { id: f.ventaId, montoTotal: f.montoTotal })
    if (saldo <= 0) continue
    resultado.push({
      tipo: 'venta',
      id: f.ventaId,
      clienteId: f.clienteId,
      clienteNombre: f.clienteNombre ?? '—',
      fechaPagoPrevista: f.fechaPagoPrevista as string,
      saldoPendiente: saldo,
      diasVencido: diasEntre(f.fechaPagoPrevista as string, hoy)
    })
  }

  const filasOrdenes = await db
    .select({
      orden: ordenesServicio,
      // Viene del innerJoin con `clientes`: es siempre un number (las órdenes
      // de cliente casual, con cliente_id null, quedan fuera de este listado).
      clienteId: clientes.id,
      clienteNombre: clientes.nombre
    })
    .from(ordenesServicio)
    .innerJoin(clientes, eq(ordenesServicio.clienteId, clientes.id))
    .where(
      and(
        eq(ordenesServicio.tipoPago, 'Crédito'),
        isNotNull(ordenesServicio.fechaPagoPrevista),
        lt(ordenesServicio.fechaPagoPrevista, hoy)
      )
    )

  for (const { orden, clienteId, clienteNombre } of filasOrdenes) {
    const saldo = await calcularSaldoPendienteOrden(db, orden)
    if (saldo <= 0) continue
    resultado.push({
      tipo: 'orden',
      id: orden.id,
      clienteId,
      clienteNombre,
      fechaPagoPrevista: orden.fechaPagoPrevista as string,
      saldoPendiente: saldo,
      diasVencido: diasEntre(orden.fechaPagoPrevista as string, hoy)
    })
  }

  // Más vencido primero: es lo más urgente de cobrar.
  resultado.sort((a, b) => b.diasVencido - a.diasVencido)
  return resultado
}

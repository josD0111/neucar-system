// src/main/services/saldoClientes.ts
//
// Saldo de Cliente (HU-11) y listado de créditos vencidos (HU-10.2).
// Fase 6 del reparto — ver docs/03-gestion-proyecto/
// tareas-ventas-creditopagos-deudatecnica.md.
//
// Decisión de diseño: el saldo de un Cliente es la suma del saldo pendiente
// de sus Ítems de Venta a Crédito MÁS sus Órdenes de Servicio a Crédito (ver
// entidades-dominio.md, sección 7.2 y 12.1). La tabla `ordenesServicio` ya
// existe en el esquema aunque todavía no haya pantalla/servicio que la
// cargue (eso queda a cargo del módulo de Vehículos/Servicios, Sprint 2,
// puntos 2 y 3): se consulta igual acá, así que en cuanto existan filas
// aparecen solas en el saldo, sin tocar este archivo.
//
// La fórmula del saldo de un Ítem de Venta se reutiliza de services/pagos.ts
// (calcularSaldoPendienteItem) para no duplicarla ni arriesgarse a que
// queden desincronizadas.

import { and, eq, isNotNull, lt } from 'drizzle-orm'
import type { Db } from '../api/server'
import { clientes, itemsVenta, ordenesServicio, pagos, productos, ventas } from '../db/schema'
import { calcularSaldoPendienteItem } from './pagos'

export type Resultado<T> = { ok: true; data: T } | { ok: false; status: number; mensaje: string }

type OrdenServicioFila = typeof ordenesServicio.$inferSelect

// Deuda pendiente de un Ítem de Venta (producto vendido a crédito).
export interface DeudaItemVenta {
  tipo: 'venta'
  itemVentaId: number
  ventaId: number
  productoNombre: string
  fecha: string
  montoItem: number
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

// Una fila del listado global de créditos vencidos (HU-10.2): mezcla Ítems
// de Venta y Órdenes de Servicio, siempre con el cliente ya resuelto (un
// cliente casual, sin clienteId, no tiene ficha donde avisarle, así que se
// descarta del listado).
export interface CreditoVencido {
  tipo: 'venta' | 'orden'
  id: number // itemVentaId u ordenServicioId según `tipo`
  clienteId: number
  clienteNombre: string
  fechaPagoPrevista: string
  saldoPendiente: number
  diasVencido: number
}

// Saldo pendiente de una Orden de Servicio: montoTotal − suma(pagos de esa
// orden). Mismo criterio que calcularSaldoPendienteItem (nunca negativo).
async function calcularSaldoPendienteOrden(db: Db, orden: OrdenServicioFila): Promise<number> {
  const pagosOrden = await db.select().from(pagos).where(eq(pagos.ordenServicioId, orden.id))
  const pagado = pagosOrden.reduce((acc, p) => acc + Number(p.monto), 0)
  const saldo = Number(orden.montoTotal) - pagado
  return saldo > 0 ? saldo : 0
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

  // --- Ítems de Venta a crédito de este cliente ---
  const filasItems = await db
    .select({
      itemVentaId: itemsVenta.id,
      ventaId: itemsVenta.ventaId,
      precioUnitario: itemsVenta.precioUnitario,
      cantidad: itemsVenta.cantidad,
      fechaPagoPrevista: itemsVenta.fechaPagoPrevista,
      fechaVenta: ventas.fecha,
      productoNombre: productos.nombre
    })
    .from(itemsVenta)
    .innerJoin(ventas, eq(itemsVenta.ventaId, ventas.id))
    .innerJoin(productos, eq(itemsVenta.productoId, productos.id))
    .where(and(eq(ventas.clienteId, clienteId), eq(itemsVenta.tipoPago, 'Crédito')))

  const deudasItems: DeudaItemVenta[] = []
  for (const f of filasItems) {
    const saldo = await calcularSaldoPendienteItem(db, {
      id: f.itemVentaId,
      precioUnitario: f.precioUnitario,
      cantidad: f.cantidad
    })
    if (saldo <= 0) continue // ya saldado: no se muestra como deuda
    deudasItems.push({
      tipo: 'venta',
      itemVentaId: f.itemVentaId,
      ventaId: f.ventaId,
      productoNombre: f.productoNombre,
      fecha: f.fechaVenta.toISOString(),
      montoItem: Number(f.precioUnitario) * f.cantidad,
      saldoPendiente: saldo,
      fechaPagoPrevista: f.fechaPagoPrevista
    })
  }

  // --- Órdenes de Servicio a crédito de este cliente ---
  // (ver nota de diseño al principio del archivo: hoy no hay filas, pero la
  // consulta ya está lista para cuando el módulo de Servicios las cargue).
  const filasOrdenes = await db
    .select()
    .from(ordenesServicio)
    .where(and(eq(ordenesServicio.clienteId, clienteId), eq(ordenesServicio.tipoPago, 'Crédito')))

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

  const filasItems = await db
    .select({
      itemVentaId: itemsVenta.id,
      precioUnitario: itemsVenta.precioUnitario,
      cantidad: itemsVenta.cantidad,
      fechaPagoPrevista: itemsVenta.fechaPagoPrevista,
      clienteId: ventas.clienteId,
      clienteNombre: clientes.nombre
    })
    .from(itemsVenta)
    .innerJoin(ventas, eq(itemsVenta.ventaId, ventas.id))
    .leftJoin(clientes, eq(ventas.clienteId, clientes.id))
    .where(
      and(
        eq(itemsVenta.tipoPago, 'Crédito'),
        isNotNull(itemsVenta.fechaPagoPrevista),
        lt(itemsVenta.fechaPagoPrevista, hoy)
      )
    )

  for (const f of filasItems) {
    if (f.clienteId === null) continue // cliente casual: sin ficha donde avisar
    const saldo = await calcularSaldoPendienteItem(db, {
      id: f.itemVentaId,
      precioUnitario: f.precioUnitario,
      cantidad: f.cantidad
    })
    if (saldo <= 0) continue
    resultado.push({
      tipo: 'venta',
      id: f.itemVentaId,
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

  for (const { orden, clienteNombre } of filasOrdenes) {
    const saldo = await calcularSaldoPendienteOrden(db, orden)
    if (saldo <= 0) continue
    resultado.push({
      tipo: 'orden',
      id: orden.id,
      clienteId: orden.clienteId,
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

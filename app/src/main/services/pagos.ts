// src/main/services/pagos.ts
//
// Servicio de negocio de Pagos sobre Ventas (Fase 3 del reparto — ver
// docs/03-gestion-proyecto/tareas-ventas-creditopagos-deudatecnica.md) y
// sobre Órdenes de Servicio (Fase 5, agregada el 15/11/2026 — ver
// entidades-dominio.md, sección 7.2). Ambos comparten archivo porque son el
// mismo concepto (un abono contra un saldo pendiente) con dos orígenes
// distintos; cada bloque de funciones está separado más abajo.
//
// Decisiones de diseño aplicadas acá:
//
// - `saldo_pendiente` NO se guarda como columna: se calcula siempre como
//   (montoTotal) − suma(pagos.monto) de la Venta/Orden (ver
//   entidades-dominio.md, sección 7 y 12).
// - Pago que excede el saldo pendiente (HU-10.1): no se rechaza, pero
//   tampoco genera saldo a favor. El `monto` que se persiste queda limitado
//   (clamp) al saldo pendiente exacto. El "vuelto" (lo que sobra) es
//   responsabilidad de la interfaz: se calcula y se muestra ahí, pero nunca
//   se manda a este servicio ni se guarda (ver desiciones-alcance.md,
//   sección 7.3).
// - Una venta Contado genera automáticamente su propio Pago por el monto
//   total al momento de registrarse (ver services/ventas.ts,
//   registrarVenta) — decisión cerrada el 25/10/2026 para cerrar la nota de
//   diseño pendiente de entidades-dominio.md, sección 7.2: así
//   `saldo_pendiente` se calcula exactamente igual para Contado y Crédito,
//   sin casos especiales. Por eso acá alcanza con mirar si todavía queda
//   saldo pendiente > 0, en vez de distinguir el tipo de pago.
//
// Cambio de alcance (22/11/2026, planificación técnica del Sprint 3, punto
// 1 — ver entidades-dominio.md, sección 12): el crédito de Venta se movió
// de Ítem de Venta a Venta completa, mismo criterio que ya usaba Orden de
// Servicio. `calcularSaldoPendienteItem`/`registrarPagoItem`/`listarPagosItem`
// (por Ítem de Venta) se reemplazan acá por `calcularSaldoPendienteVenta`/
// `registrarPagoVenta`/`listarPagosVenta` (por Venta completa).

import { eq } from 'drizzle-orm'
import type { Db } from '../api/server'
import { ordenesServicio, pagos, ventas } from '../db/schema'

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export type Pago = typeof pagos.$inferSelect
type Venta = typeof ventas.$inferSelect
type OrdenServicioFila = typeof ordenesServicio.$inferSelect

export interface PagoInput {
  monto: number
  metodoPago: string
  // Permite actualizar la fecha prevista de la próxima cuota al registrar
  // este pago (tarea 13 de la Fase 3, ver HU-10.2). Si se omite, no se toca.
  fechaPagoPrevista?: string | null
}

export type Resultado<T> = { ok: true; data: T } | { ok: false; status: number; mensaje: string }

// Error de validación "esperado", con su propio status HTTP — a diferencia
// de ErrorValidacionVenta (services/ventas.ts), acá hace falta distinguir
// 404 (ítem inexistente) de 400 (dato inválido o sin saldo), por eso lleva
// el status adentro en vez de asumir siempre 400.
export class ErrorValidacionPago extends Error {
  status: number
  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

function fechaValida(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor))
}

function validarForma(body: unknown): Resultado<PagoInput> {
  const b = (body ?? {}) as Record<string, unknown>

  const monto = Number(b.monto)
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, status: 400, mensaje: 'El monto del pago debe ser mayor a 0.' }
  }

  const metodoPago = typeof b.metodoPago === 'string' ? b.metodoPago : ''
  if (!METODOS_PAGO.includes(metodoPago as MetodoPago)) {
    return {
      ok: false,
      status: 400,
      mensaje: `El método de pago debe ser uno de: ${METODOS_PAGO.join(', ')}.`
    }
  }

  let fechaPagoPrevista: string | null | undefined
  if (b.fechaPagoPrevista !== undefined && b.fechaPagoPrevista !== null) {
    if (typeof b.fechaPagoPrevista !== 'string' || !fechaValida(b.fechaPagoPrevista)) {
      return { ok: false, status: 400, mensaje: 'La fecha de pago prevista no es válida.' }
    }
    fechaPagoPrevista = b.fechaPagoPrevista
  }

  return { ok: true, data: { monto, metodoPago, fechaPagoPrevista } }
}

// Saldo pendiente de una Venta: montoTotal - pagos (cambio de alcance
// 22/11/2026: antes era por Ítem de Venta — ver nota al principio del
// archivo). Expuesto para que otras capas (Fase 6, saldo de cliente) lo
// reutilicen sin duplicar la fórmula. Nunca negativo: un pago nunca puede
// generar saldo a favor (ver nota de diseño arriba), así que en condiciones
// normales nunca baja de 0 — se protege igual por las dudas (redondeos).
export async function calcularSaldoPendienteVenta(
  db: Db,
  venta: Pick<Venta, 'id' | 'montoTotal'>
): Promise<number> {
  const pagosDeVenta = await db.select().from(pagos).where(eq(pagos.ventaId, venta.id))
  const pagado = pagosDeVenta.reduce((acc, p) => acc + Number(p.monto), 0)
  const saldo = Number(venta.montoTotal) - pagado
  return saldo > 0 ? saldo : 0
}

// Pagos registrados sobre una Venta puntual, más recientes primero.
export async function listarPagosVenta(db: Db, ventaId: number): Promise<Resultado<Pago[]>> {
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, ventaId))
  if (!venta) return { ok: false, status: 404, mensaje: 'Venta no encontrada.' }

  const filas = await db.select().from(pagos).where(eq(pagos.ventaId, ventaId))
  return { ok: true, data: filas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()) }
}

// Registra un pago (abono/cuota) sobre una Venta a crédito. Una venta
// Contado ya quedó pagada al registrarse (ver nota de diseño arriba), así
// que acá se rechaza explícitamente para ese caso, con un mensaje claro en
// vez de dejar que el clamp a saldo-0 lo explique indirectamente.
export async function registrarPagoVenta(
  db: Db,
  ventaId: number,
  body: unknown
): Promise<Resultado<Pago>> {
  const v = validarForma(body)
  if (!v.ok) return v
  const { monto, metodoPago, fechaPagoPrevista } = v.data

  try {
    const pago = await db.transaction(async (tx) => {
      const [venta] = await tx.select().from(ventas).where(eq(ventas.id, ventaId))
      if (!venta) {
        throw new ErrorValidacionPago(404, 'Venta no encontrada.')
      }
      if (venta.tipoPago === 'Contado') {
        throw new ErrorValidacionPago(
          400,
          'Esta venta fue registrada al contado: ya quedó pagada al registrarse.'
        )
      }

      const pagosDeVenta = await tx.select().from(pagos).where(eq(pagos.ventaId, ventaId))
      const pagado = pagosDeVenta.reduce((acc, p) => acc + Number(p.monto), 0)
      const saldoPendiente = Math.max(Number(venta.montoTotal) - pagado, 0)

      if (saldoPendiente <= 0) {
        throw new ErrorValidacionPago(400, 'Esta venta ya no tiene saldo pendiente.')
      }

      // Clamp (HU-10.1, ver nota de diseño arriba): el excedente entregado
      // por el cliente ("vuelto") lo calcula y muestra la interfaz, nunca se
      // persiste acá.
      const montoAPersistir = Math.min(monto, saldoPendiente)

      const [filaPago] = await tx
        .insert(pagos)
        .values({ ventaId, monto: String(montoAPersistir), metodoPago })
        .returning()

      if (fechaPagoPrevista !== undefined) {
        await tx.update(ventas).set({ fechaPagoPrevista }).where(eq(ventas.id, ventaId))
      }

      return filaPago
    })

    return { ok: true, data: pago }
  } catch (err) {
    if (err instanceof ErrorValidacionPago) {
      return { ok: false, status: err.status, mensaje: err.message }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Pagos sobre Órdenes de Servicio (Fase 5 — ver entidades-dominio.md, 7.2).
//
// Mismo criterio que arriba, con dos diferencias de forma:
// - El "monto del ítem" acá es `orden.montoTotal` (ya calculado y guardado
//   por services/ordenesServicio.ts al crear la orden, suma de sus
//   Servicios), no `precioUnitario * cantidad`.
// - Se rechaza el pago si la orden es "Contado", igual que con un Ítem de
//   Venta: a diferencia de una Venta, una Orden "Contado" NO genera un Pago
//   automático al crearse (ver services/ordenesServicio.ts, nota al inicio
//   del archivo) porque no hace falta — el saldo de cliente (HU-11) ya
//   filtra por `tipoPago = 'Crédito'` antes de sumar nada — pero el mensaje
//   de rechazo acá es el mismo: no tiene sentido cobrar una cuota de algo
//   que no quedó a crédito.

// Saldo pendiente de una Orden de Servicio: montoTotal − suma(pagos de esa
// orden). Se reutiliza también desde services/saldoClientes.ts, igual que
// calcularSaldoPendienteItem, para no duplicar la fórmula.
export async function calcularSaldoPendienteOrden(
  db: Db,
  orden: Pick<OrdenServicioFila, 'id' | 'montoTotal'>
): Promise<number> {
  const pagosDeOrden = await db.select().from(pagos).where(eq(pagos.ordenServicioId, orden.id))
  const pagado = pagosDeOrden.reduce((acc, p) => acc + Number(p.monto), 0)
  const saldo = Number(orden.montoTotal) - pagado
  return saldo > 0 ? saldo : 0
}

// Pagos registrados sobre una Orden de Servicio puntual, más recientes primero.
export async function listarPagosOrden(db: Db, ordenServicioId: number): Promise<Resultado<Pago[]>> {
  const [orden] = await db.select().from(ordenesServicio).where(eq(ordenesServicio.id, ordenServicioId))
  if (!orden) return { ok: false, status: 404, mensaje: 'Orden de servicio no encontrada.' }

  const filas = await db.select().from(pagos).where(eq(pagos.ordenServicioId, ordenServicioId))
  return { ok: true, data: filas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()) }
}

// Registra un pago (abono/cuota) sobre una Orden de Servicio a crédito.
export async function registrarPagoOrden(
  db: Db,
  ordenServicioId: number,
  body: unknown
): Promise<Resultado<Pago>> {
  const v = validarForma(body)
  if (!v.ok) return v
  const { monto, metodoPago, fechaPagoPrevista } = v.data

  try {
    const pago = await db.transaction(async (tx) => {
      const [orden] = await tx
        .select()
        .from(ordenesServicio)
        .where(eq(ordenesServicio.id, ordenServicioId))
      if (!orden) {
        throw new ErrorValidacionPago(404, 'Orden de servicio no encontrada.')
      }
      if (orden.tipoPago === 'Contado') {
        throw new ErrorValidacionPago(
          400,
          'Esta orden fue registrada al contado: no tiene saldo pendiente para cobrar.'
        )
      }

      const pagosDeOrden = await tx
        .select()
        .from(pagos)
        .where(eq(pagos.ordenServicioId, ordenServicioId))
      const pagado = pagosDeOrden.reduce((acc, p) => acc + Number(p.monto), 0)
      const saldoPendiente = Math.max(Number(orden.montoTotal) - pagado, 0)

      if (saldoPendiente <= 0) {
        throw new ErrorValidacionPago(400, 'Esta orden de servicio ya no tiene saldo pendiente.')
      }

      // Mismo clamp que en Ítems de Venta (HU-10.1): el excedente ("vuelto")
      // lo calcula y muestra la interfaz, nunca se persiste acá.
      const montoAPersistir = Math.min(monto, saldoPendiente)

      const [filaPago] = await tx
        .insert(pagos)
        .values({ ordenServicioId, monto: String(montoAPersistir), metodoPago })
        .returning()

      if (fechaPagoPrevista !== undefined) {
        await tx
          .update(ordenesServicio)
          .set({ fechaPagoPrevista })
          .where(eq(ordenesServicio.id, ordenServicioId))
      }

      return filaPago
    })

    return { ok: true, data: pago }
  } catch (err) {
    if (err instanceof ErrorValidacionPago) {
      return { ok: false, status: err.status, mensaje: err.message }
    }
    throw err
  }
}

// src/renderer/src/api/pagos.ts
//
// Cliente del módulo de Pagos sobre Ítems de Venta y sobre Órdenes de
// Servicio (Fase 5, agregada el 15/11/2026) — ver
// src/main/api/routes/pagos.ts.

import { apiFetch } from './client'
import type { Pago, PagoInput } from './types'

export const pagosApi = {
  listarPorItem: (token: string | null, itemVentaId: number) =>
    apiFetch<Pago[]>(`/api/pagos/item/${itemVentaId}`, { token }),

  registrarPorItem: (token: string | null, itemVentaId: number, input: PagoInput) =>
    apiFetch<Pago>(`/api/pagos/item/${itemVentaId}`, {
      token,
      method: 'POST',
      body: input
    }),

  listarPorOrden: (token: string | null, ordenServicioId: number) =>
    apiFetch<Pago[]>(`/api/pagos/orden/${ordenServicioId}`, { token }),

  registrarPorOrden: (token: string | null, ordenServicioId: number, input: PagoInput) =>
    apiFetch<Pago>(`/api/pagos/orden/${ordenServicioId}`, {
      token,
      method: 'POST',
      body: input
    })
}

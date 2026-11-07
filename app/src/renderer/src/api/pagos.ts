// src/renderer/src/api/pagos.ts
//
// Cliente del módulo de Pagos sobre Ítems de Venta (ver
// src/main/api/routes/pagos.ts). Los pagos sobre Órdenes de Servicio
// (Fase 5 del reparto) se agregan más adelante bajo otro prefijo, sin tocar
// esto.

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
    })
}

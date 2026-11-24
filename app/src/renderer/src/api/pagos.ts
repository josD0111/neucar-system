// src/renderer/src/api/pagos.ts
//
// Cliente del módulo de Pagos sobre Ventas y sobre Órdenes de Servicio
// (Fase 5, agregada el 15/11/2026) — ver src/main/api/routes/pagos.ts.
//
// Cambio de alcance (22/11/2026): `listarPorItem`/`registrarPorItem` (sobre
// un Ítem de Venta puntual) pasan a `listarPorVenta`/`registrarPorVenta`
// (sobre la Venta completa) — ver entidades-dominio.md, sección 12.

import { apiFetch } from './client'
import type { Pago, PagoInput } from './types'

export const pagosApi = {
  listarPorVenta: (token: string | null, ventaId: number) =>
    apiFetch<Pago[]>(`/api/pagos/venta/${ventaId}`, { token }),

  registrarPorVenta: (token: string | null, ventaId: number, input: PagoInput) =>
    apiFetch<Pago>(`/api/pagos/venta/${ventaId}`, {
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

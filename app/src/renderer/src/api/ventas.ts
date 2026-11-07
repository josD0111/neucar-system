// src/renderer/src/api/ventas.ts
//
// A diferencia de productos/categorias/proveedores/compras (cliente `api`,
// sin sesión), Ventas exige autenticación desde el inicio (ver
// sprint-2-backlog.md, punto 5), así que usa `apiFetch` con token — mismo
// cliente que `clientes`/`auth` (ver api/client.ts).

import { apiFetch } from './client'
import type { FiltrosVentas, PaginaVentas, VentaConItems, VentaDetalle, VentaInput } from './types'

export const ventasApi = {
  // Devuelve una PÁGINA (días calendario completos, no una cantidad fija de
  // ventas — ver api/types.ts, PaginaVentas). Para la siguiente página, pasar
  // el `antesDe` que devolvió esta.
  listar: (token: string | null, filtros: FiltrosVentas = {}) => {
    const params = new URLSearchParams()
    if (filtros.clienteId) params.set('clienteId', String(filtros.clienteId))
    if (filtros.q) params.set('q', filtros.q)
    if (filtros.metodoPago) params.set('metodoPago', filtros.metodoPago)
    if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde)
    if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta)
    if (filtros.soloConSaldoPendiente) params.set('soloConSaldoPendiente', 'true')
    if (filtros.antesDe) params.set('antesDe', filtros.antesDe)
    if (filtros.dias) params.set('dias', String(filtros.dias))
    const qs = params.toString()
    return apiFetch<PaginaVentas>(`/api/ventas${qs ? `?${qs}` : ''}`, { token })
  },
  obtener: (token: string | null, id: number) =>
    apiFetch<VentaDetalle>(`/api/ventas/${id}`, { token }),
  // Solo Administrador: el servidor rechaza (403) si lo llama un Empleado,
  // aunque este wrapper no distingue roles — la restricción real vive en el
  // middleware/servicio (ver routes/ventas.ts, services/ventas.ts).
  registrar: (token: string | null, input: VentaInput) =>
    apiFetch<VentaConItems>('/api/ventas', { method: 'POST', body: input, token })
}

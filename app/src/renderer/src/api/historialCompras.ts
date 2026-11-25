// src/renderer/src/api/historialCompras.ts
//
// Historial de compras (HU-38): exige sesión de Administrador, por eso usa
// apiFetch con token y no el cliente `api` de compras.ts.
import { apiFetch } from './client'
import type { FiltrosCompras, PaginaCompras } from './types'

export const historialComprasApi = {
  listar: (token: string | null, filtros: FiltrosCompras = {}) => {
    const params = new URLSearchParams()
    if (filtros.proveedorId) params.set('proveedorId', String(filtros.proveedorId))
    if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde)
    if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta)
    if (filtros.antesDe) params.set('antesDe', filtros.antesDe)
    if (filtros.dias) params.set('dias', String(filtros.dias))
    const qs = params.toString()
    return apiFetch<PaginaCompras>(`/api/compras${qs ? `?${qs}` : ''}`, { token })
  }
}
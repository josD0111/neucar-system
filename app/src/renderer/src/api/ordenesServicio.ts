// src/renderer/src/api/ordenesServicio.ts
//
// Órdenes de Servicio (HU-22 a HU-27, sin HU-25). Exige sesión: usa
// `apiFetch` con token (ver api/client.ts). No hay edición ni borrado: las
// órdenes son el historial del taller (HU-26).

import { apiFetch } from './client'
import type {
  FiltrosHistorialOrdenes,
  FiltrosOrdenesServicio,
  OrdenServicio,
  OrdenServicioInput,
  PaginaOrdenes
} from './types'

export const ordenesServicioApi = {
  // Historial, las más recientes primero. Filtros opcionales por cliente
  // y/o vehículo (HU-26).
  listar: (token: string | null, filtros: FiltrosOrdenesServicio = {}) => {
    const params = new URLSearchParams()
    if (filtros.clienteId) params.set('clienteId', String(filtros.clienteId))
    if (filtros.vehiculoId) params.set('vehiculoId', String(filtros.vehiculoId))
    if (filtros.limite) params.set('limite', String(filtros.limite))
    const qs = params.toString()
    return apiFetch<OrdenServicio[]>(`/api/ordenes-servicio${qs ? `?${qs}` : ''}`, { token })
  },
  // Historial paginado por DÍAS completos, con filtros y saldo pendiente (pantalla
  // Historial de servicios). Para la siguiente página, pasar el `antesDe` que
  // devolvió la anterior (ver api/types.ts, PaginaOrdenes).
  historial: (token: string | null, filtros: FiltrosHistorialOrdenes = {}) => {
    const params = new URLSearchParams()
    if (filtros.clienteId) params.set('clienteId', String(filtros.clienteId))
    if (filtros.vehiculoId) params.set('vehiculoId', String(filtros.vehiculoId))
    if (filtros.tipoPago) params.set('tipoPago', filtros.tipoPago)
    if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde)
    if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta)
    if (filtros.soloConSaldoPendiente) params.set('soloConSaldoPendiente', 'true')
    if (filtros.antesDe) params.set('antesDe', filtros.antesDe)
    if (filtros.dias) params.set('dias', String(filtros.dias))
    const qs = params.toString()
    return apiFetch<PaginaOrdenes>(`/api/ordenes-servicio/historial${qs ? `?${qs}` : ''}`, { token })
  },
  obtener: (token: string | null, id: number) =>
    apiFetch<OrdenServicio>(`/api/ordenes-servicio/${id}`, { token }),
  // Administrador y Empleado pueden registrar. El usuario que la registra
  // sale de la sesión en el servidor, no se envía acá.
  registrar: (token: string | null, input: OrdenServicioInput) =>
    apiFetch<OrdenServicio>('/api/ordenes-servicio', { method: 'POST', body: input, token })
}
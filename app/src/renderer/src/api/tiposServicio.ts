// src/renderer/src/api/tiposServicio.ts
//
// Catálogo de tipos de servicio. Exige sesión (usa `apiFetch` con token).
// Crear y editar es solo del Administrador (lo valida el servidor).

import { apiFetch } from './client'
import type { TipoServicio, TipoServicioInput } from './types'

export const tiposServicioApi = {
  // Por defecto solo los activos; incluirInactivos es solo para el Administrador.
  listar: (token: string | null, incluirInactivos = false) =>
    apiFetch<TipoServicio[]>(
      `/api/tipos-servicio${incluirInactivos ? '?incluirInactivos=true' : ''}`,
      { token }
    ),
  crear: (token: string | null, input: TipoServicioInput) =>
    apiFetch<TipoServicio>('/api/tipos-servicio', { method: 'POST', body: input, token }),
  // También sirve para deshabilitar/habilitar: editar(token, id, { activo: false }).
  editar: (token: string | null, id: number, cambios: Partial<TipoServicioInput>) =>
    apiFetch<TipoServicio>(`/api/tipos-servicio/${id}`, { method: 'PATCH', body: cambios, token })
}
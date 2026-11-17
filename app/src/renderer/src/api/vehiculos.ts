// src/renderer/src/api/vehiculos.ts
//
// Vehículos (soporte de HU-22/HU-26/HU-27). Exige sesión, así que usa
// `apiFetch` con token, igual que ventas y clientes (ver api/client.ts).
// El Empleado también puede usar todos estos endpoints: necesita elegir o
// dar de alta el vehículo al cargar una orden.

import { apiFetch } from './client'
import type { FiltrosVehiculos, Vehiculo, VehiculoInput } from './types'

export const vehiculosApi = {
  listar: (token: string | null, filtros: FiltrosVehiculos = {}) => {
    const params = new URLSearchParams()
    if (filtros.clienteId) params.set('clienteId', String(filtros.clienteId))
    if (filtros.q?.trim()) params.set('q', filtros.q.trim())
    const qs = params.toString()
    return apiFetch<Vehiculo[]>(`/api/vehiculos${qs ? `?${qs}` : ''}`, { token })
  },
  obtener: (token: string | null, id: number) =>
    apiFetch<Vehiculo>(`/api/vehiculos/${id}`, { token }),
  crear: (token: string | null, input: VehiculoInput) =>
    apiFetch<Vehiculo>('/api/vehiculos', { method: 'POST', body: input, token }),
  actualizar: (token: string | null, id: number, input: VehiculoInput) =>
    apiFetch<Vehiculo>(`/api/vehiculos/${id}`, { method: 'PUT', body: input, token }),
  // Asigna el dueño de un vehículo. Asignarlo a uno que no tiene dueño lo puede
  // hacer cualquier usuario; cambiar un dueño ya registrado es solo del
  // Administrador (el servidor responde 403 si no).
  asignarDueno: (token: string | null, id: number, clienteId: number) =>
    apiFetch<Vehiculo>(`/api/vehiculos/${id}/dueno`, { method: 'PATCH', body: { clienteId }, token })
}
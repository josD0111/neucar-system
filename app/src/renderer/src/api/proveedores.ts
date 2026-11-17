// src/renderer/src/api/proveedores.ts
import { api } from './client'
import type { Proveedor } from './types'

export const proveedoresApi = {
  listar: (): Promise<Proveedor[]> => api.get('/proveedores'),
  crear: (nombre: string, contacto?: string | null): Promise<Proveedor> =>
    api.post('/proveedores', { nombre, contacto: contacto ?? null }),
  // No hay DELETE /api/proveedores/:id en el backend todavía (ver
  // routes/proveedores.ts) — por eso no hay un `eliminar` acá.
  editar: (
    id: number,
    cambios: { nombre?: string; contacto?: string | null }
  ): Promise<Proveedor> => api.patch(`/proveedores/${id}`, cambios)
}
// src/renderer/src/api/compras.ts
import { api } from './client'
import type { Compra, CompraInput } from './types'

export interface CompraEdicionInput {
  proveedorId?: number
  fecha?: string
  cantidad?: number
  precioCompra?: number
  garantiaProveedor?: number | null
  factura?: string | null
}

export const comprasApi = {
  registrar: (input: CompraInput): Promise<Compra> => api.post('/compras', input),
  editar: (id: number, cambios: CompraEdicionInput): Promise<Compra> => api.patch(`/compras/${id}`, cambios),
  // Para corregir un lote cargado con el producto equivocado: no alcanza con
  // editar (el producto de un lote no es un campo editable), hay que
  // eliminarlo y cargarlo de nuevo con el producto correcto.
  eliminar: (id: number): Promise<{ id: number }> => api.delete(`/compras/${id}`)
}
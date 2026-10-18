// src/renderer/src/api/productos.ts
import { api } from './client'
import type { Producto, ProductoConLotes } from './types'

export interface FiltrosProductos {
  categoriaId?: number
  q?: string
  soloConStock?: boolean
}

function queryString(filtros: FiltrosProductos): string {
  const params = new URLSearchParams()
  if (filtros.categoriaId) params.set('categoriaId', String(filtros.categoriaId))
  if (filtros.q) params.set('q', filtros.q)
  if (filtros.soloConStock) params.set('soloConStock', 'true')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const productosApi = {
  listar: (filtros: FiltrosProductos = {}): Promise<Producto[]> =>
    api.get(`/productos${queryString(filtros)}`),
  stockBajo: (): Promise<Producto[]> => api.get('/productos/stock-bajo'),
  obtener: (id: number): Promise<ProductoConLotes> => api.get(`/productos/${id}`),
  editar: (
    id: number,
    cambios: Partial<{
      nombre: string
      categoriaId: number
      precioBase: number
      stockMinimo: number | null
    }>
  ): Promise<Producto> => api.patch(`/productos/${id}`, cambios)
}
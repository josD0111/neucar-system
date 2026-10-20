// src/renderer/src/api/productos.ts
import { api } from './client'
import type { ListadoPaginado, Producto, ProductoConLotes } from './types'

export interface FiltrosProductos {
  categoriaId?: number
  q?: string
  soloConStock?: boolean
  // Filtro combinable con los demás (corrección 20/10/2026: antes "stock
  // bajo" vivía solo en GET /productos/stock-bajo, un endpoint aparte sin
  // el resto de los filtros — ver routes/productos.ts).
  soloStockBajo?: boolean
  // Paginación procesada en el backend (ver routes/productos.ts). `pagina`
  // es 1-based; si se omiten, el backend aplica sus propios valores por
  // defecto (página 1, 20 por página).
  pagina?: number
  porPagina?: number
}

function queryString(filtros: FiltrosProductos): string {
  const params = new URLSearchParams()
  if (filtros.categoriaId) params.set('categoriaId', String(filtros.categoriaId))
  if (filtros.q) params.set('q', filtros.q)
  if (filtros.soloConStock) params.set('soloConStock', 'true')
  if (filtros.soloStockBajo) params.set('soloStockBajo', 'true')
  if (filtros.pagina) params.set('pagina', String(filtros.pagina))
  if (filtros.porPagina) params.set('porPagina', String(filtros.porPagina))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const productosApi = {
  listar: (filtros: FiltrosProductos = {}): Promise<ListadoPaginado<Producto>> =>
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
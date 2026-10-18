// src/renderer/src/api/categorias.ts
import { api } from './client'
import type { Categoria } from './types'

export const categoriasApi = {
  listar: (): Promise<Categoria[]> => api.get('/categorias'),
  crear: (nombre: string): Promise<Categoria> => api.post('/categorias', { nombre }),
  editar: (id: number, nombre: string): Promise<Categoria> =>
    api.patch(`/categorias/${id}`, { nombre }),
  eliminar: (id: number): Promise<{ id: number }> => api.delete(`/categorias/${id}`)
}
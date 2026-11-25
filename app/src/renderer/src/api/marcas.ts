// src/renderer/src/api/marcas.ts
import { apiFetch, type ApiFail, type ApiOk } from './client'
import type { Marca } from './types'

type Resp<T> = Promise<ApiOk<T> | ApiFail>

// Las marcas exigen sesión, por eso usan apiFetch (con token) y no `api`.
export const marcasApi = {
  listar: (token: string): Resp<Marca[]> => apiFetch<Marca[]>('/api/marcas', { token }),
  crear: (token: string, nombre: string): Resp<Marca> =>
    apiFetch<Marca>('/api/marcas', { method: 'POST', body: { nombre }, token }),
  editar: (token: string, id: number, nombre: string): Resp<Marca> =>
    apiFetch<Marca>(`/api/marcas/${id}`, { method: 'PATCH', body: { nombre }, token }),
  eliminar: (token: string, id: number): Resp<{ id: number }> =>
    apiFetch<{ id: number }>(`/api/marcas/${id}`, { method: 'DELETE', token })
}
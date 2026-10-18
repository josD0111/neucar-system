// src/renderer/src/api/compras.ts
import { api } from './client'
import type { Compra, CompraInput } from './types'

export const comprasApi = {
  registrar: (input: CompraInput): Promise<Compra> => api.post('/compras', input)
}
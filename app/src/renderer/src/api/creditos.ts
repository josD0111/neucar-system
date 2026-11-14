// src/renderer/src/api/creditos.ts
//
// Cliente del módulo de Saldo de Cliente y Créditos Vencidos (ver
// src/main/api/routes/clientes.ts, rutas /:id/saldo, /:id/saldo-pdf y
// /creditos-vencidos — HU-10.2, HU-11, HU-12).

import { abrirPdfAutenticado, apiFetch } from './client'
import type { CreditoVencido, SaldoCliente } from './types'

export const creditosApi = {
  // Saldo pendiente y detalle de deudas de un cliente (HU-11).
  saldoCliente: (token: string | null, clienteId: number) =>
    apiFetch<SaldoCliente>(`/api/clientes/${clienteId}/saldo`, { token }),

  // Listado global de créditos vencidos (HU-10.2).
  creditosVencidos: (token: string | null) =>
    apiFetch<CreditoVencido[]>('/api/clientes/creditos-vencidos', { token }),

  // Abre el comprobante de saldo en PDF con el lector del sistema (HU-12).
  // El nombre de archivo se arma acá porque coincide con el que ya usa el
  // servidor en el header Content-Disposition (ver routes/clientes.ts).
  abrirComprobanteSaldo: (token: string | null, clienteId: number) =>
    abrirPdfAutenticado(
      `/api/clientes/${clienteId}/saldo-pdf`,
      token,
      `saldo-cliente-${clienteId}.pdf`
    )
}

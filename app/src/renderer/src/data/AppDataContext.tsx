// src/renderer/src/data/AppDataContext.tsx
//
// Estado compartido del prototipo (en memoria, sin backend real — se pierde
// al recargar). Centraliza productos, lotes de compra, clientes y deudas,
// para que las acciones de una pantalla (ej. registrar una venta) se
// reflejen en las demás (ej. el stock baja, aparece una deuda nueva).
//
// En Sprint 1, este archivo se reemplaza por llamadas reales a la base de
// datos (Drizzle + PGlite) a través del proceso principal de Electron.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export interface Producto {
  id: number
  nombre: string
  categoria: string
  precioBase: number
  stockMinimo: number
}

export interface Compra {
  id: number
  productoId: number
  proveedorNombre: string
  fecha: string
  cantidad: number
  cantidadDisponible: number
  precioCompra: number
  garantiaProveedorMeses: number | null
}

export interface Cliente {
  id: number
  nombre: string
  cedula: string
  celular: string
}

export interface DeudaItem {
  id: number
  clienteId: number
  origen: 'Ítem de Venta' | 'Orden de Servicio'
  descripcion: string
  fecha: string
  montoOriginal: number
  saldoPendiente: number
}

interface LineaVentaInput {
  productoId: number
  compraId: number
  cantidad: number
  precioUnitario: number
  tipoPago: 'Contado' | 'Crédito'
}

interface LineaServicioInput {
  tipoServicio: string
  monto: number
}

interface AppData {
  productos: Producto[]
  compras: Compra[]
  clientes: Cliente[]
  deudas: DeudaItem[]

  stockDeProducto: (productoId: number) => number
  lotesDeProducto: (productoId: number) => Compra[]
  deudaDeCliente: (clienteId: number) => DeudaItem[]

  registrarVenta: (clienteId: number | null, lineas: LineaVentaInput[]) => void
  registrarOrdenServicio: (
    clienteId: number | null,
    servicios: LineaServicioInput[],
    tipoPago: 'Contado' | 'Crédito',
    garantiaDias: number | null
  ) => void
  registrarPago: (deudaId: number, monto: number) => void
  registrarCompra: (
    productoId: number,
    proveedorNombre: string,
    fecha: string,
    cantidad: number,
    precioCompra: number,
    garantiaProveedorMeses: number | null
  ) => void
}

const AppDataContext = createContext<AppData | null>(null)

const productosIniciales: Producto[] = [
  { id: 1, nombre: 'Batería 12V 60Ah', categoria: 'Baterías', precioBase: 420000, stockMinimo: 3 },
  { id: 2, nombre: 'Filtro de aceite', categoria: 'Filtros', precioBase: 45000, stockMinimo: 5 },
  { id: 3, nombre: 'Aceite 20W-50 (litro)', categoria: 'Lubricantes', precioBase: 38000, stockMinimo: 10 }
]

const comprasIniciales: Compra[] = [
  {
    id: 101,
    productoId: 1,
    proveedorNombre: 'Distribuidora Acumsa',
    fecha: '2026-07-10',
    cantidad: 3,
    cantidadDisponible: 2,
    precioCompra: 310000,
    garantiaProveedorMeses: 18
  },
  {
    id: 102,
    productoId: 1,
    proveedorNombre: 'Baterías del Este SRL',
    fecha: '2026-08-20',
    cantidad: 3,
    cantidadDisponible: 3,
    precioCompra: 295000,
    garantiaProveedorMeses: 12
  },
  {
    id: 103,
    productoId: 2,
    proveedorNombre: 'Repuestos Central',
    fecha: '2026-08-01',
    cantidad: 20,
    cantidadDisponible: 20,
    precioCompra: 28000,
    garantiaProveedorMeses: null
  },
  {
    id: 104,
    productoId: 3,
    proveedorNombre: 'Repuestos Central',
    fecha: '2026-08-01',
    cantidad: 30,
    cantidadDisponible: 30,
    precioCompra: 24000,
    garantiaProveedorMeses: null
  }
]

const clientesIniciales: Cliente[] = [
  { id: 1, nombre: 'Rodrigo Benítez', cedula: '4.123.456', celular: '0981 234 567' },
  { id: 2, nombre: 'Laura Cáceres', cedula: '3.987.654', celular: '0971 555 222' }
]

const deudasIniciales: DeudaItem[] = [
  {
    id: 1,
    clienteId: 1,
    origen: 'Ítem de Venta',
    descripcion: 'Filtro de aceite (x2)',
    fecha: '2026-08-15',
    montoOriginal: 90000,
    saldoPendiente: 30000
  },
  {
    id: 2,
    clienteId: 1,
    origen: 'Orden de Servicio',
    descripcion: 'Alineación + balanceo',
    fecha: '2026-08-28',
    montoOriginal: 120000,
    saldoPendiente: 120000
  }
]

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [productos] = useState<Producto[]>(productosIniciales)
  const [compras, setCompras] = useState<Compra[]>(comprasIniciales)
  const [clientes] = useState<Cliente[]>(clientesIniciales)
  const [deudas, setDeudas] = useState<DeudaItem[]>(deudasIniciales)

  const stockDeProducto = (productoId: number) =>
    compras.filter((c) => c.productoId === productoId).reduce((acc, c) => acc + c.cantidadDisponible, 0)

  const lotesDeProducto = (productoId: number) =>
    compras.filter((c) => c.productoId === productoId && c.cantidadDisponible > 0)

  const deudaDeCliente = (clienteId: number) => deudas.filter((d) => d.clienteId === clienteId)

  const registrarVenta = (clienteId: number | null, lineas: LineaVentaInput[]) => {
    setCompras((prev) =>
      prev.map((c) => {
        const consumo = lineas
          .filter((l) => l.compraId === c.id)
          .reduce((acc, l) => acc + l.cantidad, 0)
        return consumo > 0 ? { ...c, cantidadDisponible: Math.max(0, c.cantidadDisponible - consumo) } : c
      })
    )

    const nuevasDeudas: DeudaItem[] = lineas
      .filter((l) => l.tipoPago === 'Crédito' && clienteId !== null)
      .map((l, i) => {
        const producto = productos.find((p) => p.id === l.productoId)
        const monto = l.precioUnitario * l.cantidad
        return {
          id: Date.now() + i,
          clienteId: clienteId as number,
          origen: 'Ítem de Venta',
          descripcion: `${producto?.nombre ?? 'Producto'} (x${l.cantidad})`,
          fecha: hoy(),
          montoOriginal: monto,
          saldoPendiente: monto
        }
      })

    if (nuevasDeudas.length > 0) {
      setDeudas((prev) => [...prev, ...nuevasDeudas])
    }
  }

  const registrarOrdenServicio = (
    clienteId: number | null,
    servicios: LineaServicioInput[],
    tipoPago: 'Contado' | 'Crédito',
    _garantiaDias: number | null
  ) => {
    if (tipoPago === 'Crédito' && clienteId !== null) {
      const monto = servicios.reduce((acc, s) => acc + s.monto, 0)
      const descripcion = servicios.map((s) => s.tipoServicio).join(' + ')
      setDeudas((prev) => [
        ...prev,
        {
          id: Date.now(),
          clienteId,
          origen: 'Orden de Servicio',
          descripcion,
          fecha: hoy(),
          montoOriginal: monto,
          saldoPendiente: monto
        }
      ])
    }
  }

  const registrarPago = (deudaId: number, monto: number) => {
    setDeudas((prev) =>
      prev
        .map((d) => (d.id === deudaId ? { ...d, saldoPendiente: Math.max(0, d.saldoPendiente - monto) } : d))
        .filter((d) => d.saldoPendiente > 0)
    )
  }

  const registrarCompra = (
    productoId: number,
    proveedorNombre: string,
    fecha: string,
    cantidad: number,
    precioCompra: number,
    garantiaProveedorMeses: number | null
  ) => {
    setCompras((prev) => [
      ...prev,
      {
        id: Date.now(),
        productoId,
        proveedorNombre,
        fecha,
        cantidad,
        cantidadDisponible: cantidad,
        precioCompra,
        garantiaProveedorMeses
      }
    ])
  }

  const value = useMemo<AppData>(
    () => ({
      productos,
      compras,
      clientes,
      deudas,
      stockDeProducto,
      lotesDeProducto,
      deudaDeCliente,
      registrarVenta,
      registrarOrdenServicio,
      registrarPago,
      registrarCompra
    }),
    [productos, compras, clientes, deudas]
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de <AppDataProvider>')
  return ctx
}
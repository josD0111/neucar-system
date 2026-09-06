// src/renderer/src/data/mockData.ts
//
// Datos de ejemplo para el prototipo clickeable (sin backend real).
// Los nombres de campos siguen la convención de docs/02-desing/entidades-dominio.md
// y src/main/db/schema.ts, para que trasladar esto a datos reales en Sprint 1
// sea lo más directo posible.

export interface Producto {
  id: number
  nombre: string
  categoria: string
  precioBase: number
  stock: number
}

export interface Compra {
  id: number
  productoId: number
  proveedorNombre: string
  fecha: string
  cantidadDisponible: number
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
  origen: 'Ítem de Venta' | 'Orden de Servicio'
  descripcion: string
  fecha: string
  montoOriginal: number
  saldoPendiente: number
}

export const productos: Producto[] = [
  { id: 1, nombre: 'Batería 12V 60Ah', categoria: 'Baterías', precioBase: 420000, stock: 5 },
  { id: 2, nombre: 'Filtro de aceite', categoria: 'Filtros', precioBase: 45000, stock: 20 },
  { id: 3, nombre: 'Aceite 20W-50 (litro)', categoria: 'Lubricantes', precioBase: 38000, stock: 30 }
]

// Caso de validación de entidades-dominio.md, sección 14: el mismo producto
// (Batería 12V) tiene dos lotes de compra con garantías distintas de proveedor.
export const compras: Compra[] = [
  {
    id: 101,
    productoId: 1,
    proveedorNombre: 'Distribuidora Acumsa',
    fecha: '2026-07-10',
    cantidadDisponible: 2,
    garantiaProveedorMeses: 18
  },
  {
    id: 102,
    productoId: 1,
    proveedorNombre: 'Baterías del Este SRL',
    fecha: '2026-08-20',
    cantidadDisponible: 3,
    garantiaProveedorMeses: 12
  },
  {
    id: 103,
    productoId: 2,
    proveedorNombre: 'Repuestos Central',
    fecha: '2026-08-01',
    cantidadDisponible: 20,
    garantiaProveedorMeses: null
  },
  {
    id: 104,
    productoId: 3,
    proveedorNombre: 'Repuestos Central',
    fecha: '2026-08-01',
    cantidadDisponible: 30,
    garantiaProveedorMeses: null
  }
]

export const clientes: Cliente[] = [
  { id: 1, nombre: 'Rodrigo Benítez', cedula: '4.123.456', celular: '0981 234 567' },
  { id: 2, nombre: 'Laura Cáceres', cedula: '3.987.654', celular: '0971 555 222' }
]

// Ficha de deuda de ejemplo para Rodrigo Benítez — caso de HU-11 / sección 12
// de entidades-dominio.md: dos ítems a crédito de la misma venta, uno ya
// saldado (no aparece acá) y otro con saldo pendiente.
export const deudaPorCliente: Record<number, DeudaItem[]> = {
  1: [
    {
      id: 1,
      origen: 'Ítem de Venta',
      descripcion: 'Filtro de aceite (x2)',
      fecha: '2026-08-15',
      montoOriginal: 90000,
      saldoPendiente: 30000
    },
    {
      id: 2,
      origen: 'Orden de Servicio',
      descripcion: 'Alineación + balanceo',
      fecha: '2026-08-28',
      montoOriginal: 120000,
      saldoPendiente: 120000
    }
  ],
  2: []
}

// src/renderer/src/api/types.ts
//
// Tipos del lado del renderer, en correspondencia con src/main/db/schema.ts.
// Nota: drizzle-orm devuelve las columnas `numeric` como string (no number),
// para no perder precisión — por eso precioBase/precioCompra son `string`
// acá y se convierten con Number(...) solo al mostrarlos o calcular con ellos.

export interface Categoria {
  id: number
  nombre: string
}

export interface Proveedor {
  id: number
  nombre: string
  contacto: string | null
}

export interface Producto {
  id: number
  nombre: string
  categoriaId: number
  precioBase: string
  stock: number
  stockMinimo: number | null
}

export interface Compra {
  id: number
  productoId: number
  proveedorId: number
  fecha: string
  cantidad: number
  cantidadDisponible: number
  precioCompra: string
  garantiaProveedor: number | null
  factura: string | null
}

export interface ProductoConLotes extends Producto {
  lotes: Compra[]
}

export interface ProductoNuevoInput {
  nombre: string
  categoriaId: number
  precioBase: number
  stockMinimo: number | null
}

export interface CompraInput {
  productoId?: number
  productoNuevo?: ProductoNuevoInput
  proveedorId: number
  fecha: string
  cantidad: number
  precioCompra: number
  garantiaProveedor?: number | null
  factura?: string | null
}
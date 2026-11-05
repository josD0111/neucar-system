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

// Respuesta paginada genérica (ver GET /api/productos, paginación procesada
// en el backend — pedido 20/10/2026). `pagina` es 1-based.
export interface ListadoPaginado<T> {
  items: T[]
  total: number
  pagina: number
  porPagina: number
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

// --- Ventas (Sprint 2, HU-17 a HU-21) ---
// Igual que arriba, precioBase/precioUnitario/montoTotal llegan como string
// desde la API (columnas `numeric` de Drizzle) — ver nota al principio del archivo.

export type TipoPago = 'Contado' | 'Crédito'

export interface ItemVenta {
  id: number
  ventaId: number
  productoId: number
  compraId: number
  cantidad: number
  precioBase: string
  precioUnitario: string
  garantiaOfrecida: number | null
  tipoPago: TipoPago
  fechaPagoPrevista: string | null
}

export interface Venta {
  id: number
  clienteId: number | null
  usuarioId: number
  fecha: string
  montoTotal: string
  tipoComprobante: string | null
  metodoPago: string
}

export interface VentaConItems extends Venta {
  items: ItemVenta[]
}

// Fila de GET /api/ventas (ver services/ventas.ts, VentaListado): trae el
// nombre del cliente ya resuelto (null = cliente casual o cliente dado de
// baja) y la cantidad de ítems, para no pedir el detalle completo de cada
// venta solo para listarlas.
export interface VentaListado extends Venta {
  clienteNombre: string | null
  cantidadItems: number
  tieneSaldoPendiente: boolean
}

// Filtros de GET /api/ventas — ver services/ventas.ts, FiltrosListarVentas.
// `fechaDesde`/`fechaHasta` son 'YYYY-MM-DD' locales, como un
// <input type="date">.
export interface FiltrosVentas {
  clienteId?: number
  q?: string
  metodoPago?: string
  fechaDesde?: string
  fechaHasta?: string
  soloConSaldoPendiente?: boolean
  antesDe?: string
  dias?: number
}

// Respuesta de GET /api/ventas — ver services/ventas.ts, PaginaVentas. Una
// "página" son N días calendario completos, no una cantidad fija de filas.
export interface PaginaVentas {
  items: VentaListado[]
  hayMas: boolean
  antesDe: string | null
}

// Ítem con su nombre de producto y saldo pendiente ya calculados (ver
// services/ventas.ts, ItemVentaDetalle).
export interface ItemVentaDetalle extends ItemVenta {
  productoNombre: string
  saldoPendiente: number
}

// GET /api/ventas/:id (ver services/ventas.ts, VentaDetalle).
export interface VentaDetalle extends Venta {
  clienteNombre: string | null
  usuarioNombre: string
  items: ItemVentaDetalle[]
}

// Lo que manda el cliente al registrar (ver services/ventas.ts, ItemVentaInput/VentaInput).
export interface ItemVentaInput {
  productoId: number
  compraId: number
  cantidad: number
  // Si se omite, el servidor usa el precioBase vigente del producto.
  precioUnitario?: number
  garantiaOfrecida?: number | null
  tipoPago: TipoPago
  // Solo tiene sentido si tipoPago = 'Crédito'. Si se omite, el servidor
  // sugiere "hoy + 1 mes" (HU-10.2).
  fechaPagoPrevista?: string | null
}

export interface VentaInput {
  clienteId?: number | null
  metodoPago: string
  tipoComprobante?: string | null
  items: ItemVentaInput[]
}

// --- Pagos (módulo de Crédito/Pagos, sobre Ítems de Venta — HU-10.1) ---
// Ver services/pagos.ts. Los pagos sobre Órdenes de Servicio (Fase 5 del
// reparto) se agregan más adelante; estos tipos son solo de Ítem de Venta.

export interface Pago {
  id: number
  itemVentaId: number | null
  ordenServicioId: number | null
  monto: string
  fecha: string
  metodoPago: string
}

export interface PagoInput {
  monto: number
  metodoPago: string
  // Nueva fecha prevista para la próxima cuota (si queda saldo). Si se
  // omite, el servidor no la toca.
  fechaPagoPrevista?: string | null
}

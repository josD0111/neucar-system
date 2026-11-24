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
}

export interface Venta {
  id: number
  clienteId: number | null
  usuarioId: number
  fecha: string
  montoTotal: string
  tipoComprobante: string | null
  metodoPago: string
  // tipoPago/fechaPagoPrevista viven acá (a nivel de toda la Venta) desde el
  // 22/11/2026 — antes vivían en ItemVenta. Ver entidades-dominio.md, sección 12.
  tipoPago: TipoPago
  fechaPagoPrevista: string | null
}

// Un producto vendido que, después de esta Venta, quedó con
// stock <= stockMinimo (HU-08). Ver services/ventas.ts, ProductoStockBajo.
export interface ProductoStockBajo {
  productoId: number
  nombre: string
  stock: number
  stockMinimo: number
}

export interface VentaConItems extends Venta {
  items: ItemVenta[]
  productosStockBajo: ProductoStockBajo[]
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

// Ítem con su nombre de producto ya resuelto (ver services/ventas.ts,
// ItemVentaDetalle). El saldo pendiente ya NO es por ítem desde el
// 22/11/2026: ver VentaDetalle.saldoPendiente más abajo.
export interface ItemVentaDetalle extends ItemVenta {
  productoNombre: string
}

// GET /api/ventas/:id (ver services/ventas.ts, VentaDetalle).
export interface VentaDetalle extends Venta {
  clienteNombre: string | null
  usuarioNombre: string
  items: ItemVentaDetalle[]
  // Saldo pendiente de toda la Venta (cambio de alcance 22/11/2026, antes
  // era por ítem — ver entidades-dominio.md, sección 12).
  saldoPendiente: number
}

// Lo que manda el cliente al registrar (ver services/ventas.ts, ItemVentaInput/VentaInput).
export interface ItemVentaInput {
  productoId: number
  compraId: number
  cantidad: number
  // Si se omite, el servidor usa el precioBase vigente del producto.
  precioUnitario?: number
  garantiaOfrecida?: number | null
}

// Pago inicial obligatorio de una venta a crédito (HU-39). `metodoPago` es
// opcional: si se omite, el servidor usa el mismo método de pago de la
// Venta (ver services/ventas.ts, PagoInicialInput).
export interface PagoInicialInput {
  monto: number
  metodoPago?: string
}

export interface VentaInput {
  clienteId?: number | null
  metodoPago: string
  tipoComprobante?: string | null
  // tipoPago/fechaPagoPrevista viven a nivel de toda la Venta desde el
  // 22/11/2026 (antes eran por ítem) — ver entidades-dominio.md, sección 12.
  tipoPago: TipoPago
  // Solo tiene sentido si tipoPago = 'Crédito'. Si se omite, el servidor
  // sugiere "hoy + 1 mes" (HU-10.2).
  fechaPagoPrevista?: string | null
  // Obligatorio si tipoPago = 'Crédito' (HU-39, Sprint 3 punto 1): el
  // servidor rechaza la venta si falta o si monto <= 0. Se ignora si
  // tipoPago = 'Contado'.
  pagoInicial?: PagoInicialInput | null
  items: ItemVentaInput[]
}

// --- Pagos (módulo de Crédito/Pagos — HU-10.1) ---
// Ver services/pagos.ts. `Pago`/`PagoInput` son comunes a los pagos sobre
// Ítems de Venta y sobre Órdenes de Servicio (Fase 5, agregada el
// 15/11/2026): un Pago siempre tiene uno de los dos ids (nunca ambos),
// según el endpoint usado para registrarlo (ver api/pagos.ts).

export interface Pago {
  id: number
  // Modificado 22/11/2026: antes era `itemVentaId` — ver entidades-dominio.md,
  // sección 12.
  ventaId: number | null
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
// --- Vehículos y Órdenes de Servicio (Sprint 2, HU-22 a HU-27, sin HU-25) ---
// Igual que arriba, los montos (`monto`, `montoTotal`) llegan como string
// desde la API (columnas `numeric` de Drizzle), y las fechas llegan como
// texto ISO (JSON no tiene tipo Date).

// Vehículo con el nombre del dueño ya resuelto (ver services/vehiculos.ts).
// clienteId / clienteNombre = null: vehículo de cliente casual.
export interface Vehiculo {
  id: number
  clienteId: number | null
  marca: string | null
  chapa: string | null
  color: string | null
  clienteNombre: string | null
}

// Lo que se envía al crear o editar un vehículo. Hace falta al menos la
// marca o la chapa (lo valida el servidor). La chapa se normaliza allá.
export interface VehiculoInput {
  clienteId?: number | null
  marca?: string | null
  chapa?: string | null
  color?: string | null
}

export interface FiltrosVehiculos {
  clienteId?: number
  q?: string
}

export interface ServicioDetalle {
  id: number
  ordenId: number
  // null en las órdenes anteriores al catálogo de tipos de servicio.
  tipoServicioId: number | null
  tipoServicio: string
  cantidadRuedas: number | null
  // Precio de referencia de ese momento (ya multiplicado por las ruedas).
  montoBase: string | null
  monto: string
  detalle: string | null
}

// Orden con cliente, vehículo y usuario ya resueltos (ver
// services/ordenesServicio.ts, OrdenServicio). clienteId / clienteNombre =
// null: orden de cliente casual (solo posible si la orden es al contado).
export interface OrdenServicio {
  id: number
  fecha: string
  clienteId: number | null
  clienteNombre: string | null
  vehiculoId: number
  vehiculoMarca: string | null
  vehiculoChapa: string | null
  vehiculoColor: string | null
  usuarioId: number
  usuarioNombre: string
  tipoPago: TipoPago
  montoTotal: string
  fechaPagoPrevista: string | null
  tipoComprobante: string | null
  servicios: ServicioDetalle[]
}

// Un servicio al registrar una orden. Si se omite `monto`, el servidor usa el
// precio de referencia del tipo. Solo el Administrador puede enviar un monto
// distinto al de referencia.
export interface ServicioInput {
  tipoServicioId: number
  // Obligatoria si el tipo requiere ruedas; se ignora si no.
  cantidadRuedas?: number | null
  monto?: number | null
  detalle?: string | null
}
// Tipo de servicio del catálogo. montoBase llega como string (columna numeric);
// null = sin precio fijo. Si requiereRuedas, el monto es POR RUEDA.
export interface TipoServicio {
  id: number
  nombre: string
  montoBase: string | null
  requiereRuedas: boolean
  activo: boolean
}

export interface TipoServicioInput {
  nombre: string
  montoBase?: number | null
  requiereRuedas?: boolean
  activo?: boolean
}
// Lo que se envía al registrar una orden. El monto total NO se manda: lo
// calcula el servidor como la suma de los servicios.
export interface OrdenServicioInput {
  // Opcional: si se omite, el servidor usa el dueño del vehículo (si tiene).
  // Una orden a Crédito exige cliente (HU-27).
  clienteId?: number | null
  vehiculoId: number
  tipoPago: TipoPago
  // Solo se conserva si tipoPago = 'Crédito'.
  fechaPagoPrevista?: string | null
  tipoComprobante?: string | null
  servicios: ServicioInput[]
}

// Filtros de GET /api/ordenes-servicio (HU-26).
export interface FiltrosOrdenesServicio {
  clienteId?: number
  vehiculoId?: number
  limite?: number
}
// Una orden del historial paginado, con su saldo pendiente ya calculado por el
// servidor (siempre 0 si es al contado). Ver services/ordenesServicio.ts.
export interface OrdenListado extends OrdenServicio {
  saldoPendiente: number
}

// Filtros de GET /api/ordenes-servicio/historial. Las fechas son 'AAAA-MM-DD'
// locales, como las de un <input type="date">.
export interface FiltrosHistorialOrdenes {
  clienteId?: number
  vehiculoId?: number
  tipoPago?: string
  fechaDesde?: string
  fechaHasta?: string
  soloConSaldoPendiente?: boolean
  antesDe?: string
  dias?: number
}

// Respuesta del historial: una PÁGINA de días calendario completos. Para la
// siguiente página, pasar el `antesDe` que devolvió esta.
export interface PaginaOrdenes {
  items: OrdenListado[]
  hayMas: boolean
  antesDe: string | null
}
// Cliente tal como lo devuelve GET /api/clientes (ver services/clientes.ts).
export interface Cliente {
  id: number
  nombre: string
  cedula: string | null
  celular: string | null
  ruc: string | null
  activo: boolean
}


// --- Saldo de cliente y créditos vencidos (HU-10.2, HU-11, HU-12) ---
// Ver src/main/services/saldoClientes.ts.

// Cambio de alcance 22/11/2026: la deuda ya es por Venta completa, no por
// Ítem de Venta — `productos` lista los nombres de los productos incluidos,
// para no perder el detalle que antes daba el desglose por ítem.
export interface DeudaItemVenta {
  tipo: 'venta'
  ventaId: number
  productos: string[]
  fecha: string
  montoTotal: number
  saldoPendiente: number
  fechaPagoPrevista: string | null
}

export interface DeudaOrdenServicio {
  tipo: 'orden'
  ordenServicioId: number
  fecha: string
  montoTotal: number
  saldoPendiente: number
  fechaPagoPrevista: string | null
}

export type DeudaPendiente = DeudaItemVenta | DeudaOrdenServicio

// GET /api/clientes/:id/saldo
export interface SaldoCliente {
  clienteId: number
  clienteNombre: string
  saldoTotal: number
  deudas: DeudaPendiente[]
}

// Una fila de GET /api/clientes/creditos-vencidos.
export interface CreditoVencido {
  tipo: 'venta' | 'orden'
  id: number // ventaId u ordenServicioId según `tipo` (ventaId desde 22/11/2026)
  clienteId: number
  clienteNombre: string
  fechaPagoPrevista: string
  saldoPendiente: number
  diasVencido: number
}

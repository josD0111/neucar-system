// src/main/db/schema.ts (dentro de la carpeta app/ del repo)
//
// Esquema inicial de base de datos, en correspondencia directa con
// docs/02-desing/diagrama-entidad-relacion.md y docs/02-desing/entidades-dominio.md.
//
// Punto de partida para Sprint 0 / Sprint 0.5 — puede ajustarse durante el
// prototipo. Actualizado tras la reunión con el dueño del 10/09/2026 (ver
// docs/01-analisis/entrevistas/entrevista--2026-09-10.md): se quitó
// `garantiaDias` de ordenesServicio, se agregó `detalle` en servicios y
// `fechaPagoPrevista` en itemsVenta/ordenesServicio.

import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  date,
  boolean,
  timestamp,
  type AnyPgColumn
} from 'drizzle-orm/pg-core'

// 1. Usuario
export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  usuarioLogin: varchar('usuario_login', { length: 50 }).notNull().unique(),
  contrasena: varchar('contrasena', { length: 255 }).notNull(),
  rol: varchar('rol', { length: 20 }).notNull() // 'Administrador' | 'Empleado'
})

// 2. Cliente
export const clientes = pgTable('clientes', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(),
  cedula: varchar('cedula', { length: 30 }),
  celular: varchar('celular', { length: 30 }),
  ruc: varchar('ruc', { length: 30 }),
  // false = cliente deshabilitado: no aparece en los listados normales, pero
  // conserva su historial (ventas, órdenes, pagos). Nunca se borra.
  activo: boolean('activo').notNull().default(true)
})

// 3. Proveedor
export const proveedores = pgTable('proveedores', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(),
  contacto: varchar('contacto', { length: 100 })
})

// 4. Categoría
export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull()
})

// 5. Producto
// Nota: "stock" se mantiene como columna, pero conceptualmente es la suma de
// compras.cantidad_disponible (ver entidades-dominio.md, secciones 5 y 14).
// La lógica de negocio debe mantenerlo sincronizado en cada operación.
export const productos = pgTable('productos', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(),
  categoriaId: integer('categoria_id')
    .notNull()
    .references(() => categorias.id),
  precioBase: numeric('precio_base', { precision: 12, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
  stockMinimo: integer('stock_minimo') // umbral opcional para notificación de stock bajo (HU-08, MVP)
})

// 6. Compra (funciona como lote de stock — ver entidades-dominio.md, sección 14)
export const compras = pgTable('compras', {
  id: serial('id').primaryKey(),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  proveedorId: integer('proveedor_id')
    .notNull()
    .references(() => proveedores.id),
  fecha: date('fecha').notNull(),
  cantidad: integer('cantidad').notNull(),
  cantidadDisponible: integer('cantidad_disponible').notNull(),
  precioCompra: numeric('precio_compra', { precision: 12, scale: 2 }).notNull(),
  garantiaProveedor: integer('garantia_proveedor'), // en días o meses, a definir
  factura: varchar('factura', { length: 100 })
})

// 7. Venta
export const ventas = pgTable('ventas', {
  id: serial('id').primaryKey(),
  clienteId: integer('cliente_id').references(() => clientes.id), // opcional (cliente casual)
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  // `withTimezone: true` (bug encontrado 01/11/2026): sin esto, Drizzle crea
  // una columna `timestamp without time zone`. `defaultNow()` sigue
  // guardando la hora correcta en el instante de la escritura, pero al
  // perderse el huso horario con el que se guardó, la lectura posterior
  // queda ambigua según cómo la interprete cada capa (driver de PGlite,
  // Node, el navegador) — en la práctica se traducía en una hora mostrada
  // desfasada 3 horas respecto a la real (el huso de Paraguay, UTC-3). Con
  // `timestamptz` Postgres guarda siempre el instante absoluto en UTC,
  // así que no hay ambigüedad posible en ningún punto de la cadena.
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  montoTotal: numeric('monto_total', { precision: 12, scale: 2 }).notNull(),
  tipoComprobante: varchar('tipo_comprobante', { length: 30 }), // 'Factura común' | 'Factura electrónica'
  // Columna agregada en Sprint 2 (24/10/2026), no estaba en el esquema original:
  // HU-19 pide registrar el método de pago de la venta (efectivo, tarjeta,
  // transferencia, QR) y no había dónde guardarlo. Vive a nivel de Venta (no
  // por ítem) porque así lo redacta la HU. Para un ítem a crédito, este valor
  // es el método "de referencia" al momento de la operación; el método real
  // de cada cuota se registra en Pago.metodoPago al momento de cobrarla.
  metodoPago: varchar('metodo_pago', { length: 30 }).notNull() // 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'QR'
})

// 7.1 Ítem de Venta
export const itemsVenta = pgTable('items_venta', {
  id: serial('id').primaryKey(),
  ventaId: integer('venta_id')
    .notNull()
    .references(() => ventas.id),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  compraId: integer('compra_id')
    .notNull()
    .references(() => compras.id), // obligatorio — ver entidades-dominio.md, sección 14
  cantidad: integer('cantidad').notNull(),
  // Columna agregada en Sprint 2 (24/10/2026), no estaba en el esquema
  // original: HU-18 exige conservar "tanto el precio base como el precio
  // final aplicado" para trazabilidad, pero solo existía precioUnitario
  // (el final). Se guarda el precioBase del Producto vigente al momento de
  // la venta (snapshot), ya que productos.precioBase puede editarse después
  // y el dueño no pidió un histórico de cambios de precio (ver
  // desiciones-alcance.md, sección 7.1) — sin este snapshot, la
  // trazabilidad de HU-18 se perdería en cuanto alguien edite el producto.
  precioBase: numeric('precio_base', { precision: 12, scale: 2 }).notNull(),
  precioUnitario: numeric('precio_unitario', { precision: 12, scale: 2 }).notNull(),
  garantiaOfrecida: integer('garantia_ofrecida'),
  tipoPago: varchar('tipo_pago', { length: 20 }).notNull(), // 'Contado' | 'Crédito'
  // Próxima fecha en la que se espera el pago (solo si tipoPago = 'Crédito').
  // Es un valor sugerido y editable, no un vencimiento bloqueante — ver
  // entidades-dominio.md, sección 12.1, y HU-10.2.
  fechaPagoPrevista: date('fecha_pago_prevista')
  // saldoPendiente NO se guarda como columna fija: se calcula en la capa de
  // lógica de negocio a partir de (precioUnitario * cantidad) - suma(pagos).
})

// 7.2 Pago
export const pagos = pgTable('pagos', {
  id: serial('id').primaryKey(),
  itemVentaId: integer('item_venta_id').references(() => itemsVenta.id),
  // Referencia circular a ordenesServicio (definida más abajo): se resuelve
  // con un callback (lazy reference), por lo que no importa el orden de
  // declaración entre ambas tablas. El tipo de retorno explícito (AnyPgColumn)
  // es necesario para evitar un error de TypeScript por inferencia circular,
  // no por una limitación real de Drizzle en tiempo de ejecución.
  ordenServicioId: integer('orden_servicio_id').references((): AnyPgColumn => ordenesServicio.id),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  // Mismo fix que ventas.fecha — ver la nota ahí.
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  metodoPago: varchar('metodo_pago', { length: 30 }).notNull()
})

// 8. Vehículo
export const vehiculos = pgTable('vehiculos', {
  id: serial('id').primaryKey(),
  clienteId: integer('cliente_id').references(() => clientes.id),
  marca: varchar('marca', { length: 80 }),
  chapa: varchar('chapa', { length: 30 }),
  color: varchar('color', { length: 40 })
})

// 9. Orden de Servicio
export const ordenesServicio = pgTable('ordenes_servicio', {
  id: serial('id').primaryKey(),
  vehiculoId: integer('vehiculo_id')
    .notNull()
    .references(() => vehiculos.id),
  clienteId: integer('cliente_id')
    .notNull()
    .references(() => clientes.id),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  // Mismo fix que ventas.fecha — ver la nota ahí.
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  tipoPago: varchar('tipo_pago', { length: 20 }).notNull(), // 'Contado' | 'Crédito', aplica a toda la orden
  montoTotal: numeric('monto_total', { precision: 12, scale: 2 }).notNull(),
  // Próxima fecha en la que se espera el pago (solo si tipoPago = 'Crédito').
  // Mismo criterio que itemsVenta.fechaPagoPrevista — ver entidades-dominio.md,
  // sección 12.1, y HU-10.2.
  fechaPagoPrevista: date('fecha_pago_prevista'),
  tipoComprobante: varchar('tipo_comprobante', { length: 30 })
  // NOTA: se eliminó `garantiaDias` (presente en una versión anterior de este
  // esquema). El dueño confirmó en la entrevista del 10/09/2026 que no es
  // necesario registrar garantía sobre servicios — ver entidades-dominio.md,
  // sección 9, e historia HU-25 (descartada).
})

// 9.1 Servicio (detalle)
export const servicios = pgTable('servicios', {
  id: serial('id').primaryKey(),
  ordenId: integer('orden_id')
    .notNull()
    .references(() => ordenesServicio.id),
  tipoServicio: varchar('tipo_servicio', { length: 100 }).notNull(),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  // Texto libre opcional para la parte afectada (ej. "4 ruedas" en alineación
  // o balanceo). No aplica a todos los tipos de servicio — ver
  // entidades-dominio.md, sección 9.1, e historia HU-22.1.
  detalle: varchar('detalle', { length: 255 })
})

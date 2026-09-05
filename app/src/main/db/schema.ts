// src/main/db/schema.ts (dentro de la carpeta app/ del repo)
//
// Esquema inicial de base de datos, en correspondencia directa con
// docs/02-desing/diagrama-entidad-relacion.md y docs/02-desing/entidades-dominio.md.
//
// Punto de partida para Sprint 0 / Sprint 0.5 — puede ajustarse durante el
// prototipo, en particular tras la reunión con el dueño (ver guion-reunion-dueno.md).

import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

// 1. Usuario
export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  usuarioLogin: varchar("usuario_login", { length: 50 }).notNull().unique(),
  contrasena: varchar("contrasena", { length: 255 }).notNull(),
  rol: varchar("rol", { length: 20 }).notNull(), // 'Administrador' | 'Empleado'
});

// 2. Cliente
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 150 }).notNull(),
  cedula: varchar("cedula", { length: 30 }),
  celular: varchar("celular", { length: 30 }),
  ruc: varchar("ruc", { length: 30 }),
});

// 3. Proveedor
export const proveedores = pgTable("proveedores", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 150 }).notNull(),
  contacto: varchar("contacto", { length: 100 }),
});

// 4. Categoría
export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 80 }).notNull(),
});

// 5. Producto
// Nota: "stock" se mantiene como columna, pero conceptualmente es la suma de
// compras.cantidad_disponible (ver entidades-dominio.md, secciones 5 y 14).
// La lógica de negocio debe mantenerlo sincronizado en cada operación.
export const productos = pgTable("productos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 150 }).notNull(),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => categorias.id),
  precioBase: numeric("precio_base", { precision: 12, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  stockMinimo: integer("stock_minimo"), // post-MVP (HU-08)
});

// 6. Compra (funciona como lote de stock — ver entidades-dominio.md, sección 14)
export const compras = pgTable("compras", {
  id: serial("id").primaryKey(),
  productoId: integer("producto_id")
    .notNull()
    .references(() => productos.id),
  proveedorId: integer("proveedor_id")
    .notNull()
    .references(() => proveedores.id),
  fecha: date("fecha").notNull(),
  cantidad: integer("cantidad").notNull(),
  cantidadDisponible: integer("cantidad_disponible").notNull(),
  precioCompra: numeric("precio_compra", { precision: 12, scale: 2 }).notNull(),
  garantiaProveedor: integer("garantia_proveedor"), // en días o meses, a definir
  factura: varchar("factura", { length: 100 }),
});

// 7. Venta
export const ventas = pgTable("ventas", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id), // opcional (cliente casual)
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  fecha: timestamp("fecha").notNull().defaultNow(),
  montoTotal: numeric("monto_total", { precision: 12, scale: 2 }).notNull(),
  tipoComprobante: varchar("tipo_comprobante", { length: 30 }), // 'Factura común' | 'Factura electrónica'
});

// 7.1 Ítem de Venta
export const itemsVenta = pgTable("items_venta", {
  id: serial("id").primaryKey(),
  ventaId: integer("venta_id")
    .notNull()
    .references(() => ventas.id),
  productoId: integer("producto_id")
    .notNull()
    .references(() => productos.id),
  compraId: integer("compra_id")
    .notNull()
    .references(() => compras.id), // obligatorio — ver entidades-dominio.md, sección 14
  cantidad: integer("cantidad").notNull(),
  precioUnitario: numeric("precio_unitario", { precision: 12, scale: 2 }).notNull(),
  garantiaOfrecida: integer("garantia_ofrecida"),
  tipoPago: varchar("tipo_pago", { length: 20 }).notNull(), // 'Contado' | 'Crédito'
  // saldoPendiente NO se guarda como columna fija: se calcula en la capa de
  // lógica de negocio a partir de (precioUnitario * cantidad) - suma(pagos).
});

// 7.2 Pago
export const pagos = pgTable("pagos", {
  id: serial("id").primaryKey(),
  itemVentaId: integer("item_venta_id").references(() => itemsVenta.id),
  ordenServicioId: integer("orden_servicio_id"), // referencia agregada más abajo, ver ordenesServicio
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  fecha: timestamp("fecha").notNull().defaultNow(),
  metodoPago: varchar("metodo_pago", { length: 30 }).notNull(),
});

// 8. Vehículo
export const vehiculos = pgTable("vehiculos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  marca: varchar("marca", { length: 80 }),
  chapa: varchar("chapa", { length: 30 }),
  color: varchar("color", { length: 40 }),
});

// 9. Orden de Servicio
export const ordenesServicio = pgTable("ordenes_servicio", {
  id: serial("id").primaryKey(),
  vehiculoId: integer("vehiculo_id")
    .notNull()
    .references(() => vehiculos.id),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => clientes.id),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  fecha: timestamp("fecha").notNull().defaultNow(),
  tipoPago: varchar("tipo_pago", { length: 20 }).notNull(), // 'Contado' | 'Crédito', aplica a toda la orden
  montoTotal: numeric("monto_total", { precision: 12, scale: 2 }).notNull(),
  garantiaDias: integer("garantia_dias"), // opcional — no todos los trabajos la incluyen
  tipoComprobante: varchar("tipo_comprobante", { length: 30 }),
});

// 9.1 Servicio (detalle)
export const servicios = pgTable("servicios", {
  id: serial("id").primaryKey(),
  ordenId: integer("orden_id")
    .notNull()
    .references(() => ordenesServicio.id),
  tipoServicio: varchar("tipo_servicio", { length: 100 }).notNull(),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
});

/**
 * NOTA IMPORTANTE sobre `pagos.ordenServicioId`:
 * Drizzle no permite declarar una referencia circular directa entre dos
 * tablas definidas en el mismo archivo sin un paso adicional. Como
 * `pagos` se define antes que `ordenesServicio` en este archivo, la
 * referencia queda como columna simple (sin `.references()` inline) y debe
 * completarse con una relación declarada aparte, o reordenando las
 * definiciones. Antes de correr la primera migración, revisar la
 * documentación de Drizzle sobre relaciones y foreign keys diferidas,
 * y ajustar esta parte del esquema en consecuencia.
 */
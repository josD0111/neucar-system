Plan técnico: pantalla de Ventas

Orden de trabajo, en 4 etapas secuenciales (cada una verificable antes de pasar a la siguiente):

Etapa 1 — Migración de esquema (backend puro, sin UI)
schema.ts: mover tipoPago, fechaPagoPrevista de itemsVenta a ventas; cambiar pagos.itemVentaId → pagos.ventaId.
Escribir el script de migración de datos existentes (ventas ya cargadas con tipoPago por ítem → agregarlo a la venta, usando el tipoPago del primer ítem si todos coinciden, o decidir una regla si hay mezcla real en datos de prueba).
Actualizar services/ventas.ts, services/pagos.ts, services/saldoClientes.ts y las rutas en api/ que referencian estos campos.
Correr lo que haya de tests/smoke manual contra la API sola (sin UI) antes de seguir — acá es donde más fácil se detecta un error de cálculo de saldo.
Etapa 2 — Componentes de la nueva pantalla (de abajo hacia arriba)

Componentes chicos y testeables primero, sin conectarlos aún a la pantalla real:

BuscadorProductos (A1)
PanelClienteCondicion (A2, con el modal +Nuevo cliente)
FormularioItemEdicion (B, con selector de lote)
TablaDetalleVenta (C)
FooterVenta (D)
ModalConfirmarCredito (pago inicial + fecha prevista)
Etapa 3 — Ensamblado en VentaScreen.tsx

Un único componente con estado local (ítems en curso, cliente, condición de pago), condicionado por rol vía props — sin lógica de servidor nueva, solo orquestación de los componentes de la Etapa 2 contra los endpoints ya adaptados en la Etapa 1.

Etapa 4 — Ajustes derivados

Comprobante PDF (HU-21) y cualquier pantalla que lea tipoPago/saldoPendiente de ítems (revisar HistorialServicios/saldo de cliente para confirmar que ya usan el campo a nivel correcto).

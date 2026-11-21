# Backlog — Sprint 3

*Basado en el feedback del dueño al cierre del Sprint 2 (`docs/01-analisis/entrevistas/reunion-sprint02--2026-11-20.md`), trasladado a `desiciones-alcance.md` (sección 9) e `historias-usuario.md` (HU-36 a HU-41, más las adendas a HU-01, HU-10, HU-14/15/16 y HU-17/17.1/18). Redactado el 20/11/2026, al cierre del Sprint 2 y la revisión de consistencia documentación/código que lo acompañó (ver la actualización del 20/11/2026 en `sprint-2-backlog.md`).*

**Nota sobre el estado de este backlog:** a diferencia de `sprint-1-backlog.md` y `sprint-2-backlog.md`, que arrancaban sobre historias de usuario ya cerradas con el dueño, varios puntos de este backlog dependen de reglas de negocio que el dueño no terminó de precisar en la reunión de cierre (ver `desiciones-alcance.md`, sección 7.6). Esos puntos están marcados explícitamente como **bloqueados** más abajo — conviene no empezar a programarlos hasta resolver la pregunta abierta correspondiente, para no repetir el problema que motivó la revisión de documentación del 20/11/2026 (decisiones tomadas "sobre la marcha" sin dejar rastro).

## Objetivo del sprint

Incorporar el feedback de la presentación del Sprint 2 al dueño: un nuevo flujo de carga para Ventas más parecido al sistema que ya usa, separar Compras de Control de Stock, agregar marcas de producto, acotar más el rol Empleado a solo-lectura, mejorar la presentación visual, y dejar encaminado (sin necesariamente cerrar del todo) el pedido de kilometraje/próximo mantenimiento.

## Punto de partida

- El modelo de datos para Marca ya está propuesto en `entidades-dominio.md`, sección 4.1 (entidad propia, igual que Categoría), con `marca_id` opcional en Producto — pendiente de confirmar con el dueño si debería ser obligatorio.
- El catálogo `tiposServicio` (Sprint 2, documentado el 20/11/2026 en `entidades-dominio.md`, sección 9.2) ya resuelve "precio de referencia por tipo de servicio" — si el kilometraje termina necesitando un intervalo de mantenimiento por tipo de servicio, ese catálogo es el lugar natural para agregarlo, en vez de crear una entidad nueva.
- El mecanismo de Pago (`services/pagos.ts`, Sprint 2) ya soporta pagos parciales sobre un ítem/orden a crédito — el "pago inicial obligatorio" (punto 1) no debería necesitar un mecanismo nuevo, solo una validación adicional al registrar la venta/orden.
- Las restricciones de rol Empleado ya existentes (no registra ventas — Sprint 2) se extienden, no se reemplazan — ver punto 5.

## 1. Ventas — nuevo flujo y pago inicial obligatorio (HU-39, HU-40)

- [ ] **Bloqueado parcialmente** (ver `desiciones-alcance.md`, sección 7.6): confirmar con el dueño (o decidir en equipo, dejándolo registrado) si la búsqueda de producto en el nuevo flujo es por nombre, por código, o ambos, antes de construir la pantalla.
- [ ] Rediseñar `VentaScreen.tsx` sobre un patrón de buscador: campo de búsqueda de producto → tabla de ítems de la venta en curso → al seleccionar una fila, editar sus datos (cantidad, lote, precio, forma de pago) en una sección aparte. No cambia ninguna regla de negocio ya implementada (selección manual de lote, bloqueo por stock insuficiente, permisos por rol — HU-17/HU-17.1/HU-18/HU-20), solo el flujo de pantalla.
- [ ] Sección aparte para datos del cliente, visible/activa cuando algún ítem de la venta es a crédito (reemplaza el campo de cliente actual, que no está separado visualmente del resto del formulario).
- [ ] Validar en el servicio (`services/ventas.ts`) que un ítem a crédito tenga un pago inicial mayor a cero registrado en la misma transacción de alta — reutilizando el mecanismo de Pago ya existente, no uno nuevo (HU-39). Mismo criterio para Órdenes de Servicio a crédito (`services/ordenesServicio.ts`/`services/pagos.ts`), ya que el pedido del dueño no distinguió entre ventas de productos y servicios.
- [ ] Reflejar el pago inicial en el formulario: un campo de monto, con su propia forma de pago, que se envía junto con la venta/orden.
- [ ] Revisar el comprobante de venta (HU-21, PDF) para que, si corresponde, muestre el pago inicial recibido y el saldo restante — a confirmar si hace falta un ajuste acá o alcanza con lo que ya genera `calcularSaldoPendienteItem`.

## 2. Compras — sección propia, con historial separado (HU-38)

*Ajustado 21/11/2026, a pedido del compañero de equipo: seguir el mismo patrón que ya existe para Ventas (`VentaScreen.tsx` = cargar, `VentasScreen.tsx` = historial) y Servicios (`OrdenServicioScreen.tsx` = cargar, `HistorialServiciosScreen.tsx` = historial) — dos pantallas de sidebar separadas, no una sola pantalla con el historial mezclado. Así, "Compras" queda dedicada solo a registrar, igual que "Nueva venta" y "Nueva orden" hoy.*

- [ ] Crear `CompraScreen.tsx` (singular, para mantener la convención de nombres ya usada — `VentaScreen`/`OrdenServicioScreen`), separada de `StockScreen.tsx`, dedicada exclusivamente al alta de una nueva Compra.
- [ ] Mover a esa pantalla el formulario de alta de Compra que hoy vive en `StockScreen.tsx` (`FormularioCompra`), sin cambiar su lógica de negocio (selección/alta de producto, cálculo de lote, etc. — Sprint 1).
- [ ] Crear `HistorialComprasScreen.tsx` (plural/historial, siguiendo la convención de `VentasScreen`/`HistorialServiciosScreen`), como pantalla propia del sidebar, separada de `CompraScreen.tsx` — no una pestaña ni sección dentro de la misma pantalla.
- [ ] Ese historial necesita un endpoint de listado nuevo (`GET /api/compras`, con sus filtros — ver `api/routes/ventas.ts`/`api/routes/ordenesServicio.ts` como referencia de paginado y filtros por fecha) y el servicio correspondiente en `services/compras.ts`, ya que hoy no existe ningún listado de Compras más allá de lo que se resuelve al detalle de un Producto puntual.
- [ ] Filtros mínimos del historial: rango de fecha y proveedor, mismo criterio que los historiales ya existentes de Ventas y Servicios.
- [ ] Agregar ambas pantallas (`CompraScreen`, `HistorialComprasScreen`) como entradas separadas del `Sidebar.tsx`, reemplazando la entrada actual que lleva a `StockScreen.tsx` para el alta de compra.
- [ ] Dejar `StockScreen.tsx`/Control de Stock enfocada en consulta y alta de Productos únicamente, sin el formulario de Compra ni su historial.
- [ ] No se requieren cambios de modelo de datos (HU-14, HU-15, HU-16 y el mecanismo de lotes de `entidades-dominio.md`, sección 6, se mantienen igual): es una reorganización de pantallas.

## 3. Marcas de producto (HU-37, adenda HU-01)

- [ ] Tabla `marcas` en el esquema (`schema.ts`), análoga a `categorias`: `id`, `nombre` (único).
- [ ] Servicio de negocio (`services/marcas.ts`) y rutas (`api/routes/marcas.ts`, montadas en `/api/marcas`) con el mismo patrón CRUD que Categorías (Sprint 1): crear, editar, eliminar — gestión exclusiva del Administrador; lectura para ambos roles.
- [ ] Agregar `marca_id` (nullable) a `productos`, y su selector correspondiente en el formulario de alta/edición de Producto (`StockScreen.tsx`).
- [ ] **Pendiente de confirmar con el dueño** (ver `desiciones-alcance.md`, sección 7.6): si `marca_id` debería ser obligatorio. Mientras no se confirme, se implementa como opcional.
- [ ] Agregar filtro por marca al listado de productos (mismo criterio que el filtro por categoría ya existente, HU-02), y evaluar si corresponde también en la impresión de listado de existencias (HU-05, adenda).

## 4. Rol Empleado — restricciones de lectura (HU-36)

- [ ] Revisar todos los endpoints `GET` de historial de Compras y de Ventas (`GET /api/ventas`, `GET /api/ventas/:id`, y el futuro listado de Compras del punto 2) y agregar `requireRole('Administrador')` donde hoy solo exigen `requireAuth`. Esto es una restricción de **lectura**, nueva respecto del Sprint 2 (donde el Empleado no podía registrar, pero sí consultar).
- [ ] Revisar la respuesta de los endpoints de Producto/Compra que el Empleado sí puede consultar (precio, stock) para que no incluyan el precio de compra/costo (`compras.precioCompra`) en ningún campo visible para ese rol — hoy ese dato viaja, por ejemplo, en el detalle de Compras disponibles de un producto al armar una Venta (selección de lote, Sprint 2); para el Empleado (que de todos modos no registra ventas) esa pantalla debería dejar de mostrar precio de compra o de lote.
- [ ] Actualizar el frontend (ocultar los puntos de menú/botones de historial de compras y ventas para Empleado), como defensa adicional a la validación del servidor — nunca como único mecanismo de protección (mismo criterio que ya se aplicó en Sprint 2 para HU-17.1).
- [ ] Confirmar que el acceso a la ficha de clientes (lectura) se mantiene sin cambios para Empleado — el dueño lo mencionó explícitamente como algo que sí puede ver.

## 5. Visual — propuesta a validar con el dueño

- [ ] **Bloqueado** (ver `desiciones-alcance.md`, sección 7.6): armar una propuesta visual concreta (paleta de colores, contraste de botones/sidebar/desplegables — no necesariamente modo oscuro, el dueño no lo pidió explícitamente, solo dijo que el tono claro actual cuesta de seguir) y validarla con el dueño antes de aplicarla a toda la app, en vez de rediseñar a criterio propio del equipo.
- [ ] Una vez validada, aplicar los cambios a nivel de tokens de diseño (`design/tokens.css`, ya usado para el ajuste de tamaño de letra del Sprint 2), para que alcance a toda la app de forma consistente.

## 6. Servicios — kilometraje y próximo mantenimiento (HU-41)

- [ ] **Bloqueado por completo** (ver `desiciones-alcance.md`, sección 7.6, e `historias-usuario.md`, HU-41): no hay modelo de datos ni criterios de aceptación todavía. Antes de programar nada acá, resolver con el dueño o en equipo: dónde se registra el kilometraje (¿por visita, como dato del Vehículo, o ambos?), cómo se calcula el intervalo de "próximo mantenimiento" (¿fijo para todo, o por tipo de servicio?), y a qué tipos de servicio aplica.
- [ ] Una vez resuelto lo anterior, actualizar `entidades-dominio.md` (sección 10) y el DER *antes* de implementar — no repetir el patrón de este mismo sprint2 de documentar en retrospectiva.

## Fuera de este sprint

- HU-28, HU-29 (reportes de ventas y de ganancias) — post-MVP, sin cambios.
- HU-30 (acceso móvil) — post-MVP, sin cambios.
- Emparejar el esquema de autenticación de categorías/productos/proveedores/compras con el resto de la API (deuda técnica registrada en `sprint-2-backlog.md`, punto 5, todavía sin decidir) — a evaluar si entra en este sprint o se sigue posponiendo.
- Validación de persistencia de PGlite en la notebook real del taller (deuda técnica heredada del Sprint 1, todavía pendiente).

## Reparto entre los dos integrantes

*A definir por el equipo al planificar el sprint.* Como referencia: el punto 1 (Ventas) es el de mayor superficie de cambio (rediseño de pantalla completo) y probablemente el de mayor riesgo de subestimar el esfuerzo, por el mismo motivo que `plan-gestion-proyecto.md` señalaba para el crédito/pagos en el Sprint 2 — conviene reservarle tiempo extra. Los puntos 3 (Marcas) y 2 (Compras) son los más independientes entre sí y del resto, buenos candidatos para dividir por persona. El punto 4 (restricciones de Empleado) conviene resolverlo temprano y en conjunto, ya que toca varios endpoints que ambos integrantes construyeron en sprints anteriores.

## Definición de Hecho

Se aplica la misma definida en `plan-gestion-proyecto.md`, sección 5: criterios de aceptación cumplidos, revisión cruzada del otro integrante, sin romper funcionalidad previa, integrado a la rama de desarrollo. Para los puntos marcados como bloqueados, se agrega: la pregunta abierta correspondiente debe quedar resuelta y trasladada a `desiciones-alcance.md`/`historias-usuario.md` **antes** de marcar la tarea como completada, no después.

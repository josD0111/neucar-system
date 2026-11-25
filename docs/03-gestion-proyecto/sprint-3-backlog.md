# Backlog — Sprint 3

*Basado en el feedback del dueño al cierre del Sprint 2 (`docs/01-analisis/entrevistas/reunion-sprint02--2026-11-20.md`), trasladado a `desiciones-alcance.md` (sección 9) e `historias-usuario.md` (HU-36 a HU-41, más las adendas a HU-01, HU-10, HU-14/15/16 y HU-17/17.1/18). Redactado el 20/11/2026, al cierre del Sprint 2 y la revisión de consistencia documentación/código que lo acompañó (ver la actualización del 20/11/2026 en `sprint-2-backlog.md`).*

**Nota sobre el estado de este backlog:** a diferencia de `sprint-1-backlog.md` y `sprint-2-backlog.md`, que arrancaban sobre historias de usuario ya cerradas con el dueño, varios puntos de este backlog dependen de reglas de negocio que el dueño no terminó de precisar en la reunión de cierre (ver `desiciones-alcance.md`, sección 7.6). Esos puntos están marcados explícitamente como **bloqueados** más abajo — conviene no empezar a programarlos hasta resolver la pregunta abierta correspondiente, para no repetir el problema que motivó la revisión de documentación del 20/11/2026 (decisiones tomadas "sobre la marcha" sin dejar rastro).

---

**Actualización 23/11/2026 — 24/11/2026:** El punto 1 (Ventas) quedó completamente implementado y verificado (typecheck 0 errores). El cambio de modelo de datos (crédito a nivel de Venta) se realizó el 23/11/2026. La pantalla `VentaScreen.tsx` y todos sus componentes auxiliares se ensamblaron y validaron durante los días 23 y 24/11/2026. Refinamientos de UX adicionales aplicados el 24/11/2026: formato Gs. en precio unitario con miles en vivo, restricción `+Nuevo cliente` exclusiva para Administrador, y helper compartido `formatoMoneda.ts` (funciones `gs` y `posicionTrasNDigitos`).

**Actualización 25/11/2026:** revisión del avance del compañero de equipo en los puntos 2, 3 y 6 (código bajado y revisado hoy). Puntos 3 completo y 2 casi completo — detalle en cada sección. **Alerta sobre el punto 6:** estaba marcado como *bloqueado por completo* a la espera de definir con el dueño las reglas de negocio, pero el código ya trae esas reglas definidas e implementadas de punta a punta, sin que `entidades-dominio.md` ni `desiciones-alcance.md` se hayan actualizado todavía para reflejarlas — es decir, se tomaron las decisiones de negocio "sobre la marcha" otra vez, exactamente el patrón que este mismo backlog pedía no repetir (ver nota introductoria y la Definición de Hecho, que exige la documentación actualizada *antes* de cerrar un punto bloqueado). Queda marcado como pendiente de regularizar documentación, no como cerrado, hasta confirmar con el compañero si esas decisiones se consultaron con el dueño o quedaron a criterio propio.

## Objetivo del sprint

Incorporar el feedback de la presentación del Sprint 2 al dueño: un nuevo flujo de carga para Ventas más parecido al sistema que ya usa, separar Compras de Control de Stock, agregar marcas de producto, acotar más el rol Empleado a solo-lectura, mejorar la presentación visual, y dejar encaminado (sin necesariamente cerrar del todo) el pedido de kilometraje/próximo mantenimiento.

## Punto de partida

- El modelo de datos para Marca ya está propuesto en `entidades-dominio.md`, sección 4.1 (entidad propia, igual que Categoría), con `marca_id` opcional en Producto — pendiente de confirmar con el dueño si debería ser obligatorio.
- El catálogo `tiposServicio` (Sprint 2, documentado el 20/11/2026 en `entidades-dominio.md`, sección 9.2) ya resuelve "precio de referencia por tipo de servicio" — si el kilometraje termina necesitando un intervalo de mantenimiento por tipo de servicio, ese catálogo es el lugar natural para agregarlo, en vez de crear una entidad nueva.
- El mecanismo de Pago (`services/pagos.ts`, Sprint 2) ya soporta pagos parciales sobre un ítem/orden a crédito — el "pago inicial obligatorio" (punto 1) no debería necesitar un mecanismo nuevo, solo una validación adicional al registrar la venta/orden.
- Las restricciones de rol Empleado ya existentes (no registra ventas — Sprint 2) se extienden, no se reemplazan — ver punto 5.

## 1. Ventas — nuevo flujo y pago inicial obligatorio (HU-39, HU-40)

*Planificado en detalle el 22/11/2026 sobre un prototipo HTML construido por el equipo (ver HU-40 en `historias-usuario.md` para los criterios de aceptación completos, y `desiciones-alcance.md`, sección 7.7, para las decisiones que salieron de esa planificación). La búsqueda de producto, antes bloqueada (sección 7.6), queda resuelta: por nombre, marca o código.*

**Cambio de modelo de datos (previo a tocar la pantalla):**
- [x] Mover `tipo_pago`, `fecha_pago_prevista` y `saldo_pendiente` (calculado) de `itemsVenta` a `ventas` en `schema.ts` — revierte la decisión del 23/10/2026 de manejar el crédito por ítem (ver `entidades-dominio.md`, sección 12). Implica una migración: estos tres conceptos pasan a aplicar a toda la Venta, no por producto.
- [x] Cambiar `pagos.itemVentaId` por `pagos.ventaId` (la referencia circular lazy con `AnyPgColumn` se mantiene, pero apunta a `ventas` en vez de `itemsVenta`).
- [x] Actualizar `services/ventas.ts`: `registrarVenta` pasa a recibir un único `tipoPago` para toda la venta (no por ítem), valida que un `tipoPago = 'Crédito'` venga con pago inicial > 0, y genera el Pago automático de contado sobre la Venta completa, no por ítem.
- [x] Actualizar `services/pagos.ts` y `services/saldoClientes.ts` para calcular `saldoPendiente` sobre `ventas` en vez de `itemsVenta` (mismo cálculo que ya usan para `ordenesServicio`, que no cambia).
- [x] Actualizar los endpoints en `api/server.ts`/`api/routes` que hoy asumen `tipo_pago` por ítem.
- [ ] **Importante, a comunicarle al dueño antes de cerrar este punto:** con este cambio, una venta ya no admite mezclar productos al contado y a crédito en la misma operación (si eso pasara en la práctica, habría que registrar dos ventas separadas) — ver `desiciones-alcance.md`, sección 7.7.

**Pantalla (`VentaScreen.tsx`), siguiendo la estructura del prototipo:**
- [x] **Franja A — búsqueda y condición:** A1) buscador de producto por nombre/marca/código con tabla de resultados (producto, marca, stock, precio base); A2) sección de Cliente y Condición de la venta completa (toggle Contado/Crédito a nivel de toda la venta, búsqueda de cliente existente + botón "+Nuevo" con modal de alta rápida — cédula y RUC como campos separados, más teléfono). Botón "+Nuevo" solo visible para Administrador (refinamiento 24/11/2026).
- [x] **Franja B — edición del ítem seleccionado:** al elegir un producto (de la búsqueda) o una fila de la tabla de detalle (Franja C), se carga una sección de edición aparte con: código/producto (solo lectura), selector de lote de Compra (mostrando `cantidad_disponible` y `garantía_proveedor` de cada lote), precio unitario editable con formato Gs. y miles en vivo para Administrador / solo lectura formateado para Empleado (refinamiento 24/11/2026), cantidad editable, garantía ofrecida, y botones Agregar/Actualizar ítem + Cancelar edición. Foco inteligente con Enter entre campos. **Ajuste 24/11/2026 (ver `desiciones-alcance.md`, sección 7.8):** el lote ya no arranca vacío esperando elección manual — se sugiere automáticamente el más antiguo (FIFO no estricto), editable igual que antes. Sigue sin ser reparto automático entre lotes para una misma cantidad, eso sigue siendo manual.
- [x] **Franja C — tabla de detalle de la venta:** productos agregados hasta el momento (columnas: Lote legible con proveedor y fecha, Garantía, Cant., Precio unit., Subtotal), click en una fila para editarla en la Franja B, botón de eliminar por fila, cabecera sticky.
- [x] **Franja D — footer:** método de pago de la venta (HU-19, ya existente a nivel de Venta, sin cambios de alcance), total a pagar en Gs., botones Cancelar Venta / Guardar Venta.
- [x] **Modal de confirmación al guardar una venta a crédito:** si `tipoPago = Crédito`, al presionar "Guardar Venta" se abre un modal pidiendo el pago inicial (monto + forma de pago, validado > 0 — HU-39) y la `fecha_pago_prevista` (con la fecha sugerida por defecto, editable — HU-10.2). Si es al contado, se guarda directo, sin modal. Pago inicial formateado con miles en vivo y saldo pendiente calculado en tiempo real.
- [x] **Rol Empleado:** mismo componente `VentaScreen.tsx`, no uno aparte — se condiciona por props/rol para que el Empleado solo pueda usarlo en modo "calculadora" (HU-17/HU-17.1), sin poder confirmar el registro de la venta. Sin acceso a "+Nuevo cliente" ni a precio editable.
- [x] No cambia ninguna otra regla de negocio ya implementada (selección manual de lote, bloqueo por stock insuficiente, permisos de descuento — HU-17/HU-18/HU-20), solo el flujo de pantalla y el nivel al que vive el crédito.
- [ ] Revisar el comprobante de venta (HU-21, PDF) para que, si corresponde, muestre el pago inicial recibido y el saldo restante de la Venta — a confirmar si hace falta un ajuste acá o alcanza con lo que ya genera el cálculo de saldo pendiente (ahora a nivel de Venta).

## 2. Compras — sección propia, con historial separado (HU-38)

*Ajustado 21/11/2026, a pedido del compañero de equipo: seguir el mismo patrón que ya existe para Ventas (`VentaScreen.tsx` = cargar, `VentasScreen.tsx` = historial) y Servicios (`OrdenServicioScreen.tsx` = cargar, `HistorialServiciosScreen.tsx` = historial) — dos pantallas de sidebar separadas, no una sola pantalla con el historial mezclado. Así, "Compras" queda dedicada solo a registrar, igual que "Nueva venta" y "Nueva orden" hoy.*

- [x] Crear `CompraScreen.tsx` (singular, para mantener la convención de nombres ya usada — `VentaScreen`/`OrdenServicioScreen`), dedicada exclusivamente al alta de una nueva Compra (producto existente, buscado por nombre, o producto nuevo).
- [x] Reusar en esa pantalla el formulario de alta de Compra que vivía en `StockScreen.tsx` (`FormularioCompra`, y `FormularioProductoNuevo` para el alta de producto nuevo), sin cambiar su lógica de negocio — `CompraScreen.tsx` los importa directamente desde `StockScreen.tsx` en vez de duplicarlos.
- [x] Crear `HistorialComprasScreen.tsx`, como pantalla propia del sidebar, separada de `CompraScreen.tsx`.
- [x] Endpoint de listado nuevo (`GET /api/compras`, solo Administrador) con filtros, y servicio `listarCompras` en `services/compras.ts` — pagina por días calendario completos, mismo criterio que el historial de Ventas.
- [x] Filtros mínimos del historial: rango de fecha y proveedor (`HistorialComprasScreen.tsx`).
- [x] Agregar ambas pantallas (`CompraScreen`, `HistorialComprasScreen`) como entradas separadas del `Sidebar.tsx` (`soloAdmin`), enrutadas en `App.tsx`.
- [ ] **Pendiente — no se completó:** dejar `StockScreen.tsx`/Control de Stock enfocada en consulta y alta de Productos únicamente, sin el formulario de Compra. Hoy `StockScreen.tsx` todavía tiene, por cada producto, el botón "+ Registrar compra" que abre `FormularioCompra` inline (mismo componente que ahora también usa `CompraScreen.tsx`), por lo que quedó duplicado en dos pantallas en vez de exclusivo de `CompraScreen.tsx`. Falta sacarlo de `StockScreen.tsx`.
- [ ] No evaluado todavía si corresponde agregar la Marca a la impresión de listado de existencias (HU-05, adenda — ver punto 3): no se encontró ninguna función de impresión en `StockScreen.tsx`, así que esto sigue sin resolverse (puede que ni exista todavía esa función, a confirmar con el compañero).
- [x] No se requirieron cambios de modelo de datos (HU-14, HU-15, HU-16 y el mecanismo de lotes se mantienen igual): fue una reorganización de pantallas.

## 3. Marcas de producto (HU-37, adenda HU-01)

- [x] Tabla `marcas` en el esquema (`schema.ts`), análoga a `categorias`: `id`, `nombre` (único).
- [x] Servicio de negocio (`services/marcas.ts`) y rutas (`api/routes/marcas.ts`, montadas en `/api/marcas`) con el mismo patrón CRUD que Categorías: crear, editar, eliminar solo Administrador; lectura para ambos roles. Pantalla propia `MarcaScreen.tsx`, entrada `soloAdmin` en el Sidebar.
- [x] Agregado `marca_id` (nullable) a `productos`, con su selector en el formulario de alta/edición de Producto (`StockScreen.tsx`) y también en el alta de producto nuevo desde `CompraScreen.tsx`/`api/routes/compras.ts` (valida que la marca exista si se indica).
- [x] Implementado como opcional, tal como quedó pendiente de confirmar con el dueño — sigue sin confirmarse, no se endureció a obligatorio.
- [x] Filtro por marca agregado al listado de productos (`StockScreen.tsx`, mismo criterio que el filtro por categoría).
- [ ] Sin resolver todavía si corresponde sumar la Marca a la impresión de listado de existencias (HU-05, adenda) — ver nota en el punto 2, no se encontró una función de impresión en el código para evaluarlo.

## 4. Rol Empleado — restricciones de lectura (HU-36)

- [ ] Revisar todos los endpoints `GET` de historial de Compras y de Ventas (`GET /api/ventas`, `GET /api/ventas/:id`, y el futuro listado de Compras del punto 2) y agregar `requireRole('Administrador')` donde hoy solo exigen `requireAuth`. Esto es una restricción de **lectura**, nueva respecto del Sprint 2 (donde el Empleado no podía registrar, pero sí consultar).
- [ ] Revisar la respuesta de los endpoints de Producto/Compra que el Empleado sí puede consultar (precio, stock) para que no incluyan el precio de compra/costo (`compras.precioCompra`) en ningún campo visible para ese rol — hoy ese dato viaja, por ejemplo, en el detalle de Compras disponibles de un producto al armar una Venta (selección de lote, Sprint 2); para el Empleado (que de todos modos no registra ventas) esa pantalla debería dejar de mostrar precio de compra o de lote.
- [ ] Actualizar el frontend (ocultar los puntos de menú/botones de historial de compras y ventas para Empleado), como defensa adicional a la validación del servidor — nunca como único mecanismo de protección (mismo criterio que ya se aplicó en Sprint 2 para HU-17.1).
- [ ] Confirmar que el acceso a la ficha de clientes (lectura) se mantiene sin cambios para Empleado — el dueño lo mencionó explícitamente como algo que sí puede ver.

## 5. Visual — propuesta a validar con el dueño

- [ ] **Bloqueado** (ver `desiciones-alcance.md`, sección 7.6): armar una propuesta visual concreta (paleta de colores, contraste de botones/sidebar/desplegables — no necesariamente modo oscuro, el dueño no lo pidió explícitamente, solo dijo que el tono claro actual cuesta de seguir) y validarla con el dueño antes de aplicarla a toda la app, en vez de rediseñar a criterio propio del equipo.
- [ ] Una vez validada, aplicar los cambios a nivel de tokens de diseño (`design/tokens.css`, ya usado para el ajuste de tamaño de letra del Sprint 2), para que alcance a toda la app de forma consistente.

## 6. Servicios — kilometraje y próximo mantenimiento (HU-41)

**Estado al 25/11/2026 — código implementado, pero el desbloqueo no quedó documentado (ver alerta en la actualización del 25/11/2026 al principio de este archivo).** El código bajado del compañero resuelve las tres preguntas que tenían este punto bloqueado, con esta solución concreta:
- El kilometraje se registra **por visita**, como campo opcional en `ordenesServicio` (`kilometraje`, entero, validado entre 0 y un tope — HU-41), no como dato fijo del Vehículo.
- El intervalo de "próximo mantenimiento" es **por tipo de servicio** (`intervaloKm` en `tiposServicio`, editable desde `TiposServicioScreen.tsx`; `null` = ese tipo no genera aviso), no un valor fijo único.
- Aplica a cualquier tipo de servicio al que se le cargue un `intervaloKm`, no está restringido a "mantenimiento" como categoría separada.
- `services/ordenesServicio.ts` calcula `proximoMantenimientoKm` (kilometraje actual + el intervalo más corto entre los tipos de servicio de la orden que tengan uno cargado) y avisa si el kilometraje cargado es menor al de la visita anterior del mismo vehículo (posible error de tipeo). `OrdenServicioScreen.tsx` muestra ambos datos al confirmar.

- [ ] **Falta antes de dar este punto por cerrado:** confirmar con el compañero si estas tres decisiones (dónde se registra el km, intervalo por tipo de servicio, a qué tipos aplica) se consultaron con el dueño o se tomaron en equipo/a criterio propio — la Definición de Hecho de este sprint exige que la pregunta abierta quede resuelta y trasladada a la documentación *antes* de cerrar un punto bloqueado, no después.
- [ ] Actualizar `entidades-dominio.md` (sección 10, hoy todavía dice "sin modelo propuesto todavía") con el modelo real ya implementado, y el DER correspondiente.
- [ ] Actualizar `desiciones-alcance.md` (secciones 7.6 y 158) retirando esto de "preguntas sin resolver" y dejando asentada la decisión tomada, con fecha.
- [ ] Revisar si corresponde actualizar `historias-usuario.md` (HU-41) con los criterios de aceptación ya cumplidos por el código, ya que el backlog decía que todavía no existían.

## Fuera de este sprint

- HU-28, HU-29 (reportes de ventas y de ganancias) — post-MVP, sin cambios.
- HU-30 (acceso móvil) — post-MVP, sin cambios.
- Emparejar el esquema de autenticación de categorías/productos/proveedores/compras con el resto de la API (deuda técnica registrada en `sprint-2-backlog.md`, punto 5, todavía sin decidir) — a evaluar si entra en este sprint o se sigue posponiendo.
- Validación de persistencia de PGlite en la notebook real del taller (deuda técnica heredada del Sprint 1, todavía pendiente).

## Reparto entre los dos integrantes

*A definir por el equipo al planificar el sprint.* Como referencia: el punto 1 (Ventas) es el de mayor superficie de cambio (rediseño de pantalla completo) y probablemente el de mayor riesgo de subestimar el esfuerzo, por el mismo motivo que `plan-gestion-proyecto.md` señalaba para el crédito/pagos en el Sprint 2 — conviene reservarle tiempo extra. Los puntos 3 (Marcas) y 2 (Compras) son los más independientes entre sí y del resto, buenos candidatos para dividir por persona. El punto 4 (restricciones de Empleado) conviene resolverlo temprano y en conjunto, ya que toca varios endpoints que ambos integrantes construyeron en sprints anteriores.

## Definición de Hecho

Se aplica la misma definida en `plan-gestion-proyecto.md`, sección 5: criterios de aceptación cumplidos, revisión cruzada del otro integrante, sin romper funcionalidad previa, integrado a la rama de desarrollo. Para los puntos marcados como bloqueados, se agrega: la pregunta abierta correspondiente debe quedar resuelta y trasladada a `desiciones-alcance.md`/`historias-usuario.md` **antes** de marcar la tarea como completada, no después.

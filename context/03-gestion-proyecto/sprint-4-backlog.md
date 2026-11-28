# Backlog — Sprint 4

*Basado en `docs/02-planificacion/planificacion-sprint04.md` (puntos armados en conjunto con el dueño del taller), en los puntos de `sprint-3-backlog.md` que quedaron sin cerrar al final del Sprint 3 (restricciones de lectura del rol Empleado, separación completa de Compras/Control de Stock, propuesta visual bloqueada), y en las decisiones nuevas del feedback de cierre del Sprint 3 (`docs/01-analisis/reuniones/reunion-sprint03--2026-11-26.md`), trasladadas a `desiciones-alcance.md` sección 10 (y secciones 7.6/7.9 que esta actualiza) y a `entidades-dominio.md` secciones 10 y 14.*

## Objetivo del sprint

Cerrar los puntos del Sprint 3 que quedaron abiertos (restricciones de lectura del Empleado, separación definitiva de Compras y Control de Stock, propuesta visual), implementar el reparto automático editable entre lotes que el dueño aprobó para Ventas, rehacer desde cero el modelo de kilometraje/próximo mantenimiento siguiendo la regla real que el dueño precisó (reemplazando el modelo del Sprint 3, que se implementó sin confirmar con él), y entregar las mejoras puntuales pedidas en la reunión de cierre (modales en Productos/Compras/Pagos, ajustes de listado e inputs).

## Punto de partida

- El modelo de kilometraje implementado en el Sprint 3 (`tiposServicio.intervaloKm`, cálculo automático de `proximoMantenimientoKm`) **se descarta por completo**: el dueño precisó una regla distinta (intervalo por vehículo, no por tipo de servicio; carga manual, no cálculo automático). Este punto implica una migración que revierte lo hecho, no una extensión — ver `entidades-dominio.md`, sección 10.
- El reparto automático editable entre lotes ya tiene un prototipo validado por el dueño (`prototipos/prototipo_venta_reparto_automatico_editable.html`) y una decisión de modelo registrada en `entidades-dominio.md`, sección 14 — falta el diseño técnico detallado y la implementación.
- La separación de Compras/Stock (Sprint 3, punto 2) quedó a medio camino: las pantallas nuevas (`CompraScreen.tsx`, `HistorialComprasScreen.tsx`) ya existen, pero `StockScreen.tsx` todavía conserva el formulario de compra duplicado (`FormularioCompra` inline vía "+ Registrar compra"). Este sprint no vuelve a diseñar nada, solo termina de sacar ese botón/formulario de `StockScreen.tsx`.
- Las restricciones de lectura del Empleado (Sprint 3, punto 4) no llegaron a implementarse: siguen siendo válidas todas las tareas de `sprint-3-backlog.md`, punto 4, y se retoman tal cual en este backlog.
- La propuesta visual (Sprint 3, punto 5) sigue bloqueada: antes de tocar cualquier token de diseño hay que mostrarle al dueño una propuesta concreta y conseguir su aprobación explícita — no se avanza en base a criterio propio del equipo.
- Queda pendiente confirmar con el dueño si corresponde un precio de venta a crédito distinto del precio de contado (mencionado el 26/11/2026, sin pedido formal — ver `desiciones-alcance.md`, sección 7.6); no se implementa nada sobre esto en este sprint, solo se deja planteado como pregunta a llevar a la próxima reunión.

## 1. Ventas — reparto automático editable entre lotes (HU-40, actualizada)

*Reemplaza la selección manual de lote vigente desde el Sprint 2/3 — ver `desiciones-alcance.md`, sección 7.9, y `entidades-dominio.md`, sección 14 (actualización 26/11/2026). El dueño ya vio y aprobó el prototipo (`prototipos/prototipo_venta_reparto_automatico_editable.html`); este punto es la implementación real sobre `VentaScreen.tsx`/`FormularioItemEdicion.tsx`.*

- [ ] Definir junto al dueño (o, si no hay reunión antes de empezar este punto, dejarlo documentado como pregunta a confirmar en la próxima) **cómo se resuelve la garantía ofrecida al cliente** cuando el reparto automático toca lotes con distinta `garantía_proveedor` en un mismo ítem — pregunta abierta en `desiciones-alcance.md`, sección 7.6. No conviene empezar la implementación del reparto sin esta definición, para no repetir el patrón de decisiones "sobre la marcha" que motivó la alerta del punto 6 del Sprint 3.
- [ ] Diseñar el algoritmo de reparto: dado un Producto y una cantidad solicitada, repartir automáticamente entre los lotes (`Compra.cantidad_disponible`) disponibles del producto, más antiguos primero (mismo criterio FIFO ya usado como sugerencia en el Sprint 3), generando internamente un Ítem de Venta por lote afectado.
- [ ] Actualizar `services/ventas.ts` para aceptar, al registrar un Ítem de Venta, una cantidad que puede exceder un único lote, y persistir el reparto resultante como múltiples Ítems de Venta (cada uno con su propio `compra_id` y porción de `cantidad`), descontando `cantidad_disponible` de cada lote afectado.
- [ ] Rediseñar `FormularioItemEdicion.tsx` (Franja B de `VentaScreen.tsx`) para mostrar el reparto propuesto por lote (cantidad y garantía por cada lote afectado) antes de confirmar el ítem, permitiendo al Administrador editarlo (cambiar de qué lote sale cada porción, dentro de lo disponible) — igual que el prototipo aprobado.
- [ ] Actualizar la Franja C (tabla de detalle de la venta) para mostrar, cuando un mismo producto quedó repartido entre varios lotes, una fila por lote (ya es el comportamiento actual con Ítems de Venta separados, verificar que siga siendo legible con el reparto automático).
- [ ] Revisar el bloqueo por stock insuficiente (HU-20, sección 7.3 de `desiciones-alcance.md`) para que siga aplicando sobre la suma de `cantidad_disponible` de todos los lotes del producto, no sobre un único lote.
- [ ] Actualizar `entidades-dominio.md`, sección 14, dejando registrado el algoritmo de reparto implementado (no solo la decisión de alto nivel ya documentada) y la resolución tomada sobre la garantía mixta.
- [ ] Actualizar `historias-usuario.md`, HU-40, con los criterios de aceptación del reparto automático editable (hoy describen la selección manual con sugerencia FIFO del Sprint 3).

## 2. Productos — modales y simplificación de pantalla

*Pedido explícito del dueño en la reunión de cierre de Sprint 3 ("simplificar el flujo de edición de un producto, con menos sobrecarga visual") — ver `docs/01-analisis/reuniones/reunion-sprint03--2026-11-26.md` y `docs/02-planificacion/planificacion-sprint04.md`. El dueño no precisó el cómo; se resuelve moviendo a modales lo que hoy vive inline en `StockScreen.tsx`.*

- [ ] Convertir la edición de un Producto existente (hoy inline en `StockScreen.tsx`) en un modal.
- [ ] Convertir el alta/edición de lotes de compra asociados a un producto en un modal (reutilizando o adaptando `FormularioCompra`, ya movido a `CompraScreen.tsx` en el Sprint 3).
- [ ] Eliminar de `StockScreen.tsx` el botón "+ Registrar compra" y el `FormularioCompra` inline que todavía quedaba duplicado desde el Sprint 3 (punto 2, pendiente no cerrado) — a partir de ahora el alta de compra vive únicamente en `CompraScreen.tsx`.
- [ ] Eliminar de `StockScreen.tsx` el botón de alta de nuevo producto inline, si corresponde moverlo también a modal (a confirmar con el dueño si prefiere mantenerlo accesible desde Stock o solo desde Compras, ver punto 3 de este backlog — `CompraScreen.tsx` ya permite alta de producto nuevo al registrar una compra).
- [ ] Revisar que `StockScreen.tsx` quede, tras estos cambios, enfocada en consulta y filtrado de productos (nombre, categoría, marca, stock mínimo), con el alta/edición como acciones puntuales vía modal, no como formularios siempre visibles en pantalla.

## 3. Compras — marcas, stock mínimo y nuevo registro vía modales

*Puntos pedidos concretamente en `planificacion-sprint04.md`, sobre la pantalla de Compras ya separada en el Sprint 3 (`CompraScreen.tsx`).*

- [ ] En la pestaña de "productos existentes" de `CompraScreen.tsx`: agregar la columna/dato de marca (ya disponible en el modelo desde el Sprint 3, falta mostrarla acá).
- [ ] En la misma pestaña: agregar el stock mínimo de cada producto al listado.
- [ ] En la pestaña de "nuevo producto": renombrar los botones "+Nuevo" para que cada uno aclare qué se va a agregar (ej. "+Nueva categoría", "+Nueva marca", "+Nuevo proveedor" — según corresponda a cada botón existente).
- [ ] Convertir la carga de un nuevo registro desde esos botones (categoría, marca, proveedor, lo que corresponda) en modales, en vez de formularios inline.

## 4. Historial de compras — buscador y columnas (HU-38, ampliación)

*Ajustes puntuales sobre `HistorialComprasScreen.tsx`, ya creada en el Sprint 3.*

- [ ] Agregar un buscador de producto y/o marca al historial de compras (hoy solo tiene filtro por rango de fecha y proveedor — ver `sprint-3-backlog.md`, punto 2).
- [ ] Eliminar la columna "Disp." (cantidad disponible) del listado del historial — no es un dato relevante para esa vista según el pedido del dueño.
- [ ] Agregar la columna de marca al listado del historial de compras.

## 5. Ventas — reparto automático editable en pantalla (ver punto 1)

*Nota: este punto se desdobla del punto 1 solo a efectos de `planificacion-sprint04.md`; en este backlog ya queda cubierto íntegramente por el punto 1 (algoritmo + pantalla). No se listan tareas nuevas acá para no duplicar.*

## 6. Servicios — rehacer kilometraje y próximo mantenimiento (HU-41 reescrita, HU-42 nueva)

*El dueño precisó en el cierre del Sprint 3 una regla distinta de la implementada: el intervalo varía por vehículo, no por tipo de servicio, y la carga es manual, no calculada — ver `desiciones-alcance.md`, sección 10.2, y `entidades-dominio.md`, sección 10. Este punto reemplaza, no ajusta, lo hecho en el Sprint 3.*

- [ ] Eliminar `tiposServicio.intervaloKm` del esquema y el cálculo automático de `proximoMantenimientoKm` en `services/ordenesServicio.ts` (modelo del Sprint 3, descartado).
- [ ] Agregar el campo `proximoMantenimientoKm` (entero, opcional) a `ordenesServicio` (o a `servicios`, si en el diseño técnico se prefiere asociarlo al Servicio de tipo mantenimiento puntual de esa orden — a definir al empezar este punto, ver `entidades-dominio.md`, sección 10), cargado manualmente por el Administrador, sin ningún cálculo automático.
- [ ] Mantener sin cambios `ordenesServicio.kilometraje` (kilometraje de la visita, ya implementado en Sprint 3).
- [ ] Actualizar `OrdenServicioScreen.tsx` para que el campo de próximo mantenimiento solo aparezca cuando la orden incluye un Servicio de tipo mantenimiento, como campo editable por el Administrador (no de solo lectura ni calculado).
- [ ] Quitar de `TiposServicioScreen.tsx` el campo `intervaloKm` que se había agregado en el Sprint 3.
- [ ] Migración de datos: decidir qué hacer con los valores de `proximoMantenimientoKm` que puedan haberse generado automáticamente durante el Sprint 3 (si los hay en datos de prueba) — no debería haber datos reales de producción todavía, a confirmar antes de correr la migración.
- [ ] HU-42 (nueva) — Historial de servicios por vehículo: implementar la búsqueda por chapa del vehículo o por nombre del cliente, que liste las Órdenes de Servicio de ese vehículo con `fecha` y `kilometraje` de cada visita (consulta sobre el modelo ya existente Vehículo → Órdenes de Servicio, sin entidad nueva — ver `entidades-dominio.md`, sección 10).
- [ ] Actualizar `entidades-dominio.md`, sección 10, dejando asentado el modelo final implementado (reemplazando la referencia al modelo descartado del Sprint 3 por el estado "implementado").
- [ ] Actualizar `historias-usuario.md`: reescribir HU-41 con los criterios de aceptación de la regla real (intervalo por vehículo, carga manual) y agregar HU-42 con los criterios del historial por vehículo.

## 7. Ficha del cliente — cobro de pagos vía modales

- [ ] Convertir el registro de cobro de pagos en la ficha del cliente (hoy, a confirmar si es inline o ya modal parcial) en un modal, siguiendo el mismo criterio de simplificación visual que los puntos 2 y 3.

## 8. Sistema general — ajustes transversales

- [ ] Reducir el padding del `main` (contenedor principal del layout) a 10px.
- [ ] Actualizar los inputs de ingreso de dinero en el resto del sistema (Compras, Servicios, Pagos, etc.) para que se comporten igual que los ya implementados en Ventas (formato Gs. con miles en vivo — `formatoMoneda.ts`, Sprint 3), unificando el criterio en toda la app.

## 9. Rol Empleado — restricciones de lectura (HU-36) *(arrastrado de Sprint 3, punto 4, sin cambios)*

- [ ] Revisar todos los endpoints `GET` de historial de Compras y de Ventas (`GET /api/ventas`, `GET /api/ventas/:id`, `GET /api/compras`) y agregar `requireRole('Administrador')` donde hoy solo exigen `requireAuth` — restricción de **lectura**, nueva respecto del Sprint 2.
- [ ] Revisar la respuesta de los endpoints de Producto/Compra que el Empleado sí puede consultar (precio, stock) para que no incluyan `compras.precioCompra` en ningún campo visible para ese rol, incluyendo el detalle de lotes disponibles de un producto al armar una Venta (ahora más relevante por el reparto automático del punto 1, que muestra varios lotes a la vez).
- [ ] Actualizar el frontend (ocultar los puntos de menú/botones de historial de compras y ventas para Empleado) como defensa adicional, nunca como único mecanismo de protección.
- [ ] Confirmar que el acceso de lectura a la ficha de clientes se mantiene sin cambios para Empleado.

## 10. Compras/Stock — cierre definitivo de la separación (HU-38) *(arrastrado de Sprint 3, punto 2, parte pendiente)*

*Nota: la tarea concreta de sacar el formulario duplicado ya está listada en el punto 2 de este backlog (simplificación de Productos), para no duplicarla. Este ítem queda como recordatorio de cierre del punto del Sprint 3.*

- [ ] Confirmar, al cerrar el punto 2 de este backlog, que `StockScreen.tsx` ya no tiene ningún camino para registrar una Compra fuera de `CompraScreen.tsx`.
- [ ] Evaluar si corresponde agregar la Marca a la impresión de listado de existencias (HU-05, adenda) — sigue sin resolverse desde el Sprint 3 porque no se encontró ninguna función de impresión implementada en `StockScreen.tsx`; confirmar con el compañero si existe en otro lado antes de dar este punto por no aplicable.

## 11. Visual — propuesta a validar con el dueño *(arrastrado de Sprint 3, punto 5, sin cambios — sigue bloqueado)*

- [ ] **Bloqueado**: armar una propuesta visual concreta (paleta de colores, contraste de botones/sidebar/desplegables) y validarla con el dueño antes de aplicarla a toda la app.
- [ ] Una vez validada, aplicar los cambios a nivel de tokens de diseño (`design/tokens.css`).

## Fuera de este sprint

- Precio de venta a crédito distinto del precio de contado — mencionado por el dueño el 26/11/2026 sin pedido formal; queda como pregunta a confirmar en la próxima reunión, no se implementa (ver `desiciones-alcance.md`, sección 7.6).
- HU-28, HU-29 (reportes de ventas y de ganancias) — post-MVP, sin cambios.
- HU-30 (acceso móvil) — post-MVP, sin cambios.
- Emparejar el esquema de autenticación de categorías/productos/proveedores/compras con el resto de la API (deuda técnica registrada en `sprint-2-backlog.md`, punto 5) — a evaluar si entra en este sprint según el tiempo disponible tras los puntos de arriba.
- Validación de persistencia de PGlite en la notebook real del taller (deuda técnica heredada del Sprint 1, todavía pendiente).
- Anulación de venta — fuera de alcance del MVP (ver `desiciones-alcance.md`, sección 7.4).

## Reparto entre los dos integrantes

*A definir por el equipo al planificar el sprint.* Como referencia:

- El punto 1 (reparto automático de lotes en Ventas) es el de mayor riesgo técnico: toca el modelo de datos de Ítem de Venta y el flujo central de la pantalla de Ventas, y depende de resolver primero la pregunta de la garantía mixta — conviene no subestimarlo, mismo criterio que el punto 1 del Sprint 3.
- El punto 6 (kilometraje) es autocontenido y no depende de los demás puntos — buen candidato para dividir en paralelo con el punto 1.
- Los puntos 2, 3, 4 y 7 (modales y ajustes de Compras/Productos/Pagos) son de alcance acotado y similares entre sí — buenos candidatos para repartir entre ambos una vez cerrados los puntos 1 y 6.
- El punto 9 (restricciones Empleado) conviene resolverlo en conjunto, ya que toca endpoints construidos por ambos integrantes en sprints anteriores — mismo criterio que el Sprint 3.
- El punto 11 (Visual) sigue bloqueado hasta validar una propuesta con el dueño; no conviene asignarle tiempo de desarrollo hasta tener esa validación.

## Definición de Hecho

Se aplica la misma definida en `plan-gestion-proyecto.md`, sección 5: criterios de aceptación cumplidos, revisión cruzada del otro integrante, sin romper funcionalidad previa, integrado a la rama de desarrollo. Para el punto 1 (reparto automático), se agrega: la pregunta sobre la garantía mixta entre lotes debe quedar resuelta y trasladada a `desiciones-alcance.md`/`entidades-dominio.md` antes de dar la tarea por completada — mismo aprendizaje que dejó el punto 6 del Sprint 3 (no repetir decisiones de negocio "sobre la marcha" sin documentar ni confirmar con el dueño).

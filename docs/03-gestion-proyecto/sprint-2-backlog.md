# Backlog — Sprint 2

*Basado en `plan-gestion-proyecto.md` (sección 3, "Sprint 2 — Operación diaria del taller") e `historias-usuario.md`. Desglosa las historias de Sprint 2 en tareas técnicas, siguiendo el mismo formato que `sprint-1-backlog.md`. Redactado el 22/10/2026, al cerrar el Sprint 1.*

**Actualización 23/10/2026 (feedback del dueño):** se incorporó el feedback recogido en la reunión de cierre del Sprint 1 (`docs/01-analisis/entrevistas/reunion-sprint01--2026-10-23.md`, trasladado a `desiciones-alcance.md` sección 8 y a `historias-usuario.md`). Afecta a este backlog en tres puntos: (1) el rol Empleado en Ventas pasa de "registra a precio base" a "solo calcula, no registra" — ver punto 1 y HU-17/HU-17.1 (nueva); (2) se agrega una sección 6 de usabilidad (tamaño de letra, foco/Enter en formularios); (3) se agrega una tarea de filtro en la impresión de stock (categoría/stock bajo), adenda a HU-05.

**Actualización 23/10/2026 (decisiones de diseño técnico):** el equipo cerró, sin necesidad de pasar por el dueño, las cuatro preguntas de diseño que este backlog dejaba abiertas (ver `desiciones-alcance.md`, sección 7.3): selección manual de lote (no FIFO) en el punto 1, bloqueo por stock insuficiente en el punto 1, cotización previa como cálculo sin persistir en el punto 2, y pago excedente limitado al saldo pendiente (sin saldo a favor) en el punto 4. Queda todavía abierta, sin resolver, la pregunta de si la anulación de venta entra en el alcance de este sprint (ver punto 1 y `desiciones-alcance.md`, sección 7.2).

## Objetivo del sprint

Al final del sprint el sistema cubre el flujo completo de atención a un cliente: venta de productos con descuento de stock automático y permisos por rol, órdenes de servicio con varios servicios por visita, y el módulo de crédito/pagos parciales con saldo por cliente, fecha de pago prevista y aviso de mora. Es, según `plan-gestion-proyecto.md` (sección 7), la parte de mayor complejidad técnica del MVP.

## Punto de partida (a diferencia del Sprint 1)

El Sprint 1 ya dejó resuelta la base técnica que este sprint necesita, así que no hace falta un punto "0" de fundación:

- El esquema de Drizzle (`src/main/db/schema.ts`) ya tiene las tablas `ventas`, `items_venta`, `pagos`, `vehiculos`, `ordenes_servicio` y `servicios`, completas y en línea con `entidades-dominio.md` — no se requieren cambios de modelo para este sprint, salvo que surja algo nuevo al implementar.
- El servidor Express, la convención `{ ok, data }` / `{ ok, error }`, el login y los middlewares `requireAuth`/`requireRole` ya existen y se reutilizan tal cual (`src/main/api/middleware/auth.ts`).
- `VentaScreen.tsx` y `OrdenServicioScreen.tsx` ya existen como **prototipo clickeable** (Sprint 0.5), sobre `AppDataContext.tsx` (datos en memoria). Sirven como punto de partida de la interfaz y como validación temprana de los flujos con el dueño, pero **no como referencia de datos fiel al modelo actual** — ver discrepancias detectadas abajo.

## Discrepancias detectadas entre el prototipo y el modelo/HU actuales

El prototipo de `OrdenServicioScreen.tsx` es anterior a la entrevista del 10/09/2026 y no se actualizó después (a diferencia de `StockScreen.tsx`/`ClienteScreen.tsx`, que sí se reconstruyeron sobre la API real). Al conectarlo a datos reales, esto debe corregirse, no solo "cablearse":

- Tiene un campo `garantiaDias` (estado `garantiaDias`, sin usar en la lógica salvo recibirlo) que corresponde a HU-25, **descartada** tras esa entrevista (ver `entidades-dominio.md`, sección 9, nota de eliminación de `garantía_dias`). Hay que quitarlo de la pantalla, no solo dejar de usarlo.
- No tiene campo `detalle` por servicio (HU-22.1, agregada tras la misma entrevista).
- No tiene campo `color` del vehículo, pese a que HU-22 lo pide explícitamente ("tipo de servicio, fecha, marca, número de chapa, color y monto").
- Carga `marca`/`chapa` como texto libre suelto en cada Orden, sin pasar por una entidad Vehículo real ni reutilizar un vehículo ya cargado de ese cliente — hay que resolver esto como parte del punto 4 (Vehículos), más abajo.
- `VentaScreen.tsx` está más alineado al modelo actual (cubre venta mixta contado/crédito, precio editable solo para Administrador, garantía validada contra el lote), pero sigue sobre `AppDataContext.tsx`: no valida nada contra la `garantía_proveedor` real del lote ni aplica ninguna regla de servidor — toda la lógica de ese prototipo vive en el cliente, sin equivalente en la API.

## 1. Ventas (HU-17 a HU-21)

- [ ] Servicio de negocio de Ventas (`src/main/services/ventas.ts`): registrar una Venta con uno o más Ítems de Venta, cada uno con su propio `tipo_pago` (HU-10).
- [ ] Selección del lote de origen (`compra_id`) al vender: implementar descuento de stock por lote con **selección manual** (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3 y `entidades-dominio.md`, sección 14): no hay PEPS/FIFO automático. El endpoint de registro de venta recibe el `compra_id` elegido para cada ítem; la pantalla, al elegir un producto, debe mostrar las Compras disponibles de ese producto (con `cantidad_disponible` y `garantía_proveedor`) para que el Administrador elija.
- [ ] Si la cantidad vendida de un producto debe repartirse entre varios lotes, **no generarlo automáticamente**: el Administrador agrega manualmente, desde la pantalla, un Ítem de Venta por cada lote del que sale stock (cada uno con su `compra_id` y su porción de `cantidad`) — ver `entidades-dominio.md`, sección 7.1 (nota de reparto entre lotes, actualizada).
- [ ] Precio por ítem: Administrador puede modificar el precio (HU-18) y es el único rol que puede **registrar/confirmar** la venta (HU-17.1, nueva tras el feedback del 23/10/2026); Empleado solo arma el carrito y ve el total a `precio_base` (HU-17, corregida), sin ningún endpoint de registro disponible para su rol — validado en el servidor (`requireRole('Administrador')` en el endpoint de registro, no solo oculto en la interfaz). Conservar `precio_base` y precio final aplicado para trazabilidad (HU-18).
- [ ] Validación de `garantía_ofrecida` contra la `garantía_proveedor` del lote (`compra_id`) referenciado, no contra un valor genérico del producto (HU-06, ya definido en Sprint 1 a nivel de modelo; falta la validación en el servicio de Ventas).
- [ ] Ítem a crédito: exigir `cliente_id` (rechazar venta a crédito con cliente casual — criterio de aceptación de HU-10) y sumar su monto al saldo pendiente del ítem.
- [ ] Manejo de stock insuficiente al vender (HU-20): **bloquear** la venta (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3) si la cantidad solicitada de un producto supera el stock disponible (sumando `cantidad_disponible` de los lotes elegibles); validar en el servicio, no solo en la interfaz.
- [ ] Método de pago de la venta (efectivo, tarjeta, transferencia, QR — HU-19).
- [ ] Endpoints REST (`src/main/api/routes/ventas.ts`), protegidos con `requireAuth` (y `requireRole` donde aplique, ej. edición de precio).
- [ ] Reconstruir `VentaScreen.tsx` sobre la API real, en reemplazo de `AppDataContext.tsx`. El flujo visual del prototipo (venta mixta, precio solo editable para Administrador) ya fue validado con el dueño — mantenerlo, pero sobre datos reales y con la vista diferenciada por rol descrita arriba (calculadora para Empleado, flujo completo para Administrador).
- [ ] Comprobante de venta (HU-21): factura común en el MVP, dejando los campos de `tipo_comprobante`/RUC preparados para una futura factura electrónica (ver `desiciones-alcance.md`, sección 6). Definir si se genera como PDF igual que el listado de stock (`pdfkit`, ver Sprint 1) o se deja para el punto de reportes de cierre de sprint.
- [ ] Anulación de venta (mencionada como caso a confirmar en el criterio de aceptación de HU-20): decidir con el equipo si entra en el alcance de este sprint o se pospone; si entra, debe reponer el stock del lote descontado.

## 2. Servicios y Órdenes de Servicio (HU-22 a HU-27, sin HU-25)

- [ ] Servicio de negocio de Órdenes de Servicio (`src/main/services/ordenesServicio.ts`): una Orden con uno o más Servicios de detalle (tipo, monto, `detalle` opcional — HU-22, HU-22.1), vinculada a Vehículo, Cliente y Usuario.
- [ ] `tipo_pago` a nivel de Orden completa, no por Servicio individual (diferencia intencional respecto a Ventas — ver `entidades-dominio.md`, sección 13): si la Orden tiene varios Servicios, no se permite mezclar contado y crédito dentro de la misma Orden (HU-27).
- [ ] Orden a crédito: exigir al menos el nombre del cliente (HU-27; no hace falta el registro completo según el criterio de aceptación), sumar `monto_total` al saldo pendiente del cliente.
- [ ] Cotización previa (HU-24): **no es un estado de la Orden** (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3). Es un cálculo en pantalla (armar la lista de servicios con montos y ver el total estimado), sin persistir nada en la base de datos, igual que la calculadora de Ventas del Empleado (HU-17). La Orden de Servicio recién se registra cuando el trabajo se confirma.
- [ ] Endpoints REST (`src/main/api/routes/ordenesServicio.ts`), protegidos con `requireAuth`.
- [ ] Reconstruir `OrdenServicioScreen.tsx` sobre la API real: quitar `garantiaDias` (HU-25 descartada), agregar `color` del vehículo (HU-22) y `detalle` por servicio (HU-22.1), y resolver la selección de Vehículo (ver punto 4).
- [ ] Historial de servicios por cliente/vehículo (HU-26): listado de Órdenes + Servicios de un Cliente o Vehículo dado, con fecha, detalle y monto de cada uno.

## 3. Vehículos (soporte de HU-22/HU-26/HU-27, sin HU propia)

- [ ] CRUD mínimo de Vehículos (`src/main/services/vehiculos.ts` + rutas): un Cliente puede tener varios Vehículos (marca, chapa, color).
- [ ] En el flujo de carga de una Orden de Servicio, permitir elegir un Vehículo ya cargado del cliente o dar de alta uno nuevo en el mismo formulario — mismo patrón que se usó en Compras para el alta de Producto nuevo (Sprint 1, punto 3), para no interrumpir la carga con una pantalla aparte.
- [ ] Soporte de vehículo de cliente casual (`cliente_id` nulo en Vehículo, ya contemplado en el esquema — ver `entidades-dominio.md`, sección 8).

## 4. Crédito y pagos (HU-10, HU-10.1, HU-10.2, HU-11, HU-12)

La parte de mayor riesgo técnico del sprint, según `plan-gestion-proyecto.md` (sección 7); reservar tiempo extra y no dejarla para el final.

- [ ] Servicio de negocio de Pagos (`src/main/services/pagos.ts`): registrar un pago parcial sobre un Ítem de Venta **o** una Orden de Servicio (nunca ambos — relación excluyente, ver `entidades-dominio.md`, sección 7.2), recalculando `saldo_pendiente` como `monto − suma(pagos)` (no se guarda como columna fija; ver nota de diseño ya presente en `schema.ts`).
- [ ] Pago que supera el saldo pendiente del ítem/orden (HU-10.1): **no se rechaza ni genera saldo a favor** (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3). El servicio de Pagos debe limitar (`clamp`) el `monto` que efectivamente guarda al saldo pendiente exacto del ítem/orden, dejándolo en `saldo_pendiente = 0`; la diferencia entregada de más por el cliente se calcula y muestra en la interfaz como "vuelto" al momento de cobrar, sin persistirse como Pago ni como saldo a favor para operaciones futuras.
- [ ] `fecha_pago_prevista`: valor sugerido por defecto al registrar un ítem/orden a crédito (ej. "hoy + 1 mes"), editable sin bloqueo (HU-10.2); también editable al registrar un pago parcial, para la cuota siguiente.
- [ ] Listado/aviso de créditos vencidos: ítems de venta y órdenes de servicio con `fecha_pago_prevista` anterior a hoy y `saldo_pendiente > 0` (HU-10.2). Definir dónde se muestra (sección de inicio, listado aparte, aviso por cliente — ver `entidades-dominio.md`, sección 12.1, que lo deja abierto).
- [ ] Saldo total de un Cliente (HU-11): suma de `saldo_pendiente` de sus Ítems de Venta y Órdenes de Servicio a crédito, con el detalle de qué items/órdenes lo componen (producto o tipo de servicio, fecha, monto original, saldo individual) — solo los que todavía tienen saldo > 0.
- [ ] Conectar la sección de saldo pendiente de `ClienteScreen.tsx` (hoy muestra un aviso de "sin datos hasta Sprint 2", ver Sprint 1) a estos nuevos endpoints.
- [ ] Comprobante de saldo de cliente para firma (HU-12): PDF con el detalle de deuda, mismo mecanismo que el listado de stock (`pdfkit`, Sprint 1).

## 5. Deuda técnica heredada de Sprint 1, a revisar en este sprint

- [ ] Extender `requireAuth`/`requireRole` a las rutas de Ventas y Órdenes de Servicio desde el inicio (a diferencia de categorías/productos/proveedores/compras en Sprint 1 — ver `sprint-1-backlog.md`, "Deuda técnica registrada"). Acá es especialmente importante tras la corrección del 23/10/2026: no alcanza con validar el precio por rol (HU-18) — el propio endpoint de **registro** de la venta debe exigir rol Administrador (HU-17/HU-17.1), ya que el Empleado no debe poder registrar ninguna venta, ni siquiera a precio base.
- [ ] Decidir si, ya que Ventas/Servicios quedan protegidos, conviene en el mismo sprint emparejar categorías/productos/proveedores/compras con el mismo esquema de autenticación, para no mantener dos convenciones de cliente HTTP (`api`/`request()` sin sesión vs. `apiFetch()` con sesión — ver `app/src/renderer/src/api/client.ts`) más tiempo del necesario.
- [ ] Repetir la validación de persistencia de PGlite en la notebook real del taller, si ya fue adquirida (seguía pendiente al cierre del Sprint 1).

## 6. Feedback de usabilidad (reunión cierre Sprint 1, 23/10/2026)

*Trasladado de `docs/01-analisis/entrevistas/reunion-sprint01--2026-10-23.md` y `desiciones-alcance.md`, sección 8.*

- [ ] Aumentar el tamaño de letra / mejorar la legibilidad general de la interfaz (pedido explícito del dueño). Aplica a toda la app, no solo a las pantallas nuevas de este sprint — si el ajuste se hace a nivel de tokens de diseño (`design/tokens.css`), alcanza automáticamente también a las pantallas ya construidas en Sprint 1 (`StockScreen`, `ClienteScreen`, `ProveedorScreen`, `CategoriaScreen`).
- [ ] En los formularios de alta de Producto y de Compra (Sprint 1, ya construidos), hacer que el cursor arranque posicionado en el primer input, y que la tecla Enter mueva el foco al siguiente input en vez de intentar enviar el formulario. Aplicar el mismo criterio desde el inicio en los formularios nuevos de este sprint (Venta, Orden de Servicio, alta de Vehículo, registro de Pago).
- [ ] Ampliar la impresión del listado de existencias (HU-05, ya implementada en Sprint 1 — `GET /api/productos/listado-pdf`) para que acepte los mismos filtros que ya tiene el listado en pantalla (`categoriaId`, `soloStockBajo`) y los aplique al contenido del PDF, no solo a la vista en pantalla.

## Fuera de este sprint

- HU-28, HU-29 (reportes de ventas y de ganancias) — post-MVP, ver `plan-gestion-proyecto.md`.
- HU-30 (acceso móvil) — post-MVP.
- Integración real con SIFEN — post-MVP (ver `desiciones-alcance.md`, sección 6); el modelo de datos ya contempla los campos necesarios (`tipo_comprobante`, RUC del cliente).
- Upgrade de Electron (deuda técnica registrada en Sprint 1, pendiente de programar aparte).

## Reparto entre los dos integrantes

*A definir por el equipo al planificar el sprint — no se propone un reparto cerrado acá porque, a diferencia del Sprint 1, los puntos de este sprint están más entrelazados entre sí (una Orden de Servicio a crédito y un Ítem de Venta a crédito comparten el mismo mecanismo de Pago, por ejemplo) y conviene decidirlo en la reunión de Sprint Planning, no de antemano.* Como referencia de las dependencias entre puntos:

- El punto 4 (Crédito y pagos) depende de que los puntos 1 y 2 ya generen Ítems de Venta y Órdenes de Servicio reales (no puede probarse de forma aislada).
- El punto 3 (Vehículos) es un prerrequisito chico del punto 2, conviene resolverlo primero o en paralelo.
- Si se reparte por persona como en Sprint 1 (una persona por frente), tiene sentido agrupar punto 1 (Ventas) con una mitad del punto 4 (pagos sobre Ítems de Venta), y puntos 2+3 (Servicios/Vehículos) con la otra mitad del punto 4 (pagos sobre Órdenes de Servicio) — ya que `pagos.ts` es un servicio compartido, conviene acordar su contrato (firma de funciones, forma de la respuesta) entre ambos integrantes antes de dividir el trabajo, para no tener que reconciliar dos implementaciones distintas del mismo servicio.

## Definición de Hecho

Se aplica la misma definida en `plan-gestion-proyecto.md`, sección 5: criterios de aceptación cumplidos, revisión cruzada del otro integrante, sin romper funcionalidad previa, integrado a la rama de desarrollo.

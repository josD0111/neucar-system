# Tareas técnicas — Ventas, Crédito y Pagos, Deuda técnica

*Desglose personal de `sprint-2-backlog.md` (puntos 1, 4 y 5), ordenado por dependencias reales en vez de por los puntos originales del backlog. Elaborado el 24/10/2026, tras acordar con el compañero el reparto: esta persona se encarga de Ventas, Crédito y pagos, y Deuda técnica; el compañero de Servicios/Órdenes de Servicio y Vehículos.*

## Antes de empezar: coordinar con el compañero

Estos cuatro puntos no se pueden resolver en soledad, aunque las tareas de código caigan de este lado del reparto:

- [ ] Acordar el contrato de `pagos.ts` (firma de funciones, forma de la respuesta `{ok,data}`/`{ok,error}`, cómo se expone `saldo_pendiente`) **aunque lo implemente una sola persona** — el compañero lo necesita para integrarlo desde `ordenesServicio.ts` y `OrdenServicioScreen.tsx`.
- [ ] Fijar un punto de sincronización explícito: cuándo van a estar `ordenesServicio.ts`/`servicios.ts` del compañero lo bastante avanzados como para poder empezar la mitad de Pagos sobre Órdenes de Servicio (Fase 4 más abajo).
- [ ] Decidir juntos (punto 5 del backlog) si se extiende el mismo esquema de autenticación a categorías/productos/proveedores/compras en este sprint, o se deja para después.
- [x] Cerrar juntos la pregunta todavía abierta sobre anulación de venta — si entra en el alcance de este sprint (ver `desiciones-alcance.md`, sección 7.2). → Decidido 24/10/2026: **fuera del MVP** (ver sección 7.4).

## Fase 1 — Ventas (autosuficiente, no depende del compañero)

1. [x] `src/main/services/ventas.ts` — servicio de negocio:
   - Registrar una Venta con uno o más Ítems de Venta.
   - Cada ítem con su propio `tipo_pago` (Contado/Crédito).
   - `compra_id` obligatorio por ítem, elegido manualmente (selección de lote, no FIFO — ver `entidades-dominio.md`, sección 14).
   - Si la venta de un producto se reparte entre varios lotes, eso se resuelve como varios Ítems de Venta separados (no automático).
   - Validar `cantidad` contra `cantidad_disponible` del lote elegido → **bloquear** si no alcanza (HU-20).
   - Descontar `cantidad_disponible` del lote y `stock` agregado del producto, en una transacción.
2. [x] Precio por ítem: Administrador puede modificarlo (HU-18), conservando `precio_base` y precio final aplicado para trazabilidad.
3. [x] Validar `garantía_ofrecida` contra la `garantía_proveedor` del lote (`compra_id`) referenciado, no contra el producto.
4. [x] Ítem a crédito: exigir `cliente_id` (rechazar crédito con cliente casual).
5. [x] `fecha_pago_prevista`: valor sugerido por defecto (ej. hoy + 1 mes) al crear un ítem a crédito, editable sin bloquear.
6. [x] Método de pago de la venta (efectivo, tarjeta, transferencia, QR).
7. [x] `src/main/api/routes/ventas.ts` — endpoints REST:
   - `requireAuth` en todos los endpoints.
   - `requireRole('Administrador')` en el endpoint de registro/confirmación de venta (HU-17.1) — el Empleado no debe poder registrarla ni manipulando el formulario/API.
   - `requireRole('Administrador')` también donde se edite el precio (HU-18).
8. [ ] Comprobante de venta (HU-21): factura común, dejando `tipo_comprobante`/RUC preparados para factura electrónica futura. **Diferido**: según lo acordado el 24/10/2026, se hace después de tener las bases del módulo (servicio + endpoint + pantalla) terminadas — ver sección 7.4. No bloquea el resto de las fases.

## Fase 2 — `VentaScreen.tsx`

9. [x] Reconstruir la pantalla sobre la API real, en reemplazo de `AppDataContext.tsx`.
10. [x] Vista diferenciada por rol:
    - **Empleado:** "calculadora" — arma el carrito, ve el total a precio base, sin acción de confirmar (HU-17).
    - **Administrador:** flujo completo — carrito + descuento + selección manual de lote + confirmar (HU-17.1).
11. [x] Selector de lote al cargar un ítem: mostrar las Compras disponibles del producto (`cantidad_disponible`, `garantía_proveedor`) para elegir `compra_id`.
12. [x] Aplicar el feedback de usabilidad del dueño (ver `sprint-2-backlog.md`, punto 6): foco inicial en el primer input, Enter mueve al siguiente campo.

*Nota 25/10/2026: también se corrigió un bug de layout no relacionado a estas tareas (recorte visual de `VentaScreen.tsx` por CSS heredado de la plantilla de electron-vite en `assets/main.css`), detectado al probar la pantalla recién construida.*

*Revisión de UX 26-27/10/2026 (feedback directo probando la pantalla ya funcionando): se separó "elegir y configurar un producto" de "lo ya agregado al detalle" — ahora hay un panel propio "Agregar producto" con buscador (antes se editaba todo directamente en una fila de una tabla ancha). El detalle de la venta pasó de ser una tabla de hasta 8 columnas con scroll horizontal a una lista de tarjetas apiladas, visibles sin scroll. El carrito ya no arranca con una línea precargada por defecto. El buscador de Cliente también se cambió de un `<select>` simple a un combo con buscador (mismo patrón que `SelectorBuscable` de `StockScreen.tsx`, sin la parte de alta rápida).*

## Fase 3 — Pagos sobre Ítems de Venta (ya se puede probar con la Fase 1 propia)

13. [x] `src/main/services/pagos.ts` — registrar pago sobre un Ítem de Venta:
    - Exclusión mutua: un Pago referencia `item_venta_id` **o** `orden_servicio_id`, nunca ambos. (La parte de `orden_servicio_id` se usa recién en la Fase 5; el servicio ya respeta la exclusión al insertar siempre con `ordenServicioId` nulo.)
    - Recalcular `saldo_pendiente = monto_item − suma(pagos)` (no se guarda como columna fija) → `calcularSaldoPendienteItem()`.
    - Pago que excede el saldo pendiente: **no se rechaza**; el `monto` que se guarda se limita (`clamp`) al saldo pendiente exacto, dejándolo en 0. El excedente entregado por el cliente es "vuelto", calculado y mostrado en pantalla, sin persistirse.
    - Permitir actualizar `fecha_pago_prevista` al registrar el pago, para la cuota siguiente.
14. [x] `src/main/api/routes/pagos.ts`, montado en `/api/pagos` (no anidado bajo `ventas.ts`, para poder sumarle después `/api/pagos/orden/:id` en la Fase 5 sin mezclarlo con las rutas de Venta): `GET /api/pagos/item/:itemVentaId` y `POST /api/pagos/item/:itemVentaId`. `requireAuth`.
15. [x] Cerrar y documentar la nota de diseño pendiente de `entidades-dominio.md` (sección 7.2): ¿una venta Contado genera automáticamente un Pago por el monto total, o se considera "pagada" sin registro en Pago? → **Resuelto 25/10/2026: sí, se genera automáticamente** (ver `entidades-dominio.md` sección 7.2 y `desiciones-alcance.md` sección 7.5), para que `saldo_pendiente` use una única fórmula en Contado y Crédito.

*Pendiente de esta fase (no bloquea el resto): todavía no hay pantalla para cobrar una cuota ni para ver el historial de pagos de un ítem — no estaba en el alcance original de esta fase (la Fase 2 solo cubría el armado/registro de la venta) y no lo pidió el dueño todavía. Se puede probar por ahora solo contra la API.*

## Fase 4 — Punto de sincronización con el compañero

16. [ ] Esperar a que `ordenesServicio.ts`/`servicios.ts` del compañero estén mínimamente funcionando (no hace falta que la pantalla esté pulida, alcanza con el servicio + endpoint).
17. [ ] Revisar en conjunto si el contrato de `pagos.ts` acordado al principio sigue siendo válido tal como quedó construido Órdenes de Servicio, y ajustar si hace falta.

## Fase 5 — Pagos sobre Órdenes de Servicio

18. [ ] Extender `pagos.ts` para registrar pago sobre una Orden de Servicio completa (el crédito es sobre el total de la visita, no por Servicio individual — ver `entidades-dominio.md`, sección 13).
19. [ ] Mismo criterio de "sin saldo a favor" (clamp al saldo pendiente) y de `fecha_pago_prevista` que en Fase 3.
20. [ ] Endpoint correspondiente, `requireAuth`.

## Fase 6 — Crédito a nivel de Cliente (HU-11, HU-10.2, HU-12)

21. [ ] Saldo total de un Cliente: suma de `saldo_pendiente` de sus Ítems de Venta y Órdenes de Servicio a crédito, con el detalle de qué lo compone (producto/tipo de servicio, fecha, monto original, saldo individual) — solo los que tienen saldo > 0.
22. [ ] Listado/aviso de créditos vencidos: ítems y órdenes con `fecha_pago_prevista` anterior a hoy y `saldo_pendiente > 0`. Definir dónde se muestra (sección de inicio, listado aparte, o aviso por cliente — ver `entidades-dominio.md`, sección 12.1).
23. [ ] Conectar la sección de saldo pendiente de `ClienteScreen.tsx` (hoy muestra "sin datos hasta Sprint 2") a estos endpoints.
24. [ ] Comprobante de saldo de cliente para firma (HU-12): PDF con el detalle de deuda, mismo mecanismo que el listado de stock (`pdfkit`).

## Fase 7 — Deuda técnica (coordinada, no en paralelo)

25. [ ] Confirmar que `requireAuth`/`requireRole` quedó aplicado tanto en Ventas (Fase 1, propio) como en Órdenes de Servicio (del compañero) — revisarlo juntos antes de cerrar el sprint.
26. [ ] Decidir junto al compañero si categorías/productos/proveedores/compras pasan al mismo esquema de autenticación en este sprint, para no mantener dos convenciones de cliente HTTP (`api`/`request()` sin sesión vs. `apiFetch()` con sesión) más tiempo del necesario.
27. [ ] Repetir la validación de persistencia de PGlite en la notebook real del taller, si ya fue adquirida.

---

## Notas sobre el orden

- Las Fases 1 a 3 son autosuficientes: se pueden programar y probar de punta a punta sin esperar nada del compañero. Conviene arrancar por ahí para no perder tiempo muerto.
- La Fase 4 es un punto de corte real, no una formalidad: sin avanzar ahí, la Fase 5 no se puede ni empezar a programar en serio (el modelo de Pago depende de que exista una Orden de Servicio real para referenciar).
- La Fase 6 depende de que existan Fases 3 y 5 (no puede calcularse saldo de cliente sin Pagos funcionando de los dos lados).
- La Fase 7 está al final a propósito: dos de sus tres tareas no se pueden cerrar unilateralmente, aunque figuren bajo este reparto.

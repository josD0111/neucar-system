# Historias de Usuario

*Elaboradas a partir de la entrevista al dueño del taller (30/06/2026) y del documento `desiciones-alcance.md`. Actualizadas con los hallazgos de la entrevista del 10/09/2026 (HU-10.2, HU-22.1 agregadas; HU-25 descartada; HU-26, HU-27 ajustadas), con las decisiones del equipo del 12/10/2026 (HU-01.1 agregada; HU-08 reclasificada de post-MVP a MVP) y con el feedback del dueño al cierre del Sprint 1 (23/10/2026 — ver `docs/01-analisis/entrevistas/reunion-sprint01--2026-10-23.md` y `desiciones-alcance.md`, sección 8): HU-17 corregida y HU-17.1 agregada (el Empleado ya no registra la venta, solo la calcula), y adenda a HU-05 (filtro en la impresión de existencias).
Actualizadas también al cierre del Sprint 2 (20/11/2026), en una revisión de consistencia entre esta documentación y el código real: se agregó HU-22.2 (catálogo de tipos de servicio, implementado durante el sprint sin historia previa) y se corrigió el criterio de aceptación de HU-20 sobre anulación de venta, que seguía redactado como pregunta abierta pese a estar ya resuelto (ver `desiciones-alcance.md`, sección 7.4).
El mismo día, tras presentarle al dueño el trabajo del Sprint 2, se agregaron HU-36 a HU-41 (ver sección 6) a partir de su feedback (`docs/01-analisis/entrevistas/reunion-sprint02--2026-11-20.md`): restricción de lectura del rol Empleado, marcas de producto, compras en sección separada, pago inicial obligatorio en crédito, rediseño del flujo de Ventas y kilometraje/próximo mantenimiento — estas dos últimas y el pago inicial con detalles todavía pendientes de confirmar (ver `desiciones-alcance.md`, sección 7.6).

Actualizadas nuevamente el 22/11/2026, al planificar la implementación de HU-40 a partir de un prototipo HTML armado por el equipo: se completaron los criterios de aceptación de HU-40 (antes vacíos) y se cambió el alcance de HU-10 — el crédito pasa a definirse **por venta completa**, no por ítem — con el ajuste correspondiente en HU-10.1, HU-10.2, HU-11 y HU-39. Ver la nota de cambio de alcance en HU-10 para el detalle y la justificación.

Actualizadas una vez más el 26/11/2026, al cierre del Sprint 3 (`docs/01-analisis/reuniones/reunion-sprint03--2026-11-26.md`): se actualizó el criterio de lote de HU-40 (reparto automático editable entre lotes, el dueño descartó la selección manual), se reescribió HU-41 (kilometraje) con la regla que el dueño precisó (intervalo por vehículo, carga manual del Administrador, no cálculo automático — reemplaza el modelo que el equipo había implementado sin confirmar), se agregó HU-42 (historial de servicios por vehículo, buscable por chapa o cliente) y se dejó una nota sobre una posible mención del dueño de un precio de venta a crédito distinto (amplía HU-01, sin confirmar todavía).

Roles considerados: **Administrador** (dueño / esposa) y **Empleado** (Rey).

## 1. Productos y stock

**HU-01**
> Como Administrador, quiero registrar productos con su categoría, marca, precio y stock inicial, para poder gestionar el inventario del taller.

**Adenda 20/11/2026** *(feedback del dueño al cierre del Sprint 2 — no es una historia nueva, amplía HU-01; ver HU-37/HU-37.1 para la gestión del catálogo de marcas)*
> El campo marca se agregó tras pedido del dueño. Queda como pregunta abierta si es obligatorio para todo producto o puede quedar sin marca — ver `desiciones-alcance.md`, sección 7.6.

**Nota 26/11/2026** *(mención del dueño al cierre del Sprint 3, no es un pedido formal — no amplía los criterios de aceptación todavía)*
> El dueño mencionó que el sistema anterior tenía un precio de venta a crédito distinto del precio de contado. No pidió este campo para Neucar explícitamente; queda como pregunta abierta a confirmar en una próxima reunión — ver `desiciones-alcance.md`, sección 7.6.

**HU-01.1** *(agregada 12/10/2026)*
> Como Administrador, quiero crear, editar y eliminar las categorías de producto, para organizar y filtrar el catálogo según las necesidades del taller.

**Criterios de aceptación:**
- El conjunto de categorías no es una lista fija del sistema: el Administrador puede crear, renombrar o eliminar categorías en cualquier momento.
- El objetivo principal de la categoría es habilitar el filtrado de productos (ver HU-02); no se le exige ninguna otra regla de negocio.

**HU-02**
> Como Administrador o Empleado, quiero buscar productos por tipo (neumáticos, baterías, lubricantes, filtros, etc.), para encontrar rápidamente lo que el cliente necesita.

**HU-03**
> Como Administrador o Empleado, quiero consultar el precio y stock disponible de un producto, para informar al cliente sin necesidad de revisar el depósito físicamente.

**HU-04**
> Como Administrador, quiero ver únicamente los productos que están en existencia, para no perder tiempo revisando productos agotados.

**HU-05**
> Como Administrador, quiero imprimir el listado de existencias, para verificar físicamente el stock en el depósito.

**Adenda 23/10/2026** *(feedback del dueño al cierre del Sprint 1 — no es una historia nueva, amplía HU-05)*
> Al imprimir el listado, quiero poder filtrar qué productos se incluyen, ya sea por una categoría puntual o mostrando solo los que tienen stock bajo, para no tener que revisar/tachar productos que no necesito en esa impresión.

**Criterio de aceptación agregado:**
- El listado en pantalla ya admite filtrar por categoría (`categoriaId`) y por stock bajo (`soloStockBajo`) desde Sprint 1. La generación del PDF (`GET /api/productos/listado-pdf`) debe aceptar los mismos filtros y aplicarlos al contenido impreso, no solo al listado en pantalla.

**HU-06**
> Como Administrador, quiero registrar la garantía de un producto (por ejemplo, la fecha de garantía del proveedor para baterías), para poder calcular la garantía que ofrezco al cliente al momento de la venta.

**Criterios de aceptación:**
- Dado que registro la compra de un producto con garantía (ej. una batería), cuando ingreso la fecha de compra y los meses de garantía otorgados por el proveedor, entonces el sistema calcula y guarda la fecha de vencimiento de la garantía del proveedor.
- Dado un producto con stock proveniente de más de una Compra (lote), con distinta `garantía_proveedor` cada una, cuando se vende una unidad, entonces la garantía que se le puede ofrecer al cliente se valida contra la `garantía_proveedor` del lote (Compra) específico del cual salió esa unidad — no contra un valor genérico del Producto (ver `entidades-dominio.md`, sección 14).
- Dado un producto con garantía de proveedor registrada, cuando lo vendo a un cliente, entonces el sistema debe permitirme definir la garantía que le ofrezco a ese cliente, sin superar la garantía restante del proveedor del lote correspondiente a la fecha de venta.
- El dueño confirmó (entrevista 10/09/2026) que no aplica una regla fija de margen (ej. "12-13 meses si el proveedor da 18") para todos los productos, sino que lo calcula caso a caso — ver `desiciones-alcance.md`, sección 7.1. Por lo tanto, el sistema debe permitir ingresar la garantía ofrecida al cliente de forma **manual**, sin calcularla automáticamente; esto ya no es una limitación temporal del MVP, sino el comportamiento definitivo esperado.
- Dado un producto sin garantía aplicable (ej. un filtro), cuando lo registro, entonces el campo de garantía debe poder quedar vacío u omitido, sin bloquear el registro del producto.

**HU-07**
> Como Administrador, quiero ver el historial de compra y venta de un producto, incluyendo proveedor, fecha, estado y cliente (si fue vendido), para saber si el producto tiene una salida rentable.

**HU-08** *(incorporada al MVP el 12/10/2026 — originalmente post-MVP)*
> Como Administrador, quiero recibir una notificación cuando un producto esté por debajo de un stock mínimo definido, para reponerlo a tiempo.

**Criterios de aceptación:**
- El Administrador puede definir un `stock_mínimo` por producto (campo opcional).
- Un producto con `stock` por debajo de su `stock_mínimo` definido aparece en un listado/aviso visible para el Administrador, de forma análoga al listado de créditos vencidos (ver HU-10.2).
- Un producto sin `stock_mínimo` definido no genera ninguna notificación.

## 2. Clientes

**HU-09**
> Como Administrador o Empleado, quiero registrar los datos de un cliente (nombre, cédula, celular, RUC), para poder identificarlo en futuras compras o servicios.

**HU-10** *(alcance cambiado 22/11/2026 — ver nota de cambio más abajo)*
> Como Administrador, quiero registrar una venta completa a crédito, para llevar el control de lo que me debe el cliente por esa operación.

**Criterios de aceptación:**
- Dado que registro una venta con uno o más productos, cuando indico la forma de pago, entonces el sistema me permite definirla **una sola vez, para la venta completa** (Contado o Crédito) — no existe forma de marcar unos productos de una misma venta al contado y otros a crédito.
- Dado una venta marcada como "a crédito", cuando la guardo, entonces el sistema exige asociarla a un cliente registrado (no permite ventas a crédito a cliente "casual" no registrado).
- Dado una venta a crédito, cuando se guarda, entonces el sistema incrementa el saldo pendiente del cliente en el monto total de esa venta.
- El crédito queda como saldo abierto hasta que se registren pagos suficientes (sin vencimiento duro). La fecha en la que se espera el próximo pago se maneja como un campo aparte (`fecha_pago_prevista`, sugerido por defecto y editable, sin bloquear la operación) — ver HU-10.2, que resuelve lo que acá quedaba como pregunta abierta.
- Dado un empleado (rol Empleado) que intenta registrar una venta a crédito, cuando lo hace, entonces el sistema le permite hacerlo al precio base (sin descuento), ya que la restricción del rol Empleado es sobre descuentos, no sobre la forma de pago.

**Nota de cambio de alcance (22/11/2026):** la redacción original de esta historia (30/06/2026) definía la forma de pago **por cada ítem de la venta**, permitiendo mezclar en una misma venta productos al contado y a crédito. Al planificar la implementación del nuevo flujo de Ventas (Sprint 3, HU-40, a partir de un prototipo del equipo), se decidió simplificarlo a **crédito por venta completa**, igual que ya funciona en Órdenes de Servicio (HU-27, que ya trataba el crédito sobre el total de la visita, no por servicio individual) — así Ventas y Servicios quedan consistentes entre sí. Es una decisión del equipo, no un pedido explícito del dueño; conviene confirmarle que ya no podrá cargar una venta mixta (algunos productos al contado, otros a crédito) en una sola operación — si en la práctica eso le hace falta, tendría que registrar dos ventas separadas. Impacta el modelo de datos: `tipo_pago` y `fecha_pago_prevista` se mueven de Ítem de Venta a Venta (ver `entidades-dominio.md`, secciones 7 y 7.1, y `sprint-3-backlog.md`, punto 1).

**Adenda 20/11/2026** *(feedback del dueño al cierre del Sprint 2 — no es una historia nueva, amplía HU-10; ver HU-39 más abajo)*
> El taller no da crédito sin cobrar antes un pago inicial. Toda venta (o, en Órdenes de Servicio, toda la visita) registrada a crédito debe llevar un pago inicial mayor a cero al momento de la venta. Ver HU-39.

**HU-10.1** *(ajustada 22/11/2026 — ver nota de cambio de alcance en HU-10)*
> Como Administrador, quiero registrar un pago (cuota) sobre una venta o una orden de servicio a crédito, para reflejar lo que el cliente va abonando y actualizar su saldo pendiente.

**Criterios de aceptación:**
- Dado una venta (o una orden de servicio) a crédito con saldo pendiente mayor a cero, cuando registro un pago por un monto menor o igual al saldo, entonces el sistema resta ese monto del saldo pendiente de esa venta/orden específica, sin afectar el saldo de otras ventas u órdenes del mismo cliente.
- Dado una venta a crédito, cuando la suma de sus pagos registrados iguala su monto total, entonces el sistema la considera saldada (saldo pendiente = 0) y deja de contarla en el saldo total del cliente.
- Dado que un cliente tiene dos ventas a crédito distintas, cuando paga por completo una de ellas, entonces la otra conserva su saldo pendiente sin modificaciones, y sus futuros pagos se siguen registrando de forma independiente. *(Antes del cambio de alcance del 22/11/2026, esta independencia se garantizaba entre ítems de una misma venta; ahora se garantiza entre ventas distintas, ya que la venta completa es la unidad de crédito.)*
- Dado un intento de registrar un pago por un monto mayor al saldo pendiente de la venta/orden, el sistema **no rechaza la operación ni genera saldo a favor** (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3): el `monto` del Pago que se guarda queda limitado al saldo pendiente exacto, dejando la venta/orden en `saldo_pendiente = 0`. Si el cliente entrega un monto mayor, la diferencia se calcula y muestra en pantalla como "vuelto" al momento de cobrar, pero no se persiste.

**HU-11** *(ajustada 22/11/2026 — ver nota de cambio de alcance en HU-10)*
> Como Administrador, quiero ver el saldo pendiente de un cliente y el detalle de qué ventas o servicios específicos lo componen (con su saldo individual y los productos/servicios que incluyen), para gestionar los cobros.

**Criterios de aceptación:**
- Dado un cliente con una o más ventas y/o órdenes de servicio a crédito, cuando consulto su ficha, entonces el sistema muestra el saldo total pendiente y el detalle de cada venta/orden que lo compone (fecha, monto total y saldo pendiente de esa venta/orden), pudiendo ver también los productos o servicios que incluyó.
- Dado un cliente con una venta ya saldada (pagos = monto total) y otra con saldo pendiente, cuando consulto su ficha, entonces el sistema solo muestra en el detalle de deuda la venta que todavía tiene saldo pendiente.
- Dado un cliente sin deudas pendientes, cuando consulto su ficha, entonces el sistema indica saldo cero, sin mostrar operaciones ya saldadas como pendientes.
- *(Nota 22/11/2026: antes del cambio de alcance de HU-10, el saldo individual era por producto dentro de una venta; ahora es por venta completa. Esto ya no aplica — una venta no puede tener productos mixtos contado/crédito, así que no hay ambigüedad posible dentro de una misma venta.)*

**HU-10.2** *(agregada tras entrevista 10/09/2026; ajustada 22/11/2026 — ver nota de cambio de alcance en HU-10)*
> Como Administrador, quiero registrar la fecha en la que el cliente debería venir a pagar su próxima cuota de una venta o una orden de servicio a crédito, y ver un listado de las que ya pasaron esa fecha sin pagarse, para poder hacer seguimiento de la mora.

**Criterios de aceptación:**
- Dado una venta o una orden de servicio marcadas como Crédito, cuando se registra o se abona, entonces el sistema permite indicar/actualizar una `fecha_pago_prevista` para la próxima cuota.
- Dado que el dueño no tiene una fecha límite fija (créditos de hasta 2 meses, normalmente divididos en 2 cuotas), el sistema debe proponer una fecha por defecto (ej. a 1 mes) pero permitir modificarla libremente, sin bloquear ni rechazar fechas más lejanas.
- Dado una venta/orden a crédito con `fecha_pago_prevista` anterior a hoy y `saldo_pendiente > 0`, el sistema debe mostrarla en un listado/aviso de créditos vencidos, visible para el Administrador.
- Dado una venta/orden ya saldada, no debe aparecer en el listado de créditos vencidos aunque su `fecha_pago_prevista` haya pasado.

**HU-12**
> Como Administrador, quiero imprimir el comprobante de saldo de un cliente, para que lo firme como respaldo de la deuda.

**HU-13**
> Como Administrador, quiero atender a un cliente "casual" sin necesidad de registrarlo formalmente, para no complicar operaciones simples y esporádicas.

## 3. Proveedores

**HU-14**
> Como Administrador, quiero registrar proveedores y asociarlos a los productos que me venden, para saber a quién le compré cada producto.

**HU-15**
> Como Administrador, quiero registrar el precio de compra y la garantía ofrecida por el proveedor en cada compra, para calcular correctamente la garantía que doy al cliente y mi margen.

**HU-16**
> Como Administrador, quiero asociar una compra a la factura correspondiente, para tener respaldo documental de cada operación con proveedores.

**Adenda 20/11/2026** *(feedback del dueño al cierre del Sprint 2 — no es una historia nueva, amplía HU-14/HU-15/HU-16; ver HU-38 más abajo)*
> Las compras deben gestionarse en una pantalla propia, separada de Control de Stock, con su propio historial en una pantalla aparte — no mezcladas con la gestión de Productos como hasta ahora, ni el historial mezclado con el formulario de alta (ajuste 21/11/2026, ver criterios de HU-38).

## 4. Ventas de productos

**HU-17** *(corregida 23/10/2026 — ver `desiciones-alcance.md`, sección 8.4)*
> Como Empleado, quiero calcular el precio total de una posible venta a precio base (sin descuentos), para informar al cliente mientras espero a que el Administrador la registre.

**Criterios de aceptación:**
- Dado que un usuario con rol Empleado abre la sección de Ventas, cuando arma un carrito con uno o más productos y cantidades, entonces el sistema calcula y muestra el total a precio base, sin ningún campo para modificar el precio.
- Dado un carrito armado por un Empleado, el sistema no ofrece ninguna acción para confirmar/registrar la venta: esa acción solo está disponible para el rol Administrador (ver HU-17.1).
- Dado que un Empleado intenta registrar una venta de forma directa (por ejemplo, manipulando el formulario o llamando a la API), cuando el sistema procesa la petición, entonces la rechaza, ya que el endpoint de registro de venta exige rol Administrador — no alcanza con ocultar el botón de confirmar en la interfaz.
- **Nota de corrección:** la versión original de esta historia (30/06/2026) asumía que el Empleado también registraba la venta completa al precio base, sin intervención del dueño. El dueño aclaró, al cierre del Sprint 1 (23/10/2026), que la sección de Ventas debe ser simple y que el Empleado la usa solo para calcular/informar — el registro final siempre lo hace el Administrador.

**HU-17.1** *(nueva, 23/10/2026 — completa el flujo de HU-17)*
> Como Administrador, quiero registrar la venta (armada por mí o calculada previamente por un Empleado), para confirmarla, descontar el stock correspondiente y generar el comprobante.

**Criterios de aceptación:**
- Dado un carrito de venta con uno o más productos (armado por un Empleado como calculadora, o directamente por el Administrador), cuando el Administrador lo confirma, entonces el sistema registra la Venta, descuenta el stock de los lotes correspondientes (ver HU-20) y queda disponible para emitir el comprobante (ver HU-21).
- El endpoint de registro de venta exige rol Administrador (`requireRole('Administrador')`); un Empleado no puede invocarlo aunque conozca su URL/forma.
- Esta historia no reemplaza a HU-18 (aplicar descuento): el Administrador puede registrar la venta al precio base tal cual la calculó el Empleado, o modificar el precio antes de confirmar.

**HU-18**
> Como Administrador, quiero aplicar un descuento sobre el precio de un producto al registrar una venta, para poder negociar con el cliente cuando lo considere conveniente.

**Criterios de aceptación:**
- Dado que un usuario con rol Administrador registra una venta, cuando ingresa el/los producto(s), entonces el sistema le permite modificar el precio de venta (monto o porcentaje de descuento) respecto al precio base.
- Dado que un usuario con rol Empleado intenta acceder a la opción de aplicar descuento, cuando lo intenta, entonces el sistema no muestra dicha opción o la bloquea explícitamente.
- Dado un descuento aplicado a una venta, cuando se guarda la operación, entonces el sistema conserva registrado tanto el precio base como el precio final con descuento, para mantener trazabilidad de la operación.

**HU-19**
> Como Administrador o Empleado, quiero registrar el método de pago de una venta (efectivo, tarjeta, transferencia o QR), para llevar el control de cómo se cobró cada operación.

**HU-20**
> Como Administrador, quiero que al registrar una venta se descuente automáticamente el stock del producto, para mantener el inventario actualizado sin pasos manuales adicionales.

**Criterios de aceptación:**
- Dado un producto con stock disponible, cuando se confirma una venta que lo incluye, entonces el sistema descuenta automáticamente la cantidad vendida del stock, sin requerir una acción manual adicional del usuario.
- Dado un producto sin stock suficiente para cubrir la cantidad solicitada, cuando se intenta registrar la venta, entonces el sistema **bloquea** la operación (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3): no se permite confirmar una venta cuya cantidad supere el stock disponible.
- Dado que un Empleado no tiene permiso para "descontar mercaderías" manualmente (según la entrevista), cuando registra una venta normal, entonces el descuento automático de stock por venta sí debe ocurrir igual, ya que la restricción del Empleado aplica a ajustes manuales de inventario, no al descuento derivado de una venta legítima.
- La anulación de una venta ya confirmada **queda fuera del alcance de este MVP** (decisión del equipo, 24/10/2026 — ver `desiciones-alcance.md`, sección 7.4): no existe endpoint de anulación ni reposición automática de stock. Si se carga una venta por error, no hay forma de revertirla desde el sistema por ahora.

**HU-21**
> Como Administrador, quiero emitir un comprobante de venta (factura común, y en el futuro electrónica), para respaldar la operación ante el cliente.

**Adenda 20/11/2026** *(feedback del dueño al cierre del Sprint 2 — no es una historia nueva, amplía HU-17/HU-17.1/HU-18; ver HU-40 más abajo)*
> El dueño pidió un flujo de carga distinto al actual, similar al de un sistema que ya usa: buscar el producto directamente, verlo en una tabla de ítems de la venta, y al seleccionar una fila de esa tabla editar sus datos en una sección aparte (con una sección separada para los datos del cliente cuando la venta es a crédito). Esto no cambia las reglas de negocio ya definidas (HU-17, HU-17.1, HU-18, HU-20), solo el flujo de pantalla sobre el que se cargan.

## 5. Servicios

**HU-22**
> Como Administrador o Empleado, quiero registrar un servicio realizado a un vehículo (tipo de servicio, fecha, marca, número de chapa, color y monto), para llevar un registro ordenado de lo que antes se anotaba en el cuaderno.

**HU-22.1** *(agregada tras entrevista 10/09/2026)*
> Como Administrador, quiero registrar opcionalmente un detalle de la parte afectada en un servicio (ej. cantidad de ruedas en una alineación o balanceo), para tener más información disponible sobre lo realizado.

**Criterios de aceptación:**
- Dado un servicio dentro de una orden, el campo de detalle es opcional y de texto libre, sin estructura obligatoria por tipo de servicio.
- Dado que no está confirmado en qué tipos de servicio aplica este campo (ver `entidades-dominio.md`, sección 9.1), el sistema no debe exigirlo ni validarlo de forma distinta según el tipo de servicio hasta que se confirme con el dueño.

**HU-22.2** *(agregada 20/11/2026, a partir de una decisión tomada durante la implementación del Sprint 2, sin pasar antes por una historia de usuario explícita — ver nota de actualización de documentación al cierre del sprint)*
> Como Administrador, quiero mantener un catálogo de tipos de servicio con un precio de referencia, para no tener que escribir a mano el monto de cada tarea habitual (alineación, balanceo, etc.) y poder decidir cuándo se aplica un descuento sobre ese precio.

**Criterios de aceptación:**
- El Administrador puede crear, editar y deshabilitar tipos de servicio (nombre, precio de referencia opcional, si requiere indicar cantidad de ruedas). Igual que con Categoría y con cliente, un tipo de servicio **nunca se borra**: se deshabilita (`activo = false`) para no romper las Órdenes de Servicio que ya lo usaron.
- Cualquier usuario (Administrador o Empleado) puede ver y elegir los tipos de servicio activos al cargar un Servicio dentro de una Orden; ver los tipos deshabilitados es solo del Administrador.
- Si un tipo de servicio tiene precio de referencia y requiere cantidad de ruedas, el precio que se calcula por defecto es `precio_referencia × cantidad_ruedas` (ej. balanceo con precio por rueda).
- Dado que se carga un Servicio con un tipo que tiene precio de referencia, cuando el monto indicado difiere de ese precio de referencia (un descuento), entonces el sistema solo permite guardarlo si quien registra la Orden tiene rol Administrador — mismo criterio que HU-18 para Ventas, pero aplicado a Servicios. Si el tipo de servicio no tiene precio de referencia cargado, el monto queda libre para cualquier rol.
- Cada Servicio guardado conserva una copia (snapshot) del precio de referencia vigente al momento de la orden, para que un cambio posterior en el catálogo no altere órdenes ya registradas.

**HU-23**
> Como Administrador, quiero registrar varios servicios solicitados por un mismo cliente para un mismo vehículo en una sola orden, para reflejar cómo se atiende realmente al cliente.

**HU-24**
> Como Administrador, quiero informar el costo estimado de un servicio antes de realizarlo, para que el cliente lo conozca de antemano.

**Criterio de aceptación agregado (decisión del equipo, 23/10/2026 — ver `desiciones-alcance.md`, sección 7.3):**
- La cotización **no es un estado persistido de la Orden de Servicio** (no existe un estado "Cotizada" en el modelo). Es un cálculo en pantalla: el Administrador arma la lista de servicios con sus montos y ve el total estimado, de forma similar a la calculadora de Ventas del Empleado (HU-17), sin que se cree ningún registro en la base de datos hasta que el trabajo se confirma y se registra la Orden de Servicio real.

**HU-25** *(descartada — ver nota)*
> ~~Como Administrador, quiero registrar opcionalmente una garantía (en días) sobre el trabajo completo realizado en una visita, para poder verificarla si el cliente vuelve por un reclamo.~~

> **Descartada tras entrevista 10/09/2026:** el dueño indicó explícitamente que no es necesario registrar la garantía de los servicios ofrecidos. Se mantiene el número HU-25 para no romper la numeración/trazabilidad, pero esta historia ya no forma parte del alcance (ver `entidades-dominio.md`, sección 9, y `desiciones-alcance.md`).

**HU-26** *(actualizada tras entrevista 10/09/2026)*
> Como Administrador, quiero consultar el historial de servicios de un cliente o vehículo (por ejemplo, alineaciones realizadas y sus fechas, con el detalle y monto de cada una), para saber qué se le hizo al vehículo y cuándo.
>
> *Redacción original: "...para verificar la vigencia de la garantía y las condiciones de entrega." Se ajustó porque la garantía de servicios se descartó (ver HU-25); el historial sigue siendo necesario, pero ya no con ese propósito — ver `entidades-dominio.md`, sección 9.*

**HU-27**
> Como Administrador, quiero registrar una visita/orden de servicio "a crédito" para un cliente de confianza, para permitirle pagarla más adelante sin perder el registro de la deuda.

**Criterios de aceptación:**
- Dado que registro una orden de servicio con uno o más servicios realizados, cuando marco la orden completa como pendiente de pago, entonces el sistema exige registrar (o seleccionar) al cliente correspondiente, con al menos su nombre, ya que según la entrevista este caso no siempre implica un registro completo de datos.
- Dado que el crédito en servicios se maneja sobre el total de la visita (no por cada servicio individual dentro de ella — ver `entidades-dominio.md`, sección 13), cuando la orden tiene varios servicios, el sistema no permite marcar unos como contado y otros como crédito dentro de la misma orden.
- Dado una orden de servicio registrada como pendiente de pago, cuando se guarda, entonces el sistema la suma al saldo pendiente del cliente, de la misma forma que un ítem de venta a crédito (ver HU-10/HU-11).
- Dado que el cliente va abonando la orden de a cuotas, se aplica el mismo mecanismo de registro de pagos parciales definido en HU-10.1, actualizando el saldo pendiente de la orden hasta saldarla.
- Dado que no existe actualmente un criterio formal de "cliente de confianza" en el sistema (es una decisión subjetiva del dueño en el momento), el MVP no debe validar ni restringir quién puede recibir una orden a crédito; queda a criterio del Administrador al momento de registrar la operación.
- *(Agregado tras entrevista 10/09/2026)* Dado que el dueño pidió registrar la fecha en la que el cliente debería pagar y ser notificado si no viene en esa fecha, la orden de servicio a crédito también admite `fecha_pago_prevista` y participa del listado de créditos vencidos — ver HU-10.2, que aplica igual a órdenes de servicio que a ítems de venta.

## 6. Historias agregadas tras el feedback de cierre de Sprint 2 (20/11/2026)

*Trasladadas de `docs/01-analisis/entrevistas/reunion-sprint02--2026-11-20.md` y `desiciones-alcance.md`, sección 9. A diferencia de las adendas puntuales ya agregadas junto a HU-01, HU-10, HU-14/15/16 y HU-17/17.1/18, las siguientes son historias nuevas, sin HU previa de la cual depender.*

**HU-36**
> Como dueño del taller, quiero que el Empleado solo pueda consultar información (precio final, stock disponible, ficha de clientes), sin ver el historial de compras ni el de ventas, para no exponerle datos de costos y de la operación del negocio que no necesita para atender a un cliente.

**Criterios de aceptación:**
- El Empleado no tiene acceso a ningún listado ni detalle de compras (historial de compras, precio de compra/costo de un producto), ni al historial/listado de ventas — a diferencia del Sprint 2, donde podía consultarlos aunque no pudiera registrar operaciones nuevas.
- El Empleado conserva acceso de solo lectura a: precio final de producto, cantidad en stock, ficha de clientes, y la calculadora de Ventas (HU-17).
- Esta restricción se valida en el servidor (en los endpoints `GET` correspondientes y/o en los campos que devuelven), no solo ocultando elementos en la interfaz — mismo criterio ya aplicado en HU-17.1 para el registro de ventas.

**HU-37** *(agregada 20/11/2026, mismo criterio que HU-01.1 para Categoría)*
> Como Administrador, quiero crear, editar y eliminar las marcas de producto, para organizar el catálogo según las marcas que maneja el taller.

**Criterios de aceptación:**
- El conjunto de marcas no es una lista fija del sistema: el Administrador puede crear, renombrar o eliminar marcas en cualquier momento, igual que las categorías (HU-01.1).
- Un Producto puede tener una marca asociada (ver adenda de HU-01). Queda pendiente confirmar con el dueño si es un dato obligatorio en todo producto — ver `desiciones-alcance.md`, sección 7.6.

**HU-38** *(agregada 20/11/2026; criterios ajustados 21/11/2026)*
> Como Administrador, quiero gestionar las compras en una sección separada de Productos/Stock, con su propio historial de compras registradas, para no tener que mezclar la gestión de inventario con el registro de nuevas compras.

**Criterios de aceptación:**
- Existe una pantalla propia para registrar una Compra, distinta de Control de Stock/Productos.
- El historial de compras ya registradas vive en **otra pantalla separada**, no en la misma pantalla de alta — mismo patrón ya usado para Ventas (`VentaScreen` para cargar / `VentasScreen` para el historial) y Servicios (`OrdenServicioScreen` / `HistorialServiciosScreen`). Así, la pantalla de Compras queda dedicada solo a registrar, igual que "Nueva venta" y "Nueva orden de servicio". *(Ajuste 21/11/2026: la redacción original de esta historia no distinguía si el historial iba en la misma pantalla o en una aparte; se alinea con el patrón ya existente en el resto del sistema.)*
- Ese historial es filtrable (al menos por rango de fecha y proveedor), igual criterio que los demás historiales del sistema.
- No cambia ninguna regla de negocio de Compras ya definida (HU-14, HU-15, HU-16, ni el mecanismo de lotes de stock de `entidades-dominio.md`, sección 6): es una reorganización de pantallas, no un cambio de modelo.

**HU-39** *(agregada 20/11/2026; ajustada 22/11/2026 — ver nota de cambio de alcance en HU-10)*
> Como dueño del taller, quiero que toda venta a crédito incluya un pago inicial al momento de registrarse, para asegurarme un compromiso mínimo del cliente antes de fiarle el resto.

**Criterios de aceptación:**
- Dado una venta (o, en Órdenes de Servicio, una orden completa) marcada como Crédito, cuando se registra, el sistema exige un pago inicial mayor a cero en el mismo momento — no se acepta un saldo pendiente igual al 100% del monto.
- El monto mínimo de ese pago inicial queda, por ahora, en "mayor a cero, sin piso específico" (decisión provisional del equipo, 20/11/2026, sin pasar por el dueño — ver `desiciones-alcance.md`, sección 7.6). Si el dueño confirma un mínimo distinto (ej. un porcentaje), esta historia debe actualizarse.
- Esta historia no reemplaza el mecanismo de Pago ya existente (HU-10.1): el pago inicial es, técnicamente, el primer Pago registrado contra la venta/orden recién creada, usando el mismo servicio.
- En el flujo de carga (ver HU-40), el pago inicial y la `fecha_pago_prevista` se piden en un modal de confirmación que aparece al presionar "Guardar/Registrar venta", solo cuando la condición de la venta es Crédito — no son campos visibles todo el tiempo en el formulario principal.

**HU-40** *(agregada 20/11/2026, amplía HU-17/HU-17.1/HU-18; criterios completados 22/11/2026 a partir de un prototipo HTML armado por el equipo — ver `sprint-3-backlog.md`, punto 1; criterio de lote actualizado 26/11/2026 — ver nota al final)*
> Como Administrador o Empleado, quiero buscar un producto directamente y verlo en una tabla de ítems de la venta en curso, y al seleccionar una fila de esa tabla editar sus datos (cantidad, precio, lote, garantía) en una sección aparte, para cargar la venta de forma más parecida al sistema que ya conocemos.

**Criterios de aceptación:**
- La búsqueda de productos filtra por **nombre, marca o código**, indistintamente (resuelve la pregunta abierta de `desiciones-alcance.md`, sección 7.6, a partir del prototipo del 22/11/2026) — no hace falta que el usuario indique en cuál de los tres está buscando.
- La pantalla se organiza en 4 franjas: (A) búsqueda de productos + cliente y condición de la venta (Contado/Crédito, ver nota de cambio de alcance en HU-10); (B) edición del producto seleccionado (lote de compra, cantidad, precio unitario, garantía ofrecida); (C) tabla de ítems ya agregados a la venta, donde un clic en una fila la carga en (B) para editarla; (D) total y acciones (Cancelar venta / Guardar venta), junto con el método de pago de la venta (HU-19).
- El pago inicial y la `fecha_pago_prevista` (solo si la venta es a Crédito) se piden en un modal aparte al presionar "Guardar venta", no en el formulario principal — ver HU-39.
- Para el rol Empleado (HU-17), la misma pantalla oculta/deshabilita: el campo de precio editable en (B) (ve el precio base, sin poder modificarlo — HU-18), el botón "Guardar venta" en (D) y el selector de condición Contado/Crédito en (A) (ve el total calculado, sin poder confirmar la operación ni definir forma de pago). Se implementa como el mismo componente de pantalla condicionado por rol, no como dos pantallas separadas.
- ~~No cambia ninguna otra regla de negocio ya definida (selección manual de lote...)~~ **Actualizado 26/11/2026:** el lote de compra (B) ya **no** se selecciona manualmente — el sistema reparte automáticamente la cantidad vendida entre los lotes disponibles (más antiguos primero), y el Administrador puede editar ese reparto antes de confirmar el ítem. Ver `desiciones-alcance.md`, sección 7.9, y la pregunta abierta sobre garantía cuando el reparto toca varios lotes (sección 7.6). El resto de las reglas (bloqueo por stock insuficiente, permisos por rol, descuento solo-Administrador) no cambia.

**HU-41** *(agregada 20/11/2026; reescrita 26/11/2026 con la regla precisada por el dueño al cierre de Sprint 3 — ver nota de cambio al final)*
> Como Administrador, quiero registrar el kilometraje del vehículo en los servicios de mantenimiento y cargar yo mismo a qué kilometraje correspondería el próximo, para poder avisarle al cliente cuándo le toca volver.

**Criterios de aceptación** *(a partir de `docs/01-analisis/reuniones/reunion-sprint03--2026-11-26.md`, ver `desiciones-alcance.md`, sección 10.2)*:
- El kilometraje se registra **por visita**, como campo opcional de la Orden de Servicio (ya implementado desde el Sprint 3, sin cambios).
- El "próximo mantenimiento" (kilometraje al que correspondería la siguiente visita) **lo carga manualmente el Administrador**, no se calcula automáticamente a partir de un intervalo fijo. El sistema puede sugerir valores de referencia (5.000, 8.000, 10.000 km) para agilizar la carga, pero el campo queda libre y editable.
- El kilometraje (tanto el de la visita como el del próximo mantenimiento) **solo aplica a servicios de tipo mantenimiento**, no a otros tipos del catálogo (alineación, balanceo, gomería, etc.).
- Dado que el intervalo real varía según el vehículo (no es un valor único del taller), **no corresponde un campo de intervalo fijo en el catálogo `tiposServicio`** — ver nota de cambio.

**Nota de cambio de alcance (26/11/2026):** esta historia reemplaza, no ajusta, el modelo implementado durante el Sprint 3 (intervalo fijo por tipo de servicio en `tiposServicio.intervaloKm`, cálculo automático de `proximoMantenimientoKm` en `services/ordenesServicio.ts`) — ese modelo fue una decisión del equipo tomada sin confirmar con el dueño (ver la alerta del 25/11/2026 en `sprint-3-backlog.md`, punto 6) y **no coincide** con la regla que el dueño precisó al cierre del sprint. El equipo ya decidió rehacerlo en Sprint 4 siguiendo los criterios de arriba. Ver el modelo de datos actualizado en `entidades-dominio.md`, sección 10.

**HU-42** *(agregada 26/11/2026, a partir del feedback de cierre de Sprint 3 — amplía HU-26)*
> Como Administrador, quiero buscar por chapa del vehículo o por nombre del cliente y ver el historial de servicios realizados a ese vehículo, con la fecha y el kilometraje de cada visita, para saber qué se le hizo y cuándo le toca el próximo mantenimiento.

**Criterios de aceptación:**
- La búsqueda admite indistintamente chapa de vehículo o nombre de cliente.
- El resultado lista las Órdenes de Servicio de ese vehículo con, al menos: fecha de la visita y kilometraje registrado en esa visita (HU-41).
- No es una historia nueva de fondo, sino una precisión de HU-26 (historial de servicios por cliente/vehículo, ya en el alcance del MVP desde `desiciones-alcance.md`, sección 2.5): agrega el requisito explícito de poder buscar por chapa y de incluir el kilometraje en el resultado.

## 7. Reportes (futuro)

**HU-28** *(futuro)*
> Como Administrador, quiero ver un reporte de ventas realizadas en un período de tiempo determinado, para conocer el desempeño del negocio.

**HU-29** *(futuro)*
> Como Administrador, quiero ver un reporte de gastos y ganancias del taller, para tener una visión financiera general.

## 8. Acceso al sistema (futuro)

**HU-30** *(futuro)*
> Como Administrador, quiero poder acceder al sistema desde mi celular, para consultar información del taller cuando no estoy en la computadora principal.

---

### Notas sobre priorización

- Las historias marcadas como *(futuro)* corresponden a funcionalidades post-MVP, según lo definido en `desiciones-alcance.md`.
- HU-25 fue descartada (ver nota en la historia); no forma parte del MVP ni de ninguna etapa futura.
- HU-08 se incorporó al MVP el 12/10/2026 (ver nota en la historia); ya no está marcada como futura.
- El resto de las historias (HU-01 a HU-30, salvo las marcadas como futuro o descartadas) se consideran parte del alcance del MVP, incluyendo las agregadas tras la entrevista del 10/09/2026 (HU-10.2, HU-22.1), la agregada el 12/10/2026 (HU-01.1), la agregada el 23/10/2026 (HU-17.1) y la agregada el 20/11/2026 al cierre del Sprint 2 (HU-22.2, catálogo de tipos de servicio — documenta en retrospectiva una decisión ya tomada durante la implementación).
- HU-17 fue corregida el 23/10/2026 (ver nota en la historia): el Empleado deja de registrar la venta y pasa a solo calcularla; el registro queda en la nueva HU-17.1. HU-05 recibió una adenda la misma fecha (filtro en la impresión de existencias).
- **HU-36 a HU-41** se agregaron el 20/11/2026, a partir del feedback del dueño al cierre del Sprint 2 (ver sección 6 y `desiciones-alcance.md`, sección 9), y corresponden al alcance planificado para el Sprint 3. A diferencia del resto de historias "agregadas tras feedback", **HU-39 (pago inicial) y HU-41 (kilometraje)** dependían de reglas de negocio que el dueño no había terminado de precisar — ver las preguntas abiertas correspondientes en `desiciones-alcance.md`, sección 7.6. **HU-40 (flujo de Ventas)** se completó el 22/11/2026 a partir de un prototipo del equipo; de paso, al planificar su implementación se decidió cambiar el alcance de HU-10 (crédito por venta completa en vez de por ítem — ver la nota de cambio ahí), una decisión de diseño del equipo, no un pedido del dueño, comunicada en el cierre del Sprint 3.
- **HU-41 (kilometraje) y HU-42 (nueva)** se reescribieron/agregaron el 26/11/2026, al cierre del Sprint 3, con la regla que el dueño terminó de precisar (ver `desiciones-alcance.md`, sección 10.2) — reemplazan el modelo que el equipo había implementado durante el sprint sin confirmarlo con él. **HU-40** se ajustó la misma fecha: el criterio de selección manual de lote queda reemplazado por reparto automático editable, validado por el dueño (ver `desiciones-alcance.md`, sección 7.9). **HU-39 (pago inicial)** sigue con su pregunta abierta sin resolver (monto mínimo), no se tocó en esta reunión.
- Falta definir el orden de implementación (sprints/iteraciones) de las historias del MVP; se recomienda abordarlo en `docs/03-gestion-proyecto/`.

### Notas sobre criterios de aceptación

Se agregaron criterios de aceptación únicamente a las historias identificadas como ambiguas o con reglas de negocio no triviales: **HU-01.1, HU-05 (adenda), HU-06, HU-08, HU-10, HU-10.1, HU-10.2, HU-11, HU-17, HU-17.1, HU-18, HU-20, HU-22.1, HU-24, HU-27, HU-36, HU-37, HU-38, HU-39, HU-40, HU-41 y HU-42**. Estas son las historias donde una interpretación distinta entre desarrolladores podría llevar a un comportamiento distinto al esperado por el dueño (garantías, crédito/saldo, pagos parciales, fechas de pago previstas, permisos por rol, descuento de stock, detalle de servicios, categorías, stock mínimo, marcas, pago inicial, flujo de ventas, kilometraje). HU-40 completó sus criterios el 22/11/2026, a partir de un prototipo del equipo (ver la historia y `sprint-3-backlog.md`, punto 1), y los ajustó el 26/11/2026 (reparto automático en vez de selección manual de lote) — es una decisión de diseño del equipo, no del dueño, salvo en la parte de búsqueda por nombre/marca/código y el reparto automático, que sí surgen de validaciones directas con el dueño. **HU-41 recién obtuvo criterios de aceptación el 26/11/2026**, al cierre del Sprint 3, cuando el dueño precisó la regla de negocio; hasta esa fecha se había dejado deliberadamente sin ellos para no inventar una regla que no había pedido. **HU-42** es nueva, agregada la misma fecha.

*HU-10.1 se agregó a partir de la revisión del modelo de datos (ver `entidades-dominio.md`, sección 12), al detectar que faltaba una historia explícita para el registro de pagos/cuotas parciales sobre un ítem a crédito.*

*HU-10.2 y HU-22.1 se agregaron tras la entrevista del 10/09/2026, a partir de pedidos explícitos del dueño (fecha de pago prevista + aviso de mora, y detalle de partes afectadas en servicios — ver `entidades-dominio.md`, secciones 9.1 y 12.1). HU-25 (garantía en servicios) se descartó por el mismo motivo.*

*HU-01.1 se agregó el 12/10/2026 para hacer explícita la gestión de categorías por parte del Administrador, previamente implícita en HU-01/HU-02. En la misma fecha, HU-08 (notificación de stock mínimo) se reclasificó de post-MVP a MVP — ver `desiciones-alcance.md`, sección 2.1.*

Varios de estos criterios quedan sujetos a las preguntas abiertas listadas en `desiciones-alcance.md` (ej. regla exacta de cálculo de garantía de productos, alcance exacto del campo `detalle` en Servicio); se recomienda confirmarlas con el dueño antes de pasar a diseño/implementación de esas partes. La pregunta sobre existencia de vencimiento en el crédito ya se resolvió (tope de 2 meses, sin bloqueo — ver HU-10.2).

El resto de las historias (CRUD simples de productos, clientes, proveedores, etc.) no cuentan con criterios de aceptación explícitos por considerarse de bajo riesgo de ambigüedad; se pueden agregar más adelante si surge la necesidad.
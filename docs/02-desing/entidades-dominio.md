# Entidades del Dominio

*Elaborado a partir de `docs/01-analisis/entrevistas/entrevista_2026-06-30.md`, `desiciones-alcance.md` e `historias-usuario.md`.*

Este documento identifica las entidades principales del sistema, sus atributos y sus relaciones, como base para el diseño de la base de datos y del modelo de clases.

## 1. Usuario

Representa a quien opera el sistema (dueño, esposa o empleado).

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| nombre | Nombre del usuario |
| usuario/login | Credencial de acceso |
| contraseña | Credencial de acceso (hasheada) |
| rol | `Administrador` \| `Empleado` |

**Relaciones:**
- Un Usuario **registra** muchas Ventas.
- Un Usuario **registra** muchas Órdenes de Servicio.

*Nota: la esposa no es una entidad/rol separado — usa el mismo registro de Usuario que el dueño (rol Administrador), según lo definido en `desiciones-alcance.md`.*

## 2. Cliente

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| nombre | Nombre completo |
| cédula | Documento de identidad |
| celular | Teléfono de contacto |
| RUC | Opcional, para factura electrónica |
| saldo_pendiente | Calculado: suma de `saldo_pendiente` de todos sus Ítems de Venta a crédito, más el saldo pendiente de sus Órdenes de Servicio a crédito (monto_total − Pagos asociados) |

**Relaciones:**
- Un Cliente **compra** Productos a través de Ventas (la Venta es la transacción; el Cliente no "realiza" la venta, sino que es el comprador en ella).
- Un Cliente **solicita** muchas Órdenes de Servicio.
- Un Cliente puede tener muchos Vehículos asociados (ver entidad Vehículo).

*Nota: un cliente "casual" (sin registrar) puede realizar una Venta sin estar asociado a esta entidad, salvo que la operación sea a crédito (ver HU-10), donde el registro es obligatorio.*

## 3. Proveedor

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| nombre | Nombre / razón social |
| contacto | Teléfono u otro dato de contacto |

**Relaciones:**
- Un Proveedor **provee** muchos Productos, y un Producto puede tener muchos Proveedores → relación **muchos-a-muchos**, resuelta mediante la entidad **Compra**.

## 4. Categoría

Se modela como entidad propia (y no como texto libre dentro de Producto) pensando en que el taller podría ampliar su rubro a futuro (por ejemplo, vender accesorios u otros productos no contemplados hoy). Tener la categoría como entidad permite agregar/renombrar categorías sin tocar el modelo de Producto.

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| nombre | Nombre de la categoría (neumático, lubricante, batería, filtro, etc.) |

**Relaciones:**
- Una Categoría **clasifica** muchos Productos.

## 5. Producto

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| nombre | Nombre del producto |
| categoría_id | Categoría a la que pertenece (ver entidad Categoría) |
| precio_base | Precio de venta estándar |
| stock | Cantidad disponible total. Corresponde a la suma de `cantidad_disponible` de todas las Compras (lotes) de este Producto — ver sección 14 |
| stock_mínimo | Para notificación de stock bajo (futuro) |

**Relaciones:**
- Un Producto **pertenece** a una Categoría.
- Un Producto es **comprado** a través de muchas Compras (lotes), a distintos Proveedores.
- Un Producto es **vendido** a través de muchos ítems de Venta.

## 6. Compra

Registra la adquisición de uno o más unidades de un Producto a un Proveedor, en una fecha determinada. Funciona como un **lote de stock**: cada Compra mantiene su propia cantidad disponible, de forma que sea posible saber, al momento de una venta, de qué lote específico proviene la unidad vendida, y por lo tanto qué garantía de proveedor le corresponde (ver corrección detallada en la sección 14).

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| producto_id | Producto comprado |
| proveedor_id | Proveedor al que se le compró |
| fecha | Fecha de la compra |
| cantidad | Cantidad de unidades compradas originalmente en este lote |
| cantidad_disponible | Unidades de este lote que aún no fueron vendidas (se descuenta con cada venta que provenga de este lote) |
| precio_compra | Precio pagado al proveedor (unitario) |
| garantía_proveedor | Duración de la garantía ofrecida por el proveedor para las unidades de este lote (relevante sobre todo en baterías) |
| factura | Referencia a la factura de compra |

**Relaciones:**
- Una Compra **pertenece** a un Producto.
- Una Compra **pertenece** a un Proveedor.
- Una Compra (como lote de origen) es referenciada por muchos **Ítems de Venta**.

## 7. Venta

Registra la venta de uno o más Productos a un Cliente (o cliente casual). El tipo de pago (contado/crédito) **ya no vive acá**, sino en cada Ítem de Venta — ver la corrección explicada más abajo (sección 12).

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| cliente_id | Cliente asociado (opcional si es venta casual y ningún ítem es a crédito) |
| usuario_id | Usuario que registró la venta |
| fecha | Fecha de la operación |
| monto_total | Suma de los ítems vendidos |
| tipo_comprobante | Factura común \| Factura electrónica (futuro) |

**Relaciones:**
- Una Venta **pertenece** a (opcionalmente) un Cliente.
- Una Venta **es registrada por** un Usuario.
- Una Venta tiene muchos **Ítems de Venta**.

### 7.1 Ítem de Venta

Detalle de cada producto dentro de una Venta (una Venta puede incluir varios Productos). **El tipo de pago se define acá, por ítem**, para poder resolver casos como "compré 3 productos, 1 al contado y 2 a crédito" (ver sección 12). **Siempre referencia el lote de Compra específico del cual se descontó stock**, ya que el propio mecanismo de descuento de stock lo requiere (ver corrección detallada en sección 14) — no es una decisión opcional de negocio, sino una consecuencia de cómo se modela el stock.

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| venta_id | Venta a la que pertenece |
| producto_id | Producto vendido. Se mantiene como campo propio (aunque sea derivable a través de `compra_id`) por conveniencia de consulta — ver nota de diseño en sección 14. |
| compra_id | Lote de Compra específico del cual se descontó esta unidad. **Obligatorio**: dado que `Producto.stock` es la suma de `Compra.cantidad_disponible` (ver sección 5), toda venta debe descontar de algún lote puntual; no puede existir una unidad vendida "sin lote de origen". Debe corresponder al mismo `producto_id` del ítem. |
| cantidad | Unidades vendidas |
| precio_unitario | Precio aplicado (puede diferir del precio_base si hubo descuento — ver HU-18) |
| garantía_ofrecida | Garantía otorgada al cliente para ese producto en esa venta. No debe superar la `garantía_proveedor` del lote referenciado en `compra_id` — ver HU-06. Si ese lote no tiene garantía de proveedor cargada (producto sin garantía aplicable), este campo queda a criterio del Administrador. |
| tipo_pago | Contado \| Crédito — aplica a este ítem puntual, no a toda la Venta |
| saldo_pendiente | Calculado: (precio_unitario × cantidad) − suma de Pagos asociados a este ítem. Si tipo_pago es Contado, siempre es 0. |

**Relaciones:**
- Un Ítem de Venta **pertenece** a una Venta.
- Un Ítem de Venta **referencia** un Producto.
- Un Ítem de Venta **referencia** una Compra (obligatorio: el lote específico de origen de la unidad vendida).

*Nota — reparto entre lotes: si la cantidad solicitada de un Producto en una Venta supera la `cantidad_disponible` del lote más antiguo (regla PEPS/FIFO por defecto — pendiente de confirmar con el dueño, ver sección 14), el sistema genera automáticamente **más de un Ítem de Venta** para ese mismo Producto dentro de la misma Venta, uno por cada lote del cual efectivamente se descontó stock, cada uno con su propio `compra_id` y la porción de `cantidad` correspondiente a ese lote. Esto es una operación interna del sistema al registrar la venta, no algo que el Administrador tenga que armar manualmente ítem por ítem.*
- Un Ítem de Venta (cuando es a crédito) tiene muchos **Pagos**.

## 7.2 Pago

Registra cada abono/cuota que un cliente realiza para saldar una deuda, ya sea de un Ítem de Venta o de una Orden de Servicio. Es la pieza que faltaba para poder registrar pagos parciales en el tiempo.

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| item_venta_id | Ítem de Venta que se está pagando (nulo si el pago corresponde a una Orden de Servicio) |
| orden_servicio_id | Orden de Servicio que se está pagando (nulo si el pago corresponde a un Ítem de Venta) |
| monto | Monto abonado en este pago |
| fecha | Fecha del pago |
| método_pago | Efectivo, tarjeta, transferencia, QR |

**Relaciones:**
- Un Pago **pertenece** a (excluyentemente) un Ítem de Venta **o** una Orden de Servicio, nunca ambos ni ninguno.

*Regla de negocio: un Pago solo debe existir si el ítem/orden al que referencia tiene `tipo_pago = Crédito`. Una compra al contado se considera "pagada" en el momento de la venta sin necesidad de un registro en Pago (o, alternativamente, se puede generar automáticamente un Pago por el monto total al momento de la venta contado, para mantener un único mecanismo — a definir en diseño técnico).*

## 8. Vehículo

Representa el vehículo sobre el cual se realiza un Servicio. Se modela como entidad propia (y no solo como campos sueltos) porque un mismo Cliente puede traer distintos vehículos, y conviene poder consultar el historial por vehículo (ver HU-26).

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| cliente_id | Dueño del vehículo (opcional si es cliente casual) |
| marca | Marca del vehículo |
| chapa | Número de chapa/matrícula |
| color | Color del vehículo |

**Relaciones:**
- Un Vehículo **pertenece** a (opcionalmente) un Cliente.
- Un Vehículo tiene muchas Órdenes de Servicio asociadas.

## 9. Orden de Servicio

Representa la **visita** del cliente al taller. Agrupa los datos que son comunes a todo lo que se hace en esa visita (cliente, vehículo, fecha, quién atendió), evitando repetirlos en cada servicio individual.

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| vehículo_id | Vehículo atendido en la visita |
| cliente_id | Cliente que solicitó la visita |
| usuario_id | Usuario que registró la visita |
| fecha | Fecha de la visita |
| tipo_pago | Contado \| Crédito (aplica al total de la visita, no a cada Servicio individual — ver nota) |
| monto_total | Suma de los montos de los Servicios incluidos |
| saldo_pendiente | Calculado: monto_total − suma de Pagos asociados a esta Orden. Si tipo_pago es Contado, siempre es 0. |
| garantía_dias | Días de garantía ofrecidos sobre el trabajo completo de la visita (opcional; no todos los trabajos la incluyen) |
| tipo_comprobante | Factura común \| Factura electrónica (futuro) |

**Relaciones:**
- Una Orden de Servicio **pertenece** a un Vehículo.
- Una Orden de Servicio **pertenece** a un Cliente.
- Una Orden de Servicio **es registrada por** un Usuario.
- Una Orden de Servicio tiene uno o muchos **Servicios** (detalle).
- Una Orden de Servicio (cuando es a crédito) tiene muchos **Pagos**.

*Nota: a diferencia de la Venta (donde `tipo_pago` vive por Ítem — ver sección 12), en la Orden de Servicio el crédito es sobre el total de la visita, no por Servicio individual. Esto es coherente con cómo el dueño maneja el crédito en la práctica: no se mencionó en la entrevista que quiera cobrar una tarea al contado y otra a crédito dentro de la misma visita, sino que el acuerdo de "fiar" se hace sobre el trabajo completo. Si esa necesidad surgiera más adelante, el mismo ajuste que se hizo en Venta (mover `tipo_pago` al detalle) podría replicarse en Servicio.*

## 9.1 Servicio (detalle)

Representa **cada tarea individual** realizada dentro de una Orden de Servicio (alineación, balanceo, montaje, gomería, etc.). Solo contiene lo que puede variar entre tareas de una misma visita; todo lo demás vive en la Orden.

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| orden_id | Orden de Servicio a la que pertenece |
| tipo_servicio | Alineación, balanceo, montaje, gomería, mantenimiento, etc. |
| monto | Costo de esta tarea puntual |

**Relaciones:**
- Un Servicio **pertenece** a una Orden de Servicio.

*Nota: la garantía se ofrece sobre el trabajo completo de la visita, no por cada tarea individual, y no es obligatoria (el dueño la ofrece a criterio propio como gesto de buena atención). Por eso `garantía_dias` vive en la Orden de Servicio y no en el detalle — ver corrección más abajo respecto del modelo anterior.*

*Nota: con este modelo, si en una visita se hacen 2 servicios (ej. alineación + balanceo), el vehículo, cliente, fecha, usuario y garantía se cargan **una sola vez** en la Orden, y solo se agregan 2 filas de Servicio con su tipo y monto — sin repetir el resto de los datos. Esto resuelve directamente la redundancia que se había detectado con el modelo anterior (un único registro de Servicio con todos los campos repetidos por cada tarea).*

## 10. Puntos a resolver en el diseño (no cerrados por el análisis)

- **Garantía como entidad propia vs. campos embebidos:** por ahora se modeló la garantía como atributos dentro de Compra (garantía del proveedor), Ítem de Venta (garantía ofrecida por producto) y Orden de Servicio (garantía ofrecida sobre el trabajo completo, opcional). Si la lógica de cálculo de garantía se vuelve más compleja (ver pregunta abierta sobre el margen fijo), podría convenir una entidad "Garantía" separada con su propio estado (vigente/vencida) y reglas.

## 11. Dilema abierto: nivel de detalle de los Servicios

Durante el análisis surgió una tensión que no está resuelta y que **afecta directamente el modelo de las entidades Orden de Servicio y Servicio (secciones 9 y 9.1)**, por eso se documenta aparte.

**El problema:** actualmente el dueño anota todo en el cuaderno bajo un único nombre genérico (ej. "alineación"), sin importar si en realidad fue solo eso, un servicio completo, o una combinación (alineación + balanceo, por ejemplo). En la entrevista se le consultó si preferiría registrar el detalle completo de lo realizado, y pidió explícitamente mantenerlo simple, por percibir que detallar cada servicio le agregaría complejidad al uso diario del sistema.

**La tensión:** un registro más granular (detallar cada servicio individual dentro de una visita) sería más útil para historial, garantías y, a futuro, estadísticas — pero el dueño priorizó la simplicidad de carga por sobre el detalle.

**Cómo se resolvió para este documento:** se respetó el pedido del dueño, y además se resolvió el problema de redundancia de datos separando **Orden de Servicio** (datos de la visita: cliente, vehículo, fecha, usuario, garantía del trabajo completo) de **Servicio** (detalle de cada tarea: tipo, monto). Así, cargar 2 servicios en una misma visita implica completar los datos generales una sola vez y solo agregar 2 líneas de detalle — no se le pide al dueño repetir información, y el sistema queda igual de granular para consultas de historial.

**Por qué se decidió así y no dejar todo en un solo campo de texto libre:** aunque el dueño no pidió el detalle, este modelo no le agrega carga de trabajo extra respecto de un campo único de texto — sigue anotando cada tarea con su monto por separado, como ya hace naturalmente al cobrar — pero sí deja la puerta abierta a extraer historial y reportes por tipo de servicio más adelante, sin haber ido en contra de lo que pidió.

**Qué queda pendiente:** esto es una interpretación de nuestro equipo para conciliar ambas necesidades, no una confirmación explícita del dueño. Se recomienda validarlo en la próxima entrevista, mostrándole concretamente cómo se vería la carga de una visita con varios servicios en pantalla, para confirmar que el flujo propuesto realmente no le resulta más complejo que anotar en el cuaderno.

## 12. Validación del modelo: caso de pagos mixtos y parciales

Este caso puso en evidencia una falla real del modelo anterior, que ya se corrigió arriba (secciones 7, 7.1, 7.2). Se documenta el recorrido completo para dejar registro de por qué se hizo el cambio y cómo queda resuelto.

**Caso planteado:** un cliente compra 3 productos distintos en una misma visita. Paga 1 al contado. Para los otros 2 llega a un acuerdo de crédito con el dueño, y los va pagando de a cuotas. Más adelante, junta dinero extra y termina de pagar por completo uno de los dos productos a crédito, mientras que el otro sigue con cuotas pendientes.

**Por qué el modelo anterior fallaba:**
- `tipo_pago` estaba en **Venta**, no por producto → no se podía tener 1 producto contado y 2 a crédito dentro de la misma Venta.
- No existía ninguna entidad para registrar pagos parciales → no había forma de reflejar "abonó 30.000 Gs. de este producto" ni de saber cuánto queda pendiente.

**Cómo queda resuelto con el modelo corregido:**

1. Se crea **una Venta** con **3 Ítems de Venta** (uno por producto).
2. Ítem 1 (contado): `tipo_pago = Contado`, `saldo_pendiente = 0` desde el inicio.
3. Ítem 2 y 3 (crédito): `tipo_pago = Crédito`, `saldo_pendiente = precio_unitario × cantidad` al momento de la venta.
4. Cada vez que el cliente abona una cuota de, por ejemplo, el Ítem 2, se crea un registro de **Pago** con `item_venta_id` = Ítem 2 y el `monto` abonado. El `saldo_pendiente` del Ítem 2 se recalcula automáticamente restando ese pago.
5. Cuando el cliente termina de pagar el Ítem 2 por completo (sea con varias cuotas normales o con un pago grande de golpe), la suma de sus Pagos iguala su monto original → `saldo_pendiente = 0`. El Ítem 2 queda saldado, sin afectar en nada al Ítem 3, que sigue teniendo su propio `saldo_pendiente` independiente y sus propios Pagos.
6. El **saldo total del Cliente** (HU-11) se calcula sumando el `saldo_pendiente` de todos sus Ítems de Venta y Órdenes de Servicio a crédito — en este punto del ejemplo, sería únicamente lo que falta del Ítem 3.
7. Para mostrar **a qué corresponde** ese saldo, se lista cada Ítem de Venta/Orden de Servicio a crédito con saldo > 0, junto con su producto/servicio, fecha y monto original — información que ya está disponible en el modelo sin necesidad de campos adicionales.

**Conclusión:** el modelo corregido soporta el caso completo: pagos mixtos dentro de una misma venta, pagos parciales en el tiempo, y saldar un ítem sin afectar a los demás. Esto también impacta las historias de usuario **HU-10** y **HU-11**, que deberían actualizarse para reflejar que el crédito se maneja por ítem y no por venta completa (ver nota abajo).

**Pendiente de trasladar a `historias-usuario.md`:**
- HU-10 debería aclarar que el crédito se define por ítem/producto, no por venta completa.
- HU-11 debería aclarar que el saldo mostrado incluye el detalle de qué ítems están pendientes y su saldo individual.
- Convendría agregar una historia nueva ("Como Administrador quiero registrar un pago/cuota de un ítem a crédito, para actualizar el saldo pendiente del cliente").

## 13. Validación del modelo: Orden de Servicio a crédito con pagos parciales

Se revisó si el mismo mecanismo de `Pago` soporta el caso equivalente para servicios (no solo para productos).

**Caso:** un cliente lleva su vehículo y pide 2 servicios (ej. alineación + balanceo) en una misma visita, y acuerda con el dueño pagar el total a crédito. Va abonando de a cuotas hasta saldar la Orden completa.

**Cómo lo resuelve el modelo:**

1. Se crea una **Orden de Servicio** con `tipo_pago = Crédito` y sus 2 **Servicios** de detalle (alineación, balanceo), cada uno con su `monto`. `monto_total` de la Orden es la suma de ambos.
2. `saldo_pendiente` de la Orden arranca en `monto_total` (nada pagado aún).
3. Cada cuota que el cliente abona genera un registro de **Pago** con `orden_servicio_id` apuntando a esa Orden. El `saldo_pendiente` se recalcula restando los Pagos acumulados.
4. Cuando la suma de Pagos iguala el `monto_total`, la Orden queda saldada (`saldo_pendiente = 0`) y deja de aparecer en el detalle de deuda del cliente (HU-11).
5. El **saldo total del Cliente** ya contempla esto, porque su fórmula (sección Cliente) suma tanto los saldos de Ítems de Venta a crédito como los de Órdenes de Servicio a crédito.

**Diferencia importante respecto del caso de Venta:** en la Orden de Servicio, el crédito es **sobre el total de la visita**, no service por service — no se puede, por ejemplo, pagar la alineación al contado y dejar el balanceo a crédito dentro de la misma Orden. Esto es intencional (ver nota en sección 9) porque en la entrevista no surgió esa necesidad; si en el futuro el dueño quisiera fiar solo una parte de los servicios de una visita, habría que mover `tipo_pago` de la Orden al Servicio de detalle, tal como se hizo con Venta → Ítem de Venta.

**Conclusión:** el modelo soporta el caso de servicios a crédito con pagos parciales sin necesidad de cambios adicionales — reutiliza exactamente la misma entidad `Pago` ya creada para Ítem de Venta, gracias a que se diseñó con las dos referencias (`item_venta_id` / `orden_servicio_id`) desde el principio.

## 14. Corrección: trazabilidad de la garantía del proveedor al momento de la venta

Se identificó una inconsistencia real en el modelo: la garantía ofrecida por el proveedor (`garantía_proveedor`) se registraba únicamente en Compra, mientras que la venta se vinculaba directamente con Producto, sin ninguna referencia a qué Compra específica correspondía la unidad vendida.

**El problema, en detalle:**

- El `stock` de un Producto es un valor agregado: puede provenir de varias Compras distintas (a uno o varios Proveedores), cada una con su propia `garantía_proveedor`.
- Ejemplo simple: el dueño compra baterías del mismo modelo a dos proveedores distintos, uno le da 18 meses de garantía y el otro 12. Ambas compras suman al mismo `stock` del Producto "Batería X".
- Ejemplo alternativo, sin necesidad de proveedores distintos: el stock de un producto baja del mínimo, se hace una nueva compra al mismo proveedor de siempre, pero esta vez con una garantía distinta a la de la compra anterior (por ejemplo, por una promoción puntual del proveedor).
- En ambos casos, con el modelo anterior, al vender una unidad de ese Producto **no había forma de saber de cuál de esas compras provenía**, y por lo tanto tampoco de saber qué garantía de proveedor le correspondía a esa unidad puntual.

**Corrección aplicada:**

Se incorporó el concepto de **lote de stock**, usando la propia entidad Compra como lote:

1. Compra ahora tiene `cantidad_disponible`, que representa cuánto queda sin vender de ese lote puntual (arranca igual a `cantidad` y se va descontando con cada venta que provenga de ese lote).
2. Ítem de Venta ahora tiene `compra_id`, que indica explícitamente de qué lote salió la unidad vendida.
3. El `stock` del Producto pasa a ser un valor agregado (suma de `cantidad_disponible` de todas sus Compras), en lugar de un contador aislado sin relación con los lotes de origen.
4. La `garantía_ofrecida` al cliente en el Ítem de Venta queda validada contra la `garantía_proveedor` del lote específico (`compra_id`), no contra un valor genérico del Producto — esto también ajusta el criterio de aceptación de HU-06.

**Pregunta operativa pendiente de confirmar con el dueño:** este modelo asume que, al vender, el sistema puede elegir automáticamente de qué lote descontar stock, típicamente con una regla **PEPS/FIFO** (se vende primero lo que se compró primero). Sin embargo, esto depende de cómo el dueño maneja físicamente el stock en el taller:

- Si los productos de distintas compras están mezclados físicamente en el estante (por ejemplo, cubiertas sin ningún dato visible que indique de qué compra provienen), el sistema puede aplicar FIFO automáticamente sin que el dueño tenga que hacer nada, aunque en la práctica podría no coincidir exactamente con la unidad física que efectivamente se entrega.
- Si el producto tiene algún dato identificable físicamente (por ejemplo, baterías con fecha de fabricación o número de serie visible), podría ser preferible que el sistema le muestre al dueño las compras disponibles con su garantía, y sea él quien elija manualmente cuál está entregando.

Esta pregunta se agrega al guion de la próxima reunión (ver `guion-reunion-dueno.md`).

**Nota de diseño — por qué `producto_id` se mantiene en Ítem de Venta a pesar de existir `compra_id`:** dado que toda Compra ya referencia un `producto_id`, `producto_id` en Ítem de Venta es técnicamente derivable a través de `compra_id → Compra.producto_id`, y podría eliminarse sin perder información. Se decide mantenerlo de todas formas como una **denormalización deliberada**: permite consultar y filtrar ventas por producto sin necesidad de un `JOIN` contra Compra en cada consulta (por ejemplo, para HU-07, historial de compra/venta de un producto). La capa de lógica de negocio debe garantizar, al registrar cada Ítem de Venta, que `producto_id` coincida siempre con el `producto_id` de la Compra referenciada en `compra_id`, para que ambos campos nunca queden desincronizados.

**Corrección importante respecto de una versión anterior de este documento:** se había planteado `compra_id` como campo opcional, asumiendo que solo hacía falta cuando interesaba trazabilidad de garantía. Sin embargo, dado que `Producto.stock` se define como la suma de `Compra.cantidad_disponible` (sección 5), **toda** unidad vendida necesariamente descuenta de algún lote — por lo tanto `compra_id` debe ser **obligatorio** en todos los casos, no solo cuando la garantía importa. Lo que sí varía según el producto es si esa información se usa para validar garantía (HU-06) o simplemente queda registrada sin uso adicional.
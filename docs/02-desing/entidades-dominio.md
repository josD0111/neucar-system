# Entidades del Dominio

*Elaborado a partir de `docs/01-analisis/entrevistas/entrevista--2026-06-30.md`, `desiciones-alcance.md` e `historias-usuario.md`. Actualizado con los hallazgos de `entrevista--2026-09-10.md` (ver secciones 9, 9.1 y 12.1).*

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

*Nota (23/10/2026): el campo `usuario_id` de Venta no distingue roles a nivel de modelo, pero la regla de negocio (ver `desiciones-alcance.md`, sección 1 y 8.4) es que solo un Usuario con rol Administrador puede registrar una Venta; un Empleado solo puede calcular el total sin persistirlo — ver HU-17/HU-17.1 en `historias-usuario.md`. Esta restricción se valida en la capa de servicio/API, no en el modelo de datos.*

## 2. Cliente

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| nombre | Nombre completo |
| cédula | Documento de identidad |
| celular | Teléfono de contacto |
| RUC | Opcional, para factura electrónica |
| activo | Booleano, por defecto `true`. Ver nota de baja lógica más abajo |
| saldo_pendiente | Calculado: suma de `saldo_pendiente` de todos sus Ítems de Venta a crédito, más el saldo pendiente de sus Órdenes de Servicio a crédito (monto_total − Pagos asociados) |

**Relaciones:**
- Un Cliente **compra** Productos a través de Ventas (la Venta es la transacción; el Cliente no "realiza" la venta, sino que es el comprador en ella).
- Un Cliente **solicita** muchas Órdenes de Servicio.
- Un Cliente puede tener muchos Vehículos asociados (ver entidad Vehículo).

*Nota: un cliente "casual" (sin registrar) puede realizar una Venta sin estar asociado a esta entidad, salvo que la operación sea a crédito (ver HU-10), donde el registro es obligatorio.*

*Nota — baja lógica (`activo`, agregada durante la implementación del Sprint 1, sin HU propia): un Cliente nunca se borra físicamente, porque eso rompería el historial de Ventas y Órdenes de Servicio que lo referencian. En cambio, se marca como `activo = false` ("deshabilitado"): deja de aparecer en los listados normales, pero conserva su historial completo y puede volver a habilitarse. Deshabilitar/habilitar queda restringido al rol Administrador (ver `src/main/api/routes/clientes.ts`); el resto del CRUD de Cliente (HU-09) está disponible para ambos roles. Este campo no estaba contemplado en el análisis original (`historias-usuario.md`/`desiciones-alcance.md`) — conviene sumarle una historia de usuario explícita si todavía no la tiene, para dejar registrada la regla de negocio en vez de que solo viva en el código.*

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

*Actualizado 12/10/2026: el Administrador gestiona las categorías libremente (creación, edición, eliminación) — no se trabaja con una lista fija predefinida por el sistema. El objetivo principal es habilitar el filtrado de productos por categoría (ver `historias-usuario.md`, HU-01.1 y HU-02).*

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
| stock | Cantidad disponible total. Corresponde a la suma de `cantidad_disponible` de todas las Compras (lotes) de este Producto — ver sección 14. **Denormalización deliberada** (igual que `producto_id` en Ítem de Venta, sección 14): se mantiene como columna propia por conveniencia de consulta rápida (HU-03, HU-04), en vez de calcularse con un `SUM` en cada lectura. La capa de lógica de negocio debe mantenerlo sincronizado en cada Compra y cada Venta — ver también el comentario en `schema.ts` |
| stock_mínimo | Umbral opcional por producto, para la notificación de stock bajo. Incorporado al MVP el 12/10/2026 — ver `historias-usuario.md`, HU-08 |

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
| garantía_proveedor | Duración de la garantía ofrecida por el proveedor para las unidades de este lote, **en meses** (relevante sobre todo en baterías). Opcional: queda vacío en productos sin garantía aplicable (ej. un filtro) |
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
| fecha_pago_prevista | Fecha en la que el cliente debería venir a pagar (toda o la próxima cuota) cuando tipo_pago es Crédito. Nulo si es Contado. Ver nota de diseño en sección 12.1 |

**Relaciones:**
- Un Ítem de Venta **pertenece** a una Venta.
- Un Ítem de Venta **referencia** un Producto.
- Un Ítem de Venta **referencia** una Compra (obligatorio: el lote específico de origen de la unidad vendida).

*Nota — reparto entre lotes (actualizada 23/10/2026, ver resolución en sección 14): si la cantidad solicitada de un Producto en una Venta supera la `cantidad_disponible` de un solo lote, hacen falta **más de un Ítem de Venta** para ese mismo Producto dentro de la misma Venta, uno por cada lote del cual efectivamente se descontó stock, cada uno con su propio `compra_id` y la porción de `cantidad` correspondiente a ese lote. Se resolvió que esto **no es automático**: el equipo decidió selección manual de lote (no PEPS/FIFO), así que es el Administrador quien arma, ítem por ítem, de qué Compra sale cada porción — viendo en pantalla las Compras disponibles con su `cantidad_disponible` y `garantía_proveedor`.*
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
| fecha_pago_prevista | Fecha en la que el cliente debería venir a pagar (toda o la próxima cuota) cuando tipo_pago es Crédito. Nulo si es Contado. Ver nota de diseño en sección 12.1 |
| tipo_comprobante | Factura común \| Factura electrónica (futuro) |

**Relaciones:**
- Una Orden de Servicio **pertenece** a un Vehículo.
- Una Orden de Servicio **pertenece** a un Cliente.
- Una Orden de Servicio **es registrada por** un Usuario.
- Una Orden de Servicio tiene uno o muchos **Servicios** (detalle).
- Una Orden de Servicio (cuando es a crédito) tiene muchos **Pagos**.

*Nota: a diferencia de la Venta (donde `tipo_pago` vive por Ítem — ver sección 12), en la Orden de Servicio el crédito es sobre el total de la visita, no por Servicio individual. Esto es coherente con cómo el dueño maneja el crédito en la práctica: no se mencionó en la entrevista que quiera cobrar una tarea al contado y otra a crédito dentro de la misma visita, sino que el acuerdo de "fiar" se hace sobre el trabajo completo. Si esa necesidad surgiera más adelante, el mismo ajuste que se hizo en Venta (mover `tipo_pago` al detalle) podría replicarse en Servicio.*

*Nota — eliminación de `garantía_dias` (actualizado tras entrevista 10/09/2026): el modelo original incluía un campo `garantía_dias` opcional sobre el trabajo completo de la visita. La entrevista del 10/09/2026 aclaró explícitamente que **no es necesario registrar la garantía de los servicios ofrecidos**: cuando se termina una orden, se prueba el vehículo con el cliente en el momento, y los pocos casos de reclamo posterior los gestiona el dueño directamente, sin que el sistema necesite llevar un control formal de vigencia de garantía. Por eso se quita el campo del modelo. Lo que sí se mantiene (y es lo que el dueño pidió explícitamente) es el **historial de servicios aplicados al vehículo** — ver sección 9.1 y HU-26 — para poder consultar qué se hizo y cuándo, sin necesidad de una garantía formal asociada.*

## 9.1 Servicio (detalle)

Representa **cada tarea individual** realizada dentro de una Orden de Servicio (alineación, balanceo, montaje, gomería, etc.). Solo contiene lo que puede variar entre tareas de una misma visita; todo lo demás vive en la Orden.

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| orden_id | Orden de Servicio a la que pertenece |
| tipo_servicio | Alineación, balanceo, montaje, gomería, mantenimiento, etc. |
| monto | Costo de esta tarea puntual |
| detalle | Texto libre opcional para precisar la parte/alcance afectado cuando aplica (ej. "4 ruedas" en alineación o balanceo). No todos los tipos de servicio lo usan — ver nota |

**Relaciones:**
- Un Servicio **pertenece** a una Orden de Servicio.

*Nota — campo `detalle` (agregado tras entrevista 10/09/2026): el dueño pidió poder ver, además del tipo y monto, "las partes afectadas" de un servicio — mencionó como ejemplo saber la cantidad de ruedas trabajadas en una alineación o balanceo. No se precisó en la entrevista si esto aplica a todos los tipos de servicio o solo a algunos (ej. no tendría sentido en un "cambio de aceite"), por lo que se modela como un campo de **texto libre opcional**, sin estructura fija ni validación por tipo de servicio. Esto es una interpretación provisional del equipo, no una confirmación cerrada del dueño — queda pendiente de validar en una próxima reunión, mostrándole concretamente cómo se vería este campo al cargar una alineación o un balanceo, y confirmar si conviene un campo estructurado (ej. cantidad numérica) en vez de texto libre.*

*Nota — garantía (actualizada tras entrevista 10/09/2026): la garantía sobre servicios se retiró del modelo por completo (ver nota en sección 9), no solo de este detalle.*

*Nota: con este modelo, si en una visita se hacen 2 servicios (ej. alineación + balanceo), el vehículo, cliente, fecha y usuario se cargan **una sola vez** en la Orden, y solo se agregan 2 filas de Servicio con su tipo, monto y detalle — sin repetir el resto de los datos. Esto resuelve directamente la redundancia que se había detectado con el modelo anterior (un único registro de Servicio con todos los campos repetidos por cada tarea).*

## 10. Puntos a resolver en el diseño (no cerrados por el análisis)

- **Garantía como entidad propia vs. campos embebidos:** por ahora se modeló la garantía como atributos dentro de Compra (garantía del proveedor) e Ítem de Venta (garantía ofrecida por producto). Si la lógica de cálculo de garantía se vuelve más compleja (ver pregunta abierta sobre el margen fijo), podría convenir una entidad "Garantía" separada con su propio estado (vigente/vencida) y reglas. *(Actualizado 10/09/2026: la garantía sobre servicios se retiró del modelo — ver nota en sección 9 — por lo que este punto queda acotado solo a garantía de productos.)*

## 11. Dilema abierto: nivel de detalle de los Servicios

Durante el análisis surgió una tensión que no está resuelta y que **afecta directamente el modelo de las entidades Orden de Servicio y Servicio (secciones 9 y 9.1)**, por eso se documenta aparte.

**El problema:** actualmente el dueño anota todo en el cuaderno bajo un único nombre genérico (ej. "alineación"), sin importar si en realidad fue solo eso, un servicio completo, o una combinación (alineación + balanceo, por ejemplo). En la entrevista se le consultó si preferiría registrar el detalle completo de lo realizado, y pidió explícitamente mantenerlo simple, por percibir que detallar cada servicio le agregaría complejidad al uso diario del sistema.

**La tensión:** un registro más granular (detallar cada servicio individual dentro de una visita) sería más útil para historial, garantías y, a futuro, estadísticas — pero el dueño priorizó la simplicidad de carga por sobre el detalle.

**Cómo se resolvió para este documento:** se respetó el pedido del dueño, y además se resolvió el problema de redundancia de datos separando **Orden de Servicio** (datos de la visita: cliente, vehículo, fecha, usuario, garantía del trabajo completo) de **Servicio** (detalle de cada tarea: tipo, monto). Así, cargar 2 servicios en una misma visita implica completar los datos generales una sola vez y solo agregar 2 líneas de detalle — no se le pide al dueño repetir información, y el sistema queda igual de granular para consultas de historial.

**Por qué se decidió así y no dejar todo en un solo campo de texto libre:** aunque el dueño no pidió el detalle, este modelo no le agrega carga de trabajo extra respecto de un campo único de texto — sigue anotando cada tarea con su monto por separado, como ya hace naturalmente al cobrar — pero sí deja la puerta abierta a extraer historial y reportes por tipo de servicio más adelante, sin haber ido en contra de lo que pidió.

**Qué queda pendiente:** esto era una interpretación de nuestro equipo para conciliar ambas necesidades, no una confirmación explícita del dueño. Se recomendó validarlo en la próxima entrevista, mostrándole concretamente cómo se vería la carga de una visita con varios servicios en pantalla, para confirmar que el flujo propuesto realmente no le resulta más complejo que anotar en el cuaderno.

**Actualización (entrevista 10/09/2026) — dilema parcialmente resuelto a favor del detalle:** el dueño confirmó, sin que se le preguntara puntualmente por este dilema, que *sí* le interesa el detalle: *"Al dueño le interesa poder ver el detalle de una orden de servicio. Saber los servicios realizados, los precios unitario de cada servicio, las partes afectadas."* Esto valida el enfoque elegido (Orden de Servicio + Servicio como detalle granular) y además confirma que detallar servicio por servicio, con su monto individual, **no le genera carga adicional** — es justamente lo que pidió. Lo que sigue sin confirmarse es el alcance exacto del campo `detalle`/"partes afectadas" (ver campo `detalle` agregado en sección 9.1): no quedó claro en qué servicios aplica y con qué estructura, más allá del ejemplo de cantidad de ruedas en alineación/balanceo.

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

## 12.1 Incorporación: fecha de pago prevista y aviso de mora (entrevista 10/09/2026)

La entrevista del 10/09/2026 agregó dos requisitos nuevos sobre el manejo del crédito, no contemplados hasta ahora:

- *"Se desea registrar la fecha en la que el cliente debería ir a pagar su cuota."*
- *"Si un cliente no viene en la fecha prevista se le debe notificar al dueño."*

También se confirmaron datos que antes eran una pregunta abierta: los créditos se pagan de forma mensual, no suelen superar los **2 meses**, y normalmente el monto se divide a la mitad para pagar en 2 cuotas. Un cliente con 2 cuotas puede cancelar todo en el primer pago si quiere.

**Decisión de diseño — campo simple en vez de una entidad "Cuota":** en lugar de modelar un cronograma completo de cuotas futuras (una entidad `Cuota` separada de `Pago`), se agrega un único campo `fecha_pago_prevista` directamente en **Ítem de Venta** (sección 7.1) y en **Orden de Servicio** (sección 9), junto a `saldo_pendiente`. Representa la próxima fecha en la que se espera que el cliente venga a pagar (toda la deuda o la siguiente cuota). Se prefirió este enfoque más simple porque:

- El dueño no maneja cronogramas de cuotas fijas de antemano — el monto y la fecha de la próxima cuota se acuerdan "en el momento" con el cliente, igual que ya ocurre con la garantía (sin reglas fijas).
- En la práctica son como máximo 1-2 pagos por ítem/orden, no un plan de cuotas largo, por lo que una entidad `Cuota` agregaría complejidad sin necesidad real.
- Es coherente con el pedido explícito del dueño de que el sistema sea simple.

**Flujo:** al registrar un ítem/orden a crédito, el Administrador puede indicar `fecha_pago_prevista` (con un valor sugerido por defecto — ver más abajo). Al registrar un Pago parcial, el sistema puede pedir (opcionalmente) una nueva `fecha_pago_prevista` para la cuota siguiente, si todavía queda saldo pendiente.

**Default sugerido, no bloqueo:** el tope de 2 meses mencionado por el dueño se implementa como un **valor sugerido** al calcular la fecha por defecto (por ejemplo, proponer "hoy + 1 mes" para la primera cuota), pero el Administrador puede modificarlo libremente a cualquier fecha. El sistema **no debe impedir** registrar una fecha más lejana ni rechazar la operación — así como no hay una regla fija para la garantía, tampoco la hay de forma estricta para el plazo de crédito; el dueño lo decide caso a caso.

**Notificación de mora:** se agrega al alcance del MVP (ver `desiciones-alcance.md`, sección 2.2) un indicador/listado de ítems y órdenes a crédito cuya `fecha_pago_prevista` ya pasó y que todavía tienen `saldo_pendiente > 0`. No requiere una entidad nueva: es una consulta/vista sobre los campos ya agregados (`fecha_pago_prevista` + `saldo_pendiente`), comparando contra la fecha actual. Queda para la etapa de diseño técnico definir si se muestra como una sección del dashboard/inicio, una lista aparte, o un aviso puntual por cliente.

**Pendiente de trasladar a `historias-usuario.md`:** agregar una historia para registrar/editar `fecha_pago_prevista` al crear o abonar un crédito, y otra para ver el listado de créditos vencidos (ver HU-10.2 y actualización de HU-27).

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

**Resuelto por el equipo (23/10/2026) — selección manual de lote:** se decidió que el Administrador elige manualmente de qué Compra (lote) sale cada unidad vendida, en vez de que el sistema aplique PEPS/FIFO automático. Al registrar un Ítem de Venta, la interfaz muestra las Compras disponibles de ese Producto (con su `cantidad_disponible` y `garantía_proveedor`) para que el Administrador elija el `compra_id` correspondiente. Si la cantidad a vender de un Producto debe repartirse entre más de un lote, esto **no es automático**: el Administrador agrega manualmente un Ítem de Venta por cada lote del que efectivamente sale stock, cada uno con su propio `compra_id` y su porción de `cantidad` — ver tarea correspondiente en `sprint-2-backlog.md`, punto 1. Esto reemplaza la nota de "reparto automático entre lotes" que tenía antes la sección 7.1 (Ítem de Venta).

**Nota de diseño — por qué `producto_id` se mantiene en Ítem de Venta a pesar de existir `compra_id`:** dado que toda Compra ya referencia un `producto_id`, `producto_id` en Ítem de Venta es técnicamente derivable a través de `compra_id → Compra.producto_id`, y podría eliminarse sin perder información. Se decide mantenerlo de todas formas como una **denormalización deliberada**: permite consultar y filtrar ventas por producto sin necesidad de un `JOIN` contra Compra en cada consulta (por ejemplo, para HU-07, historial de compra/venta de un producto). La capa de lógica de negocio debe garantizar, al registrar cada Ítem de Venta, que `producto_id` coincida siempre con el `producto_id` de la Compra referenciada en `compra_id`, para que ambos campos nunca queden desincronizados.

**Corrección importante respecto de una versión anterior de este documento:** se había planteado `compra_id` como campo opcional, asumiendo que solo hacía falta cuando interesaba trazabilidad de garantía. Sin embargo, dado que `Producto.stock` se define como la suma de `Compra.cantidad_disponible` (sección 5), **toda** unidad vendida necesariamente descuenta de algún lote — por lo tanto `compra_id` debe ser **obligatorio** en todos los casos, no solo cuando la garantía importa. Lo que sí varía según el producto es si esa información se usa para validar garantía (HU-06) o simplemente queda registrada sin uso adicional.
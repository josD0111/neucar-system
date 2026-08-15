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
| saldo_pendiente | Calculado a partir de sus Ventas/Servicios a crédito |

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
| stock | Cantidad disponible |
| stock_mínimo | Para notificación de stock bajo (futuro) |

**Relaciones:**
- Un Producto **pertenece** a una Categoría.
- Un Producto es **comprado** a través de muchas Compras (a distintos Proveedores).
- Un Producto es **vendido** a través de muchos ítems de Venta.

## 6. Compra

Registra la adquisición de uno o más Productos a un Proveedor. Resuelve la relación muchos-a-muchos entre Producto y Proveedor, y es donde vive la información de garantía "de origen".

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| producto_id | Producto comprado |
| proveedor_id | Proveedor al que se le compró |
| fecha | Fecha de la compra |
| cantidad | Cantidad de unidades compradas |
| precio_compra | Precio pagado al proveedor (unitario) |
| garantía_proveedor | Duración de la garantía ofrecida por el proveedor (relevante sobre todo en baterías) |
| factura | Referencia a la factura de compra |

**Relaciones:**
- Una Compra **pertenece** a un Producto.
- Una Compra **pertenece** a un Proveedor.

## 7. Venta

Registra la venta de uno o más Productos a un Cliente (o cliente casual).

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| cliente_id | Cliente asociado (opcional si es venta casual y no es a crédito) |
| usuario_id | Usuario que registró la venta |
| fecha | Fecha de la operación |
| método_pago | Efectivo, tarjeta, transferencia, QR |
| tipo_pago | Contado \| Crédito |
| monto_total | Suma de los ítems vendidos |
| tipo_comprobante | Factura común \| Factura electrónica (futuro) |

**Relaciones:**
- Una Venta **pertenece** a (opcionalmente) un Cliente.
- Una Venta **es registrada por** un Usuario.
- Una Venta tiene muchos **Ítems de Venta**.

### 7.1 Ítem de Venta

Detalle de cada producto dentro de una Venta (una Venta puede incluir varios Productos).

| Atributo | Descripción |
|---|---|
| id | Identificador único |
| venta_id | Venta a la que pertenece |
| producto_id | Producto vendido |
| cantidad | Unidades vendidas |
| precio_unitario | Precio aplicado (puede diferir del precio_base si hubo descuento — ver HU-18) |
| garantía_ofrecida | Garantía otorgada al cliente para ese producto en esa venta |

**Relaciones:**
- Un Ítem de Venta **pertenece** a una Venta.
- Un Ítem de Venta **referencia** un Producto.

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
| tipo_pago | Contado \| Crédito (aplica al total de la visita) |
| monto_total | Suma de los montos de los Servicios incluidos |
| garantía_dias | Días de garantía ofrecidos sobre el trabajo completo de la visita (opcional; no todos los trabajos la incluyen) |
| tipo_comprobante | Factura común \| Factura electrónica (futuro) |

**Relaciones:**
- Una Orden de Servicio **pertenece** a un Vehículo.
- Una Orden de Servicio **pertenece** a un Cliente.
- Una Orden de Servicio **es registrada por** un Usuario.
- Una Orden de Servicio tiene uno o muchos **Servicios** (detalle).

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

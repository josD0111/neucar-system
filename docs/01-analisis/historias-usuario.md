# Historias de Usuario

*Elaboradas a partir de la entrevista al dueño del taller (30/06/2026) y del documento `desiciones-alcance.md`.*

Roles considerados: **Administrador** (dueño / esposa) y **Empleado** (Rey).

## 1. Productos y stock

**HU-01**
> Como Administrador, quiero registrar productos con su categoría, precio y stock inicial, para poder gestionar el inventario del taller.

**HU-02**
> Como Administrador o Empleado, quiero buscar productos por tipo (neumáticos, baterías, lubricantes, filtros, etc.), para encontrar rápidamente lo que el cliente necesita.

**HU-03**
> Como Administrador o Empleado, quiero consultar el precio y stock disponible de un producto, para informar al cliente sin necesidad de revisar el depósito físicamente.

**HU-04**
> Como Administrador, quiero ver únicamente los productos que están en existencia, para no perder tiempo revisando productos agotados.

**HU-05**
> Como Administrador, quiero imprimir el listado de existencias, para verificar físicamente el stock en el depósito.

**HU-06**
> Como Administrador, quiero registrar la garantía de un producto (por ejemplo, la fecha de garantía del proveedor para baterías), para poder calcular la garantía que ofrezco al cliente al momento de la venta.

**Criterios de aceptación:**
- Dado que registro la compra de un producto con garantía (ej. una batería), cuando ingreso la fecha de compra y los meses de garantía otorgados por el proveedor, entonces el sistema calcula y guarda la fecha de vencimiento de la garantía del proveedor.
- Dado un producto con stock proveniente de más de una Compra (lote), con distinta `garantía_proveedor` cada una, cuando se vende una unidad, entonces la garantía que se le puede ofrecer al cliente se valida contra la `garantía_proveedor` del lote (Compra) específico del cual salió esa unidad — no contra un valor genérico del Producto (ver `entidades-dominio.md`, sección 14).
- Dado un producto con garantía de proveedor registrada, cuando lo vendo a un cliente, entonces el sistema debe permitirme definir la garantía que le ofrezco a ese cliente, sin superar la garantía restante del proveedor del lote correspondiente a la fecha de venta.
- Dado que la regla exacta de cálculo del margen (ej. "12-13 meses si el proveedor da 18") no está confirmada como fija para todos los productos, el sistema debe permitir ingresar la garantía ofrecida al cliente de forma manual en el MVP, y no calcularla automáticamente, hasta confirmar la regla con el dueño (ver pregunta abierta en `desiciones-alcance.md`).
- Dado un producto sin garantía aplicable (ej. un filtro), cuando lo registro, entonces el campo de garantía debe poder quedar vacío u omitido, sin bloquear el registro del producto.

**HU-07**
> Como Administrador, quiero ver el historial de compra y venta de un producto, incluyendo proveedor, fecha, estado y cliente (si fue vendido), para saber si el producto tiene una salida rentable.

**HU-08** *(futuro)*
> Como Administrador, quiero recibir una notificación cuando un producto esté por debajo de un stock mínimo definido, para reponerlo a tiempo.

## 2. Clientes

**HU-09**
> Como Administrador o Empleado, quiero registrar los datos de un cliente (nombre, cédula, celular, RUC), para poder identificarlo en futuras compras o servicios.

**HU-10**
> Como Administrador, quiero registrar a crédito uno o más productos de una venta (independientemente de otros productos de la misma venta que se paguen al contado), para llevar el control de lo que me debe el cliente por cada producto.

**Criterios de aceptación:**
- Dado que registro una venta con varios productos, cuando indico la forma de pago, entonces el sistema me permite definirla **por cada producto/ítem de la venta**, no para la venta completa (ej. 1 producto al contado y 2 a crédito, en la misma venta).
- Dado un ítem de venta marcado como "a crédito", cuando lo guardo, entonces el sistema exige asociar la venta a un cliente registrado (no permite ítems a crédito en venta a cliente "casual" no registrado).
- Dado un ítem de venta a crédito, cuando se guarda, entonces el sistema incrementa el saldo pendiente del cliente en el monto de ese ítem específico.
- Dado que el sistema no define actualmente una fecha límite de pago (pregunta abierta en `desiciones-alcance.md`), el MVP registra el crédito sin fecha de vencimiento; queda como saldo abierto hasta que se registren pagos suficientes.
- Dado un empleado (rol Empleado) que intenta registrar una venta con algún ítem a crédito, cuando lo hace, entonces el sistema le permite hacerlo al precio base (sin descuento), ya que la restricción del rol Empleado es sobre descuentos, no sobre la forma de pago.

**HU-10.1**
> Como Administrador, quiero registrar un pago (cuota) sobre un ítem de venta o una orden de servicio a crédito, para reflejar lo que el cliente va abonando y actualizar su saldo pendiente.

**Criterios de aceptación:**
- Dado un ítem de venta (o una orden de servicio) a crédito con saldo pendiente mayor a cero, cuando registro un pago por un monto menor o igual al saldo, entonces el sistema resta ese monto del saldo pendiente de ese ítem/orden específico, sin afectar el saldo de otros ítems u órdenes del mismo cliente.
- Dado un ítem de venta a crédito, cuando la suma de sus pagos registrados iguala su monto original, entonces el sistema lo considera saldado (saldo pendiente = 0) y deja de contarlo en el saldo total del cliente.
- Dado que un cliente tiene dos productos a crédito de una misma venta, cuando paga por completo uno de ellos, entonces el otro producto conserva su saldo pendiente sin modificaciones, y sus futuros pagos se siguen registrando de forma independiente.
- Dado un intento de registrar un pago por un monto mayor al saldo pendiente del ítem/orden, el sistema debe advertir o rechazar la operación (a definir en diseño si se permite dejar saldo a favor).

**HU-11**
> Como Administrador, quiero ver el saldo pendiente de un cliente y el detalle de qué productos o servicios específicos lo componen (con su saldo individual), para gestionar los cobros.

**Criterios de aceptación:**
- Dado un cliente con uno o más ítems de venta y/o órdenes de servicio a crédito, cuando consulto su ficha, entonces el sistema muestra el saldo total pendiente y el detalle de cada ítem/orden que lo compone, con su producto o tipo de servicio, fecha, monto original y saldo pendiente individual.
- Dado un cliente con un ítem de venta ya saldado (pagos = monto original) y otro con saldo pendiente, cuando consulto su ficha, entonces el sistema solo muestra en el detalle de deuda el ítem que todavía tiene saldo pendiente.
- Dado un cliente sin deudas pendientes, cuando consulto su ficha, entonces el sistema indica saldo cero, sin mostrar operaciones ya saldadas como pendientes.

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

## 4. Ventas de productos

**HU-17**
> Como Empleado, quiero registrar una venta de producto al precio base, para atender a un cliente sin necesidad de intervención del dueño.

**Criterios de aceptación:**
- Dado que un usuario con rol Empleado registra una venta, cuando ingresa el/los producto(s), entonces el sistema usa siempre el precio base del producto, sin mostrar ni habilitar ningún campo para modificarlo.
- Dado que un Empleado intenta modificar el precio de un producto en una venta (por ejemplo, mediante manipulación directa de un formulario o API), cuando el sistema procesa la operación, entonces debe rechazarla o forzar el precio base, ya que la restricción de permisos se valida también del lado del servidor y no solo en la interfaz.
- Dado que un Empleado completa una venta al precio base, cuando la confirma, entonces el sistema descuenta el stock correspondiente (ver HU-20), sin requerir aprobación del Administrador.

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
- Dado un producto sin stock suficiente para cubrir la cantidad solicitada, cuando se intenta registrar la venta, entonces el sistema debe advertir la falta de stock antes de confirmar la operación (a definir en diseño si bloquea la venta o solo advierte, dado que el dueño no mencionó una regla estricta al respecto).
- Dado que un Empleado no tiene permiso para "descontar mercaderías" manualmente (según la entrevista), cuando registra una venta normal, entonces el descuento automático de stock por venta sí debe ocurrir igual, ya que la restricción del Empleado aplica a ajustes manuales de inventario, no al descuento derivado de una venta legítima.
- Dado que se anula o cancela una venta ya confirmada, cuando se realiza la anulación, entonces el sistema debe reponer el stock descontado (a confirmar si la anulación de ventas es parte del MVP).

**HU-21**
> Como Administrador, quiero emitir un comprobante de venta (factura común, y en el futuro electrónica), para respaldar la operación ante el cliente.

## 5. Servicios

**HU-22**
> Como Administrador o Empleado, quiero registrar un servicio realizado a un vehículo (tipo de servicio, fecha, marca, número de chapa, color y monto), para llevar un registro ordenado de lo que antes se anotaba en el cuaderno.

**HU-23**
> Como Administrador, quiero registrar varios servicios solicitados por un mismo cliente para un mismo vehículo en una sola orden, para reflejar cómo se atiende realmente al cliente.

**HU-24**
> Como Administrador, quiero informar el costo estimado de un servicio antes de realizarlo, para que el cliente lo conozca de antemano.

**HU-25**
> Como Administrador, quiero registrar opcionalmente una garantía (en días) sobre el trabajo completo realizado en una visita, para poder verificarla si el cliente vuelve por un reclamo.

**HU-26**
> Como Administrador, quiero consultar el historial de servicios de un cliente o vehículo (por ejemplo, alineaciones realizadas y sus fechas), para verificar la vigencia de la garantía y las condiciones de entrega.

**HU-27**
> Como Administrador, quiero registrar una visita/orden de servicio "a crédito" para un cliente de confianza, para permitirle pagarla más adelante sin perder el registro de la deuda.

**Criterios de aceptación:**
- Dado que registro una orden de servicio con uno o más servicios realizados, cuando marco la orden completa como pendiente de pago, entonces el sistema exige registrar (o seleccionar) al cliente correspondiente, con al menos su nombre, ya que según la entrevista este caso no siempre implica un registro completo de datos.
- Dado que el crédito en servicios se maneja sobre el total de la visita (no por cada servicio individual dentro de ella — ver `entidades-dominio.md`, sección 13), cuando la orden tiene varios servicios, el sistema no permite marcar unos como contado y otros como crédito dentro de la misma orden.
- Dado una orden de servicio registrada como pendiente de pago, cuando se guarda, entonces el sistema la suma al saldo pendiente del cliente, de la misma forma que un ítem de venta a crédito (ver HU-10/HU-11).
- Dado que el cliente va abonando la orden de a cuotas, se aplica el mismo mecanismo de registro de pagos parciales definido en HU-10.1, actualizando el saldo pendiente de la orden hasta saldarla.
- Dado que no existe actualmente un criterio formal de "cliente de confianza" en el sistema (es una decisión subjetiva del dueño en el momento), el MVP no debe validar ni restringir quién puede recibir una orden a crédito; queda a criterio del Administrador al momento de registrar la operación.

## 6. Reportes (futuro)

**HU-28** *(futuro)*
> Como Administrador, quiero ver un reporte de ventas realizadas en un período de tiempo determinado, para conocer el desempeño del negocio.

**HU-29** *(futuro)*
> Como Administrador, quiero ver un reporte de gastos y ganancias del taller, para tener una visión financiera general.

## 7. Acceso al sistema (futuro)

**HU-30** *(futuro)*
> Como Administrador, quiero poder acceder al sistema desde mi celular, para consultar información del taller cuando no estoy en la computadora principal.

---

### Notas sobre priorización

- Las historias marcadas como *(futuro)* corresponden a funcionalidades post-MVP, según lo definido en `desiciones-alcance.md`.
- El resto de las historias (HU-01 a HU-27, salvo las marcadas) se consideran parte del alcance del MVP.
- Falta definir el orden de implementación (sprints/iteraciones) de las historias del MVP; se recomienda abordarlo en `docs/03-gestion-proyecto/`.

### Notas sobre criterios de aceptación

Se agregaron criterios de aceptación únicamente a las historias identificadas como ambiguas o con reglas de negocio no triviales: **HU-06, HU-10, HU-10.1, HU-11, HU-17, HU-18, HU-20 y HU-27**. Estas son las historias donde una interpretación distinta entre desarrolladores podría llevar a un comportamiento distinto al esperado por el dueño (garantías, crédito/saldo, pagos parciales, permisos por rol, descuento de stock).

*HU-10.1 se agregó a partir de la revisión del modelo de datos (ver `entidades-dominio.md`, sección 12), al detectar que faltaba una historia explícita para el registro de pagos/cuotas parciales sobre un ítem a crédito.*

Varios de estos criterios quedan sujetos a las preguntas abiertas listadas en `desiciones-alcance.md` (ej. regla exacta de cálculo de garantía, existencia de vencimiento en el crédito); se recomienda confirmarlas con el dueño antes de pasar a diseño/implementación de esas partes.

El resto de las historias (CRUD simples de productos, clientes, proveedores, etc.) no cuentan con criterios de aceptación explícitos por considerarse de bajo riesgo de ambigüedad; se pueden agregar más adelante si surge la necesidad.
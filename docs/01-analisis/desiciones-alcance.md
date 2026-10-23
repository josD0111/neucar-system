# Decisiones de Alcance

*Documento elaborado a partir de la entrevista realizada al dueño del taller (30/06/2026), actualizado con los hallazgos de la segunda entrevista (10/09/2026) — ver `docs/01-analisis/entrevistas/entrevista--2026-09-10.md` — y con el feedback recibido al cierre del Sprint 1 (23/10/2026) — ver `docs/01-analisis/entrevistas/reunion-sprint01--2026-10-23.md` y sección 8.*

Este documento define qué funcionalidades formarán parte del sistema en su primera versión (MVP), cuáles quedan planificadas para etapas futuras, y cuáles quedan explícitamente fuera de alcance. El objetivo es acotar el trabajo de desarrollo y evitar ambigüedades sobre qué se va a construir.

## 1. Usuarios y roles del sistema

| Rol | Descripción | Permisos |
| --- | --- | --- |
| **Dueño** | Administrador del sistema | Acceso total: ventas, descuentos, gestión de stock, clientes, proveedores, reportes, configuración |
| **Esposa del dueño** | Usa las mismas credenciales que el dueño | Mismo nivel de acceso que el dueño (no se maneja como rol separado en el MVP) |
| **Empleado (Rey)** | Vendedor / operador básico | Solo funciones básicas: consultar precios y stock, y usar la sección de Ventas como **calculadora** a precio base para informar al cliente. **No puede**: registrar/confirmar una venta (la registra el Administrador — corregido 23/10/2026, ver nota abajo), aplicar descuentos, descontar stock manualmente, ni acceder a reportes o configuración |

**Decisión:** se implementan dos roles a nivel de sistema: `Administrador` y `Empleado`. La esposa no requiere un rol propio, ya que opera con las credenciales del dueño.

**Corrección 23/10/2026** (feedback del dueño al cierre del Sprint 1 — ver `docs/01-analisis/entrevistas/reunion-sprint01--2026-10-23.md`): se aclaró que la sección de Ventas debe ser fácil de usar y sin complicaciones, y que el Empleado accede a ella **únicamente para calcular precios** (arma el carrito, ve el total a precio base), pero **no registra la venta** — eso lo hace el Administrador después. Esto corrige la definición original (30/06/2026), que asumía que el Empleado también registraba la operación completa al precio base sin intervención del dueño. Ver `historias-usuario.md`, HU-17 (corregida) y HU-17.1 (nueva), y sección 8 más abajo.

## 2. Alcance funcional — MVP (primera versión)

### 2.1 Gestión de productos y stock

- Registro de productos (nombre, categoría/tipo, precio, stock disponible).
- Gestión de categorías de producto por parte del Administrador (creación, edición, eliminación), para habilitar el filtrado del catálogo según las necesidades del taller. No se trabaja con una lista fija de categorías predefinidas.
- Clasificación por tipo de producto (neumáticos, lubricantes, cubiertas, baterías, filtros de aire/aceite/caja, etc.) para búsqueda rápida.
- Consulta de existencias en tiempo real.
- Notificación de stock mínimo/escaso por producto. *(Incorporado al MVP el 12/10/2026; originalmente estaba en la sección 3 como funcionalidad post-MVP — ver nota en esa sección.)*
- Registro de garantía por producto, con manejo particular para baterías (fecha de garantía del proveedor vs. garantía ofrecida al cliente).
- Historial de movimientos de un producto: compra (proveedor, fecha, condición), venta (cliente, fecha, estado).

### 2.2 Gestión de clientes

- Registro de clientes: nombre, cédula, celular, RUC (opcional, para factura electrónica).
- Distinción entre cliente "casual" y cliente registrado con historial.
- Baja lógica de clientes: un cliente nunca se elimina (para no perder su historial de ventas/servicios), solo se deshabilita/habilita, acción restringida al Administrador. *(Decisión tomada durante la implementación del Sprint 1, sin pasar antes por una historia de usuario explícita — ver `entidades-dominio.md`, sección 2, nota sobre `activo`.)*
- Registro de ventas/servicios a crédito o cuota, con saldo pendiente por cliente.
- Registro de la fecha en la que el cliente debería pagar su próxima cuota, con un valor sugerido por defecto (créditos de hasta 2 meses, normalmente en 2 cuotas) pero sin bloquear al Administrador si quiere definir otra fecha *(agregado tras entrevista 10/09/2026 — ver HU-10.2)*.
- Aviso/listado de créditos vencidos (ítems de venta u órdenes de servicio con `fecha_pago_prevista` ya pasada y saldo pendiente), para que el Administrador le avise al dueño *(agregado tras entrevista 10/09/2026 — ver HU-10.2)*.
- Impresión de comprobante de saldo/deuda para firma del cliente.

### 2.3 Gestión de proveedores

- Registro de proveedores.
- Asociación de un producto a múltiples proveedores (sin proveedor prioritario).
- Registro de compras: proveedor, precio de compra, garantía ofrecida, factura asociada.

### 2.4 Ventas de productos

- Registro de venta con descuento de stock automático. **Solo el rol Administrador registra/confirma la venta** *(corregido 23/10/2026 — ver sección 1 y sección 8)*; el Empleado puede armar el carrito y calcular el total a precio base para informar al cliente, pero no confirmar la operación. El Administrador es además el único rol que puede aplicar descuentos de precio.
- Métodos de pago: efectivo, tarjeta, transferencia bancaria, QR.
- Preparación para emisión de factura electrónica y factura común (impresión física).

### 2.5 Gestión de servicios

- Registro de servicios ofrecidos: alineación, balanceo, corrección de pisada, mantenimiento, montaje, cambio de pico, gomería, venta de cubierta, entre otros.
- Un cliente puede solicitar múltiples servicios para un mismo vehículo en una misma orden.
- Datos mínimos por servicio realizado: fecha, marca del vehículo, número de chapa, color del vehículo, monto, y opcionalmente el detalle de la parte afectada (ej. cantidad de ruedas en alineación/balanceo) *(campo agregado tras entrevista 10/09/2026, en reemplazo del campo de garantía — ver abajo)*.
- Cotización previa: informar el costo antes de realizar el servicio.
- Historial de servicios por cliente/vehículo (para saber qué se le hizo al vehículo y cuándo).
- Posibilidad de servicio "a crédito" para clientes de confianza (se registra que el cliente queda debiendo).

*Actualizado tras entrevista 10/09/2026: se elimina del alcance la garantía sobre servicios. El dueño aclaró explícitamente que no es necesario registrarla — alcanza con tener el historial de lo realizado. Ver `entidades-dominio.md`, sección 9, e historia HU-25 (descartada).*

### 2.6 Reportes e impresión

- Impresión de listado de existencias (stock), pensado para verificación física en el depósito.
- Impresión de comprobantes de saldo/crédito de clientes.

## 3. Alcance funcional — Futuras iteraciones (post-MVP)

Estas funcionalidades fueron mencionadas por el dueño como deseables, pero no son prioritarias para la primera versión:

- ~~Notificación automática de stock mínimo/escaso.~~ *(Movida al MVP el 12/10/2026 — ver sección 2.1. El equipo reconsideró la prioridad de esta funcionalidad por su conveniencia para el dueño desde el inicio.)*
- Reportes y estadísticas: ventas por período, gastos, ganancias, movimiento de recursos.
- Análisis de rentabilidad/salida de productos (qué tan bien se vende un producto).
- Acceso al sistema desde celular (el sistema es de escritorio en el MVP).

## 4. Explícitamente fuera de alcance

- **Registro de qué empleado atendió cada vehículo/servicio**: el dueño indicó que no es necesario.
- **Priorización automática de proveedores**: no aplica, ya que el dueño elige libremente según precio/servicio en cada compra.
- **Gestión de pedidos a proveedores dentro del sistema**: los pedidos se siguen haciendo por teléfono; el sistema no gestiona este flujo en el MVP.

## 5. Supuestos y restricciones técnicas

- El sistema funcionará principalmente en una notebook nueva (a adquirir) con conexión Wi-Fi disponible en el local.
- Se contará con una impresora para los comprobantes y reportes en físico.
- El sistema debe priorizar la simplicidad de uso por sobre funcionalidades avanzadas, dado el perfil de los usuarios (dueño, esposa, empleado).

## 6. Referencia técnica — Facturación electrónica en Paraguay (SIFEN)

Esta sección resume el marco técnico vigente para que el sistema quede *preparado* para emitir factura electrónica, tal como pidió el dueño, aunque su implementación completa no sea parte del MVP.

**Organismo y sistema:** la SET (Subsecretaría de Estado de Tributación) es responsable del SIFEN, la plataforma para la emisión, recepción y gestión de documentos tributarios electrónicos en Paraguay, que reemplaza progresivamente a las facturas preimpresas.

**Vías de emisión disponibles** (relevante para decidir cómo integrar a futuro):

- e-Kuatia'i: herramienta gratuita provista por la DNIT, pensada para pequeños y medianos contribuyentes con menor volumen de emisión, que permite emitir documentos electrónicos sin necesidad de un sistema propio. Es la opción más simple, ya que no requiere integración técnica.
- e-Kuatia (sistema transaccional): pensado para empresas con volumen y sistemas propios, que se integran al SIFEN mediante servicios web, y requiere desarrollo propio o un proveedor tecnológico habilitado. Es la vía relevante si más adelante se quiere emitir directamente desde Neucar-System.

**Flujo técnico general:** cada documento se estructura en formato XML y pasa por validaciones técnicas antes de ser aprobado, incorporando firma digital según los estándares de la autoridad tributaria. Según el caso se aplica validación previa (donde se asigna un Código de Control, CDC, que convierte al documento en DTE) o posterior; el documento validado se remite al receptor electrónico, y si este no es electrónico, se le entrega el KuDE en formato impreso o digital. Tanto emisor como receptor deben conservar los DTE durante 5 años.

**Obligatoriedad y contexto 2026:** para 2026 la obligatoriedad de SIFEN alcanza a grandes contribuyentes, medianos contribuyentes designados por resolución de la SET, y contribuyentes voluntarios. Un taller como Neucar probablemente no está aún obligado (según tamaño/categoría de contribuyente), pero puede adherirse de forma voluntaria.

**Implicancias para el diseño del sistema:**

- El modelo de datos de ventas/facturas debería contemplar desde ya los campos que exige un DTE (timbrado, punto de expedición, RUC/cédula del cliente, tipo de comprobante), aunque en el MVP solo se use para factura común.
- Conviene diseñar el módulo de facturación de forma desacoplada (ej. generación del comprobante separada de su "envío/timbrado"), para poder enchufar más adelante la integración con e-Kuatia o e-Kuatia'i sin rehacer el módulo de ventas.
- Dado el volumen de un taller pequeño, **e-Kuatia'i** es la opción más realista a futuro por no requerir desarrollo de integración propia; si el negocio crece, se podría evaluar el modelo transaccional (e-Kuatia) con servicios web.

*Nota: este es un resumen orientativo. Antes de implementar la integración real, se debe consultar el Manual Técnico del SIFEN publicado por la DNIT/SET para conocer las especificaciones exactas y vigentes.*

## 7. Preguntas abiertas / a confirmar con el cliente

### 7.1 Resueltas en la entrevista del 10/09/2026

- **¿Cómo se calcula exactamente el margen de garantía ofrecido al cliente respecto a la garantía del proveedor?** → No hay regla fija; el dueño lo calcula caso a caso. Se confirma el diseño actual (carga manual del campo, sin cálculo automático — ver HU-06).
- **¿El saldo de un cliente a crédito tiene fecha límite de pago o vencimiento?** → Sí, hasta 2 meses, normalmente dividido en 2 cuotas mensuales. Se implementa como un valor **sugerido por defecto**, no como un bloqueo — el Administrador puede definir otra fecha libremente (ver HU-10.2). Además, el dueño pidió que el sistema avise si el cliente no viene a pagar en la fecha prevista; esto se incorporó al alcance del MVP (ver sección 2.2).
- **¿Se requiere un histórico de cambios de precio de los productos?** → No. El dueño indicó que no le interesa el histórico, solo los datos presentes. No se agrega ningún mecanismo de historial de precios al modelo.

### 7.2 Siguen abiertas / nuevas tras la entrevista del 10/09/2026

- ¿Qué datos exactos requiere la factura electrónica en Paraguay para la integración futura (timbrado, punto de expedición, etc.)? El local ya cuenta con RUC, pero todavía no tiene firma digital — dato relevante para la sección 6, pendiente de confirmar el resto.
- **[Nueva]** Alcance exacto del campo `detalle`/"partes afectadas" en Servicio (ver `entidades-dominio.md`, sección 9.1): el dueño mencionó el caso de alineación/balanceo (cantidad de ruedas), pero no se definió si aplica a otros tipos de servicio ni con qué estructura (texto libre vs. campo numérico).
- Anulación de venta (ver `sprint-2-backlog.md`, punto 1): sigue sin cerrarse si entra en el alcance de este sprint o se pospone. A diferencia de las cuatro preguntas resueltas en 7.3, esta todavía requiere que el equipo la defina antes de implementar ese ítem puntual.

### 7.3 Resueltas por el equipo, sin pasar por el dueño (23/10/2026)

*Estas cuatro preguntas quedaban abiertas en `sprint-2-backlog.md` como decisiones de diseño técnico (no reglas de negocio del taller en sí), y el equipo las cerró directamente para poder avanzar con la implementación del Sprint 2:*

- **Selección del lote al vender (ver `entidades-dominio.md`, sección 14):** se descarta PEPS/FIFO automático. El Administrador elige manualmente de qué Compra (lote) sale cada Ítem de Venta, viendo en pantalla las Compras disponibles del producto con su `cantidad_disponible` y `garantía_proveedor`. Si una venta debe repartirse entre varios lotes, el Administrador agrega manualmente un Ítem de Venta por lote.
- **Stock insuficiente al vender (HU-20):** el sistema **bloquea** la venta si la cantidad solicitada supera el stock disponible (sumando lo disponible en los lotes elegibles); no se permite continuar con una advertencia solamente.
- **Pago que supera el saldo pendiente (HU-10.1):** no se rechaza, pero tampoco se genera saldo a favor del cliente. El monto de Pago que se guarda en el sistema queda limitado al saldo pendiente exacto (el ítem/orden queda en `saldo_pendiente = 0`); si el cliente entrega más efectivo que eso, la diferencia es un "vuelto" que se calcula y muestra en pantalla al momento de cobrar, pero no se persiste como un pago ni como saldo a favor para compras futuras.
- **Cotización previa de un servicio (HU-24):** no se modela como un estado de la Orden de Servicio. Es un cálculo en pantalla (sumar servicios y montos, mostrar el total estimado) similar a la "calculadora" de Ventas del Empleado (HU-17) — no se crea ningún registro en la base de datos hasta que el trabajo se confirma y se registra la Orden de Servicio real.

## 8. Feedback del dueño — cierre de Sprint 1 (23/10/2026)

*Resumen trasladado de `docs/01-analisis/entrevistas/reunion-sprint01--2026-10-23.md`, con el detalle de en qué documento quedó reflejado cada punto.*

### 8.1 Interfaz

- El dueño pidió letra más grande y más clara en toda la aplicación. Queda registrado como tarea de usabilidad en `docs/03-gestion-proyecto/sprint-2-backlog.md`, sección "Feedback de usabilidad" — aplica tanto a las pantallas nuevas de Sprint 2 como, si el ajuste se hace a nivel de tokens de diseño, a las ya construidas en Sprint 1.

### 8.2 Flujo de carga en formularios

- En los formularios de alta de Producto y de Compra (Sprint 1), el dueño pidió que el cursor arranque ya posicionado en el primer campo, y que la tecla Enter mueva el foco al siguiente campo en vez de intentar enviar el formulario. Se toma como criterio general a aplicar también en los formularios nuevos de Sprint 2 (Venta, Orden de Servicio, Vehículo, Pago) — ver tarea en `sprint-2-backlog.md`.

### 8.3 Impresión de existencias (amplía HU-05)

- El dueño pidió poder filtrar qué productos se incluyen en la impresión del listado de existencias (HU-05, ya implementada en Sprint 1), ya sea por categoría puntual o mostrando solo los de stock bajo. No es una historia nueva, sino una adenda a HU-05 — ver `historias-usuario.md` y la tarea correspondiente en `sprint-2-backlog.md`.

### 8.4 Rol Empleado en Ventas — corrección (ver también sección 1)

- El dueño aclaró que la sección de Ventas debe ser simple, y que el Empleado accede a ella solo para calcular precios y así poder informar al cliente — **no para registrar la venta**, operación que queda exclusivamente a cargo del Administrador. Esto corrige el supuesto original (30/06/2026) de que el Empleado también registraba la venta completa al precio base. Impacta: la tabla de roles (sección 1), el alcance de Ventas (sección 2.4), HU-17 (corregida) y HU-17.1 (nueva) en `historias-usuario.md`, y el punto 1 (Ventas) de `sprint-2-backlog.md`.
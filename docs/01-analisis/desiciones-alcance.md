# Decisiones de Alcance

*Documento elaborado a partir de la entrevista realizada al dueño del taller (30/06/2026), actualizado con los hallazgos de la segunda entrevista (10/09/2026) — ver `docs/01-analisis/entrevistas/entrevista--2026-09-10.md`.*

Este documento define qué funcionalidades formarán parte del sistema en su primera versión (MVP), cuáles quedan planificadas para etapas futuras, y cuáles quedan explícitamente fuera de alcance. El objetivo es acotar el trabajo de desarrollo y evitar ambigüedades sobre qué se va a construir.

## 1. Usuarios y roles del sistema

| Rol | Descripción | Permisos |
| --- | --- | --- |
| **Dueño** | Administrador del sistema | Acceso total: ventas, descuentos, gestión de stock, clientes, proveedores, reportes, configuración |
| **Esposa del dueño** | Usa las mismas credenciales que el dueño | Mismo nivel de acceso que el dueño (no se maneja como rol separado en el MVP) |
| **Empleado (Rey)** | Vendedor / operador básico | Solo funciones básicas: consultar precios y stock, registrar ventas a precio base. **No puede**: aplicar descuentos, descontar stock manualmente, ni acceder a reportes o configuración |

**Decisión:** se implementan dos roles a nivel de sistema: `Administrador` y `Empleado`. La esposa no requiere un rol propio, ya que opera con las credenciales del dueño.

## 2. Alcance funcional — MVP (primera versión)

### 2.1 Gestión de productos y stock

- Registro de productos (nombre, categoría/tipo, precio, stock disponible).
- Clasificación por tipo de producto (neumáticos, lubricantes, cubiertas, baterías, filtros de aire/aceite/caja, etc.) para búsqueda rápida.
- Consulta de existencias en tiempo real.
- Registro de garantía por producto, con manejo particular para baterías (fecha de garantía del proveedor vs. garantía ofrecida al cliente).
- Historial de movimientos de un producto: compra (proveedor, fecha, condición), venta (cliente, fecha, estado).

### 2.2 Gestión de clientes

- Registro de clientes: nombre, cédula, celular, RUC (opcional, para factura electrónica).
- Distinción entre cliente "casual" y cliente registrado con historial.
- Registro de ventas/servicios a crédito o cuota, con saldo pendiente por cliente.
- Registro de la fecha en la que el cliente debería pagar su próxima cuota, con un valor sugerido por defecto (créditos de hasta 2 meses, normalmente en 2 cuotas) pero sin bloquear al Administrador si quiere definir otra fecha *(agregado tras entrevista 10/09/2026 — ver HU-10.2)*.
- Aviso/listado de créditos vencidos (ítems de venta u órdenes de servicio con `fecha_pago_prevista` ya pasada y saldo pendiente), para que el Administrador le avise al dueño *(agregado tras entrevista 10/09/2026 — ver HU-10.2)*.
- Impresión de comprobante de saldo/deuda para firma del cliente.

### 2.3 Gestión de proveedores

- Registro de proveedores.
- Asociación de un producto a múltiples proveedores (sin proveedor prioritario).
- Registro de compras: proveedor, precio de compra, garantía ofrecida, factura asociada.

### 2.4 Ventas de productos

- Registro de venta con descuento de stock automático (solo rol Administrador puede aplicar descuentos de precio).
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

- Notificación automática de stock mínimo/escaso.
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
- Trazabilidad de garantía por lote de compra (ver `entidades-dominio.md`, sección 14): cuando el dueño repone stock del mismo producto con una garantía de proveedor distinta, ¿puede distinguir físicamente las unidades de cada compra (ej. fecha de fabricación visible), o quedan mezcladas en el depósito? Define si el sistema puede aplicar FIFO automático al descontar stock o si el dueño debe elegir el lote manualmente en cada venta. No se tocó en esta entrevista.
- **[Nueva]** Alcance exacto del campo `detalle`/"partes afectadas" en Servicio (ver `entidades-dominio.md`, sección 9.1): el dueño mencionó el caso de alineación/balanceo (cantidad de ruedas), pero no se definió si aplica a otros tipos de servicio ni con qué estructura (texto libre vs. campo numérico).
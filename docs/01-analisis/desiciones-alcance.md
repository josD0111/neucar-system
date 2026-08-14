# Decisiones de Alcance

*Documento elaborado a partir de la entrevista realizada al dueño del taller (30/06/2026).*

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
- Datos mínimos por servicio realizado: fecha, marca del vehículo, número de chapa, color del vehículo, monto, garantía ofrecida (en días).
- Cotización previa: informar el costo antes de realizar el servicio.
- Historial de servicios por cliente/vehículo (para verificar condiciones de entrega y vigencia de garantía).
- Posibilidad de servicio "a crédito" para clientes de confianza (se registra que el cliente queda debiendo).

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

**Organismo y sistema:** la <cite index="7-1">SET (Subsecretaría de Estado de Tributación) es responsable del SIFEN, la plataforma para la emisión, recepción y gestión de documentos tributarios electrónicos en Paraguay</cite>, que reemplaza progresivamente a las facturas preimpresas.

**Vías de emisión disponibles** (relevante para decidir cómo integrar a futuro):

- <cite index="6-1">e-Kuatia'i: herramienta gratuita provista por la DNIT, pensada para pequeños y medianos contribuyentes con menor volumen de emisión, que permite emitir documentos electrónicos sin necesidad de un sistema propio</cite>. Es la opción más simple, ya que no requiere integración técnica.
- <cite index="6-1">e-Kuatia (sistema transaccional): pensado para empresas con volumen y sistemas propios, que se integran al SIFEN mediante servicios web, y requiere desarrollo propio o un proveedor tecnológico habilitado</cite>. Es la vía relevante si más adelante se quiere emitir directamente desde Neucar-System.

**Flujo técnico general:** <cite index="3-1">cada documento se estructura en formato XML y pasa por validaciones técnicas antes de ser aprobado, incorporando firma digital según los estándares de la autoridad tributaria</cite>. <cite index="4-1">Según el caso se aplica validación previa (donde se asigna un Código de Control, CDC, que convierte al documento en DTE) o posterior; el documento validado se remite al receptor electrónico, y si este no es electrónico, se le entrega el KuDE en formato impreso o digital</cite>. <cite index="4-1">Tanto emisor como receptor deben conservar los DTE durante 5 años</cite>.

**Obligatoriedad y contexto 2026:** <cite index="7-1">para 2026 la obligatoriedad de SIFEN alcanza a grandes contribuyentes, medianos contribuyentes designados por resolución de la SET, y contribuyentes voluntarios</cite>. Un taller como Neucar probablemente no está aún obligado (según tamaño/categoría de contribuyente), pero puede adherirse de forma voluntaria.

**Implicancias para el diseño del sistema:**

- El modelo de datos de ventas/facturas debería contemplar desde ya los campos que exige un DTE (timbrado, punto de expedición, RUC/cédula del cliente, tipo de comprobante), aunque en el MVP solo se use para factura común.
- Conviene diseñar el módulo de facturación de forma desacoplada (ej. generación del comprobante separada de su "envío/timbrado"), para poder enchufar más adelante la integración con e-Kuatia o e-Kuatia'i sin rehacer el módulo de ventas.
- Dado el volumen de un taller pequeño, **e-Kuatia'i** es la opción más realista a futuro por no requerir desarrollo de integración propia; si el negocio crece, se podría evaluar el modelo transaccional (e-Kuatia) con servicios web.

*Nota: este es un resumen orientativo. Antes de implementar la integración real, se debe consultar el Manual Técnico del SIFEN publicado por la DNIT/SET para conocer las especificaciones exactas y vigentes.*

## 7. Preguntas abiertas / a confirmar con el cliente

- ¿Cómo se calcula exactamente el margen de garantía ofrecido al cliente respecto a la garantía del proveedor (regla fija o varía por producto)?
- ¿Qué datos exactos requiere la factura electrónica en Paraguay para la integración futura (RUC del taller, timbrado, etc.)?
- ¿El saldo de un cliente a crédito tiene fecha límite de pago o vencimiento, o queda abierto hasta que se cancele?
- ¿Se requiere un histórico de cambios de precio de los productos?

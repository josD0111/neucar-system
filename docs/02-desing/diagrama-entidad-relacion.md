# Diagrama Entidad-Relación (DER)

*Basado en `entidades-dominio.md`. Representa el modelo de datos completo del sistema, incluyendo las correcciones acordadas en las revisiones posteriores (normalización de Orden de Servicio, garantía a nivel de visita, Categoría como entidad propia, etc.).*

```mermaid
erDiagram
    USUARIO ||--o{ VENTA : registra
    USUARIO ||--o{ ORDEN_SERVICIO : registra

    CLIENTE ||--o{ VENTA : "compra (opcional)"
    CLIENTE ||--o{ ORDEN_SERVICIO : solicita
    CLIENTE ||--o{ VEHICULO : posee

    PROVEEDOR ||--o{ COMPRA : provee

    CATEGORIA ||--o{ PRODUCTO : clasifica

    PRODUCTO ||--o{ COMPRA : "es comprado en"
    PRODUCTO ||--o{ ITEM_VENTA : "es vendido en"

    COMPRA ||--o{ ITEM_VENTA : "es el lote de origen de"

    VENTA ||--|{ ITEM_VENTA : contiene

    ITEM_VENTA ||--o{ PAGO : "recibe (si es crédito)"
    ORDEN_SERVICIO ||--o{ PAGO : "recibe (si es crédito)"

    VEHICULO ||--o{ ORDEN_SERVICIO : "es atendido en"

    ORDEN_SERVICIO ||--|{ SERVICIO : contiene

    USUARIO {
        int id PK
        string nombre
        string usuario_login
        string contraseña
        string rol
    }

    CLIENTE {
        int id PK
        string nombre
        string cedula
        string celular
        string ruc
    }

    PROVEEDOR {
        int id PK
        string nombre
        string contacto
    }

    CATEGORIA {
        int id PK
        string nombre
    }

    PRODUCTO {
        int id PK
        string nombre
        int categoria_id FK
        decimal precio_base
        int stock
        int stock_minimo
    }

    COMPRA {
        int id PK
        int producto_id FK
        int proveedor_id FK
        date fecha
        int cantidad
        int cantidad_disponible
        decimal precio_compra
        int garantia_proveedor
        string factura
    }

    VENTA {
        int id PK
        int cliente_id FK
        int usuario_id FK
        date fecha
        decimal monto_total
        string tipo_comprobante
    }

    ITEM_VENTA {
        int id PK
        int venta_id FK
        int producto_id FK
        int compra_id FK
        int cantidad
        decimal precio_unitario
        int garantia_ofrecida
        string tipo_pago
        decimal saldo_pendiente
    }

    PAGO {
        int id PK
        int item_venta_id FK
        int orden_servicio_id FK
        decimal monto
        date fecha
        string metodo_pago
    }

    VEHICULO {
        int id PK
        int cliente_id FK
        string marca
        string chapa
        string color
    }

    ORDEN_SERVICIO {
        int id PK
        int vehiculo_id FK
        int cliente_id FK
        int usuario_id FK
        date fecha
        string tipo_pago
        decimal monto_total
        decimal saldo_pendiente
        int garantia_dias
        string tipo_comprobante
    }

    SERVICIO {
        int id PK
        int orden_id FK
        string tipo_servicio
        decimal monto
    }
```

## Notas sobre cardinalidades

- **CLIENTE–VENTA** es opcional del lado de Cliente (`o{`), ya que una Venta puede ser a un cliente "casual" no registrado, salvo cuando es a crédito (ver HU-10, donde el registro pasa a ser obligatorio a nivel de regla de negocio, no de modelo de datos).
- **VENTA–ITEM_VENTA** y **ORDEN_SERVICIO–SERVICIO** usan `|{` (uno o muchos) del lado del detalle, porque no tiene sentido una Venta sin productos ni una Orden de Servicio sin al menos un Servicio.
- **PRODUCTO–COMPRA** y **PRODUCTO–PROVEEDOR**: la relación muchos-a-muchos entre Producto y Proveedor no aparece como línea directa en el diagrama, porque queda resuelta a través de la entidad intermedia Compra (Proveedor → Compra → Producto).
- **ORDEN_SERVICIO.garantia_dias** es nullable/opcional, reflejando que el dueño no siempre la ofrece.
- **ITEM_VENTA/ORDEN_SERVICIO–PAGO** son relaciones excluyentes: un Pago referencia a uno de los dos, nunca ambos. Esto permite manejar crédito por producto individual (no por venta completa) y por orden de servicio completa, con pagos parciales acumulables en el tiempo — ver el caso de validación en `entidades-dominio.md`, sección 12.
- **Diferencia clave:** en Venta, `tipo_pago` vive en `ITEM_VENTA` (crédito por producto). En Orden de Servicio, `tipo_pago` vive en `ORDEN_SERVICIO` (crédito por visita completa, no por Servicio individual), reflejando cómo el dueño maneja el crédito en la práctica — ver `entidades-dominio.md`, sección 13.
- **COMPRA–ITEM_VENTA** (`compra_id`, **obligatorio**) traza de qué lote de compra proviene cada unidad vendida. No es opcional: dado que `PRODUCTO.stock` se calcula como la suma de `COMPRA.cantidad_disponible`, toda venta debe descontar de algún lote puntual — ver el problema y la corrección detallados en `entidades-dominio.md`, sección 14. Si la cantidad vendida de un producto supera lo disponible en un solo lote, el sistema genera automáticamente varios Ítems de Venta (uno por lote consumido) dentro de la misma Venta.

## Pendiente de confirmar

Este DER da por definidos los puntos abiertos que quedaban en `entidades-dominio.md` (sección 10), salvo el de "Garantía como entidad propia", que se mantiene resuelto acá como campos embebidos por simplicidad del MVP. Si en el futuro la lógica de garantía se complica (estados, vencimientos automáticos, etc.), este diagrama debería revisarse para introducir una entidad `GARANTIA` separada.
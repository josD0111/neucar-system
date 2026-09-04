# Guion — Próxima reunión con el dueño

*Compila las preguntas abiertas de `desiciones-alcance.md`, los dilemas de diseño de `entidades-dominio.md`, y la validación de las pantallas del prototipo (`plan-gestion-proyecto.md`, sección 2.1). Pensado para llevar a la reunión donde se muestra el prototipo clickeable.*

## Cómo usar este guion

La idea de esta reunión no es solo preguntar, sino **mostrar el prototipo y dejar que las respuestas salgan de ahí**. Por eso cada bloque está ordenado como: "mostrar esta pantalla" → "preguntar esto puntualmente". Si el dueño responde algo distinto a lo que asumimos en el diseño, anotarlo tal cual lo dice, sin reinterpretarlo todavía — eso se revisa después, en frío, con el equipo.

## 1. Garantía de productos (crítico — bloquea `entidades-dominio.md`)

**Mostrar:** la pantalla de carga de una venta con una batería, incluyendo el campo de garantía ofrecida al cliente.

**Preguntar:**
- Cuando el proveedor te da, por ejemplo, 18 meses de garantía en una batería, ¿vos le ofrecés al cliente siempre la misma cantidad de meses menos un margen fijo? ¿O varía según el producto, el proveedor, o el cliente?
- Si varía, ¿de qué depende? (¿tipo de batería, marca, cuánto hace que la tenés en stock?)
- ¿Hay productos donde nunca ofrecés garantía al cliente, aunque el proveedor sí te la haya dado a vos?
- **[Nueva]** Cuando comprás el mismo producto más de una vez (por ejemplo, repones stock de baterías) y la garantía que te da el proveedor cambia de una compra a otra, ¿vos podés distinguir físicamente cuál unidad es de qué compra (por ejemplo, por una fecha de fabricación o número de serie visible en la batería)? ¿O una vez que entra al depósito, se mezcla todo y ya no hay forma de saber cuál es cuál?

**Por qué importa:** hoy el sistema deja este campo para carga manual porque no hay una regla clara. Si el dueño da una regla fija o un patrón, se puede automatizar el cálculo y ahorrarle un paso. La última pregunta es clave para decidir si el sistema puede elegir automáticamente de qué lote de compra descontar stock al vender, o si conviene que el dueño lo elija manualmente en cada venta (ver `entidades-dominio.md`, sección 14).

## 2. Garantía de servicios (crítico)

**Mostrar:** la pantalla de una Orden de Servicio con 2 tareas (ej. alineación + balanceo) y el campo de garantía del trabajo completo.

**Preguntar:**
- Confirmame: cuando ofrecés garantía en un servicio, ¿es sobre todo el trabajo de esa visita, o le das garantía distinta a cada tarea? (ej. ¿la alineación tiene más o menos garantía que el balanceo?)
- ¿Hay algún tipo de servicio donde nunca ofrecés garantía?
- ¿Los días de garantía que ofrecés varían según el servicio, o suele ser siempre la misma cantidad de días?

**Por qué importa:** el modelo actual asume que la garantía es sobre la visita completa, no por tarea — confirmarlo evita tener que rehacer esa parte.

## 3. Nivel de detalle de los servicios (crítico — dilema documentado en `entidades-dominio.md` sección 11)

**Mostrar:** la pantalla de carga de una Orden de Servicio con varias tareas cargadas como líneas separadas (no un solo texto libre tipo "alineación + balanceo").

**Preguntar:**
- Te queríamos mostrar cómo quedaría cargar un servicio en el sistema: cada tarea se anota por separado, con su propio monto, pero todo bajo la misma visita del cliente — ¿te parece más simple, más complicado o igual que anotarlo en el cuaderno como lo hacías antes?
- Si hoy hacés alineación + balanceo en una misma visita, ¿siempre cobrás cada cosa por separado, o a veces cobrás un combo con precio único?

**Por qué importa:** el dueño pidió simplicidad y no detallar demasiado; esta pantalla busca confirmar si el enfoque elegido (varias líneas simples, sin texto libre) realmente no le suma trabajo.

## 4. Crédito y pagos parciales (crítico — HU-10, HU-10.1, HU-11)

**Mostrar:** la pantalla de una venta con 3 productos (1 contado, 2 a crédito) y la ficha de un cliente con su saldo pendiente detallado por producto.

**Preguntar:**
- Cuando un cliente te compra varias cosas y paga algunas al contado y dejás otras a crédito, ¿lo pensás como "le fío una parte de la compra" o como "le fío toda la operación"? (para confirmar si el manejo por producto individual, como lo armamos, coincide con cómo lo pensás vos)
- Cuando el cliente te va pagando de a poco, ¿anotás cuánto pagó cada vez, o solo llevás la cuenta de cuánto le queda debiendo en total?
- **[Pregunta ya identificada]** El saldo de un cliente a crédito, ¿tiene una fecha límite de pago o queda abierto hasta que se cancele?
- Si un cliente te queda debiendo varios productos de compras distintas, ¿te sirve ver el detalle de cuál es cuál, o con el total alcanza?

## 5. Roles y permisos — validar con Rey en mente

**Mostrar:** la pantalla de venta vista con el rol Empleado (sin opción de descuento).

**Preguntar:**
- ¿Esto refleja bien lo que Rey puede y no puede hacer? ¿Hay algo más que debería o no debería poder tocar?
- Aparte de aplicar descuentos, ¿hay alguna otra cosa que solo vos (o tu esposa) deberían poder hacer en el sistema?

## 6. Facturación electrónica

**Preguntar:**
- **[Pregunta ya identificada]** ¿Qué datos exactos necesitás vos para armar una factura (electrónica o física)? Por ejemplo, ¿tenés RUC y timbrado del taller a mano para que los anotemos?
- ¿Hoy facturás con timbrado o todavía usás boleta/nota simple?

## 7. Otras preguntas pendientes

- **[Pregunta ya identificada]** ¿Te sirve tener un historial de cuándo cambiaste el precio de un producto (por ejemplo, para saber cuánto costaba hace 6 meses), o no es algo que necesites?
- Al ver el prototipo en general: ¿hay alguna pantalla que te parezca que le falta algo importante, o que tenga algo de más que no usarías nunca?

## 8. Cierre de la reunión

- Preguntar si, después de ver el prototipo, cambiaría algo de lo que habíamos hablado en la primera entrevista (30/06/2026) — a veces ver algo concreto hace recordar detalles que no salieron antes.
- Confirmar si quiere ver el sistema de nuevo antes de que esté terminado, o prefiere esperar a la versión más avanzada.

---

### Después de la reunión

Actualizar con las respuestas obtenidas:
- `desiciones-alcance.md`, sección 7 (marcar las preguntas resueltas, o mover a una sección de "decisiones confirmadas")
- `entidades-dominio.md`, secciones 11 y 12 (cerrar los dilemas documentados, ajustando el modelo si hace falta)
- `historias-usuario.md` (ajustar criterios de aceptación si alguna regla cambió)
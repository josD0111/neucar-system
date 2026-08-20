# Plan de Gestión de Proyecto

*Basado en `historias-usuario.md` y `entidades-dominio.md`. Define cómo se organiza el trabajo, no qué se construye (eso ya está en `docs/01-analisis` y `docs/02-desing`).*

## 1. Metodología

**Scrum**, adaptado a un equipo de 2 personas y un plazo objetivo de **menos de 4 semanas**.

Al ser un equipo tan chico y sin roles separados (ambos hacen de todo), se simplifican algunas prácticas típicas de Scrum:

- No hay un Product Owner ni Scrum Master separados: el rol de "dueño del producto" lo cumple el dueño del taller (a través de las entrevistas y validaciones), y ambos desarrolladores comparten la facilitación del proceso.
- Las ceremonias se acortan y se adaptan a la escala del equipo (ver sección 4).
- Al no dividir el trabajo por módulo fijo, conviene tomar las historias de a una o dos por vez entre ambos (pair programming en las partes más críticas, como el modelo de crédito/pagos) para evitar reprocesos.

## 2. Duración y sprints

**Duración total estimada: 4 semanas**, con un ajuste importante respecto a un Scrum tradicional: antes de construir el sistema "en serio", se inserta una **fase de prototipo clickeable** para validar el diseño con el dueño. La razón es que la próxima reunión con él busca mostrarle algo navegable (no solo preguntas) y ajustar según su devolución, lo cual afecta directamente cómo modelamos varias entidades (garantía, crédito, servicios).

| Etapa | Duración | Foco |
|---|---|---|
| Sprint 0 | 2-3 días | Setup técnico del proyecto (estructura de `src/`, herramienta elegida para el prototipo) |
| **Sprint 0.5 — Prototipo** | 3-5 días | Pantallas clickeables (sin backend) de los flujos críticos, para validar con el dueño |
| *(Reunión con el dueño)* | — | Mostrar el prototipo, recoger ajustes y **cerrar las preguntas abiertas** de `desiciones-alcance.md` |
| Sprint 1 | 1.5 semanas | Entidades base + operaciones simples, ya con las decisiones del dueño incorporadas |
| Sprint 2 | 1.5 semanas | Ventas, servicios, crédito/pagos |
| Cierre | 2-3 días | Pruebas integrales, corrección de bugs, preparar entrega/demo |

*Nota importante: como todavía no hay fecha fijada para la reunión con el dueño, ese punto es el mayor riesgo de todo el cronograma — ver sección 7. Conviene coordinarla cuanto antes, apenas el prototipo esté listo, para no perder días de las 4 semanas esperando la devolución.*

*Nota: los Sprints 1 y 2 se acortaron a 1.5 semanas cada uno (de 2) para hacerle lugar al Sprint 0.5 dentro de las 4 semanas totales. Si el prototipo lleva más de los 3-5 días estimados, o la reunión con el dueño se demora, hay que estar dispuestos a recortar alcance del MVP (ver Sprint 2) antes que estirar el plazo total.*

### 2.1 Qué debería cubrir el prototipo

Para que la reunión realmente sirva para cerrar las preguntas abiertas (y no solo para "mostrar que existe algo"), conviene que las pantallas clickeables toquen específicamente los puntos ambiguos que quedaron pendientes en el análisis y diseño, y no solo las pantallas más obvias o vistosas:

- **Carga de una venta con productos mixtos** (uno al contado, otros a crédito) — para confirmar con el dueño si el flujo de carga le resulta cómodo (ver `entidades-dominio.md`, sección 12).
- **Carga de una Orden de Servicio con varios servicios en una misma visita** — clave para validar el dilema documentado en `entidades-dominio.md`, sección 11 (si el flujo de "una carga general + una línea por tarea" le resulta tan simple como anotar en el cuaderno).
- **Pantalla de garantía al vender un producto** (ej. batería) — para poder preguntarle concretamente "¿la garantía que le ofrecés al cliente la calculás así, o de otra forma?", en vez de preguntarlo en abstracto.
- **Ficha de cliente mostrando su saldo pendiente y detalle** (HU-11) — para confirmar si el nivel de detalle que se le muestra (por ítem/orden) es el que él espera.
- **Pantalla diferenciada para el rol Empleado** (sin descuentos ni acceso a reportes) — útil para que el dueño confirme si esa restricción cubre lo que necesita para Rey.

No hace falta que el prototipo cubra las 30 historias de usuario; alcanza con estos flujos críticos, que son justamente los que tienen mayor riesgo de ambigüedad.

## 3. Backlog priorizado por sprint

Priorización basada en dependencias del modelo de datos: primero lo que otras entidades necesitan para existir (Usuario, Categoría, Producto, Cliente, Proveedor), después lo que depende de eso (Ventas, Servicios, Crédito).

### Sprint 0 — Preparación (no son historias de usuario, son tareas técnicas)
- Definir stack tecnológico y crear repositorio base (estructura de `src/`).
- Elegir herramienta para el prototipo clickeable (ej. Figma en modo prototipo, o directamente maquetas navegables en HTML/framework elegido, si van a reutilizar ese código después).
- Configurar base de datos según `diagrama-entidad-relacion.md` (puede avanzar en paralelo al prototipo, ya que no depende de él).
- Definir convenciones de código y flujo de trabajo con Git (ramas, commits, pull requests).

### Sprint 0.5 — Prototipo clickeable
- Construir las pantallas navegables listadas en la sección 2.1, sin lógica real ni conexión a base de datos.
- Coordinar la reunión con el dueño apenas el prototipo esté en condiciones de mostrarse (ver riesgo en sección 7).
- Durante o después de la reunión, actualizar `desiciones-alcance.md` (preguntas abiertas) y `entidades-dominio.md` (dilema de servicios, garantía) con las respuestas obtenidas, antes de arrancar el Sprint 1.

### Sprint 1 — Fundación del sistema
Objetivo: al final del sprint, se puede gestionar el catálogo y los actores del negocio, aunque todavía no haya ventas.

- HU-01 a HU-08 — Productos, stock y categorías
- HU-09, HU-13 — Registro de clientes (incluyendo cliente casual)
- HU-14 a HU-16 — Proveedores y compras
- Gestión de Usuarios y roles (Administrador/Empleado) — soporte técnico de HU-17/HU-18, no tiene HU propia todavía; conviene agregarla al backlog si no está.

### Sprint 2 — Operación diaria del taller
Objetivo: al final del sprint, el sistema cubre el flujo completo de atención a un cliente, incluyendo crédito y pagos.

- HU-17 a HU-21 — Ventas de productos (con permisos por rol y descuento de stock)
- HU-22 a HU-27 — Servicios y Órdenes de Servicio
- HU-10, HU-10.1, HU-11, HU-12 — Crédito, pagos parciales y saldo de cliente (la parte más compleja del sistema — reservar tiempo extra)

### Post-MVP / backlog futuro (no entran en las 4 semanas)
- HU-08 (notificación de stock bajo)
- HU-28, HU-29 (reportes y estadísticas)
- HU-30 (acceso móvil)
- Integración real con SIFEN (ver `desiciones-alcance.md`, sección 6)

## 4. Ceremonias (adaptadas a equipo de 2)

| Ceremonia | Frecuencia | Formato sugerido |
|---|---|---|
| Sprint Planning | Al inicio de cada sprint | Reunión corta (30-45 min) para elegir qué historias entran y repartir las primeras tareas |
| Daily | Diaria o día por medio | Mensaje corto (chat/WhatsApp) tipo "qué hice, qué voy a hacer, qué me traba" — no hace falta videollamada si ya se ven seguido |
| Sprint Review | Al final de cada sprint | Mostrarse mutuamente lo construido, idealmente probando el flujo completo de una historia de punta a punta |
| Retrospectiva | Al final de cada sprint | 15-20 min: qué funcionó, qué no, qué cambiar para el próximo sprint |

## 5. Definición de "Terminado" (Definition of Done)

Una historia de usuario se considera terminada cuando:

- El código está escrito y funciona según los criterios de aceptación definidos en `historias-usuario.md` (para las historias que los tienen).
- Fue probada manualmente por el otro integrante del equipo (revisión cruzada, dado que no hay QA separado).
- No rompe funcionalidad existente ya entregada en sprints anteriores.
- Está integrada a la rama principal de desarrollo (no quedó suelta en una rama personal).

## 6. Seguimiento y herramientas sugeridas

Para un equipo de 2 con este plazo, no hace falta una herramienta compleja de gestión. Alcanza con:

- Un **tablero Kanban simple** (Trello, GitHub Projects, o incluso una planilla) con columnas *Por hacer / En progreso / Terminado*, usando las historias de usuario (HU-01, HU-02, etc.) como tarjetas.
- El propio repositorio Git como fuente de verdad del progreso (commits y pull requests referenciando el número de historia, ej. `HU-17: registrar venta a precio base`).

## 7. Riesgos identificados para la planificación

- **La reunión con el dueño todavía no tiene fecha coordinada** — este es el riesgo más urgente del cronograma, porque el Sprint 1 depende de las respuestas que salgan de esa reunión. Se recomienda coordinarla cuanto antes (aunque sea con fecha tentativa), y si se demora más de lo esperado, avanzar el Sprint 1 solo con las partes del modelo que **no** dependen de las preguntas abiertas (ej. Productos, Clientes, Proveedores), dejando para después lo que sí depende de la validación (garantía, dilema de servicios).
- **El módulo de crédito/pagos (HU-10, HU-10.1, HU-11) es el de mayor complejidad técnica** del MVP, según quedó documentado en `entidades-dominio.md` (secciones 12 y 13). Conviene no dejarlo para los últimos días del Sprint 2.
- **El prototipo podría generar cambios de alcance, no solo de detalle** — si el dueño ve las pantallas y pide algo que no estaba contemplado (por ejemplo, un flujo distinto al de HU-23), hay que evaluar si entra en el MVP de 4 semanas o se anota como post-MVP, en vez de aceptarlo automáticamente y arriesgar el plazo.
- **Plazo ajustado (4 semanas) para 2 personas sin roles fijos**: si algún sprint se atrasa, priorizar terminar bien las historias del Sprint 1 (fundación) antes que arrancar el Sprint 2, ya que todo lo demás depende de esa base.
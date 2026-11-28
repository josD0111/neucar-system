# Neucar — Sistema de gestión para taller de autos

Sistema de escritorio para digitalizar la gestión de un taller mecánico:
control de stock por lotes de compra, clientes, proveedores, ventas,
órdenes de servicio y crédito/pagos. Reemplaza el cuaderno en papel que
se usaba hasta ahora.

> **Estado actual (26/11/2026):** Sprint 3 cerrado — ver
> [`context/03-gestion-proyecto/sprint-3-backlog.md`](context/03-gestion-proyecto/sprint-3-backlog.md).
> Ventas tiene su flujo definitivo (búsqueda de producto, carga de ítems,
> pago inicial obligatorio en crédito), Compras y Marcas quedaron en
> secciones propias del sidebar, y Órdenes de Servicio/Vehículos siguen
> conectados a la base real desde el Sprint 2. Sprint 4 está en
> planificación — ver
> [`docs/02-planificacion/planificacion-sprint04.md`](docs/02-planificacion/planificacion-sprint04.md) —
> e incluye, entre otros puntos, rehacer el modelo de kilometraje/próximo
> mantenimiento y pasar la selección de lote en Ventas a un reparto
> automático editable entre lotes.

## Estructura del repositorio

```
.
├── app/         # Aplicación Electron + React + TypeScript (el sistema en sí)
├── context/     # Documentación detallada del proyecto
├── docs/        # Planificación y versiones resumidas para el equipo
├── prototipos/  # Prototipos HTML clickeables usados para validar pantallas con el dueño
└── tests/       # Pruebas (pendiente de poblar)
```

### `context/`

Documentación detallada del proyecto, en el orden en que se fue produciendo:

- **`01-analisis/`** — entrevistas con el dueño del taller, decisiones de
  alcance (`desiciones-alcance.md`) y las historias de usuario
  (`historias-usuario.md`, HU-01 a HU-42) que guían todo el desarrollo.
- **`02-desing/`** — diseño del dominio: diagrama entidad-relación,
  descripción de entidades y la justificación del stack tecnológico
  elegido.
- **`03-gestion-proyecto/`** — plan de gestión (metodología, sprints,
  definición de "terminado") y el backlog detallado de cada sprint.

Antes de tocar código conviene leer `historias-usuario.md` (qué hay que
construir y por qué) y `entidades-dominio.md` (cómo se modela cada cosa),
ya que varias reglas de negocio no triviales (garantías, crédito, permisos
por rol) están documentadas ahí con sus criterios de aceptación.

### `docs/`

Planificación del equipo y versiones resumidas de lo que hay en
`context/`, para seguir el avance del proyecto sin tener que leer el
detalle completo:

- **`01-analisis/`** — actas de entrevistas y reuniones con el dueño
  (`entrevistas/`, `reuniones/`).
- **`02-planificacion/`** — planificación de cada sprint
  (`planificacion-sprint0N.md`).
- **`03-desing/`** — archivo fuente del diagrama entidad-relación
  (`neucar-system-der.mwb`), editable con MySQL Workbench.
- **`04-gestion-proyecto/`** — (todavía sin poblar).

### `app/`

La aplicación en sí. Ver [`app/README.md`](app/README.md) para la puesta
en marcha básica (instalación, modo desarrollo, build). En resumen:

```bash
cd app
npm install
npm run dev          # levanta Electron + el servidor local (127.0.0.1:4000)
```

Al primer arranque se crean automáticamente un usuario Administrador y un
usuario Empleado (ver `app/src/main/db/seed.ts`); las contraseñas
generadas se muestran una única vez en la consola.

**Stack:** Electron, React + TypeScript, Express (API local), Drizzle ORM
sobre PGlite (PostgreSQL embebido). La razón de cada elección está
justificada en `context/02-desing/stack-tecnologico.md`.

## Flujo de trabajo

Equipo de 2 personas, metodología Scrum simplificada (ver
`context/03-gestion-proyecto/plan-gestion-proyecto.md`). El backlog de cada
sprint (tareas técnicas, reparto y estado de avance) vive en
`context/03-gestion-proyecto/sprint-0N-backlog.md`. La planificación previa
a cada sprint, en un formato más liviano para el equipo, vive en
`docs/02-planificacion/planificacion-sprint0N.md`.

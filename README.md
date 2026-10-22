# Neucar — Sistema de gestión para taller de autos

Sistema de escritorio para digitalizar la gestión de un taller mecánico:
control de stock por lotes de compra, clientes, proveedores, ventas,
órdenes de servicio y crédito/pagos. Reemplaza el cuaderno en papel que
se usaba hasta ahora.

> **Estado actual (22/10/2026):** rama `dev/sprint01`, Sprint 1 en curso.
> Login, Categorías, Productos/Stock, Proveedores, Compras y Clientes ya
> están conectados a la base de datos real. Ventas y Órdenes de Servicio
> (Sprint 2) todavía corren sobre datos de ejemplo en memoria. Ver el
> detalle en [`docs/03-gestion-proyecto/sprint-1-backlog.md`](docs/03-gestion-proyecto/sprint-1-backlog.md).

## Estructura del repositorio

```
.
├── app/    # Aplicación Electron + React + TypeScript (el sistema en sí)
├── docs/   # Análisis, diseño y gestión del proyecto
└── tests/  # Pruebas (pendiente de poblar)
```

### `docs/`

Documentación del proyecto, en el orden en que se fue produciendo:

- **`01-analisis/`** — entrevistas con el dueño del taller, decisiones de
  alcance y las historias de usuario (`historias-usuario.md`, HU-01 a
  HU-30) que guían todo el desarrollo.
- **`02-desing/`** — diseño del dominio: diagrama entidad-relación,
  descripción de entidades y la justificación del stack tecnológico
  elegido.
- **`03-gestion-proyecto/`** — plan de gestión (metodología, sprints,
  definición de "terminado") y el backlog detallado de cada sprint.

Antes de tocar código conviene leer `historias-usuario.md` (qué hay que
construir y por qué) y `entidades-dominio.md` (cómo se modela cada cosa),
ya que varias reglas de negocio no triviales (garantías, crédito, permisos
por rol) están documentadas ahí con sus criterios de aceptación.

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
justificada en `docs/02-desing/stack-tecnologico.md`.

## Flujo de trabajo

Equipo de 2 personas, metodología Scrum simplificada (ver
`docs/03-gestion-proyecto/plan-gestion-proyecto.md`). La rama de
desarrollo activa es `dev/sprint01`; el reparto de tareas del sprint
actual y su estado de avance están en `sprint-1-backlog.md`.

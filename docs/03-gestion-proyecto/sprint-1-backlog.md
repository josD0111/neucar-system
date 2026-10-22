# Backlog — Sprint 1

*Basado en `plan-gestion-proyecto.md` (sección 3) y `historias-usuario.md`. Desglosa las historias de Sprint 1 en tareas técnicas para repartir entre los dos integrantes del equipo. Actualizado el 12/10/2026 con la reclasificación de HU-08 (post-MVP → MVP) y la incorporación de HU-01.1 (gestión de categorías).*

## Estado actual (actualizado 22/10/2026)

Revisando el código de `dev/sprint01` contra este backlog, el sprint está prácticamente terminado: los puntos 0, 1, 2 y 3 están completos, y el punto 4 (Clientes) también, salvo lo que depende explícitamente de Ventas/Sprint 2. El detalle de cada ítem se corrigió más abajo (varios checkboxes habían quedado sin marcar aunque el código ya estaba hecho). Pendiente real para cerrar el sprint:

- Validar en limpio los criterios de aceptación de cada punto con el otro integrante (revisión cruzada, según la Definición de Hecho).
- Decidir si se extiende `requireAuth`/`requireRole` a las rutas de categorías, productos, proveedores y compras (hoy sin protección — ver nota en "Deuda técnica registrada" más abajo), o si queda deliberadamente para un sprint posterior.
- Repetir la validación de persistencia de PGlite en la notebook real del taller, una vez adquirida (sigue pendiente, ver punto 0).

## Objetivo del sprint

Al final del sprint se gestiona el catálogo y los actores del negocio desde la aplicación real (no el prototipo en memoria): productos, categorías, stock por compras/lotes, notificación de stock mínimo, clientes y proveedores, con login básico y permisos por rol. Las ventas y los servicios quedan fuera de este sprint (Sprint 2).

## Notas sobre el alcance heredado de `plan-gestion-proyecto.md`

- *(Nota 22/10/2026: superada por el desarrollo real, se mantiene como registro histórico de la planificación original.)* No existen pantallas de Proveedor ni de Compra en el prototipo actual (`app/src/renderer/src/screens/` contiene únicamente `StockScreen`, `VentaScreen`, `OrdenServicioScreen` y `ClienteScreen`). HU-14 a HU-16 requieren construir esas pantallas, no solo conectar una existente a datos reales. En la implementación final sí se construyó `ProveedorScreen.tsx` (CRUD de proveedores) y también `CategoriaScreen.tsx`, pero no una pantalla de "Compras" separada: el registro de compras (incluido el alta de producto nuevo) se resolvió como un flujo inline dentro de `StockScreen.tsx` ("+ Registrar compra" por fila, y como parte del alta de producto nuevo) — ver punto 3.
- La gestión de Usuarios/roles no tiene HU propia (nota ya presente en `plan-gestion-proyecto.md`, sección 3). Se incluye en este backlog como punto técnico separado, sin número de HU.

## 0. Fundación técnica (bloqueante)

Ningún otro punto puede avanzar sin esto.

- [x] Configuración de `drizzle-kit` (`drizzle.config.ts`) apuntando a `app/src/main/db/schema.ts`. Se usa `drizzle-kit push` (sin archivos de migración versionados), decisión tomada el 13/10/2026 para esta etapa temprana del proyecto.
- [x] Integración de PGlite en el proceso `main` de Electron (`src/main/db/client.ts`, inicialización en `src/main/index.ts`).
- [x] Validación de persistencia de PGlite entre reinicios en Windows (15/10/2026 — ver `stack-tecnologico.md`, sección 7). Queda pendiente repetirla en la notebook real del taller una vez adquirida.
- [x] Servidor Express local (`src/main/api/server.ts`, montado en `src/main/index.ts`), escuchando en `127.0.0.1`, con endpoint de diagnóstico `GET /api/health`.
- [x] Convención de respuesta de la API (`src/main/api/response.ts`): formato `{ ok: true, data }` / `{ ok: false, error }`.
- [x] Reemplazo del selector de rol del prototipo (`Sidebar`, estado `rol` en `App.tsx`) por un login real contra la tabla `usuarios` (ver punto 1).

## 1. Usuarios y roles (sin HU propia — soporte de HU-17/HU-18)

- [x] Endpoint de login (usuario/contraseña contra tabla `usuarios`, contraseña hasheada). `POST /api/auth/login`, con hash `scrypt` + salt (`src/main/services/auth.ts`) y token de sesión en memoria; incluye además `GET /api/auth/me` y `POST /api/auth/logout`.
- [x] Validación de rol (`Administrador` / `Empleado`) en la capa de API, no únicamente en la interfaz. Middleware `requireAuth`/`requireRole` (`src/main/api/middleware/auth.ts`), hoy aplicado en `/api/clientes` (ej. deshabilitar cliente exige rol Administrador). Las rutas de categorías/productos/proveedores/compras todavía no lo usan — ver nota en "Deuda técnica registrada".
- [x] Pantalla de login en el renderer, en reemplazo del selector de rol actual. `LoginScreen.tsx`, controlado por `AuthContext.tsx`/`App.tsx` (sin usuario autenticado, no se ve ninguna otra pantalla).
- [x] Seed inicial de un usuario Administrador y un usuario Empleado al correr las migraciones. `src/main/db/seed.ts`: crea `admin` (Administrador) y `rey` (Empleado) solo si la tabla está vacía, con contraseñas aleatorias mostradas una única vez por consola.

## 2. Productos, categorías y stock (HU-01, HU-01.1, HU-02 a HU-08)

- [x] CRUD de Categorías (endpoint + pantalla): creación, edición y eliminación por parte del Administrador. No se trabaja con una lista fija (HU-01.1). `routes/categorias.ts` + `CategoriaScreen.tsx`; el DELETE rechaza con mensaje claro si hay productos asociados (violación de FK, ver corrección del 16/10/2026 más abajo).
- [x] Edición de un Producto existente (nombre, categoría, precio base, stock mínimo). El alta de un Producto nuevo no se maneja como formulario independiente: ver punto 3, donde se incorpora al flujo de registro de Compra (acordado el 15/10/2026). `PATCH /api/productos/:id`.
- [x] Listado de productos con filtro por categoría y búsqueda (HU-02, HU-03). `GET /api/productos` con `categoriaId`, `q` (búsqueda por nombre) y paginación en el backend (agregada 20/10/2026).
- [x] Vista de solo existencias, ocultando productos agotados (HU-04). Filtro `soloConStock`.
- [x] Impresión del listado de stock como PDF descargable, generado en el servidor (HU-05). `GET /api/productos/listado-pdf`, agrupado por categoría, con stock bajo resaltado (rediseñado 20/10/2026).
- [x] Definición de `stock_mínimo` por producto y listado/aviso de productos por debajo de ese umbral (HU-08). Filtro combinable `soloStockBajo` (corregido 20/10/2026 para que funcione junto a los demás filtros) + endpoint standalone `GET /api/productos/stock-bajo`.
- [x] Conexión de `StockScreen.tsx` a la API real, en reemplazo de `AppDataContext.tsx`.
- [~] Historial de compra/venta de un producto (HU-07); la parte de "venta" queda sin datos hasta Sprint 2. Implementado parcialmente: `GET /api/productos/:id` devuelve los lotes de compra con disponibilidad (`cantidadDisponible > 0`); falta el lado de ventas, como estaba previsto.

## 3. Proveedores y Compras (HU-14 a HU-16)

- [x] CRUD de Proveedores (endpoint + pantalla, sin pantalla previa en el prototipo). `routes/proveedores.ts` + `ProveedorScreen.tsx`. Decisión de diseño: solo listar/crear/editar, sin endpoint de baja (documentado en el encabezado de `ProveedorScreen.tsx`); se puede sumar un DELETE más adelante con el mismo manejo de FK que categorías si hace falta.
- [x] Registro de Compra: producto, proveedor, fecha, cantidad, precio de compra, garantía del proveedor, factura. Cada Compra crea un lote y actualiza el `stock` agregado del Producto (ver `entidades-dominio.md`, sección 14). `routes/compras.ts`, con `PATCH`/`DELETE` de lote agregados después (19-20/10/2026) para corregir errores de carga, manteniendo sincronizado el stock agregado en la misma transacción.
- [x] El formulario de Compra admite dos casos: producto ya existente (búsqueda/selección) o producto nuevo (sus datos se cargan en el mismo formulario y el alta del Producto ocurre junto con la del primer lote, en una misma operación). Decisión tomada el 15/10/2026: el alta de un Producto nuevo ocurre siempre a través del registro de su primera Compra, no como formulario separado. `POST /api/compras` crea Producto + primer lote en una única transacción cuando se manda `productoNuevo`.
- [x] Pantalla de Compras (único punto de entrada para registrar tanto compras de productos existentes como la creación de productos nuevos). *Desviación respecto al plan original:* no se construyó como pantalla separada, sino como flujo inline dentro de `StockScreen.tsx` (botón "+ Registrar compra" por fila, y como parte del formulario de alta de producto nuevo). Cumple el mismo objetivo (único punto de entrada), pero vale la pena confirmarlo como decisión de equipo si no se discutió explícitamente.
- [x] Soporte en la interfaz para asociar un producto a múltiples proveedores, sin proveedor preferido. Cada lote de Compra tiene su propio `proveedorId`, así que un Producto con varios lotes queda naturalmente asociado a varios proveedores, sin ningún campo de "proveedor preferido" en el modelo.

## 4. Clientes (HU-09, HU-13)

- [x] CRUD de Clientes: nombre, cédula, celular, RUC opcional (HU-09). `services/clientes.ts` + `routes/clientes.ts`, con validación de formato de celular y RUC; los clientes nunca se borran, se deshabilitan (`PATCH /:id/estado`, solo Administrador).
- [~] Soporte de cliente "casual" (sin registrar) en los flujos que lo requieran; su uso completo depende de Ventas, en Sprint 2 (HU-13). El modelo de datos ya lo soporta (`ventas.clienteId` es opcional), pero no hay todavía ningún flujo que lo ejercite, porque Ventas no está construido. Queda tal como estaba previsto, sin pendientes propios de este sprint.
- [x] Conexión de `ClienteScreen.tsx` a la API real, en reemplazo de `mockData.ts`. La sección de saldo pendiente de esta pantalla queda sin datos hasta Sprint 2.

## Reparto entre los dos integrantes

El punto 0 se resolvió entre ambos integrantes antes de repartir el resto del sprint, por ser bloqueante para los demás puntos. El reparto se acordó inicialmente el 13-15/10/2026 y se ajustó el 15/10/2026 al identificar que el punto 2 depende directamente del punto 3 (el stock de un producto se calcula a partir de sus lotes de compra, ver `entidades-dominio.md`, sección 14), por lo que conviene que ambos queden a cargo de la misma persona:

- Integrante 1: punto 2 (Productos/Categorías/Stock) y punto 3 (Proveedores/Compras).
- Integrante 2: punto 1 (Usuarios/roles) y punto 4 (Clientes).

El punto 3 incluye la construcción de dos pantallas nuevas sin prototipo previo, a diferencia de los puntos 1, 2 y 4, que parten de pantallas ya existentes en el prototipo.

## Definición de Hecho

Se aplica la definida en `plan-gestion-proyecto.md`, sección 5: criterios de aceptación cumplidos, revisión cruzada del otro integrante, sin romper funcionalidad previa, integrado a la rama de desarrollo (`dev/sprint01` en esta etapa del proyecto).

## Deuda técnica registrada

- **Versión de Electron desactualizada (detectado 13/10/2026 vía `npm audit`):** la versión fijada en `package.json` (`^39.2.6`) tiene vulnerabilidades reportadas (bypass de sandbox en popups, lectura cross-origin sin `corsEnabled`, Node.js habilitado en Web Workers vía `<webview>`). El fix disponible implica saltar a `electron@44.7.1`, un cambio de versión mayor que requiere validar compatibilidad con `electron-vite`, `electron-builder` y `@electron-toolkit/*` antes de aplicarlo. No se resuelve en este sprint; queda pendiente de programar como tarea propia, con tiempo para probar que el resto de la app sigue funcionando tras el upgrade.
- Las demás vulnerabilidades reportadas por `npm audit` (`brace-expansion`, `esbuild`/`@esbuild-kit` vía `drizzle-kit`, `extract-zip`) corresponden a herramientas de desarrollo/build y no se empaquetan en la aplicación instalada; `brace-expansion` tiene fix sin cambios disruptivos (`npm audit fix`), las otras dos no se corrigen porque su fix implica bajar `drizzle-kit` a una versión anterior.
- **Rutas sin autenticar (detectado 22/10/2026 al revisar el estado del sprint):** `/api/categorias`, `/api/productos`, `/api/proveedores` y `/api/compras` no usan `requireAuth`/`requireRole`, a diferencia de `/api/clientes`. Es una decisión documentada en `app/src/renderer/src/api/client.ts` (conviven dos clientes HTTP a propósito: uno sin sesión para estos recursos, otro con sesión para `clientes`/`auth`), no un olvido accidental — pero conviene que el equipo confirme si se mantiene así para Sprint 1 o si se empareja con `/api/clientes` antes de cerrar el sprint, ya que hoy cualquier proceso que pueda hablarle a `127.0.0.1:4000` puede leer y modificar catálogo, stock y proveedores sin loguearse.

## Corrección aplicada: peticiones colgadas en errores de la API (16/10/2026)

Al probar manualmente el endpoint `DELETE /api/categorias/:id` se detectó que, ante un error esperado (eliminar una categoría con productos asociados), la petición quedaba colgada sin respuesta en vez de devolver un error. Se identificaron dos causas, ambas corregidas:

- Drizzle envuelve el error real de Postgres/PGlite en un `DrizzleQueryError`; el código de error (ej. `23503`, violación de clave foránea) queda en `err.cause.code`, no en `err.code` directamente. La verificación en `routes/categorias.ts` solo revisaba `err.code`, por lo que nunca detectaba la violación de clave foránea como tal.
- Express 4 no reenvía automáticamente al middleware de errores una excepción lanzada (o una promesa rechazada) dentro de un handler `async`; la petición quedaba sin respuesta de forma silenciosa. Se agregó la dependencia `express-async-errors`, importada al inicio de `src/main/api/server.ts`, que corrige este comportamiento para todos los routers de la API, no solo para categorías.

## Fuera de este sprint

- Ventas, descuentos por rol, descuento de stock automático (HU-17 a HU-21) — Sprint 2.
- Servicios y Órdenes de Servicio (HU-22 a HU-27) — Sprint 2.
- Crédito, pagos, `fecha_pago_prevista` y aviso de mora (HU-10, HU-10.1, HU-10.2, HU-11, HU-12) — Sprint 2.
- Integración real con SIFEN (el modelo de datos ya contempla los campos necesarios; la integración queda post-MVP).
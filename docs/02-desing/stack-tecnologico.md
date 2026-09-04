# Stack Tecnológico

*Definido para Sprint 0. Basado en la experiencia previa del equipo (JavaScript/TypeScript), el entorno de desarrollo (Debian 12), y los requisitos del sistema: aplicación de escritorio offline con base de datos robusta, y la posibilidad de habilitar acceso móvil en una etapa posterior al MVP.*

## 1. Tensión entre aplicación offline y base de datos robusta

Se planteó como requisito una aplicación de escritorio offline junto con una base de datos robusta del tipo PostgreSQL o MySQL. Ambos requisitos son compatibles, aunque no es la combinación más directa de implementar, por lo siguiente:

- Las bases de datos de tipo "servidor" (PostgreSQL, MySQL) están diseñadas para ejecutarse como un proceso independiente al que la aplicación se conecta, no para integrarse directamente dentro de una aplicación de escritorio como un archivo local.
- La solución habitual para aplicaciones de escritorio offline en JavaScript/Electron es SQLite, una base de datos embebida en forma de archivo, sin proceso ni instalación adicional — pero no ofrece el mismo nivel de robustez formal que un motor de tipo servidor.
- Existe una alternativa intermedia: **PGlite**, una compilación de PostgreSQL a WebAssembly que permite embeber el motor real de PostgreSQL dentro de la aplicación, sin requerir instalación ni administración de un servidor de base de datos separado.

**Decisión propuesta:** utilizar **PGlite** como motor de base de datos. Al tratarse del mismo motor de PostgreSQL, se mantiene el mismo lenguaje SQL, los mismos tipos de datos y las propiedades ACID, con la ventaja adicional de que una eventual migración a un PostgreSQL de tipo servidor (por ejemplo, ante la necesidad de acceso remoto — ver sección 3) resultaría directa, al tratarse del mismo motor subyacente.

**Alternativa considerada:** instalar PostgreSQL como servicio local en el equipo del taller. Esta opción es más estándar si se prevé que otros equipos se conecten a esa base de datos, pero agrega complejidad de instalación y mantenimiento (administración del servicio, usuarios, copias de seguridad manuales) sin aportar una ventaja clara mientras el sistema opere en una única notebook.

## 2. Consideración sobre el sistema operativo de desarrollo y de destino

El equipo de desarrollo trabaja en entornos mixtos: un integrante utiliza Debian 12 y el otro utiliza Windows 11. En cuanto al equipo de destino, la notebook del taller todavía no fue adquirida — según lo informado, el dueño la comprará una vez que el sistema esté funcionando — por lo que no hay una confirmación definitiva de su sistema operativo, aunque es razonable asumir que será **Windows**, dado que es el sistema más probable en un equipo comprado para uso comercial estándar en este contexto.

Esta combinación no representa un impedimento técnico, y de hecho resulta favorable para el proceso de empaquetado:

- El desarrollo y las pruebas funcionales pueden repartirse entre ambos entornos sin inconvenientes, ya que Electron admite desarrollo multiplataforma.
- La generación del instalador de Windows (`.exe` mediante NSIS) puede realizarse de forma nativa desde el equipo con Windows 11, sin requerir herramientas adicionales como Wine.
- Para el integrante que trabaja en Debian 12, generar un instalador de Windows sí requeriría Wine (o la imagen de Docker `electronuserland/builder:wine`) — pero, al contar con un compañero en Windows 11, esta necesidad deja de ser un bloqueante: los builds de distribución para el taller pueden generarse desde ese equipo, mientras que en Debian 12 se continúa el desarrollo diario y, si se desea, se generan builds de Linux (`.deb`/`AppImage`) para pruebas locales.
- Se recomienda, de todas formas, documentar el proceso de build para ambos sistemas operativos (por ejemplo, mediante un script o integración continua), de manera que no dependa exclusivamente de la disponibilidad de uno de los dos integrantes al momento de generar una nueva versión para el taller.

**Recomendación:** mantener Windows como sistema operativo objetivo de la build de distribución, y confirmar esta asunción con el dueño cuando se concrete la compra de la notebook, antes de la entrega final del sistema.

## 3. Consideración sobre un futuro acceso desde celular

De acuerdo con `desiciones-alcance.md`, el acceso móvil (HU-30) queda fuera del alcance del MVP, pero se identificó como una funcionalidad deseable a futuro. Aunque no se va a construir en esta etapa, conviene tomar una decisión de arquitectura ahora que facilite ese camino más adelante, en lugar de postergar la decisión por completo.

La recomendación es diseñar la lógica de negocio (validaciones, cálculo de saldos, permisos por rol, etc.) como una **capa separada de la interfaz**, expuesta a través de una API local (por ejemplo, un servidor Express corriendo en `localhost` dentro del mismo proceso de Electron), en lugar de acoplarla directamente a los mensajes de IPC de Electron. De esta forma:

- En el MVP, la interfaz de escritorio (React) consume esa API local sin que el usuario note diferencia alguna respecto de una comunicación por IPC directa.
- Si en una etapa futura se decide habilitar acceso desde celular, alcanzaría con exponer esa misma API en la red local del taller (en lugar de únicamente en `localhost`), y construir una interfaz móvil (o una versión web responsiva) que la consuma — sin necesidad de reescribir la lógica de negocio ya construida.
- Esta decisión no implica desarrollar nada del acceso móvil ahora; solo evita una dependencia estructural que dificultaría agregarlo después.

## 4. Stack propuesto

| Capa | Tecnología | Justificación |
|---|---|---|
| Shell de escritorio | **Electron** | Permite empaquetar una aplicación web (React) como aplicación instalable offline, con instalador nativo, sin depender de un navegador externo |
| Interfaz (frontend) | **React + TypeScript** | Coincide con la experiencia previa del equipo en JavaScript/TypeScript; el tipado estático ayuda a reflejar el modelo de datos de `entidades-dominio.md` en el código y detectar errores antes de la ejecución |
| Lógica de negocio (backend) | **Node.js + TypeScript**, expuesto como servidor local (ver sección 3) | Centraliza las validaciones de negocio (cálculo de saldos, permisos por rol) en una capa desacoplada de la interfaz, preparada para un eventual acceso móvil |
| Base de datos | **PGlite** (PostgreSQL embebido vía WebAssembly) | Resuelve la tensión descripta en la sección 1 |
| ORM / acceso a datos | **Prisma** (alternativa: Drizzle) | Genera el código de acceso a datos a partir de un esquema declarado en TypeScript, que puede derivarse directamente de `diagrama-entidad-relacion.md` |
| Empaquetado / instalador | **electron-builder** | Genera los instaladores para los sistemas operativos definidos (ver sección 2) |
| Pruebas | **Vitest** (alternativa: Jest) | Para cubrir la lógica de negocio más sensible: cálculo de saldos y pagos parciales, permisos por rol |

## 5. Correspondencia entre el modelo de datos y el stack

- Cada entidad definida en `entidades-dominio.md` se representa como un modelo en el esquema de Prisma (o Drizzle), en correspondencia directa con las tablas de `diagrama-entidad-relacion.md`.
- Los valores calculados (`saldo_pendiente` en Ítem de Venta y en Orden de Servicio, `monto_total`, etc.) se implementan como funciones en la capa de lógica de negocio, no como columnas fijas en la base de datos, para evitar inconsistencias si un registro se modifica fuera del flujo esperado.
- Los permisos por rol (Administrador/Empleado — ver `entidades-dominio.md`, sección 1, e HU-17/HU-18) se validan en esta misma capa de lógica de negocio, y no únicamente ocultando elementos en la interfaz, conforme a los criterios de aceptación definidos para esas historias.

## 6. Tareas de Sprint 0 derivadas de este documento

- Confirmar con el dueño, al momento de adquirir la notebook, que efectivamente tendrá Windows instalado (ver sección 2), para validar que la asunción tomada en este documento sigue vigente.
- Inicializar el proyecto Electron + React + TypeScript (puede utilizarse una plantilla como `electron-vite` para reducir tiempo de configuración inicial).
- Definir el esquema inicial de Prisma/Drizzle a partir de `diagrama-entidad-relacion.md`.
- Configurar PGlite y validar que persiste los datos correctamente entre reinicios de la aplicación, en un entorno lo más parecido posible al de destino final.
- Configurar `electron-builder` y validar la generación de instaladores tanto desde el entorno Windows 11 (build nativa de `.exe`) como desde el entorno Debian 12 (build de Linux para pruebas locales, y opcionalmente instalación de Wine para poder generar también el `.exe` desde ese equipo si hiciera falta).

## 7. Riesgo a monitorear

PGlite es una tecnología relativamente reciente. Aunque resuelve adecuadamente la tensión planteada en la sección 1, se recomienda que el Sprint 0 incluya una validación temprana y concreta de su persistencia de datos en un entorno similar al de destino final, antes de construir funcionalidad sobre esa base. En caso de detectarse algún inconveniente relevante, las alternativas de respaldo son SQLite (menor robustez formal, pero ampliamente probada en este tipo de aplicaciones) o PostgreSQL instalado como servicio local (ver sección 1, alternativa considerada).

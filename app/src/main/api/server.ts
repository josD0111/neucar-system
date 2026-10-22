// src/main/api/server.ts
//
// Servidor local (Express) que expone la lógica de negocio, según la
// decisión de arquitectura de stack-tecnologico.md, sección 3: la interfaz
// de escritorio consume esta API en vez de hablarle directo a la base de
// datos, para que un futuro acceso desde celular solo implique exponer el
// mismo servidor en la red local, sin reescribir la lógica de negocio.
//
// Escucha únicamente en 127.0.0.1 (no en 0.0.0.0): en este sprint la API es
// de uso exclusivo del propio proceso de Electron. Exponerla en la red local
// es un cambio deliberado para cuando se implemente el acceso móvil (HU-30,
// post-MVP), no algo que deba ocurrir como efecto secundario de este punto.

import express, { type Express, type NextFunction, type Request, type Response } from "express";
// Parchea Express para que un error lanzado (o una promesa rechazada) dentro
// de un handler async se reenvíe automáticamente al middleware de errores.
// Sin esto, Express 4 no captura ese caso: la petición queda colgada sin
// respuesta en vez de devolver un error (ver sprint-1-backlog.md, deuda
// técnica detectada el 16/10/2026).
import "express-async-errors";
import type { Server } from "node:http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { sendOk, sendServerError } from "./response";
import { categoriasRouter } from "./routes/categorias";
import { productosRouter } from "./routes/productos";
import { proveedoresRouter } from "./routes/proveedores";
import { comprasRouter } from "./routes/compras";
import { authRouter } from "./routes/auth";
import { clientesRouter } from "./routes/clientes";

// Puerto y dirección en los que escucha el servidor local.
export const API_PORT = 4000;
export const API_HOST = "127.0.0.1";

// Tipo de la base de datos (Drizzle sobre PGlite), compartido por servicios y rutas.
export type Db = PgliteDatabase<typeof schema>;

// Arma la aplicación Express: middlewares globales, rutas y manejador de errores.
export function createServer(db: Db): Express {
  const app = express();

  // Permite leer el cuerpo de las peticiones en formato JSON (req.body).
  app.use(express.json());

  // CORS mínimo: el renderer corre en un origen distinto al de este servidor
  // (file:// en producción, http://localhost:<puerto-de-vite> en desarrollo),
  // así que el navegador exige habilitarlo explícitamente para que el fetch
  // del renderer no sea rechazado.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    // Authorization es necesario para que el navegador deje pasar el token de sesión.
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // Las peticiones "preflight" del navegador se responden acá, sin llegar a las rutas.
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Endpoint de diagnóstico: confirma que el servidor está arriba y que
  // tiene una instancia de base de datos inicializada. Sirve para validar
  // el cableado antes de construir los endpoints de cada entidad
  // (productos, clientes, proveedores, etc. — ver sprint-1-backlog.md).
  app.get("/api/health", (_req: Request, res: Response) => {
    sendOk(res, { status: "ok", dbReady: Boolean(db) });
  });

  app.use("/api/categorias", categoriasRouter(db));
  app.use("/api/productos", productosRouter(db));
  app.use("/api/proveedores", proveedoresRouter(db));
  app.use("/api/compras", comprasRouter(db));

  // Rutas de autenticación (login, logout, sesión actual).
  // Se montan una sola vez, al crear el servidor, y no dentro de otro handler.
  app.use("/api/auth", authRouter(db));
  // Rutas de clientes (HU-09), protegidas por sesión.
  app.use("/api/clientes", clientesRouter(db));

  // Manejador de errores: cualquier handler que llame a next(err), o que
  // lance una excepción dentro de una ruta async envuelta correctamente,
  // termina acá en vez de hacer caer el proceso de Electron.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] Error no manejado:", err);
    sendServerError(res);
  });

  return app;
}

// Crea el servidor y lo pone a escuchar en API_HOST:API_PORT.
// Devuelve el servidor HTTP para poder cerrarlo al salir de la app (ver index.ts).
export function startServer(db: Db): Server {
  const app = createServer(db);
  const server = app.listen(API_PORT, API_HOST, () => {
    console.log(`[api] Servidor local escuchando en http://${API_HOST}:${API_PORT}`);
  });
  return server;
}
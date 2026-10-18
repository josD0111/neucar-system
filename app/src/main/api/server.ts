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

export const API_PORT = 4000;
export const API_HOST = "127.0.0.1";

export type Db = PgliteDatabase<typeof schema>;

export function createServer(db: Db): Express {
  const app = express();

  app.use(express.json());

  // CORS mínimo: el renderer corre en un origen distinto al de este servidor
  // (file:// en producción, http://localhost:<puerto-de-vite> en desarrollo),
  // así que el navegador exige habilitarlo explícitamente para que el fetch
  // del renderer no sea rechazado.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Endpoint de diagnóstico: confirma que el servidor está arriba y que
  // tiene una instancia de base de datos inicializada. Sirve para validar
  // el cableado de este punto antes de construir los endpoints de cada
  // entidad (productos, clientes, proveedores, etc. — ver sprint-1-backlog.md).
  app.get("/api/health", (_req: Request, res: Response) => {
    sendOk(res, { status: "ok", dbReady: Boolean(db) });
  });

  app.use("/api/categorias", categoriasRouter(db));
  app.use("/api/productos", productosRouter(db));
  app.use("/api/proveedores", proveedoresRouter(db));
  app.use("/api/compras", comprasRouter(db));

  // TODO (sprint 1, punto 4 — a cargo del otro integrante): montar acá el
  // router de clientes.

  // Manejador de errores: cualquier handler que llame a next(err), o que
  // lance una excepción dentro de una ruta async envuelta correctamente,
  // termina acá en vez de hacer caer el proceso de Electron.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] Error no manejado:", err);
    sendServerError(res);
  });

  return app;
}

export function startServer(db: Db): Server {
  const app = createServer(db);
  const server = app.listen(API_PORT, API_HOST, () => {
    console.log(`[api] Servidor local escuchando en http://${API_HOST}:${API_PORT}`);
  });
  return server;
}
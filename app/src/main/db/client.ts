// src/main/db/client.ts (dentro de la carpeta app/ del repo)
//
// Inicialización de la base de datos embebida (PGlite) y del cliente Drizzle.
//
// Se usan DOS rutas distintas según el entorno:
//  - En DESARROLLO: una carpeta fija dentro del propio proyecto (.data/),
//    para que coincida exactamente con la ruta que usa "drizzle-kit push"
//    (ver drizzle.config.ts) al crear las tablas. Si no coincidieran, la app
//    y la herramienta de migraciones estarían mirando archivos distintos.
//  - En PRODUCCIÓN (app empaquetada): la carpeta de datos de usuario del
//    sistema operativo, para persistir correctamente tras instalar/actualizar
//    el ejecutable.

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import path from "node:path";
import { app } from "electron";

let dbInstance: PgliteDatabase<typeof schema> | null = null;

function resolveDbPath(): string {
  if (app.isPackaged) {
    // Producción: carpeta de datos de usuario del SO.
    return path.join(app.getPath("userData"), "neucar-db");
  }
  // Desarrollo: carpeta fija dentro del proyecto (ver .gitignore: .data/).
  // Debe coincidir con "dbCredentials.url" en drizzle.config.ts.
  return path.join(app.getAppPath(), ".data", "pglite-dev");
}

export async function initDb(): Promise<PgliteDatabase<typeof schema>> {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  console.log(`[db] Usando base de datos en: ${dbPath}`);

  const client = new PGlite(dbPath);
  dbInstance = drizzle(client, { schema });

  return dbInstance;
}

export function getDb(): PgliteDatabase<typeof schema> {
  if (!dbInstance) {
    throw new Error(
      "La base de datos todavía no fue inicializada. Llamar a initDb() primero (ver main/index.ts)."
    );
  }
  return dbInstance;
}
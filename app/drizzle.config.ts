// drizzle.config.ts
//
// Configuración de drizzle-kit para crear/actualizar las tablas a partir del
// esquema declarado en src/main/db/schema.ts.
//
// dbCredentials.url apunta a la misma ruta de desarrollo que usa
// src/main/db/client.ts (ver resolveDbPath) cuando la app NO está
// empaquetada. Si esta ruta cambia en un lado, debe cambiar en el otro.
//
// Uso:
//   npx drizzle-kit push     (crea/actualiza tablas directamente — recomendado
//                              en esta etapa temprana, sin archivos de migración)

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/main/db/schema.ts",
  out: "./src/main/db/migrations",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: "./.data/pglite-dev",
  },
});
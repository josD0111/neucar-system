// src/main/db/seed.ts
//
// Crea los usuarios iniciales (Administrador y Empleado) solo si la tabla
// está vacía. Las contraseñas se generan al azar y se muestran UNA vez en la
// consola: no quedan escritas en el código ni en el repositorio.

import { randomBytes } from "node:crypto";
import { count } from "drizzle-orm";
import type { Db } from "../api/server";
import { hashContrasena, type Rol } from "../services/auth";
import { usuarios } from "./schema";

const USUARIOS_INICIALES: { nombre: string; usuarioLogin: string; rol: Rol }[] = [
  { nombre: "Administrador", usuarioLogin: "admin", rol: "Administrador" },
  { nombre: "Rey", usuarioLogin: "rey", rol: "Empleado" },
];

export async function seedUsuarios(db: Db): Promise<void> {
  const [{ total }] = await db.select({ total: count() }).from(usuarios);


  if (total > 0) return;

  const generadas: { usuarioLogin: string; contrasena: string }[] = [];

  const filas = USUARIOS_INICIALES.map((u) => {
    const contrasena = randomBytes(9).toString("base64url"); // 12 caracteres
    generadas.push({ usuarioLogin: u.usuarioLogin, contrasena });
    return { ...u, contrasena: hashContrasena(contrasena) };
  });

  await db.insert(usuarios).values(filas);

  console.log("[seed] Usuarios iniciales creados. Anotá estas contraseñas, no se vuelven a mostrar:");
  for (const g of generadas) {
    console.log(`[seed]   ${g.usuarioLogin} / ${g.contrasena}`);
  }
}
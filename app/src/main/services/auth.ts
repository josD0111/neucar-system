// src/main/services/auth.ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../api/server";
import { usuarios } from "../db/schema";

export type Rol = "Administrador" | "Empleado";

export interface SesionUsuario {
  id: number;
  nombre: string;
  usuarioLogin: string;
  rol: Rol;
}

const KEY_LEN = 64;

// Formato guardado en usuarios.contrasena: scrypt$<salt hex>$<hash hex> (168 caracteres)
export function hashContrasena(plana: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plana, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verificarContrasena(plana: string, guardada: string): boolean {
  const [alg, saltHex, hashHex] = guardada.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plana, Buffer.from(saltHex, "hex"), esperado.length);
  return timingSafeEqual(actual, esperado);
}

// Hash de relleno para que un usuario inexistente tarde lo mismo que uno existente.
const HASH_DUMMY = hashContrasena("relleno-no-usar");

// Sesiones en memoria del proceso main: se pierden al cerrar la app (es lo esperado).
const sesiones = new Map<string, SesionUsuario>();

export async function login(
  db: Db,
  usuarioLogin: string,
  contrasena: string,
): Promise<{ token: string; usuario: SesionUsuario } | null> {
  const [u] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.usuarioLogin, usuarioLogin))
    .limit(1);

  const valido = verificarContrasena(contrasena, u?.contrasena ?? HASH_DUMMY);
  if (!u || !valido) return null;

  const usuario: SesionUsuario = {
    id: u.id,
    nombre: u.nombre,
    usuarioLogin: u.usuarioLogin,
    rol: u.rol as Rol,
  };
  const token = randomBytes(32).toString("hex");
  sesiones.set(token, usuario);
  return { token, usuario };
}

export function obtenerSesion(token: string | undefined): SesionUsuario | null {
  return (token && sesiones.get(token)) || null;
}

export function logout(token: string): void {
  sesiones.delete(token);
}
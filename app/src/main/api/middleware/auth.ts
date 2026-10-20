// src/main/api/middleware/auth.ts
//
// Middlewares de autenticación y autorización. Se ejecutan ANTES de las rutas
// que protegen. La validación de rol vive acá (en la API) y no solo en la
// interfaz, así que un cliente que se salte la pantalla igual es rechazado.

import type { NextFunction, Request, Response } from "express";
import { obtenerSesion, type Rol, type SesionUsuario } from "../../services/auth";
import { sendForbidden, sendUnauthorized } from "../response";

// Le agregamos dos campos opcionales al tipo Request de Express para poder
// guardar quién es el usuario autenticado y con qué token llegó.
declare module "express-serve-static-core" {
  interface Request {
    usuario?: SesionUsuario;
    token?: string;
  }
}

// Exige que la petición traiga un token de sesión válido.
// El cliente lo manda en el header:  Authorization: Bearer <token>
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  // Nos quedamos solo con la parte posterior a "Bearer "
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  // Buscamos la sesión en memoria (ver services/auth.ts)
  const usuario = obtenerSesion(token);
  if (!token || !usuario) {
    sendUnauthorized(res, "Sesión no válida o vencida");
    return;
  }

  // Dejamos el usuario y el token disponibles para las rutas siguientes.
  req.usuario = usuario;
  req.token = token;
  next();
}

// Exige que el usuario autenticado tenga alguno de los roles indicados.
// Se usa DESPUÉS de requireAuth.
// Ejemplo: router.delete("/x", requireAuth, requireRole("Administrador"), ...)
export function requireRole(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      sendForbidden(res, "No tenés permiso para realizar esta acción");
      return;
    }
    next();
  };
}
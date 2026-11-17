// src/main/api/routes/auth.ts
//
// Rutas de autenticación, montadas bajo /api/auth (ver server.ts).
//   POST /api/auth/login   → recibe usuario y contraseña, devuelve token y datos del usuario
//   GET  /api/auth/me      → devuelve el usuario de la sesión actual (requiere token)
//   POST /api/auth/logout  → cierra la sesión actual (requiere token)

import { Router } from "express";
import type { Db } from "../server";
import { login, logout } from "../../services/auth";
import { requireAuth } from "../middleware/auth";
import { sendBadRequest, sendOk, sendUnauthorized } from "../response";

// Fábrica del router: recibe la base de datos para usarla en las rutas.
// Es la función que server.ts importa y monta en /api/auth.
export function authRouter(db: Db): Router {
  const router = Router();

  // Inicio de sesión: valida los datos, busca al usuario y devuelve un token.
  router.post("/login", async (req, res, next) => {
    try {
      // Leemos usuario y contraseña del cuerpo JSON; "?? {}" evita error si viene vacío.
      const { usuarioLogin, contrasena } = req.body ?? {};

      // Ambos deben ser texto no vacío antes de consultar la base.
      if (
        typeof usuarioLogin !== "string" ||
        typeof contrasena !== "string" ||
        !usuarioLogin.trim() ||
        !contrasena
      ) {
        sendBadRequest(res, "Ingresá usuario y contraseña");
        return;
      }

      // Límites de largo: el usuario debe caber en su columna (50) y se evita
      // procesar textos enormes en el hash de la contraseña.
      if (usuarioLogin.length > 50 || contrasena.length > 200) {
        sendBadRequest(res, "Usuario o contraseña demasiado largos");
        return;
      }

      const resultado = await login(db, usuarioLogin, contrasena);

      // Mismo mensaje si falla el usuario o la contraseña: no revelamos cuál de los dos.
      if (!resultado) {
        sendUnauthorized(res, "Usuario o contraseña incorrectos");
        return;
      }

      // Devolvemos { token, usuario }. La contraseña nunca sale de la base.
      sendOk(res, resultado);
    } catch (err) {
      // Express 4 no captura errores de funciones async: los pasamos al manejador de server.ts.
      next(err);
    }
  });

  // Devuelve quién está logueado (útil para que el renderer lo consulte al recargar).
  router.get("/me", requireAuth, (req, res) => {
    sendOk(res, { usuario: req.usuario });
  });

  // Cierra la sesión: borra el token que llegó en la petición.
  router.post("/logout", requireAuth, (req, res) => {
    logout(req.token as string);
    sendOk(res, {});
  });

  return router;
}
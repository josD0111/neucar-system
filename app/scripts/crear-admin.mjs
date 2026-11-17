// scripts/crear-admin.mjs
//
// Crea un usuario Administrador en la base de datos local (o le resetea la
// contraseña si ya existe), para cuando no se tiene ninguna credencial para
// entrar a la app — por ejemplo porque el seed automático (ver
// src/main/db/seed.ts) ya corrió en algún momento y la contraseña generada
// al azar, que se muestra UNA sola vez en la consola, no quedó guardada.
//
// A diferencia de scripts/seed.mjs (que carga datos pasando por la API HTTP,
// con la app corriendo), este escribe DIRECTO en el archivo de la base
// PGlite, sin pasar por Express/Electron ni por el esquema de Drizzle (que
// está en TypeScript y no se puede importar tal cual desde un script .mjs
// suelto) — usa SQL crudo contra la tabla "usuarios", con las mismas
// columnas que src/main/db/schema.ts. El hash de la contraseña replica el
// formato de hashContrasena() en src/main/services/auth.ts
// (scrypt$<salt hex>$<hash hex>): si ese formato cambia ahí, hay que
// actualizarlo acá también.
//
// IMPORTANTE: cerrá la app (parar "npm run dev") antes de correr este
// script. PGlite guarda todo en un archivo en disco (.data/pglite-dev) y no
// está pensado para que dos procesos lo abran al mismo tiempo — correr esto
// con la app abierta puede colgarse o corromper los datos.
//
// Uso (parado en la carpeta app/):
//   node scripts/crear-admin.mjs [usuarioLogin] [contraseña] [nombre]
//
// Por defecto: usuarioLogin="admin", contraseña="admin1234", nombre="Administrador".
// Si el usuario ya existe, se le resetea la contraseña (y el rol, por las
// dudas) en vez de fallar por login duplicado.
//
// Ejemplos:
//   node scripts/crear-admin.mjs
//   node scripts/crear-admin.mjs admin miClaveSegura123
//   node scripts/crear-admin.mjs jefe otraClave "Jefe de taller"

import { PGlite } from '@electric-sql/pglite'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const USUARIO_LOGIN = process.argv[2] ?? 'admin'
const CONTRASENA = process.argv[3] ?? 'admin1234'
const NOMBRE = process.argv[4] ?? 'Administrador'

if (CONTRASENA.length < 4) {
  console.error('[crear-admin] La contraseña es demasiado corta (mínimo 4 caracteres).')
  process.exitCode = 1
  process.exit()
}

// Misma ruta de desarrollo que src/main/db/client.ts (resolveDbPath) y
// drizzle.config.ts: relativa a la carpeta app/, así que este script debe
// correrse parado ahí (igual que "npm run dev" y "npx drizzle-kit push").
const dbPath = path.join(process.cwd(), '.data', 'pglite-dev')

// Mismo algoritmo y formato que hashContrasena() en src/main/services/auth.ts.
function hashContrasena(plana) {
  const salt = randomBytes(16)
  const hash = scryptSync(plana, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

async function main() {
  console.log(`[crear-admin] Usando base de datos en: ${dbPath}`)
  // Si es la primera vez que se corre algo en este clon (nunca se abrió la
  // app), la carpeta ".data" todavía no existe y PGlite no la crea sola.
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new PGlite(dbPath)

  try {
    const existentes = await db.query(
      'SELECT id FROM usuarios WHERE usuario_login = $1',
      [USUARIO_LOGIN]
    )
    const hash = hashContrasena(CONTRASENA)

    if (existentes.rows.length > 0) {
      await db.query('UPDATE usuarios SET contrasena = $1, rol = $2 WHERE usuario_login = $3', [
        hash,
        'Administrador',
        USUARIO_LOGIN
      ])
      console.log(`[crear-admin] El usuario "${USUARIO_LOGIN}" ya existía: se le reseteó la contraseña.`)
    } else {
      await db.query(
        'INSERT INTO usuarios (nombre, usuario_login, contrasena, rol) VALUES ($1, $2, $3, $4)',
        [NOMBRE, USUARIO_LOGIN, hash, 'Administrador']
      )
      console.log(`[crear-admin] Usuario "${USUARIO_LOGIN}" creado con rol Administrador.`)
    }

    console.log('')
    console.log('  Usuario:     ', USUARIO_LOGIN)
    console.log('  Contraseña:  ', CONTRASENA)
    console.log('')
    console.log('[crear-admin] Anotala: no se vuelve a mostrar.')
  } finally {
    // Fundamental: sin este cierre, PGlite deja un postmaster.pid colgado y
    // la próxima vez que algo (esta app, este mismo script, drizzle-kit)
    // intente abrir la misma carpeta de datos puede quedarse esperando
    // indefinidamente en vez de arrancar.
    await db.close()
  }
}

main().catch((err) => {
  const mensaje = err?.message ?? String(err)
  console.error('[crear-admin] Error:', mensaje)
  if (mensaje.includes('does not exist')) {
    // Base de datos nueva, sin tablas todavía: falta correr la migración.
    console.error(
      '[crear-admin] Parece que las tablas todavía no existen. Corré primero "npx drizzle-kit push" y volvé a intentar.'
    )
  } else {
    console.error(
      '[crear-admin] ¿Está la app corriendo (npm run dev) en otra terminal? Cerrala e intentá de nuevo.'
    )
  }
  process.exitCode = 1
})

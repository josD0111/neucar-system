// scripts/seed-ventas.mjs
//
// Carga ventas de ejemplo repartidas en varios días (con una mezcla de
// Contado/Crédito, pagadas/parciales/pendientes, cliente registrado/casual),
// pensado para poder probar el Historial de ventas: el agrupado por día, la
// paginación ("Cargar 7 días anteriores") y el módulo de Pagos/Cobro.
//
// A DIFERENCIA de scripts/seed.mjs (productos/categorías/proveedores), este
// script NO pasa por la API HTTP — escribe directo en la base con SQL. Es
// la única forma de controlar la `fecha` de una venta: POST /api/ventas
// siempre la fecha con el instante actual (a propósito — no existe, ni
// debería existir, una forma de backdatear una venta real desde la app), así
// que para tener ventas en días pasados no queda otra que insertarlas
// directo.
//
// *** IMPORTANTE: tiene que correr con la app CERRADA (sin `npm run dev`
// corriendo) ***. PGlite no está pensado para que dos procesos distintos
// tengan abierta la misma carpeta de datos al mismo tiempo — si el main
// process de Electron todavía tiene la base abierta, correr esto en
// paralelo puede corromperla. El script pide confirmación antes de tocar
// nada.
//
// Requiere que ya exista al menos un usuario Administrador (se crea solo la
// primera vez que se abre la app, ver src/main/db/seed.ts) y al menos un
// producto con stock (correr `npm run seed` antes, si todavía no hay
// ninguno) — si no encuentra producto con stock, crea uno mínimo de prueba.
//
// Es re-ejecutable de forma segura: si ya corrió antes, lo detecta (busca
// ventas con tipo_comprobante = 'SEED-VENTAS', un marcador que este script
// usa solo para esto — no es un campo pensado para eso, es un atajo de este
// script nada más) y no vuelve a insertar nada.
//
// Uso:
//   node scripts/seed-ventas.mjs

import { PGlite } from '@electric-sql/pglite'
import { createInterface } from 'node:readline/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Misma ruta que drizzle.config.ts y db/client.ts usan en desarrollo.
const DB_PATH = path.join(__dirname, '..', '.data', 'pglite-dev')

const MARCADOR = 'SEED-VENTAS'
const DIAS_A_GENERAR = 18 // más que los 7 de una página, para poder probar "Cargar 7 días anteriores"

async function confirmar() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const respuesta = await rl.question(
    `Esto va a escribir directo en ${DB_PATH}.\n` +
      'Confirmá que "npm run dev" está DETENIDO antes de seguir (s/N): '
  )
  rl.close()
  if (respuesta.trim().toLowerCase() !== 's') {
    console.log('Cancelado.')
    process.exit(0)
  }
}

function fechaHaceNDias(n, horas, minutos) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(horas, minutos, 0, 0)
  return d
}

function fechaISO10(d) {
  return d.toISOString().slice(0, 10)
}

async function main() {
  await confirmar()

  const db = new PGlite(DB_PATH)

  try {
    const { rows: yaSembrado } = await db.query(
      'SELECT count(*)::int AS n FROM ventas WHERE tipo_comprobante = $1',
      [MARCADOR]
    )
    if (yaSembrado[0].n > 0) {
      console.log(
        `Ya hay ${yaSembrado[0].n} venta/s sembrada/s por este script (tipo_comprobante='${MARCADOR}'). No se vuelve a sembrar.`
      )
      return
    }

    const { rows: admins } = await db.query(
      "SELECT id FROM usuarios WHERE rol = 'Administrador' ORDER BY id LIMIT 1"
    )
    if (admins.length === 0) {
      throw new Error(
        'No hay ningún usuario Administrador. Abrí la app una vez primero (crea los usuarios iniciales solo) y volvé a correr esto.'
      )
    }
    const usuarioId = admins[0].id

    // Clientes: reusa los que ya existan; si no hay ninguno, crea 3 de prueba.
    let { rows: clientes } = await db.query('SELECT id, nombre FROM clientes ORDER BY id LIMIT 5')
    if (clientes.length === 0) {
      const nombres = ['Ana Gonzales', 'Beto Paredes', 'Carla Duarte']
      for (const nombre of nombres) {
        await db.query('INSERT INTO clientes (nombre) VALUES ($1)', [nombre])
      }
      ;({ rows: clientes } = await db.query('SELECT id, nombre FROM clientes ORDER BY id LIMIT 5'))
      console.log(`Creados ${clientes.length} clientes de prueba.`)
    }

    // Compras con stock disponible: reusa las que haya (típicamente las que
    // deja `npm run seed`); si no hay ninguna, crea una categoría/producto/
    // compra mínimos solo para esto.
    let { rows: compras } = await db.query(
      `SELECT c.id, c.producto_id AS "productoId", c.cantidad_disponible AS "cantidadDisponible",
              p.precio_base AS "precioBase"
       FROM compras c JOIN productos p ON p.id = c.producto_id
       WHERE c.cantidad_disponible > 0
       ORDER BY c.id LIMIT 10`
    )
    if (compras.length === 0) {
      const { rows: cats } = await db.query(
        "INSERT INTO categorias (nombre) VALUES ('Prueba (seed ventas)') RETURNING id"
      )
      const { rows: prods } = await db.query(
        `INSERT INTO productos (nombre, categoria_id, precio_base, stock)
         VALUES ('Producto de prueba (seed ventas)', $1, 50000, 0) RETURNING id`,
        [cats[0].id]
      )
      const { rows: provs } = await db.query(
        "INSERT INTO proveedores (nombre) VALUES ('Proveedor de prueba (seed ventas)') RETURNING id"
      )
      await db.query(
        `INSERT INTO compras (producto_id, proveedor_id, fecha, cantidad, cantidad_disponible, precio_compra)
         VALUES ($1, $2, CURRENT_DATE, 500, 500, 30000)`,
        [prods[0].id, provs[0].id]
      )
      await db.query('UPDATE productos SET stock = 500 WHERE id = $1', [prods[0].id])
      ;({ rows: compras } = await db.query(
        `SELECT c.id, c.producto_id AS "productoId", c.cantidad_disponible AS "cantidadDisponible",
                p.precio_base AS "precioBase"
         FROM compras c JOIN productos p ON p.id = c.producto_id
         WHERE c.cantidad_disponible > 0
         ORDER BY c.id LIMIT 10`
      ))
      console.log('Creado producto/compra mínimo de prueba (no había ninguno con stock).')
    }

    const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR']
    // Patrón de pago para los ítems a Crédito, rotando: sin pago todavía,
    // pago parcial, pagado por completo — para tener los tres casos al
    // probar el filtro "Solo con saldo pendiente" y el formulario de cobro.
    const PATRONES_CREDITO = ['sin_pago', 'parcial', 'pagado']

    let contadorGlobal = 0
    let ventasCreadas = 0

    await db.query('BEGIN')
    try {
      for (let dia = DIAS_A_GENERAR - 1; dia >= 0; dia--) {
        const ventasEseDia = 1 + (dia % 3) // 1, 2 o 3 ventas por día, rotando
        for (let v = 0; v < ventasEseDia; v++) {
          contadorGlobal++
          const fecha = fechaHaceNDias(dia, 9 + (v % 8), (contadorGlobal * 7) % 60)
          const cliente =
            contadorGlobal % 4 === 0 ? null : clientes[contadorGlobal % clientes.length]
          const metodoPago = METODOS[contadorGlobal % METODOS.length]

          const cantidadItems = 1 + (contadorGlobal % 2) // 1 o 2 ítems
          const itemsAInsertar = []
          for (let i = 0; i < cantidadItems; i++) {
            const compra = compras[(contadorGlobal + i) % compras.length]
            if (compra.cantidadDisponible < 1) continue // sin stock, se omite este ítem
            const esCredito = (contadorGlobal + i) % 3 === 0 // ~1 de cada 3 ítems a crédito
            itemsAInsertar.push({ compra, esCredito })
            compra.cantidadDisponible -= 1 // reservado en memoria para el resto del script
          }
          if (itemsAInsertar.length === 0) continue // ninguna compra con stock disponible

          const montoTotal = itemsAInsertar.reduce(
            (acc, it) => acc + Number(it.compra.precioBase),
            0
          )

          const { rows: ventaInsertada } = await db.query(
            `INSERT INTO ventas (cliente_id, usuario_id, fecha, monto_total, metodo_pago, tipo_comprobante)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [cliente?.id ?? null, usuarioId, fecha, montoTotal, metodoPago, MARCADOR]
          )
          const ventaId = ventaInsertada[0].id

          for (const { compra, esCredito } of itemsAInsertar) {
            const precio = Number(compra.precioBase)
            const fechaPagoPrevista = esCredito
              ? fechaISO10(fechaHaceNDias(dia - 30, 12, 0)) // 30 días después de la venta
              : null

            const { rows: itemInsertado } = await db.query(
              `INSERT INTO items_venta
                 (venta_id, producto_id, compra_id, cantidad, precio_base, precio_unitario, tipo_pago, fecha_pago_prevista)
               VALUES ($1, $2, $3, 1, $4, $4, $5, $6) RETURNING id`,
              [
                ventaId,
                compra.productoId,
                compra.id,
                precio,
                esCredito ? 'Crédito' : 'Contado',
                fechaPagoPrevista
              ]
            )
            const itemId = itemInsertado[0].id

            // Descuenta el stock real, igual que haría registrarVenta.
            await db.query(
              'UPDATE compras SET cantidad_disponible = cantidad_disponible - 1 WHERE id = $1',
              [compra.id]
            )
            await db.query('UPDATE productos SET stock = stock - 1 WHERE id = $1', [
              compra.productoId
            ])

            if (!esCredito) {
              // Contado: pago automático por el total, mismo día (ver
              // entidades-dominio.md, 7.2).
              await db.query(
                'INSERT INTO pagos (item_venta_id, monto, fecha, metodo_pago) VALUES ($1, $2, $3, $4)',
                [itemId, precio, fecha, metodoPago]
              )
            } else {
              const patron = PATRONES_CREDITO[contadorGlobal % PATRONES_CREDITO.length]
              if (patron === 'parcial') {
                await db.query(
                  'INSERT INTO pagos (item_venta_id, monto, fecha, metodo_pago) VALUES ($1, $2, $3, $4)',
                  [
                    itemId,
                    Math.round(precio / 2),
                    fechaHaceNDias(Math.max(dia - 10, 0), 10, 0),
                    'Efectivo'
                  ]
                )
              } else if (patron === 'pagado') {
                await db.query(
                  'INSERT INTO pagos (item_venta_id, monto, fecha, metodo_pago) VALUES ($1, $2, $3, $4)',
                  [itemId, precio, fechaHaceNDias(Math.max(dia - 15, 0), 10, 0), 'Efectivo']
                )
              }
              // 'sin_pago': no se inserta nada, queda con saldo pendiente completo.
            }
          }

          ventasCreadas++
        }
      }
      await db.query('COMMIT')
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

    console.log(`Listo. ${ventasCreadas} venta/s de prueba creadas en ${DIAS_A_GENERAR} días.`)
  } finally {
    await db.close()
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`)
  process.exitCode = 1
})

// scripts/seed.mjs
//
// Carga datos de ejemplo (categorías, proveedores, productos y sus primeros
// lotes de compra) a través de la API local, NO escribiendo directo en la
// base. Así se respeta toda la lógica de negocio que ya vive en el backend:
// el alta de un producto nuevo siempre ocurre junto a su primera compra
// (ver routes/compras.ts), y el stock agregado del producto se actualiza
// como parte de esa misma transacción.
//
// Requiere que la app esté corriendo (`npm run dev` en otra terminal), para
// que el servidor Express local esté escuchando en 127.0.0.1:4000.
//
// Uso:
//   node scripts/seed.mjs
//
// Es re-ejecutable: si un producto ya existe (mismo nombre exacto), lo
// detecta y no lo vuelve a crear ni le agrega lotes de nuevo. Categorías y
// proveedores se buscan por nombre antes de crear, por la misma razón.
//
// Volumen de productos (agregado 20/10/2026, para probar la paginación de
// StockScreen — ver routes/productos.ts): además del puñado de productos
// "de ejemplo" de abajo, se generan ~200 productos más por combinación de
// nombre base + variante (marca, medida o modelo de vehículo según la
// categoría — ver `generarProductosDeRelleno`, más abajo). No son al azar:
// la combinatoria es determinística (mismo resultado en cada corrida), lo
// cual importa porque el seed es idempotente — una corrida con Math.random()
// generaría nombres distintos cada vez y nunca los detectaría como "ya
// existe".

const API_BASE = 'http://127.0.0.1:4000/api'

async function api(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  })
  const body = await res.json()
  if (!body.ok) {
    throw new Error(`${options?.method ?? 'GET'} ${path} → ${body.error.message}`)
  }
  return body.data
}

async function esperarServidor() {
  for (let intento = 1; intento <= 10; intento++) {
    try {
      await api('/health')
      return
    } catch {
      if (intento === 1) {
        console.log('Esperando a que el servidor local (127.0.0.1:4000) esté listo...')
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error(
    'No se pudo conectar con http://127.0.0.1:4000/api/health. ¿Está corriendo "npm run dev" en otra terminal?'
  )
}

// --- Datos de ejemplo -----------------------------------------------------

const categoriasData = [
  'Baterías',
  'Filtros',
  'Lubricantes',
  'Frenos',
  'Neumáticos',
  'Encendido',
  'Correas y Mangueras'
]

const proveedoresData = [
  { nombre: 'Distribuidora Acumsa', contacto: '021 555 1010' },
  { nombre: 'Baterías del Este SRL', contacto: '0981 234 567' },
  { nombre: 'Repuestos Central', contacto: '021 555 2020' },
  { nombre: 'Importadora Ruta 2', contacto: '0971 888 222' },
  { nombre: 'Lubricantes del Sur', contacto: '021 555 3030' },
  { nombre: 'Neumáticos Ñandutí', contacto: '0981 444 555' }
]

// Cada producto trae su categoría (por nombre, ver categoriasData) y uno o
// más lotes de compra (cada lote trae su proveedor, por nombre). El primer
// lote de cada producto es el que lo da de alta (ver routes/compras.ts).
const productosData = [
  {
    nombre: 'Batería 12V 60Ah',
    categoria: 'Baterías',
    precioBase: 420000,
    stockMinimo: 3,
    lotes: [
      {
        proveedor: 'Distribuidora Acumsa',
        fecha: '2026-07-10',
        cantidad: 3,
        precioCompra: 310000,
        garantiaProveedor: 18,
        factura: '001-001-0003421'
      },
      {
        proveedor: 'Baterías del Este SRL',
        fecha: '2026-08-20',
        cantidad: 3,
        precioCompra: 295000,
        garantiaProveedor: 12,
        factura: '002-003-0001187'
      }
    ]
  },
  {
    nombre: 'Filtro de aceite',
    categoria: 'Filtros',
    precioBase: 45000,
    stockMinimo: 5,
    lotes: [
      {
        proveedor: 'Repuestos Central',
        fecha: '2026-08-01',
        cantidad: 20,
        precioCompra: 28000,
        garantiaProveedor: null,
        factura: '003-001-0009981'
      }
    ]
  },
  {
    nombre: 'Filtro de aire',
    categoria: 'Filtros',
    precioBase: 52000,
    stockMinimo: 5,
    lotes: [
      {
        proveedor: 'Repuestos Central',
        fecha: '2026-08-01',
        cantidad: 15,
        precioCompra: 33000,
        garantiaProveedor: null,
        factura: '003-001-0009982'
      }
    ]
  },
  {
    nombre: 'Aceite 20W-50 (litro)',
    categoria: 'Lubricantes',
    precioBase: 38000,
    stockMinimo: 10,
    lotes: [
      {
        proveedor: 'Repuestos Central',
        fecha: '2026-08-01',
        cantidad: 30,
        precioCompra: 24000,
        garantiaProveedor: null,
        factura: '003-001-0009983'
      }
    ]
  },
  {
    nombre: 'Aceite sintético 5W-30 (litro)',
    categoria: 'Lubricantes',
    precioBase: 62000,
    stockMinimo: 8,
    lotes: [
      {
        proveedor: 'Lubricantes del Sur',
        fecha: '2026-09-05',
        cantidad: 18,
        precioCompra: 41000,
        garantiaProveedor: null,
        factura: '005-001-0002234'
      }
    ]
  },
  {
    nombre: 'Pastillas de freno delanteras',
    categoria: 'Frenos',
    precioBase: 185000,
    // A propósito, por debajo de la cantidad comprada: para que el producto
    // aparezca marcado "Stock bajo" al probar la pantalla.
    stockMinimo: 10,
    lotes: [
      {
        proveedor: 'Importadora Ruta 2',
        fecha: '2026-09-12',
        cantidad: 4,
        precioCompra: 130000,
        garantiaProveedor: 6,
        factura: '004-001-0005512'
      }
    ]
  },
  {
    nombre: 'Discos de freno',
    categoria: 'Frenos',
    precioBase: 310000,
    stockMinimo: 4,
    lotes: [
      {
        proveedor: 'Importadora Ruta 2',
        fecha: '2026-09-12',
        cantidad: 6,
        precioCompra: 225000,
        garantiaProveedor: 6,
        factura: '004-001-0005513'
      }
    ]
  },
  {
    nombre: 'Neumático 185/65 R15',
    categoria: 'Neumáticos',
    precioBase: 495000,
    stockMinimo: 4,
    lotes: [
      {
        proveedor: 'Neumáticos Ñandutí',
        fecha: '2026-09-20',
        cantidad: 8,
        precioCompra: 370000,
        garantiaProveedor: 24,
        factura: '006-001-0001099'
      }
    ]
  },
  {
    nombre: 'Bujía NGK',
    categoria: 'Encendido',
    precioBase: 28000,
    stockMinimo: 12,
    lotes: [
      {
        proveedor: 'Repuestos Central',
        fecha: '2026-08-15',
        cantidad: 40,
        precioCompra: 17000,
        garantiaProveedor: null,
        factura: '003-001-0010022'
      },
      {
        proveedor: 'Importadora Ruta 2',
        fecha: '2026-09-28',
        cantidad: 20,
        precioCompra: 16500,
        garantiaProveedor: null,
        factura: '004-001-0005590'
      }
    ]
  },
  {
    nombre: 'Correa de distribución',
    categoria: 'Correas y Mangueras',
    precioBase: 145000,
    stockMinimo: 3,
    lotes: [
      {
        proveedor: 'Importadora Ruta 2',
        fecha: '2026-09-28',
        cantidad: 5,
        precioCompra: 98000,
        garantiaProveedor: 12,
        factura: '004-001-0005591'
      }
    ]
  }
]

// --- Generación de productos de relleno (para probar la paginación) -------
//
// Mismo formato que `productosData` (nombre, categoria, precioBase,
// stockMinimo, lotes), para poder mezclarse con él sin que el resto del
// script (búsqueda por nombre, alta vía /compras, idempotencia) tenga que
// saber de dónde salió cada producto.

const PROVEEDORES_NOMBRES = proveedoresData.map((p) => p.nombre)

// Fecha determinística relativa a una fecha de referencia fija (no a "hoy"):
// así el seed sigue siendo reproducible corrida tras corrida, que es lo que
// permite detectar productos "ya existentes" por nombre.
function fechaDesde(diasAtras) {
  const referencia = new Date('2026-10-20T00:00:00Z')
  referencia.setUTCDate(referencia.getUTCDate() - diasAtras)
  return referencia.toISOString().slice(0, 10)
}

// Una "plantilla" por categoría: nombres base (el tipo de producto) x
// variantes (marca, medida de neumático, o modelo de vehículo al que
// aplica el repuesto, según corresponda). El nombre final es
// "<base> — <variante>", por ejemplo "Pastillas de freno delanteras —
// Chevrolet Onix".
const plantillasDeRelleno = [
  {
    categoria: 'Baterías',
    bases: [
      'Batería 12V 45Ah',
      'Batería 12V 50Ah',
      'Batería 12V 65Ah',
      'Batería 12V 70Ah',
      'Batería 12V 90Ah',
      'Batería 24V 100Ah'
    ],
    variantes: ['Bosch', 'Moura', 'Solite', 'Fulgor', 'Heliar', 'Willard'],
    precioBase: 300000,
    garantiaMeses: 12
  },
  {
    categoria: 'Filtros',
    bases: ['Filtro de aceite', 'Filtro de aire', 'Filtro de combustible', 'Filtro de cabina'],
    variantes: [
      'Toyota Corolla',
      'Chevrolet Onix',
      'VW Gol',
      'Hyundai HB20',
      'Ford Ka',
      'Fiat Palio',
      'Renault Sandero',
      'Nissan March'
    ],
    precioBase: 40000,
    garantiaMeses: null
  },
  {
    categoria: 'Lubricantes',
    bases: [
      'Aceite 20W-50',
      'Aceite 15W-40',
      'Aceite sintético 5W-30',
      'Aceite sintético 5W-40',
      'Aceite de caja manual 80W-90',
      'Líquido de frenos DOT4',
      'Refrigerante concentrado'
    ],
    variantes: ['1 litro', '4 litros', '20 litros'],
    precioBase: 35000,
    garantiaMeses: null
  },
  {
    categoria: 'Frenos',
    bases: [
      'Pastillas de freno delanteras',
      'Pastillas de freno traseras',
      'Discos de freno',
      'Cintas de freno'
    ],
    variantes: [
      'Toyota Corolla',
      'Chevrolet Onix',
      'VW Gol',
      'Hyundai HB20',
      'Ford Ka',
      'Fiat Palio',
      'Renault Sandero',
      'Nissan March'
    ],
    precioBase: 150000,
    garantiaMeses: 6
  },
  {
    categoria: 'Neumáticos',
    bases: [
      '175/70 R13',
      '185/65 R14',
      '185/65 R15',
      '195/60 R15',
      '195/55 R16',
      '205/55 R16',
      '215/60 R16'
    ],
    variantes: ['Pirelli', 'Goodyear', 'Bridgestone', 'Continental', 'Firestone'],
    precioBase: 420000,
    garantiaMeses: 24
  },
  {
    categoria: 'Encendido',
    bases: ['Bujía NGK', 'Bujía Bosch', 'Cable de bujía (juego)', 'Bobina de encendido'],
    variantes: [
      'Toyota Corolla',
      'Chevrolet Onix',
      'VW Gol',
      'Hyundai HB20',
      'Ford Ka',
      'Fiat Palio'
    ],
    precioBase: 25000,
    garantiaMeses: null
  },
  {
    categoria: 'Correas y Mangueras',
    bases: [
      'Correa de distribución',
      'Correa de alternador',
      'Correa poly-V',
      'Manguera de radiador superior'
    ],
    variantes: [
      'Toyota Corolla',
      'Chevrolet Onix',
      'VW Gol',
      'Hyundai HB20',
      'Ford Ka',
      'Fiat Palio'
    ],
    precioBase: 90000,
    garantiaMeses: 6
  }
]

function generarProductosDeRelleno() {
  const productos = []
  let contador = 0

  for (const plantilla of plantillasDeRelleno) {
    for (const base of plantilla.bases) {
      for (const variante of plantilla.variantes) {
        contador++

        // Variación determinística de precio/cantidad/stock mínimo a partir
        // del índice (no al azar, ver nota de reproducibilidad más arriba),
        // para que el listado generado no sea 100% uniforme: distintos
        // precios dentro de una misma categoría, y algunos productos con
        // cantidad por debajo de su stock mínimo (quedan marcados "Stock
        // bajo", útil para probar también ese filtro).
        const precioBase =
          Math.round((plantilla.precioBase * (1 + ((contador % 7) - 3) * 0.04)) / 100) * 100
        const cantidad = 1 + (contador % 15) // entre 1 y 15
        const stockMinimo = 3 + (contador % 6) // entre 3 y 8
        const proveedor = PROVEEDORES_NOMBRES[contador % PROVEEDORES_NOMBRES.length]

        productos.push({
          nombre: `${base} — ${variante}`,
          categoria: plantilla.categoria,
          precioBase,
          stockMinimo,
          lotes: [
            {
              proveedor,
              fecha: fechaDesde(10 + (contador % 90)),
              cantidad,
              precioCompra: Math.round((precioBase * 0.68) / 100) * 100,
              garantiaProveedor: plantilla.garantiaMeses,
              factura: `R-${String(contador).padStart(5, '0')}`
            }
          ]
        })
      }
    }
  }

  return productos
}

// --- Carga -----------------------------------------------------------------

async function obtenerOCrearCategoria(nombre) {
  const existentes = await api('/categorias')
  const encontrada = existentes.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
  if (encontrada) return encontrada.id
  const creada = await api('/categorias', { method: 'POST', body: JSON.stringify({ nombre }) })
  console.log(`  + categoría creada: ${nombre}`)
  return creada.id
}

async function obtenerOCrearProveedor(nombre, contacto) {
  const existentes = await api('/proveedores')
  const encontrado = existentes.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
  if (encontrado) return encontrado.id
  const creado = await api('/proveedores', {
    method: 'POST',
    body: JSON.stringify({ nombre, contacto })
  })
  console.log(`  + proveedor creado: ${nombre}`)
  return creado.id
}

async function buscarProductoPorNombre(nombre) {
  // GET /api/productos ahora pagina desde el backend (ver routes/productos.ts,
  // 20/10/2026) y devuelve { items, total, pagina, porPagina } en vez de un
  // array plano — de ahí `.items`, no el resultado directo. Se pide
  // `porPagina=100`: alcanza para que el nombre buscado nunca quede fuera de
  // la página si `q` llega a matchear por nombre parcial a varios productos
  // (ej. "Filtro de aceite" matchea también "Filtro de aceite — Toyota
  // Corolla", etc.).
  const { items } = await api(`/productos?q=${encodeURIComponent(nombre)}&porPagina=100`)
  return items.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase()) ?? null
}

async function main() {
  await esperarServidor()

  console.log('\nCategorías:')
  const categoriaIds = {}
  for (const nombre of categoriasData) {
    categoriaIds[nombre] = await obtenerOCrearCategoria(nombre)
  }

  console.log('\nProveedores:')
  const proveedorIds = {}
  for (const { nombre, contacto } of proveedoresData) {
    proveedorIds[nombre] = await obtenerOCrearProveedor(nombre, contacto)
  }

  console.log('\nProductos y compras:')
  const todosLosProductos = [...productosData, ...generarProductosDeRelleno()]
  let productosCreados = 0
  let lotesCreados = 0
  for (const producto of todosLosProductos) {
    const existente = await buscarProductoPorNombre(producto.nombre)
    if (existente) {
      console.log(`  = ya existe, se omite: ${producto.nombre}`)
      continue
    }

    const [primerLote, ...restoLotes] = producto.lotes

    const primeraCompra = await api('/compras', {
      method: 'POST',
      body: JSON.stringify({
        productoNuevo: {
          nombre: producto.nombre,
          categoriaId: categoriaIds[producto.categoria],
          precioBase: producto.precioBase,
          stockMinimo: producto.stockMinimo
        },
        proveedorId: proveedorIds[primerLote.proveedor],
        fecha: primerLote.fecha,
        cantidad: primerLote.cantidad,
        precioCompra: primerLote.precioCompra,
        garantiaProveedor: primerLote.garantiaProveedor,
        factura: primerLote.factura
      })
    })
    productosCreados++
    lotesCreados++

    for (const lote of restoLotes) {
      await api('/compras', {
        method: 'POST',
        body: JSON.stringify({
          productoId: primeraCompra.productoId,
          proveedorId: proveedorIds[lote.proveedor],
          fecha: lote.fecha,
          cantidad: lote.cantidad,
          precioCompra: lote.precioCompra,
          garantiaProveedor: lote.garantiaProveedor,
          factura: lote.factura
        })
      })
      lotesCreados++
    }

    console.log(`  + producto creado: ${producto.nombre} (${producto.lotes.length} lote/s)`)
  }

  console.log(
    `\nListo. ${productosCreados} producto/s nuevo/s, ${lotesCreados} lote/s de compra cargado/s.`
  )
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`)
  process.exitCode = 1
})

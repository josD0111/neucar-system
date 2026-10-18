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
  const resultados = await api(`/productos?q=${encodeURIComponent(nombre)}`)
  return resultados.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase()) ?? null
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
  let productosCreados = 0
  let lotesCreados = 0
  for (const producto of productosData) {
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

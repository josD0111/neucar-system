// src/renderer/src/App.tsx
//
// Raíz de la interfaz. Ahora la app exige iniciar sesión: mientras no haya un
// usuario autenticado se muestra la pantalla de login, y el rol que usan las
// pantallas sale del usuario real (ya no del selector "Ver como" del prototipo).
//
// El sidebar y "main" son hermanos dentro de un contenedor flex en fila
// (antes el sidebar usaba position: fixed, ver la corrección 08/11/2026 en
// Sidebar.tsx). Si el contenido de una pantalla (una tabla ancha, por
// ejemplo) fuerza scroll horizontal, ese scroll queda contenido dentro de
// "main" únicamente — el sidebar, al tener su propio overflow, nunca se
// mueve ni se angosta (flexShrink: 0).
//
// ZOOM: la interfaz completa (ver <EscalaApp> más abajo) se agranda con
// `transform: scale()` en vez del zoom nativo de Electron — ver la nota
// larga en main/index.ts sobre por qué (el zoom nativo pintaba el
// contenido recortado cerca del borde inferior). Por eso acá adentro se
// usa `height: '100%'` y no `100vh`: `100vh` apunta siempre al viewport
// real de la ventana, sin importar que un ancestro tenga `transform`, así
// que dentro de <EscalaApp> rompería las cuentas. `100%` en cambio hereda
// el tamaño ya compensado del wrapper.

import { useState } from 'react'
import './design/tokens.css'
import { Sidebar, type Pantalla } from './components/Sidebar'
import { AppDataProvider } from './data/AppDataContext'
import { AuthProvider, useAuth } from './data/AuthContext'
import { LoginScreen } from './screens/LoginScreen'
import { StockScreen } from './screens/StockScreen'
import { CategoriaScreen } from './screens/CategoriaScreen'
import { ProveedorScreen } from './screens/ProveedorScreen'
import { VentaScreen } from './screens/VentaScreen'
import { VentasScreen } from './screens/VentasScreen'
import { OrdenServicioScreen } from './screens/OrdenServicioScreen'
import { ClienteScreen } from './screens/ClienteScreen'
import { HistorialServiciosScreen } from './screens/HistorialServiciosScreen'

// Parte de la app que solo se ve con sesión iniciada. Al cerrar sesión este
// componente se desmonta, así que la pantalla activa vuelve a "stock" sola.
function AppAutenticada(): React.JSX.Element {
  const [pantalla, setPantalla] = useState<Pantalla>('stock')

  return (
    <AppDataProvider>
      <div style={{ height: '100%', overflow: 'hidden', display: 'flex' }}>
        <Sidebar pantallaActiva={pantalla} onCambiarPantalla={setPantalla} />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            padding: 'var(--space-5)',
            // Más aire abajo que en los otros lados (07/11/2026): en
            // pantallas largas (ej. Ficha de cliente con muchas deudas), al
            // scrollear hasta el final la última fila quedaba prácticamente
            // pegada al borde inferior de la ventana — no faltaba contenido
            // (se confirmó que el scroll sí llega hasta la última fila
            // real), pero daba la sensación visual de estar cortada. Con
            // más margen de respiro queda claro que se llegó al final.
            paddingBottom: 'calc(var(--space-5) * 3)',
            boxSizing: 'border-box'
          }}
        >
          {pantalla === 'stock' && <StockScreen />}
          {pantalla === 'categorias' && <CategoriaScreen />}
          {pantalla === 'proveedores' && <ProveedorScreen />}
          {pantalla === 'venta' && <VentaScreen />}
          {pantalla === 'ventas' && <VentasScreen />}
          {pantalla === 'servicio' && <OrdenServicioScreen />}
          {pantalla === 'historialServicios' && <HistorialServiciosScreen />}
          {pantalla === 'cliente' && <ClienteScreen />}
        </main>
      </div>
    </AppDataProvider>
  )
}

// Decide qué mostrar según el estado de la sesión.
function Contenido(): React.JSX.Element {
  const { usuario, cargando } = useAuth()

  // Mientras se verifica si había una sesión guardada, evitamos mostrar el login por un instante.
  if (cargando) {
    return <div style={{ padding: 'var(--space-5)' }}>Cargando…</div>
  }
  // Sin usuario autenticado: pantalla de login.
  if (!usuario) return <LoginScreen />
  // Con usuario: el sistema. Cada pantalla que necesita el rol lo lee de
  // useAuth() directamente (ver VentaScreen.tsx, ClienteScreen.tsx), así que
  // ya no hace falta pasarlo como prop acá.
  return <AppAutenticada />
}

// Factor de agrandado de toda la interfaz (ver la nota de ZOOM arriba).
const ESCALA = 1.15
// 100 / ESCALA: el ancho/alto que necesita el contenido ANTES de agrandarlo
// para que, ya escalado, termine ocupando exactamente el 100% real.
const ESCALA_INVERSA = `${100 / ESCALA}%`

// Agranda toda la app con transform (no con el zoom nativo de Electron).
// El div exterior mide el 100% real de la ventana; el interior mide un
// 86,9…% de eso y se estira 1.15x con `transform: scale`, así que
// visualmente vuelve a ocupar el 100% — pero el layout interno (scroll,
// overflow, getBoundingClientRect) se calcula sobre ese tamaño interior
// "chico", de forma simple y predecible, y recién al final todo el
// resultado ya resuelto se escala para pintarse más grande.
function EscalaApp({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: ESCALA_INVERSA,
          height: ESCALA_INVERSA,
          transform: `scale(${ESCALA})`,
          transformOrigin: 'top left'
        }}
      >
        {children}
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <EscalaApp>
        <AuthProvider>
          <Contenido />
        </AuthProvider>
      </EscalaApp>
    </div>
  )
}

export default App

// src/renderer/src/App.tsx
//
// Raíz de la interfaz. Ahora la app exige iniciar sesión: mientras no haya un
// usuario autenticado se muestra la pantalla de login, y el rol que usan las
// pantallas sale del usuario real (ya no del selector "Ver como" del prototipo).
//
// El sidebar usa position: fixed para que quede anclado a la izquierda sin
// depender del ancho de "main". Si el contenido de una pantalla (una tabla
// ancha, por ejemplo) fuerza scroll horizontal, ese scroll queda contenido
// dentro de "main" únicamente — el sidebar nunca se mueve.

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
import { OrdenServicioScreen } from './screens/OrdenServicioScreen'
import { ClienteScreen } from './screens/ClienteScreen'

// Parte de la app que solo se ve con sesión iniciada. Al cerrar sesión este
// componente se desmonta, así que la pantalla activa vuelve a "stock" sola.
function AppAutenticada({ rol }: { rol: 'Administrador' | 'Empleado' }): React.JSX.Element {
  const [pantalla, setPantalla] = useState<Pantalla>('stock')

  return (
    <AppDataProvider>
      <div style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <Sidebar pantallaActiva={pantalla} onCambiarPantalla={setPantalla} />
        <main
          style={{
            marginLeft: 'var(--sidebar-width)',
            height: '100vh',
            overflowY: 'auto',
            overflowX: 'auto',
            padding: 'var(--space-5)',
            boxSizing: 'border-box'
          }}
        >
          {pantalla === 'stock' && <StockScreen />}
          {pantalla === 'categorias' && <CategoriaScreen />}
          {pantalla === 'proveedores' && <ProveedorScreen />}
          {pantalla === 'venta' && <VentaScreen rol={rol} />}
          {pantalla === 'servicio' && <OrdenServicioScreen />}
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
  // Con usuario: el sistema, usando el rol real.
  return <AppAutenticada rol={usuario.rol} />
}

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  )
}

export default App
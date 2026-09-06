// src/renderer/src/App.tsx
//
// Prototipo clickeable — Sprint 0.5 (ver docs/03-gestion-proyecto/
// plan-gestion-proyecto.md, sección 2.1). Sin backend real, pero con estado
// compartido en memoria (AppDataProvider) para que las acciones entre
// pantallas se reflejen entre sí (ej. una venta baja el stock real).
//
// El sidebar usa position: fixed para que quede anclado a la izquierda sin
// depender del ancho de "main". Si el contenido de una pantalla (una tabla
// ancha, por ejemplo) fuerza scroll horizontal, ese scroll queda contenido
// dentro de "main" únicamente — el sidebar nunca se mueve.

import { useState } from 'react'
import './design/tokens.css'
import { Sidebar, type Pantalla, type Rol } from './components/Sidebar'
import { AppDataProvider } from './data/AppDataContext'
import { StockScreen } from './screens/StockScreen'
import { VentaScreen } from './screens/VentaScreen'
import { OrdenServicioScreen } from './screens/OrdenServicioScreen'
import { ClienteScreen } from './screens/ClienteScreen'

function App(): React.JSX.Element {
  const [pantalla, setPantalla] = useState<Pantalla>('stock')
  const [rol, setRol] = useState<Rol>('Administrador')

  return (
    <AppDataProvider>
      <div style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <Sidebar pantallaActiva={pantalla} onCambiarPantalla={setPantalla} rol={rol} onCambiarRol={setRol} />
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
          {pantalla === 'venta' && <VentaScreen rol={rol} />}
          {pantalla === 'servicio' && <OrdenServicioScreen />}
          {pantalla === 'cliente' && <ClienteScreen />}
        </main>
      </div>
    </AppDataProvider>
  )
}

export default App
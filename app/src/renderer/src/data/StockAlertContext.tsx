// src/renderer/src/data/StockAlertContext.tsx
//
// Contador de productos con stock bajo (HU-08), que Sidebar.tsx muestra al
// lado de "Control de stock" — solo para el Administrador (decisión del
// dueño, 16/11/2026; el Empleado no lo ve aunque sí puede entrar a Control
// de Stock).
//
// No hay endpoint nuevo: se reutiliza GET /api/productos?soloStockBajo=true,
// pidiendo porPagina=1 para traer nada más que el `total` de la respuesta
// paginada, sin bajar el listado completo.
//
// Cuándo se recalcula:
// - Al iniciar sesión / cambiar de usuario.
// - Cada vez que se cambia de pantalla en el menú (ver Sidebar.tsx) — cubre
//   la mayoría de los casos (volver a Stock después de vender, etc.).
// - A pedido explícito, llamando a `refrescar()` — lo usan VentaScreen.tsx
//   (después de registrar una venta) y StockScreen.tsx (después de
//   registrar una compra), los dos momentos en que el stock se mueve de
//   verdad, para que el número no dependa de que encima se cambie de
//   pantalla para actualizarse.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { productosApi } from '../api/productos'
import { useAuth } from './AuthContext'

interface StockAlertContextValue {
  // null mientras todavía no se sabe (no mostrar nada esa vez); 0 = no hay
  // ningún producto bajo (tampoco se muestra nada, pero por otro motivo).
  contador: number | null
  refrescar: () => void
}

const StockAlertContext = createContext<StockAlertContextValue | null>(null)

export function StockAlertProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador'
  const [contador, setContador] = useState<number | null>(null)

  // Evita pisar el estado con la respuesta de un pedido que ya quedó
  // obsoleto (ej.: dos refrescos encimados, cambio de pantalla muy seguido).
  const idPedidoActual = useRef(0)

  const refrescar = useCallback(() => {
    if (!esAdmin) {
      setContador(null)
      return
    }
    const idPedido = ++idPedidoActual.current
    productosApi
      .listar({ soloStockBajo: true, porPagina: 1 })
      .then((r) => {
        if (idPedido !== idPedidoActual.current) return
        setContador(r.total)
      })
      .catch(() => {
        // Si falla (servidor no disponible, etc.), no se muestra nada —
        // mejor sin aviso que un número viejo o un error en el sidebar.
        if (idPedido === idPedidoActual.current) setContador(null)
      })
  }, [esAdmin])

  useEffect(() => {
    refrescar()
  }, [refrescar])

  return <StockAlertContext.Provider value={{ contador, refrescar }}>{children}</StockAlertContext.Provider>
}

export function useStockAlert(): StockAlertContextValue {
  const ctx = useContext(StockAlertContext)
  if (!ctx) throw new Error('useStockAlert debe usarse dentro de <StockAlertProvider>')
  return ctx
}

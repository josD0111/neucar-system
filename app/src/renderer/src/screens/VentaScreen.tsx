// src/renderer/src/screens/VentaScreen.tsx
//
// Ensamblado de la nueva pantalla de Ventas (Sprint 3 — HU-39, HU-40,
// Etapa 3 de plan-tecnico-pantalla-ventas.md). Basada en el prototipo
// HTML de referencia (prototipos/pantalla_de_ventas_taller_automotriz.html).
//
// Estructura modular en 4 franjas (A, B, C, D) + Modales:
//   - Franja A: Búsqueda de Productos (A1) y Cliente + Condición Contado/Crédito (A2).
//   - Franja B: Formulario de edición del ítem seleccionado (manual por lote).
//   - Franja C: Tabla de detalle de ítems de la venta (edición al hacer clic).
//   - Franja D: Footer con totales, método de pago y confirmación.
//   - Modales: ModalConfirmarCredito (pago inicial obligatorio > 0 + fecha prevista)
//              y diálogo de éxito con acceso directo al comprobante PDF (HU-21).
//
// Soporte de roles:
//   - Administrador: flujo completo con selección de lote, precio unitario negociable,
//     garantía, condición de crédito y confirmación final de venta.
//   - Empleado: modo calculadora (HU-17), ve totales a precio base sin opción de confirmar.

import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../data/AuthContext'
import { useStockAlert } from '../data/StockAlertContext'
import { ventasApi } from '../api/ventas'
import { productosApi } from '../api/productos'
import type { Cliente, Producto, TipoPago, VentaInput } from '../api/types'
import { BuscadorProductos } from '../components/BuscadorProductos'
import { PanelClienteCondicion } from '../components/PanelClienteCondicion'
import { FormularioItemEdicion, type ItemEdicion } from '../components/FormularioItemEdicion'
import { TablaDetalleVenta, type LineaVenta } from '../components/TablaDetalleVenta'
import { FooterVenta, type MetodoPago } from '../components/FooterVenta'
import {
  ModalConfirmarCredito,
  type DatosConfirmacionCredito
} from '../components/ModalConfirmarCredito'

// Mismo criterio de formato que CobroCredito.tsx / VentasScreen.tsx /
// HistorialServiciosScreen.tsx / TablaDetalleVenta.tsx / FooterVenta.tsx:
// moneda local (Gs.) con separador de miles.
function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

interface VentaExitosaInfo {
  id: number
  total: number
  tipoPago: TipoPago
  // Solo tiene sentido cuando tipoPago === 'Crédito' (el pago inicial que se
  // cargó en ModalConfirmarCredito); permite mostrar también el saldo que
  // queda pendiente en el modal de éxito.
  montoInicial?: number
  // Productos vendidos en esta venta que, después de descontar el stock,
  // quedaron en su stock mínimo o por debajo — se resuelve consultando cada
  // producto recién después de guardar (ver ejecutarRegistroVenta).
  productosStockBajo: { nombre: string; stock: number }[]
}

export function VentaScreen(): React.JSX.Element {
  const { usuario, token } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador'
  const { refrescar: refrescarStockAlert } = useStockAlert()

  // --- Estado de la venta ---
  const [tipoPago, setTipoPago] = useState<TipoPago>('Contado')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [items, setItems] = useState<LineaVenta[]>([])

  // Contador para generar IDs únicos de fila en la tabla de detalle
  const siguienteIdLinea = useRef(1)

  // --- Estado de edición de ítem (Franja B) ---
  const [itemEnEdicion, setItemEnEdicion] = useState<ItemEdicion | null>(null)
  const [idLineaEditando, setIdLineaEditando] = useState<number | null>(null)

  // --- Estado de modales y proceso de guardado ---
  const [modalCreditoAbierto, setModalCreditoAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ventaExitosa, setVentaExitosa] = useState<VentaExitosaInfo | null>(null)

  // Se incrementa después de cada venta registrada para forzar a
  // BuscadorProductos (Franja A1) a volver a pedir el catálogo: su stock
  // quedaba desactualizado hasta cambiar de pantalla y volver.
  const [refrescarCatalogo, setRefrescarCatalogo] = useState(0)

  // --- Total a pagar ---
  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0),
    [items]
  )

  // Selección de producto en A1 -> carga en Franja B como ítem nuevo
  const handleSeleccionarProducto = (producto: Producto): void => {
    setItemEnEdicion({
      idLinea: null,
      producto,
      compraId: '',
      cantidad: 1,
      precioUnitario: Number(producto.precioBase),
      garantiaOfrecida: ''
    })
    setIdLineaEditando(null)
  }

  // Clic en fila de C -> carga en Franja B para editar
  const handleEditarItem = (linea: LineaVenta): void => {
    setItemEnEdicion({
      idLinea: linea.idLinea,
      producto: linea.producto,
      compraId: linea.compraId,
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario,
      garantiaOfrecida: linea.garantiaOfrecida
    })
    setIdLineaEditando(linea.idLinea)
  }

  // Cancelar edición en Franja B
  const handleCancelarEdicion = (): void => {
    setItemEnEdicion(null)
    setIdLineaEditando(null)
  }

  // Confirmar ítem en Franja B (agregar o actualizar)
  const handleConfirmarItem = (item: ItemEdicion, loteTexto: string | null): void => {
    const precio =
      typeof item.precioUnitario === 'number' && item.precioUnitario >= 0
        ? item.precioUnitario
        : Number(item.producto.precioBase)

    if (item.idLinea !== null) {
      // Actualizar fila existente
      setItems((prev) =>
        prev.map((linea) =>
          linea.idLinea === item.idLinea
            ? {
                ...linea,
                compraId: item.compraId,
                loteTexto,
                cantidad: item.cantidad,
                precioUnitario: precio,
                garantiaOfrecida: item.garantiaOfrecida
              }
            : linea
        )
      )
    } else {
      // Agregar nueva línea
      const nuevaLinea: LineaVenta = {
        idLinea: siguienteIdLinea.current++,
        producto: item.producto,
        compraId: item.compraId,
        loteTexto,
        cantidad: item.cantidad,
        precioUnitario: precio,
        garantiaOfrecida: item.garantiaOfrecida
      }
      setItems((prev) => [...prev, nuevaLinea])
    }

    setItemEnEdicion(null)
    setIdLineaEditando(null)
  }

  // Eliminar fila de Franja C
  const handleEliminarItem = (idLinea: number): void => {
    setItems((prev) => prev.filter((it) => it.idLinea !== idLinea))
    if (idLineaEditando === idLinea) {
      setItemEnEdicion(null)
      setIdLineaEditando(null)
    }
  }

  // Cancelar venta completa
  const handleCancelarVenta = (): void => {
    if (items.length === 0 && !itemEnEdicion) return
    if (window.confirm('¿Seguro que querés cancelar y limpiar esta venta?')) {
      setItems([])
      setItemEnEdicion(null)
      setIdLineaEditando(null)
      setCliente(null)
      setTipoPago('Contado')
      setError(null)
    }
  }

  // Disparo al pulsar "Guardar venta"
  const handleIntentarGuardar = (): void => {
    if (items.length === 0) {
      setError('Agregá al menos un producto a la venta.')
      return
    }

    if (tipoPago === 'Crédito') {
      if (!cliente) {
        setError(
          'Una venta a crédito debe estar asociada a un cliente registrado (seleccioná uno en Franja A2).'
        )
        return
      }
      setModalCreditoAbierto(true)
    } else {
      void ejecutarRegistroVenta()
    }
  }

  // Envío a la API
  const ejecutarRegistroVenta = async (datosCredito?: DatosConfirmacionCredito): Promise<void> => {
    if (!token) {
      setError('No hay sesión activa.')
      return
    }

    if (items.length === 0) {
      setError('No hay productos agregados a la venta.')
      return
    }

    if (tipoPago === 'Crédito' && !cliente) {
      setError('Una venta a crédito debe estar asociada a un cliente registrado.')
      return
    }

    setError(null)
    setGuardando(true)

    const input: VentaInput = {
      clienteId: cliente?.id ?? null,
      metodoPago,
      tipoPago,
      fechaPagoPrevista: datosCredito ? datosCredito.fechaPagoPrevista : null,
      pagoInicial: datosCredito
        ? {
            monto: datosCredito.montoInicial,
            metodoPago: datosCredito.metodoPagoInicial
          }
        : null,
      items: items.map((it) => ({
        productoId: it.producto.id,
        compraId: Number(it.compraId),
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        garantiaOfrecida: it.garantiaOfrecida === '' ? null : Number(it.garantiaOfrecida)
      }))
    }

    try {
      const res = await ventasApi.registrar(token, input)
      setGuardando(false)

      if (!res.ok) {
        setError(res.error.message)
        return
      }

      // Venta registrada con éxito
      refrescarStockAlert()
      setRefrescarCatalogo((n) => n + 1) // Franja A1: que vuelva a pedir el catálogo
      setModalCreditoAbierto(false)

      // Chequeo de stock bajo tras la venta: se consulta cada producto
      // vendido (una sola vez por producto distinto, no por línea) para ver
      // si quedó en su stock mínimo o por debajo, y avisar en el modal de
      // éxito. Si esta consulta puntual falla, no bloquea el aviso de venta
      // exitosa — la venta ya se guardó igual.
      const productosUnicos = Array.from(
        new Map(items.map((it) => [it.producto.id, it.producto])).values()
      )
      const productosStockBajo: { nombre: string; stock: number }[] = []
      await Promise.all(
        productosUnicos.map(async (p) => {
          try {
            const actualizado = await productosApi.obtener(p.id)
            if (actualizado.stockMinimo != null && actualizado.stock <= actualizado.stockMinimo) {
              productosStockBajo.push({ nombre: actualizado.nombre, stock: actualizado.stock })
            }
          } catch {
            // Ver comentario arriba: no interrumpe el flujo de éxito.
          }
        })
      )

      setVentaExitosa({
        id: res.data.id,
        total,
        tipoPago,
        montoInicial: datosCredito ? datosCredito.montoInicial : undefined,
        productosStockBajo
      })

      // Limpia el formulario para la siguiente venta
      setItems([])
      setItemEnEdicion(null)
      setIdLineaEditando(null)
      setCliente(null)
      setTipoPago('Contado')
    } catch {
      setGuardando(false)
      setError('Ocurrió un error inesperado al registrar la venta.')
    }
  }

  const puedeGuardar =
    items.length > 0 &&
    !guardando &&
    itemEnEdicion === null &&
    (tipoPago === 'Contado' || cliente !== null)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        height: '100%',
        minHeight: '100%'
      }}
    >
      {/* Encabezado contextual */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Venta de repuestos y productos</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            {esAdmin
              ? 'Flujo completo: cliente, selección manual de lote, precio editable y confirmación.'
              : 'Modo calculadora: el Empleado solo calcula presupuestos a precio base.'}
          </p>
        </div>
        <div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 999,
              background: esAdmin ? '#eff6ff' : 'var(--color-bg)',
              color: esAdmin ? '#2563eb' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)'
            }}
          >
            Rol: {usuario?.rol ?? 'Desconocido'}
          </span>
        </div>
      </div>

      {/* Banner de error */}
      {error && (
        <div
          style={{
            padding: '7px 12px',
            background: 'var(--color-alert-bg)',
            color: 'var(--color-alert)',
            border: '1px solid var(--color-alert)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-alert)',
              fontWeight: 'bold',
              fontSize: 14
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* =====================================================================
           FRANJA A: Búsqueda de Productos (A1) y Cliente + Condición (A2)
           ===================================================================== */}
      <section
        aria-label="Franja A: Búsqueda y Cliente"
        style={{
          display: 'grid',
          gridTemplateColumns: '7fr 5fr',
          gap: 'var(--space-2)',
          height: 268,
          flexShrink: 0
        }}
      >
        <BuscadorProductos
          onSeleccionar={handleSeleccionarProducto}
          refrescarTrigger={refrescarCatalogo}
          // Un producto con stock 0 no tiene ningún lote con cantidad
          // disponible, así que elegirlo acá nunca termina en una venta
          // posible (la Franja B queda sin lote para elegir y el botón
          // "Agregar" no se habilita) — mejor no ofrecerlo como opción.
          soloConStock
        />
        <PanelClienteCondicion
          tipoPago={tipoPago}
          onCambiarTipoPago={setTipoPago}
          clienteSeleccionado={cliente}
          onSeleccionarCliente={setCliente}
        />
      </section>

      {/* =====================================================================
           FRANJA B: Formulario de edición del ítem seleccionado
           ===================================================================== */}
      <section aria-label="Franja B: Datos del producto seleccionado" style={{ flexShrink: 0 }}>
        <FormularioItemEdicion
          itemEnEdicion={itemEnEdicion}
          esAdmin={esAdmin}
          onConfirmar={handleConfirmarItem}
          onCancelarEdicion={handleCancelarEdicion}
        />
      </section>

      {/* =====================================================================
           FRANJA C: Tabla con los ítems en el detalle de la venta
           ===================================================================== */}
      <section
        aria-label="Franja C: Detalle de venta"
        style={{
          flex: 1,
          minHeight: 260,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <TablaDetalleVenta
          items={items}
          idLineaEditando={idLineaEditando}
          esAdmin={esAdmin}
          onEditar={handleEditarItem}
          onEliminar={handleEliminarItem}
        />
      </section>

      {/* =====================================================================
           FRANJA D: Footer de totales, método de pago y acciones
           ===================================================================== */}
      <FooterVenta
        esAdmin={esAdmin}
        total={total}
        metodoPago={metodoPago}
        onCambiarMetodoPago={setMetodoPago}
        puedeGuardar={puedeGuardar}
        guardando={guardando}
        onGuardar={handleIntentarGuardar}
        onCancelar={handleCancelarVenta}
      />

      {/* Modal: Confirmación de venta a Crédito (Pago Inicial + Fecha Prevista) */}
      <ModalConfirmarCredito
        abierto={modalCreditoAbierto}
        total={total}
        confirmando={guardando}
        onConfirmar={(datos) => void ejecutarRegistroVenta(datos)}
        onCancelar={() => setModalCreditoAbierto(false)}
      />

      {/* Modal: Venta exitosa con descarga de comprobante en PDF */}
      {ventaExitosa && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-4)',
              width: 440,
              maxWidth: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 'bold',
                  flexShrink: 0
                }}
              >
                ✓
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>¡Venta registrada con éxito!</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Comprobante #{ventaExitosa.id} • Condición: {ventaExitosa.tipoPago}
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Total de la venta:
                </span>
                <span style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--color-accent)' }}>
                  Gs. {gs(ventaExitosa.total)}
                </span>
              </div>

              {ventaExitosa.tipoPago === 'Crédito' && ventaExitosa.montoInicial != null && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Pago inicial:</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Gs. {gs(ventaExitosa.montoInicial)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Saldo pendiente:</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-alert)' }}>
                      Gs. {gs(Math.max(0, ventaExitosa.total - ventaExitosa.montoInicial))}
                    </span>
                  </div>
                </>
              )}
            </div>

            {ventaExitosa.productosStockBajo.length > 0 && (
              <div
                style={{
                  background: 'var(--color-alert-bg)',
                  border: '1px solid var(--color-alert)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-2)',
                  fontSize: 12,
                  color: 'var(--color-text)'
                }}
              >
                <strong>⚠ Stock bajo:</strong> quedaron en su stock mínimo o por debajo —{' '}
                {ventaExitosa.productosStockBajo
                  .map((p) => `${p.nombre} (${p.stock})`)
                  .join(', ')}
                .
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
                marginTop: 4
              }}
            >
              <button
                type="button"
                onClick={() => {
                  void ventasApi.abrirComprobante(token, ventaExitosa.id)
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📄 Imprimir comprobante PDF
              </button>
              <button
                type="button"
                onClick={() => setVentaExitosa(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Aceptar / Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

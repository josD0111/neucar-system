// src/renderer/src/components/PanelClienteCondicion.tsx
//
// Franja A2 del nuevo flujo de Ventas (ver docs/03-gestion-proyecto/
// plan-tecnico-pantalla-ventas.md, Etapa 2, y el prototipo HTML de
// referencia): toggle Contado/Crédito a nivel de TODA la venta (cambio de
// alcance del 22/11/2026 — ya no por ítem, ver entidades-dominio.md,
// sección 12), buscador de cliente existente + alta rápida ("+Nuevo").
//
// Reutiliza `GET /api/clientes?q=` igual que ClienteScreen.tsx (con
// debounce vía useRetardo), en vez de precargar la lista completa como
// hacía el BuscadorCliente viejo de VentaScreen.tsx: con esto, el
// componente queda autónomo (no depende de que quien lo use haya cargado
// clientes de antemano) y escala igual de bien con 50 o con 5000 clientes.
//
// El alta rápida solo pide nombre + cédula/RUC + celular (mismo criterio
// que el prototipo); usa el mismo POST /api/clientes que ClienteScreen.tsx,
// así que las mismas validaciones del servidor (cédula duplicada, formato
// de RUC, etc.) aplican acá también — los errores se muestran en el modal.
//
// Nota: "Condición de la venta" (Contado/Crédito) es un concepto de LA
// VENTA, no del cliente — por eso vive en este mismo panel en vez de en
// Franja B o D, siguiendo la ubicación del prototipo.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../data/AuthContext'
import { apiFetch } from '../api/client'
import type { Cliente, TipoPago } from '../api/types'
import { useRetardo } from '../screens/useRetardo'
import { InputLimpiable } from './InputLimpiable'

interface PanelClienteCondicionProps {
  tipoPago: TipoPago
  onCambiarTipoPago: (tipo: TipoPago) => void
  clienteSeleccionado: Cliente | null
  onSeleccionarCliente: (cliente: Cliente | null) => void
}

interface FormNuevoCliente {
  nombre: string
  cedula: string
  ruc: string
  celular: string
}

const formVacio: FormNuevoCliente = { nombre: '', cedula: '', ruc: '', celular: '' }

export function PanelClienteCondicion({
  tipoPago,
  onCambiarTipoPago,
  clienteSeleccionado,
  onSeleccionarCliente
}: PanelClienteCondicionProps): React.JSX.Element {
  const { usuario, token } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador'

  // --- Buscador de cliente ---
  const [texto, setTexto] = useState('')
  const textoRetardado = useRetardo(texto, 300)
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!textoRetardado.trim()) {
      setResultados([])
      return
    }
    let cancelado = false
    apiFetch<Cliente[]>(`/api/clientes?q=${encodeURIComponent(textoRetardado.trim())}`, {
      token
    }).then((r) => {
      if (!cancelado && r.ok) setResultados(r.data)
    })
    return () => {
      cancelado = true
    }
  }, [textoRetardado, token])

  const elegirCliente = (c: Cliente): void => {
    onSeleccionarCliente(c)
    setTexto('')
    setAbierto(false)
  }

  // --- Modal de alta rápida ---
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState<FormNuevoCliente>(formVacio)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const abrirModal = (): void => {
    if (!esAdmin) return
    setForm(formVacio)
    setErrorForm(null)
    setModalAbierto(true)
  }

  const guardarNuevoCliente = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setGuardando(true)
    setErrorForm(null)
    const r = await apiFetch<Cliente>('/api/clientes', {
      method: 'POST',
      body: {
        nombre: form.nombre,
        cedula: form.cedula || null,
        ruc: form.ruc || null,
        celular: form.celular || null
      },
      token
    })
    setGuardando(false)
    if (!r.ok) {
      setErrorForm(r.error.message)
      return
    }
    setModalAbierto(false)
    elegirCliente(r.data)
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        height: '100%'
      }}
    >
      {/* Título + toggle Contado/Crédito */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: 'var(--color-text-muted)',
            margin: 0
          }}
        >
          Cliente y condición
        </h2>
        <div
          role="group"
          aria-label="Condición de venta"
          style={{
            display: 'inline-flex',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 2
          }}
        >
          {(['Contado', 'Crédito'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => onCambiarTipoPago(opcion)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                border: 'none',
                cursor: 'pointer',
                background: tipoPago === opcion ? 'var(--color-accent)' : 'transparent',
                color: tipoPago === opcion ? '#fff' : 'var(--color-text-muted)'
              }}
            >
              {opcion}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador + botón Nuevo, como estaba originalmente. El input ahora
          sí se expande de verdad: el bug era de InputLimpiable (ver ahí),
          no de este layout. */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <InputLimpiable
            value={texto}
            onChange={(v) => {
              setTexto(v)
              setAbierto(true)
            }}
            placeholder="Buscar cliente por nombre o cédula..."
            onFocus={() => texto.trim() && setAbierto(true)}
            onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--color-border)'
            }}
          />
          {abierto && resultados.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                marginTop: 4,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                maxHeight: 160,
                overflowY: 'auto',
                zIndex: 30
              }}
            >
              {resultados.map((c) => (
                // onMouseDown (no onClick) para que dispare antes del onBlur del input.
                <div
                  key={c.id}
                  onMouseDown={() => elegirCliente(c)}
                  style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                  {c.cedula && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.cedula}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {esAdmin && (
          <button
            type="button"
            onClick={abrirModal}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '0 12px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            + Nuevo
          </button>
        )}
      </div>

      {/* Estado del cliente seleccionado */}
      <div
        style={{
          flex: 1,
          minHeight: 70,
          display: 'flex',
          alignItems: 'center',
          background: clienteSeleccionado ? 'var(--color-bg)' : 'transparent',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-2)'
        }}
      >
        {clienteSeleccionado ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              gap: 'var(--space-2)'
            }}
          >
            <Dato etiqueta="Cliente" valor={clienteSeleccionado.nombre} />
            <Dato
              etiqueta="Cédula / RUC"
              valor={clienteSeleccionado.cedula ?? clienteSeleccionado.ruc ?? '—'}
            />
            <Dato etiqueta="Celular" valor={clienteSeleccionado.celular ?? '—'} />
            <button
              type="button"
              onClick={() => onSeleccionarCliente(null)}
              title="Quitar cliente (venta a cliente casual)"
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Sin cliente seleccionado — venta a cliente casual
            {tipoPago === 'Crédito' && (
              <span style={{ color: 'var(--color-alert)', fontWeight: 600 }}>
                {' '}
                (una venta a crédito necesita un cliente registrado)
              </span>
            )}
          </span>
        )}
      </div>

      {/* Modal de alta rápida (solo Administrador) */}
      {esAdmin && modalAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
        >
          <form
            onSubmit={guardarNuevoCliente}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-4)',
              width: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Registrar nuevo cliente</h3>

            <Campo label="Nombre completo / razón social *">
              <input
                required
                autoFocus
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                style={estiloInput}
              />
            </Campo>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Campo label="Cédula">
                <input
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                  style={estiloInput}
                />
              </Campo>
              <Campo label="RUC">
                <input
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  style={estiloInput}
                />
              </Campo>
            </div>
            <Campo label="Celular">
              <input
                value={form.celular}
                onChange={(e) => setForm({ ...form, celular: e.target.value })}
                style={estiloInput}
              />
            </Campo>

            {errorForm && (
              <div style={{ color: 'var(--color-alert)', fontSize: 12 }}>{errorForm}</div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)'
              }}
            >
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{
                  ...estiloBoton,
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                style={{ ...estiloBoton, background: 'var(--color-accent)', color: '#fff' }}
              >
                {guardando ? 'Guardando...' : 'Guardar y asignar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <span
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)'
        }}
      >
        {etiqueta}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {valor}
      </span>
    </div>
  )
}

function Campo({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <span
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          marginBottom: 2
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)'
}

const estiloBoton: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 14px',
  borderRadius: 'var(--radius)',
  border: 'none',
  cursor: 'pointer'
}

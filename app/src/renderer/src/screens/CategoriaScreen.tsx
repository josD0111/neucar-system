// src/renderer/src/screens/CategoriaScreen.tsx
//
// CRUD de Categorías (HU-01.1, ver sprint-1-backlog.md, punto 2). El
// Administrador gestiona libremente las categorías; no hay una lista fija.
// Antes de esta pantalla, el alta rápida de categoría vivía únicamente
// inline en los formularios de StockScreen (quick-add) — eso se mantiene
// como atajo para no interrumpir el registro de una compra, pero editar o
// eliminar una categoría ya creada se hace acá.

import { useState } from 'react'
import { useCategorias } from '../api/hooks'
import { categoriasApi } from '../api/categorias'
import { ApiClientError } from '../api/client'
import type { Categoria } from '../api/types'

function Panel({
  children,
  title
}: {
  children: React.ReactNode
  title?: string
}): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-3)'
      }}
    >
      {title && (
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 14, fontWeight: 600 }}>{title}</h3>
      )}
      {children}
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  padding: 4,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

const estiloBotonPrincipal: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600
}

const estiloBotonSecundario: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)'
}

const estiloBotonPeligro: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid var(--color-alert)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-alert-bg)',
  color: 'var(--color-alert)'
}

function MensajeError({ mensaje }: { mensaje: string | null }): React.JSX.Element | null {
  if (!mensaje) return null
  return (
    <p style={{ color: 'var(--color-alert)', fontSize: 12, margin: 'var(--space-2) 0 0 0' }}>
      {mensaje}
    </p>
  )
}

function FormularioAlta({ onCreada }: { onCreada: () => void }): React.JSX.Element {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crear = async (): Promise<void> => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await categoriasApi.crear(nombre.trim())
      setNombre('')
      onCreada()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear la categoría.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel title="Nueva categoría">
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
            Nombre
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Frenos"
            style={{ ...estiloInput, width: 220 }}
          />
        </div>
        <button onClick={crear} disabled={guardando} style={estiloBotonPrincipal}>
          Crear
        </button>
      </div>
      <MensajeError mensaje={error} />
    </Panel>
  )
}

function FilaCategoria({
  categoria,
  onCambio
}: {
  categoria: Categoria
  onCambio: () => void
}): React.JSX.Element {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(categoria.nombre)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async (): Promise<void> => {
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await categoriasApi.editar(categoria.id, nombre.trim())
      setEditando(false)
      onCambio()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (): Promise<void> => {
    setGuardando(true)
    setError(null)
    try {
      await categoriasApi.eliminar(categoria.id)
      onCambio()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo eliminar.')
      setConfirmandoBaja(false)
    } finally {
      setGuardando(false)
    }
  }

  if (editando) {
    return (
      <tr style={{ borderTop: '1px solid var(--color-border)' }}>
        <td style={{ padding: 8 }} colSpan={2}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ ...estiloInput, width: 220 }}
            />
            <button
              onClick={guardar}
              disabled={guardando}
              style={{ ...estiloBotonPrincipal, padding: '4px 10px', fontSize: 12 }}
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setEditando(false)
                setNombre(categoria.nombre)
                setError(null)
              }}
              style={{ ...estiloBotonSecundario, padding: '4px 10px', fontSize: 12 }}
            >
              Cancelar
            </button>
          </div>
          <MensajeError mensaje={error} />
        </td>
      </tr>
    )
  }

  return (
    <tr style={{ borderTop: '1px solid var(--color-border)' }}>
      <td style={{ padding: 8 }}>{categoria.nombre}</td>
      <td style={{ padding: 8, textAlign: 'right' }}>
        {confirmandoBaja ? (
          <div
            style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}
          >
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              ¿Eliminar &ldquo;{categoria.nombre}&rdquo;?
            </span>
            <button onClick={eliminar} disabled={guardando} style={estiloBotonPeligro}>
              Sí, eliminar
            </button>
            <button
              onClick={() => setConfirmandoBaja(false)}
              style={{ ...estiloBotonSecundario, padding: '4px 10px', fontSize: 12 }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditando(true)}
              style={{ ...estiloBotonSecundario, padding: '4px 10px', fontSize: 12 }}
            >
              Editar
            </button>
            <button onClick={() => setConfirmandoBaja(true)} style={estiloBotonPeligro}>
              Eliminar
            </button>
          </div>
        )}
        {!editando && <MensajeError mensaje={error} />}
      </td>
    </tr>
  )
}

export function CategoriaScreen(): React.JSX.Element {
  const categorias = useCategorias()

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Categorías</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Se usan para clasificar y filtrar productos. No hay una lista fija: el Administrador las
        define según el catálogo del taller.
      </p>

      <FormularioAlta onCreada={categorias.refrescar} />

      <Panel>
        {categorias.cargando ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando categorías…</p>
        ) : categorias.error ? (
          <MensajeError mensaje={categorias.error} />
        ) : categorias.datos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Todavía no hay categorías cargadas.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <th style={{ paddingBottom: 8 }}>Nombre</th>
                <th style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {categorias.datos.map((c) => (
                <FilaCategoria key={c.id} categoria={c} onCambio={categorias.refrescar} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
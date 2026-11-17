// src/renderer/src/screens/ProveedorScreen.tsx
//
// CRUD de Proveedores (HU-14, HU-15, ver sprint-1-backlog.md, punto 3).
// Sin pantalla previa en el prototipo. El backend (src/main/api/routes/
// proveedores.ts) solo expone listar, crear y editar — no hay endpoint de
// baja, así que acá tampoco hay botón de eliminar. Si en algún momento se
// agrega DELETE /api/proveedores/:id (con el mismo cuidado por violación de
// FK que categorías, ver routes/categorias.ts), se suma el botón acá.

import { useState } from 'react'
import { useProveedores } from '../api/hooks'
import { proveedoresApi } from '../api/proveedores'
import { ApiClientError } from '../api/client'
import type { Proveedor } from '../api/types'

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

function MensajeError({ mensaje }: { mensaje: string | null }): React.JSX.Element | null {
  if (!mensaje) return null
  return (
    <p style={{ color: 'var(--color-alert)', fontSize: 12, margin: 'var(--space-2) 0 0 0' }}>
      {mensaje}
    </p>
  )
}

function FormularioAlta({ onCreado }: { onCreado: () => void }): React.JSX.Element {
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
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
      await proveedoresApi.crear(nombre.trim(), contacto.trim() || null)
      setNombre('')
      setContacto('')
      onCreado()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear el proveedor.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel title="Nuevo proveedor">
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
            Nombre
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Distribuidora Acumsa"
            style={{ ...estiloInput, width: 220 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
            Contacto (opcional)
          </label>
          <input
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Teléfono, email..."
            style={{ ...estiloInput, width: 200 }}
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

function FilaProveedor({
  proveedor,
  onCambio
}: {
  proveedor: Proveedor
  onCambio: () => void
}): React.JSX.Element {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(proveedor.nombre)
  const [contacto, setContacto] = useState(proveedor.contacto ?? '')
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
      await proveedoresApi.editar(proveedor.id, {
        nombre: nombre.trim(),
        contacto: contacto.trim() || null
      })
      setEditando(false)
      onCambio()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  if (editando) {
    return (
      <tr style={{ borderTop: '1px solid var(--color-border)' }}>
        <td style={{ padding: 8 }} colSpan={3}>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ ...estiloInput, width: 220 }}
            />
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Contacto"
              style={{ ...estiloInput, width: 200 }}
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
                setNombre(proveedor.nombre)
                setContacto(proveedor.contacto ?? '')
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
      <td style={{ padding: 8 }}>{proveedor.nombre}</td>
      <td style={{ padding: 8, color: 'var(--color-text-muted)' }}>{proveedor.contacto ?? '—'}</td>
      <td style={{ padding: 8, textAlign: 'right' }}>
        <button
          onClick={() => setEditando(true)}
          style={{ ...estiloBotonSecundario, padding: '4px 10px', fontSize: 12 }}
        >
          Editar
        </button>
      </td>
    </tr>
  )
}

export function ProveedorScreen(): React.JSX.Element {
  const proveedores = useProveedores()

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Proveedores</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Un mismo producto puede tener varios proveedores, sin uno preferido — se elige al registrar
        cada compra.
      </p>

      <FormularioAlta onCreado={proveedores.refrescar} />

      <Panel>
        {proveedores.cargando ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando proveedores…</p>
        ) : proveedores.error ? (
          <MensajeError mensaje={proveedores.error} />
        ) : proveedores.datos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Todavía no hay proveedores cargados.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <th style={{ paddingBottom: 8 }}>Nombre</th>
                <th style={{ paddingBottom: 8 }}>Contacto</th>
                <th style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {proveedores.datos.map((p) => (
                <FilaProveedor key={p.id} proveedor={p} onCambio={proveedores.refrescar} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
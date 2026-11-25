// src/renderer/src/screens/MarcaScreen.tsx
//
// CRUD de Marcas (HU-37). Solo la ve el Administrador (ver Sidebar.tsx);
// el servidor valida el rol igual (routes/marcas.ts).

import { useState } from 'react'
import { useMarcas } from '../api/hooks'
import { marcasApi } from '../api/marcas'
import { useAuth } from '../data/AuthContext'
import type { ApiFail, ApiOk } from '../api/client'
import type { Marca } from '../api/types'

const panel: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 'var(--space-4)',
  marginBottom: 'var(--space-3)'
}
const input: React.CSSProperties = {
  padding: 4,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  width: 220
}
const botonPrincipal: React.CSSProperties = {
  padding: '4px 12px',
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600
}
const botonSecundario: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)'
}
const botonPeligro: React.CSSProperties = {
  ...botonSecundario,
  border: '1px solid var(--color-alert)',
  background: 'var(--color-alert-bg)',
  color: 'var(--color-alert)'
}

// Ejecuta una llamada a la API y devuelve el mensaje de error, o null si salió bien.
async function mensajeDe(llamada: Promise<ApiOk<unknown> | ApiFail>): Promise<string | null> {
  const r = await llamada
  return r.ok ? null : r.error.message
}

function Error_({ mensaje }: { mensaje: string | null }): React.JSX.Element | null {
  if (!mensaje) return null
  return <p style={{ color: 'var(--color-alert)', fontSize: 12, margin: '4px 0 0 0' }}>{mensaje}</p>
}

function FormularioAlta({
  token,
  onCreada
}: {
  token: string
  onCreada: () => void
}): React.JSX.Element {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crear = async (): Promise<void> => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    const err = await mensajeDe(marcasApi.crear(token, nombre.trim()))
    setGuardando(false)
    setError(err)
    if (!err) {
      setNombre('')
      onCreada()
    }
  }

  return (
    <div style={panel}>
      <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 14, fontWeight: 600 }}>Nueva marca</h3>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>
            Nombre
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && crear()}
            placeholder="Ej: Michelin"
            style={input}
          />
        </div>
        <button onClick={crear} disabled={guardando} style={botonPrincipal}>
          Crear
        </button>
      </div>
      <Error_ mensaje={error} />
    </div>
  )
}

function FilaMarca({
  marca,
  token,
  onCambio
}: {
  marca: Marca
  token: string
  onCambio: () => void
}): React.JSX.Element {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(marca.nombre)
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const correr = async (llamada: Promise<ApiOk<unknown> | ApiFail>): Promise<boolean> => {
    setGuardando(true)
    const err = await mensajeDe(llamada)
    setGuardando(false)
    setError(err)
    if (!err) onCambio()
    return !err
  }

  const guardar = async (): Promise<void> => {
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    if (await correr(marcasApi.editar(token, marca.id, nombre.trim()))) setEditando(false)
  }

  const eliminar = async (): Promise<void> => {
    if (!(await correr(marcasApi.eliminar(token, marca.id)))) setConfirmando(false)
  }

  return (
    <tr style={{ borderTop: '1px solid var(--color-border)' }}>
      <td style={{ padding: 8 }}>
        {editando ? (
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
            style={input}
          />
        ) : (
          marca.nombre
        )}
        <Error_ mensaje={error} />
      </td>
      <td style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
          {editando ? (
            <>
              <button onClick={guardar} disabled={guardando} style={botonPrincipal}>
                Guardar
              </button>
              <button
                onClick={() => {
                  setEditando(false)
                  setNombre(marca.nombre)
                  setError(null)
                }}
                style={botonSecundario}
              >
                Cancelar
              </button>
            </>
          ) : confirmando ? (
            <>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                ¿Eliminar &ldquo;{marca.nombre}&rdquo;?
              </span>
              <button onClick={eliminar} disabled={guardando} style={botonPeligro}>
                Sí, eliminar
              </button>
              <button onClick={() => setConfirmando(false)} style={botonSecundario}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditando(true)} style={botonSecundario}>
                Editar
              </button>
              <button onClick={() => setConfirmando(true)} style={botonPeligro}>
                Eliminar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export function MarcaScreen(): React.JSX.Element {
  const { token } = useAuth()
  const marcas = useMarcas(token)

  if (!token) return <p>Iniciá sesión para ver las marcas.</p>

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Marcas</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Se usan para clasificar y filtrar productos (ej. Michelin, Bosch). La marca de un producto
        es opcional.
      </p>

      <FormularioAlta token={token} onCreada={marcas.refrescar} />

      <div style={panel}>
        {marcas.cargando ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando marcas…</p>
        ) : marcas.error ? (
          <Error_ mensaje={marcas.error} />
        ) : marcas.datos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Todavía no hay marcas cargadas.
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
              {marcas.datos.map((m) => (
                <FilaMarca key={m.id} marca={m} token={token} onCambio={marcas.refrescar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
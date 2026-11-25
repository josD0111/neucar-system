// src/renderer/src/screens/TiposServicioScreen.tsx
//
// Catálogo de tipos de servicio (alineación, balanceo, mantenimiento, etc.).
// Solo el Administrador lo gestiona. Cada tipo tiene un monto base opcional y un
// indicador "se cobra por rueda": si está activo, al cargar ese servicio en una
// orden se pide la cantidad de ruedas y el precio se calcula como base × ruedas.
// También puede tener un intervalo de mantenimiento en km (HU-41): si está
// cargado, el historial de servicios muestra cuándo toca el próximo.
// Los tipos no se borran: se deshabilitan, para no romper las órdenes anteriores.

import { useState } from 'react'
import { useTiposServicio } from '../api/hooks'
import { tiposServicioApi } from '../api/tiposServicio'
import type { TipoServicio } from '../api/types'
import { InputLimpiable } from '../components/InputLimpiable'
import { useAuth } from '../data/AuthContext'

// Formato de guaraníes: 150000 → "150.000".
const gs = (n: number): string => n.toLocaleString('es-PY')

// Interpreta el campo "Monto base":
//   - vacío → null (el servicio no tiene precio fijo)
//   - número mayor a cero con hasta 2 decimales → ese número
//   - cualquier otra cosa → undefined (inválido)
function leerMontoBase(texto: string): number | null | undefined {
  const t = texto.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    return undefined
  }
  return n
}

const MENSAJE_MONTO_INVALIDO =
  'El monto base debe ser un número mayor a cero (hasta 2 decimales) o quedar vacío.'

// Interpreta el campo "Intervalo de mantenimiento" (km):
//   - vacío → null (el tipo no genera aviso de próximo mantenimiento)
//   - entero entre 1 y 1.000.000 → ese número
//   - cualquier otra cosa → undefined (inválido)
function leerIntervalo(texto: string): number | null | undefined {
  const t = texto.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : undefined
}

const MENSAJE_INTERVALO = 'El intervalo debe ser un entero entre 1 y 1.000.000 km, o quedar vacío.'

function descripcionMonto(t: TipoServicio): string {
  if (t.montoBase === null) return 'Sin precio fijo'
  const base = `Gs. ${gs(Number(t.montoBase))}`
  return t.requiereRuedas ? `${base} por rueda` : base
}

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

const estiloEtiqueta: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-muted)',
  display: 'block'
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
  padding: '4px 10px',
  fontSize: 12,
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

function FormularioAlta({
  token,
  onCreado
}: {
  token: string | null
  onCreado: () => void
}): React.JSX.Element {
  const [nombre, setNombre] = useState('')
  const [montoBase, setMontoBase] = useState('')
  const [intervalo, setIntervalo] = useState('')
  const [requiereRuedas, setRequiereRuedas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crear = async (): Promise<void> => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    const monto = leerMontoBase(montoBase)
    if (monto === undefined) {
      setError(MENSAJE_MONTO_INVALIDO)
      return
    }
    const intervaloKm = leerIntervalo(intervalo)
    if (intervaloKm === undefined) {
      setError(MENSAJE_INTERVALO)
      return
    }
    setGuardando(true)
    setError(null)
    const r = await tiposServicioApi.crear(token, {
      nombre: nombre.trim(),
      montoBase: monto,
      requiereRuedas,
      intervaloKm
    })
    setGuardando(false)
    if (!r.ok) {
      setError(r.error.message)
      return
    }
    setNombre('')
    setMontoBase('')
    setIntervalo('')
    setRequiereRuedas(false)
    onCreado()
  }

  return (
    <Panel title="Nuevo tipo de servicio">
      <div
        style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div>
          <label style={estiloEtiqueta}>Nombre</label>
          <InputLimpiable
            value={nombre}
            onChange={setNombre}
            placeholder="Ej: Balanceo"
            maxLength={100}
            style={{ ...estiloInput, width: 220 }}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Monto base (Gs., opcional)</label>
          <InputLimpiable
            type="number"
            min={0}
            value={montoBase}
            onChange={setMontoBase}
            className="font-data"
            style={{ ...estiloInput, width: 140 }}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Intervalo de mantenimiento (km, opcional)</label>
          <InputLimpiable
            type="number"
            min={1}
            value={intervalo}
            onChange={setIntervalo}
            placeholder="Ej: 5000"
            className="font-data"
            style={{ ...estiloInput, width: 140 }}
          />
        </div>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={requiereRuedas}
            onChange={(e) => setRequiereRuedas(e.target.checked)}
          />
          Se cobra por rueda (pide la cantidad de ruedas)
        </label>
        <button onClick={() => void crear()} disabled={guardando} style={estiloBotonPrincipal}>
          Crear
        </button>
      </div>
      <p style={{ margin: 'var(--space-2) 0 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
        Si se cobra por rueda, el monto base es el precio de UNA rueda. Sin monto base, el precio se
        escribe a mano en cada orden. Con intervalo de mantenimiento, el historial de servicios
        muestra cuándo toca el próximo (km de la visita + intervalo).
      </p>
      <MensajeError mensaje={error} />
    </Panel>
  )
}

function FilaTipo({
  tipo,
  token,
  onCambio
}: {
  tipo: TipoServicio
  token: string | null
  onCambio: () => void
}): React.JSX.Element {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(tipo.nombre)
  const [montoBase, setMontoBase] = useState(tipo.montoBase === null ? '' : String(Number(tipo.montoBase)))
  const [intervalo, setIntervalo] = useState(tipo.intervaloKm === null ? '' : String(tipo.intervaloKm))
  const [requiereRuedas, setRequiereRuedas] = useState(tipo.requiereRuedas)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const empezarEdicion = (): void => {
    setNombre(tipo.nombre)
    setMontoBase(tipo.montoBase === null ? '' : String(Number(tipo.montoBase)))
    setIntervalo(tipo.intervaloKm === null ? '' : String(tipo.intervaloKm))
    setRequiereRuedas(tipo.requiereRuedas)
    setError(null)
    setEditando(true)
  }

  const guardar = async (): Promise<void> => {
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    const monto = leerMontoBase(montoBase)
    if (monto === undefined) {
      setError(MENSAJE_MONTO_INVALIDO)
      return
    }
    const intervaloKm = leerIntervalo(intervalo)
    if (intervaloKm === undefined) {
      setError(MENSAJE_INTERVALO)
      return
    }
    setGuardando(true)
    setError(null)
    const r = await tiposServicioApi.editar(token, tipo.id, {
      nombre: nombre.trim(),
      montoBase: monto,
      requiereRuedas,
      intervaloKm
    })
    setGuardando(false)
    if (!r.ok) {
      setError(r.error.message)
      return
    }
    setEditando(false)
    onCambio()
  }

  const cambiarActivo = async (): Promise<void> => {
    setGuardando(true)
    setError(null)
    const r = await tiposServicioApi.editar(token, tipo.id, { activo: !tipo.activo })
    setGuardando(false)
    if (!r.ok) {
      setError(r.error.message)
      return
    }
    onCambio()
  }

  if (editando) {
    return (
      <tr style={{ borderTop: '1px solid var(--color-border)' }}>
        <td style={{ padding: 8 }} colSpan={5}>
          <div
            style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}
          >
            <InputLimpiable
              autoFocus
              value={nombre}
              onChange={setNombre}
              maxLength={100}
              style={{ ...estiloInput, width: 200 }}
            />
            <InputLimpiable
              type="number"
              min={0}
              value={montoBase}
              onChange={setMontoBase}
              placeholder="Sin precio fijo"
              className="font-data"
              style={{ ...estiloInput, width: 140 }}
            />
            <InputLimpiable
              type="number"
              min={1}
              value={intervalo}
              onChange={setIntervalo}
              placeholder="Intervalo km"
              className="font-data"
              style={{ ...estiloInput, width: 120 }}
            />
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={requiereRuedas}
                onChange={(e) => setRequiereRuedas(e.target.checked)}
              />
              Por rueda
            </label>
            <button
              onClick={() => void guardar()}
              disabled={guardando}
              style={{ ...estiloBotonPrincipal, padding: '4px 10px', fontSize: 12 }}
            >
              Guardar
            </button>
            <button onClick={() => setEditando(false)} style={estiloBotonSecundario}>
              Cancelar
            </button>
          </div>
          <MensajeError mensaje={error} />
        </td>
      </tr>
    )
  }

  return (
    <tr
      style={{
        borderTop: '1px solid var(--color-border)',
        opacity: tipo.activo ? 1 : 0.55
      }}
    >
      <td style={{ padding: 8 }}>
        {tipo.nombre}
        {!tipo.activo && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}> (deshabilitado)</span>
        )}
      </td>
      <td style={{ padding: 8 }} className="font-data">
        {descripcionMonto(tipo)}
      </td>
      <td style={{ padding: 8 }}>{tipo.requiereRuedas ? 'Pide ruedas' : '—'}</td>
      <td style={{ padding: 8 }} className="font-data">
        {tipo.intervaloKm !== null ? `Cada ${gs(tipo.intervaloKm)} km` : '—'}
      </td>
      <td style={{ padding: 8, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button onClick={empezarEdicion} style={estiloBotonSecundario}>
            Editar
          </button>
          <button onClick={() => void cambiarActivo()} disabled={guardando} style={estiloBotonSecundario}>
            {tipo.activo ? 'Deshabilitar' : 'Habilitar'}
          </button>
        </div>
        <MensajeError mensaje={error} />
      </td>
    </tr>
  )
}

export function TiposServicioScreen(): React.JSX.Element {
  const { token, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador'
  // Sin permiso no se pide nada: el servidor igual lo rechazaría.
  const tipos = useTiposServicio(esAdmin ? token : null, true)

  if (!esAdmin) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Tipos de servicio</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Solo el Administrador puede gestionar los tipos de servicio.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Tipos de servicio</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Son los servicios que se pueden elegir al cargar una orden. El monto base se propone al
        cargar la orden y se puede cambiar en cada una; los cambios acá no modifican las órdenes ya
        registradas.
      </p>

      <FormularioAlta token={token} onCreado={tipos.refrescar} />

      <Panel>
        {tipos.cargando ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando…</p>
        ) : tipos.error ? (
          <MensajeError mensaje={tipos.error} />
        ) : tipos.datos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Todavía no hay tipos de servicio cargados.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <th style={{ paddingBottom: 8 }}>Nombre</th>
                <th style={{ paddingBottom: 8 }}>Monto base</th>
                <th style={{ paddingBottom: 8 }}>Ruedas</th>
                <th style={{ paddingBottom: 8 }}>Mantenimiento</th>
                <th style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {tipos.datos.map((t) => (
                <FilaTipo key={t.id} tipo={t} token={token} onCambio={tipos.refrescar} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
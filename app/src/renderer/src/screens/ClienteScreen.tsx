// src/renderer/src/screens/ClienteScreen.tsx
//
// Gestión de clientes (HU-09), conectada a la API real (/api/clientes).
// Permite buscar, crear, editar y deshabilitar/habilitar clientes.
// Los clientes no se borran: se deshabilitan para conservar su historial.
//
// El saldo pendiente y el detalle de deudas (HU-10.1, HU-11, HU-12) quedan
// pendientes hasta el Sprint 2, cuando existan las ventas y las órdenes de
// servicio reales. Por eso esa sección muestra solo un aviso.

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiFetch } from '../api/client'
import { useAuth } from '../data/AuthContext'

// Forma de un cliente tal como lo devuelve la API.
interface Cliente {
  id: number
  nombre: string
  cedula: string | null
  celular: string | null
  ruc: string | null
  activo: boolean
}

// Campos del formulario (siempre texto; vacío = sin dato).
interface FormCliente {
  nombre: string
  cedula: string
  celular: string
  ruc: string
}

const FORM_VACIO: FormCliente = { nombre: '', cedula: '', celular: '', ruc: '' }

// Estilo compartido por los campos de texto.
const estiloInput = {
  padding: 'var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

// Contenedor visual con título opcional (misma apariencia que el prototipo).
function Panel({ children, title }: { children: React.ReactNode; title?: string }) {
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
      {title && <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 14, fontWeight: 600 }}>{title}</h3>}
      {children}
    </div>
  )
}

export function ClienteScreen(): React.JSX.Element {
  const { usuario, token } = useAuth()
  const esAdmin = usuario?.rol === 'Administrador' // solo el Administrador deshabilita

  // --- Estado de la lista ---
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorLista, setErrorLista] = useState<string | null>(null)

  // --- Estado de la ficha y del formulario ---
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null)
  // null = formulario cerrado, 'nuevo' = alta, número = id del cliente que se edita
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState<FormCliente>(FORM_VACIO)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Pide la lista a la API aplicando búsqueda y filtro de deshabilitados.
  const cargar = useCallback(async () => {
    setCargando(true)
    const params = new URLSearchParams()
    if (busqueda.trim()) params.set('q', busqueda.trim())
    if (verInactivos) params.set('inactivos', 'true')
    const r = await apiFetch<Cliente[]>(`/api/clientes?${params.toString()}`, { token })
    if (r.ok) {
      setClientes(r.data)
      setErrorLista(null)
    } else {
      setErrorLista(r.error.message)
    }
    setCargando(false)
  }, [busqueda, verInactivos, token])

  // Recarga cuando cambia la búsqueda o el filtro. La pequeña espera (300 ms)
  // evita hacer una petición por cada letra que se escribe.
  useEffect(() => {
    const espera = setTimeout(cargar, 300)
    return () => clearTimeout(espera)
  }, [cargar])

  // Abre el formulario vacío para dar de alta un cliente.
  const abrirNuevo = (): void => {
    setEditando('nuevo')
    setForm(FORM_VACIO)
    setErrorForm(null)
  }

  // Abre el formulario con los datos actuales del cliente para editarlo.
  const abrirEditar = (c: Cliente): void => {
    setEditando(c.id)
    setForm({
      nombre: c.nombre,
      cedula: c.cedula ?? '',
      celular: c.celular ?? '',
      ruc: c.ruc ?? ''
    })
    setErrorForm(null)
  }

  // Devuelve un manejador que actualiza un campo del formulario.
  const cambiarCampo =
    (campo: keyof FormCliente) =>
      (e: ChangeEvent<HTMLInputElement>): void =>
        setForm({ ...form, [campo]: e.target.value })

  // Guarda el formulario: POST si es alta, PUT si es edición.
  // Siempre se envían los cuatro campos (PUT reemplaza todos).
  const guardar = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorForm(null)
    setGuardando(true)
    const esNuevo = editando === 'nuevo'
    const r = await apiFetch<Cliente>(esNuevo ? '/api/clientes' : `/api/clientes/${editando}`, {
      method: esNuevo ? 'POST' : 'PUT',
      body: form,
      token
    })
    setGuardando(false)
    if (!r.ok) {
      setErrorForm(r.error.message) // por ejemplo: nombre vacío o cédula repetida
      return
    }
    setEditando(null)
    setSeleccionado(r.data) // dejamos abierta la ficha del cliente guardado
    cargar()
  }

  // Deshabilita o vuelve a habilitar un cliente (solo Administrador).
  // Es reversible y no borra nada, por eso no pide confirmación.
  const cambiarEstado = async (c: Cliente): Promise<void> => {
    const r = await apiFetch<Cliente>(`/api/clientes/${c.id}/estado`, {
      method: 'PATCH',
      body: { activo: !c.activo },
      token
    })
    if (!r.ok) {
      setErrorLista(r.error.message)
      return
    }
    if (seleccionado?.id === c.id) setSeleccionado(r.data)
    cargar()
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Clientes</h2>

      {/* Lista con búsqueda */}
      <Panel>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <input
            placeholder="Buscar por nombre, cédula o celular"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ ...estiloInput, minWidth: 280 }}
          />
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Mostrar deshabilitados
          </label>
          <button
            onClick={abrirNuevo}
            style={{
              marginLeft: 'auto',
              padding: 'var(--space-2) var(--space-3)',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontWeight: 600
            }}
          >
            Nuevo cliente
          </button>
        </div>

        {errorLista && (
          <div style={{ color: 'var(--color-alert)', fontSize: 13, marginBottom: 'var(--space-2)' }}>{errorLista}</div>
        )}

        {cargando ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Cargando…</p>
        ) : clientes.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No hay clientes que coincidan.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <th style={{ paddingBottom: 8 }}>Nombre</th>
                <th style={{ paddingBottom: 8 }}>Cédula</th>
                <th style={{ paddingBottom: 8 }}>Celular</th>
                <th style={{ paddingBottom: 8 }}>RUC</th>
                <th style={{ paddingBottom: 8 }}>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSeleccionado(c)} // clic en la fila = ver la ficha
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    background: seleccionado?.id === c.id ? 'var(--color-bg)' : 'transparent',
                    opacity: c.activo ? 1 : 0.55 // los deshabilitados se ven atenuados
                  }}
                >
                  <td style={{ padding: 8 }}>{c.nombre}</td>
                  <td className="font-data" style={{ padding: 8 }}>{c.cedula ?? '—'}</td>
                  <td className="font-data" style={{ padding: 8 }}>{c.celular ?? '—'}</td>
                  <td className="font-data" style={{ padding: 8 }}>{c.ruc ?? '—'}</td>
                  <td style={{ padding: 8 }}>{c.activo ? 'Activo' : 'Deshabilitado'}</td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation() // evita que el clic también seleccione la fila
                        abrirEditar(c)
                      }}
                      style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)', marginRight: 4 }}
                    >
                      Editar
                    </button>
                    {esAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          cambiarEstado(c)
                        }}
                        style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'transparent' }}
                      >
                        {c.activo ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Formulario de alta / edición (solo visible cuando se abre) */}
      {editando !== null && (
        <Panel title={editando === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}>
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 420 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              Nombre (obligatorio)
              <input value={form.nombre} onChange={cambiarCampo('nombre')} autoFocus style={estiloInput} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              Cédula
              <input value={form.cedula} onChange={cambiarCampo('cedula')} style={estiloInput} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              Celular
              <input
                value={form.celular}
                // Descarta en el momento cualquier carácter que no sea número, + - ( ) o espacio
                // (también filtra lo que se pegue desde el portapapeles).
                onChange={(e) => setForm({ ...form, celular: e.target.value.replace(/[^0-9+\-()\s]/g, '') })}
                inputMode="tel" // en pantallas táctiles muestra el teclado numérico
                maxLength={30}
                style={estiloInput}
              />            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              RUC (opcional, para factura electrónica)
              <input
                value={form.ruc}
                // Solo números, letras y guion; las letras se pasan a mayúscula al escribir.
                onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/[^0-9A-Za-z-]/g, '').toUpperCase() })}
                placeholder="Ej.: 80080099-0"
                maxLength={20}
                style={estiloInput}
              />            </label>

            {errorForm && (
              <div style={{ background: 'var(--color-alert-bg)', color: 'var(--color-alert)', padding: 'var(--space-2)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                {errorForm}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="submit"
                disabled={guardando || !form.nombre.trim()}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontWeight: 600,
                  opacity: guardando || !form.nombre.trim() ? 0.6 : 1
                }}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setEditando(null)}
                style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'transparent' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Ficha del cliente seleccionado */}
      {seleccionado && (
        <>
          <Panel title={`Ficha: ${seleccionado.nombre}`}>
            <div style={{ display: 'flex', gap: 'var(--space-5)', fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Cédula</div>
                <div className="font-data">{seleccionado.cedula ?? '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Celular</div>
                <div className="font-data">{seleccionado.celular ?? '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>RUC</div>
                <div className="font-data">{seleccionado.ruc ?? '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Estado</div>
                <div>{seleccionado.activo ? 'Activo' : 'Deshabilitado'}</div>
              </div>
            </div>
          </Panel>

          {/* Pendiente de Sprint 2: no mostramos saldos inventados. */}
          <Panel title="Saldo pendiente">
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              El saldo y el detalle de deudas estarán disponibles cuando se implementen las ventas y
              las órdenes de servicio reales (Sprint 2).
            </p>
          </Panel>
        </>
      )}
    </div>
  )
}
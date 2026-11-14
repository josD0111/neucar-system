// src/renderer/src/screens/HistorialServiciosScreen.tsx
//
// Historial de servicios por vehículo (HU-26). Se busca el vehículo por chapa,
// marca o nombre del dueño y se ven todas sus órdenes. Sirve para verificar
// cuándo se hizo un trabajo y con qué condiciones se entregó el vehículo, y es
// la única forma de consultar las órdenes de clientes casuales (sin cliente
// registrado), que se identifican por la chapa.

import { useState } from 'react'
import { useVehiculos } from '../api/hooks'
import type { Vehiculo } from '../api/types'
import { HistorialOrdenes } from '../components/HistorialOrdenes'
import { useAuth } from '../data/AuthContext'
import { useRetardo } from './useRetardo'

const MAX_RESULTADOS = 8

const estiloInput = {
  padding: 'var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)'
}

const estiloBotonSecundario = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-bg)'
}

function Panel({ children, title }: { children: React.ReactNode; title?: string }): React.JSX.Element {
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

function textoVehiculo(v: Vehiculo): string {
  return [v.chapa ?? 'Sin chapa', v.marca, v.color].filter(Boolean).join(' · ')
}

export function HistorialServiciosScreen(): React.JSX.Element {
  const { token } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)

  const q = useRetardo(busqueda.trim(), 300)
  const { datos: encontrados, cargando } = useVehiculos(token, { q })
  const hayBusqueda = busqueda.trim() !== ''

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Historial de servicios</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: -8 }}>
        Buscá un vehículo para ver los servicios que se le hicieron y con qué condiciones se entregó.
      </p>

      <Panel title="Vehículo">
        {vehiculo ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="font-data">{textoVehiculo(vehiculo)}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {vehiculo.clienteNombre ? `Dueño: ${vehiculo.clienteNombre}` : 'Sin dueño registrado'}
            </span>
            <button type="button" onClick={() => setVehiculo(null)} style={{ ...estiloBotonSecundario, marginLeft: 'auto' }}>
              Buscar otro vehículo
            </button>
          </div>
        ) : (
          <div>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por chapa, marca o nombre del dueño"
              autoFocus
              style={{ ...estiloInput, minWidth: 340 }}
            />
            {hayBusqueda && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                {cargando ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>Buscando…</p>
                ) : encontrados.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>No hay vehículos que coincidan.</p>
                ) : (
                  <>
                    {encontrados.slice(0, MAX_RESULTADOS).map((v) => (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => {
                          setVehiculo(v)
                          setBusqueda('')
                        }}
                        style={{ ...estiloBotonSecundario, display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                      >
                        <span className="font-data">{textoVehiculo(v)}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {v.clienteNombre ? `  —  ${v.clienteNombre}` : '  —  sin dueño'}
                        </span>
                      </button>
                    ))}
                    {encontrados.length > MAX_RESULTADOS && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Hay {encontrados.length - MAX_RESULTADOS} más: afiná la búsqueda.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      {vehiculo && (
        <Panel title="Servicios realizados">
          <HistorialOrdenes key={vehiculo.id} vehiculoId={vehiculo.id} />
        </Panel>
      )}
    </div>
  )
}
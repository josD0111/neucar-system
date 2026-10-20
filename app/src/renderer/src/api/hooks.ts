// src/renderer/src/api/hooks.ts
//
// Hooks livianos de datos para la pantalla de Stock. Sin librería de
// data-fetching (react-query, swr, etc.) — el proyecto no la tiene instalada
// y el volumen de datos de un taller no la justifica todavía. Cada hook
// expone { datos, cargando, error, refrescar } y usa `refrescar` para volver
// a pedir los datos después de una mutación (crear/editar/eliminar), en vez
// de actualizar el estado local "a mano" y arriesgarse a desincronizar con
// el servidor.
//
// `cargando` solo es true en la primera carga: un `refrescar()` posterior
// (tras guardar algo) actualiza `datos` en cuanto llega la respuesta, sin
// ocultar la tabla con un estado de carga intermedio. Es deliberado: no se
// resetea `cargando` a true dentro del efecto para no violar la regla
// `react-hooks/set-state-in-effect` (setState síncrono dentro de un efecto).

import { useEffect, useState } from 'react'
import { categoriasApi } from './categorias'
import { proveedoresApi } from './proveedores'
import { productosApi, type FiltrosProductos } from './productos'
import { ApiClientError } from './client'
import type { Categoria, ListadoPaginado, Proveedor, Producto } from './types'

export interface RecursoAsync<T> {
  datos: T
  cargando: boolean
  error: string | null
  refrescar: () => void
}

function mensajeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message
  return 'Ocurrió un error inesperado.'
}

function useRecursoAsync<T>(
  valorInicial: T,
  obtener: () => Promise<T>,
  deps: unknown[]
): RecursoAsync<T> {
  const [datos, setDatos] = useState<T>(valorInicial)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelado = false
    // `obtener` se captura de la renderización que programó este efecto —
    // el efecto solo se reprograma al cambiar `tick` o `deps`, no en cada
    // render, así que no hace falta (ni conviene) guardarlo en un ref.
    obtener()
      .then((rows) => {
        if (cancelado) return
        setDatos(rows)
        setError(null)
      })
      .catch((err) => !cancelado && setError(mensajeError(err)))
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { datos, cargando, error, refrescar: () => setTick((t) => t + 1) }
}

export function useCategorias(): RecursoAsync<Categoria[]> {
  return useRecursoAsync<Categoria[]>([], () => categoriasApi.listar(), [])
}

export function useProveedores(): RecursoAsync<Proveedor[]> {
  return useRecursoAsync<Proveedor[]>([], () => proveedoresApi.listar(), [])
}

// Valor inicial de la respuesta paginada, antes de que llegue la primera
// respuesta del backend (ver ListadoPaginado en api/types.ts).
const LISTADO_PAGINADO_INICIAL: ListadoPaginado<Producto> = {
  items: [],
  total: 0,
  pagina: 1,
  porPagina: 20
}

export function useProductos(filtros: FiltrosProductos): RecursoAsync<ListadoPaginado<Producto>> {
  return useRecursoAsync<ListadoPaginado<Producto>>(
    LISTADO_PAGINADO_INICIAL,
    () => productosApi.listar(filtros),
    [
      filtros.categoriaId,
      filtros.q,
      filtros.soloConStock,
      filtros.soloStockBajo,
      filtros.pagina,
      filtros.porPagina
    ]
  )
}

export function useStockBajo(): RecursoAsync<Producto[]> {
  return useRecursoAsync<Producto[]>([], () => productosApi.stockBajo(), [])
}
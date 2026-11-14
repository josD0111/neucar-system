// src/renderer/src/screens/useRetardo.ts
//
// Devuelve el valor con un retraso: evita pedir datos al servidor por cada
// letra que se escribe en un buscador.

import { useEffect, useState } from 'react'

export function useRetardo<T>(valor: T, ms: number): T {
  const [retardado, setRetardado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setRetardado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return retardado
}